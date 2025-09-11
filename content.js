
/**
 * AI Job Application Autofill — robust content script
 * - Fills ALL input types, including:
 *   text, textarea, number, email, tel, date, url
 *   radio / checkbox (by label text)
 *   <select> dropdowns (best-match option)
 *   custom dropdowns & button groups (role-based + heuristics)
 * - Avoids "skipping" button & dropdown selections by actively clicking.
 * - Works on dynamically added fields via MutationObserver.
 *
 * Trigger:
 *  1) Popup sends {type:'AUTOFILL_NOW'} via chrome.tabs.sendMessage
 *  2) Or set storage key autoFillOnLoad=true to run automatically.
 */

(function() {
  const DBG = false;
  const log = (...args) => { if (DBG) console.log("[Autofill]", ...args); };

  // Utility: normalize text
  const norm = (s) => (s || "")
    .toString()
    .replace(/\s+/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim()
    .toLowerCase();

  // Utility: confidence scoring for string similarity (very lightweight)
  function scoreMatch(needle, hay) {
    needle = norm(needle);
    hay = norm(hay);
    if (!needle || !hay) return 0;
    if (hay === needle) return 1.0;
    if (hay.includes(needle)) return Math.max(0.6, Math.min(0.95, needle.length / (hay.length + 0.0001)));
    // token overlap
    const nT = new Set(needle.split(" "));
    const hT = new Set(hay.split(" "));
    let inter = 0;
    for (const t of nT) if (hT.has(t)) inter++;
    return inter / Math.max(1, nT.size);
  }

  // Extract text near an element (label, aria, placeholder, preceding text)
  function getFieldHints(el) {
    const hints = [];
    const add = (s, tag="") => { if (s && norm(s)) hints.push({text: s, tag}); };

    // associated <label for>
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) add(lbl.innerText || lbl.textContent || "", "label-for");
    }

    // parent label
    let p = el.parentElement;
    let hops = 0;
    while (p && hops < 3) {
      if (p.tagName && p.tagName.toLowerCase() === "label") {
        add(p.innerText || p.textContent || "", "label-parent");
        break;
      }
      p = p.parentElement;
      hops++;
    }

    // aria
    add(el.getAttribute("aria-label"), "aria-label");
    add(el.getAttribute("aria-labelledby"), "aria-labelledby");
    // placeholder
    add(el.getAttribute("placeholder"), "placeholder");

    // preceding text (same container)
    let sibling = el.previousElementSibling;
    if (sibling && (sibling.innerText || sibling.textContent)) {
      add(sibling.innerText || sibling.textContent, "prev-sibling");
    }

    // nearby heading or question text
    let cur = el;
    for (let i = 0; i < 4 && cur; i++) {
      const txt = (cur.innerText || cur.textContent || "").trim();
      const firstLine = txt.split("\n").map(x => x.trim()).filter(Boolean)[0];
      if (firstLine && firstLine.length > 3 && firstLine.length < 160) add(firstLine, "ancestor");
      cur = cur.parentElement;
    }

    // name/id
    add(el.name, "name");
    add(el.id, "id");

    // data-* attributes
    for (const attr of el.getAttributeNames ? el.getAttributeNames() : []) {
      if (attr.startsWith("data-")) add(el.getAttribute(attr), attr);
    }

    return hints;
  }

  // Find best value from profile for a field, using hints
  function pickProfileValue(hints, profile) {
    // mapping of canonical keys to synonyms
    const keyMap = {
      firstName: ["first name", "given name", "forename"],
      lastName: ["last name", "surname", "family name"],
      fullName: ["full name", "name (first and last)", "contact name"],
      email: ["email", "e-mail", "email address"],
      phone: ["phone", "mobile", "tel", "telephone", "cell"],
      city: ["city", "town"],
      state: ["state", "province", "region"],
      country: ["country"],
      zip: ["zip", "zipcode", "postal code", "postcode"],
      address: ["address", "street address", "address line"],
      linkedin: ["linkedin", "linkedin url", "linkedin profile"],
      website: ["website", "portfolio", "personal site", "github pages", "url"],
      github: ["github", "github url", "github profile"],
      gender: ["gender", "sex"],
      race: ["race", "ethnicity"],
      veteranStatus: ["veteran", "veteran status"],
      disabilityStatus: ["disability", "disability status"],
      desiredSalary: ["salary", "pay", "compensation"],
      coverLetter: ["cover letter", "motivation", "why us", "statement"],
      relocation: ["relocation", "willing to relocate"],
      sponsorship: ["sponsorship", "visa", "work authorization"],
      startDate: ["start date", "availability"],
      graduationDate: ["graduation", "grad date"],
      university: ["university", "college", "school"],
      degree: ["degree", "education level"],
      major: ["major", "field of study"],
      gpa: ["gpa", "grade point average"],
    };

    // Build candidates with scores
    const candidates = [];
    for (const [key, synonyms] of Object.entries(keyMap)) {
      const val = profile[key];
      if (!val) continue;
      for (const h of hints) {
        const arr = [key, ...synonyms];
        for (const syn of arr) {
          const s = scoreMatch(syn, h.text);
          if (s >= 0.45) candidates.push({ key, val, score: s + (h.tag?.includes("label") ? 0.05 : 0) });
        }
      }
    }

    // Prefer exact keys when present in hints (e.g., "gender", "race" in name/id)
    for (const h of hints) {
      const k = norm(h.text).replace(/[^a-z]/g, "");
      if (profile[k]) {
        candidates.push({ key: k, val: profile[k], score: 0.95 });
      }
    }

    // Fallback using placeholder matches to known simple defaults
    if (!candidates.length) {
      for (const h of hints) {
        const ht = norm(h.text);
        if (ht.includes("email") && profile.email) candidates.push({ key: "email", val: profile.email, score: 0.5 });
        if (ht.includes("name") && profile.fullName) candidates.push({ key: "fullName", val: profile.fullName, score: 0.5 });
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a,b) => b.score - a.score);
    return candidates[0];
  }

  // Set value safely and dispatch events
  function setValue(el, value) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") {
      const type = (el.type || "").toLowerCase();
      if (["checkbox","radio"].includes(type)) {
        el.checked = !!value;
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (tag === "select") {
      // Try exact, then case-insensitive, then fuzzy
      const opts = Array.from(el.options || []);
      if (!opts.length) return false;

      // Support value match
      let chosen = opts.find(o => norm(o.value) === norm(value));
      if (!chosen) chosen = opts.find(o => norm(o.text) === norm(value));
      if (!chosen) {
        let best = {score: 0, opt: null};
        for (const o of opts) {
          const s = Math.max(scoreMatch(value, o.text), scoreMatch(value, o.value));
          if (s > best.score) best = {score: s, opt: o};
        }
        if (best.opt && best.score >= 0.45) chosen = best.opt;
      }
      if (chosen) {
        el.value = chosen.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Click a button-like element whose text matches value
  function clickMatchingButton(container, value) {
    const candidates = [
      ...container.querySelectorAll('button, [role="button"], .btn, .button'),
    ].filter(el => el.offsetParent !== null); // visible-ish
    const target = bestTextMatch(candidates, value);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  function bestTextMatch(els, value) {
    const v = norm(value);
    let best = null, bestScore = 0;
    for (const el of els) {
      const t = norm(el.innerText || el.textContent || el.getAttribute("aria-label") || "");
      const s = scoreMatch(v, t);
      if (s > bestScore) { best = el; bestScore = s; }
      if (t === v) return el;
    }
    return bestScore >= 0.45 ? best : null;
  }

  // Handle radio/checkbox groups
  function setChoice(el, value) {
    const type = (el.type || "").toLowerCase();
    if (type === "radio" || type === "checkbox") {
      const name = el.name || el.id;
      if (!name) return false;
      const group = Array.from(document.querySelectorAll(`input[type="${type}"][name="${CSS.escape(name)}"]`));
      if (!group.length) return false;

      // Match by associated label text or value
      const labeled = group.map(input => {
        let text = "";
        // <label for>
        if (input.id) {
          const lbl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (lbl) text = lbl.innerText || lbl.textContent || "";
        }
        // Wrapping label
        if (!text) {
          let p = input.parentElement;
          let hops = 0;
          while (p && hops < 3 && !text) {
            if (p.tagName && p.tagName.toLowerCase() === "label") {
              text = p.innerText || p.textContent || "";
              break;
            }
            p = p.parentElement;
            hops++;
          }
        }
        return { input, text, value: input.value };
      });

      // Try exact match then fuzzy
      let target = labeled.find(x => norm(x.text) === norm(value) || norm(x.value) === norm(value));
      if (!target) {
        let best = {score: 0, cand: null};
        for (const x of labeled) {
          const s = Math.max(scoreMatch(value, x.text), scoreMatch(value, x.value));
          if (s > best.score) best = {score: s, cand: x};
        }
        target = best.score >= 0.45 ? best.cand : null;
      }
      if (target) {
        target.input.click();
        target.input.dispatchEvent(new Event("input", { bubbles: true }));
        target.input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Handle custom dropdowns (div[role="listbox"], button + menu, etc.)
  function setCustomDropdown(el, value) {
    // Heuristics: find nearest button/listbox and click matching option
    let container = el.closest('[role="listbox"], [role="combobox"], [data-testid], .Select, .select, .dropdown, .ui-dropdown, .css-1s2u09g-container') || el.parentElement;
    if (!container) return false;

    // If it's a closed combobox/button, open it
    const opener = container.querySelector('[aria-haspopup="listbox"], [role="button"], button');
    if (opener && opener.getAttribute("aria-expanded") !== "true") {
      opener.click();
    }

    // Options
    let options = [
      ...container.querySelectorAll('[role="option"], li, .option, .dropdown-item')
    ].filter(x => x.offsetParent !== null);

    if (!options.length) {
      // try global open menu
      options = Array.from(document.querySelectorAll('[role="option"], .dropdown-item')).filter(x => x.offsetParent !== null);
    }

    const choice = bestTextMatch(options, value);
    if (choice) {
      choice.click();
      // bubble change on any coupled input/select
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  // Main fill routine for a single element
  function fillElement(el, profile) {
    try {
      if (!el || el.disabled || el.readOnly) return false;
      if (el.offsetParent === null) return false; // hidden

      const tag = (el.tagName || "").toLowerCase();
      const type = (el.type || "").toLowerCase();
      if (!["input","textarea","select"].includes(tag)) return false;

      const hints = getFieldHints(el);
      const picked = pickProfileValue(hints, profile);
      if (!picked) return false;

      const value = picked.val;

      // Switch on element type
      if (tag === "select") {
        return setValue(el, value) || setCustomDropdown(el, value);
      }

      if (tag === "input") {
        if (["radio","checkbox"].includes(type)) {
          return setChoice(el, value);
        }
        // for datalist-backed inputs, try direct set first
        const ok = setValue(el, value);
        if (ok) return true;

        // Custom dropdown masquerading as input (readonly, aria-haspopup)
        if (el.getAttribute("aria-haspopup") === "listbox" || el.readOnly) {
          return setCustomDropdown(el, value);
        }
        return false;
      }

      if (tag === "textarea") {
        return setValue(el, value);
      }

      return false;
    } catch (e) {
      console.warn("fillElement error", e);
      return false;
    }
  }

  // Walk DOM (including shadow roots)
  function* iterFields(root=document) {
    const walker = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const tag = node.tagName ? node.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select") {
        yield node;
      }
      // explore shadow DOM
      if (node.shadowRoot) {
        for (const n of iterFields(node.shadowRoot)) yield n;
      }
    }
  }

  async function loadProfile() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(null, (data) => {
          if (chrome.runtime.lastError) {
            console.error("Storage get error:", chrome.runtime.lastError.message);
            resolve({});
          } else {
            // Provide some synthesized fields
            const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
            resolve({ fullName, ...data });
          }
        });
      } catch {
        resolve({});
      }
    });
  }

  async function autofillAll() {
    const profile = await loadProfile();
    log("Profile loaded", profile);

    const fields = Array.from(iterFields(document));
    let filled = 0;

    for (const el of fields) {
      const ok = fillElement(el, profile);
      if (ok) filled++;
    }

    // Button groups / yes-no questions without explicit inputs
    // Try to click buttons that match profile for common keys
    const pairs = [
      ["relocation", profile.relocation],
      ["sponsorship", profile.sponsorship],
      ["gender", profile.gender],
      ["race", profile.race],
      ["veteranStatus", profile.veteranStatus],
      ["disabilityStatus", profile.disabilityStatus],
    ].filter(([k,v]) => v);

    for (const [key, val] of pairs) {
      // find containers with the key in text and click matching button
      const qs = Array.from(document.querySelectorAll("section, div, fieldset, form"));
      for (const c of qs) {
        const txt = norm(c.innerText || "");
        if (!txt || !txt.includes(norm(key))) continue;
        if (clickMatchingButton(c, val)) filled++;
      }
    }

    log(`Autofill complete. Filled: ${filled}`);
    return filled;
  }

  // Observe for dynamic fields and fill once
  let observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mut) => {
      for (const m of mut) {
        for (const n of Array.from(m.addedNodes || [])) {
          if (!(n instanceof Element)) continue;
          // try to fill any new inputs immediately
          for (const el of n.querySelectorAll?.("input, textarea, select") || []) {
            loadProfile().then(profile => fillElement(el, profile));
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Listen for popup trigger
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "AUTOFILL_NOW") {
      autofillAll().then(count => sendResponse({ ok: true, filled: count }));
      return true; // async
    }
  });

  // Optionally auto-run
  try {
    chrome.storage.local.get(["autoFillOnLoad"], v => {
      if (v && v.autoFillOnLoad) autofillAll();
      startObserver();
    });
  } catch {
    startObserver();
  }
})();
