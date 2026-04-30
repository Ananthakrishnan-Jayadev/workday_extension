# Workday Autofill

A Chrome/Edge browser extension that helps autofill Workday job application forms on `myworkdayjobs.com` using values from `data.json`.

## Files

- `manifest.json` - Manifest V3 extension configuration.
- `content.js` - Content script that runs on Workday job pages and fills matching form fields.
- `data.example.json` - Sanitized example profile data showing the expected structure.
- `data.json` - Local private profile/application data used by the autofill script. This file is ignored by Git.
- `popup.html` - Extension popup UI.
- `popup.js` - Popup status logic for checking whether the current tab is a Workday page.

## Setup

1. Copy `data.example.json` to `data.json`.
2. Update `data.json` with your own application details.
3. Open Chrome or Edge and go to the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Enable developer mode.
5. Select **Load unpacked**.
6. Choose this repository folder.

## Usage

Navigate to a job application page on `myworkdayjobs.com`. The extension content script loads automatically and attempts to fill supported fields from `data.json`.

Click the extension icon to confirm whether the current tab is a supported Workday page.

## Development Notes

- This extension uses Manifest V3.
- It only runs on URLs matching `*://*.myworkdayjobs.com/*`.
- `data.json` is ignored by Git because it can contain sensitive personal information.
- Keep `data.example.json` free of real personal data so it can be safely committed.
