// Mosaic Background Service Worker v2

// On extension icon click, open/focus the app page
chrome.action.onClicked.addListener(async () => {
  const appUrl = chrome.runtime.getURL('app.html');
  const tabs = await chrome.tabs.query({ url: appUrl });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: appUrl });
  }
});

// Relay prompt injection messages to content scripts in all matching frames
// SECURITY: Validate provider against allowlist before processing
const PROVIDER_DOMAINS = {
  chatgpt: 'chatgpt.com',
  gemini: 'gemini.google.com',
  claude: 'claude.ai',
  grok: 'grok.com',
  zai: 'chat.z.ai',
  kimi: 'kimi.com',
  deepseek: 'chat.deepseek.com',
  perplexity: 'perplexity.ai',
  mistral: 'chat.mistral.ai'
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'injectToProvider') {
    // Validate provider is in our allowlist
    const domain = PROVIDER_DOMAINS[message.provider];
    if (!domain) return;

    // Validate prompt is a string with reasonable length
    if (typeof message.prompt !== 'string' || message.prompt.length > 100000) return;

    // Send to all frames in all tabs matching this domain
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url?.includes(domain)) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'MOSAIC_INJECT_PROMPT',
            provider: message.provider,
            prompt: message.prompt
          }).catch(() => {});
        }
      }
    });

    sendResponse({ sent: true });
    return false;
  }
});
