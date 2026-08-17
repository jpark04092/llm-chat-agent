/**
 * Universal Web AI <-> VS Code Orchestrated Agent Content Script
 * Supports Gemini, ChatGPT, Claude, DeepSeek, OpenWebUI, LibreChat & Custom Enterprise LLMs
 */

(function () {
  console.log('%c🌐 [Universal Web AI Agent] Content script active on ' + window.location.href, 'background: #1e1e2e; color: #89b4fa; font-weight: bold; padding: 4px 8px; border-radius: 4px;');

  const BOOTSTRAP_PROMPT = `안녕하세요! 앞으로 함께 소프트웨어 개발 프로젝트 작업을 진행하려고 합니다.

효율적인 작업 진행과 원활한 코드 관리를 위해, 작업 단계마다 파일 조회, 파일 수정, 파일 생성, 명령어 실행 제안이 필요한 경우 일반 설명과 함께 아래와 같은 **JSON 포맷(tool_call)** 코드 블록을 포함하여 답변해 주시기 바랍니다.

[출력 포맷 규약]
1. 기존 파일 내용 확인이 필요한 경우 (라인 번호 확인):
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_1",
  "command": "file:read",
  "args": { "path": "src/App.tsx" }
}
\`\`\`

2. 기존 파일 부분 수정이 필요한 경우 (★가장 권장 - 라인 번호 치환 또는 Unified Diff 패치):
[방법 A: 라인 번호 기반 치환 (권장)]
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_2",
  "command": "file:patch",
  "args": {
    "path": "src/App.tsx",
    "line_start": 10,
    "line_end": 12,
    "replacement": "const [count, setCount] = useState(100);"
  }
}
\`\`\`
[방법 B: Unified Diff / Hunk 패치]
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_2",
  "command": "file:patch",
  "args": {
    "path": "src/App.tsx",
    "patch": "@@ -10,3 +10,3 @@\\n-const [count, setCount] = useState(0);\\n+const [count, setCount] = useState(100);"
  }
}
\`\`\`
※ 기존 파일을 수정할 때는 전체를 다시 쓰는 file:write 대신, 먼저 file:read로 내용을 확인한 뒤 반드시 file:patch를 사용하여 수정할 부분만 라인 번호(line_start, line_end) 또는 Diff 포맷으로 지정해 주세요.

3. 새 파일 생성 또는 전체 파일 작성이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_3",
  "command": "file:write",
  "args": {
    "path": "src/components/MyComponent.tsx",
    "content": "export function MyComponent() { return <div>Hello</div>; }"
  }
}
\`\`\`

4. 특정 디렉토리 파일 목록 확인이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_4",
  "command": "file:list",
  "args": { "path": "." }
}
\`\`\`

5. 빌드 또는 패키지 스크립트 실행이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_5",
  "command": "npm:run",
  "args": { "script": "build" }
}
\`\`\`

6. 터미널 명령어 실행 제안이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_6",
  "command": "terminal:exec",
  "args": { "cmd": "npm install lodash" }
}
\`\`\`

[진행 방식]
- 한 번에 한 단계씩 작업을 제안하고 위의 JSON 포맷을 출력해 주세요.
- 기존 코드를 변경할 때는 공백/줄바꿈 매칭 오차 및 지연을 방지하기 위해 file:read 후 file:patch(라인 번호 기반 또는 Diff)를 사용해 주세요.
- 제가 해당 작업의 결과를 다음 메시지([Tool Execution Result])로 전달해 드리면, 그 결과를 바탕으로 다음 단계 작업을 이어가 주시면 됩니다.

위 규약으로 진행할 준비가 되셨다면, 불필요한 초기 파일 목록 조회(file:list)를 즉시 실행하지 마시고, 준비되었다는 확인 메시지(예: '준비되었습니다. 어떤 개발 작업을 진행할까요?')로 답변해 주세요.`;

  // State & Config
  let ws = null;
  let wsConnected = false;
  let hasConnectedOnce = false;
  let scanIntervalId = null;
  let isPageAllowed = false;

  let config = {
    wsUrl: 'ws://localhost:9999',
    approvalPolicy: 'safety',
    autoSubmitResult: true,
    presetToggles: {
      gemini: true,
      chatgpt: true,
      claude: true,
      deepseek: true,
      openwebui: true,
      librechat: false,
      dify: false,
    },
    customSites: [
      {
        id: 'custom_default',
        name: '사내 Custom LLM 웹 챗',
        urlPattern: '*://*.internal/*, *://chat.corp.*',
        enabled: true,
        inputSelector: 'textarea, div[contenteditable="true"][role="textbox"], input[type="text"]',
        sendSelector: 'button[type="submit"], button[aria-label*="send" i], button.send-btn',
        messageSelector: '.assistant-message, .bot-message, div[data-role="assistant"], pre, code-block',
        injectionMode: 'react-setter',
      },
      {
        id: 'local_dev',
        name: '로컬 시뮬레이터 (Local Dev)',
        urlPattern: 'localhost:3000*, 127.0.0.1:3000*',
        enabled: false,
        inputSelector: 'textarea',
        sendSelector: 'button',
        messageSelector: '.message',
        injectionMode: 'react-setter',
      }
    ],
    customUrlPattern: '',
    customInputSelector: '',
    customSendSelector: '',
    customMessageSelector: '',
    customInjectionMode: 'react-setter',
  };

  // Busy State
  let busyState = {
    isBusy: false,
    callId: null,
    command: null,
    argsSummary: '',
    startedAt: 0,
    lastHeartbeatAt: 0,
    phase: '',
    isStalled: false,
  };
  let busyTickerInterval = null;

  // Picker Mode State
  let pickerMode = null; // 'input' | 'send' | 'message' | null
  let hoveredElement = null;

  // --- PRESET ADAPTER DEFINITIONS ---
  const PRESET_ADAPTERS = [
    // 1. Google Gemini Adapter
    {
      name: 'Google Gemini',
      id: 'gemini',
      urlPatterns: ['gemini.google.com'],
      defaultEnabled: true,
      match: () => /gemini\.google\.com/i.test(window.location.hostname),
      getInput: () => {
        return document.querySelector('rich-textarea div[contenteditable="true"], rich-textarea .ql-editor, div[contenteditable="true"][role="textbox"], textarea[aria-label*="Prompt"], textarea[aria-label*="프롬프트"]');
      },
      getSendButton: () => {
        const specific = document.querySelector('button[aria-label*="보내기"], button[aria-label*="전송"], button[aria-label*="Send message" i], button[aria-label*="Send prompt" i], button.send-button, .send-button-container button');
        if (specific && !isStopButton(specific) && !specific.disabled) return specific;
        return null;
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('model-response, [class*="model-response"], [class*="response-container"], message-content:not([class*="user"]), .model-turn, [data-test-id*="model-response"]');
      },
      injectionMode: 'quill-gemini',
    },
    // 2. OpenAI ChatGPT Adapter
    {
      name: 'ChatGPT',
      id: 'chatgpt',
      urlPatterns: ['chatgpt.com', 'chat.openai.com'],
      defaultEnabled: true,
      match: () => /chatgpt\.com|chat\.openai\.com/i.test(window.location.hostname),
      getInput: () => {
        return document.querySelector('#prompt-textarea, div[contenteditable="true"]#prompt-textarea, textarea[tabindex="0"]');
      },
      getSendButton: () => {
        return document.querySelector('button[data-testid="send-button"], button[aria-label="Send prompt"], button:has(svg[data-icon="arrow-up"])');
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('div[data-message-author-role="assistant"], div.agent-turn, [data-testid*="conversation-turn-"] [class*="markdown"]');
      },
      injectionMode: 'react-setter',
    },
    // 3. Anthropic Claude Adapter
    {
      name: 'Claude.ai',
      id: 'claude',
      urlPatterns: ['claude.ai'],
      defaultEnabled: true,
      match: () => /claude\.ai/i.test(window.location.hostname),
      getInput: () => {
        return document.querySelector('div[contenteditable="true"].ProseMirror, fieldset div[contenteditable="true"], div[role="textbox"]');
      },
      getSendButton: () => {
        return document.querySelector('button[aria-label*="Send Message" i], button:has(svg path[d*="M208 128"])');
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('div[data-is-streaming], .font-claude-message, div[class*="claude-message"], div[class*="standard-markdown"]');
      },
      injectionMode: 'prosemirror',
    },
    // 4. DeepSeek Chat Adapter
    {
      name: 'DeepSeek',
      id: 'deepseek',
      urlPatterns: ['chat.deepseek.com'],
      defaultEnabled: true,
      match: () => /chat\.deepseek\.com/i.test(window.location.hostname),
      getInput: () => {
        return document.querySelector('#chat-input, textarea[placeholder*="DeepSeek"], textarea');
      },
      getSendButton: () => {
        return document.querySelector('div[role="button"][aria-disabled="false"]:has(svg), button[type="submit"], div.send-btn');
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('.ds-markdown, div[class*="assistant-message"], div[class*="chat-message"]');
      },
      injectionMode: 'standard-input',
    },
    // 5. Open WebUI / Ollama Adapter
    {
      name: 'Open WebUI',
      id: 'openwebui',
      urlPatterns: ['localhost:8080', '*openwebui*', 'openwebui.*'],
      defaultEnabled: true,
      match: () => /openwebui/i.test(window.location.hostname) || (window.location.port === '8080' && Boolean(document.querySelector('#chat-textarea, #chat-input'))),
      getInput: () => {
        return document.querySelector('#chat-textarea, textarea[placeholder*="Ask"], #chat-input, textarea');
      },
      getSendButton: () => {
        return document.querySelector('#send-message-button, button[type="submit"]');
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('.chat-message, div[id*="message-"], .message-content, [data-role="assistant"]');
      },
      injectionMode: 'standard-input',
    },
    // 6. LibreChat Adapter
    {
      name: 'LibreChat',
      id: 'librechat',
      urlPatterns: ['localhost:3080', '*librechat*'],
      defaultEnabled: false,
      match: () => /librechat/i.test(window.location.hostname) || window.location.port === '3080',
      getInput: () => {
        return document.querySelector('#prompt-textarea, textarea[data-id*="root"]');
      },
      getSendButton: () => {
        return document.querySelector('button[data-testid="send-button"], button[type="submit"]');
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('div[data-testid*="message-assistant"], .text-message');
      },
      injectionMode: 'react-setter',
    },
    // 7. Dify.ai Chat Adapter
    {
      name: 'Dify.ai',
      id: 'dify',
      urlPatterns: ['cloud.dify.ai', '*dify*'],
      defaultEnabled: false,
      match: () => /dify/i.test(window.location.hostname) || /cloud\.dify\.ai/i.test(window.location.hostname),
      getInput: () => {
        return document.querySelector('textarea[placeholder*="Talk"], textarea');
      },
      getSendButton: () => {
        return document.querySelector('button:has(svg), button[type="submit"]');
      },
      getMessageCandidates: () => {
        return document.querySelectorAll('.chat-answer-container, div[class*="answerContainer"]');
      },
      injectionMode: 'react-setter',
    },
  ];

  // Helper: Wildcard / URL matcher
  function matchUrlPattern(pattern, url, hostname) {
    if (!pattern) return false;
    const trimmed = pattern.trim();
    if (!trimmed) return false;

    // Check exact or substring domain
    if (hostname && (hostname === trimmed || hostname.endsWith('.' + trimmed))) {
      return true;
    }

    try {
      // Convert wildcard pattern to regex
      const escaped = trimmed
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${escaped}$`, 'i');
      return regex.test(url) || regex.test(hostname) || url.includes(trimmed);
    } catch (e) {
      return url.includes(trimmed);
    }
  }

  // Determine if current page is in user-allowed URL list
  function evaluateUrlPermission() {
    const currentUrl = window.location.href;
    const currentHost = window.location.hostname;

    // 1. Check Presets
    for (const preset of PRESET_ADAPTERS) {
      const isEnabled = config.presetToggles?.[preset.id] !== undefined
        ? config.presetToggles[preset.id]
        : preset.defaultEnabled;

      if (isEnabled) {
        const matchesPattern = preset.urlPatterns.some((pat) => matchUrlPattern(pat, currentUrl, currentHost));
        const matchesDom = typeof preset.match === 'function' && preset.match();
        if (matchesPattern || matchesDom) {
          return {
            allowed: true,
            type: 'preset',
            adapter: preset,
            name: preset.name,
          };
        }
      }
    }

    // 2. Check Custom Sites
    if (Array.isArray(config.customSites)) {
      for (const site of config.customSites) {
        if (site.enabled && site.urlPattern) {
          const patterns = site.urlPattern.split(',').map((s) => s.trim()).filter(Boolean);
          const matched = patterns.some((p) => matchUrlPattern(p, currentUrl, currentHost));
          if (matched) {
            return {
              allowed: true,
              type: 'custom',
              name: site.name || '사내 Custom LLM',
              adapter: {
                name: site.name || '사내 Custom LLM',
                id: site.id || 'custom',
                getInput: () => {
                  if (site.inputSelector) {
                    try {
                      const el = document.querySelector(site.inputSelector);
                      if (el) return el;
                    } catch (e) {}
                  }
                  return document.querySelector('textarea, div[contenteditable="true"][role="textbox"], input[type="text"]');
                },
                getSendButton: () => {
                  if (site.sendSelector) {
                    try {
                      const el = document.querySelector(site.sendSelector);
                      if (el && !isStopButton(el) && !el.disabled) return el;
                    } catch (e) {}
                  }
                  return document.querySelector('button[type="submit"], button[aria-label*="send" i], button.send-btn');
                },
                getMessageCandidates: () => {
                  if (site.messageSelector) {
                    try {
                      const nodes = document.querySelectorAll(site.messageSelector);
                      if (nodes.length > 0) return nodes;
                    } catch (e) {}
                  }
                  return document.querySelectorAll('.assistant-message, .bot-message, div[data-role="assistant"], pre, code-block');
                },
                injectionMode: site.injectionMode || 'react-setter',
              },
            };
          }
        }
      }
    }

    // 3. Fallback Legacy Custom Pattern
    if (config.customUrlPattern) {
      const patterns = config.customUrlPattern.split(',').map((s) => s.trim()).filter(Boolean);
      const matched = patterns.some((p) => matchUrlPattern(p, currentUrl, currentHost));
      if (matched) {
        return {
          allowed: true,
          type: 'custom-legacy',
          name: '사내 Custom LLM (Legacy)',
          adapter: {
            name: '사내 Custom LLM',
            id: 'custom_legacy',
            getInput: () => {
              if (config.customInputSelector) {
                try {
                  const el = document.querySelector(config.customInputSelector);
                  if (el) return el;
                } catch (e) {}
              }
              return document.querySelector('textarea, div[contenteditable="true"][role="textbox"], input[type="text"]');
            },
            getSendButton: () => {
              if (config.customSendSelector) {
                try {
                  const el = document.querySelector(config.customSendSelector);
                  if (el && !isStopButton(el) && !el.disabled) return el;
                } catch (e) {}
              }
              return document.querySelector('button[type="submit"], button[aria-label*="send" i], button.send-btn');
            },
            getMessageCandidates: () => {
              if (config.customMessageSelector) {
                try {
                  const nodes = document.querySelectorAll(config.customMessageSelector);
                  if (nodes.length > 0) return nodes;
                } catch (e) {}
              }
              return document.querySelectorAll('.assistant-message, .bot-message, div[data-role="assistant"], pre, code-block');
            },
            injectionMode: config.customInjectionMode || 'react-setter',
          },
        };
      }
    }

    return { allowed: false };
  }

  function getActiveAdapter() {
    const perm = evaluateUrlPermission();
    if (perm.allowed && perm.adapter) {
      return perm.adapter;
    }
    // Fallback heuristic adapter
    return {
      name: 'Generic LLM Chat',
      id: 'generic',
      getInput: () => document.querySelector('textarea, div[contenteditable="true"][role="textbox"]'),
      getSendButton: () => document.querySelector('button[type="submit"], button.send-button, button:has(svg)'),
      getMessageCandidates: () => document.querySelectorAll('.assistant-message, [data-role="assistant"], .message'),
      injectionMode: 'react-setter',
    };
  }

  // --- SMART DOM TEXT INJECTION ENGINE ---
  /**
   * Sets text into any web input (React Controlled, Vue, ContentEditable, Quill, ProseMirror)
   */
  function injectTextIntoElement(targetEl, text, mode) {
    if (!targetEl) return false;
    targetEl.focus();

    const tagName = targetEl.tagName.toLowerCase();
    const isInputOrTextarea = tagName === 'textarea' || tagName === 'input';

    if (isInputOrTextarea) {
      // 1. React 16+ Controlled Input Hack (Bypasses React's internal valueTracker)
      try {
        const proto = tagName === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(targetEl, text);
        } else {
          targetEl.value = text;
        }
      } catch (e) {
        targetEl.value = text;
      }

      // Dispatch event chain for React/Vue/Angular
      targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      targetEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
      return true;
    }

    // For ContentEditable / Rich Text (Gemini, Claude, ProseMirror, Slate)
    // Method A: ClipboardEvent paste simulation
    let pasteSuccess = false;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dt,
      });
      pasteSuccess = targetEl.dispatchEvent(pasteEvent);
    } catch (e) {
      pasteSuccess = false;
    }

    // Method B: Fallback Paragraph node builder for Quill/Gemini
    const currentLen = (targetEl.innerText || targetEl.textContent || '').trim().length;
    if (currentLen < text.trim().length / 2) {
      const lines = text.split('\n');
      const htmlLines = lines.map(line => {
        if (!line.trim()) return '<p><br></p>';
        const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<p>${escaped}</p>`;
      }).join('');
      targetEl.innerHTML = htmlLines;
    }

    targetEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, composed: true, inputType: 'insertFromPaste', data: text }));
    targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    targetEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    return true;
  }

  function isStopButton(btn) {
    if (!btn) return false;
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    const text = (btn.textContent || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();
    return label.includes('중지') || label.includes('stop') || label.includes('pause') || label.includes('cancel') ||
           text.includes('중지') || text.includes('stop') || title.includes('중지') || title.includes('stop');
  }

  function injectAndSubmitPrompt(text) {
    const adapter = getActiveAdapter();
    const input = adapter.getInput();
    if (!input) {
      showHUDNotification('⚠️ 입력창을 찾을 수 없습니다. [🎯 DOM 선택기]로 지정하세요.', 'error');
      return false;
    }

    const ok = injectTextIntoElement(input, text, adapter.injectionMode);
    if (!ok) return false;

    let hasSubmitted = false;
    const timeouts = [];
    const clearAllTimeouts = () => { timeouts.forEach(t => clearTimeout(t)); timeouts.length = 0; };

    const trySubmit = () => {
      if (hasSubmitted) return;
      const sendBtn = adapter.getSendButton();
      if (sendBtn && !isStopButton(sendBtn)) {
        hasSubmitted = true;
        clearAllTimeouts();
        console.log('🚀 [Universal Agent] Clicking verified Send Button:', sendBtn);
        sendBtn.click();
        return;
      }
    };

    [150, 350, 600].forEach((delay) => {
      timeouts.push(setTimeout(trySubmit, delay));
    });

    // Fallback: Dispatch Enter Key
    timeouts.push(setTimeout(() => {
      if (hasSubmitted) return;
      const sendBtn = adapter.getSendButton();
      if (sendBtn && !isStopButton(sendBtn)) {
        hasSubmitted = true;
        sendBtn.click();
        return;
      }

      console.log('🚀 [Universal Agent] Fallback Enter submission');
      hasSubmitted = true;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
    }, 900));

    return true;
  }

  // --- BUSY / DEADLOCK STATE MANAGEMENT ---
  function setBusyState(isBusy, callId = null, command = null, args = null, startedAt = Date.now(), phase = 'VS Code 작업 시작 중...') {
    busyState.isBusy = isBusy;
    busyState.callId = callId;
    busyState.command = command;
    busyState.startedAt = startedAt;
    busyState.lastHeartbeatAt = Date.now();
    busyState.phase = phase;
    busyState.isStalled = false;

    if (args && typeof args === 'object') {
      busyState.argsSummary = Object.keys(args).map(k => `${k}: ${JSON.stringify(args[k])}`).join(', ').substring(0, 70);
    } else {
      busyState.argsSummary = '';
    }

    if (isBusy) {
      startBusyTicker();
    } else {
      stopBusyTicker();
    }
    renderBusyUI();
  }

  function startBusyTicker() {
    stopBusyTicker();
    busyTickerInterval = setInterval(() => {
      if (!busyState.isBusy) return;
      const elapsedSec = Math.floor((Date.now() - busyState.startedAt) / 1000);
      const heartbeatDiff = Date.now() - busyState.lastHeartbeatAt;
      busyState.isStalled = elapsedSec >= 35 || (elapsedSec > 8 && heartbeatDiff > 6000);
      renderBusyUI();
    }, 500);
  }

  function stopBusyTicker() {
    if (busyTickerInterval) {
      clearInterval(busyTickerInterval);
      busyTickerInterval = null;
    }
  }

  function renderBusyUI() {
    const busyPanel = document.getElementById('hud-busy-panel');
    const busyBadge = document.getElementById('hud-header-busy-badge');
    const timerLabel = document.getElementById('hud-busy-timer');
    const cmdLabel = document.getElementById('hud-busy-command');
    const phaseLabel = document.getElementById('hud-busy-phase');
    const healthBadge = document.getElementById('hud-busy-health-badge');
    const deadlockMsg = document.getElementById('hud-busy-deadlock-msg');

    if (!busyPanel) return;
    if (!busyState.isBusy) {
      busyPanel.style.display = 'none';
      if (busyBadge) busyBadge.style.display = 'none';
      return;
    }

    busyPanel.style.display = 'block';
    if (busyBadge) busyBadge.style.display = 'inline-flex';

    const elapsedSec = Math.max(0, Math.floor((Date.now() - busyState.startedAt) / 1000));
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    const timeFormatted = `${mins}:${secs}`;

    if (timerLabel) timerLabel.textContent = timeFormatted;
    if (busyBadge) busyBadge.textContent = `⚡ Busy (${timeFormatted})`;
    if (cmdLabel) cmdLabel.textContent = `${busyState.command || 'tool_call'}${busyState.argsSummary ? ` (${busyState.argsSummary})` : ''}`;
    if (phaseLabel) phaseLabel.textContent = busyState.phase || 'VS Code에서 실행 중...';

    if (healthBadge && deadlockMsg) {
      if (busyState.isStalled) {
        healthBadge.textContent = '⚠️ 데드락 / 무응답 의심';
        healthBadge.className = 'hud-health-badge danger';
        deadlockMsg.style.display = 'block';
        deadlockMsg.innerHTML = `⚠️ <b>작업이 ${elapsedSec}초 동안 지속 중입니다.</b><br/>필요시 작업을 중단하세요.`;
      } else if (elapsedSec >= 15) {
        healthBadge.textContent = '⏳ 장시간 실행 중';
        healthBadge.className = 'hud-health-badge warning';
        deadlockMsg.style.display = 'block';
        deadlockMsg.innerHTML = `빌드 또는 패키지 설치가 진행 중입니다 (${elapsedSec}s).`;
      } else {
        healthBadge.textContent = '🟢 정상 실행 중';
        healthBadge.className = 'hud-health-badge ok';
        deadlockMsg.style.display = 'none';
      }
    }
  }

  function sendAbortRequest(callId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showHUDNotification('⚠️ Bridge 연결이 없습니다.', 'error');
      return;
    }
    const payload = {
      type: 'agent:abort',
      command: 'agent:abort',
      id: callId || busyState.callId || 'all',
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(payload));
    showHUDNotification(`⏹️ [중단 신호 전송] ID: ${payload.id}`);
    setBusyState(false);
  }

  // --- DEDUPLICATION ENGINE ---
  const processedNodes = new WeakSet();
  const recentCallSignatures = [];
  const MAX_SIGNATURE_CACHE = 40;

  function markCallAsExecuted(node, callId, command, args) {
    if (node) {
      processedNodes.add(node);
      if (node.setAttribute) node.setAttribute('data-web-agent-executed', 'true');
      const parent = node.closest && node.closest('[class*="message"], [class*="response"], div[data-message-author-role]');
      if (parent) {
        processedNodes.add(parent);
        if (parent.setAttribute) parent.setAttribute('data-web-agent-executed', 'true');
      }
    }
    const sig = `${callId}::${command}::${JSON.stringify(args || {})}`;
    if (!recentCallSignatures.includes(sig)) {
      recentCallSignatures.push(sig);
      if (recentCallSignatures.length > MAX_SIGNATURE_CACHE) recentCallSignatures.shift();
    }
  }

  function isCallAlreadyExecuted(node, callId, command, args) {
    if (node && node.hasAttribute && node.hasAttribute('data-web-agent-executed')) return true;
    if (node && processedNodes.has(node)) return true;
    if (node && node.closest && node.closest('[data-web-agent-executed="true"]')) return true;
    const sig = `${callId}::${command}::${JSON.stringify(args || {})}`;
    return recentCallSignatures.includes(sig);
  }

  // --- TOOL CALL SCANNER & JSON PARSER ---
  function extractJSONObjectsFromText(text, element) {
    if (!text || (!text.includes('agent_action') && !text.includes('command'))) return [];
    const results = [];

    const tryRegister = (obj) => {
      if (obj && typeof obj === 'object') {
        if ((obj.agent_action === 'tool_call' || obj.command) && obj.id) {
          results.push(obj);
          return true;
        }
      }
      return false;
    };

    // Strategy 1: Code blocks
    if (element && element.querySelectorAll) {
      const codeNodes = element.querySelectorAll('pre, code, code-block, .code-block');
      for (const node of codeNodes) {
        const rawCode = (node.innerText || node.textContent || '').trim();
        if (rawCode.startsWith('{') && rawCode.endsWith('}')) {
          try {
            const parsed = JSON.parse(rawCode);
            if (tryRegister(parsed)) return results;
          } catch (e) {}
        }
      }
    }

    // Strategy 2: Markdown regex
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const codeContent = match[1].trim();
      const firstB = codeContent.indexOf('{');
      const lastB = codeContent.lastIndexOf('}');
      if (firstB !== -1 && lastB > firstB) {
        try {
          const parsed = JSON.parse(codeContent.substring(firstB, lastB + 1));
          if (tryRegister(parsed)) continue;
        } catch (e) {}
      }
    }

    if (results.length > 0) return results;

    // Strategy 3: Greedy brace scanner
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
        if (tryRegister(parsed)) return results;
      } catch (e) {}
    }

    return results;
  }

  function scanPageForToolCalls() {
    const adapter = getActiveAdapter();
    const candidates = adapter.getMessageCandidates();

    candidates.forEach((el) => {
      if (el.closest('#universal-agent-hud, rich-textarea, form, .input-area, [class*="user"]')) return;
      const text = (el.innerText || el.textContent || '').trim();
      if (!text.includes('agent_action') && !text.includes('command')) return;

      const jsonObjects = extractJSONObjectsFromText(text, el);
      if (jsonObjects.length > 0) {
        jsonObjects.forEach((data) => {
          if ((data.agent_action === 'tool_call' || data.command) && data.id) {
            if (isCallAlreadyExecuted(el, data.id, data.command, data.args)) return;
            markCallAsExecuted(el, data.id, data.command, data.args);

            // While disconnected, mark historical tool calls without executing or notifying
            if (!wsConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

            console.log('⚡ [Universal Agent] Detected Tool Call:', data);
            showHUDNotification(`⚡ 도구 감지: ${data.command} (${data.id})`);
            executeToolCall(data);
          }
        });
      }
    });
  }

  function executeToolCall(toolCall) {
    if (!wsConnected || !ws || ws.readyState !== WebSocket.OPEN) {
      showHUDNotification('⚠️ Bridge 서버(:9999)에 연결되어 있지 않습니다.', 'error');
      return;
    }

    const payload = {
      agent_action: 'tool_call',
      type: 'tool_call',
      id: toolCall.id,
      command: toolCall.command,
      args: toolCall.args || {},
      platform: getActiveAdapter().name,
      timestamp: Date.now(),
    };

    setBusyState(true, toolCall.id, toolCall.command, toolCall.args, Date.now(), 'VS Code로 전달 및 실행 대기 중...');
    ws.send(JSON.stringify(payload));
  }

  function updateConnectButtonCaption() {
    const btn = document.getElementById('hud-reconnect-btn');
    if (!btn) return;
    btn.textContent = hasConnectedOnce ? '재연결' : '연결';
  }

  // --- WEBSOCKET BRIDGE CONNECTION ---
  function initBridgeConnection() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      try { ws.close(); } catch (e) {}
    }

    updateHUDStatus('connecting', 'Bridge 연결 중...');
    try {
      ws = new WebSocket(config.wsUrl || 'ws://localhost:9999');

      ws.onopen = () => {
        wsConnected = true;
        hasConnectedOnce = true;
        updateConnectButtonCaption();
        const adapter = getActiveAdapter();
        updateHUDStatus('connected', `Bridge 연결됨 (${adapter.name})`);
        ws.send(JSON.stringify({
          type: 'register',
          client: 'universal-web-extension',
          platform: adapter.name,
          url: window.location.href,
        }));
        showHUDNotification('🟢 Bridge 서버에 연결되었습니다.');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleBridgeMessage(msg);
        } catch (e) {}
      };

      ws.onclose = () => {
        wsConnected = false;
        updateHUDStatus('disconnected', hasConnectedOnce ? 'Bridge 연결 끊김' : 'Bridge 미연결 (연결 대기)');
      };

      ws.onerror = () => {
        wsConnected = false;
        updateHUDStatus('error', 'Bridge 서버 없음 (:9999)');
      };
    } catch (err) {
      wsConnected = false;
      updateHUDStatus('error', '연결 실패 (:9999)');
    }
  }

  function handleBridgeMessage(msg) {
    if (msg.type === 'agent:busy' || msg.state === 'busy') {
      setBusyState(true, msg.id, msg.command, msg.argsSummary, msg.startedAt || Date.now(), msg.phase || 'VS Code 작업 진행 중...');
      return;
    }

    if (msg.type === 'agent:heartbeat') {
      busyState.lastHeartbeatAt = msg.heartbeatTimestamp || Date.now();
      if (msg.phase) busyState.phase = msg.phase;
      renderBusyUI();
      return;
    }

    if (msg.type === 'agent:idle' || msg.state === 'idle') {
      setBusyState(false);
      return;
    }

    if (msg.type === 'agent:aborted') {
      setBusyState(false);
      showHUDNotification(`⏹️ VS Code 작업 중단 완료 (${msg.id || 'all'})`);
      return;
    }

    if (msg.agent_response === 'tool_result' || msg.type === 'tool_result') {
      setBusyState(false);
      const resultText = `[Tool Execution Result]
ID: ${msg.id || 'N/A'}
Status: ${msg.status || 'success'}
${msg.result ? `Output:\n${typeof msg.result === 'object' ? JSON.stringify(msg.result, null, 2) : msg.result}` : ''}
${msg.error ? `Error:\n${msg.error}` : ''}

위 실행 결과를 확인하시고, 다음 단계의 작업(도구 호출 또는 최종 안내)을 이어서 진행해주세요.`;

      showHUDNotification(`✅ VS Code 응답 수신: ${msg.command || msg.id || 'tool'} (${msg.status || 'OK'})`);

      if (config.autoSubmitResult !== false) {
        injectAndSubmitPrompt(resultText);
      } else {
        const adapter = getActiveAdapter();
        injectTextIntoElement(adapter.getInput(), resultText, adapter.injectionMode);
      }
    }
  }

  // --- INTERACTIVE VISUAL DOM ELEMENT PICKER ---
  function startElementPicker(targetType) {
    pickerMode = targetType;
    showHUDNotification(`🎯 [DOM 선택기] 화면에서 ${targetType === 'input' ? '입력창(Input)' : targetType === 'send' ? '전송 버튼(Send Button)' : '답변 박스(Message)'}을 클릭하세요!`);

    document.addEventListener('mouseover', handlePickerMouseOver, true);
    document.addEventListener('click', handlePickerClick, true);
    document.body.style.cursor = 'crosshair';
  }

  function handlePickerMouseOver(e) {
    if (!pickerMode) return;
    if (e.target.closest('#universal-agent-hud')) return;

    if (hoveredElement && hoveredElement !== e.target) {
      hoveredElement.style.outline = '';
    }
    hoveredElement = e.target;
    hoveredElement.style.outline = '2px solid #38bdf8';
  }

  function handlePickerClick(e) {
    if (!pickerMode) return;
    if (e.target.closest('#universal-agent-hud')) return;

    e.preventDefault();
    e.stopPropagation();

    if (hoveredElement) {
      hoveredElement.style.outline = '';
    }

    const selector = generateOptimalSelector(e.target);
    console.log(`🎯 [DOM Picker] Selected ${pickerMode}:`, selector, e.target);

    if (pickerMode === 'input') {
      config.customInputSelector = selector;
    } else if (pickerMode === 'send') {
      config.customSendSelector = selector;
    } else if (pickerMode === 'message') {
      config.customMessageSelector = selector;
    }

    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set(config);
    }

    showHUDNotification(`✅ ${pickerMode} 선택자 등록 완료: ${selector}`);

    // Cleanup
    document.removeEventListener('mouseover', handlePickerMouseOver, true);
    document.removeEventListener('click', handlePickerClick, true);
    document.body.style.cursor = 'default';
    pickerMode = null;
    hoveredElement = null;
  }

  function generateOptimalSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
    if (el.getAttribute('name')) return `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
    if (el.getAttribute('aria-label')) return `${el.tagName.toLowerCase()}[aria-label*="${el.getAttribute('aria-label')}"]`;
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.split(' ').filter(c => c && !c.includes(':') && !c.startsWith('hover'))[0];
      if (firstClass) return `.${firstClass}`;
    }
    return el.tagName.toLowerCase();
  }

  // --- FLOATING HUD UI ---
  function createAgentHUD(container) {
    if (document.getElementById('universal-agent-hud')) return;

    const currentAdapter = getActiveAdapter();
    const hud = document.createElement('div');
    hud.id = 'universal-agent-hud';
    hud.innerHTML = `
      <style>
        #universal-agent-hud {
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          z-index: 2147483647 !important;
          background: #0f172a !important;
          color: #f1f5f9 !important;
          border: 1px solid #334155 !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 32px rgba(0,0,0,0.8), 0 0 16px rgba(59, 130, 246, 0.25) !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 12px !important;
          width: 350px !important;
          overflow: hidden !important;
          display: block !important;
        }
        #hud-header {
          padding: 10px 14px;
          background: #090d16;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1e293b;
          cursor: pointer;
        }
        .hud-platform-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border: 1px solid #3b82f6;
        }
        .hud-body {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .hud-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hud-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ef4444;
        }
        .hud-dot.connected { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .hud-dot.connecting { background: #f59e0b; }
        .hud-btn-group {
          display: flex;
          gap: 6px;
        }
        .hud-btn {
          flex: 1;
          padding: 7px 10px;
          background: #1e293b;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.15s;
        }
        .hud-btn:hover { background: #334155; }
        .hud-btn.primary { background: #2563eb; color: #fff; border-color: #3b82f6; }
        .hud-btn.picker { background: #7c3aed; color: #fff; border-color: #8b5cf6; }
        .hud-toast {
          font-size: 11px;
          color: #fdba74;
          background: #090d16;
          padding: 6px 8px;
          border-radius: 6px;
          display: none;
          line-height: 1.4;
        }
        /* Busy Box */
        #hud-busy-panel {
          background: #1e293b;
          border: 1px solid #475569;
          border-radius: 8px;
          padding: 10px;
          display: none;
        }
        .hud-busy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .hud-busy-timer {
          font-family: monospace;
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
        }
        .hud-health-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .hud-health-badge.ok { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .hud-health-badge.warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .hud-health-badge.danger { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .hud-deadlock-alert {
          margin-top: 6px;
          padding: 6px;
          border-radius: 4px;
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          font-size: 10.5px;
          display: none;
        }
        .hud-abort-btn {
          margin-top: 6px;
          width: 100%;
          padding: 6px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
      <div id="hud-header">
        <div style="display:flex; align-items:center; gap:6px;">
          <span>🤖</span>
          <span style="font-weight:700;">VS Code Agent Bridge</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="hud-platform-tag" id="hud-platform-tag">${currentAdapter.name}</span>
          <span id="hud-toggle-icon">▾</span>
        </div>
      </div>
      <div class="hud-body" id="hud-body">
        <div class="hud-status-row">
          <div id="hud-status-dot" class="hud-dot"></div>
          <span id="hud-status-text" style="font-weight:500;">Bridge 미연결 (연결 대기)</span>
        </div>

        <div id="hud-busy-panel">
          <div class="hud-busy-header">
            <span id="hud-busy-health-badge" class="hud-health-badge ok">🟢 정상 실행 중</span>
            <span id="hud-busy-timer" class="hud-busy-timer">00:00</span>
          </div>
          <div style="font-weight:600; font-size:11px; margin-top:2px;" id="hud-busy-command">tool:exec</div>
          <div style="font-size:10px; color:#94a3b8;" id="hud-busy-phase">작업 진행 중...</div>
          <div id="hud-busy-deadlock-msg" class="hud-deadlock-alert"></div>
          <button id="hud-abort-task-btn" class="hud-abort-btn">⏹️ 작업 강제 중단 (Abort)</button>
        </div>

        <div id="hud-toast" class="hud-toast"></div>

        <div class="hud-btn-group">
          <button id="hud-inject-bootstrap-btn" class="hud-btn primary" title="개발 에이전트 시스템 프롬프트를 전송합니다">부트스트랩 전송</button>
          <button id="hud-fill-only-btn" class="hud-btn">입력창 채우기</button>
        </div>

        <!-- Custom Enterprise DOM Picker Group -->
        <div class="hud-btn-group">
          <button id="hud-pick-input-btn" class="hud-btn picker" title="사내 웹 챗의 입력창을 클릭하여 지정합니다">🎯 입력창 선택</button>
          <button id="hud-pick-send-btn" class="hud-btn picker" title="사내 웹 챗의 전송 버튼을 클릭하여 지정합니다">🎯 전송버튼 선택</button>
        </div>

        <div class="hud-btn-group">
          <button id="hud-reconnect-btn" class="hud-btn" style="flex:1;">연결</button>
        </div>
      </div>
    `;

    container.appendChild(hud);

    // Event listeners
    document.getElementById('hud-inject-bootstrap-btn')?.addEventListener('click', () => {
      showHUDNotification('부트스트랩 프롬프트를 전송합니다...');
      injectAndSubmitPrompt(BOOTSTRAP_PROMPT);
    });

    document.getElementById('hud-fill-only-btn')?.addEventListener('click', () => {
      const adapter = getActiveAdapter();
      injectTextIntoElement(adapter.getInput(), BOOTSTRAP_PROMPT, adapter.injectionMode);
      showHUDNotification('입력창에 프롬프트를 채웠습니다.');
    });

    document.getElementById('hud-reconnect-btn')?.addEventListener('click', () => {
      initBridgeConnection();
    });

    document.getElementById('hud-abort-task-btn')?.addEventListener('click', () => {
      sendAbortRequest(busyState.callId);
    });

    document.getElementById('hud-pick-input-btn')?.addEventListener('click', () => {
      startElementPicker('input');
    });

    document.getElementById('hud-pick-send-btn')?.addEventListener('click', () => {
      startElementPicker('send');
    });

    const header = document.getElementById('hud-header');
    const body = document.getElementById('hud-body');
    let isCollapsed = false;
    header?.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      body.style.display = isCollapsed ? 'none' : 'flex';
      document.getElementById('hud-toggle-icon').textContent = isCollapsed ? '▴' : '▾';
    });
  }

  function updateHUDStatus(state, text) {
    const dot = document.getElementById('hud-status-dot');
    const label = document.getElementById('hud-status-text');
    if (!dot || !label) return;
    dot.className = `hud-dot ${state}`;
    label.textContent = text;
  }

  function showHUDNotification(text) {
    const toast = document.getElementById('hud-toast');
    if (!toast) return;
    toast.style.display = 'block';
    toast.textContent = text;
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
  }

  let hasLoggedInactiveNotice = false;

  function unmountHUD() {
    const hud = document.getElementById('universal-agent-hud');
    if (hud) {
      hud.remove();
    }
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
    }
    cleanDisconnect();
  }

  function syncHUDStateWithPermissions() {
    const perm = evaluateUrlPermission();
    isPageAllowed = perm.allowed;

    if (isPageAllowed) {
      hasLoggedInactiveNotice = false;
      const existingHUD = document.getElementById('universal-agent-hud');
      if (!existingHUD) {
        const target = document.body || document.documentElement;
        if (target) {
          createAgentHUD(target);
          console.log(`%c✨ [Universal Web AI Agent] HUD Active for: ${perm.name}`, 'background: #065f46; color: #a7f3d0; padding: 3px 6px; border-radius: 4px;');
        }
      }
      if (!scanIntervalId) {
        scanIntervalId = setInterval(scanPageForToolCalls, 700);
      }
    } else {
      unmountHUD();
      if (!hasLoggedInactiveNotice) {
        console.log(`%cℹ️ [Universal Web AI Agent] Inactive on this URL (${window.location.hostname}). To enable, check Extension Options > Allowed Sites.`, 'background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 4px;');
        hasLoggedInactiveNotice = true;
      }
    }
  }

  // Load configuration from sync storage (do not auto-connect on load/refresh)
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.get(config, (items) => {
      if (items) {
        Object.assign(config, items);
        if (items.presetToggles) config.presetToggles = { ...config.presetToggles, ...items.presetToggles };
        if (Array.isArray(items.customSites)) config.customSites = items.customSites;
      }
      syncHUDStateWithPermissions();
    });

    // Listen for live changes from Options page
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (const [key, change] of Object.entries(changes)) {
          config[key] = change.newValue;
        }
        syncHUDStateWithPermissions();
      }
    });
  } else {
    syncHUDStateWithPermissions();
  }

  // Observer
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncHUDStateWithPermissions();
    });
  } else {
    syncHUDStateWithPermissions();
  }

  // Explicitly close WebSocket connection on page unload/refresh (F5, navigation, tab close)
  const cleanDisconnect = () => {
    if (ws) {
      try {
        ws.close(1000, 'Page unloading/refreshing');
      } catch (e) {}
      ws = null;
      wsConnected = false;
    }
  };
  window.addEventListener('beforeunload', cleanDisconnect);
  window.addEventListener('pagehide', cleanDisconnect);

  const observer = new MutationObserver(() => {
    if (isPageAllowed) {
      const existingHUD = document.getElementById('universal-agent-hud');
      if (!existingHUD) {
        const target = document.body || document.documentElement;
        if (target) createAgentHUD(target);
      }
      scanPageForToolCalls();
    }
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
})();

