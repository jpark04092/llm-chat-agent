/**
 * Embedded WebSocket Bridge Server inside VS Code Extension
 * Runs on ws://localhost:9999 (Configurable)
 * Directly accepts connections from Chrome Extension and handles Tool Calls
 * Broadcasts real-time Busy state & Heartbeat to detect deadlocks/freezes
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as vscode from 'vscode';
import { CommandExecutor } from './executor';
import { ToolCallPayload, ToolResultPayload, AgentBusyPayload, AgentHeartbeatPayload, AgentIdlePayload } from './types';

export class EmbeddedBridgeServer {
  private wss: WebSocketServer | null = null;
  private port: number;
  private executor: CommandExecutor;
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;
  private connectedChromeClients: Set<WebSocket> = new Set();
  private isRunning: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentActiveCall: { id: string; command: string; startedAt: number; phase?: string } | null = null;

  constructor(
    port: number,
    executor: CommandExecutor,
    outputChannel: vscode.OutputChannel,
    statusBarItem: vscode.StatusBarItem
  ) {
    this.port = port;
    this.executor = executor;
    this.outputChannel = outputChannel;
    this.statusBarItem = statusBarItem;

    this.executor.setProgressCallback((callId, phase) => {
      if (this.currentActiveCall && this.currentActiveCall.id === callId) {
        this.currentActiveCall.phase = phase;
        this.broadcastHeartbeat();
      }
    });
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public start(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isRunning && this.wss) {
        this.outputChannel.appendLine(`[BRIDGE SERVER] Server is already running on port ${this.port}`);
        resolve(true);
        return;
      }

      this.outputChannel.appendLine(`[BRIDGE SERVER] Starting embedded WebSocket server on port ${this.port}...`);
      this.updateStatus('starting', '$(sync~spin) AI Agent Server: Starting...');

      try {
        this.wss = new WebSocketServer({ port: this.port, host: '0.0.0.0' }, () => {
          this.isRunning = true;
          this.updateStatus('running', `$(radio-tower) AI Agent Bridge: :${this.port} (0 Clients)`);
          this.outputChannel.appendLine(`[BRIDGE SERVER] 🚀 Server successfully running at ws://localhost:${this.port}`);
          vscode.window.showInformationMessage(`Universal Web AI Agent: Embedded Bridge Server running on port ${this.port}`);
          resolve(true);
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
          const clientIp = req.socket.remoteAddress || 'unknown';
          this.connectedChromeClients.add(ws);
          this.outputChannel.appendLine(`[BRIDGE SERVER] Client connected from ${clientIp}. Total: ${this.connectedChromeClients.size}`);
          this.refreshStatusBar();

          // Send welcome packet + current busy state if any
          ws.send(JSON.stringify({
            type: 'system:init',
            server: 'vscode-embedded-bridge',
            version: '1.2.0',
            workspace: vscode.workspace.name || 'Default Workspace',
            message: 'Connected to VS Code Embedded Bridge Server.',
            isBusy: this.currentActiveCall !== null,
            activeCall: this.currentActiveCall,
          }));

          ws.on('message', async (dataRaw) => {
            try {
              const dataStr = dataRaw.toString();
              const message = JSON.parse(dataStr);
              this.outputChannel.appendLine(`[INBOUND] Received from Chrome: ${dataStr}`);

              // Handle Client Registration
              if (message.type === 'register') {
                ws.send(JSON.stringify({
                  type: 'system:registered',
                  status: 'success',
                  serverTime: new Date().toISOString(),
                  isBusy: this.currentActiveCall !== null,
                }));
                return;
              }

              // Handle Heartbeat / Ping
              if (message.type === 'ping') {
                ws.send(JSON.stringify({
                  type: 'pong',
                  timestamp: Date.now(),
                  isBusy: this.currentActiveCall !== null,
                }));
                return;
              }

              // Handle Abort Request from Extension HUD
              if (message.type === 'agent:abort' || message.command === 'agent:abort' || message.action === 'abort') {
                this.outputChannel.appendLine(`[ABORT] Client requested cancellation of task: ${message.id || 'all'}`);
                const aborted = this.executor.abort(message.id);
                this.stopHeartbeatTimer();
                this.currentActiveCall = null;
                this.broadcastIdle();
                this.refreshStatusBar();
                ws.send(JSON.stringify({
                  type: 'agent:aborted',
                  id: message.id || 'all',
                  success: aborted,
                  timestamp: Date.now(),
                }));
                return;
              }

              // Handle Tool Call from Gemini Web (via Chrome Extension)
              if (message.agent_action === 'tool_call' || message.command) {
                const toolCall: ToolCallPayload = message;
                const callId = toolCall.id || `call_${Date.now()}`;
                const startedAt = Date.now();

                this.outputChannel.appendLine(`[EXECUTOR] Dispatching tool call: ${toolCall.command} (id: ${callId})`);

                // 1. Mark as Busy & Broadcast to Chrome Extension HUD
                this.currentActiveCall = {
                  id: callId,
                  command: toolCall.command,
                  startedAt,
                  phase: 'Initiating...',
                };

                this.broadcastBusy(toolCall, startedAt);
                this.startHeartbeatTimer();

                // 2. Directly execute inside VS Code workspace
                let result: ToolResultPayload;
                try {
                  result = await this.executor.execute(toolCall);
                } finally {
                  // Stop heartbeats & clear busy state
                  this.stopHeartbeatTimer();
                  this.currentActiveCall = null;
                  this.broadcastIdle(callId, Date.now() - startedAt);
                  this.refreshStatusBar();
                }
                // 3. Send Result back to Chrome Extension
                if (ws.readyState === WebSocket.OPEN) {
                  const resultStr = JSON.stringify(result);
                  ws.send(resultStr);
                  this.outputChannel.appendLine(`[OUTBOUND] Returned result to Chrome: ${resultStr}`);
                }
              }
            } catch (err: any) {
              this.stopHeartbeatTimer();
              this.currentActiveCall = null;
              this.broadcastIdle();
              this.refreshStatusBar();

              this.outputChannel.appendLine(`[ERROR] Failed to process incoming message: ${err.message}`);
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
            this.connectedChromeClients.delete(ws);
            this.outputChannel.appendLine(`[BRIDGE SERVER] Client disconnected. Active: ${this.connectedChromeClients.size}`);
            this.refreshStatusBar();
          });

          ws.on('error', (err) => {
            this.outputChannel.appendLine(`[BRIDGE SERVER] WebSocket client error: ${err.message}`);
          });
        });

        this.wss.on('error', (err: any) => {
          this.isRunning = false;
          this.outputChannel.appendLine(`[BRIDGE SERVER ERROR] ${err.message}`);
          if (err.code === 'EADDRINUSE') {
            vscode.window.showErrorMessage(`AI Agent Bridge Server: Port ${this.port} is already in use by another process.`);
          } else {
            vscode.window.showErrorMessage(`AI Agent Bridge Server Error: ${err.message}`);
          }
          this.updateStatus('stopped', '$(error) AI Agent Bridge: Port Error');
          resolve(false);
        });

      } catch (err: any) {
        this.isRunning = false;
        this.outputChannel.appendLine(`[BRIDGE SERVER INIT ERROR] ${err.message}`);
        this.updateStatus('stopped', '$(error) AI Agent Bridge: Stopped');
        resolve(false);
      }
    });
  }

  private broadcastBusy(call: ToolCallPayload, startedAt: number) {
    const payload: AgentBusyPayload = {
      type: 'agent:busy',
      state: 'busy',
      id: call.id,
      command: call.command,
      argsSummary: call.args ? Object.keys(call.args).map(k => `${k}=${JSON.stringify(call.args![k])}`).join(', ').substring(0, 80) : '',
      startedAt,
      phase: 'Executing in VS Code...',
    };

    const str = JSON.stringify(payload);
    for (const client of this.connectedChromeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }
  }

  private startHeartbeatTimer() {
    this.stopHeartbeatTimer();
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 1000);
  }

  private stopHeartbeatTimer() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private broadcastHeartbeat() {
    if (!this.currentActiveCall) return;
    const elapsedMs = Date.now() - this.currentActiveCall.startedAt;
    const elapsedSec = Math.floor(elapsedMs / 1000);

    const payload: AgentHeartbeatPayload = {
      type: 'agent:heartbeat',
      state: 'busy',
      id: this.currentActiveCall.id,
      command: this.currentActiveCall.command,
      elapsedMs,
      heartbeatTimestamp: Date.now(),
      phase: this.currentActiveCall.phase || 'Executing in VS Code...',
    };

    const str = JSON.stringify(payload);
    for (const client of this.connectedChromeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }

    // Update VS Code status bar with live second counter & deadlock alert if long
    const isStalledWarning = elapsedSec >= 35;
    const isLongRunning = elapsedSec >= 15 && elapsedSec < 35;
    const icon = isStalledWarning ? '$(alert)' : '$(sync~spin)';
    const colorBadge = isStalledWarning ? '⚠️ Deadlock Check' : isLongRunning ? '⏳ Working...' : 'Busy';

    this.statusBarItem.text = `${icon} AI Agent: [${this.currentActiveCall.command}] ${elapsedSec}s (${colorBadge})`;
    this.statusBarItem.tooltip = isStalledWarning
      ? `Task has been running for ${elapsedSec}s. Check if terminal/process is waiting for input or deadlocked.`
      : `Executing ${this.currentActiveCall.command} (${elapsedSec}s elapsed). Phase: ${this.currentActiveCall.phase || 'Working'}`;
  }

  private broadcastIdle(id?: string, totalElapsedMs?: number) {
    const payload: AgentIdlePayload = {
      type: 'agent:idle',
      state: 'idle',
      id,
      totalElapsedMs,
    };

    const str = JSON.stringify(payload);
    for (const client of this.connectedChromeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.stopHeartbeatTimer();
      if (!this.wss) {
        this.isRunning = false;
        this.updateStatus('stopped', '$(circle-slash) AI Agent Bridge: Stopped');
        resolve();
        return;
      }

      this.outputChannel.appendLine('[BRIDGE SERVER] Stopping WebSocket server...');
      for (const client of this.connectedChromeClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      }
      this.connectedChromeClients.clear();

      this.wss.close(() => {
        this.isRunning = false;
        this.wss = null;
        this.outputChannel.appendLine('[BRIDGE SERVER] WebSocket server stopped.');
        this.updateStatus('stopped', '$(circle-slash) AI Agent Bridge: Stopped');
        vscode.window.showInformationMessage('AI Agent: Bridge Server stopped.');
        resolve();
      });
    });
  }

  public restart(): Promise<boolean> {
    return this.stop().then(() => this.start());
  }

  public getConnectedClientCount(): number {
    return this.connectedChromeClients.size;
  }

  private refreshStatusBar() {
    if (this.isRunning) {
      if (this.currentActiveCall) {
        const elapsedSec = Math.floor((Date.now() - this.currentActiveCall.startedAt) / 1000);
        this.statusBarItem.text = `$(sync~spin) AI Agent: [${this.currentActiveCall.command}] ${elapsedSec}s (Busy)`;
      } else {
        const count = this.connectedChromeClients.size;
        const icon = count > 0 ? '$(radio-tower)' : '$(broadcast)';
        this.updateStatus('running', `${icon} AI Agent Bridge :${this.port} (${count} Clients)`);
      }
    }
  }

  private updateStatus(state: 'running' | 'starting' | 'stopped', text: string) {
    this.statusBarItem.text = text;
    if (state === 'running') {
      this.statusBarItem.tooltip = `AI Agent Server Running on port ${this.port}. Click to restart or view options.`;
      this.statusBarItem.backgroundColor = undefined;
    } else if (state === 'starting') {
      this.statusBarItem.tooltip = 'AI Agent Server: Starting...';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.tooltip = 'AI Agent Server is Stopped. Click to Start.';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    this.statusBarItem.show();
  }
}

