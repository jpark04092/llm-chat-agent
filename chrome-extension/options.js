const PRESETS = {
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
  customUrlPattern: '',
  customInputSelector: '',
  customSendSelector: '',
  customMessageSelector: '',
  customInjectionMode: 'react-setter',
  activePreset: 'custom',
};

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
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
      const config = items || DEFAULT_CONFIG;
      populateForm(config);
    });
  } else {
    populateForm(DEFAULT_CONFIG);
  }

  function populateForm(config) {
    document.getElementById('wsUrl').value = config.wsUrl || 'ws://localhost:9999';
    const policyRadio = document.querySelector(`input[name="approvalPolicy"][value="${config.approvalPolicy || 'safety'}"]`);
    if (policyRadio) policyRadio.checked = true;

    document.getElementById('autoSubmitResult').checked = config.autoSubmitResult !== false;

    document.getElementById('customUrlPattern').value = config.customUrlPattern || '';
    document.getElementById('customInputSelector').value = config.customInputSelector || '';
    document.getElementById('customSendSelector').value = config.customSendSelector || '';
    document.getElementById('customMessageSelector').value = config.customMessageSelector || '';
    document.getElementById('customInjectionMode').value = config.customInjectionMode || 'react-setter';
    document.getElementById('presetSelect').value = config.activePreset || 'custom';
  }

  // Handle Preset selection
  document.getElementById('presetSelect')?.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (PRESETS[selected]) {
      const p = PRESETS[selected];
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

  // Save settings
  document.getElementById('saveBtn')?.addEventListener('click', () => {
    const settings = {
      wsUrl: document.getElementById('wsUrl').value.trim() || 'ws://localhost:9999',
      approvalPolicy: document.querySelector('input[name="approvalPolicy"]:checked')?.value || 'safety',
      autoSubmitResult: document.getElementById('autoSubmitResult').checked,
      customUrlPattern: document.getElementById('customUrlPattern').value.trim(),
      customInputSelector: document.getElementById('customInputSelector').value.trim(),
      customSendSelector: document.getElementById('customSendSelector').value.trim(),
      customMessageSelector: document.getElementById('customMessageSelector').value.trim(),
      customInjectionMode: document.getElementById('customInjectionMode').value,
      activePreset: document.getElementById('presetSelect').value,
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set(settings, () => {
        showToast('✅ 모든 설정이 성공적으로 저장되었습니다!');
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
    }, 2500);
  }
});
