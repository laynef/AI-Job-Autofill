// content.js — v5: answer EVERY mapped question correctly from Options profile
(function(){
  const DBG = false;

  // Normalize helpers
  const norm = (s)=> (s||"").toString().replace(/\s+/g," ").trim().toLowerCase();
  const visible = (el)=>{
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width>0 && r.height>0 && cs.visibility!=="hidden" && cs.display!=="none";
  };
  const fire = (el, type)=>{ try{ el.dispatchEvent(new Event(type,{bubbles:true})); }catch{} };

  // Load profile from chrome.storage.local
  async function loadProfile(){
    const keys = [
      "firstName","lastName","fullName","email","phone","address","city","state","zip","country",
      "linkedin","website","github",
      "gender","race","veteranStatus","disabilityStatus",
      "desiredSalary","relocation","sponsorship",
      "startDate","graduationDate","university","degree","major","gpa",
      "workAuthorization","remotePreference","likertPreference","starRating",
      "coverLetter"
    ];
    try{ return await new Promise(r=> chrome.storage.local.get(keys, r)); } catch { return {}; }
  }

  // Synonyms & detectors
  const KEYWORDS = {
    fullName: [/^name\b/i, /full\s*name/i],
    firstName: [/first\s*name/i, /\bgiven name\b/i],
    lastName: [/last\s*name/i, /\bsurname\b/i, /family\s*name/i],
    email: [/\bemail\b/i, /e-?mail/i, /email address/i],
    phone: [/\bphone\b/i, /mobile/i, /\bcell\b/i, /contact number/i],
    address: [/\baddress\b/i, /street/i],
    city: [/\bcity\b/i, /\btown\b/i],
    state: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i],
    zip: [/\bzip\b/i, /\bpostal\b/i, /postcode/i, /zip code/i],
    country: [/\bcountry\b/i],
    linkedin: [/linkedin/i],
    website: [/\bwebsite\b/i, /portfolio/i, /site url/i, /\burl\b/i],
    github: [/github/i],

    gender: [/\bgender\b/i],
    race: [/\brace\b/i, /ethnicity/i],
    veteranStatus: [/veteran/i],
    disabilityStatus: [/disability/i],

    desiredSalary: [/desired.*salary/i, /expected.*salary/i, /\bsalary\b/i, /compensation/i, /\bpay\b/i, /\brate\b/i],
    relocation: [/willing.*relocat/i, /\brelocation\b/i, /\brelocate\b/i],
    sponsorship: [/\bsponsorship\b/i, /require.*sponsor/i, /visa sponsorship/i, /work visa/i],
    startDate: [/\bstart\b/i, /available.*(from|start)/i, /availability date/i, /\bavailability\b/i],
    graduationDate: [/graduation/i, /\bgrad(uation)? date\b/i, /expected.*graduation/i],
    university: [/\buniversity\b/i, /\bcollege\b/i, /\bschool\b/i],
    degree: [/\bdegree\b/i, /\bqualification\b/i],
    major: [/\bmajor\b/i, /field of study/i, /\bconcentration\b/i],
    gpa: [/\bgpa\b/i, /grade point average/i],

    workAuthorization: [/authorized.*work/i, /work authorization/i, /work eligibility/i, /work status/i, /citizenship/i, /\bemployment eligibility\b/i],
    remotePreference: [/\bremote\b/i, /\bonsite\b/i, /\bon-site\b/i, /\bhybrid\b/i, /work (location|arrangement|preference)/i],

    likertPreference: [/\blikert\b/i, /preference scale/i, /satisfaction/i, /\blevel\b/i],
    starRating: [/\brating\b/i, /\bstars?\b/i]
  };

  function matchesAny(txt, patterns){
    for (const re of patterns){ if (re.test(txt)) return true; }
    return false;
  }

  // Extract human-readable text around a control
  function fieldContext(el){
    const parts = [];

    // explicit label
    if (el.id){
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab?.innerText) parts.push(lab.innerText);
    }
    // aria attributes
    const al = el.getAttribute?.("aria-label"); if (al) parts.push(al);
    const alb = el.getAttribute?.("aria-labelledby");
    if (alb){
      alb.split(/\s+/).forEach(id=>{ const n = document.getElementById(id); if (n?.innerText) parts.push(n.innerText); });
    }
    // placeholder, name, id, title
    ["placeholder","name","id","title"].forEach(a=>{ const v = el.getAttribute?.(a); if (v) parts.push(v); });

    // nearby text nodes up the tree
    let cur = el;
    for (let i=0; i<3 && cur; i++){
      const prev = cur.previousElementSibling;
      if (prev?.innerText) parts.push(prev.innerText);
      const lab = cur.closest("label"); if (lab?.innerText) parts.push(lab.innerText);
      const legend = cur.closest("fieldset")?.querySelector("legend"); if (legend?.innerText) parts.push(legend.innerText);
      cur = cur.parentElement;
    }

    // options text (helps recognize the question)
    if (el.tagName === "SELECT"){
      const opts = Array.from(el.options||[]).slice(0,20).map(o=>o.text||o.value).join(" ");
      if (opts) parts.push(opts);
    }
    if (el.type === "radio"){
      const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      const txt = Array.from(group).map(r=>{
        const t = document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "";
        return t;
      }).join(" ");
      if (txt) parts.push(txt);
    }

    return norm(parts.join(" | "));
  }

  function decideKey(el, ctx){
    for (const [key, pats] of Object.entries(KEYWORDS)){
      if (matchesAny(ctx, pats)) return key;
    }
    return null;
  }

  function buildValue(key, profile){
    switch (key){
      case "fullName": return profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
      case "desiredSalary": {
        let v = (profile.desiredSalary ?? "").toString();
        // keep digits and common separators; if it's currency text, strip to digits
        const digits = v.replace(/[^\d.]/g,"");
        return digits || v;
      }
      default: return profile[key] ?? null;
    }
  }

  function setNativeValue(el, value){
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                : el instanceof HTMLInputElement ? HTMLInputElement.prototype
                : null;
    if (!proto) { el.value = value; return; }
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(el, value); else el.value = value;
  }

  function normalizeDate(v){
    if (!v) return null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)){
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  function setTextLike(el, value){
    if (el.type === "date"){
      const d = normalizeDate(value);
      if (!d) return false;
      setNativeValue(el, d);
      fire(el,"input"); fire(el,"change"); return true;
    }
    if (value == null || value === "") return false;
    setNativeValue(el, String(value));
    fire(el,"input"); fire(el,"change"); return true;
  }

  function setCheckbox(el, value){
    const v = norm(value);
    const yes = new Set(["yes","true","y","1","on","checked","i agree","agree"]);
    const no  = new Set(["no","false","n","0","off","unchecked","i do not","disagree"]);
    if (yes.has(v)){ if (!el.checked){ el.click?.(); el.checked = true; fire(el,"change"); } return true; }
    if (no.has(v)){ if (el.checked){ el.click?.(); el.checked = false; fire(el,"change"); } return true; }
    return false;
  }

  function setRadio(el, value){
    const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
    const target = norm(value);
    let best=null, bestScore=0;
    for (const r of group){
      const lbl = document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "";
      const s = similarity(norm(lbl), target);
      if (s > bestScore){ best = r; bestScore = s; }
    }
    if (best && bestScore >= 0.66){
      if (!best.checked){ best.click?.(); best.checked = true; fire(best,"change"); }
      return true;
    }
    return false;
  }

  function setSelect(el, value){
    const target = norm(value);
    let best=null, bestScore=0;
    for (const opt of Array.from(el.options||[])){
      const t = norm(opt.text||"");
      const v = norm(opt.value||"");
      const s = Math.max(similarity(t,target), similarity(v,target));
      if (s > bestScore){ best = opt; bestScore = s; }
    }
    if (best && bestScore >= 0.66){
      el.value = best.value;
      fire(el,"input"); fire(el,"change");
      return true;
    }
    return false;
  }

  function similarity(a,b){
    if (a===b) return 1;
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)){
      return Math.max(0.66, Math.min(a.length,b.length)/Math.max(a.length,b.length));
    }
    const as = new Set(a.split(/\W+/).filter(Boolean));
    const bs = new Set(b.split(/\W+/).filter(Boolean));
    let inter=0; for (const x of as) if (bs.has(x)) inter++;
    return inter/Math.max(1, Math.min(as.size, bs.size));
  }

  function* iterControls(root=document){
    const it = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node){
        if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
        if (!visible(node)) return NodeFilter.FILTER_SKIP;
        if (node.matches("input,textarea,select")) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    });
    let n; while(n = it.nextNode()) yield n;
  }

  async function autofillAll(opts={}){
    const profile = await loadProfile();
    let filled = 0;
    for (const el of iterControls(document)){
      try{
        const ctx = fieldContext(el);
        const key = decideKey(el, ctx);
        if (!key) continue;
        const value = buildValue(key, profile);
        if (value == null || value === "") continue;

        let ok = false;
        if (el.matches("select")) ok = setSelect(el, value);
        else if (el.type === "checkbox") ok = setCheckbox(el, value);
        else if (el.type === "radio") ok = setRadio(el, value);
        else ok = setTextLike(el, value);

        if (ok) filled++;
      }catch(e){ if (DBG) console.warn("fill error", e); }
    }
    return { filled };
  }

  // Message bridge (supports opts)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
    if (msg?.type === "PING_AUTOFILL"){ try{ sendResponse({ok:true}); }catch{} return true; }
    if (msg?.type === "AUTOFILL_NOW"){
      autofillAll(msg.opts || {}).then(res=> sendResponse({ ok:true, ...res }))
                                .catch(e => sendResponse({ ok:false, error: e?.message || String(e) }));
      return true;
    }
  });

  // Optional autorun
  try{ chrome.storage.local.get(["autoFillOnLoad"], v=>{ if (v?.autoFillOnLoad) autofillAll(); }); }catch{}
})();