import React, { useState } from 'react';
import { Radio, ChevronUp, ChevronDown, Shield, CheckCircle2, Send, AlertTriangle, Loader2, StopCircle, Clock, Activity } from 'lucide-react';
import { ApprovalPolicy, AgentBusyState } from '../types';

interface FloatingHUDProps {
  wsConnected: boolean;
  approvalPolicy: ApprovalPolicy;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
  onBootstrapPrompt: () => void;
  lastMessage: string | null;
  pendingCount: number;
  busyState?: AgentBusyState;
  onAbortExecution?: (callId?: string) => void;
}

export const FloatingHUD: React.FC<FloatingHUDProps> = ({
  wsConnected,
  approvalPolicy,
  setApprovalPolicy,
  onBootstrapPrompt,
  lastMessage,
  pendingCount,
  busyState,
  onAbortExecution,
}) => {
  const [minimized, setMinimized] = useState(false);

  const isBusy = Boolean(busyState?.isBusy);
  const elapsedSec = busyState?.elapsedSeconds || 0;
  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');
  const timerDisplay = `${mins}:${secs}`;
  const isStalled = Boolean(busyState?.isStalled || elapsedSec >= 35);
  const isLongRunning = elapsedSec >= 15 && !isStalled;

  return (
    <div
      id="universal-agent-hud"
      className="fixed bottom-4 right-4 z-50 transition-all duration-300 select-none shadow-2xl font-sans"
    >
      <div className="bg-slate-900/95 border border-indigo-500/40 backdrop-blur-md rounded-2xl p-3.5 w-84 text-slate-100 shadow-indigo-950/50 flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {wsConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  wsConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              🤖 Web AI Agent HUD
              <span className="text-[9px] px-1 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                Bridge
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isBusy && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse ${
                isStalled
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : isLongRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              }`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Busy ({timerDisplay})</span>
              </span>
            )}

            {pendingCount > 0 && !isBusy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 animate-pulse">
                {pendingCount} Pending
              </span>
            )}

            <button
              id="toggle-hud-btn"
              onClick={() => setMinimized(!minimized)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
              title={minimized ? 'Expand HUD' : 'Collapse HUD'}
            >
              {minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Status Line */}
        <div className="flex items-center justify-between text-xs bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            <span>Connection:</span>
          </span>
          <span
            className={`font-semibold font-mono text-[11px] ${
              wsConnected ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {wsConnected ? 'VS Code Bridge (:3000)' : 'Connecting...'}
          </span>
        </div>

        {/* Live Busy & Deadlock Monitor Card */}
        {isBusy && (
          <div className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-all ${
            isStalled
              ? 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/30'
              : isLongRunning
              ? 'bg-amber-950/30 border-amber-500/40'
              : 'bg-indigo-950/40 border-indigo-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Loader2 className={`w-3.5 h-3.5 animate-spin ${isStalled ? 'text-rose-400' : 'text-indigo-400'}`} />
                <span className="text-[11px] font-bold text-slate-200">
                  {busyState?.command || 'tool_call'}
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{timerDisplay}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{busyState?.phase || 'VS Code 작업 실행 중...'}</span>
            </div>

            {/* Deadlock or Long running alert */}
            {isStalled ? (
              <div className="bg-rose-900/40 border border-rose-500/40 rounded-lg p-2 flex flex-col gap-1 text-[10.5px] text-rose-200">
                <div className="flex items-center gap-1 font-bold text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>⚠️ 데드락 / 무응답 의심 ({elapsedSec}s)</span>
                </div>
                <p className="leading-snug text-slate-300">
                  작업이 35초 이상 지속되고 있습니다. 터미널 명령이 사용자 입력을 대기하고 있거나 프로세스가 멈췄을 수 있습니다.
                </p>
                {onAbortExecution && (
                  <button
                    id="hud-abort-deadlock-btn"
                    onClick={() => onAbortExecution(busyState?.callId)}
                    className="mt-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1 px-2 rounded text-[11px] transition-colors"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>작업 강제 중단 (Abort)</span>
                  </button>
                )}
              </div>
            ) : isLongRunning ? (
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-1.5 text-[10.5px] text-amber-200 flex items-center justify-between">
                <span>⏳ 긴 작업 진행 중 (빌드/설치 등)</span>
                {onAbortExecution && (
                  <button
                    onClick={() => onAbortExecution(busyState?.callId)}
                    className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-semibold transition-colors"
                  >
                    중단
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                <span>정상 진행 중</span>
                {onAbortExecution && (
                  <button
                    onClick={() => onAbortExecution(busyState?.callId)}
                    className="text-[10px] text-slate-400 hover:text-rose-300 transition-colors underline"
                  >
                    작업 취소
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!minimized && (
          <>
            {/* Approval Policy Selector */}
            <div className="flex flex-col gap-1 text-xs">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Shield className="w-3 h-3 text-indigo-400" />
                <span>Approval Mode:</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                <button
                  id="policy-safety"
                  onClick={() => setApprovalPolicy('safety')}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium text-center transition-all ${
                    approvalPolicy === 'safety'
                      ? 'bg-indigo-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🛡️ Safety
                </button>
                <button
                  id="policy-full-auto"
                  onClick={() => setApprovalPolicy('full-auto')}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium text-center transition-all ${
                    approvalPolicy === 'full-auto'
                      ? 'bg-amber-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Auto
                </button>
                <button
                  id="policy-read-only"
                  onClick={() => setApprovalPolicy('read-only')}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium text-center transition-all ${
                    approvalPolicy === 'read-only'
                      ? 'bg-sky-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🔒 ReadOnly
                </button>
              </div>
            </div>

            {/* Notification Bar */}
            {lastMessage && (
              <div className="text-[11px] bg-indigo-950/50 border border-indigo-500/30 text-indigo-200 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">{lastMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1 border-t border-slate-800/80">
              <button
                id="bootstrap-prompt-btn"
                onClick={onBootstrapPrompt}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold py-1.5 rounded-lg transition-all shadow-md shadow-indigo-900/40"
              >
                <Send className="w-3 h-3" />
                <span>Inject System Prompt</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

