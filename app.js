// Mosaic App Controller v2
// ChatHub-style: embedded iframes with prompt injection via content scripts

const PROVIDERS = {
  chatgpt:  { name: 'ChatGPT',   color: '#10A37F', icon: '●', url: 'https://chatgpt.com/',           order: 1 },
  gemini:   { name: 'Gemini',    color: '#4285F4', icon: '✦', url: 'https://gemini.google.com/app',  order: 2 },
  claude:   { name: 'Claude',    color: '#D97757', icon: 'A', url: 'https://claude.ai/new',          order: 3 },
  grok:     { name: 'Grok',      color: '#FFFFFF', icon: '𝕏', url: 'https://grok.com/',              order: 4, darkIcon: true },
  zai:      { name: 'Z.ai',      color: '#7C3AED', icon: 'Z', url: 'https://chat.z.ai/',            order: 5 },
  kimi:     { name: 'Kimi',      color: '#F59E0B', icon: 'K', url: 'https://www.kimi.com/',          order: 6 },
  deepseek: { name: 'DeepSeek',  color: '#0EA5E9', icon: 'D', url: 'https://chat.deepseek.com/',    order: 7 },
  perplexity:{ name: 'Perplexity',color: '#22D3EE', icon: 'P', url: 'https://www.perplexity.ai/',   order: 8 },
  mistral:  { name: 'Mistral',   color: '#F97316', icon: 'M', url: 'https://chat.mistral.ai/',      order: 9 }
};

const DEFAULT_ACTIVE = ['chatgpt', 'gemini', 'claude', 'grok', 'zai', 'kimi'];

let state = {
  activeProviders: [...DEFAULT_ACTIVE],
  layout: 6,
  sidebarCollapsed: false
};

let customTemplates = [];

let pendingImages = [];
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const providerReady = {};

// ===== RESIZE STATE =====
let panelProportions = {};

const LAYOUT_HANDLE_CONFIG = {
  1: { cols: 0, rows: 0 },
  2: { cols: 1, rows: 0 },
  3: { cols: 2, rows: 0 },
  4: { cols: 1, rows: 1 },
  6: { cols: 2, rows: 1 }
};

// ===== ONBOARDING STEPS =====
const ONBOARDING_STEPS = [
  {
    id: 'send',
    title: 'Send to All',
    description: 'Type a prompt and send it to all active AI models simultaneously. Compare their responses side by side.',
    target: '#sendBtn',
    tooltipPosition: 'top'
  },
  {
    id: 'images',
    title: 'Image Attachments',
    description: 'Paste, drag & drop, or click to attach images to your prompts. Supported across most AI providers.',
    target: '#imageBtn',
    tooltipPosition: 'top'
  },
  {
    id: 'templates',
    title: 'Prompt Templates',
    description: 'Save frequently used prompts as templates. Type / in the prompt bar to quickly access them.',
    target: '#templateBtn',
    tooltipPosition: 'top'
  },
  {
    id: 'export',
    title: 'Export Responses',
    description: 'Export all AI responses as a formatted Markdown document. Great for comparing and sharing results.',
    target: '#exportAllBtn',
    tooltipPosition: 'top'
  },
  {
    id: 'synthesize',
    title: 'Synthesize',
    description: 'After receiving responses, use Synthesize to combine the best parts from all AIs into one comprehensive answer.',
    target: '#synthesizeBtn',
    tooltipPosition: 'top',
    fallbackTarget: '#sendBtn'
  },
  {
    id: 'history',
    title: 'Prompt History',
    description: 'Access your prompt history to resend or search previous prompts. Use Ctrl+Shift+H for quick access.',
    target: '#historyBtn',
    tooltipPosition: 'right'
  }
];

let onboardingState = {
  active: false,
  currentStep: 0
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  await loadCustomTemplates();
  await loadProportions();
  renderSidebar();
  autoLayout();
  renderPanels();
  setupPromptBar();
  setupSidebarToggle();
  setupFooterButtons();
  setupImageAttachments();
  setupHistoryButton();
  setupSidebarToggleTab();
  setupRichTooltips();
  listenForReadyMessages();
  checkAndStartOnboarding();
});

// ===== STATE =====
async function loadState() {
  return new Promise(resolve => {
    chrome.storage.local.get('mosaic_state', (data) => {
      if (data.mosaic_state) state = { ...state, ...data.mosaic_state };
      resolve();
    });
  });
}
function saveState() {
  chrome.storage.local.set({ mosaic_state: state }, () => {
    if (chrome.runtime.lastError) console.error('Failed to save state:', chrome.runtime.lastError);
  });
}

// ===== READY MESSAGES =====
// SECURITY: Validate origin of incoming messages
const ALLOWED_ORIGINS = Object.values(PROVIDERS).map(p => new URL(p.url).origin);

const pendingExtractions = {};

function listenForReadyMessages() {
  window.addEventListener('message', (event) => {
    // Only accept READY messages from known AI provider origins
    if (!ALLOWED_ORIGINS.includes(event.origin)) return;
    if (event.data?.type === 'MOSAIC_READY' && typeof event.data.provider === 'string') {
      if (event.data.provider in PROVIDERS) {
        providerReady[event.data.provider] = true;
      }
    }
    if (event.data?.type === 'MOSAIC_RESPONSE_DATA' && typeof event.data.provider === 'string') {
      if (pendingExtractions[event.data.provider]) {
        pendingExtractions[event.data.provider](event.data.text || '');
        delete pendingExtractions[event.data.provider];
      }
    }
  });
}

