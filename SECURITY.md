# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Mosaic, please report it responsibly:

1. **Do NOT open a public GitHub issue for security vulnerabilities**
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include a detailed description, steps to reproduce, and potential impact
4. Allow reasonable time for a fix before public disclosure

## Security Architecture

### Permissions (Principle of Least Privilege)

| Permission | Purpose |
|---|---|
| `storage` | Persist user preferences and layout state locally |
| `tabs` | Focus existing app tab to prevent duplicates |
| `declarativeNetRequest` | Strip X-Frame-Options on sub_frame responses from AI domains to enable iframe embedding |
| `host_permissions` (10 AI domains) | Content script injection for prompt input handling |

### What This Extension Does NOT Do

- **No network requests** — Zero telemetry, analytics, or external communication
- **No data collection** — No user data leaves the browser
- **No credential handling** — Uses existing browser sessions only
- **No third-party code** — Zero external dependencies, CDNs, or libraries
- **No remote code execution** — All code is bundled and reviewed

### Known Architectural Risks

**CSP Header Stripping (Medium Risk)**

The extension removes `X-Frame-Options` and `Content-Security-Policy` headers from AI provider responses loaded as sub-frames (`sub_frame` resource type only). This is required to embed these sites in iframes and is the standard approach used by all extensions in this category (ChatHub, Simple Chat Hub, etc.).

Mitigations:
- Rules apply ONLY to `sub_frame` resource type — main-frame browsing is unaffected
- Rules are scoped to 10 specific AI domains only
- Extension page has its own strict CSP via meta tag
- No scripts are injected beyond the prompt input handler

**Cross-Origin Messaging (Low Risk)**

The extension uses `postMessage` for communication between the app page and AI provider iframes. Messages are validated for:
- Origin (must be `chrome-extension://` for incoming messages to content script)
- Target origin (messages sent to iframes use provider-specific origins, not wildcards)
- Message type (must match `MOSAIC_INJECT_PROMPT`, `MOSAIC_EXTRACT_RESPONSE`, or `MOSAIC_READY`)
- Provider field (must match current page's detected provider)
- Prompt field (must be string, max 100KB)
- Image payload (max 4 images, validated MIME type, max 14MB per image, must be data:image/ URL)

**Image Handling (Low Risk)**

Image attachments are converted to base64 data URLs client-side using FileReader. They are validated at two layers:
- App page: MIME type allowlist (png/jpeg/gif/webp), 10MB size limit, max 4 images
- Content script: Re-validates MIME type, size (14MB base64 ceiling), count, and data URL prefix

Images are passed via `postMessage` and converted to File objects for synthetic paste/drop events. No images are stored persistently — they exist only for the duration of a single send operation.

## Security Review

This extension has undergone a comprehensive security assessment covering:
- STRIDE threat modeling
- OWASP Browser Extension security checklist
- Static code analysis
- Permission audit
- Cross-origin communication review

See `docs/SECURITY-REPORT.docx` for the full assessment report.
