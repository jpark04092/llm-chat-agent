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
  Cpu,
  Globe,
  Plus,
  Trash2,
  Edit2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Power
} from 'lucide-react';
import { ApprovalPolicy, PresetSiteItem, CustomSiteItem } from '../types';

interface ExtensionHubProps {
  onDownloadChromeZip: () => void;
  onDownloadSuiteZip: () => void;
  onDownloadVsix?: () => void;
  approvalPolicy: ApprovalPolicy;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
}

const INITIAL_PRESETS: PresetSiteItem[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    tag: 'Official',
    tagClass: 'official',
    urlDisplay: 'gemini.google.com',
    urlPatterns: ['gemini.google.com'],
    defaultEnabled: true,
    enabled: true,
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT',
    tag: 'Official',
    tagClass: 'official',
    urlDisplay: 'chatgpt.com, chat.openai.com',
    urlPatterns: ['chatgpt.com', 'chat.openai.com'],
    defaultEnabled: true,
    enabled: true,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude.ai',
    tag: 'Official',
    tagClass: 'official',
    urlDisplay: 'claude.ai',
    urlPatterns: ['claude.ai'],
    defaultEnabled: true,
    enabled: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Chat',
    tag: 'Popular',
    tagClass: 'popular',
    urlDisplay: 'chat.deepseek.com',
    urlPatterns: ['chat.deepseek.com'],
    defaultEnabled: true,
    enabled: true,
  },
  {
    id: 'openwebui',
    name: 'Open WebUI (Ollama / Local LLM)',
    tag: 'Self-Hosted',
    tagClass: 'self-hosted',
    urlDisplay: 'localhost:8080, *openwebui*',
    urlPatterns: ['localhost:8080', '*openwebui*'],
    defaultEnabled: true,
    enabled: true,
  },
  {
    id: 'librechat',
    name: 'LibreChat',
    tag: 'Self-Hosted',
    tagClass: 'self-hosted',
    urlDisplay: 'localhost:3080, *librechat*',
    urlPatterns: ['localhost:3080', '*librechat*'],
    defaultEnabled: false,
    enabled: false,
  },
  {
    id: 'dify',
    name: 'Dify.ai Chat App',
    tag: 'Self-Hosted',
    tagClass: 'self-hosted',
    urlDisplay: 'cloud.dify.ai, *dify*',
    urlPatterns: ['cloud.dify.ai', '*dify*'],
    defaultEnabled: false,
    enabled: false,
  },
];

const INITIAL_CUSTOM_SITES: CustomSiteItem[] = [
  {
    id: 'custom_1',
    name: '사내 Custom LLM 웹 챗',
    urlPattern: '*://*.internal/*, *://chat.corp.*',
    enabled: true,
    inputSelector: 'textarea, div[contenteditable="true"][role="textbox"], input[type="text"]',
    sendSelector: 'button[type="submit"], button[aria-label*="send" i], button.send-btn',
    messageSelector: '.assistant-message, .bot-message, div[data-role="assistant"], pre, code-block',
    injectionMode: 'react-setter',
  },
  {
    id: 'custom_2',
    name: '로컬 시뮬레이터 (Local Dev)',
    urlPattern: 'localhost:3000*, 127.0.0.1:3000*',
    enabled: false,
    inputSelector: 'textarea',
    sendSelector: 'button',
    messageSelector: '.message',
    injectionMode: 'react-setter',
  },
];