// ===== SIDEBAR =====
function renderSidebar() {
  const list = document.getElementById('providerList');
  list.innerHTML = '';
  const sorted = Object.entries(PROVIDERS).sort((a, b) => a[1].order - b[1].order);
  let idx = 0;
  for (const [id, p] of sorted) {
    const active = state.activeProviders.includes(id);
    const item = document.createElement('div');
    item.className = `provider-item ${active ? 'active' : ''}`;
    item.dataset.provider = id;
    item.style.animation = `fadeIn 0.3s ${idx * 0.02}s both`;

    // SECURITY: Use DOM API instead of innerHTML to prevent XSS
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';
    iconDiv.setAttribute('style', `background:${p.color}${p.darkIcon ? ';color:#000;border:1px solid #555' : ''}`);
    iconDiv.textContent = p.icon;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'name';
    nameDiv.textContent = p.name;

    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'provider-toggle-switch';

    item.appendChild(iconDiv);
    item.appendChild(nameDiv);
    item.appendChild(toggleDiv);
    item.addEventListener('click', () => toggleProvider(id));
    list.appendChild(item);
    idx++;
  }
}

function toggleProvider(id) {
  const idx = state.activeProviders.indexOf(id);
  if (idx >= 0) state.activeProviders.splice(idx, 1);
  else state.activeProviders.push(id);
  autoLayout(); saveState(); renderSidebar(); renderPanels();
}

function autoLayout() {
  const n = state.activeProviders.length;
  if (n <= 1) state.layout = 1;
  else if (n === 2) state.layout = 2;
  else if (n === 3) state.layout = 3;
  else if (n <= 4) state.layout = 4;
  else state.layout = 6;
}

// ===== LAYOUT =====
function updateGridLayout() {
  const grid = document.getElementById('panelGrid');
  grid.className = `panel-grid layout-${state.layout}`;
  grid.style.gridTemplateColumns = '';
  grid.style.gridTemplateRows = '';
  setupResizeHandles();
}

// ===== SIDEBAR TOGGLE =====
function setupSidebarToggle() {
  const btn = document.getElementById('toggleSidebar');
  const sidebar = document.getElementById('sidebar');
  if (state.sidebarCollapsed) { sidebar.classList.add('collapsed'); }
  btn.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed');
    saveState();
  });
}

// ===== FOOTER =====
function setupFooterButtons() {
  document.getElementById('selectAllBtn').addEventListener('click', () => {
    const all = Object.keys(PROVIDERS);
    state.activeProviders = state.activeProviders.length === all.length ? [] : [...all];
    autoLayout(); saveState(); renderSidebar(); renderPanels();
  });
  document.getElementById('refreshAllBtn').addEventListener('click', () => {
    document.querySelectorAll('.panel iframe').forEach(f => { f.src = f.src; });
    removeSynthesizeButton();
  });
  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      startOnboarding();
    });
  }
}

// ===== PANELS =====
function renderPanels() {
  const grid = document.getElementById('panelGrid');
  grid.innerHTML = '';
  updateGridLayout();

  for (const pid of state.activeProviders) {
    const p = PROVIDERS[pid];
    if (!p) continue;

    // SECURITY: Build panel DOM safely without innerHTML
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.dataset.provider = pid;

    const header = document.createElement('div');
    header.className = 'panel-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'panel-header-left';

    const provIcon = document.createElement('div');
    provIcon.className = 'panel-provider-icon';
    provIcon.setAttribute('style', `background:${p.color}${p.darkIcon ? ';color:#000' : ''}`);
    provIcon.textContent = p.icon;

    const provName = document.createElement('span');
    provName.className = 'panel-provider-name';
    provName.textContent = p.name;

    const modelSel = document.createElement('span');
    modelSel.setAttribute('style', 'font-size:10px;color:var(--text-muted);cursor:pointer');
    modelSel.className = 'model-selector';
    modelSel.textContent = '\u25BE';

    headerLeft.appendChild(provIcon);
    headerLeft.appendChild(provName);
    headerLeft.appendChild(modelSel);

    const headerActions = document.createElement('div');
    headerActions.className = 'panel-header-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'panel-action-btn';
    copyBtn.title = 'Copy response';
    copyBtn.textContent = '\uD83D\uDCCB';
    copyBtn.setAttribute('data-tooltip-title', 'Copy Response');
    copyBtn.setAttribute('data-tooltip-desc', 'Copy this AI\'s response to clipboard');
    copyBtn.addEventListener('click', () => copyPanelResponse(pid));

    const openBtn = document.createElement('button');
    openBtn.className = 'panel-action-btn';
    openBtn.title = 'Open in new tab';
    openBtn.textContent = '\u2197';
    openBtn.setAttribute('data-tooltip-title', 'Open in Tab');
    openBtn.setAttribute('data-tooltip-desc', 'Open this AI in a new browser tab');
    openBtn.addEventListener('click', () => window.open(p.url, '_blank'));

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'panel-action-btn';
    refreshBtn.title = 'Refresh';
    refreshBtn.textContent = '\u21BB';
    refreshBtn.setAttribute('data-tooltip-title', 'Refresh');
    refreshBtn.setAttribute('data-tooltip-desc', 'Reload this AI panel');

    headerActions.appendChild(copyBtn);
    headerActions.appendChild(openBtn);
    headerActions.appendChild(refreshBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    panel.appendChild(header);

    const iframe = document.createElement('iframe');
    iframe.src = p.url;
    iframe.setAttribute('data-provider', pid);
    // SECURITY: Restrict iframe capabilities to minimum needed
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
    panel.appendChild(iframe);
    grid.appendChild(panel);

    refreshBtn.addEventListener('click', () => { iframe.src = iframe.src; });
  }

  setupResizeHandles();
}

// ===== PROMPT BAR =====
function setupPromptBar() {
  const input = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const dropdown = document.querySelector('.template-dropdown');
      if (dropdown) { dropdown.remove(); return; }
      sendPromptToAll();
    }
    if (e.key === 'Escape') {
      const dropdown = document.querySelector('.template-dropdown');
      if (dropdown) dropdown.remove();
    }
  });
  sendBtn.addEventListener('click', sendPromptToAll);
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';

    const val = input.value;
    if (val === '/' || (val.startsWith('/') && !val.includes(' '))) {
      showTemplateDropdown(val.slice(1));
    } else {
      const dropdown = document.querySelector('.template-dropdown');
      if (dropdown) dropdown.remove();
    }
  });

  // Template save button
  const templateBtn = document.getElementById('templateBtn');
  if (templateBtn) templateBtn.addEventListener('click', showSaveTemplateDialog);

  // Export button
  const exportBtn = document.getElementById('exportAllBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportAllAsMarkdown);
}

