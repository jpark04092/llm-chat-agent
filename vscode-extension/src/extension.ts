import * as vscode from 'vscode';
import { CommandExecutor } from './executor';
import { EmbeddedBridgeServer } from './bridgeServer';

let bridgeServer: EmbeddedBridgeServer | null = null;
let outputChannel: vscode.OutputChannel | null = null;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Gemini Web Agent');
  outputChannel.appendLine('🤖 [Gemini Web Agent] Extension activated.');

  // Create Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'geminiAgent.toggleServer';
  context.subscriptions.push(statusBarItem);

  const executor = new CommandExecutor(outputChannel);

  const config = vscode.workspace.getConfiguration('geminiAgent');
  const serverPort = config.get<number>('serverPort') || 9999;
  const autoStartServer = config.get<boolean>('autoStartServer') === true;

  // Initialize Embedded WebSocket Server
  bridgeServer = new EmbeddedBridgeServer(serverPort, executor, outputChannel, statusBarItem);

  // Auto start only if explicitly enabled in user settings
  if (autoStartServer) {
    bridgeServer.start();
  } else {
    statusBarItem.text = '$(plug) Gemini Bridge: Disconnected';
    statusBarItem.tooltip = 'Click to connect or manage Gemini Bridge Server';
    statusBarItem.show();
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('geminiAgent.startServer', () => {
      bridgeServer?.start();
    }),
    vscode.commands.registerCommand('geminiAgent.stopServer', () => {
      bridgeServer?.stop();
    }),
    vscode.commands.registerCommand('geminiAgent.restartServer', () => {
      bridgeServer?.restart();
    }),
    vscode.commands.registerCommand('geminiAgent.toggleServer', async () => {
      const isRunning = bridgeServer?.isServerRunning() ?? false;
      const options = isRunning
        ? ['서버 중지 (Disconnect)', '서버 재시작 (Restart)', '로그 보기 (Show Logs)']
        : ['서버 연결 (Connect)', '로그 보기 (Show Logs)'];

      const pick = await vscode.window.showQuickPick(options, { placeHolder: 'Gemini Bridge Server 관리' });
      if (!pick) return;

      if (pick.includes('Connect') || pick.includes('연결')) {
        bridgeServer?.start();
      } else if (pick.includes('Disconnect') || pick.includes('중지')) {
        bridgeServer?.stop();
      } else if (pick.includes('Restart') || pick.includes('재시작')) {
        bridgeServer?.restart();
      } else if (pick.includes('Show Logs') || pick.includes('로그 보기')) {
        outputChannel?.show();
      }
    }),
    vscode.commands.registerCommand('geminiAgent.showLogs', () => {
      outputChannel?.show();
    })
  );
}

export function deactivate() {
  if (bridgeServer) {
    bridgeServer.stop();
    bridgeServer = null;
  }
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = null;
  }
}
