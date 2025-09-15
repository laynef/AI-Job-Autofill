// content.js — v6 AI-powered: answer every question using Options profile + LLM
(function(){
  // --- Safety wrappers for MV3 SPA pages (e.g., Gmail) ---
function hasRuntime(){ try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch(_) { return false; } }
async function safeSendMessage(msg){
  if (!hasRuntime()) throw new Error("Extension context invalidated");
  return await chrome.runtime.sendMessage(msg);
}
async function safeGet(keys){
  return await new Promise((res) => {
    try {
      if (!hasRuntime()) return res({});
      chrome.storage.local.get(keys, (v)=> res(v || {}));
    } catch(_) { res({}); }
  });
}

  const DBG = false;
  const norm = (s)=> (s||"").toString().replace(/\s+/g," ").trim().toLowerCase();
  const fire = (el, type)=>{ try{ el.dispatchEvent(new Event(type,{bubbles:true})); }catch{} };
  const visible = (el)=>{ const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0 && r.height>0 && cs.visibility!=='hidden' && cs.display!=='none'; };

  function getLabel(el){
    if (el.id){ const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l?.innerText) return l.innerText; }
    const attrs = ["aria-label","placeholder","name","id","title"];
    for (const a of attrs){ const v = el.getAttribute?.(a); if (v) return v; }
    const lab = el.closest("label") || el.parentElement?.querySelector("label"); if (lab?.innerText) return lab.innerText;
    const legend = el.closest("fieldset")?.querySelector("legend"); if (legend?.innerText) return legend.innerText;
    return "";
  }

  function collectFields(){
    const fields = [];
    const seenRadio = new Set();
    const it = document.createNodeIterator(document, NodeFilter.SHOW_ELEMENT, {
      acceptNode(n){
        if (!(n instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
        if (!visible(n)) return NodeFilter.FILTER_SKIP;
        if (n.matches("input,textarea,select")) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    });
    let node; let idx = 0;
    while (node = it.nextNode()){
      const tag = node.tagName.toLowerCase();
      if (node instanceof HTMLInputElement && node.type==="radio"){
        if (seenRadio.has(node.name)) continue;
        const group = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(node.name)}"]`));
        const options = group.map(r=> (document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "").trim()).filter(Boolean);
        fields.push({
          fieldId: `radio:${node.name}`,
          type: "radio",
          label: getLabel(node) || node.name,
          options: Array.from(new Set(options)).slice(0, 30)
        });
        seenRadio.add(node.name);
        continue;
      }
      const options = tag==="select" ? Array.from(node.options||[]).map(o=> (o.text||o.value||"").trim()).filter(Boolean).slice(0, 50) : undefined;
      const fid = node.id ? `id:${node.id}` : `idx:${idx++}`;
      fields.push({
        fieldId: fid,
        type: node.type || tag,
        label: getLabel(node),
        options
      });
    }
    return fields;
  }

  async function loadProfile(){
    try {
      return await safeGet(null); // Get all items from storage
    } catch { return {}; }
  }

  function setNativeValue(el, value){
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                : el instanceof HTMLInputElement ? HTMLInputElement.prototype
                : null;
    const desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(el, value); else el.value = value;
  }
  function normalizeDate(v){
    if (!v) return null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s); if (!isNaN(d)){ const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${yyyy}-${mm}-${dd}`; }
    return null;
  }
  function setByType(el, val){
    if (el.matches("select")){
      const target = norm(String(val));
      let best=null, bestScore=0;
      for (const opt of Array.from(el.options||[])){
        const t=norm(opt.text||""); const v=norm(opt.value||""); const s = Math.max(similarity(t,target), similarity(v,target));
        if (s>bestScore){ best=opt; bestScore=s; }
      }
      if (best){ el.value = best.value; fire(el,"input"); fire(el,"change"); return true; }
      return false;
    }
    if (el.type==="checkbox"){
      const truthy = new Set(["true","yes","y","1","on","checked"]);
      const falsy  = new Set(["false","no","n","0","off","unchecked"]);
      const v = norm(String(val));
      if (truthy.has(v)){ if (!el.checked){ el.click?.(); el.checked=true; } fire(el,"change"); return true; }
      if (falsy.has(v)){ if (el.checked){ el.click?.(); el.checked=false; } fire(el,"change"); return true; }
      return false;
    }
    if (el.type==="date"){
      const d = normalizeDate(val); if (!d) return false;
      setNativeValue(el, d); fire(el,"input"); fire(el,"change"); return true;
    }
    setNativeValue(el, String(val)); fire(el,"input"); fire(el,"change"); return true;
  }
  function similarity(a,b){
    if (a===b) return 1;
    if (!a||!b) return 0;
    if (a.includes(b)||b.includes(a)){ return Math.max(0.66, Math.min(a.length,b.length)/Math.max(a.length,b.length)); }
    const as = new Set(a.split(/\W+/).filter(Boolean));
    const bs = new Set(b.split(/\W+/).filter(Boolean));
    let inter=0; for (const x of as) if (bs.has(x)) inter++;
    return inter/Math.max(1, Math.min(as.size, bs.size));
  }

  async function autofillAll(opts={}){
    const logs = [];
    logs.push('[AI-AUTOFILL] Starting autofill process.');
    const profile = await loadProfile();
    const fields = collectFields();
    logs.push(`[AI-AUTOFILL] Collected ${fields.length} fields.`);
    let answersMap = {};

    if (opts.ai){
      // Ask background to solve
      const payload = {
        page: { url: location.href, title: document.title },
        profile,
        fields
      };
      try{
        const ai = await safeSendMessage({ type: "AI_SOLVE", payload });
        logs.push(`[AI-AUTOFILL] AI response received: ${ai?.ok ? 'OK' : 'Error'}`);
        if (ai?.ok && ai.result?.answers){
          for (const ans of ai.result.answers){
            answersMap[ans.fieldId] = ans.value;
          }
        }
        logs.push(`[AI-AUTOFILL] Mapped ${Object.keys(answersMap).length} answers.`);
      }catch(e){
        logs.push(`[AI-AUTOFILL] AI_SOLVE failed: ${e.message}`);
      }
    }

    // Apply answers
    let filled = 0;
    const it = document.createNodeIterator(document, NodeFilter.SHOW_ELEMENT, {
      acceptNode(n){ if (!(n instanceof HTMLElement)) return NodeFilter.FILTER_SKIP; if (!visible(n)) return NodeFilter.FILTER_SKIP; if (n.matches("input,textarea,select")) return NodeFilter.FILTER_ACCEPT; return NodeFilter.FILTER_SKIP; }
    });
    let idx=0, n;
    while (n = it.nextNode()){
      let fid = n.id ? `id:${n.id}` : `idx:${idx++}`;
      if (n instanceof HTMLInputElement && n.type==="radio"){
        fid = `radio:${n.name}`; // group id
      }
      const val = answersMap[fid];
      if (val == null) continue;
      if (n.type==="radio"){
        // choose best matching radio in group based on label/value
        const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(n.name)}"]`);
        let best=null, bestScore=0, target=norm(String(val));
        for (const r of group){
          const lbl = document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value || r.id || "";
          const s = similarity(norm(lbl), target);
          if (s>bestScore){ best=r; bestScore=s; }
        }
        if (best){ if (!best.checked){ best.click?.(); best.checked=true; } fire(best,"change"); filled++; }
        continue;
      }
      if (setByType(n, val)) filled++;
    }
    logs.push(`[AI-AUTOFILL] Filled ${filled} fields.`);
    return { filled, logs };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
    if (msg?.type === "PING_AUTOFILL"){ try{ sendResponse({ok:true}); }catch{} return true; }
    if (msg?.type === "AUTOFILL_NOW"){
      autofillAll(msg.opts||{})
        .then(res => sendResponse({ ok:true, ...res }))
        .catch(e => sendResponse({ ok:false, error: e?.message || String(e) }));
      return true;
    }
  });

  try{
    safeGet(["autoFillOnLoad","aggressiveMode"]).then(v => {
      if (v?.autoFillOnLoad) autofillAll({ ai: true });
    });
  }catch{}
})();