function sendPromptToAll() {
  const input = document.getElementById('promptInput');
  const prompt = input.value.trim();
  const hasImages = pendingImages.length > 0;
  if (!prompt && !hasImages) return;
  if (prompt.length > 100000) { showToast('Prompt too long (max 100,000 characters)', true); return; }

  // Build image payload (base64 data URLs are serializable via postMessage)
  const images = hasImages ? pendingImages.map(img => ({
    dataUrl: img.dataUrl,
    mimeType: img.mimeType,
    name: img.name
  })) : undefined;

  // Send to each iframe via postMessage — content script listens
  document.querySelectorAll('.panel iframe').forEach(iframe => {
    const pid = iframe.getAttribute('data-provider');
    if (!pid || !PROVIDERS[pid]) return;
    const targetOrigin = new URL(PROVIDERS[pid].url).origin;
    try {
      const message = {
        type: 'MOSAIC_INJECT_PROMPT',
        provider: pid,
        prompt: prompt
      };
      if (images) message.images = images;
      iframe.contentWindow.postMessage(message, targetOrigin);
    } catch (e) {
      console.warn(`postMessage failed for ${pid}:`, e);
    }
  });

  input.value = '';
  input.style.height = 'auto';
  savePromptHistory(prompt, hasImages ? pendingImages.length : 0);
  clearPendingImages();
  showSynthesizeButton();
}

let historyWritePending = false;
const historyQueue = [];

function savePromptHistory(prompt, imageCount = 0) {
  const entry = { prompt, timestamp: Date.now(), providers: [...state.activeProviders] };
  if (imageCount > 0) entry.imageCount = imageCount;
  historyQueue.push(entry);
  if (historyWritePending) return;
  historyWritePending = true;
  chrome.storage.local.get('prompt_history', (data) => {
    const h = data.prompt_history || [];
    h.unshift(...historyQueue);
    historyQueue.length = 0;
    chrome.storage.local.set({ prompt_history: h.slice(0, 50) }, () => {
      historyWritePending = false;
      if (chrome.runtime.lastError) console.error('Failed to save history:', chrome.runtime.lastError);
    });
  });
}

// ===== IMAGE ATTACHMENTS =====
function setupImageAttachments() {
  const textarea = document.getElementById('promptInput');
  const imageBtn = document.getElementById('imageBtn');
  const fileInput = document.getElementById('imageFileInput');
  const promptWrap = document.getElementById('promptInputWrap');

  // Paste handler on textarea — intercept image items
  textarea.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    for (const item of items) {
      if (item.kind === 'file' && IMAGE_ALLOWED_TYPES.includes(item.type)) {
        hasImage = true;
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    }
    if (hasImage) e.preventDefault();
  });

  // File picker button
  imageBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    for (const file of fileInput.files) {
      addImageFile(file);
    }
    fileInput.value = '';
  });

  // Drag & drop on prompt wrap
  let dragCounter = 0;
  promptWrap.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    promptWrap.classList.add('drag-over');
  });
  promptWrap.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  promptWrap.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      promptWrap.classList.remove('drag-over');
    }
  });
  promptWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    promptWrap.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      addImageFile(file);
    }
  });
}

function addImageFile(file) {
  if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
    showToast('Only PNG, JPEG, GIF, and WEBP images are supported', true);
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showToast('Image too large (max 10MB)', true);
    return;
  }
  if (pendingImages.length >= MAX_IMAGES) {
    showToast(`Maximum ${MAX_IMAGES} images per message`, true);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingImages.push({
      dataUrl: reader.result,
      mimeType: file.type,
      name: file.name || 'image'
    });
    renderImagePreviews();
  };
  reader.onerror = () => showToast('Failed to read image', true);
  reader.readAsDataURL(file);
}

