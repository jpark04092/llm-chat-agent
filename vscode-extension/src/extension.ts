import * as vscode from 'vscode';
import { CommandExecutor } from './executor';
import { EmbeddedBridgeServer } from './bridgeServer';

let bridgeServer: EmbeddedBridgeServer | null = null;
let outputChannel: vscode.OutputChannel | null = null;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Universal Web AI Agent');
  outputChannel.appendLine('🤖 [Universal Web AI Agent] Extension activated.');

  // Create Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'webAgent.toggleServer';
  context.subscriptions.push(statusBarItem);

  const executor = new CommandExecutor(outputChannel);

  const config = vscode.workspace.getConfiguration('webAgent');
  const legacyConfig = vscode.workspace.getConfiguration('geminiAgent');
  const serverPort = config.get<number>('serverPort') || legacyConfig.get<number>('serverPort') || 9999;
  const autoStartServer = (config.get<boolean>('autoStartServer') ?? legacyConfig.get<boolean>('autoStartServer')) === true;

  // Initialize Embedded WebSocket Server
  bridgeServer = new EmbeddedBridgeServer(serverPort, executor, outputChannel, statusBarItem);

  // Auto start only if explicitly enabled in user settings
  if (autoStartServer) {
    bridgeServer.start();
  } else {
    statusBarItem.text = '$(plug) AI Agent Bridge: Disconnected';
    statusBarItem.tooltip = 'Click to connect or manage AI Agent Bridge Server';
    statusBarItem.show();
  }

  const startFn = () => bridgeServer?.start();
  const stopFn = () => bridgeServer?.stop();
  const restartFn = () => bridgeServer?.restart();
  const toggleFn = async () => {
    const isRunning = bridgeServer?.isServerRunning() ?? false;
    const options = isRunning
      ? ['서버 중지 (Disconnect)', '서버 재시작 (Restart)', '로그 보기 (Show Logs)']
      : ['서버 연결 (Connect)', '로그 보기 (Show Logs)'];

    const pick = await vscode.window.showQuickPick(options, { placeHolder: 'AI Agent Bridge Server 관리' });
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
  };
  const logsFn = () => outputChannel?.show();

  // Register commands (both webAgent.* and legacy geminiAgent.*)
  context.subscriptions.push(
    vscode.commands.registerCommand('webAgent.startServer', startFn),
    vscode.commands.registerCommand('webAgent.stopServer', stopFn),
    vscode.commands.registerCommand('webAgent.restartServer', restartFn),
    vscode.commands.registerCommand('webAgent.toggleServer', toggleFn),
    vscode.commands.registerCommand('webAgent.showLogs', logsFn),
    // Backward compatibility
    vscode.commands.registerCommand('geminiAgent.startServer', startFn),
    vscode.commands.registerCommand('geminiAgent.stopServer', stopFn),
    vscode.commands.registerCommand('geminiAgent.restartServer', restartFn),
    vscode.commands.registerCommand('geminiAgent.toggleServer', toggleFn),
    vscode.commands.registerCommand('geminiAgent.showLogs', logsFn)
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
