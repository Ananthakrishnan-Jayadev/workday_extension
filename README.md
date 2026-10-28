# Workday Autofill

A Chrome/Edge/Firefox browser extension that helps autofill Workday job application forms on `myworkdayjobs.com` using your saved profile data.

## Files

- `manifest.json` - Manifest V3 extension configuration.
- `content.js` - Content script that runs on Workday job pages and fills matching form fields.
- `data.example.json` - Sanitized example profile data showing the expected structure.
- `data.json` - Optional local profile file, used only if no profile is saved on the options page. This file is ignored by Git.
- `options.html` / `options.js` - Options page for pasting, saving, and importing your profile JSON (stored in `chrome.storage.local`).
- `popup.html` - Extension popup UI.
- `popup.js` - Popup status logic and a link to the options page.

## Setup

### Chrome / Edge

1. Open the extensions page (`chrome://extensions` or `edge://extensions`).
2. Enable developer mode.
3. Select **Load unpacked** and choose this repository folder.

### Firefox (109+)

1. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on…** and select `manifest.json`.
   Temporary add-ons are removed when Firefox restarts. For a permanent install, sign it as an unlisted add-on
   (e.g. `web-ext sign --channel=unlisted`) or use Developer Edition/Nightly with `xpinstall.signatures.required` set to `false`.
2. If fields are not filled, make sure the extension is allowed on `myworkdayjobs.com`
   (Extensions menu → Workday Autofill → allow on this site). Firefox treats MV3 site access as user-controlled.

### Profile data

1. Click the extension icon → **Edit profile data** (or open the extension's options page).
2. Paste your profile JSON, using `data.example.json` as a template, and click **Save**.

If you previously used a `data.json` file, click **Import bundled data.json** on the options page, then **Save**.
After that you can delete `data.json`, which keeps personal data out of any packaged or signed build.

## Usage

Navigate to a job application page on `myworkdayjobs.com`. The extension content script loads automatically and attempts to fill supported fields from your saved profile (falling back to `data.json` if no profile is saved).

Click the extension icon to confirm whether the current tab is a supported Workday page.

## What gets filled

| Workday page | Fields |
|---|---|
| My Information | Name, address, city, postal code, country/region, phone type, phone number (digits only, committed on blur), previous worker, how you heard about us |
| My Experience | Work history (title, company, location, dates, description), education (school, degree, field of study, GPA, years), certifications, languages and proficiency, skills, LinkedIn |
| Application Questions | Common eligibility questions matched by keywords in the question text (see `applicationQuestions`) |
| Voluntary Disclosures | Sex and race/ethnicity dropdowns, plus checkbox questions matched by keywords (see `voluntaryDisclosures`) |

Anything that cannot be matched is skipped and logged to the browser console with the `[Workday Autofill]` prefix.

## Profile data format

See `data.example.json` for the full structure. Notable options:

- **Fallback lists** — `education[].degree`, `education[].fieldOfStudy`, and `languages[].proficiency` accept either a single value or a list tried in order. Field of study moves to the next value when Workday shows "No matches found".
  ```json
  "degree": ["Post-graduate certificate/diploma", "Post-graduate certificate", "Master's Degree"],
  "fieldOfStudy": ["Artificial Intelligence", "Computer Science"]
  ```
- **Languages** — `proficiency` applies to every proficiency dropdown (Listening, Reading, Overall, …), or use an object to set them per type: `{ "default": "Fluent", "Writing": "Advanced" }`.
- **Skills** — each skill is searched, given 3 seconds to load, and the best-matching result's checkbox is ticked (e.g. `Python` → "Python (Programming Language)"). Each skill takes about 4 seconds, so keep the list short.
- **Voluntary disclosures** — `sex` and `ethnicity` pick from dropdowns (prefix match, so `"South Asian"` matches the full option label). `questions` maps keywords in a question to an answer:
  ```json
  "questions": [{ "match": ["gender identity"], "answer": "Man" }]
  ```
  Use the exact option label for short answers such as `"No"` or `"No (Canada)"`.
- Leave an answer empty (`""`) to skip that question and answer it yourself.

Text matching ignores case, apostrophes, hyphens, and slashes, and prefers exact matches over partial ones.

## Development Notes

- This extension uses Manifest V3 and runs on Chrome, Edge, and Firefox from one manifest (`browser_specific_settings` is Firefox-only and ignored elsewhere).
- It only runs on URLs matching `*://*.myworkdayjobs.com/*`.
- `data.json` is ignored by Git because it can contain sensitive personal information.
- Keep `data.example.json` free of real personal data so it can be safely committed.