function renderImagePreviews() {
  const container = document.getElementById('imagePreviewContainer');
  container.innerHTML = '';
  pendingImages.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item';

    const imgEl = document.createElement('img');
    imgEl.src = img.dataUrl;
    imgEl.alt = img.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-remove-btn';
    removeBtn.textContent = '\u00D7';
    removeBtn.title = 'Remove image';
    removeBtn.addEventListener('click', () => {
      pendingImages.splice(idx, 1);
      renderImagePreviews();
    });

    item.appendChild(imgEl);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

function clearPendingImages() {
  pendingImages = [];
  const container = document.getElementById('imagePreviewContainer');
  if (container) container.innerHTML = '';
}

// ===== TOAST NOTIFICATION =====
function showToast(message, isError = false) {
  let toast = document.querySelector('.mosaic-toast');
  if (toast) toast.remove();
  toast = document.createElement('div');
  toast.className = 'mosaic-toast' + (isError ? ' toast-error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===== FEATURE 1: RESPONSE COPY + EXPORT =====
function requestResponseExtraction(providerId) {
  return new Promise((resolve) => {
    const iframe = document.querySelector(`.panel iframe[data-provider="${providerId}"]`);
    if (!iframe) { resolve(''); return; }
    const timeout = setTimeout(() => {
      delete pendingExtractions[providerId];
      resolve('');
    }, 10000);
    pendingExtractions[providerId] = (text) => {
      clearTimeout(timeout);
      resolve(text);
    };
    const targetOrigin = PROVIDERS[providerId] ? new URL(PROVIDERS[providerId].url).origin : null;
    if (!targetOrigin) { clearTimeout(timeout); delete pendingExtractions[providerId]; resolve(''); return; }
    try {
      iframe.contentWindow.postMessage({
        type: 'MOSAIC_EXTRACT_RESPONSE',
        provider: providerId
      }, targetOrigin);
    } catch (e) {
      clearTimeout(timeout);
      delete pendingExtractions[providerId];
      resolve('');
    }
  });
}

async function extractAllResponses() {
  const results = {};
  const promises = state.activeProviders.map(async (pid) => {
    const text = await requestResponseExtraction(pid);
    if (text) results[pid] = text;
  });
  await Promise.all(promises);
  return results;
}

async function copyPanelResponse(providerId) {
  const text = await requestResponseExtraction(providerId);
  if (!text) {
    showToast('No response to copy', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Response copied!');
  } catch (e) {
    showToast(e.name === 'NotAllowedError' ? 'Clipboard permission denied' : 'Copy failed', true);
  }
}

async function exportAllAsMarkdown() {
  showToast('Extracting responses...');
  const responses = await extractAllResponses();
  const entries = Object.entries(responses);
  if (entries.length === 0) {
    showToast('No responses to export', true);
    return;
  }
  let md = '# Mosaic AI Responses\n\n';
  md += `*Exported ${new Date().toLocaleString()}*\n\n---\n\n`;
  for (const [pid, text] of entries) {
    const name = PROVIDERS[pid]?.name || pid;
    md += `## ${name}\n\n${text}\n\n---\n\n`;
  }
  try {
    await navigator.clipboard.writeText(md.trim());
    showToast(`Exported ${entries.length} response(s) as Markdown!`);
  } catch (e) {
    showToast(e.name === 'NotAllowedError' ? 'Clipboard permission denied' : 'Export failed', true);
  }
}

// ===== FEATURE 2: PROMPT TEMPLATES =====
const BUILTIN_TEMPLATES = [
  { id: 'compare', name: 'Compare', category: 'Analysis', prompt: 'Compare and contrast {{topic A}} and {{topic B}}. Include key similarities, differences, pros, and cons.' },
  { id: 'factcheck', name: 'Fact Check', category: 'Analysis', prompt: 'Fact check the following claim and provide evidence for or against it: {{claim}}' },
  { id: 'eli5', name: 'ELI5', category: 'Explain', prompt: 'Explain {{topic}} like I\'m 5 years old. Use simple analogies and examples.' },
  { id: 'codereview', name: 'Code Review', category: 'Code', prompt: 'Review this code for bugs, security issues, and improvements:\n\n```\n{{paste code here}}\n```' },
  { id: 'proscons', name: 'Pros & Cons', category: 'Analysis', prompt: 'List the pros and cons of {{topic}}. Present as a balanced analysis.' },
  { id: 'summarize', name: 'Summarize', category: 'Writing', prompt: 'Summarize the following text concisely while keeping the key points:\n\n{{paste text here}}' }
];

async function loadCustomTemplates() {
  return new Promise(resolve => {
    chrome.storage.local.get('mosaic_templates', (data) => {
      customTemplates = data.mosaic_templates || [];
      resolve();
    });
  });
}

function saveCustomTemplates() {
  chrome.storage.local.set({ mosaic_templates: customTemplates }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save templates:', chrome.runtime.lastError);
      showToast('Failed to save template', true);
    }
  });
}

function showTemplateDropdown(filterText) {
  let dropdown = document.querySelector('.template-dropdown');
  if (dropdown) dropdown.remove();

  const filter = filterText.toLowerCase();
  const builtins = BUILTIN_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(filter) || t.category.toLowerCase().includes(filter)
  );
  const customs = customTemplates.filter(t =>
    t.name.toLowerCase().includes(filter)
  );

  if (builtins.length === 0 && customs.length === 0) return;

  dropdown = document.createElement('div');
  dropdown.className = 'template-dropdown';

  if (customs.length > 0) {
    const label = document.createElement('div');
    label.className = 'template-category-label';
    label.textContent = 'Custom';
    dropdown.appendChild(label);
    for (const t of customs) {
      const item = document.createElement('div');
      item.className = 'template-item';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = t.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'template-del-btn';
      delBtn.textContent = '\u00D7';
      delBtn.title = 'Delete template';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomTemplate(t.id);
      });

      item.appendChild(nameSpan);
      item.appendChild(delBtn);
      item.addEventListener('click', () => selectTemplate(t));
      dropdown.appendChild(item);
    }
  }

  // Group builtins by category
  const categories = {};
  for (const t of builtins) {
    if (!categories[t.category]) categories[t.category] = [];
    categories[t.category].push(t);
  }
  for (const [cat, templates] of Object.entries(categories)) {
    const label = document.createElement('div');
    label.className = 'template-category-label';
    label.textContent = cat;
    dropdown.appendChild(label);
    for (const t of templates) {
      const item = document.createElement('div');
      item.className = 'template-item';
      item.textContent = t.name;
      item.addEventListener('click', () => selectTemplate(t));
      dropdown.appendChild(item);
    }
  }

  const promptWrap = document.querySelector('.prompt-input-wrap');
  promptWrap.appendChild(dropdown);

  // Close on click outside
  setTimeout(() => {
    const closeOnOutsideClick = (e) => {
      if (!promptWrap.contains(e.target)) {
        const dd = document.querySelector('.template-dropdown');
        if (dd) dd.remove();
        document.removeEventListener('click', closeOnOutsideClick);
      }
    };
    document.addEventListener('click', closeOnOutsideClick);
  }, 0);
}

