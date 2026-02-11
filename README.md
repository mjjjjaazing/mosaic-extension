# Mosaic — Side-by-Side AI Chat

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: Reviewed](https://img.shields.io/badge/Security-Reviewed-green.svg)](SECURITY.md)
[![Dependencies: None](https://img.shields.io/badge/Dependencies-None-brightgreen.svg)](#)
[![Chrome: Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](#)

A **free, open-source Chrome extension** that lets you chat with multiple AI models simultaneously and compare their responses side by side.

**Type one prompt. Send to all. See every response at once.**

> Think of it like having ChatGPT, Gemini, Claude, Grok, and more all open on the same screen — but instead of switching between tabs, you see them all together and they all answer your question at the same time.

---

## What Does This Extension Do?

Mosaic opens a special page in your browser that shows multiple AI chatbots in a grid layout. You type a message once, and it gets sent to all of them simultaneously. This is useful for:

- **Comparing AI responses** — See how different AIs answer the same question
- **Getting the best answer** — One AI might give a better response than another depending on the topic
- **Research** — Quickly gather multiple perspectives on a topic
- **Testing prompts** — See how your prompt performs across different models

## Supported AI Providers

You can use any combination of these AI chatbots:

| Provider | Free Account? | Paid Tier Available | Sign Up |
|----------|:---:|:---:|---------|
| ChatGPT (OpenAI) | ✅ | Plus, Pro | [chatgpt.com](https://chatgpt.com) |
| Gemini (Google) | ✅ | Advanced | [gemini.google.com](https://gemini.google.com) |
| Claude (Anthropic) | ✅ | Pro | [claude.ai](https://claude.ai) |
| Grok (xAI) | ✅ | SuperGrok | [grok.com](https://grok.com) |
| Z.ai | ✅ | — | [chat.z.ai](https://chat.z.ai) |
| Kimi (Moonshot) | ✅ | — | [kimi.com](https://www.kimi.com) |
| DeepSeek | ✅ | — | [chat.deepseek.com](https://chat.deepseek.com) |
| Perplexity | ✅ | Pro | [perplexity.ai](https://www.perplexity.ai) |
| Mistral | ✅ | — | [chat.mistral.ai](https://chat.mistral.ai) |

> **Note:** You need to have an account with each AI service you want to use. All of them offer free accounts. The extension uses your existing logins — no API keys or special setup needed.

---

## Installation — Step by Step

### What You Need

- **Google Chrome**, Microsoft Edge, Brave, or any Chromium-based browser
- A free account on at least one AI service listed above (the more the better!)

### Step 1: Download the Extension

**Option A — Download as ZIP (easiest):**
1. Click the green **"Code"** button at the top of this GitHub page
2. Click **"Download ZIP"**
3. Find the downloaded file (usually in your `Downloads` folder)
4. **Right-click** the ZIP file and select **"Extract All"** (Windows) or double-click it (Mac)
5. You'll get a folder called `mosaic-extension-main`

**Option B — Clone with Git (if you have Git installed):**
```bash
git clone https://github.com/mjjjjaazing/mosaic-extension.git
```

### Step 2: Install in Chrome

1. Open Chrome and type `chrome://extensions/` in the address bar, then press Enter

2. Turn on **Developer Mode** — look for the toggle switch in the **top-right corner** of the page and click it to enable it

3. Click the **"Load unpacked"** button that appears in the top-left area

4. Navigate to the folder you extracted/cloned and **select it** (the folder that contains `manifest.json`)

5. You should see **"Mosaic — Side-by-Side AI Chat"** appear in your extensions list with a purple **M** icon

### Step 3: Pin the Extension (Recommended)

1. Click the **puzzle piece icon** (🧩) in Chrome's toolbar (top-right, next to the address bar)
2. Find **Mosaic** in the dropdown list
3. Click the **pin icon** (📌) next to it
4. The purple **M** icon will now always be visible in your toolbar

### Step 4: Log Into Your AI Accounts

Before using Mosaic, make sure you're logged into the AI services you want to use. Open each one in a normal Chrome tab and sign in:

- Go to [chatgpt.com](https://chatgpt.com) and log in
- Go to [gemini.google.com](https://gemini.google.com) and log in
- Go to [claude.ai](https://claude.ai) and log in
- (Repeat for any other AI service you want to use)

> **Important:** You only need to do this once. Chrome remembers your logins, and Mosaic will use those existing sessions automatically.

---

## How to Use Mosaic

### Opening the App

Click the purple **M** icon in your Chrome toolbar. A new tab will open with the Mosaic interface.

### Understanding the Interface

The screen is divided into three areas:

```
┌──────────┬──────────────────────────────────────┐
│          │                                      │
│ Sidebar  │      AI Chat Panels (Grid)           │
│          │                                      │
│ - Toggle │   ┌──────────┐  ┌──────────┐        │
│   AIs    │   │ ChatGPT  │  │ Gemini   │        │
│   on/off │   │          │  │          │        │
│          │   └──────────┘  └──────────┘        │
│ - Pick   │   ┌──────────┐  ┌──────────┐        │
│   layout │   │ Claude   │  │ Grok     │        │
│          │   │          │  │          │        │
│          │   └──────────┘  └──────────┘        │
├──────────┴──────────────────────────────────────┤
│  Type your prompt here...              [Send]   │
└─────────────────────────────────────────────────┘
```

**Left Sidebar:**
- **Layout buttons** (top) — Choose how many panels to show: single, 2 columns, 3 columns, 2×2 grid, or 3×2 grid
- **Provider list** — Click any AI name to toggle it on ✅ or off. A checkmark means it's active
- **Select All** — Quickly enable or disable all providers
- **Refresh All** — Reload all AI panels (useful if one gets stuck)

**Main Area:**
- Shows your active AI chatbots in a grid layout
- Each panel has a header with the AI's name and two buttons:
  - **↗** — Open that AI in a separate tab
  - **↻** — Refresh just that panel

**Bottom Prompt Bar:**
- Type your message here
- Press **Enter** to send to all active AIs at once
- Press **Shift + Enter** to add a new line without sending

### Sending Your First Prompt

1. Make sure at least 2 AI providers are checked ✅ in the sidebar
2. Wait for the AI panels to finish loading (you should see each AI's chat interface)
3. Click in the prompt bar at the bottom
4. Type your question, for example: `What are the pros and cons of learning Python vs JavaScript as a first programming language?`
5. Press **Enter**
6. Watch all the AIs respond simultaneously!

### Tips for Best Results

- **Start with 2-4 providers** — Using all 9 at once can be resource-intensive. Pick the ones you use most
- **Give panels time to load** — Each AI needs a few seconds to fully load before it can receive prompts
- **Use the 2×2 layout** for 4 providers or **3×2** for 6 — these give the best balance of readability
- **If a provider doesn't respond**, click the ↻ refresh button on that panel and try again
- **You can continue conversations** — Each panel remembers the chat history, so you can ask follow-up questions
- **Collapse the sidebar** using the ◀ button to give more space to the chat panels

---

## Troubleshooting

### "An AI panel shows a blank/white screen"
The AI service might be down, or you're not logged in. Open that AI's website in a normal tab, log in, then refresh the panel in Mosaic.

### "My prompt didn't send to one of the AIs"
Some AI providers occasionally change their website layout. Click the ↻ refresh button on that panel, wait for it to load, and try again. If it persists, open an issue on GitHub.

### "The extension uses a lot of memory"
Each AI panel is essentially a full web page running in an iframe. If your computer is slow, reduce the number of active providers to 2-3.

### "I don't see the Mosaic icon in my toolbar"
Click the puzzle piece icon (🧩) in Chrome and pin Mosaic. See Step 3 above.

### "Can other people see my conversations?"
No. Everything stays in your browser. See [PRIVACY.md](PRIVACY.md).

---

## Frequently Asked Questions

**Q: Is this free?**
A: Yes, completely free and open source under the MIT license.

**Q: Do I need API keys?**
A: No. The extension uses your existing browser logins. Just be signed into the AI services you want to use.

**Q: Does this work with my paid ChatGPT Plus / Claude Pro subscription?**
A: Yes! Since it uses your existing session, you'll have access to whatever plan you're paying for, including GPT-4o, Claude Opus, etc.

**Q: Can the extension see my conversations?**
A: The extension injects your prompt into each AI's input field and clicks send. It does not read, store, or transmit any responses. Your conversations are between you and each AI provider directly.

**Q: Does this work on Edge / Brave / Arc?**
A: Yes, it works on any Chromium-based browser. The installation steps are the same — just use that browser's extension management page.

**Q: Why do some panels take long to load?**
A: Each panel loads the full AI website. Some services (especially Gemini and Claude) have heavier interfaces. Give them 5-10 seconds on first load.

**Q: Can I use this on mobile?**
A: No, Chrome extensions are desktop-only.

---

## How It Works (Technical)

The extension opens a full-page app (`app.html`) that embeds each AI chatbot in an iframe panel. When you send a prompt:

1. Your prompt text is sent to each iframe via `postMessage` (with origin validation)
2. A content script (`content.js`) inside each iframe inserts the text into the AI's input field using `document.execCommand('insertText')` — the most reliable method for React/Vue/ProseMirror editors
3. The content script clicks the provider's send button via DOM query
4. Each AI processes the prompt normally using your existing logged-in session

The extension uses `declarativeNetRequest` to strip `X-Frame-Options` headers on AI provider responses (`sub_frame` resource type only) to allow iframe embedding. This is the standard approach used by ChatHub and similar extensions. Your normal browsing is completely unaffected. See [SECURITY.md](SECURITY.md) for full details.

---

## Security & Privacy

### Security

This extension has undergone a comprehensive security review covering STRIDE threat modeling, OWASP Browser Extension checklist, and static code analysis. Key highlights:

- **Zero external dependencies** — No supply chain attack risk
- **Origin-validated messaging** — All postMessage communication verified
- **No innerHTML** — All DOM manipulation uses safe APIs (createElement/textContent)
- **Least-privilege permissions** — Only 3 Chrome permissions required
- **Strict CSP** — Content Security Policy on the extension page
- **Input validation** — All message handlers validate type, length, and source

See [SECURITY.md](SECURITY.md) for the full security policy and [docs/SECURITY-REPORT.docx](docs/SECURITY-REPORT.docx) for the detailed assessment report.

### Privacy

**Mosaic collects zero user data.** Specifically:

- ❌ No analytics or telemetry
- ❌ No network requests to any server (other than the AI providers you choose to use)
- ❌ No data leaves your browser
- ❌ No credentials stored or handled
- ❌ No third-party code
- ✅ All conversations happen directly between your browser and each AI provider
- ✅ Your settings are stored locally in your browser only

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

For security vulnerabilities, please see [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

---

## License

[MIT](LICENSE) — free for personal and commercial use.

## Acknowledgments

Inspired by [ChatHub](https://chathub.gg/) and [Simple Chat Hub](https://github.com/jackyr/simple-chat-hub-extension).
