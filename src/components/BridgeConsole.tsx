import React, { useState } from 'react';
import { Terminal, RefreshCw, Trash2, Play, Code, ArrowDownLeft, ArrowUpRight, Shield, Activity, AlertTriangle, Loader2, StopCircle, Clock } from 'lucide-react';
import { LogEntry, ToolCallPayload, ToolResultPayload, AgentBusyState } from '../types';

interface BridgeConsoleProps {
  logs: LogEntry[];
  onRefreshLogs: () => void;
  onClearLogs: () => void;
  onExecuteCustomTool: (payload: ToolCallPayload) => Promise<ToolResultPayload>;
  busyState?: AgentBusyState;
  onAbortExecution?: (callId?: string) => void;
}

export const BridgeConsole: React.FC<BridgeConsoleProps> = ({
  logs,
  onRefreshLogs,
  onClearLogs,
  onExecuteCustomTool,
  busyState,
  onAbortExecution,
}) => {
  const [selectedCommand, setSelectedCommand] = useState('terminal:exec');
  const [customArgsJson, setCustomArgsJson] = useState('{\n  "cmd": "node -v"\n}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState<ToolResultPayload | null>(null);

  const isBusy = Boolean(busyState?.isBusy);
  const elapsedSec = busyState?.elapsedSeconds || 0;
  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');
  const timerDisplay = `${mins}:${secs}`;
  const isStalled = Boolean(busyState?.isStalled || elapsedSec >= 35);

  const toolTemplates: Record<string, string> = {
    'file:read': '{\n  "path": "package.json"\n}',
    'file:patch': '{\n  "path": "package.json",\n  "line_start": 2,\n  "line_end": 4,\n  "replacement": "  \\"name\\": \\"universal-web-ai-agent\\",\\n  \\"version\\": \\"1.3.0\\""\n}',
    'file:write': '{\n  "path": "src/sample.txt",\n  "content": "Hello World from Bridge!"\n}',
    'file:list': '{\n  "path": "."\n}',
    'npm:run': '{\n  "script": "build"\n}',
    'terminal:exec': '{\n  "cmd": "npm --version"\n}',
  };

  const handleTemplateChange = (cmd: string) => {
    setSelectedCommand(cmd);
    if (toolTemplates[cmd]) {
      setCustomArgsJson(toolTemplates[cmd]);
    }
  };

  const handleRunCustomTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedArgs = JSON.parse(customArgsJson);
      setIsExecuting(true);
      const res = await onExecuteCustomTool({
        id: `manual_${Date.now()}`,
        command: selectedCommand,
        args: parsedArgs,
      });
      setLastExecutionResult(res);
    } catch (err: any) {
      setLastExecutionResult({
        agent_response: 'tool_result',
        id: 'err',
        status: 'error',
        error: `JSON parse or execution error: ${err.message}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Live Active Execution & Deadlock Status Header */}
      {isBusy && (
        <div className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
          isStalled
            ? 'bg-rose-950/50 border-rose-500/60 shadow-lg shadow-rose-950/40 text-rose-200'
            : elapsedSec >= 15
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
        }`}>
          <div className="flex items-center gap-3">
            <Loader2 className={`w-5 h-5 animate-spin ${isStalled ? 'text-rose-400' : 'text-indigo-400'}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-white">
                  ⚡ VS Code Executing: {busyState?.command} (ID: {busyState?.callId})
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isStalled ? 'bg-rose-500 text-white' : 'bg-indigo-500 text-white'
                }`}>
                  {isStalled ? '🔴 Deadlock Suspected' : '🟢 Active'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {isStalled
                  ? `작업이 ${elapsedSec}초 동안 지속 중입니다. 데드락 또는 사용자 입력 대기 중일 수 있습니다.`
                  : `${busyState?.phase || 'VS Code 작업 실행 중...'} (진행 시간: ${timerDisplay})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 font-mono text-sm font-bold text-amber-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{timerDisplay}</span>
            </div>
            {onAbortExecution && (
              <button
                onClick={() => onAbortExecution(busyState?.callId)}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                <span>강제 중단 (Abort)</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Left: Manual Tool Execution Sandbox */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-lg overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Manual Tool Dispatch Sandbox</h3>
            </div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Direct Bridge API
            </span>
          </div>

          <form onSubmit={handleRunCustomTool} className="mt-4 flex flex-col gap-3 flex-1">
            {/* Tool Command Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Tool Command Name
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                {Object.keys(toolTemplates).map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => handleTemplateChange(cmd)}
                    className={`text-[11px] font-mono py-1.5 px-2 rounded-lg border transition-all truncate ${
                      selectedCommand === cmd
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Args Editor */}
            <div className="flex-1 flex flex-col min-h-[140px]">
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Tool Arguments (JSON)
              </label>
              <textarea
                value={customArgsJson}
                onChange={(e) => setCustomArgsJson(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            <button
              type="submit"
              disabled={isExecuting}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md shadow-indigo-900/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>{isExecuting ? 'Dispatching via Bridge...' : 'Dispatch Tool Call to Workspace'}</span>
            </button>
          </form>

          {/* Execution Output Panel */}
          {lastExecutionResult && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                <span className="font-semibold text-slate-300">
                  Sandbox Result Status:{' '}
                  <span
                    className={
                      lastExecutionResult.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {lastExecutionResult.status.toUpperCase()}
                  </span>
                </span>
              </div>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-36">
                {lastExecutionResult.error
                  ? `Error: ${lastExecutionResult.error}`
                  : typeof lastExecutionResult.result === 'object'
                  ? JSON.stringify(lastExecutionResult.result, null, 2)
                  : lastExecutionResult.result}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Live WebSocket & Server Event Log Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-lg overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Bridge Server Live Stream</h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={onRefreshLogs}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Refresh Logs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClearLogs}
                className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Logs Feed */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-2 font-mono text-xs pr-1">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 italic">
                No bridge server events logged yet.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-[11px] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <div className="flex items-center gap-1.5">
                      {log.type === 'inbound' && (
                        <span className="flex items-center gap-1 text-sky-400 font-bold">
                          <ArrowDownLeft className="w-3 h-3" />
                          INBOUND
                        </span>
                      )}
                      {log.type === 'outbound' && (
                        <span className="flex items-center gap-1 text-purple-400 font-bold">
                          <ArrowUpRight className="w-3 h-3" />
                          OUTBOUND
                        </span>
                      )}
                      {log.type === 'executor' && (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Activity className="w-3 h-3" />
                          EXECUTOR
                        </span>
                      )}
                      {log.type === 'system' && (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <Shield className="w-3 h-3" />
                          SYSTEM
                        </span>
                      )}
                      {log.command && (
                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                          {log.command}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-28">
                    {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
