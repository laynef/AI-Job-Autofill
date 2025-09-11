
// Augments existing popup to trigger autofill on the active tab.
// Call sendAutofill() on your "Fill" button's click handler.
async function sendAutofill() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const res = await chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL_NOW" });
    console.log("Autofill result:", res);
  } catch (e) {
    console.warn("Could not send autofill message (content script not loaded). Attempting to inject...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const res = await chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL_NOW" });
    console.log("Autofill result after inject:", res);
  }
}