function selectTemplate(template) {
  const input = document.getElementById('promptInput');
  input.value = template.prompt;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  input.focus();

  // Select the first placeholder
  const match = template.prompt.match(/\{\{(.+?)\}\}/);
  if (match) {
    const start = template.prompt.indexOf(match[0]);
    const end = start + match[0].length;
    input.setSelectionRange(start, end);
  }

  const dropdown = document.querySelector('.template-dropdown');
  if (dropdown) dropdown.remove();
}

function showSaveTemplateDialog() {
  const input = document.getElementById('promptInput');
  const currentPrompt = input.value.trim();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Save as Template';
  title.style.cssText = 'margin-bottom:12px;font-size:15px;color:var(--text-primary)';

  const nameInput = document.createElement('input');
  nameInput.className = 'modal-input';
  nameInput.placeholder = 'Template name';

  const promptArea = document.createElement('textarea');
  promptArea.className = 'modal-textarea';
  promptArea.value = currentPrompt;
  promptArea.placeholder = 'Template prompt (use {{placeholder}} for variables)';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('button');
  saveBtn.className = 'modal-btn modal-btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim().slice(0, 100).replace(/[\r\n\t]/g, ' ');
    const prompt = promptArea.value.trim();
    if (!name || !prompt) { showToast('Name and prompt required', true); return; }
    if (prompt.length > 50000) { showToast('Template prompt too long (max 50,000 chars)', true); return; }
    if (customTemplates.length >= 50) { showToast('Maximum 50 custom templates reached', true); return; }
    customTemplates.push({
      id: 'custom_' + Date.now(),
      name: name,
      category: 'Custom',
      prompt: prompt
    });
    saveCustomTemplates();
    overlay.remove();
    showToast('Template saved!');
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modal.appendChild(title);
  modal.appendChild(nameInput);
  modal.appendChild(promptArea);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  nameInput.focus();
}

function deleteCustomTemplate(id) {
  customTemplates = customTemplates.filter(t => t.id !== id);
  saveCustomTemplates();
  const dropdown = document.querySelector('.template-dropdown');
  if (dropdown) dropdown.remove();
  showToast('Template deleted');
}

// ===== FEATURE 3: BEST-OF-ALL SYNTHESIZER =====
function removeSynthesizeButton() {
  const btn = document.getElementById('synthesizeBtn');
  if (btn) btn.remove();
}

function showSynthesizeButton() {
  if (document.getElementById('synthesizeBtn')) return;
  const sendBtn = document.getElementById('sendBtn');
  const synthBtn = document.createElement('button');
  synthBtn.id = 'synthesizeBtn';
  synthBtn.className = 'prompt-icon-btn';
  synthBtn.title = 'Synthesize best response';
  // Safe: hardcoded SVG with no user input
  synthBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 7.5L22 12l-7.5 1.5L12 21l-2.5-7.5L2 12l7.5-1.5z"/></svg>';
  synthBtn.setAttribute('data-tooltip-title', 'Synthesize');
  synthBtn.setAttribute('data-tooltip-desc', 'Combine the best of all AI responses into one');
  synthBtn.addEventListener('click', showSynthesizeDialog);
  sendBtn.parentElement.insertBefore(synthBtn, sendBtn);
}

async function showSynthesizeDialog() {
  const responses = await extractAllResponses();
  const entries = Object.entries(responses);
  if (entries.length < 2) {
    showToast('Need responses from at least 2 AIs to synthesize', true);
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Synthesize Best Response';
  title.style.cssText = 'margin-bottom:8px;font-size:15px;color:var(--text-primary)';

  const subtitle = document.createElement('p');
  subtitle.textContent = `Found ${entries.length} responses. Choose which AI should create the synthesis:`;
  subtitle.style.cssText = 'margin-bottom:16px;font-size:12px;color:var(--text-secondary)';

  const provList = document.createElement('div');
  provList.className = 'synth-provider-list';

  for (const pid of state.activeProviders) {
    const p = PROVIDERS[pid];
    if (!p) continue;
    const option = document.createElement('div');
    option.className = 'synth-provider-option';

    const icon = document.createElement('div');
    icon.className = 'panel-provider-icon';
    icon.setAttribute('style', `background:${p.color}${p.darkIcon ? ';color:#000' : ''};width:24px;height:24px;border-radius:6px;font-size:11px`);
    icon.textContent = p.icon;

    const name = document.createElement('span');
    name.textContent = p.name;
    name.style.cssText = 'font-size:13px;font-weight:500';

    option.appendChild(icon);
    option.appendChild(name);
    option.addEventListener('click', () => {
      overlay.remove();
      executeSynthesis(pid, responses);
    });
    provList.appendChild(option);
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:12px;width:100%';
  cancelBtn.addEventListener('click', () => overlay.remove());

  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(provList);
  modal.appendChild(cancelBtn);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function executeSynthesis(targetPid, responses) {
  let metaPrompt = 'I asked multiple AI assistants the same question. Please synthesize the best parts of their answers into one comprehensive, well-structured response.\n\n';
  for (const [pid, text] of Object.entries(responses)) {
    const name = PROVIDERS[pid]?.name || pid;
    metaPrompt += `--- ${name} ---\n${text}\n\n`;
  }
  metaPrompt += '---\n\nPlease create a synthesized answer that combines the best insights, corrects any errors, and presents a unified, comprehensive response.';

  const iframe = document.querySelector(`.panel iframe[data-provider="${targetPid}"]`);
  if (!iframe) { showToast('Target panel not found', true); return; }
  try {
    const synthOrigin = new URL(PROVIDERS[targetPid].url).origin;
    iframe.contentWindow.postMessage({
      type: 'MOSAIC_INJECT_PROMPT',
      provider: targetPid,
      prompt: metaPrompt
    }, synthOrigin);
    showToast(`Synthesis sent to ${PROVIDERS[targetPid]?.name || targetPid}`);
  } catch (e) {
    showToast('Synthesis failed', true);
  }
}

// ===== FEATURE 4: CONVERSATION HISTORY + SEARCH =====
function setupHistoryButton() {
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', showHistoryPanel);
  }
  // Keyboard shortcut: Ctrl/Cmd + Shift + H
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'h') {
      e.preventDefault();
      showHistoryPanel();
    }
  });
}

