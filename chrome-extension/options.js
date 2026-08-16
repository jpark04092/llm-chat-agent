// Default Presets Configuration
const PRESET_ADAPTERS = [
  {
    id: 'gemini',
    name: 'Google Gemini & AI Studio',
    tag: 'Official',
    tagClass: 'official',
    urlDisplay: 'gemini.google.com, aistudio.google.com',
    urlPatterns: ['gemini.google.com', 'aistudio.google.com'],
    defaultEnabled: true,
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT',
    tag: 'Official',
    tagClass: 'official',
    urlDisplay: 'chatgpt.com, chat.openai.com',
    urlPatterns: ['chatgpt.com', 'chat.openai.com'],
    defaultEnabled: true,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude.ai',
    tag: 'Official',
    tagClass: 'official',
    urlDisplay: 'claude.ai',
    urlPatterns: ['claude.ai'],
    defaultEnabled: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Chat',
    tag: 'Popular',
    tagClass: 'popular',
    urlDisplay: 'chat.deepseek.com',
    urlPatterns: ['chat.deepseek.com'],
    defaultEnabled: true,
  },
  {
    id: 'openwebui',
    name: 'Open WebUI (Ollama / Local LLM)',
    tag: 'Self-Hosted',
    tagClass: 'self-hosted',
    urlDisplay: 'localhost:8080, *openwebui*',
    urlPatterns: ['localhost:8080', '*openwebui*'],
    defaultEnabled: true,
  },
  {
    id: 'librechat',
    name: 'LibreChat',
    tag: 'Self-Hosted',
    tagClass: 'self-hosted',
    urlDisplay: 'localhost:3080, *librechat*',
    urlPatterns: ['localhost:3080', '*librechat*'],
    defaultEnabled: false,
  },
  {
    id: 'dify',
    name: 'Dify.ai Chat App',
    tag: 'Self-Hosted',
    tagClass: 'self-hosted',
    urlDisplay: 'cloud.dify.ai, *dify*',
    urlPatterns: ['cloud.dify.ai', '*dify*'],
    defaultEnabled: false,
  },
];

const PRESET_DOM_TEMPLATES = {
  openwebui: {
    urlPattern: '*://localhost:8080/*, *://*openwebui*/*',
    inputSelector: '#chat-textarea, textarea[placeholder*="Ask"], textarea',
    sendSelector: 'button#send-message-button, button[type="submit"]',
    messageSelector: '.chat-message, div[id*="message-"], .message-content',
    injectionMode: 'standard-input',
  },
  librechat: {
    urlPattern: '*://localhost:3080/*, *://*librechat*/*',
    inputSelector: '#prompt-textarea, textarea[data-id*="root"]',
    sendSelector: 'button[data-testid="send-button"], button[type="submit"]',
    messageSelector: 'div[data-testid*="message-assistant"], .text-message',
    injectionMode: 'react-setter',
  },
  dify: {
    urlPattern: '*://*dify*/*, *://cloud.dify.ai/*',
    inputSelector: 'textarea[placeholder*="Talk"], textarea',
    sendSelector: 'button:has(svg), button[type="submit"]',
    messageSelector: '.chat-answer-container, div[class*="answerContainer"]',
    injectionMode: 'react-setter',
  },
  fastgpt: {
    urlPattern: '*://*fastgpt*/*',
    inputSelector: 'textarea[placeholder*="输入"], textarea',
    sendSelector: 'button[type="submit"], button:has(svg)',
    messageSelector: '.chat-box-card, div[class*="ChatBox"]',
    injectionMode: 'react-setter',
  },
  chainlit: {
    urlPattern: '*://*chainlit*/*, *://localhost:8000/*',
    inputSelector: '#chat-input, textarea',
    sendSelector: '#chat-submit, button[type="submit"]',
    messageSelector: '.step-assistant, .message-content',
    injectionMode: 'react-setter',
  },
  nextchat: {
    urlPattern: '*://*nextchat*/*, *://*chatgpt-next-web*/*',
    inputSelector: '.chat-input textarea, textarea',
    sendSelector: '.chat-input-action button, button[type="submit"]',
    messageSelector: '.chat-message-item, .chat-message-assistant',
    injectionMode: 'react-setter',
  },
  'react-enterprise': {
    urlPattern: '*://*.internal/*, *://localhost:*/*',
    inputSelector: 'textarea, input[type="text"], div[contenteditable="true"]',
    sendSelector: 'button[type="submit"], button[aria-label*="Send"], button.send-btn',
    messageSelector: '.assistant-message, .bot-response, div[data-role="assistant"]',
    injectionMode: 'react-setter',
  },
};

