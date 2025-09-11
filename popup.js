async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content.js"] });
  } catch (e) {
    // might already be injected
  }
}

async function broadcastAutofill(opts) {
  const tab = await getActiveTab();
  if (!tab?.id) return { ok:false, error:"No active tab" };
  await ensureInjected(tab.id);
  return await chrome.runtime.sendMessage({ type: "BROADCAST_AUTOFILL", tabId: tab.id, opts });
}

function setStatus(s) {
  const el = document.getElementById("status");
  el.textContent = s;
  const log = document.getElementById("log");
  log.value = (new Date().toLocaleTimeString() + " — " + s + "\n" + log.value).slice(0, 6000);
}

async function loadFlags() {
  const v = await chrome.storage.local.get(["aggressiveMode","autoFillOnLoad"]);
  document.getElementById("aggressive").checked = !!v.aggressiveMode;
  document.getElementById("autorun").checked = !!v.autoFillOnLoad;
}

async function saveFlags() {
  const aggressive = document.getElementById("aggressive").checked;
  const autorun = document.getElementById("autorun").checked;
  await chrome.storage.local.set({ aggressiveMode: aggressive, autoFillOnLoad: autorun });
}

document.getElementById("run").addEventListener("click", async () => {
  await saveFlags();
  setStatus("Filling…");
  const aggressive = document.getElementById("aggressive").checked;
  const res = await broadcastAutofill({ aggressive });
  if (res?.ok) setStatus(`Filled inputs across ${res.frames?.length ?? 1} frame(s).`);
  else setStatus("Failed: " + (res?.error || "Unknown error"));
});

loadFlags();
