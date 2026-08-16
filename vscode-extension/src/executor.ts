import * as vscode from 'vscode';
import * as path from 'path';
import { exec, ChildProcess } from 'child_process';
import { ToolCallPayload, ToolResultPayload } from './types';

interface ActiveExecution {
  callId: string;
  command: string;
  startedAt: number;
  childProcess?: ChildProcess;
  isAborted?: boolean;
}

export class CommandExecutor {
  private outputChannel: vscode.OutputChannel;
  private agentTerminal: vscode.Terminal | null = null;
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private onProgressCallback?: (callId: string, phase: string) => void;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  public setProgressCallback(cb: (callId: string, phase: string) => void) {
    this.onProgressCallback = cb;
  }

  public abort(callId?: string): boolean {
    if (callId) {
      const active = this.activeExecutions.get(callId);
      if (active) {
        active.isAborted = true;
        if (active.childProcess) {
          try {
            active.childProcess.kill('SIGTERM');
            setTimeout(() => {
              if (active.childProcess && !active.childProcess.killed) {
                active.childProcess.kill('SIGKILL');
              }
            }, 1000);
          } catch (e) {}
        }
        this.outputChannel.appendLine(`[EXECUTOR] ⏹️ Aborted execution for call ID: ${callId}`);
        return true;
      }
    } else {
      // Abort all
      let abortedAny = false;
      for (const [id, active] of this.activeExecutions.entries()) {
        active.isAborted = true;
        if (active.childProcess) {
          try {
            active.childProcess.kill('SIGTERM');
          } catch (e) {}
        }
        abortedAny = true;
        this.outputChannel.appendLine(`[EXECUTOR] ⏹️ Aborted execution for call ID: ${id}`);
      }
      return abortedAny;
    }
    return false;
  }

  public isBusy(): boolean {
    return this.activeExecutions.size > 0;
  }

  public getActiveSummary(): { id: string; command: string; startedAt: number } | null {
    if (this.activeExecutions.size === 0) return null;
    const first = this.activeExecutions.values().next().value;
    return first ? { id: first.callId, command: first.command, startedAt: first.startedAt } : null;
  }

  public async execute(call: ToolCallPayload): Promise<ToolResultPayload> {
    const callId = call.id || `call_${Date.now()}`;
    const command = call.command;
    const args = call.args || {};
    const startedAt = Date.now();

    const activeInfo: ActiveExecution = { callId, command, startedAt };
    this.activeExecutions.set(callId, activeInfo);

    this.outputChannel.appendLine(`[EXECUTOR] Executing: ${command} (${callId})`);
    this.reportProgress(callId, `Starting ${command}...`);

    try {
      let result: any = null;

      switch (command) {
        case 'file:read':
          this.reportProgress(callId, `Reading file: ${args.path || '.'}`);
          result = await this.handleFileRead(args.path);
          break;
        case 'file:write':
          this.reportProgress(callId, `Writing file: ${args.path || '.'}`);
          result = await this.handleFileWrite(args.path, args.content);
          break;
        case 'file:edit':
          this.reportProgress(callId, `Applying targeted diff to: ${args.path || '.'}`);
          result = await this.handleFileEdit(
            args.path,
            args.target ?? args.search ?? args.oldText ?? args.targetContent,
            args.replacement ?? args.replace ?? args.newText ?? args.replacementContent,
            Boolean(args.replaceAll)
          );
          break;
        case 'file:list':
          this.reportProgress(callId, `Listing directory: ${args.path || '.'}`);
          result = await this.handleFileList(args.path);
          break;
        case 'npm:run':
          this.reportProgress(callId, `Running npm script: npm run ${args.script}`);
          result = await this.handleNpmRun(args.script, activeInfo);
          break;
        case 'terminal:exec':
          this.reportProgress(callId, `Executing shell command: ${args.cmd}`);
          result = await this.handleTerminalExec(args.cmd, activeInfo);
          break;
        default:
          throw new Error(`Unknown command: "${command}"`);
      }

      if (activeInfo.isAborted) {
        return {
          agent_response: 'tool_result',
          id: callId,
          status: 'aborted',
          error: 'Execution was aborted by user request.',
          timestamp: Date.now(),
        };
      }

      return {
        agent_response: 'tool_result',
        id: callId,
        status: 'success',
        result,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      const isAborted = activeInfo.isAborted;
      return {
        agent_response: 'tool_result',
        id: callId,
        status: isAborted ? 'aborted' : 'error',
        error: isAborted ? 'Execution aborted.' : err?.message || String(err),
        timestamp: Date.now(),
      };
    } finally {
      this.activeExecutions.delete(callId);
    }
  }

  private reportProgress(callId: string, phase: string) {
    if (this.onProgressCallback) {
      this.onProgressCallback(callId, phase);
    }
  }

  private getWorkspaceRoot(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) throw new Error('No open workspace in VS Code.');
    return folders[0].uri.fsPath;
  }

