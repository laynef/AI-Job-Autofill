
// popup.js — minimal popup aligned with popup.html; enables AI mode
function $(id){ return document.getElementById(id); }
async function getActiveTab(){ const [tab] = await chrome.tabs.query({active:true, lastFocusedWindow:true}); return tab; }
async function ensureInjected(tabId){
  try{ const probe = await chrome.tabs.sendMessage(tabId, { type:"PING_AUTOFILL" }); if (probe?.ok) return; }catch{}
  await chrome.scripting.executeScript({ target: { tabId, allFrames:true }, files: ["content.js"] });
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
  return res ?? { ok:false, error:"No response from background (is the extension reloaded?)." };
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