function showHistoryPanel() {
  // Remove if already open
  let existing = document.querySelector('.history-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'history-overlay';

  const panel = document.createElement('div');
  panel.className = 'history-panel';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border)';

  const title = document.createElement('h3');
  title.textContent = 'Prompt History';
  title.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-primary)';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'panel-action-btn';
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = 'font-size:16px;width:28px;height:28px';
  closeBtn.addEventListener('click', () => overlay.remove());

  header.appendChild(title);
  header.appendChild(closeBtn);

  const searchInput = document.createElement('input');
  searchInput.className = 'history-search';
  searchInput.placeholder = 'Search prompts...';
  searchInput.type = 'text';

  const listContainer = document.createElement('div');
  listContainer.className = 'history-list';

  const footer = document.createElement('div');
  footer.className = 'history-footer';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'modal-btn';
  clearBtn.textContent = 'Clear All History';
  clearBtn.style.cssText = 'width:100%;font-size:11px;color:#ef4444';
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ prompt_history: [] });
    renderHistoryList(listContainer, [], '');
    showToast('History cleared');
  });
  footer.appendChild(clearBtn);

  panel.appendChild(header);
  panel.appendChild(searchInput);
  panel.appendChild(listContainer);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  searchInput.focus();

  // Load history
  chrome.storage.local.get('prompt_history', (data) => {
    const history = data.prompt_history || [];
    renderHistoryList(listContainer, history, '');

    let searchDebounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        renderHistoryList(listContainer, history, searchInput.value.trim().toLowerCase());
      }, 150);
    });
  });
}

function renderHistoryList(container, history, searchTerm) {
  container.innerHTML = '';
  const filtered = searchTerm
    ? history.filter(h => h.prompt.toLowerCase().includes(searchTerm))
    : history;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:32px;text-align:center;color:var(--text-muted);font-size:13px';
    empty.textContent = searchTerm ? 'No matching prompts' : 'No prompt history yet';
    container.appendChild(empty);
    return;
  }

  for (const entry of filtered) {
    const item = document.createElement('div');
    item.className = 'history-item';

    const promptText = document.createElement('div');
    promptText.style.cssText = 'font-size:13px;color:var(--text-primary);line-height:1.4;word-break:break-word';
    promptText.textContent = entry.prompt.length > 200 ? entry.prompt.slice(0, 200) + '...' : entry.prompt;

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    const providers = (entry.providers || []).map(p => PROVIDERS[p]?.name || p).join(', ');
    const imgLabel = entry.imageCount ? ` \u00B7 ${entry.imageCount} image${entry.imageCount > 1 ? 's' : ''}` : '';
    meta.textContent = `${formatTimestamp(entry.timestamp)}${imgLabel}${providers ? ' \u00B7 ' + providers : ''}`;

    const actions = document.createElement('div');
    actions.className = 'history-item-actions';

    const resendBtn = document.createElement('button');
    resendBtn.className = 'panel-action-btn';
    resendBtn.title = 'Resend';
    resendBtn.textContent = '\u21BB';
    resendBtn.style.cssText = 'font-size:14px';
    resendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resendPrompt(entry.prompt);
      const overlay = document.querySelector('.history-overlay');
      if (overlay) overlay.remove();
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'panel-action-btn';
    copyBtn.title = 'Copy';
    copyBtn.textContent = '\uD83D\uDCCB';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(entry.prompt).then(() => showToast('Prompt copied!'));
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'panel-action-btn';
    delBtn.title = 'Delete';
    delBtn.textContent = '\u2715';
    delBtn.style.cssText = 'font-size:12px;color:#ef4444';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryEntry(entry.timestamp, container);
    });

    actions.appendChild(resendBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    item.appendChild(promptText);
    item.appendChild(meta);
    item.appendChild(actions);

    item.addEventListener('click', () => {
      resendPrompt(entry.prompt);
      const overlay = document.querySelector('.history-overlay');
      if (overlay) overlay.remove();
    });

    container.appendChild(item);
  }
}

function resendPrompt(prompt) {
  const input = document.getElementById('promptInput');
  input.value = prompt;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  input.focus();
}

function deleteHistoryEntry(timestamp, container) {
  chrome.storage.local.get('prompt_history', (data) => {
    const h = (data.prompt_history || []).filter(e => e.timestamp !== timestamp);
    chrome.storage.local.set({ prompt_history: h });
    renderHistoryList(container, h, '');
    showToast('Entry deleted');
  });
}

