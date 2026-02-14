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
      const prompt = event.data.prompt;
      if (typeof prompt !== 'string' || prompt.length > 100000) return;
      // Route to image+prompt handler if images are present
      if (Array.isArray(event.data.images) && event.data.images.length > 0 && validateImagePayload(event.data.images)) {
        injectImagesAndPrompt(event.data.images, prompt);
      } else {
        injectPrompt(prompt);
      }
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
        if (Array.isArray(message.images) && message.images.length > 0 && validateImagePayload(message.images)) {
          injectImagesAndPrompt(message.images, message.prompt);
        } else {
          injectPrompt(message.prompt);
        }
        sendResponse({ success: true });
      }
      return false;
    });
  }

  // Notify parent that content script is ready
  // SECURITY: Target extension origin specifically
  try {
    if (window.parent !== window && chrome?.runtime?.id) {
      const extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
      window.parent.postMessage({ type: 'MOSAIC_READY', provider }, extensionOrigin);
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

  // ===== IMAGE INJECTION =====
  const IMAGE_MAX_COUNT = 4;
  const IMAGE_MAX_SIZE = 14 * 1024 * 1024; // ~13.3MB base64 ceiling
  const IMAGE_ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

  function validateImagePayload(images) {
    if (!Array.isArray(images) || images.length === 0 || images.length > IMAGE_MAX_COUNT) return false;
    return images.every(img =>
      typeof img.dataUrl === 'string' &&
      img.dataUrl.startsWith('data:image/') &&
      img.dataUrl.length < IMAGE_MAX_SIZE &&
      IMAGE_ALLOWED.includes(img.mimeType)
    );
  }

  function dataUrlToFile(dataUrl, filename, mimeType) {
    const [header, b64] = dataUrl.split(',');
    if (!header || !b64) return null;
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      return new File([blob], filename, { type: mimeType });
    } catch (e) {
      return null;
    }
  }

  function dispatchSyntheticPaste(element, files) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    element.focus();
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt
    });
    element.dispatchEvent(event);
  }

  function dispatchSyntheticDrop(element, files) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }

  function getInputSelector() {
    switch (provider) {
      case 'chatgpt':    return '#prompt-textarea';
      case 'gemini':     return '.ql-editor[contenteditable="true"]';
      case 'claude':     return '.ProseMirror[contenteditable="true"], div[aria-label="Write your prompt to Claude"]';
      case 'grok':       return '.tiptap.ProseMirror[contenteditable="true"]';
      case 'zai':        return '#chat-input, textarea';
      case 'kimi':       return '.chat-input-editor[contenteditable="true"]';
      case 'deepseek':   return 'textarea';
      case 'perplexity': return 'textarea';
      case 'mistral':    return 'textarea';
      default:           return '[contenteditable="true"][role="textbox"], textarea';
    }
  }

  function getImageDropTarget() {
    // Some providers handle drop on a wrapper rather than the textarea itself
    switch (provider) {
      case 'deepseek':   return document.querySelector('.chat-input-container') || document.querySelector('textarea');
      case 'perplexity': return document.querySelector('[class*="input"]') || document.querySelector('textarea');
      case 'mistral':    return document.querySelector('[class*="chat-input"]') || document.querySelector('textarea');
      default:           return null;
    }
  }

  function injectImagesAndPrompt(images, prompt) {
    // Convert base64 data URLs to File objects
    const files = [];
    for (const img of images) {
      const file = dataUrlToFile(img.dataUrl, img.name || 'image.png', img.mimeType);
      if (file) files.push(file);
    }
    if (files.length === 0) {
      // No valid files, fall back to text-only
      if (prompt) injectPrompt(prompt);
      return;
    }

    const selector = getInputSelector();
    waitForElement(selector, (inputEl) => {
      // Step 1: Dispatch synthetic paste on the input element
      dispatchSyntheticPaste(inputEl, files);

      // Step 2: For textarea-based providers, also try drop as fallback
      const dropTarget = getImageDropTarget();
      if (dropTarget) {
        setTimeout(() => dispatchSyntheticDrop(dropTarget, files), 300);
      }

      // Step 3: Wait for provider to process images, then inject text
      const delay = 1500 + (files.length - 1) * 500;
      setTimeout(() => {
        if (prompt) {
          injectPrompt(prompt);
        } else {
          // No text, just click send
          setTimeout(() => clickSendButton(), 600);
        }
      }, delay);
    });
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
