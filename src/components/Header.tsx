import React from 'react';
import { Radio, Download, ShieldCheck, Terminal, FolderTree, MessageSquareCode, Sparkles } from 'lucide-react';
import { ServerStatus, ApprovalPolicy } from '../types';

interface HeaderProps {
  status: ServerStatus | null;
  activeTab: 'chat' | 'workspace' | 'console' | 'extension';
  setActiveTab: (tab: 'chat' | 'workspace' | 'console' | 'extension') => void;
  approvalPolicy: ApprovalPolicy;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
  onDownloadSuite: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeTab,
  setActiveTab,
  approvalPolicy,
  setApprovalPolicy,
  onDownloadSuite,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Gemini VS Code Agent</h1>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v1.1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">WebSocket Bridge & Autonomous Workspace Executor</p>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-emerald-400 font-medium">:3000 Active</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
          <button
            id="tab-chat"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
            <span>Agent Chat & HUD</span>
          </button>

          <button
            id="tab-workspace"
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'workspace'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Workspace Files</span>
          </button>

          <button
            id="tab-console"
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'console'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Bridge & Logs</span>
          </button>

          <button
            id="tab-extension"
            onClick={() => setActiveTab('extension')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'extension'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Extension Setup</span>
          </button>
        </nav>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Policy selector */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Policy:</span>
            <select
              value={approvalPolicy}
              onChange={(e) => setApprovalPolicy(e.target.value as ApprovalPolicy)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="safety" className="bg-slate-900 text-white">🛡️ Safety Guard</option>
              <option value="full-auto" className="bg-slate-900 text-white">⚡ Full Auto</option>
              <option value="read-only" className="bg-slate-900 text-white">🔒 Read Only</option>
            </select>
          </div>

          {/* WebSocket Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-mono">
              Bridge :3000/ws
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>

          <button
            id="download-suite-btn"
            onClick={onDownloadSuite}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
            title="Download full Chrome and VS Code extension ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Suite</span>
          </button>
        </div>
      </div>
    </header>
  );
};
