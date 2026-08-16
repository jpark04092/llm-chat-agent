import React, { useState } from 'react';
import {
  Download,
  Chrome,
  Code,
  CheckCircle,
  Zap,
  Settings,
  Layers,
  Sparkles,
  MousePointer,
  HelpCircle,
  Check,
  Play,
  Terminal,
  Cpu
} from 'lucide-react';
import { ApprovalPolicy } from '../types';

interface ExtensionHubProps {
  onDownloadChromeZip: () => void;
  onDownloadSuiteZip: () => void;
  approvalPolicy: ApprovalPolicy;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
}

const PRESETS = [
  {
    id: 'gemini',
    name: 'Google Gemini & AI Studio',
    url: 'gemini.google.com, aistudio.google.com',
    input: 'rich-textarea div[contenteditable="true"]',
    send: 'button[aria-label*="보내기"], button[aria-label*="Send"]',
    msg: 'model-response, [class*="model-response"]',
    mode: 'quill-gemini (Paragraph Node builder)',
    status: 'Built-in Native',
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT',
    url: 'chatgpt.com, chat.openai.com',
    input: '#prompt-textarea',
    send: 'button[data-testid="send-button"]',
    msg: 'div[data-message-author-role="assistant"]',
    mode: 'react-setter (React 16+ Value Tracker)',
    status: 'Built-in Native',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude.ai',
    url: 'claude.ai',
    input: 'div[contenteditable="true"].ProseMirror',
    send: 'button[aria-label*="Send Message" i]',
    msg: 'div[data-is-streaming], .font-claude-message',
    mode: 'prosemirror (ClipboardEvent)',
    status: 'Built-in Native',
  },
  {
    id: 'openwebui',
    name: 'Open WebUI (Ollama/VLLM/TGI)',
    url: 'localhost:8080, *openwebui*',
    input: '#chat-textarea, textarea',
    send: '#send-message-button, button[type="submit"]',
    msg: '.chat-message, div[id*="message-"]',
    mode: 'standard-input',
    status: 'Template Preset',
  },
  {
    id: 'librechat',
    name: 'LibreChat',
    url: 'localhost:3080, *librechat*',
    input: '#prompt-textarea',
    send: 'button[data-testid="send-button"]',
    msg: 'div[data-testid*="message-assistant"]',
    mode: 'react-setter',
    status: 'Template Preset',
  },
  {
    id: 'dify',
    name: 'Dify.ai Chat App',
    url: 'cloud.dify.ai, *dify*',
    input: 'textarea[placeholder*="Talk"], textarea',
    send: 'button:has(svg), button[type="submit"]',
    msg: '.chat-answer-container',
    mode: 'react-setter',
    status: 'Template Preset',
  },
  {
    id: 'enterprise',
    name: '사내 자체 React/Vue 포털 (Enterprise)',
    url: '*.internal/*, localhost:*',
    input: 'textarea, input[type="text"], div[contenteditable="true"]',
    send: 'button[type="submit"], button.send-btn',
    msg: '.assistant-message, div[data-role="assistant"]',
    mode: 'react-setter',
    status: 'Custom Configurable',
  },
];

