// content.js — Reliable, profile-based autofill (no guesses)
(function(){
  const DBG = false;
  const N_A = "N/A";
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

  const norm = (s)=> (s||"").toString().replace(/\s+/g," ").trim().toLowerCase();

  const FIELDS = {
    fullName: ["full name","name","your name"],
    firstName: ["first name","given name"],
    lastName: ["last name","surname","family name"],
    email: ["email","e-mail","email address"],
    phone: ["phone","phone number","mobile","cell"],
    address: ["address","street address","street"],
    city: ["city","town"],
    state: ["state","province","region"],
    zip: ["zip","postal code","zip code","postcode"],
    country: ["country"],
    linkedin: ["linkedin","linkedin url","linkedin profile"],
    website: ["website","portfolio","portfolio url","personal site","site url"],
    github: ["github","github url","github profile"],
    gender: ["gender"],
    race: ["race","ethnicity"],
    veteranStatus: ["veteran status","veteran"],
    disabilityStatus: ["disability status","disability"],
    desiredSalary: ["desired salary","expected salary","salary","compensation","pay","rate"],
    relocation: ["relocation","willing to relocate","open to relocate"],
    sponsorship: ["sponsorship","require sponsorship","visa sponsorship","work visa"],
    startDate: ["start date","available from","availability date","availability"],
    graduationDate: ["graduation date","grad date"],
    university: ["university","college","school"],
    degree: ["degree","qualification"],
    major: ["major","field of study","concentration"],
    gpa: ["gpa","grade point average"],
    workAuthorization: ["work authorization","work eligibility","work permit","work status","citizenship"],
    remotePreference: ["remote","work preference","work location","on-site","onsite","hybrid","office preference"],
    likertPreference: ["likert","preference scale","satisfaction","level"],
    starRating: ["rating","stars"]
  };

  function visible(el){
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return !!(r.width && r.height) && style.visibility !== "hidden" && style.display !== "none";
  }

  function labelTextFor(el){
    // 1) associated <label for=...>
    if (el.id){
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl && lbl.innerText) return lbl.innerText;
    }
    // 2) aria-label / placeholder / name / id
    const attrs = ["aria-label","placeholder","name","id","title"];
    for (const a of attrs){
      const v = el.getAttribute && el.getAttribute(a);
      if (v) return v;
    }
    // 3) nearest label ancestor/sibling
    const lab = el.closest("label") || el.parentElement?.querySelector("label");
    if (lab && lab.innerText) return lab.innerText;
    // 4) fieldset legend
    const fs = el.closest("fieldset");
    const legend = fs?.querySelector("legend");
    if (legend && legend.innerText) return legend.innerText + " " + (el.placeholder || "");
    // 5) preceding text node
    let t = "", n = el;
    for (let i=0;i<3 && n;i++){
      const prev = n.previousElementSibling;
      if (prev && prev.innerText){ t = prev.innerText; break; }
      n = n.parentElement;
    }
    return t || "";
  }

  function bestFieldKey(rawLabel){
    const L = norm(rawLabel);
    let best = null, bestScore = 0;
    for (const [key, syns] of Object.entries(FIELDS)){
      for (const s of syns){
        const score = similarity(L, norm(s));
        if (score > bestScore){ bestScore = score; best = key; }
      }
    }
    // require strong confidence
    return bestScore >= 0.62 ? best : null;
  }

  function similarity(a, b){
    if (a === b) return 1;
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return Math.max(0.66, Math.min(a.length, b.length) / Math.max(a.length, b.length));
    const as = new Set(a.split(/\W+/).filter(Boolean));
    const bs = new Set(b.split(/\W+/).filter(Boolean));
    let inter = 0; for (const x of as) if (bs.has(x)) inter++;
    return inter / Math.max(1, Math.min(as.size, bs.size));
  }

  async function loadProfile(){
    try{
      const keys = [
        "firstName","lastName","fullName","email","phone","address","city","state","zip","country",
        "linkedin","website","github","gender","race","veteranStatus","disabilityStatus",
        "desiredSalary","relocation","sponsorship","startDate","graduationDate","university","degree","major","gpa",
        "workAuthorization","remotePreference","likertPreference","starRating","coverLetter"
      ];
      return await new Promise(res=> chrome.storage.local.get(keys, res));
    }catch(e){ return {}; }
  }

  function setNativeValue(el, value){
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                : el instanceof HTMLInputElement ? HTMLInputElement.prototype
                : null;
    if (!proto) return;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }
  const fire = (el, type)=>{ try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch(_){} };

  function setInput(el, value){
    if (el.type === "date"){
      const d = normalizeDate(value);
      if (!d) return false;
      setNativeValue(el, d);
      fire(el, "input"); fire(el, "change"); return true;
    }
    if (typeof value === "number") value = String(value);
    if (!value) return false;
    setNativeValue(el, value);
    fire(el, "input"); fire(el, "change"); return true;
  }

  function normalizeDate(v){
    if (!v) return null;
    const s = String(v).trim();
    // already yyyy-mm-dd
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

  function setCheckbox(el, value){
    const v = norm(value);
    const truthy = new Set(["yes","true","y","1","on","checked","i do","i agree"]);
    const falsy  = new Set(["no","false","n","0","off","unchecked","i do not","i disagree"]);
    if (truthy.has(v)){ if (!el.checked) { el.click?.(); el.checked = true; fire(el, "change"); } return true; }
    if (falsy.has(v)){ if (el.checked) { el.click?.(); el.checked = false; fire(el, "change"); } return true; }
    return false;
  }

  function setRadioGroup(el, value){
    const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
    const v = norm(value);
    let best = null, bestScore = 0;
    for (const r of group){
      const lbl = document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "";
      const s = similarity(norm(lbl), v);
      if (s > bestScore){ best = r; bestScore = s; }
    }
    if (best && bestScore >= 0.66){
      if (!best.checked){ best.click?.(); best.checked = true; fire(best, "change"); }
      return true;
    }
    return false;
  }

  function setSelect(el, value){
    const v = norm(value);
    let best = null, bestScore = 0;
    for (const opt of Array.from(el.options || [])){
      const t = norm(opt.text || "");
      const val = norm(opt.value || "");
      const s = Math.max(similarity(t, v), similarity(val, v));
      if (s > bestScore){ best = opt; bestScore = s; }
    }
    if (best && bestScore >= 0.66){
      el.value = best.value;
      fire(el,"input"); fire(el,"change");
      return true;
    }
    return false;
  }

  function chooseValueForKey(key, profile){
    switch (key){
      case "fullName": {
        return profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
      }
      case "likertPreference":
        return profile.likertPreference ?? null;
      case "starRating":
        return profile.starRating ?? null;
      default:
        return profile[key] ?? null;
    }
  }

  function fillElement(el, profile){
    if (!visible(el)) return false;
    const raw = labelTextFor(el);
    const key = bestFieldKey(raw);
    if (!key) return false;

    // cover letter textarea
    if (el.tagName === "TEXTAREA" && /cover\s*letter/i.test(raw)){
      const v = profile.coverLetter;
      if (v) return setInput(el, v);
      return false;
    }

    const value = chooseValueForKey(key, profile);
    if (value == null || value === "") return false;

    if (el.matches("select"))  return setSelect(el, value);
    if (el.type === "checkbox") return setCheckbox(el, value);
    if (el.type === "radio")    return setRadioGroup(el, value);
    return setInput(el, value);
  }

  function* iterInteractive(root=document){
    const walker = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node){
        if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
        if (!visible(node)) return NodeFilter.FILTER_SKIP;
        if (node.matches("input,textarea,select")) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    });
    let n; while (n = walker.nextNode()) yield n;
  }

  async function autofillAll(){
    const profile = await loadProfile();
    let filled = 0;
    for (const el of Array.from(iterInteractive(document))){
      try { if (fillElement(el, profile)) filled++; } catch(e){ if (DBG) console.warn(e); }
    }
    return { filled };
  }

  // Message bridge
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
    if (msg?.type === "PING_AUTOFILL"){ try { sendResponse({ ok: true }); } catch(_){} return true; }
    if (msg?.type === "AUTOFILL_NOW"){
      autofillAll().then(res => sendResponse({ ok:true, ...res }))
                   .catch(e => sendResponse({ ok:false, error: e?.message || String(e) }));
      return true;
    }
  });

  // Optional: run if configured
  try{
    chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], (v)=>{
      if (v?.autoFillOnLoad) autofillAll();
    });
  }catch(_){}
})();