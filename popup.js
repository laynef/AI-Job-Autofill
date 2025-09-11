
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
        results.push({ frameId: f.frameId, ok: !!res?.ok, filled: res?.filled ?? 0, error: res?.error });
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
    new Promise((_, rej) => setTimeout(()=> rej(new Error("Timed out talking to background (service worker).")), 8000))
  ]);
  if (!res || res.ok !== true) { return await directBroadcastFromPopup(tab.id, opts); }
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
  }
} else {
  const msg = res?.error || (Array.isArray(res?.results) && res.results.find(r=>!r.ok)?.error) || ("Unknown error. Raw: " + JSON.stringify(res));
  setStatus("Failed: " + msg);
}

    }catch(e){ setStatus("Failed: " + (e?.message || String(e))); }
  });
  loadFlags();
});
