// worker.js — MV3 service worker: broadcast to all frames
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.type === "BROADCAST_AUTOFILL") {
    try {
      const tabId = msg.tabId;
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      for (const f of frames) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: "AUTOFILL_NOW", opts: msg.opts || {} }, { frameId: f.frameId });
        } catch (e) {}
      }
      sendResponse({ ok: true, frames: frames.map(f=>f.frameId), filled: undefined });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
    return true;
  }
});
