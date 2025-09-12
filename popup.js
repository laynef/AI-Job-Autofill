// === Popup-local AI fallback (no service worker required) ===
async function getProfile(){
  return await new Promise(res => chrome.storage.local.get([
    "firstName","lastName","fullName","email","phone","address","city","state","zip","country",
    "linkedin","website","github","gender","race","veteranStatus","disabilityStatus",
    "desiredSalary","relocation","sponsorship","startDate","graduationDate","university","degree","major","gpa",
    "workAuthorization","remotePreference","likertPreference","starRating","coverLetter","apiKey","model"
  ], res));
}
async function callOpenAIFromPopup(apiKey, model, systemPrompt, userPayload){
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) }
      ]
    })
  });
  if (!res.ok){ throw new Error("OpenAI error " + res.status + ": " + (await res.text())); }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(text); } catch { return JSON.parse(text.replace(/```json|```/g, "")); }
}

async function collectFieldsInTab(tabId){
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    func: () => {
      const visible = (el)=>{
        const r=el.getBoundingClientRect();
        const cs=getComputedStyle(el);
        return r.width>0 && r.height>0 && cs.visibility!=="hidden" && cs.display!=="none";
      };
      const getLabel = (el)=>{
        if (el.id){ const l=document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l?.innerText) return l.innerText; }
        for (const a of ["aria-label","placeholder","name","id","title"]){ const v=el.getAttribute?.(a); if (v) return v; }
        const lab = el.closest("label") || el.parentElement?.querySelector("label"); if (lab?.innerText) return lab.innerText;
        const legend = el.closest("fieldset")?.querySelector("legend"); if (legend?.innerText) return legend.innerText;
        return "";
      };
      const fields=[]; const seen=new Set();
      const it=document.createNodeIterator(document, NodeFilter.SHOW_ELEMENT, {
        acceptNode(n){ if (!(n instanceof HTMLElement)) return NodeFilter.FILTER_SKIP; if (!visible(n)) return NodeFilter.FILTER_SKIP; if (n.matches("input,textarea,select")) return NodeFilter.FILTER_ACCEPT; return NodeFilter.FILTER_SKIP; }
      });
      let n, idx=0;
      while(n = it.nextNode()){
        const tag=n.tagName.toLowerCase();
        if (n instanceof HTMLInputElement && n.type==="radio"){
          if (seen.has(n.name)) continue;
          const group = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(n.name)}"]`));
          const options = group.map(r=> (document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "").trim()).filter(Boolean);
          fields.push({ fieldId:`radio:${n.name}`, type:"radio", label:getLabel(n) || n.name, options: Array.from(new Set(options)).slice(0,50) });
          seen.add(n.name);
          continue;
        }
        const options = tag==="select" ? Array.from(n.options||[]).map(o=> (o.text||o.value||"").trim()).filter(Boolean).slice(0,50) : undefined;
        const fid = n.id ? `id:${n.id}` : `idx:${idx++}`;
        fields.push({ fieldId: fid, type: n.type || tag, label: getLabel(n), options });
      }
      return { page: { url: location.href, title: document.title }, fields };
    }
  });
  return result;
}