  private resolveUri(relativePath?: string): vscode.Uri {
    const root = this.getWorkspaceRoot();
    const cleanPath = (relativePath || '.').replace(/^[\\\/]+/, '');
    const absolutePath = path.resolve(root, cleanPath);
    if (!absolutePath.startsWith(root)) throw new Error('Access denied: Path outside workspace.');
    return vscode.Uri.file(absolutePath);
  }

  private async handleFileRead(relativePath?: string): Promise<string> {
    if (!relativePath) throw new Error('Missing "path" argument');
    const uri = this.resolveUri(relativePath);
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf8');
  }

  private async handleFileWrite(relativePath?: string, content?: string): Promise<string> {
    if (!relativePath) throw new Error('Missing "path" argument');
    const uri = this.resolveUri(relativePath);
    const parentDirUri = vscode.Uri.file(path.dirname(uri.fsPath));
    try { await vscode.workspace.fs.createDirectory(parentDirUri); } catch (e) {}
    const uint8Array = Buffer.from(content || '', 'utf8');
    await vscode.workspace.fs.writeFile(uri, uint8Array);
    return `File successfully written to ${relativePath} (${uint8Array.length} bytes)`;
  }

  private async handleFileEdit(
    relativePath?: string,
    target?: string,
    replacement?: string,
    replaceAll?: boolean
  ): Promise<string> {
    if (!relativePath) throw new Error('Missing "path" argument');
    if (target === undefined || target === null || target === '') {
      throw new Error('Missing "target" (search text) argument for file:edit');
    }
    const replaceStr = replacement !== undefined && replacement !== null ? String(replacement) : '';

    const uri = this.resolveUri(relativePath);
    let originalContent: string;
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      originalContent = Buffer.from(data).toString('utf8');
    } catch (e: any) {
      throw new Error(`File "${relativePath}" not found. Please use file:write to create new files.`);
    }

    if (!originalContent.includes(target)) {
      throw new Error(
        `Target string not found in "${relativePath}". Please run file:read first to inspect the current file content before editing.`
      );
    }

    let updatedContent: string;
    let replacementCount = 0;

    if (replaceAll) {
      const parts = originalContent.split(target);
      replacementCount = parts.length - 1;
      updatedContent = parts.join(replaceStr);
    } else {
      replacementCount = 1;
      updatedContent = originalContent.replace(target, replaceStr);
    }

    const uint8Array = Buffer.from(updatedContent, 'utf8');
    await vscode.workspace.fs.writeFile(uri, uint8Array);
    return `File successfully edited at "${relativePath}". Replaced ${replacementCount} occurrence(s) (${uint8Array.length} bytes written).`;
  }

  private async handleFileList(relativePath?: string) {
    const uri = this.resolveUri(relativePath || '.');
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, type]: [string, vscode.FileType]) => ({ name, type }));
  }

  private async handleNpmRun(scriptName?: string, activeInfo?: ActiveExecution): Promise<string> {
    if (!scriptName) throw new Error('Missing "script" argument');
    return this.executeShellCommand(`npm run ${scriptName}`, activeInfo);
  }

  private async handleTerminalExec(cmd?: string, activeInfo?: ActiveExecution): Promise<string> {
    if (!cmd) throw new Error('Missing "cmd" argument');
    return this.executeShellCommand(cmd, activeInfo);
  }

  private executeShellCommand(commandLine: string, activeInfo?: ActiveExecution): Promise<string> {
    const root = this.getWorkspaceRoot();
    if (!this.agentTerminal || this.agentTerminal.exitStatus !== undefined) {
      this.agentTerminal = vscode.window.createTerminal('AI Agent');
    }
    this.agentTerminal.show(true);
    this.agentTerminal.sendText(commandLine);

    return new Promise((resolve) => {
      const child = exec(commandLine, { cwd: root, timeout: 120000 }, (error, stdout, stderr) => {
        if (activeInfo && activeInfo.isAborted) {
          resolve('Command was aborted by user.');
          return;
        }
        const output = [
          stdout ? `STDOUT:\n${stdout.trim()}` : '',
          stderr ? `STDERR:\n${stderr.trim()}` : '',
          error ? `EXIT CODE: ${error.code || 1}\nERROR: ${error.message}` : 'EXIT CODE: 0 (Success)',
        ].filter(Boolean).join('\n\n');
        resolve(output || 'Command executed.');
      });

      if (activeInfo) {
        activeInfo.childProcess = child;
      }
    });
  }
}

