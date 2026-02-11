# Privacy Policy

## Summary

Mosaic does not collect, transmit, or share any user data. All data stays in your browser.

## Data Storage

The extension stores the following data locally in `chrome.storage.local` (encrypted at rest by Chrome, per-profile, never transmitted):

| Data | Purpose | Retention |
|---|---|---|
| Active providers list | Remember which AI panels to show | Until changed |
| Layout preference | Remember grid layout choice | Until changed |
| Sidebar state | Remember collapsed/expanded | Until changed |
| Prompt history | Allow reuse of recent prompts | Last 50 entries; clearable |

## Data NOT Collected

- No browsing history
- No personal information
- No AI conversation content (conversations happen directly between your browser and each AI provider)
- No analytics or telemetry
- No crash reports
- No cookies or session tokens

## Network Activity

This extension makes **zero network requests**. All AI conversations flow directly between your browser and each AI provider's servers through standard iframe loading. The extension does not proxy, intercept, read, or store any conversation data.

## Third Parties

This extension contains **zero third-party code**. No external scripts, CDNs, analytics libraries, or tracking pixels.

## Clearing Data

To clear all extension data:
1. Go to `chrome://extensions/`
2. Find Mosaic
3. Click "Details" → "Clear data"

Or use Chrome's "Clear browsing data" with "Cookies and other site data" selected.

## AI Provider Sessions

The extension uses your existing browser login sessions for each AI provider. It does not handle, store, or have access to your login credentials. Authentication is managed entirely by each provider's own systems.