const PRESETS_DETAILS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    url: 'gemini.google.com',
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
  onDownloadVsix,
  approvalPolicy,
  setApprovalPolicy,
}) => {
  const [showFeatureGuide, setShowFeatureGuide] = useState(true);
  const [activeTab, setActiveTab] = useState<'sites' | 'downloads' | 'custom-llm' | 'dom-guide'>('sites');
  const [presets, setPresets] = useState<PresetSiteItem[]>(INITIAL_PRESETS);
  const [customSites, setCustomSites] = useState<CustomSiteItem[]>(INITIAL_CUSTOM_SITES);
  
  // Custom Site Form State
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrlPattern, setFormUrlPattern] = useState('');
  const [formInputSelector, setFormInputSelector] = useState('');
  const [formSendSelector, setFormSendSelector] = useState('');
  const [formMessageSelector, setFormMessageSelector] = useState('');
  const [formInjectionMode, setFormInjectionMode] = useState<'react-setter' | 'standard-input' | 'contenteditable-paste'>('react-setter');
  const [showAdvancedSelectors, setShowAdvancedSelectors] = useState(false);

  // Live URL Tester State
  const [testUrlInput, setTestUrlInput] = useState('https://gemini.google.com/app');
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS_DETAILS[0]);

  // Toggle Preset
  const handleTogglePreset = (id: string) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  // Toggle Custom Site
  const handleToggleCustomSite = (id: string) => {
    setCustomSites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Delete Custom Site
  const handleDeleteCustomSite = (id: string) => {
    setCustomSites((prev) => prev.filter((s) => s.id !== id));
  };

  // Open Edit Form
  const handleOpenEdit = (site: CustomSiteItem) => {
    setEditingSiteId(site.id);
    setFormName(site.name);
    setFormUrlPattern(site.urlPattern);
    setFormInputSelector(site.inputSelector || '');
    setFormSendSelector(site.sendSelector || '');
    setFormMessageSelector(site.messageSelector || '');
    setFormInjectionMode(site.injectionMode || 'react-setter');
    setShowAdvancedSelectors(Boolean(site.inputSelector || site.sendSelector || site.messageSelector));
    setShowCustomForm(true);
  };

  // Open Add Form
  const handleOpenAdd = () => {
    setEditingSiteId(null);
    setFormName('');
    setFormUrlPattern('');
    setFormInputSelector('');
    setFormSendSelector('');
    setFormMessageSelector('');
    setFormInjectionMode('react-setter');
    setShowAdvancedSelectors(false);
    setShowCustomForm(true);
  };

  // Save Custom Site Form
  const handleSaveCustomForm = () => {
    if (!formName.trim() || !formUrlPattern.trim()) return;

    if (editingSiteId) {
      setCustomSites((prev) =>
        prev.map((s) =>
          s.id === editingSiteId
            ? {
                ...s,
                name: formName.trim(),
                urlPattern: formUrlPattern.trim(),
                inputSelector: formInputSelector.trim() || undefined,
                sendSelector: formSendSelector.trim() || undefined,
                messageSelector: formMessageSelector.trim() || undefined,
                injectionMode: formInjectionMode,
              }
            : s
        )
      );
    } else {
      const newSite: CustomSiteItem = {
        id: `custom_${Date.now()}`,
        name: formName.trim(),
        urlPattern: formUrlPattern.trim(),
        enabled: true,
        inputSelector: formInputSelector.trim() || undefined,
        sendSelector: formSendSelector.trim() || undefined,
        messageSelector: formMessageSelector.trim() || undefined,
        injectionMode: formInjectionMode,
      };
      setCustomSites((prev) => [...prev, newSite]);
    }
    setShowCustomForm(false);
  };

  // Helper URL Matcher for Test Sandbox
  const testUrlPermission = (urlToTest: string) => {
    if (!urlToTest.trim()) return { allowed: false, reason: 'URL이 입력되지 않았습니다.' };

    let parsedHostname = '';
    try {
      const u = new URL(urlToTest.startsWith('http') ? urlToTest : `https://${urlToTest}`);
      parsedHostname = u.hostname;
    } catch (e) {
      parsedHostname = urlToTest.split('/')[0];
    }

    const matchPattern = (pattern: string, url: string, host: string) => {
      const trimmed = pattern.trim();
      if (host === trimmed || host.endsWith('.' + trimmed)) return true;
      try {
        const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`, 'i');
        return regex.test(url) || regex.test(host) || url.includes(trimmed);
      } catch (e) {
        return url.includes(trimmed);
      }
    };

    // 1. Check Presets
    for (const p of presets) {
      if (p.enabled) {
        const matched = p.urlPatterns.some((pattern) => matchPattern(pattern, urlToTest, parsedHostname));
        if (matched) {
          return { allowed: true, type: 'preset', name: p.name, reason: `프리셋 [${p.name}] 활성화 상태에 매칭됨` };
        }
      } else {
        const matched = p.urlPatterns.some((pattern) => matchPattern(pattern, urlToTest, parsedHostname));
        if (matched) {
          return { allowed: false, type: 'preset-disabled', name: p.name, reason: `프리셋 [${p.name}] URL이나, 현재 [OFF]로 비활성화되어 차단됨` };
        }
      }
    }

    // 2. Check Custom Sites
    for (const site of customSites) {
      if (site.enabled && site.urlPattern) {
        const patterns = site.urlPattern.split(',').map((s) => s.trim()).filter(Boolean);
        const matched = patterns.some((pat) => matchPattern(pat, urlToTest, parsedHostname));
        if (matched) {
          return { allowed: true, type: 'custom', name: site.name, reason: `사내/추가 허용 URL [${site.name}] 패턴에 매칭됨` };
        }
      } else if (!site.enabled && site.urlPattern) {
        const patterns = site.urlPattern.split(',').map((s) => s.trim()).filter(Boolean);
        const matched = patterns.some((pat) => matchPattern(pat, urlToTest, parsedHostname));
        if (matched) {
          return { allowed: false, type: 'custom-disabled', name: site.name, reason: `사내 LLM [${site.name}] URL이나, 현재 [OFF] 상태임` };
        }
      }
    }

    return { allowed: false, reason: '허용 목록에 등록되지 않은 사이트입니다. HUD가 뜨지 않고 완전히 비활성화됩니다.' };
  };

  const testResult = testUrlPermission(testUrlInput);

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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('sites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'sites'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>🌐 작동 사이트 & URL 허용 관리 (On/Off)</span>
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'downloads'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>패키지 다운로드 및 실행</span>
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
          <span>🏢 사내 Custom LLM DOM 매핑</span>
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

      {/* Tab 1: Allowed Sites & Preset On/Off URL Manager */}
      {activeTab === 'sites' && (
        <div className="space-y-6">
          {/* Feature Overview & Functional Guide Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>💡 이번 업데이트 기능 상세 설명 (v2.1 Allowlist & Multi-LLM Guide)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      최신 반영됨
                    </span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    원치 않는 웹 사이트에서의 오작동 방지 및 사내망 Custom LLM 지원 아키텍처 안내
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowFeatureGuide(!showFeatureGuide)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 transition-all"
              >
                <span>{showFeatureGuide ? '설명 접기' : '설명 펼치기'}</span>
                <span>{showFeatureGuide ? '▴' : '▾'}</span>
              </button>
            </div>

            {showFeatureGuide && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-slate-800/80 text-xs">
                {/* Point 1 */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-300">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>1. 선택적 HUD 주입 (Allowlist)</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    이전에는 모든 웹사이트에 HUD가 강제 표시되었으나, 이제 <b>[ON]으로 설정된 AI 사이트에서만 HUD가 로드</b>됩니다. 포털·뉴스 등 일반 웹 서핑 시 브라우저 리소스 소모가 0%로 완전히 차단됩니다.
                  </p>
                </div>

                {/* Point 2 */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-purple-300">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span>2. 사내 Custom LLM 및 프리셋 토글</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    Gemini, ChatGPT, Claude 외에도 <b>사내망 폐쇄형 LLM 웹 챗 도메인</b>(예: <code className="text-purple-300 font-mono text-[10px]">*://*.internal/*</code>)을 손쉽게 등록하여 즉시 자율 코딩 루프를 실행할 수 있습니다.
                  </p>
                </div>

                {/* Point 3 */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>3. 새로고침 시 자동 연결 방지</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    웹 페이지를 새로고침(F5)하거나 탭을 이동할 때 이전 대화 히스토리의 Tool Call이 의도치 않게 재실행되는 사고를 막기 위해, 명시적으로 <b>[연결]</b> 버튼을 누를 때만 안전하게 동작합니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Preset Sites Toggle Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>기본 지원 LLM 프리셋 On/Off 토글</span>
                </h3>
                <span className="text-xs text-slate-400">자주 사용하는 AI 웹 서비스별 독립적 On/Off 스위치</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    preset.enabled
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate">{preset.name}</span>
                      <span
                        className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
                          preset.tagClass === 'official'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : preset.tagClass === 'popular'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {preset.tag}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-indigo-300 truncate" title={preset.urlDisplay}>
                      🔗 {preset.urlDisplay}
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleTogglePreset(preset.id)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      preset.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        preset.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Enterprise Sites Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>추가 허용 URL 및 사내 LLM 목록 (Custom Allowed URLs)</span>
                </h3>
                <span className="text-xs text-slate-400">사내망 LLM 웹 챗 도메인을 등록하여 자유롭게 HUD를 활성화할 수 있습니다.</span>
              </div>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer shadow-md transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 사이트 / 사내 LLM 추가</span>
              </button>
            </div>

            {/* Custom Site Form Modal/Box */}
            {showCustomForm && (
              <div className="bg-slate-950 border border-indigo-500/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-indigo-300">
                    {editingSiteId ? '✏️ 사내 허용 사이트 수정' : '➕ 새 허용 사이트 / 사내 LLM 등록'}
                  </h4>
                  <button
                    onClick={() => setShowCustomForm(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">사이트 / LLM 명칭</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="예: 사내 엔터프라이즈 AI 챗봇"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      허용 URL 패턴 (와일드카드 및 콤마 구분)
                    </label>
                    <input
                      type="text"
                      value={formUrlPattern}
                      onChange={(e) => setFormUrlPattern(e.target.value)}
                      placeholder="*://chat.mycompany.internal/*, localhost:8080/*"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSelectors(!showAdvancedSelectors)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚙️ 고급 DOM 선택자 직접 지정 (선택 사항)</span>
                    <span>{showAdvancedSelectors ? '▴' : '▾'}</span>
                  </button>
                </div>

                {showAdvancedSelectors && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-1">입력창 선택자 (Input)</label>
                      <input
                        type="text"
                        value={formInputSelector}
                        onChange={(e) => setFormInputSelector(e.target.value)}
                        placeholder="textarea, #chat-input"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-1">전송 버튼 선택자 (Send)</label>
                      <input
                        type="text"
                        value={formSendSelector}
                        onChange={(e) => setFormSendSelector(e.target.value)}
                        placeholder="button[type='submit'], #send-btn"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCustomForm(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveCustomForm}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    저장 및 적용
                  </button>
                </div>
              </div>
            )}

            {/* Custom Sites List */}
            <div className="space-y-2">
              {customSites.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  등록된 사내 LLM 사이트가 없습니다. [➕ 새 사이트 추가] 버튼을 눌러 추가하세요.
                </div>
              ) : (
                customSites.map((site) => (
                  <div
                    key={site.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      site.enabled
                        ? 'bg-slate-950/80 border-slate-800'
                        : 'bg-slate-950/40 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white truncate">{site.name}</span>
                        <span className="text-[9.5px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono uppercase font-semibold">
                          Custom
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-purple-300 truncate" title={site.urlPattern}>
                        🌐 {site.urlPattern}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(site)}
                        className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800/80 hover:bg-slate-700 transition-all cursor-pointer"
                        title="수정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomSite(site.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 transition-all cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle Button */}
                      <button
                        onClick={() => handleToggleCustomSite(site.id)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          site.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            site.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live URL Simulator / Tester */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  <span>실시간 URL 매칭 테스트 시뮬레이터 (Live URL Validator)</span>
                </h3>
                <span className="text-xs text-slate-400">
                  접속할 웹 주소를 입력하면 현재 설정에 따라 HUD가 활성화될지 즉시 검증합니다.
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testUrlInput}
                  onChange={(e) => setTestUrlInput(e.target.value)}
                  placeholder="테스트할 웹 사이트 URL (예: https://gemini.google.com/app, https://naver.com)"
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              {/* Quick Sample Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                <span>빠른 샘플 테스트:</span>
                <button
                  onClick={() => setTestUrlInput('https://gemini.google.com/app')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono"
                >
                  gemini.google.com
                </button>
                <button
                  onClick={() => setTestUrlInput('https://chatgpt.com/c/123')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono"
                >
                  chatgpt.com
                </button>
                <button
                  onClick={() => setTestUrlInput('http://chat.mycompany.internal/workspace')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 font-mono"
                >
                  chat.mycompany.internal
                </button>
                <button
                  onClick={() => setTestUrlInput('https://news.google.com')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono"
                >
                  news.google.com (차단 대상)
                </button>
              </div>

              {/* Evaluation Result Card */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  testResult.allowed
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="mt-0.5">
                  {testResult.allowed ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>{testResult.allowed ? '🟢 [HUD 활성화]' : '⚪ [HUD 비활성화 (표시 안 됨)]'}</span>
                    {testResult.name && (
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-white font-mono">
                        {testResult.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] leading-relaxed">{testResult.reason}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      Universal Chrome Extension <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">v2.1 Allowlist Edition</span>
                    </h3>
                    <span className="text-xs text-indigo-400 font-medium">Selective HUD Injection + URL Allowlist Controller</span>
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
                <span>Download Chrome Extension ZIP (v2.1)</span>
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
                  VS Code 내부에 <code className="text-purple-300">ws://localhost:9999</code> 브릿지 서버를 실행하여 파일 읽기/안정적 패치(file:patch)/생성 및 터미널 명령어를 안전한 승인 정책 하에 로컬 실행합니다.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onDownloadVsix || onDownloadSuiteZip}
                  className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Compiled .vsix Package</span>
                </button>
                <button
                  onClick={onDownloadSuiteZip}
                  className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold py-2 rounded-xl border border-slate-700 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Full Suite Package ZIP</span>
                </button>
              </div>
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
              {PRESETS_DETAILS.map((preset) => (
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