async function applyAnswersInTab(tabId, answers){
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    args: [answers],
    func: (answers) => {
      const norm = (s)=> (s||"").toString().replace(/\s+/g," ").trim().toLowerCase();
      const visible = (el)=>{
        const r=el.getBoundingClientRect();
        const cs=getComputedStyle(el);
        return r.width>0 && r.height>0 && cs.visibility!=="hidden" && cs.display!=="none";
      };
      const fire = (el, type)=>{
        try{
          el.dispatchEvent(new Event(type,{bubbles:true}));
        }catch{}
      };
      const similarity=(a,b)=>{
        if(a===b) return 1;
        if(!a||!b) return 0;
        if(a.includes(b)||b.includes(a)) return Math.max(0.66, Math.min(a.length,b.length)/Math.max(a.length,b.length));
        const as=new Set(a.split(/\W+/).filter(Boolean)), bs=new Set(b.split(/\W+/).filter(Boolean));
        let inter=0;
        for(const x of as) if(bs.has(x)) inter++;
        return inter/Math.max(1, Math.min(as.size, bs.size));
      };
      function setByType(el, val){
        if (el.matches("select")){
          const target = norm(String(val));
          let best=null, bestScore=0;
          for (const opt of Array.from(el.options||[])){
            const t=norm(opt.text||"");
            const v=norm(opt.value||"");
            const s=Math.max(similarity(t,target), similarity(v,target));
            if (s>bestScore){ best=opt; bestScore=s; }
          }
          if (best){ el.value=best.value; fire(el,"input"); fire(el,"change"); return true; }
          return false;
        }
        if (el.type==="checkbox"){
          const truthy=new Set(["true","yes","y","1","on","checked"]);
          const falsy=new Set(["false","no","n","0","off","unchecked"]);
          const v=norm(String(val));
          if (truthy.has(v)){
            if(!el.checked){ el.click?.(); el.checked=true; }
            fire(el,"change");
            return true;
          }
          if (falsy.has(v)){
            if (el.checked){
              el.click?.();
              el.checked=false;
            }
            fire(el,"change");
            return true;
          }
          return false;
        }
        if (el.type==="date"){
          const s=String(val).trim();
          let out=null;
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) out=s;
          else {
            const d=new Date(s);
            if(!isNaN(d)){
              const yyyy=d.getFullYear();
              const mm=String(d.getMonth()+1).padStart(2,"0");
              const dd=String(d.getDate()).padStart(2,"0");
              out=`${yyyy}-${mm}-${dd}`;
            }
          }
          if (!out) return false;
          el.value=out;
          fire(el,"input");
          fire(el,"change");
          return true;
        }
        el.value = String(val);
        fire(el,"input");
        fire(el,"change");
        return true;
      }
      const map = Object.create(null);
      for (const a of answers||[]) map[a.fieldId] = a.value;
      let filled=0;
      const it=document.createNodeIterator(document, NodeFilter.SHOW_ELEMENT, {
        acceptNode(n){ if (!(n instanceof HTMLElement)) return NodeFilter.FILTER_SKIP; if (!visible(n)) return NodeFilter.FILTER_SKIP; if (n.matches("input,textarea,select")) return NodeFilter.FILTER_ACCEPT; return NodeFilter.FILTER_SKIP; }
      });
      let n, idx=0;
      while(n = it.nextNode()){
        let fid = n.id ? `id:${n.id}` : `idx:${idx++}`;
        if (n instanceof HTMLInputElement && n.type==="radio"){
          fid = `radio:${n.name}`;
        }
        const val = map[fid];
        if (val == null) continue;
        if (n instanceof HTMLInputElement && n.type==="radio"){
          const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(n.name)}"]`);
          let best=null, bestScore=0, target=norm(String(val));
          for (const r of group){
            const lbl=document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "";
            const s=similarity(norm(lbl), target);
            if (s>bestScore){ best=r; bestScore=s; }
          }
          if (best){ if (!best.checked){ best.click?.(); best.checked=true; } fire(best,"change"); filled++; }
          continue;
        }
        if (setByType(n, val)) filled++;
      }
      return { filled };
    }
  });
  return result;
}

async function runPopupLocalAI(tabId, opts){
  const logs = [];
  logs.push('[AI-AUTOFILL] Starting popup-local AI autofill.');
  const profile = await getProfile();
  if (!profile?.apiKey) {
    logs.push('[AI-AUTOFILL] Missing API key.');
    throw new Error("Missing API key in Options (apiKey).");
  }
  const { page, fields } = await collectFieldsInTab(tabId);
  logs.push(`[AI-AUTOFILL] Collected ${fields.length} fields.`);
  const systemPrompt = [
    "You are a precise autofill engine for web forms.",
    "Return strict JSON: { answers: [{ fieldId: string, value: string | number | boolean }] }.",
    "Given profile, page info, and fields (id,label,type,options), choose the correct value for EACH field using only provided knowledge.",
    "For selects/radios return the option text EXACTLY as shown; for checkboxes true/false; for dates YYYY-MM-DD.",
    "Use profile fields when applicable; otherwise choose a neutral valid option (e.g., 'Prefer not to say' when appropriate).",
    "Never include commentary or extra keys."
  ].join(" ");
  const ai = await callOpenAIFromPopup(profile.apiKey, profile.model || "gpt-4o-mini", systemPrompt, { page, profile, fields });
  logs.push(`[AI-AUTOFILL] AI response received.`);
  const answers = ai?.answers || [];
  logs.push(`[AI-AUTOFILL] Mapped ${answers.length} answers.`);
  const applied = await applyAnswersInTab(tabId, answers);
  logs.push(`[AI-AUTOFILL] Filled ${applied.filled} fields.`);
  return { ok:true, frames: [0], results: [{frameId:0, ok:true, filled: applied.filled, logs}], filled: applied.filled, bypass:true, aiLocal:true };
}
// === End popup-local AI fallback ===