function formatTimestamp(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ===== RESIZABLE PANELS =====
function getColumnCount(layout) {
  return { 1: 1, 2: 2, 3: 3, 4: 2, 6: 3 }[layout] || 1;
}

function getRowCount(layout) {
  return { 1: 1, 2: 1, 3: 1, 4: 2, 6: 2 }[layout] || 1;
}

function getProportions(layout) {
  const key = `layout_${layout}`;
  if (panelProportions[key]) return panelProportions[key];
  const cols = getColumnCount(layout);
  const rows = getRowCount(layout);
  return {
    cols: Array(cols).fill(1 / cols),
    rows: Array(rows).fill(1 / rows)
  };
}

function applyProportions(layout) {
  const grid = document.getElementById('panelGrid');
  const props = getProportions(layout);
  grid.style.gridTemplateColumns = props.cols.map(c => `${c}fr`).join(' ');
  if (props.rows.length > 1) {
    grid.style.gridTemplateRows = props.rows.map(r => `${r}fr`).join(' ');
  }
}

function setupResizeHandles() {
  removeResizeHandles();
  const layout = state.layout;
  const config = LAYOUT_HANDLE_CONFIG[layout];
  if (!config || (config.cols === 0 && config.rows === 0)) return;

  const grid = document.getElementById('panelGrid');
  const props = getProportions(layout);

  // Create column handles
  let cumX = 0;
  for (let i = 0; i < config.cols; i++) {
    cumX += props.cols[i];
    const handle = document.createElement('div');
    handle.className = 'resize-handle resize-handle-col';
    handle.dataset.index = i;
    handle.dataset.type = 'col';
    handle.style.left = `${cumX * 100}%`;
    handle.addEventListener('mousedown', (e) => startResize(e, 'col', i));
    handle.addEventListener('dblclick', () => resetProportions());
    grid.appendChild(handle);
  }

  // Create row handles
  let cumY = 0;
  for (let i = 0; i < config.rows; i++) {
    cumY += props.rows[i];
    const handle = document.createElement('div');
    handle.className = 'resize-handle resize-handle-row';
    handle.dataset.index = i;
    handle.dataset.type = 'row';
    handle.style.top = `${cumY * 100}%`;
    handle.addEventListener('mousedown', (e) => startResize(e, 'row', i));
    handle.addEventListener('dblclick', () => resetProportions());
    grid.appendChild(handle);
  }

  applyProportions(layout);
}

function removeResizeHandles() {
  document.querySelectorAll('.resize-handle').forEach(h => h.remove());
}

function startResize(e, type, index) {
  e.preventDefault();
  const grid = document.getElementById('panelGrid');
  const rect = grid.getBoundingClientRect();
  const layout = state.layout;
  const props = getProportions(layout);

  // Create overlay to capture mouse events over iframes
  const overlay = document.createElement('div');
  overlay.className = `resize-overlay ${type}-resize`;
  document.body.appendChild(overlay);
  grid.classList.add('resizing');

  const startX = e.clientX;
  const startY = e.clientY;
  const startProps = {
    cols: [...props.cols],
    rows: [...props.rows]
  };

  const onMove = (moveEvent) => {
    if (type === 'col') {
      const deltaRatio = (moveEvent.clientX - startX) / rect.width;
      const newLeft = Math.max(0.1, startProps.cols[index] + deltaRatio);
      const newRight = Math.max(0.1, startProps.cols[index + 1] - deltaRatio);
      props.cols[index] = newLeft;
      props.cols[index + 1] = newRight;
    } else {
      const deltaRatio = (moveEvent.clientY - startY) / rect.height;
      const newTop = Math.max(0.1, startProps.rows[index] + deltaRatio);
      const newBottom = Math.max(0.1, startProps.rows[index + 1] - deltaRatio);
      props.rows[index] = newTop;
      props.rows[index + 1] = newBottom;
    }
    applyProportions(layout);
    positionHandles(layout);
  };

  const onEnd = () => {
    overlay.remove();
    grid.classList.remove('resizing');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);

    // Save proportions
    const key = `layout_${layout}`;
    panelProportions[key] = { cols: [...props.cols], rows: [...props.rows] };
    saveProportions();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

function positionHandles(layout) {
  const grid = document.getElementById('panelGrid');
  const props = getProportions(layout);

  const colHandles = grid.querySelectorAll('.resize-handle-col');
  let cumX = 0;
  colHandles.forEach((h, i) => {
    cumX += props.cols[i];
    h.style.left = `${cumX * 100}%`;
  });

  const rowHandles = grid.querySelectorAll('.resize-handle-row');
  let cumY = 0;
  rowHandles.forEach((h, i) => {
    cumY += props.rows[i];
    h.style.top = `${cumY * 100}%`;
  });
}

function resetProportions() {
  const layout = state.layout;
  const key = `layout_${layout}`;
  delete panelProportions[key];
  const grid = document.getElementById('panelGrid');
  grid.style.gridTemplateColumns = '';
  grid.style.gridTemplateRows = '';
  setupResizeHandles();
  showToast('Panel sizes reset');
  saveProportions();
}

function loadProportions() {
  return new Promise(resolve => {
    chrome.storage.local.get('panel_proportions', (data) => {
      if (data.panel_proportions) {
        Object.assign(panelProportions, data.panel_proportions);
      }
      resolve();
    });
  });
}

function saveProportions() {
  chrome.storage.local.set({ panel_proportions: panelProportions }, () => {
    if (chrome.runtime.lastError) console.error('Failed to save proportions:', chrome.runtime.lastError);
  });
}

// Reposition handles on window resize
window.addEventListener('resize', () => {
  if (state.layout > 1) {
    positionHandles(state.layout);
  }
});

// ===== ONBOARDING TUTORIAL =====
function checkAndStartOnboarding() {
  chrome.storage.local.get('onboarding_completed', (data) => {
    if (!data.onboarding_completed) {
      setTimeout(() => startOnboarding(), 800);
    }
  });
}

function startOnboarding() {
  onboardingState.active = true;
  onboardingState.currentStep = 0;
  renderOnboardingStep();
  document.addEventListener('keydown', onboardingKeyHandler);
}

function onboardingKeyHandler(e) {
  if (!onboardingState.active) return;
  if (e.key === 'Escape') {
    endOnboarding(false);
  } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
    nextOnboardingStep();
  }
}

function endOnboarding(completed = true) {
  onboardingState.active = false;
  document.removeEventListener('keydown', onboardingKeyHandler);

  const spotlight = document.querySelector('.onboarding-spotlight');
  const tooltip = document.querySelector('.onboarding-tooltip');
  if (spotlight) spotlight.remove();
  if (tooltip) tooltip.remove();

  if (completed) {
    chrome.storage.local.set({ onboarding_completed: true });
    showToast('Tutorial complete! Replay anytime from the sidebar.');
  }
}

function nextOnboardingStep() {
  onboardingState.currentStep++;
  if (onboardingState.currentStep >= ONBOARDING_STEPS.length) {
    endOnboarding(true);
  } else {
    renderOnboardingStep();
  }
}

function renderOnboardingStep() {
  // Remove existing
  const existingSpotlight = document.querySelector('.onboarding-spotlight');
  const existingTooltip = document.querySelector('.onboarding-tooltip');
  if (existingSpotlight) existingSpotlight.remove();
  if (existingTooltip) existingTooltip.remove();

  const step = ONBOARDING_STEPS[onboardingState.currentStep];
  let targetEl = document.querySelector(step.target);
  if (!targetEl && step.fallbackTarget) {
    targetEl = document.querySelector(step.fallbackTarget);
  }
  if (!targetEl) {
    nextOnboardingStep();
    return;
  }

  const targetRect = targetEl.getBoundingClientRect();

  // Create spotlight
  const spotlight = document.createElement('div');
  spotlight.className = 'onboarding-spotlight';
  spotlight.style.left = `${targetRect.left - 4}px`;
  spotlight.style.top = `${targetRect.top - 4}px`;
  spotlight.style.width = `${targetRect.width + 8}px`;
  spotlight.style.height = `${targetRect.height + 8}px`;
  spotlight.addEventListener('click', () => endOnboarding(false));
  document.body.appendChild(spotlight);

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';

  const tooltipTitle = document.createElement('div');
  tooltipTitle.className = 'onboarding-tooltip-title';
  tooltipTitle.textContent = step.title;

  const tooltipDesc = document.createElement('div');
  tooltipDesc.className = 'onboarding-tooltip-desc';
  tooltipDesc.textContent = step.description;

  // Step dots
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'onboarding-step-dots';
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'onboarding-step-dot';
    if (i === onboardingState.currentStep) dot.classList.add('active');
    else if (i < onboardingState.currentStep) dot.classList.add('completed');
    dotsContainer.appendChild(dot);
  }

  // Buttons
  const btnContainer = document.createElement('div');
  btnContainer.className = 'onboarding-btn-container';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'onboarding-skip-btn';
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', () => endOnboarding(false));

  const nextBtn = document.createElement('button');
  nextBtn.className = 'onboarding-next-btn';
  nextBtn.textContent = onboardingState.currentStep === ONBOARDING_STEPS.length - 1 ? 'Done' : 'Next';
  nextBtn.addEventListener('click', nextOnboardingStep);

  btnContainer.appendChild(skipBtn);
  btnContainer.appendChild(nextBtn);

  tooltip.appendChild(tooltipTitle);
  tooltip.appendChild(tooltipDesc);
  tooltip.appendChild(dotsContainer);
  tooltip.appendChild(btnContainer);

  document.body.appendChild(tooltip);

  // Position tooltip
  positionOnboardingTooltip(tooltip, targetRect, step.tooltipPosition);

  // Animate in
  requestAnimationFrame(() => {
    tooltip.classList.add('visible');
  });
}