const DEFAULT_CONFIG = {
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
  activePreset: 'custom',
};

let currentConfig = { ...DEFAULT_CONFIG };

document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(`tab-${targetTab}`)?.classList.add('active');
    });
  });

  // Load stored settings
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...(items || {}),
        presetToggles: {
          ...DEFAULT_CONFIG.presetToggles,
          ...(items?.presetToggles || {}),
        },
        customSites: Array.isArray(items?.customSites) ? items.customSites : DEFAULT_CONFIG.customSites,
      };
      renderAll();
    });
  } else {
    renderAll();
  }

  function renderAll() {
    renderPresets();
    renderCustomSites();
    populateGeneralForm();
    populateCustomMappingTab();
  }

  function renderPresets() {
    const listEl = document.getElementById('preset-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    PRESET_ADAPTERS.forEach((preset) => {
      const isEnabled = currentConfig.presetToggles[preset.id] !== undefined
        ? currentConfig.presetToggles[preset.id]
        : preset.defaultEnabled;

      const item = document.createElement('div');
      item.className = `site-item ${isEnabled ? '' : 'disabled'}`;
      item.innerHTML = `
        <div class="site-info">
          <div class="site-header-line">
            <span class="site-name">${preset.name}</span>
            <span class="site-tag ${preset.tagClass}">${preset.tag}</span>
          </div>
          <div class="site-urls" title="${preset.urlDisplay}">🔗 ${preset.urlDisplay}</div>
        </div>
        <div class="site-actions">
          <label class="switch">
            <input type="checkbox" data-preset-id="${preset.id}" ${isEnabled ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        </div>
      `;

      const toggleInput = item.querySelector('input');
      toggleInput?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        currentConfig.presetToggles[preset.id] = checked;
        item.classList.toggle('disabled', !checked);
      });

      listEl.appendChild(item);
    });
  }

  function renderCustomSites() {
    const listEl = document.getElementById('custom-sites-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!currentConfig.customSites || currentConfig.customSites.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 12px; text-align: center; color: #64748b; font-size: 11.5px; border: 1px dashed #334155; border-radius: 8px;">
          등록된 사내 LLM 또는 커스텀 사이트가 없습니다. [➕ 새 사이트 추가] 버튼을 눌러 추가하세요.
        </div>
      `;
      return;
    }

    currentConfig.customSites.forEach((site, index) => {
      const item = document.createElement('div');
      item.className = `site-item ${site.enabled ? '' : 'disabled'}`;
      item.innerHTML = `
        <div class="site-info">
          <div class="site-header-line">
            <span class="site-name">${escapeHtml(site.name || '사내 Custom LLM')}</span>
            <span class="site-tag custom">Custom</span>
          </div>
          <div class="site-urls" title="${escapeHtml(site.urlPattern || '')}">🌐 ${escapeHtml(site.urlPattern || 'URL 패턴 미지정')}</div>
        </div>
        <div class="site-actions">
          <button type="button" class="btn-icon" data-edit-index="${index}" title="설정 수정">✏️</button>
          <button type="button" class="btn-icon danger" data-delete-index="${index}" title="삭제">🗑️</button>
          <label class="switch">
            <input type="checkbox" data-site-index="${index}" ${site.enabled ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        </div>
      `;

      // Toggle listener
      const toggleInput = item.querySelector(`input[data-site-index="${index}"]`);
      toggleInput?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        currentConfig.customSites[index].enabled = checked;
        item.classList.toggle('disabled', !checked);
      });

      // Edit listener
      item.querySelector(`button[data-edit-index="${index}"]`)?.addEventListener('click', () => {
        openEditCustomSiteForm(index);
      });

      // Delete listener
      item.querySelector(`button[data-delete-index="${index}"]`)?.addEventListener('click', () => {
        if (confirm(`'${site.name}' 사이트를 목록에서 삭제하시겠습니까?`)) {
          currentConfig.customSites.splice(index, 1);
          renderCustomSites();
        }
      });

      listEl.appendChild(item);
    });
  }

  function populateGeneralForm() {
    const wsUrlEl = document.getElementById('wsUrl');
    if (wsUrlEl) wsUrlEl.value = currentConfig.wsUrl || 'ws://localhost:9999';

    const policyRadio = document.querySelector(`input[name="approvalPolicy"][value="${currentConfig.approvalPolicy || 'safety'}"]`);
    if (policyRadio) policyRadio.checked = true;

    const autoSubmitEl = document.getElementById('autoSubmitResult');
    if (autoSubmitEl) autoSubmitEl.checked = currentConfig.autoSubmitResult !== false;
  }

  function populateCustomMappingTab() {
    const patternEl = document.getElementById('customUrlPattern');
    if (patternEl) patternEl.value = currentConfig.customUrlPattern || '';

    const inputSelEl = document.getElementById('customInputSelector');
    if (inputSelEl) inputSelEl.value = currentConfig.customInputSelector || '';

    const sendSelEl = document.getElementById('customSendSelector');
    if (sendSelEl) sendSelEl.value = currentConfig.customSendSelector || '';

    const msgSelEl = document.getElementById('customMessageSelector');
    if (msgSelEl) msgSelEl.value = currentConfig.customMessageSelector || '';

    const injModeEl = document.getElementById('customInjectionMode');
    if (injModeEl) injModeEl.value = currentConfig.customInjectionMode || 'react-setter';

    const presetSel = document.getElementById('presetSelect');
    if (presetSel) presetSel.value = currentConfig.activePreset || 'custom';
  }

  // --- Custom Site Form Modal Handlers ---
  const formBox = document.getElementById('custom-site-form-box');
  const formTitle = document.getElementById('custom-form-title');
  const editIdInput = document.getElementById('editSiteId');
  const siteNameInput = document.getElementById('siteNameInput');
  const siteUrlPatternInput = document.getElementById('siteUrlPatternInput');
  const siteInputSelector = document.getElementById('siteInputSelector');
  const siteSendSelector = document.getElementById('siteSendSelector');
  const siteMessageSelector = document.getElementById('siteMessageSelector');
  const siteInjectionMode = document.getElementById('siteInjectionMode');
  const customDomDetails = document.getElementById('customDomDetails');

  document.getElementById('openAddCustomModalBtn')?.addEventListener('click', () => {
    editIdInput.value = '';
    formTitle.textContent = '➕ 새 허용 사이트 / 사내 LLM 등록';
    siteNameInput.value = '';
    siteUrlPatternInput.value = '';
    siteInputSelector.value = '';
    siteSendSelector.value = '';
    siteMessageSelector.value = '';
    siteInjectionMode.value = 'react-setter';
    formBox.style.display = 'block';
    siteNameInput.focus();
  });

  document.getElementById('closeCustomFormBtn')?.addEventListener('click', () => {
    formBox.style.display = 'none';
  });

  document.getElementById('cancelCustomSiteBtn')?.addEventListener('click', () => {
    formBox.style.display = 'none';
  });

  document.getElementById('toggleDomDetailsBtn')?.addEventListener('click', () => {
    if (customDomDetails) {
      customDomDetails.style.display = customDomDetails.style.display === 'none' ? 'block' : 'none';
    }
  });

  function openEditCustomSiteForm(index) {
    const site = currentConfig.customSites[index];
    if (!site) return;

    editIdInput.value = String(index);
    formTitle.textContent = `✏️ '${site.name}' 설정 수정`;
    siteNameInput.value = site.name || '';
    siteUrlPatternInput.value = site.urlPattern || '';
    siteInputSelector.value = site.inputSelector || '';
    siteSendSelector.value = site.sendSelector || '';
    siteMessageSelector.value = site.messageSelector || '';
    siteInjectionMode.value = site.injectionMode || 'react-setter';

    if (site.inputSelector || site.sendSelector || site.messageSelector) {
      customDomDetails.style.display = 'block';
    }

    formBox.style.display = 'block';
    siteNameInput.focus();
  }

  document.getElementById('saveCustomSiteBtn')?.addEventListener('click', () => {
    const name = siteNameInput.value.trim();
    const urlPattern = siteUrlPatternInput.value.trim();

    if (!name) {
      alert('사이트 명칭을 입력해주세요.');
      siteNameInput.focus();
      return;
    }
    if (!urlPattern) {
      alert('허용할 URL 패턴을 입력해주세요.');
      siteUrlPatternInput.focus();
      return;
    }

    const editIndex = editIdInput.value !== '' ? parseInt(editIdInput.value, 10) : -1;

    const siteData = {
      id: editIndex >= 0 ? currentConfig.customSites[editIndex].id : `custom_${Date.now()}`,
      name,
      urlPattern,
      enabled: editIndex >= 0 ? currentConfig.customSites[editIndex].enabled : true,
      inputSelector: siteInputSelector.value.trim(),
      sendSelector: siteSendSelector.value.trim(),
      messageSelector: siteMessageSelector.value.trim(),
      injectionMode: siteInjectionMode.value,
    };

    if (editIndex >= 0) {
      currentConfig.customSites[editIndex] = siteData;
    } else {
      currentConfig.customSites.push(siteData);
    }

    formBox.style.display = 'none';
    renderCustomSites();
    showToast('✅ 사이트가 목록에 반영되었습니다. 하단 [설정 저장] 버튼을 눌러 적용하세요.');
  });

  // Handle Preset selection in Tab 3
  document.getElementById('presetSelect')?.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (PRESET_DOM_TEMPLATES[selected]) {
      const p = PRESET_DOM_TEMPLATES[selected];
      document.getElementById('customUrlPattern').value = p.urlPattern;
      document.getElementById('customInputSelector').value = p.inputSelector;
      document.getElementById('customSendSelector').value = p.sendSelector;
      document.getElementById('customMessageSelector').value = p.messageSelector;
      document.getElementById('customInjectionMode').value = p.injectionMode;
    }
  });

  document.getElementById('loadPresetBtn')?.addEventListener('click', () => {
    document.getElementById('presetSelect')?.focus();
  });

  // Global Save Handler
  document.getElementById('saveBtn')?.addEventListener('click', () => {
    const settings = {
      wsUrl: document.getElementById('wsUrl')?.value.trim() || 'ws://localhost:9999',
      approvalPolicy: document.querySelector('input[name="approvalPolicy"]:checked')?.value || 'safety',
      autoSubmitResult: document.getElementById('autoSubmitResult')?.checked ?? true,
      presetToggles: currentConfig.presetToggles,
      customSites: currentConfig.customSites,
      customUrlPattern: document.getElementById('customUrlPattern')?.value.trim() || '',
      customInputSelector: document.getElementById('customInputSelector')?.value.trim() || '',
      customSendSelector: document.getElementById('customSendSelector')?.value.trim() || '',
      customMessageSelector: document.getElementById('customMessageSelector')?.value.trim() || '',
      customInjectionMode: document.getElementById('customInjectionMode')?.value || 'react-setter',
      activePreset: document.getElementById('presetSelect')?.value || 'custom',
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set(settings, () => {
        showToast('✅ 모든 허용 사이트 및 설정이 성공적으로 저장되었습니다!');
      });
    } else {
      showToast('✅ 설정이 적용되었습니다 (Local Preview Mode)');
    }
  });

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});

