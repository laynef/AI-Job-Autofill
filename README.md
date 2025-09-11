# AI Autofill — All Inputs (v1.7)

**What’s fixed**
- Selects: exact → case-insensitive → fuzzy match on option text/value
- Radio/Checkbox: choose by associated label or value; synthetic click to trigger frameworks
- Custom dropdowns (combobox/listbox/React selects): open menu and click best-matching option
- Button groups (Yes/No): match nearby question text and click the right button
- Frames: broadcast to **all frames** (iframes) so embedded ATS widgets are filled
- SPA/React inputs: uses native value setter to trigger React synthetic events
- Dynamic fields: MutationObserver fills new inputs as they appear
- Shadow DOM traversal for modern UI libraries
- Aggressive mode (toggle in popup): focus/scroll/blur to satisfy validators

**How to use**
1. Load this folder as an Unpacked extension in `chrome://extensions`.
2. Open **Options** and set your profile values (short literal values work best for selects).
3. On a form page, open the extension and click **Fill now**. Enable **Aggressive** if a site is stubborn.
4. (Optional) Enable **Auto-fill on load** in the popup.

**Notes**
- File uploads cannot be set programmatically; you must click and select files manually.
- If a site uses very custom option markup, add selectors inside `setCustomDropdown()` in `content.js`.
