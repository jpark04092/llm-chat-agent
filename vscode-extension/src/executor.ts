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

function normalizeCommand(rawCommand: string): string {
  const c = (rawCommand || '').trim().toLowerCase();
  if (['file:patch', 'patch', 'file_patch', 'file:diff', 'diff', 'file:modify', 'modify', 'file:replace', 'replace'].includes(c)) {
    return 'file:patch';
  }
  if (['file:read', 'read', 'file_read', 'read_file', 'file:cat', 'cat', 'file:get'].includes(c)) {
    return 'file:read';
  }
  if (['file:write', 'write', 'file_write', 'write_file', 'file:create', 'create_file', 'file:put'].includes(c)) {
    return 'file:write';
  }
  if (['file:list', 'list', 'file_list', 'list_files', 'dir', 'ls', 'file:dir'].includes(c)) {
    return 'file:list';
  }
  if (['terminal:exec', 'terminal:run', 'terminal', 'exec', 'terminal_exec', 'shell', 'bash', 'cmd', 'command'].includes(c)) {
    return 'terminal:exec';
  }
  if (['npm:run', 'npm_run', 'npm', 'run'].includes(c)) {
    return 'npm:run';
  }
  return c;
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
    const rawCommand = call.command || '';
    const command = normalizeCommand(rawCommand);
    const args = call.args || {};
    const startedAt = Date.now();

    const activeInfo: ActiveExecution = { callId, command: rawCommand, startedAt };
    this.activeExecutions.set(callId, activeInfo);

    this.outputChannel.appendLine(`[EXECUTOR] Executing: ${rawCommand} -> [${command}] (${callId})`);
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
        case 'file:patch':
          this.reportProgress(callId, `Applying diff/patch to: ${args.path || '.'}`);
          result = await this.handleFilePatch(args.path, args);
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
          throw new Error(`Unknown command: "${rawCommand}"`);
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

  private async handleFilePatch(
    relativePath?: string,
    args: Record<string, any> = {}
  ): Promise<string> {
    if (!relativePath) throw new Error('Missing "path" argument');

    const uri = this.resolveUri(relativePath);
    let originalContent: string;
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      originalContent = Buffer.from(data).toString('utf8');
    } catch (e: any) {
      throw new Error(`File "${relativePath}" not found. Please use file:write to create new files.`);
    }

    const isCRLF = originalContent.includes('\r\n');
    const eol = isCRLF ? '\r\n' : '\n';
    const lines = originalContent.split(/\r?\n/);

    // MODE 1: Line-number based replacement (line_start / line_end)
    const rawStart = args.line_start ?? args.lineStart ?? args.start_line ?? args.startLine ?? args.line;
    if (rawStart !== undefined && rawStart !== null && rawStart !== '') {
      const lineStart = Math.max(1, parseInt(String(rawStart), 10));
      const rawEnd = args.line_end ?? args.lineEnd ?? args.end_line ?? args.endLine ?? lineStart;
      const lineEnd = Math.min(lines.length, Math.max(lineStart, parseInt(String(rawEnd), 10)));

      const replacementText = args.replacement ?? args.replace ?? args.newText ?? args.content ?? args.replacementContent ?? '';
      const repLines = String(replacementText).split(/\r?\n/);

      // Optional expected content validation
      const expected = args.expected_content ?? args.expected ?? args.target;
      if (expected !== undefined && expected !== null && expected !== '') {
        const expectedLines = String(expected).split(/\r?\n/);
        const actualSlice = lines.slice(lineStart - 1, lineEnd);
        const actualTextTrimmed = actualSlice.map(l => l.trim()).join('\n');
        const expectedTextTrimmed = expectedLines.map(l => l.trim()).join('\n');
        if (actualTextTrimmed !== expectedTextTrimmed && !actualSlice.join('\n').includes(String(expected).trim())) {
          // If mismatch, warn but if strict is not requested, we proceed or give clear error
          if (args.strict) {
            throw new Error(`Expected content mismatch at lines ${lineStart}-${lineEnd} in "${relativePath}".`);
          }
        }
      }

      const deletedCount = Math.max(0, lineEnd - lineStart + 1);
      lines.splice(lineStart - 1, deletedCount, ...repLines);
      const updatedContent = lines.join(eol);

      const uint8Array = Buffer.from(updatedContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, uint8Array);
      return `Successfully patched lines ${lineStart}-${lineEnd} in "${relativePath}". Replaced ${deletedCount} line(s) with ${repLines.length} line(s) (total ${lines.length} lines, ${uint8Array.length} bytes written).`;
    }

    // MODE 2: Unified Diff / Hunk format (patch or diff)
    const patchStr = args.patch ?? args.diff ?? args.hunk;
    if (patchStr !== undefined && patchStr !== null && String(patchStr).trim() !== '') {
      const patchText = String(patchStr);
      const hunkHeaderRegex = /@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/g;

      if (hunkHeaderRegex.test(patchText)) {
        // Parse and apply standard unified diff hunks
        hunkHeaderRegex.lastIndex = 0;
        const hunkMatches: { header: RegExpExecArray; body: string }[] = [];
        let m: RegExpExecArray | null;
        let lastIdx = 0;
        let prevMatch: RegExpExecArray | null = null;

        while ((m = hunkHeaderRegex.exec(patchText)) !== null) {
          if (prevMatch) {
            hunkMatches.push({
              header: prevMatch,
              body: patchText.substring(lastIdx, m.index),
            });
          }
          prevMatch = m;
          lastIdx = hunkHeaderRegex.lastIndex;
        }
        if (prevMatch) {
          hunkMatches.push({
            header: prevMatch,
            body: patchText.substring(lastIdx),
          });
        }

        let workingLines = [...lines];
        let totalHunksApplied = 0;

        for (const hunk of hunkMatches) {
          const oldStart = parseInt(hunk.header[1], 10);
          const hunkBodyLines = hunk.body.split(/\r?\n/).filter(l => l.length > 0 || l === '');

          const toRemove: string[] = [];
          const toAdd: string[] = [];
          const contextBefore: string[] = [];

          for (const hLine of hunkBodyLines) {
            if (hLine.startsWith('+')) {
              toAdd.push(hLine.substring(1));
            } else if (hLine.startsWith('-')) {
              toRemove.push(hLine.substring(1));
            } else if (hLine.startsWith(' ') || hLine.startsWith('\t')) {
              if (toRemove.length === 0 && toAdd.length === 0) {
                contextBefore.push(hLine.substring(1));
              }
            } else if (!hLine.startsWith('\\')) {
              if (toRemove.length === 0 && toAdd.length === 0) {
                contextBefore.push(hLine);
              }
            }
          }

          // Locate best target position starting around oldStart
          let targetLineIndex = Math.max(0, oldStart - 1);
          let matchFound = false;

          // Search in sliding window
          const searchRange = 40;
          const minIndex = Math.max(0, targetLineIndex - searchRange);
          const maxIndex = Math.min(workingLines.length - 1, targetLineIndex + searchRange);

          for (let offset = 0; offset <= searchRange; offset++) {
            const tryIndices = [targetLineIndex + offset, targetLineIndex - offset].filter(
              (idx) => idx >= minIndex && idx <= maxIndex
            );
            for (const idx of tryIndices) {
              if (toRemove.length === 0) {
                targetLineIndex = idx;
                matchFound = true;
                break;
              }
              const slice = workingLines.slice(idx, idx + toRemove.length);
              const sliceTrimmed = slice.map(l => l.trim()).join('\n');
              const removeTrimmed = toRemove.map(l => l.trim()).join('\n');
              if (sliceTrimmed === removeTrimmed || slice.join('\n') === toRemove.join('\n')) {
                targetLineIndex = idx;
                matchFound = true;
                break;
              }
            }
            if (matchFound) break;
          }

          const deleteCount = toRemove.length;
          workingLines.splice(targetLineIndex, deleteCount, ...toAdd);
          totalHunksApplied++;
        }

        const updatedContent = workingLines.join(eol);
        const uint8Array = Buffer.from(updatedContent, 'utf8');
        await vscode.workspace.fs.writeFile(uri, uint8Array);
        return `Successfully applied ${totalHunksApplied} Unified Diff hunk(s) to "${relativePath}" (total ${workingLines.length} lines, ${uint8Array.length} bytes written).`;
      }
    }

    // MODE 3: Fallback Targeted Replacement with whitespace/line-ending normalization
    const targetStr = args.target ?? args.search ?? args.oldText ?? args.targetContent;
    if (targetStr !== undefined && targetStr !== null && targetStr !== '') {
      const replaceStr = (args.replacement ?? args.replace ?? args.newText ?? args.replacementContent) !== undefined
        ? String(args.replacement ?? args.replace ?? args.newText ?? args.replacementContent)
        : '';

      const searchTarget = String(targetStr);
      let updatedContent: string | null = null;
      let matchType = '';

      // 1. Exact match
      if (originalContent.includes(searchTarget)) {
        matchType = 'exact match';
        if (args.replaceAll) {
          updatedContent = originalContent.split(searchTarget).join(replaceStr);
        } else {
          updatedContent = originalContent.replace(searchTarget, replaceStr);
        }
      }

      // 2. Line-ending normalized match (\r\n <-> \n)
      if (!updatedContent) {
        const normOriginal = originalContent.replace(/\r\n/g, '\n');
        const normTarget = searchTarget.replace(/\r\n/g, '\n');
        const normReplace = replaceStr.replace(/\r\n/g, '\n');

        if (normOriginal.includes(normTarget)) {
          matchType = 'newline-normalized match';
          const replacedNorm = normOriginal.replace(normTarget, normReplace);
          updatedContent = isCRLF ? replacedNorm.replace(/\n/g, '\r\n') : replacedNorm;
        }
      }

      // 3. Trimmed-line fuzzy block match (immune to indentation/trailing space differences)
      if (!updatedContent) {
        const targetLines = searchTarget.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (targetLines.length > 0) {
          const fileLinesTrimmed = lines.map(l => l.trim());
          let foundStartIdx = -1;
          for (let i = 0; i <= fileLinesTrimmed.length - targetLines.length; i++) {
            let matched = true;
            for (let j = 0; j < targetLines.length; j++) {
              if (fileLinesTrimmed[i + j] !== targetLines[j]) {
                matched = false;
                break;
              }
            }
            if (matched) {
              foundStartIdx = i;
              break;
            }
          }

          if (foundStartIdx !== -1) {
            matchType = 'whitespace-tolerant fuzzy match';
            const repLines = replaceStr.split(/\r?\n/);
            const workingLines = [...lines];
            workingLines.splice(foundStartIdx, targetLines.length, ...repLines);
            updatedContent = workingLines.join(eol);
          }
        }
      }

      if (updatedContent !== null) {
        const uint8Array = Buffer.from(updatedContent, 'utf8');
        await vscode.workspace.fs.writeFile(uri, uint8Array);
        return `Successfully patched "${relativePath}" via ${matchType} (${uint8Array.length} bytes written).`;
      }

      throw new Error(
        `Target content could not be located in "${relativePath}". Please run file:read to verify line numbers or use line_start/line_end for exact replacement.`
      );
    }

    throw new Error(
      `Invalid arguments for file:patch on "${relativePath}". Please provide { "line_start": number, "line_end": number, "replacement": "..." } or { "patch": "@@ ... @@" }.`
    );
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

