// popup.js — minimal, MV3-safe, aligned to popup.html
// Helpers
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}
async function ensureInjected(tabId) {
  // Try pinging content script first
  try {
    const probe = await chrome.tabs.sendMessage(tabId, { type: "PING_AUTOFILL" });
    if (probe && probe.ok) return true;
  } catch (_) {}
  // Inject content.js into all frames
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content.js"] });
  return true;
}
async function broadcastAutofill(opts) {
  const tab = await getActiveTab();
  if (!tab?.id) return { ok:false, error: "No active tab" };
  await ensureInjected(tab.id);
  return await chrome.runtime.sendMessage({ type: "BROADCAST_AUTOFILL", tabId: tab.id, opts });
}

// UI helpers (no-ops if elements are absent)
function $(id){ return document.getElementById(id); }
function setStatus(s){ const el = $("status"); if (el) el.textContent = s; const log = $("log"); if (log) log.value = (new Date().toLocaleTimeString() + " — " + s + "\n" + log.value).slice(0, 8000); }
function setBadges(filled, frames){ const f=$("filledCount"); const fr=$("frameCount"); if(f) f.textContent = `${filled ?? 0} filled`; if(fr) fr.textContent = `frames: ${frames ?? 0}`; }

async function loadFlags(){
  try{
    const v = await new Promise(r => chrome.storage.local.get(["autoFillOnLoad","aggressiveMode"], r));
    const autorun = $("autorun"); const aggressive = $("aggressive");
    if (autorun) autorun.checked = !!v.autoFillOnLoad;
    if (aggressive) aggressive.checked = !!v.aggressiveMode;
  }catch{}
}
async function saveFlags(){
  const autorun = $("autorun"); const aggressive = $("aggressive");
  try{ await chrome.storage.local.set({ autoFillOnLoad: !!(autorun && autorun.checked), aggressiveMode: !!(aggressive && aggressive.checked) }); }catch{}
}

document.addEventListener("DOMContentLoaded", () => {
  const runBtn = $("run"); const autorun = $("autorun"); const aggressive = $("aggressive");

  if (autorun) autorun.addEventListener("change", saveFlags);
  if (aggressive) aggressive.addEventListener("change", saveFlags);

  if (runBtn) runBtn.addEventListener("click", async () => {
    await saveFlags();
    const aggressiveChecked = !!(aggressive && aggressive.checked);
    setStatus("Answering everything…");
    try{
      const res = await broadcastAutofill({ aggressive: aggressiveChecked });
      if (res?.ok){
        setBadges(res.filled, res.frames?.length);
        setStatus(`Completed. Filled/clicked across ${res.frames?.length ?? 1} frame(s).`);
      } else {
        setStatus("Failed: " + (res?.error || "Unknown error"));
      }
    }catch(e){
      setStatus("Failed: " + (e?.message || String(e)));
    }
  });

  loadFlags();
});
