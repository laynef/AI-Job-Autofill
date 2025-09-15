
// worker.js — MV3 service worker: broadcast + AI solve via OpenAI
async function callOpenAI(apiKey, model, systemPrompt, userPayload) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: model || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload) }
    ]
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error("OpenAI error " + res.status + ": " + t);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(text); } catch {
    // Sometimes it's already JSON string content; best-effort parse
    return JSON.parse(text.replace(/```json|```/g, ""));
  }
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  
if (msg?.type === "BROADCAST_AUTOFILL") { console.debug('[autofill] BROADCAST_AUTOFILL', msg);
  try {
    const tabId = msg.tabId;
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const results = [];
    for (const f of frames) {
      try {
        const res = await chrome.tabs.sendMessage(tabId, { type: "AUTOFILL_NOW", opts: msg.opts || {} }, { frameId: f.frameId });
        results.push({ frameId: f.frameId, ok: !!res?.ok, filled: res?.filled ?? 0, error: res?.error, logs: res?.logs });
      } catch (e) {
        results.push({ frameId: f.frameId, ok: false, filled: 0, error: e?.message || String(e) });
      }
    }
    const totalFilled = results.reduce((a,b)=> a + (b.filled||0), 0);
    sendResponse({ ok: true, frames: results.map(r=>r.frameId), results, filled: totalFilled });
  } catch (e) {
    sendResponse({ ok: false, error: e?.message || String(e) });
  }
  return true;
}

  if (msg?.type === "AI_SOLVE") { console.debug('[autofill] AI_SOLVE', msg?.payload?.page);
    try {
      const cfg = await new Promise(r => chrome.storage.local.get(["apiKey","model"], r));
      if (!cfg?.apiKey) throw new Error("Missing API key in Options (apiKey).");
      const systemPrompt = [
        "You are a precise autofill engine for web forms.",
        "You MUST return strict JSON with shape: { answers: [{ fieldId: string, value: string | number | boolean }] }.",
        "Given profile, page info, and fields (id,label,type,options), choose the correct value for EACH field using only provided knowledge.",
        "For selects and radios, return the option text EXACTLY as shown in the provided options whenever possible.",
        "For checkboxes, return true/false to check/uncheck.",
        "For dates, prefer YYYY-MM-DD when applicable.",
        "For unknowns, use the most consistent value derived from profile or say \"N/A\" or a neutral valid choice.",
        "Never include extra keys or commentary."
      ].join(" ");
      const result = await callOpenAI(cfg.apiKey, cfg.model || "gpt-4o-mini", systemPrompt, msg.payload);
      sendResponse({ ok: true, result });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
    return true;
  }
});