// popup.js — minimal popup aligned with popup.html; enables AI mode
function $(id){ return document.getElementById(id); }
async function getActiveTab(){ const [tab] = await chrome.tabs.query({active:true, lastFocusedWindow:true}); return tab; }
async function ensureInjected(tabId){
  try{ const probe = await chrome.tabs.sendMessage(tabId, { type:"PING_AUTOFILL" }); if (probe?.ok) return; }catch{}
  await chrome.scripting.executeScript({ target: { tabId, allFrames:true }, files: ["content.js"] });
}

async function directBroadcastFromPopup(tabId, opts){
  // Fallback path: enumerate frames and message them from the popup itself
  try{
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const results = [];
    for (const f of frames){
      try{
        const res = await chrome.tabs.sendMessage(tabId, { type:"AUTOFILL_NOW", opts }, { frameId: f.frameId });
        results.push({ frameId: f.frameId, ok: !!res?.ok, filled: res?.filled ?? 0, error: res?.error, logs: res?.logs });
      }catch(e){
        results.push({ frameId: f.frameId, ok: false, filled: 0, error: e?.message || String(e) });
      }
    }
    const totalFilled = results.reduce((a,b)=> a + (b.filled||0), 0);
    return { ok:true, frames: results.map(r=>r.frameId), results, filled: totalFilled, bypass:true };
  }catch(e){
    return { ok:false, error: e?.message || String(e) };
  }
}

async function broadcastAutofill(opts){
  const tab = await getActiveTab(); if (!tab?.id) return { ok:false, error:"No active tab" };
  await ensureInjected(tab.id);


try {
  const p = chrome.runtime.sendMessage({ type:"BROADCAST_AUTOFILL", tabId: tab.id, opts });
  const res = await Promise.race([
    p,
    new Promise((_, rej) => setTimeout(()=> rej(new Error("Timed out talking to background (service worker).")), 6000))
  ]);
  if (!res || res.ok !== true) {
    // Background unavailable — run popup-local AI path
    return await runPopupLocalAI(tab.id, opts);
  }
  return res;
} catch (e) {
  return { ok:false, error: e?.message || String(e) };
}

}
function setStatus(s){ const el=$("status"); if (el) el.textContent=s; const log=$("log"); if (log) log.value = (new Date().toLocaleTimeString()+" — "+s+"\n"+log.value).slice(0,8000); }
function setBadges(filled, frames){ const f=$("filledCount"); const fr=$("frameCount"); if (f) f.textContent = `${filled ?? 0} filled`; if (fr) fr.textContent = `frames: ${frames ?? 0}`; }
async function loadFlags(){ try{ const v = await new Promise(r=> chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], r)); const a=$("autorun"); const g=$("aggressive"); if (a) a.checked=!!v.autoFillOnLoad; if (g) g.checked=!!v.aggressiveMode; }catch{} }
async function saveFlags(){ const a=$("autorun"); const g=$("aggressive"); try{ await chrome.storage.local.set({ autoFillOnLoad: !!(a&&a.checked), aggressiveMode: !!(g&&g.checked) }); }catch{} }

document.addEventListener("DOMContentLoaded", () => {
  const runBtn = $("run"); const autorun=$("autorun"); const aggressive=$("aggressive");
  if (autorun) autorun.addEventListener("change", saveFlags);
  if (aggressive) aggressive.addEventListener("change", saveFlags);
  if (runBtn) runBtn.addEventListener("click", async () => {
    await saveFlags();
    setStatus("Answering with AI…");
    try{
      const res = await broadcastAutofill({ ai: true });
      
      if (res?.ok){
        setBadges(res.filled, res.frames?.length);
        setStatus(`Completed across ${res.frames?.length ?? 1} frame(s). Filled: ${res.filled ?? 0}`);
        if (Array.isArray(res.results)) {
          const errs = res.results.filter(r=>!r.ok && r.error).map(r=>`frame ${r.frameId}: ${r.error}`);
          if (errs.length) setStatus("Partial errors — " + errs[0]);

          const allLogs = res.results.flatMap(r => r.logs || []);
          const logArea = $("log");
          if (logArea) logArea.value = allLogs.join('\n');
        }
      } else {
        const msg = res?.error || (Array.isArray(res?.results) && res.results.find(r=>!r.ok)?.error) || ("Unknown error. Raw: " + JSON.stringify(res));
        setStatus("Failed: " + msg);
      }

    }catch(e){ setStatus("Failed: " + (e?.message || String(e))); }
  });
  loadFlags();
});