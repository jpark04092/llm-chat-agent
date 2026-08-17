import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { exec } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';

interface ToolCallPayload {
  agent_action?: 'tool_call';
  id: string;
  command: string;
  args?: Record<string, any>;
}

interface ToolResultPayload {
  agent_response: 'tool_result';
  id: string;
  status: 'success' | 'error';
  result?: any;
  error?: string;
  timestamp?: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'inbound' | 'outbound' | 'system' | 'executor' | 'busy' | 'heartbeat';
  command?: string;
  data: any;
}

const PORT = 3000;
const workspaceRoot = process.cwd();
const logs: LogEntry[] = [];
const connectedClients = new Set<WebSocket>();

interface ActiveServerExecution {
  callId: string;
  command: string;
  startedAt: number;
  childProcess?: any;
  isAborted?: boolean;
}

const activeExecutions = new Map<string, ActiveServerExecution>();
let heartbeatTimer: NodeJS.Timeout | null = null;

function addLog(type: LogEntry['type'], data: any, command?: string) {
  const entry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    command,
    data,
  };
  logs.unshift(entry);
  if (logs.length > 200) logs.pop();
  return entry;
}

function broadcastToAll(messageObj: any) {
  const str = JSON.stringify(messageObj);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  }
}

function broadcastBusy(callId: string, command: string, startedAt: number, args?: Record<string, any>) {
  const payload = {
    type: 'agent:busy',
    state: 'busy',
    id: callId,
    command,
    argsSummary: args ? Object.keys(args).map(k => `${k}=${JSON.stringify(args[k])}`).join(', ').substring(0, 80) : '',
    startedAt,
    phase: 'Executing in workspace...',
  };
  broadcastToAll(payload);
  addLog('busy', payload, command);

  startHeartbeatBroadcasting(callId, command, startedAt);
}

function startHeartbeatBroadcasting(callId: string, command: string, startedAt: number) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    const elapsedMs = Date.now() - startedAt;
    const heartbeatPayload = {
      type: 'agent:heartbeat',
      state: 'busy',
      id: callId,
      command,
      elapsedMs,
      heartbeatTimestamp: Date.now(),
      phase: 'Working...',
    };
    broadcastToAll(heartbeatPayload);
  }, 1000);
}

function stopHeartbeatBroadcasting() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function broadcastIdle(callId?: string, totalElapsedMs?: number) {
  stopHeartbeatBroadcasting();
  const payload = {
    type: 'agent:idle',
    state: 'idle',
    id: callId,
    totalElapsedMs,
  };
  broadcastToAll(payload);
}

function abortExecution(callId?: string): boolean {
  if (callId) {
    const active = activeExecutions.get(callId);
    if (active) {
      active.isAborted = true;
      if (active.childProcess) {
        try { active.childProcess.kill('SIGTERM'); } catch (e) {}
      }
      activeExecutions.delete(callId);
      broadcastIdle(callId);
      addLog('system', { message: `Aborted execution for ${callId}` });
      return true;
    }
  } else {
    let anyAborted = false;
    for (const [id, active] of activeExecutions.entries()) {
      active.isAborted = true;
      if (active.childProcess) {
        try { active.childProcess.kill('SIGTERM'); } catch (e) {}
      }
      anyAborted = true;
    }
    activeExecutions.clear();
    broadcastIdle();
    addLog('system', { message: 'Aborted all active executions.' });
    return anyAborted;
  }
  return false;
}

// Workspace Path Resolver
function resolveWorkspaceUri(relativePath?: string): string {
  const cleanPath = (relativePath || '.').replace(/^[\\\/]+/, '');
  const absolutePath = path.resolve(workspaceRoot, cleanPath);
  if (!absolutePath.startsWith(workspaceRoot)) {
    throw new Error('Access denied: Path outside workspace.');
  }
  return absolutePath;
}

