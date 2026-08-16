import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Check, X, Play, Code2, Terminal, FileText, List, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { ChatMessage, ToolCallPayload, ToolResultPayload, ApprovalPolicy } from '../types';

interface GeminiChatSimulatorProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onExecuteTool: (messageId: string, toolCall: ToolCallPayload) => Promise<ToolResultPayload | void>;
  onRejectTool: (messageId: string) => void;
  approvalPolicy: ApprovalPolicy;
  isSending: boolean;
}

export const GeminiChatSimulator: React.FC<GeminiChatSimulatorProps> = ({
  messages,
  onSendMessage,
  onExecuteTool,
  onRejectTool,
  approvalPolicy,
  isSending,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isSending) return;
    const prompt = inputPrompt.trim();
    setInputPrompt('');
    await onSendMessage(prompt);
  };

  const samplePrompts = [
    { label: '📄 Read File', prompt: 'package.json 파일을 읽어서 어떤 설정과 의존성이 있는지 분석해줘.' },
    { label: '⚡ Fast file:edit', prompt: 'src/App.tsx 파일에서 ApprovalPolicy 초기값을 변경하도록 file:edit를 수행해줘.' },
    { label: '📁 List Files', prompt: '현재 워크스페이스의 루트 파일 목록을 조회해줘.' },
    { label: '📝 Write File', prompt: 'src/greeter.ts 파일을 생성하고 인사를 출력하는 코드를 작성해줘.' },
    { label: '🧪 Run Terminal', prompt: '터미널에서 ls -la 명령어를 실행하고 결과를 알려줘.' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Banner */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Gemini Web UI Simulator
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Bridge Active
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Bi-directional DOM parser & autonomous tool execution environment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Mode:</span>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {approvalPolicy === 'full-auto' ? '⚡ Full Auto' : approvalPolicy === 'safety' ? '🛡️ Safety Guard' : '🔒 Read Only'}
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-3xl ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.role === 'system'
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Message Bubble */}
            <div
              className={`rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 rounded-tr-sm'
                  : msg.role === 'system'
                  ? 'bg-slate-950/70 border border-slate-800 text-slate-300'
                  : 'bg-slate-950/90 border border-slate-800/80 text-slate-200 shadow-md shadow-slate-950/50 rounded-tl-sm w-full'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Render Tool Call Card if Detected */}
              {msg.toolCall && (
                <div className="mt-3.5 pt-3 border-t border-slate-800">
                  <div className="bg-slate-900 rounded-xl p-3 border border-indigo-500/30 shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        {msg.toolCall.command.startsWith('file:') && <FileText className="w-4 h-4 text-indigo-400" />}
                        {msg.toolCall.command.startsWith('terminal:') && <Terminal className="w-4 h-4 text-amber-400" />}
                        {msg.toolCall.command.startsWith('npm:') && <Code2 className="w-4 h-4 text-emerald-400" />}
                        <span className="font-mono text-xs font-bold text-white">
                          Tool: {msg.toolCall.command}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {msg.toolCall.id}
                      </span>
                    </div>

                    {/* Args representation */}
                    <div className="mt-2 text-xs font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto text-slate-300">
                      <pre>{JSON.stringify(msg.toolCall.args, null, 2)}</pre>
                    </div>

                    {/* Action buttons or Status */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400">Status:</span>
                        {msg.status === 'pending' && (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                            Waiting Approval
                          </span>
                        )}
                        {msg.status === 'executing' && (
                          <span className="text-indigo-400 font-semibold flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Executing in VS Code...
                          </span>
                        )}
                        {msg.status === 'approved' || msg.status === 'completed' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Executed
                          </span>
                        ) : null}
                        {msg.status === 'rejected' && (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <X className="w-3.5 h-3.5" />
                            Rejected
                          </span>
                        )}
                      </div>

                      {msg.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onRejectTool(msg.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                          <button
                            onClick={() => onExecuteTool(msg.id, msg.toolCall!)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
                          >
                            <Play className="w-3 h-3" />
                            <span>Execute in VS Code</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Render Tool Result if present */}
              {msg.toolResult && (
                <div className="mt-3 bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between pb-1.5 text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Execution Result ({msg.toolResult.status})
                    </span>
                    <span>{new Date(msg.toolResult.timestamp || Date.now()).toLocaleTimeString()}</span>
                  </div>
                  <pre className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 font-mono text-slate-300 overflow-x-auto max-h-48 text-[11px]">
                    {msg.toolResult.error
                      ? `Error: ${msg.toolResult.error}`
                      : typeof msg.toolResult.result === 'object'
                      ? JSON.stringify(msg.toolResult.result, null, 2)
                      : msg.toolResult.result}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3 max-w-lg mr-auto">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Gemini is generating response and analyzing workspace...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">Quick Prompts:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(p.prompt)}
            className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask Gemini to inspect, write files or execute commands in VS Code..."
          disabled={isSending}
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={isSending || !inputPrompt.trim()}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