function positionOnboardingTooltip(tooltip, targetRect, position) {
  const gap = 12;
  const tooltipRect = tooltip.getBoundingClientRect();
  let left, top;

  switch (position) {
    case 'top':
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      top = targetRect.top - tooltipRect.height - gap;
      break;
    case 'bottom':
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      top = targetRect.bottom + gap;
      break;
    case 'left':
      left = targetRect.left - tooltipRect.width - gap;
      top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
      break;
    case 'right':
      left = targetRect.right + gap;
      top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
      break;
  }

  // Viewport clamping
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

// ===== SIDEBAR TOGGLE TAB =====
function setupSidebarToggleTab() {
  const tab = document.getElementById('sidebarToggleTab');
  const sidebar = document.getElementById('sidebar');
  if (!tab) return;

  tab.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed');
    saveState();
  });
}

// ===== RICH TOOLTIPS =====
function setupRichTooltips() {
  let tooltipTimer = null;
  let currentTooltip = null;
  let currentTarget = null;

  function showTooltipFor(el) {
    const title = el.getAttribute('data-tooltip-title');
    const desc = el.getAttribute('data-tooltip-desc');
    if (!title) return;

    removeCurrentTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'rich-tooltip';

    const titleEl = document.createElement('div');
    titleEl.className = 'rich-tooltip-title';
    titleEl.textContent = title;
    tooltip.appendChild(titleEl);

    if (desc) {
      const descEl = document.createElement('div');
      descEl.className = 'rich-tooltip-desc';
      descEl.textContent = desc;
      tooltip.appendChild(descEl);
    }

    document.body.appendChild(tooltip);
    currentTooltip = tooltip;

    // Position tooltip
    const rect = el.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const inSidebar = el.closest('.sidebar');
    const inPromptBar = el.closest('.prompt-bar');

    let left, top;

    if (inSidebar) {
      // Position to the right of the sidebar element
      left = rect.right + 8;
      top = rect.top + rect.height / 2 - tooltipRect.height / 2;
    } else if (inPromptBar) {
      // Position above the prompt bar element
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      top = rect.top - tooltipRect.height - 8;
    } else {
      // Default: above the element
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      top = rect.top - tooltipRect.height - 8;
    }

    // Viewport clamping
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }

  function removeCurrentTooltip() {
    if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
    currentTarget = null;
  }

  function clearTimer() {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  }

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip-title]');
    if (!target || target === currentTarget) return;

    clearTimer();
    removeCurrentTooltip();
    currentTarget = target;

    tooltipTimer = setTimeout(() => {
      if (onboardingState.active) return;
      showTooltipFor(target);
    }, 500);
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip-title]');
    if (target) {
      clearTimer();
      removeCurrentTooltip();
    }
  });

  // Hide on scroll or click
  document.addEventListener('scroll', () => { clearTimer(); removeCurrentTooltip(); }, true);
  document.addEventListener('mousedown', () => { clearTimer(); removeCurrentTooltip(); });
}