function normalizeCommand(rawCommand: string): string {
  const c = (rawCommand || '').trim().toLowerCase();
  if (['file:patch', 'file:edit', 'patch', 'edit', 'file_patch', 'file_edit', 'file:diff', 'diff', 'file:modify', 'modify', 'file:replace', 'replace'].includes(c)) {
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

// Command Executor matching vscode-extension executor.ts
async function executeTool(call: ToolCallPayload): Promise<ToolResultPayload> {
  const callId = call.id || `call_${Date.now()}`;
  const rawCommand = call.command || '';
  const command = normalizeCommand(rawCommand);
  const args = call.args || {};
  const startedAt = Date.now();

  const activeInfo: ActiveServerExecution = { callId, command: rawCommand, startedAt };
  activeExecutions.set(callId, activeInfo);
  broadcastBusy(callId, rawCommand, startedAt, args);
  addLog('executor', { callId, command: rawCommand, normalizedCommand: command, args }, rawCommand);

  try {
    let result: any = null;

    switch (command) {
      case 'file:read': {
        if (!args.path) throw new Error('Missing "path" argument');
        const targetPath = resolveWorkspaceUri(args.path);
        const data = await fs.readFile(targetPath, 'utf8');
        result = data;
        break;
      }

      case 'file:write': {
        if (!args.path) throw new Error('Missing "path" argument');
        const targetPath = resolveWorkspaceUri(args.path);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, args.content || '', 'utf8');
        const byteLength = Buffer.byteLength(args.content || '', 'utf8');
        result = `File successfully written to ${args.path} (${byteLength} bytes)`;
        break;
      }

      case 'file:patch':
      case 'file:edit': {
        if (!args.path) throw new Error('Missing "path" argument');
        const targetPath = resolveWorkspaceUri(args.path);

        if (!existsSync(targetPath)) {
          throw new Error(`File "${args.path}" not found. Please use file:write to create new files.`);
        }

        const originalContent = await fs.readFile(targetPath, 'utf8');
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

          const deletedCount = Math.max(0, lineEnd - lineStart + 1);
          lines.splice(lineStart - 1, deletedCount, ...repLines);
          const updatedContent = lines.join(eol);

          await fs.writeFile(targetPath, updatedContent, 'utf8');
          const byteLength = Buffer.byteLength(updatedContent, 'utf8');
          result = `Successfully patched lines ${lineStart}-${lineEnd} in "${args.path}". Replaced ${deletedCount} line(s) with ${repLines.length} line(s) (total ${lines.length} lines, ${byteLength} bytes written).`;
          break;
        }

        // MODE 2: Unified Diff / Hunk format (patch or diff)
        const patchStr = args.patch ?? args.diff ?? args.hunk;
        if (patchStr !== undefined && patchStr !== null && String(patchStr).trim() !== '') {
          const patchText = String(patchStr);
          const hunkHeaderRegex = /@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/g;

          if (hunkHeaderRegex.test(patchText)) {
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

              for (const hLine of hunkBodyLines) {
                if (hLine.startsWith('+')) {
                  toAdd.push(hLine.substring(1));
                } else if (hLine.startsWith('-')) {
                  toRemove.push(hLine.substring(1));
                }
              }

              let targetLineIndex = Math.max(0, oldStart - 1);
              let matchFound = false;

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

              workingLines.splice(targetLineIndex, toRemove.length, ...toAdd);
              totalHunksApplied++;
            }

            const updatedContent = workingLines.join(eol);
            await fs.writeFile(targetPath, updatedContent, 'utf8');
            const byteLength = Buffer.byteLength(updatedContent, 'utf8');
            result = `Successfully applied ${totalHunksApplied} Unified Diff hunk(s) to "${args.path}" (total ${workingLines.length} lines, ${byteLength} bytes written).`;
            break;
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
            await fs.writeFile(targetPath, updatedContent, 'utf8');
            const byteLength = Buffer.byteLength(updatedContent, 'utf8');
            result = `Successfully patched "${args.path}" via ${matchType} (${byteLength} bytes written).`;
            break;
          }

          throw new Error(
            `Target content could not be located in "${args.path}". Please run file:read to verify line numbers or use line_start/line_end for exact replacement.`
          );
        }

        throw new Error(
          `Invalid arguments for file:patch on "${args.path}". Please provide { "line_start": number, "line_end": number, "replacement": "..." } or { "patch": "@@ ... @@" }.`
        );
      }

      case 'file:list': {
        const targetPath = resolveWorkspaceUri(args.path || '.');
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        result = entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 2 : 1, // 2: Directory, 1: File
          isDirectory: entry.isDirectory(),
        }));
        break;
      }

      case 'npm:run': {
        if (!args.script) throw new Error('Missing "script" argument');
        result = await executeShellCommand(`npm run ${args.script}`, activeInfo);
        break;
      }

      case 'terminal:exec': {
        if (!args.cmd) throw new Error('Missing "cmd" argument');
        result = await executeShellCommand(args.cmd, activeInfo);
        break;
      }

      default:
        throw new Error(`Unknown tool command: "${command}"`);
    }

    if (activeInfo.isAborted) {
      const abortPayload: ToolResultPayload = {
        agent_response: 'tool_result',
        id: callId,
        status: 'error',
        error: 'Execution was aborted by user.',
        timestamp: Date.now(),
      };
      addLog('outbound', abortPayload, command);
      return abortPayload;
    }

    const payload: ToolResultPayload = {
      agent_response: 'tool_result',
      id: callId,
      status: 'success',
      result,
      timestamp: Date.now(),
    };
    addLog('outbound', payload, command);
    return payload;
  } catch (err: any) {
    const isAborted = activeInfo.isAborted;
    const payload: ToolResultPayload = {
      agent_response: 'tool_result',
      id: callId,
      status: isAborted ? 'error' : 'error',
      error: isAborted ? 'Execution aborted.' : err?.message || String(err),
      timestamp: Date.now(),
    };
    addLog('outbound', payload, command);
    return payload;
  } finally {
    activeExecutions.delete(callId);
    if (activeExecutions.size === 0) {
      broadcastIdle(callId, Date.now() - startedAt);
    }
  }
}

