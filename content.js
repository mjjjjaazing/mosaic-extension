// Mosaic Content Script v2.1
// Runs inside each AI provider iframe — handles prompt injection
// Uses execCommand('insertText') for maximum framework compatibility

(function() {
  'use strict';

  const hostname = window.location.hostname;
  let provider = null;

  if (hostname.includes('gemini.google.com')) provider = 'gemini';
  else if (hostname.includes('grok.com')) provider = 'grok';
  else if (hostname.includes('chatgpt.com')) provider = 'chatgpt';
  else if (hostname.includes('claude.ai')) provider = 'claude';
  else if (hostname.includes('chat.z.ai')) provider = 'zai';
  else if (hostname.includes('kimi.com') || hostname.includes('kimi.moonshot.cn')) provider = 'kimi';
  else if (hostname.includes('deepseek.com')) provider = 'deepseek';
  else if (hostname.includes('perplexity.ai')) provider = 'perplexity';
  else if (hostname.includes('mistral.ai')) provider = 'mistral';

  if (!provider) return;

  // Listen for messages from the extension page (postMessage)
  // SECURITY: Validate that messages come from our extension origin only
  window.addEventListener('message', (event) => {
    // Only accept messages from the extension's own origin (chrome-extension://...)
    if (!event.origin.startsWith('chrome-extension://')) return;
    if (event.data?.type === 'MOSAIC_INJECT_PROMPT' && event.data?.provider === provider) {
      if (typeof event.data.prompt !== 'string' || event.data.prompt.length > 100000) return;
      injectPrompt(event.data.prompt);
    }
    if (event.data?.type === 'MOSAIC_EXTRACT_RESPONSE' && event.data?.provider === provider) {
      const text = extractResponse();
      event.source.postMessage({
        type: 'MOSAIC_RESPONSE_DATA',
        provider: provider,
        text: text || ''
      }, event.origin);
    }
  });

  // Also listen via chrome runtime messaging
  // SECURITY: chrome.runtime.onMessage only accepts messages from the extension itself
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'MOSAIC_INJECT_PROMPT' && message.provider === provider) {
        if (typeof message.prompt !== 'string' || message.prompt.length > 100000) return false;
        injectPrompt(message.prompt);
        sendResponse({ success: true });
      }
      return false;
    });
  }

  // Notify parent that content script is ready
  // SECURITY: Target extension origin specifically
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MOSAIC_READY', provider }, '*');
    }
  } catch(e) {}

  // ===== UNIVERSAL INSERT via execCommand =====
  // This is the most reliable way to insert text into contenteditable divs
  // and React-controlled inputs because it triggers all native event listeners
  function insertViaExecCommand(element, text) {
    element.focus();
    // Select all existing content and delete it
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    // Insert new text
    document.execCommand('insertText', false, text);
  }

  // For textarea elements (React-controlled), we need the native setter approach
  function insertIntoTextarea(textarea, text) {
    textarea.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(textarea, text);
    } else {
      textarea.value = text;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ===== PROVIDER-SPECIFIC INJECTION =====
  function injectPrompt(prompt) {
    switch (provider) {
      case 'gemini': return injectGemini(prompt);
      case 'grok': return injectGrok(prompt);
      case 'chatgpt': return injectChatGPT(prompt);
      case 'claude': return injectClaude(prompt);
      case 'zai': return injectZai(prompt);
      case 'kimi': return injectKimi(prompt);
      default: return injectGeneric(prompt);
    }
  }

  function injectGemini(prompt) {
    waitForElement('.ql-editor[contenteditable="true"]', (input) => {
      insertViaExecCommand(input, prompt);
      setTimeout(() => {
        const btn = document.querySelector('button.send-button, button[aria-label="Send message"]');
        if (btn && !btn.disabled) btn.click();
      }, 600);
    });
  }

  function injectGrok(prompt) {
    // Grok uses tiptap ProseMirror contenteditable
    waitForElement('.tiptap.ProseMirror[contenteditable="true"]', (input) => {
      insertViaExecCommand(input, prompt);
      setTimeout(() => {
        const btn = document.querySelector('button[aria-label="Submit"]');
        if (btn && !btn.disabled) btn.click();
      }, 600);
    }, 10000, () => {
      // Fallback: try plain textarea (older Grok UI)
      const ta = document.querySelector('textarea');
      if (ta) {
        insertIntoTextarea(ta, prompt);
        setTimeout(() => {
          const btn = document.querySelector('button[aria-label="Submit"]');
          if (btn && !btn.disabled) btn.click();
        }, 600);
      }
    });
  }

  function injectChatGPT(prompt) {
    waitForElement('#prompt-textarea', (input) => {
      if (input.contentEditable === 'true' || input.getAttribute('contenteditable') === 'true') {
        insertViaExecCommand(input, prompt);
      } else {
        insertIntoTextarea(input, prompt);
      }
      setTimeout(() => {
        let btn = document.querySelector('button[data-testid="send-button"]');
        if (!btn) btn = document.querySelector('button[aria-label="Send prompt"]');
        if (!btn) btn = document.querySelector('button.composer-submit-button-color');
        if (btn && !btn.disabled) btn.click();
        else {
          // Fallback: Enter key
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      }, 700);
    });
  }

  function injectClaude(prompt) {
    waitForElement('.ProseMirror[contenteditable="true"], div[aria-label="Write your prompt to Claude"]', (input) => {
      insertViaExecCommand(input, prompt);
      setTimeout(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('send'));
        if (btn && !btn.disabled) btn.click();
        else {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      }, 700);
    });
  }

  function injectZai(prompt) {
    waitForElement('#chat-input, textarea', (input) => {
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        insertIntoTextarea(input, prompt);
      } else {
        insertViaExecCommand(input, prompt);
      }
      setTimeout(() => {
        const btn = document.querySelector('.sendMessageButton, button[class*="sendMessage"]');
        if (btn) btn.click();
      }, 500);
    });
  }

  function injectKimi(prompt) {
    waitForElement('.chat-input-editor[contenteditable="true"]', (input) => {
      // Kimi REQUIRES execCommand to trigger its internal state update
      insertViaExecCommand(input, prompt);
      setTimeout(() => {
        const sendBtn = document.querySelector('.send-button-container:not(.disabled)');
        if (sendBtn) {
          sendBtn.click();
        } else {
          // Try clicking the SVG icon inside
          const svgBtn = document.querySelector('.send-button-container .send-icon');
          if (svgBtn) svgBtn.parentElement?.click();
          // Fallback: Enter
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      }, 600);
    });
  }

  function injectGeneric(prompt) {
    // Try contenteditable first, then textarea
    const ce = document.querySelector('[contenteditable="true"][role="textbox"], .ProseMirror[contenteditable="true"]');
    if (ce) {
      insertViaExecCommand(ce, prompt);
      setTimeout(() => clickSendButton(), 600);
      return;
    }

    waitForElement('textarea', (input) => {
      insertIntoTextarea(input, prompt);
      setTimeout(() => clickSendButton(), 600);
    });
  }

  function clickSendButton() {
    let btn = document.querySelector('button[aria-label*="Send"], button[aria-label*="send"], button[aria-label*="Submit"], button[aria-label*="submit"]');
    if (!btn) {
      const btns = Array.from(document.querySelectorAll('button'));
      btn = btns.find(b => {
        const cls = (b.className || '').toLowerCase();
        return cls.includes('send') || cls.includes('submit');
      });
    }
    if (btn && !btn.disabled) btn.click();
  }

  // ===== RESPONSE EXTRACTION =====
  function extractResponse() {
    switch (provider) {
      case 'chatgpt': return extractChatGPT();
      case 'gemini': return extractGemini();
      case 'claude': return extractClaude();
      case 'grok': return extractGrok();
      case 'zai': return extractZai();
      case 'kimi': return extractKimi();
      case 'deepseek': return extractDeepSeek();
      case 'perplexity': return extractPerplexity();
      case 'mistral': return extractMistral();
      default: return extractGeneric();
    }
  }

  function getLastElementText(selector) {
    const els = document.querySelectorAll(selector);
    if (els.length === 0) return null;
    return els[els.length - 1].innerText.trim();
  }

  function extractChatGPT() {
    return getLastElementText('[data-message-author-role="assistant"] .markdown')
      || getLastElementText('[data-message-author-role="assistant"]')
      || extractGeneric();
  }

  function extractGemini() {
    return getLastElementText('model-response .markdown')
      || getLastElementText('model-response')
      || getLastElementText('.response-content')
      || extractGeneric();
  }

  function extractClaude() {
    return getLastElementText('.font-claude-message')
      || getLastElementText('[data-is-streaming] .markdown')
      || getLastElementText('.prose')
      || extractGeneric();
  }

  function extractGrok() {
    return getLastElementText('.message-bubble:last-of-type')
      || getLastElementText('[class*="assistant"] [class*="markdown"]')
      || extractGeneric();
  }

  function extractZai() {
    return getLastElementText('.assistant-message')
      || getLastElementText('[class*="botMessage"]')
      || extractGeneric();
  }

  function extractKimi() {
    return getLastElementText('.chat-message-content .markdown')
      || getLastElementText('.chat-message-content')
      || extractGeneric();
  }

  function extractDeepSeek() {
    return getLastElementText('.ds-markdown')
      || getLastElementText('[class*="assistant"] .markdown')
      || extractGeneric();
  }

  function extractPerplexity() {
    return getLastElementText('.prose.dark\\:prose-invert')
      || getLastElementText('[class*="answer"]')
      || extractGeneric();
  }

  function extractMistral() {
    return getLastElementText('.prose')
      || getLastElementText('[class*="assistant"]')
      || extractGeneric();
  }

  function extractGeneric() {
    // Broad fallback: look for common response containers
    const selectors = [
      '[class*="assistant"] [class*="markdown"]',
      '[class*="response"] [class*="markdown"]',
      '[class*="message"][class*="bot"]',
      '[class*="answer"]',
      '.markdown',
      '.prose'
    ];
    for (const sel of selectors) {
      const text = getLastElementText(sel);
      if (text && text.length > 10) return text;
    }
    return null;
  }

  // ===== UTILITY: Wait for element =====
  function waitForElement(selector, callback, maxWait = 10000, onTimeout = null) {
    const el = document.querySelector(selector);
    if (el) { callback(el); return; }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timeout);
        callback(el);
      }
    });

    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      observer.disconnect();
      const el = document.querySelector(selector);
      if (el) callback(el);
      else if (onTimeout) onTimeout();
    }, maxWait);
  }
})();
