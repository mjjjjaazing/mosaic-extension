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

const providerReady = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  renderSidebar();
  renderPanels();
  setupPromptBar();
  setupLayoutButtons();
  setupSidebarToggle();
  setupFooterButtons();
  listenForReadyMessages();
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
function saveState() { chrome.storage.local.set({ mosaic_state: state }); }

// ===== READY MESSAGES =====
// SECURITY: Validate origin of incoming messages
const ALLOWED_ORIGINS = Object.values(PROVIDERS).map(p => new URL(p.url).origin);

function listenForReadyMessages() {
  window.addEventListener('message', (event) => {
    // Only accept READY messages from known AI provider origins
    if (!ALLOWED_ORIGINS.includes(event.origin)) return;
    if (event.data?.type === 'MOSAIC_READY' && typeof event.data.provider === 'string') {
      if (event.data.provider in PROVIDERS) {
        providerReady[event.data.provider] = true;
      }
    }
  });
}

// ===== SIDEBAR =====
function renderSidebar() {
  const list = document.getElementById('providerList');
  list.innerHTML = '';
  const sorted = Object.entries(PROVIDERS).sort((a, b) => a[1].order - b[1].order);
  for (const [id, p] of sorted) {
    const active = state.activeProviders.includes(id);
    const item = document.createElement('div');
    item.className = `provider-item ${active ? 'active' : ''}`;
    item.dataset.provider = id;

    // SECURITY: Use DOM API instead of innerHTML to prevent XSS
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';
    iconDiv.setAttribute('style', `background:${p.color}${p.darkIcon ? ';color:#000;border:1px solid #555' : ''}`);
    iconDiv.textContent = p.icon;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'name';
    nameDiv.textContent = p.name;

    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'toggle';
    toggleDiv.textContent = active ? '\u2713' : '';

    item.appendChild(iconDiv);
    item.appendChild(nameDiv);
    item.appendChild(toggleDiv);
    item.addEventListener('click', () => toggleProvider(id));
    list.appendChild(item);
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
  updateLayoutButtons();
}

// ===== LAYOUT =====
function setupLayoutButtons() {
  updateLayoutButtons();
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.layout = parseInt(btn.dataset.layout);
      saveState(); updateLayoutButtons(); updateGridLayout();
    });
  });
}
function updateLayoutButtons() {
  document.querySelectorAll('.layout-btn').forEach(btn =>
    btn.classList.toggle('active', parseInt(btn.dataset.layout) === state.layout));
}
function updateGridLayout() {
  document.getElementById('panelGrid').className = `panel-grid layout-${state.layout}`;
}

// ===== SIDEBAR TOGGLE =====
function setupSidebarToggle() {
  const btn = document.getElementById('toggleSidebar');
  const sidebar = document.getElementById('sidebar');
  if (state.sidebarCollapsed) { sidebar.classList.add('collapsed'); btn.textContent = '▶'; }
  btn.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed');
    btn.textContent = state.sidebarCollapsed ? '▶' : '◀';
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
  });
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

    const openBtn = document.createElement('button');
    openBtn.className = 'panel-action-btn';
    openBtn.title = 'Open in new tab';
    openBtn.textContent = '\u2197';
    openBtn.addEventListener('click', () => window.open(p.url, '_blank'));

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'panel-action-btn';
    refreshBtn.title = 'Refresh';
    refreshBtn.textContent = '\u21BB';

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
}

// ===== PROMPT BAR =====
function setupPromptBar() {
  const input = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPromptToAll();
    }
  });
  sendBtn.addEventListener('click', sendPromptToAll);
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
}

function sendPromptToAll() {
  const input = document.getElementById('promptInput');
  const prompt = input.value.trim();
  if (!prompt) return;

  // Send to each iframe via postMessage — content script listens
  document.querySelectorAll('.panel iframe').forEach(iframe => {
    const pid = iframe.getAttribute('data-provider');
    if (!pid) return;
    try {
      iframe.contentWindow.postMessage({
        type: 'MOSAIC_INJECT_PROMPT',
        provider: pid,
        prompt: prompt
      }, '*');
    } catch (e) {
      console.warn(`postMessage failed for ${pid}:`, e);
    }
  });

  input.value = '';
  input.style.height = 'auto';
  savePromptHistory(prompt);
}

function savePromptHistory(prompt) {
  chrome.storage.local.get('prompt_history', (data) => {
    const h = data.prompt_history || [];
    h.unshift({ prompt, timestamp: Date.now(), providers: [...state.activeProviders] });
    chrome.storage.local.set({ prompt_history: h.slice(0, 50) });
  });
}