function executeShellCommand(cmd: string, activeInfo?: ActiveServerExecution): Promise<string> {
  return new Promise((resolve) => {
    // Timeout at 60 seconds for safety
    const child = exec(cmd, { cwd: workspaceRoot, timeout: 60000 }, (error, stdout, stderr) => {
      if (activeInfo && activeInfo.isAborted) {
        resolve('Command was aborted by user.');
        return;
      }
      const outputParts = [
        stdout ? `STDOUT:\n${stdout.trim()}` : '',
        stderr ? `STDERR:\n${stderr.trim()}` : '',
        error ? `EXIT CODE: ${error.code || 1}\nERROR: ${error.message}` : 'EXIT CODE: 0 (Success)',
      ].filter(Boolean);
      resolve(outputParts.join('\n\n') || 'Command executed with no output.');
    });

    if (activeInfo) {
      activeInfo.childProcess = child;
    }
  });
}

// Helper to recursively collect files for zip
async function addDirToZip(zip: JSZip, localDir: string, zipDirName: string) {
  if (!existsSync(localDir)) return;
  const entries = await fs.readdir(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    const zipPath = path.posix.join(zipDirName, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'out') {
        await addDirToZip(zip, fullPath, zipPath);
      }
    } else {
      const content = await fs.readFile(fullPath);
      zip.file(zipPath, content);
    }
  }
}

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '10mb' }));

  // WebSocket Server setup on /ws and root upgrade
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    connectedClients.add(ws);
    const clientIp = req.socket.remoteAddress || 'client';
    addLog('system', { message: `WebSocket client connected from ${clientIp}`, totalClients: connectedClients.size });

    // Send Welcome packet (same format as VS Code bridge)
    ws.send(JSON.stringify({
      type: 'system:init',
      server: 'universal-web-ai-agent-bridge',
      version: '2.1.0',
      workspace: path.basename(workspaceRoot),
      message: 'Connected to Universal Web AI & VS Code Bridge Server.',
      isBusy: activeExecutions.size > 0,
      activeExecutions: Array.from(activeExecutions.values()).map(e => ({ id: e.callId, command: e.command, startedAt: e.startedAt })),
    }));

    ws.on('message', async (dataRaw) => {
      try {
        const dataStr = dataRaw.toString();
        const message = JSON.parse(dataStr);
        addLog('inbound', message, message.command || message.type);

        // Handle Client Registration
        if (message.type === 'register') {
          ws.send(JSON.stringify({
            type: 'system:registered',
            status: 'success',
            serverTime: new Date().toISOString(),
            isBusy: activeExecutions.size > 0,
          }));
          return;
        }

        // Handle Ping
        if (message.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            isBusy: activeExecutions.size > 0,
          }));
          return;
        }

        // Handle Abort Request
        if (message.type === 'agent:abort' || message.command === 'agent:abort' || message.action === 'abort') {
          const aborted = abortExecution(message.id);
          ws.send(JSON.stringify({
            type: 'agent:aborted',
            id: message.id || 'all',
            success: aborted,
            timestamp: Date.now(),
          }));
          return;
        }

        // Handle Tool Call
        if (message.agent_action === 'tool_call' || message.command) {
          const result = await executeTool(message);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(result));
          }
          // Broadcast result to other connected clients (e.g. web UI dashboard)
          for (const client of connectedClients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'broadcast_event', event: 'tool_execution', result }));
            }
          }
        }
      } catch (err: any) {
        addLog('system', { error: `Failed to process message: ${err.message}` });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            agent_response: 'tool_result',
            id: 'err',
            status: 'error',
            error: `Server processing error: ${err.message}`,
            timestamp: Date.now(),
          }));
        }
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      addLog('system', { message: 'WebSocket client disconnected', totalClients: connectedClients.size });
    });

    ws.on('error', (err) => {
      addLog('system', { error: `WebSocket error: ${err.message}` });
    });
  });

  // REST API Routes
  app.get('/api/status', (req, res) => {
    const activeList = Array.from(activeExecutions.values());
    res.json({
      status: 'running',
      port: PORT,
      workspace: path.basename(workspaceRoot),
      workspacePath: workspaceRoot,
      connectedClients: connectedClients.size,
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      nodeVersion: process.version,
      isBusy: activeList.length > 0,
      currentTool: activeList.length > 0 ? activeList[0].command : undefined,
    });
  });

  // Abort execution route
  app.post('/api/tools/abort', (req, res) => {
    const { id } = req.body || {};
    const success = abortExecution(id);
    res.json({ success, message: success ? 'Task aborted successfully' : 'No active task found to abort' });
  });

  // Get Bridge Server Logs
  app.get('/api/logs', (req, res) => {
    res.json({ logs });
  });

  app.delete('/api/logs', (req, res) => {
    logs.length = 0;
    res.json({ success: true, message: 'Logs cleared.' });
  });

  // Execute a Tool directly via HTTP POST
  app.post('/api/tools/execute', async (req, res) => {
    try {
      const payload: ToolCallPayload = req.body;
      const result = await executeTool(payload);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // Workspace File Listing
  app.get('/api/workspace/files', async (req, res) => {
    try {
      const reqPath = (req.query.path as string) || '.';
      const targetPath = resolveWorkspaceUri(reqPath);
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      const files = entries
        .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'out')
        .map((entry) => ({
          name: entry.name,
          path: path.posix.join(reqPath === '.' ? '' : reqPath, entry.name),
          isDirectory: entry.isDirectory(),
        }));

      res.json({ files, currentPath: reqPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Workspace File Content Read
  app.get('/api/workspace/file', async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ error: 'Missing path' });
      const targetPath = resolveWorkspaceUri(filePath);
      const content = await fs.readFile(targetPath, 'utf8');
      res.json({ path: filePath, content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Workspace File Content Save
  app.post('/api/workspace/file', async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath) return res.status(400).json({ error: 'Missing path' });
      const targetPath = resolveWorkspaceUri(filePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content || '', 'utf8');
      res.json({ success: true, path: filePath, message: 'File saved successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download compiled VSIX package directly
  app.get('/api/extension/download-vsix', async (req, res) => {
    try {
      const releaseDir = path.join(workspaceRoot, 'release');
      const latestVsix = path.join(releaseDir, 'universal-web-ai-agent-latest.vsix');
      if (existsSync(latestVsix)) {
        return res.download(latestVsix, 'universal-web-ai-agent-latest.vsix');
      }
      // Check for any vsix in release or vscode-extension
      if (existsSync(releaseDir)) {
        const files = await fs.readdir(releaseDir);
        const vsix = files.find(f => f.endsWith('.vsix'));
        if (vsix) {
          return res.download(path.join(releaseDir, vsix), vsix);
        }
      }
      res.status(404).json({ error: 'No compiled VSIX package found in release/ folder. Run npm run build in vscode-extension.' });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to download VSIX: ${err.message}` });
    }
  });

  // Generate ZIP of Chrome Extension
  app.get('/api/extension/download-chrome-zip', async (req, res) => {
    try {
      const zip = new JSZip();
      const chromeDir = path.join(workspaceRoot, 'chrome-extension');
      await addDirToZip(zip, chromeDir, '');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="universal-chrome-extension.zip"');
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({ error: `Failed to generate extension zip: ${err.message}` });
    }
  });

  // Generate Complete Agent Suite ZIP (both Chrome & VS Code extensions)
  app.get('/api/extension/download-suite-zip', async (req, res) => {
    try {
      const zip = new JSZip();
      await addDirToZip(zip, path.join(workspaceRoot, 'chrome-extension'), 'chrome-extension');
      await addDirToZip(zip, path.join(workspaceRoot, 'vscode-extension'), 'vscode-extension');
      if (existsSync(path.join(workspaceRoot, 'README.md'))) {
        const readmeContent = await fs.readFile(path.join(workspaceRoot, 'README.md'));
        zip.file('README.md', readmeContent);
      }
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="universal-vscode-agent-suite.zip"');
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({ error: `Failed to generate suite zip: ${err.message}` });
    }
  });

  // Simulated or Real Gemini AI Prompt Dispatcher
  app.post('/api/agent/chat', async (req, res) => {
    const { prompt, conversationHistory = [] } = req.body;
    const ai = getGemini();

    const SYSTEM_PROMPT = `You are a Developer Agent directly connected to the user's VS Code workspace via a WebSocket Bridge.
When code editing, file reading, file listing, or terminal commands are needed, you MUST output your tool call inside a JSON code block in the following format:

\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_${Date.now()}",
  "command": "<one of: file:read | file:edit | file:write | file:list | npm:run | terminal:exec>",
  "args": { ... }
}
\`\`\`

Available Tools:
- file:read: {"path": "relative/path"} -> Inspect existing file content.
- file:edit: {"path": "relative/path", "target": "exact string to replace", "replacement": "new replacement text", "replaceAll"?: false} -> HIGH PRIORITY FOR MODIFICATIONS: When modifying existing files, always read first with file:read, and then make targeted replacements with file:edit instead of rewriting whole files with file:write to eliminate latency.
- file:write: {"path": "relative/path", "content": "..."} -> Use primarily for creating new files or full file replacements.
- file:list: {"path": "relative/dir" or "."}
- npm:run: {"script": "build" | "test" | "dev"}
- terminal:exec: {"cmd": "shell command"}

Keep your explanations concise, professional, and directly state what you are going to execute.`;

    if (ai) {
      try {
        const contents = [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          { role: 'model', parts: [{ text: 'Agent mode initialized with high-speed file:edit and VS Code bridge.' }] },
          ...conversationHistory.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          })),
          { role: 'user', parts: [{ text: prompt }] },
        ];

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
        });

        return res.json({
          reply: response.text || 'No response from model.',
          mode: 'gemini-live',
        });
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to smart simulation:', err.message);
      }
    }

    // Smart heuristic simulation when GEMINI_API_KEY is not configured
    const lower = (prompt || '').toLowerCase();
    let simulatedResponse = '';
    const id = `call_${Date.now()}`;

    if (lower.includes('수정') || lower.includes('edit') || lower.includes('변경') || lower.includes('바꿔') || lower.includes('replace') || lower.includes('패치')) {
      simulatedResponse = `I will use \`file:patch\` to apply targeted line-based modifications to the file without rewriting the entire content, minimizing latency.

\`\`\`json
{
  "agent_action": "tool_call",
  "id": "${id}",
  "command": "file:patch",
  "args": {
    "path": "src/App.tsx",
    "line_start": 29,
    "line_end": 29,
    "replacement": "  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>('full-auto');"
  }
}
\`\`\``;
    } else if (lower.includes('package.json') || lower.includes('읽어') || lower.includes('read')) {
      simulatedResponse = `I will read \`package.json\` to inspect the workspace dependencies and configuration.

\`\`\`json
{
  "agent_action": "tool_call",
  "id": "${id}",
  "command": "file:read",
  "args": {
    "path": "package.json"
  }
}
\`\`\``;
    } else if (lower.includes('list') || lower.includes('목록') || lower.includes('파일 확인') || lower.includes('ls')) {
      simulatedResponse = `I will list all files in the current workspace root directory.

\`\`\`json
{
  "agent_action": "tool_call",
  "id": "${id}",
  "command": "file:list",
  "args": {
    "path": "."
  }
}
\`\`\``;
    } else if (lower.includes('test') || lower.includes('테스트') || lower.includes('npm test')) {
      simulatedResponse = `I will run the project test suite using npm.

\`\`\`json
{
  "agent_action": "tool_call",
  "id": "${id}",
  "command": "terminal:exec",
  "args": {
    "cmd": "npm test"
  }
}
\`\`\``;
    } else if (lower.includes('만들') || lower.includes('write') || lower.includes('create') || lower.includes('생성')) {
      simulatedResponse = `I will create a new file in your workspace with the requested code.

\`\`\`json
{
  "agent_action": "tool_call",
  "id": "${id}",
  "command": "file:write",
  "args": {
    "path": "src/example.ts",
    "content": "// Generated by Universal Web AI Agent\\nexport function helloWorld(): string {\\n  return 'Hello from Universal Web AI Agent!';\\n}\\n\\nconsole.log(helloWorld());"
  }
}
\`\`\``;
    } else {
      simulatedResponse = `I am your Universal Web AI Autonomous Agent. I am ready to inspect files, write code, or execute terminal commands in your workspace across ChatGPT, Claude, Gemini, DeepSeek, and custom models.

Try asking:
- "Read package.json"
- "List files in workspace"
- "Create src/example.ts and test it"
- "Run npm test"`;
    }

    res.json({
      reply: simulatedResponse,
      mode: 'agent-simulator',
      note: 'Using intelligent agent response engine. Add GEMINI_API_KEY to .env for live Gemini 2.5 Flash API calls.',
    });
  });

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(workspaceRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Universal Web AI – VS Code Agent Server running on http://0.0.0.0:${PORT}`);
    console.log(`⚡ WebSocket Bridge listening on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer();