export const ExtensionHub: React.FC<ExtensionHubProps> = ({
  onDownloadChromeZip,
  onDownloadSuiteZip,
  approvalPolicy,
  setApprovalPolicy,
}) => {
  const [activeTab, setActiveTab] = useState<'downloads' | 'custom-llm' | 'dom-guide'>('downloads');
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);

  // Test DOM injection in sandbox
  const handleTestInject = (mode: string) => {
    const textToInject = `[Test Tool Call]\n\`\`\`json\n{\n  "agent_action": "tool_call",\n  "id": "test_1",\n  "command": "file:list",\n  "args": { "path": "." }\n}\n\`\`\``;
    setTestInput(textToInject);
    setTestLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ✅ ${mode} 방식으로 텍스트 주입 성공 (${textToInject.length} bytes)`,
      ...prev.slice(0, 5),
    ]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'downloads'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>패키지 다운로드 및 기본 설정</span>
        </button>

        <button
          onClick={() => setActiveTab('custom-llm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'custom-llm'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>🏢 사내 Custom LLM 매핑 & 어댑터 프리셋</span>
        </button>

        <button
          onClick={() => setActiveTab('dom-guide')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'dom-guide'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>📖 DOM 주입 엔지니어링 가이드</span>
        </button>
      </div>

      {activeTab === 'downloads' && (
        <>
          {/* Hero Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chrome Extension Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Chrome className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Universal Chrome Extension <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">v2.0 Universal</span>
                    </h3>
                    <span className="text-xs text-indigo-400 font-medium">Multi-Platform + Enterprise Custom LLM Support</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Gemini, ChatGPT, Claude, DeepSeek 뿐만 아니라 <b>사내 자체 LLM 웹 챗</b>에 자동으로 Floating HUD를 주입하고, JSON 도구 호출을 감지하여 VS Code와 양방향 자동 오케스트레이션을 수행합니다.
                </p>
              </div>

              <button
                onClick={onDownloadChromeZip}
                className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Chrome Extension ZIP (v2.0)</span>
              </button>
            </div>

            {/* VS Code Extension Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Code className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">VS Code Extension</h3>
                    <span className="text-xs text-purple-400 font-medium">Embedded WebSocket Server</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  VS Code 내부에 <code className="text-purple-300">ws://localhost:9999</code> 브릿지 서버를 실행하여 파일 읽기/부분수정(file:edit)/생성 및 터미널 명령어를 안전한 승인 정책 하에 로컬 실행합니다.
                </p>
              </div>

              <button
                onClick={onDownloadSuiteZip}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Full Suite Package ZIP</span>
              </button>
            </div>
          </div>

          {/* Quick Setup Workflow */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>3단계 빠른 실행 워크플로우</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center border border-indigo-500/30">
                    1
                  </span>
                  <span className="text-[10px] uppercase font-mono text-slate-500">Chrome</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">Chrome 확장 프로그램 로드</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  1. <code className="text-indigo-300">chrome-extension.zip</code> 다운로드 후 압축 해제<br />
                  2. <code className="text-indigo-300">chrome://extensions/</code> 접속 후 <b>개발자 모드</b> 켜기<br />
                  3. <b>압축해제된 확장 프로그램을 로드합니다</b> 클릭 후 폴더 선택
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 text-xs font-bold flex items-center justify-center border border-purple-500/30">
                    2
                  </span>
                  <span className="text-[10px] uppercase font-mono text-slate-500">VS Code</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">VS Code Extension 실행</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  1. VS Code에서 <code className="text-purple-300">vscode-extension</code> 폴더 열기<br />
                  2. <code className="text-purple-300">npm install</code> 실행<br />
                  3. <b>F5</b> 키를 눌러 Extension Host 실행 (브릿지 서버 9999 자동 기동)
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                    3
                  </span>
                  <span className="text-[10px] uppercase font-mono text-slate-500">Web AI Chat</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">자율 코딩 시작</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  1. 원하는 웹 챗(Gemini, Claude, 사내 LLM) 열기<br />
                  2. 우측 하단 <b>VS Code Agent HUD</b>에서 <b>[연결]</b> 버튼 클릭 (새로고침 시 히스토리 오실행 방지)<br />
                  3. <b>[부트스트랩 전송]</b> 클릭 후 개발 작업 지시!
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'custom-llm' && (
        <div className="space-y-6">
          {/* Multi-Platform Adapter Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>다중 플랫폼 어댑터 & 사내 LLM 프리셋 매트릭스</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  어댑터 패턴(Adapter Pattern)을 통해 각 웹 챗의 독자적인 DOM 구조와 입력 메커니즘을 추상화하여 지원합니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedPreset.id === preset.id
                      ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-white">{preset.name}</h4>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        {preset.status}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500">URL:</span> <code className="text-indigo-300 font-mono text-[10px]">{preset.url}</code>
                      </div>
                      <div>
                        <span className="text-slate-500">입력창:</span> <code className="text-slate-300 font-mono text-[10px]">{preset.input}</code>
                      </div>
                      <div>
                        <span className="text-slate-500">주입 방식:</span> <span className="text-emerald-400 text-[10px]">{preset.mode}</span>
                      </div>
                    </div>
                  </div>

                  {selectedPreset.id === preset.id && (
                    <div className="mt-3 pt-2 border-t border-indigo-900/60 flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>선택됨 (상세 가이드 하단 표시)</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Selected Preset Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>[{selectedPreset.name}] 연동 상세 설정값</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-slate-400 text-[11px]">1. Input Selector (입력창 선택자)</div>
                <div className="text-indigo-300 bg-slate-900 p-2 rounded border border-slate-800">{selectedPreset.input}</div>

                <div className="text-slate-400 text-[11px] mt-2">2. Send Button Selector (전송 버튼)</div>
                <div className="text-emerald-300 bg-slate-900 p-2 rounded border border-slate-800">{selectedPreset.send}</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-slate-400 text-[11px]">3. Assistant Message Selector (답변 컨테이너)</div>
                <div className="text-purple-300 bg-slate-900 p-2 rounded border border-slate-800">{selectedPreset.msg}</div>

                <div className="text-slate-400 text-[11px] mt-2">4. Injection Strategy (텍스트 주입 방식)</div>
                <div className="text-amber-300 bg-slate-900 p-2 rounded border border-slate-800">{selectedPreset.mode}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dom-guide' && (
        <div className="space-y-6">
          {/* Deep-dive DOM Injection Guide */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-indigo-400" />
              <span>사내 Custom LLM 웹 챗 DOM 주입 원리와 해결법</span>
            </h3>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <span>🚨 문제 1: React 16+ Controlled Input의 State 무반응 현상</span>
                </h4>
                <p className="text-slate-400">
                  React는 내부적으로 <code className="text-slate-200">_valueTracker</code>를 통해 프로퍼티 세터를 가로챕니다. 일반적인 <code className="text-amber-300">textarea.value = 'text'</code>를 실행하면 React 상태가 업데이트되지 않아 전송 버튼이 활성화되지 않습니다.
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400">
                  {`// 해결 코드: 프로토타입 세터 직접 호출
const setter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  'value'
)?.set;
setter.call(textarea, text);
textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));`}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-purple-300 flex items-center gap-1.5">
                  <span>🎯 해결 2: Visual DOM Element Picker (원클릭 선택자 생성)</span>
                </h4>
                <p className="text-slate-400">
                  개발자 도구(F12)를 열어 일일이 클래스명을 찾을 필요 없이, 브라우저 화면에서 바로 클릭하여 입력창과 전송 버튼을 등록할 수 있는 <b>[🎯 DOM 선택기]</b> 기능이 HUD에 내장되어 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Injection Sandbox */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              <span>실시간 DOM 주입 시뮬레이터 (Sandbox)</span>
            </h3>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => handleTestInject('React State Setter')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  ⚡ React Setter 주입 테스트
                </button>
                <button
                  onClick={() => handleTestInject('Standard InputEvent')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  📝 Standard InputEvent 테스트
                </button>
                <button
                  onClick={() => setTestInput('')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  초기화
                </button>
              </div>

              <textarea
                id="sandbox-textarea"
                rows={5}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="사내 웹 챗의 입력창(Textarea) 시뮬레이션 영역입니다..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none"
              />

              {testLog.length > 0 && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                  {testLog.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

