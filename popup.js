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
<<<<<<< HEAD
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
=======
    document.addEventListener('DOMContentLoaded', function() {
        const statusEl = document.getElementById('status');
        const resumeFileNameEl = document.getElementById('resumeFileName');
        const resumeFileInput = document.getElementById('resumeFile');
        const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'apiKey', 'additionalInfo'];

        // Load saved data when the popup opens
        chrome.storage.local.get([...textFields, 'resumeFileName'], function(result) {
            if (chrome.runtime.lastError) { return console.error("Error loading data:", chrome.runtime.lastError.message); }
            textFields.forEach(field => {
                const el = document.getElementById(field);
                if (el && result[field]) el.value = result[field];
            });
            if (result.resumeFileName && resumeFileNameEl) resumeFileNameEl.textContent = `Saved file: ${result.resumeFileName}`;
        });

        if (resumeFileInput) {
            resumeFileInput.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    if (resumeFileNameEl) {
                        resumeFileNameEl.textContent = `Selected: ${this.files[0].name} (click Save)`;
                        resumeFileNameEl.style.color = '#D97706';
                    }
                }
            });
        }

        // Save data when the save button is clicked
        document.getElementById('save').addEventListener('click', function() {
            try {
                let dataToSave = {};
                textFields.forEach(field => {
                    const el = document.getElementById(field);
                    if (el) dataToSave[field] = el.value;
                });

                const newResumeFile = resumeFileInput?.files[0];

                const saveDataToStorage = (data) => {
                    chrome.storage.local.set(data, function() {
                        if (chrome.runtime.lastError) {
                            statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                            console.error("Save error:", chrome.runtime.lastError);
                        } else {
                            statusEl.textContent = 'Information saved!';
                            if (data.resumeFileName && resumeFileNameEl) {
                                resumeFileNameEl.textContent = `Saved file: ${data.resumeFileName}`;
                                resumeFileNameEl.style.color = '';
                            }
                        }
                        setTimeout(() => { if(statusEl) statusEl.textContent = ''; }, 2500);
                    });
                };

                if (newResumeFile) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        dataToSave.resume = e.target.result; // The Base64 string
                        dataToSave.resumeFileName = newResumeFile.name;
                        saveDataToStorage(dataToSave);
                    };
                    reader.onerror = function(err) {
                        statusEl.textContent = 'Error reading file.';
                        console.error("File reading error:", err);
                    };
                    reader.readAsDataURL(newResumeFile);
                } else {
                    saveDataToStorage(dataToSave);
                }
            } catch (error) {
                statusEl.textContent = 'A critical error occurred during save.';
                console.error("Critical error in save handler:", error);
            }
        });

        // Autofill button logic
        document.getElementById('autofill').addEventListener('click', function() {
            statusEl.textContent = 'Autofilling...';
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs.length === 0 || !tabs[0].id) {
                    statusEl.textContent = 'Could not find active tab.';
                    return;
                }
                chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    function: autofillPage,
                }).then(() => {
                     statusEl.textContent = 'Autofill complete!';
                     setTimeout(() => statusEl.textContent = '', 3000);
                }).catch(err => {
                     statusEl.textContent = 'Autofill failed on this page.';
                     console.error('Autofill script injection failed:', err);
                     setTimeout(() => statusEl.textContent = '', 3000);
                });
            });
        });
    });
>>>>>>> parent of a212aeb (1.3)
} catch (e) {
  return { ok:false, error: e?.message || String(e) };
}

<<<<<<< HEAD
=======

// This function is injected into the page to perform the autofill
async function autofillPage() {
    console.log("AI Autofill: Starting process...");

    // --- HELPER FUNCTIONS ---
    async function simulateClick(element) {
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    async function simulateTyping(element, text) {
        if (typeof text !== 'string') return;
        await simulateClick(element);
        element.focus();
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));

        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 20));
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
    }

    function findQuestionForInput(element) {
        const checks = [
            element.getAttribute('aria-label'),
            element.id ? document.querySelector(`label[for="${element.id}"]`)?.innerText : null,
            element.getAttribute('aria-labelledby') ? document.getElementById(element.getAttribute('aria-labelledby'))?.innerText : null
        ];
        for (const check of checks) {
            if (check && check.trim()) return check.trim();
        }
        let current = element.parentElement;
        for (let i = 0; i < 3 && current; i++) {
            const clone = current.cloneNode(true);
            const cloneEl = clone.querySelector(`[name="${element.name}"]`) || clone.querySelector(`#${element.id}`);
            if (cloneEl) cloneEl.remove();
            const text = clone.innerText.trim().split('\n')[0].trim();
            if (text && text.length > 5 && text.length < 200) return text;
            current = current.parentElement;
        }
        return '';
    }
    
    async function findOptionsForInput(element) {
        let options = [];
        if (element.tagName.toLowerCase() === 'select') {
            options = Array.from(element.options).map(opt => opt.text).filter(t => t.trim() !== '' && !t.toLowerCase().includes('select'));
        } else if (element.getAttribute('list')) {
            const dataList = document.getElementById(element.getAttribute('list'));
            if (dataList) options = Array.from(dataList.options).map(opt => opt.value);
        } else if (element.type === 'radio' || element.type === 'checkbox') {
            const groupName = element.name;
            if (groupName) {
                options = Array.from(document.querySelectorAll(`input[name="${groupName}"]`))
                    .map(radio => document.querySelector(`label[for="${radio.id}"]`)?.innerText.trim())
                    .filter(Boolean);
            }
        }
        if (options.length > 0) return { options, source: element };

        const isComboBox = element.getAttribute('role') === 'combobox' || element.hasAttribute('aria-controls') || element.getAttribute('aria-haspopup') === 'listbox';
        if (isComboBox) {
            await simulateClick(element);
            await new Promise(resolve => setTimeout(resolve, 750));
            
            const ariaControlsId = element.getAttribute('aria-controls');
            let controlledEl = ariaControlsId ? document.getElementById(ariaControlsId) : document.querySelector('[role="listbox"]:not([style*="display: none"])');
            
            if (controlledEl) {
                const optionElements = Array.from(controlledEl.querySelectorAll('[role="option"]'));
                if (optionElements.length > 0) {
                    return { options: optionElements.map(opt => opt.innerText.trim()), source: controlledEl };
                }
            }
            await simulateClick(document.body); // Click away to close
        }
        return { options: [] };
    }

    async function getAIResponse(prompt, userData) {
        const parts = [{ text: prompt }];
        let mimeType = '';
        if (userData.resumeFileName?.endsWith('.pdf')) {
            mimeType = 'application/pdf';
        } else if (userData.resumeFileName?.endsWith('.docx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }

        if (userData.resume && mimeType) {
            const base64Data = userData.resume.split(',')[1];
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const payload = { contents: [{ role: "user", parts: parts }] };
        const apiKey = userData.apiKey || "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text.trim();
    }


    // --- MAIN SCRIPT LOGIC ---

    const jobTitle = document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText || '';
    let jobDescription = '';
    try {
        const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
        if (ldJsonScript) {
            const jsonData = JSON.parse(ldJsonScript.textContent);
            if (jsonData && jsonData.description) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = jsonData.description;
                jobDescription = tempDiv.innerText;
            }
        }
        if (!jobDescription) {
            const descDiv = document.querySelector('#job-description, [class*="job-description"], [class*="jobdescription"]');
            if (descDiv) jobDescription = descDiv.innerText;
        }
    } catch(e) { console.error("AI Autofill: Could not parse page context:", e); }

    const userData = await new Promise(resolve => {
        const fields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'resume', 'resumeFileName', 'additionalInfo', 'apiKey'];
        chrome.storage.local.get(fields, (result) => {
            if (chrome.runtime.lastError) {
                console.error("AI Autofill: Error getting user data from storage.");
                resolve({});
            } else {
                resolve(result);
            }
        });
    });

    if (!userData) {
        console.error("AI Autofill: Could not load user data. Aborting.");
        return;
    }

    const workHistoryPrompt = "Analyze the attached resume and extract the work experience. Return a JSON array where each object has 'jobTitle', 'company', 'startDate', 'endDate', and 'responsibilities' keys. The responsibilities should be a single string with key achievements separated by newlines.";
    let workHistory = [];
    try {
        const historyJson = await getAIResponse(workHistoryPrompt, userData);
        if (historyJson) {
            const cleanedJson = historyJson.replace(/```json/g, '').replace(/```/g, '').trim();
            workHistory = JSON.parse(cleanedJson);
        }
    } catch(e) { console.error("AI Autofill: Could not parse work history from resume.", e); }

    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for the page to finish loading dynamic content

    const demographicKeywords = ['race', 'ethnicity', 'gender', 'disability', 'veteran', 'sexual orientation'];
    let usedAnswers = new Set();
    let experienceIndex = 0;
    
    const allElements = Array.from(document.querySelectorAll('input, textarea, select'));

    for (const el of allElements) {
        try {
            const style = window.getComputedStyle(el);
            if (el.type === 'hidden' || el.disabled || el.readOnly || style.display === 'none' || style.visibility === 'hidden') {
                continue;
            }

            const elType = el.tagName.toLowerCase();
            if ( (elType === 'input' || elType === 'textarea') && el.value.trim() !== '' && el.type !== 'radio' && el.type !== 'checkbox' ) continue;
            if (elType === 'select' && el.selectedIndex !== 0 && el.value !== '') continue;
            if ((el.type === 'radio' || el.type === 'checkbox') && document.querySelector(`input[name="${el.name}"]:checked`)) continue;

            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            await new Promise(resolve => setTimeout(resolve, 200));

            const question = findQuestionForInput(el);
            const isDemographic = demographicKeywords.some(keyword => question.toLowerCase().includes(keyword));

            if (isDemographic) {
                if (el.tagName.toLowerCase() === 'select') {
                    for (let option of el.options) {
                        if (option.text.toLowerCase().includes('decline') || option.text.toLowerCase().includes('prefer not')) {
                            el.value = option.value; el.dispatchEvent(new Event('change', { bubbles: true })); break;
                        }
                    }
                } else if (el.type === 'radio' || el.type === 'checkbox') {
                    const labelText = (document.querySelector(`label[for="${el.id}"]`)?.innerText || '').toLowerCase();
                    if (labelText.includes('decline') || labelText.includes('prefer not')) await simulateClick(el);
                }
                continue;
            }

            if (el.type === 'file') {
                el.style.border = '2px solid #8B5CF6';
                let notice = el.parentElement.querySelector('p.autofill-notice');
                if (!notice) {
                    notice = document.createElement('p');
                    notice.className = 'autofill-notice';
                    notice.textContent = 'Please attach your resume file here.';
                    notice.style.cssText = 'color: #8B5CF6; font-size: 12px; margin-top: 4px;';
                    el.parentElement.insertBefore(notice, el.nextSibling);
                }
                continue;
            }

            const combinedText = `${el.name} ${el.id} ${el.placeholder} ${question}`.toLowerCase();
            if (combinedText.includes('experience') || (workHistory[experienceIndex] && (combinedText.includes(workHistory[experienceIndex].company.toLowerCase()) || combinedText.includes(workHistory[experienceIndex].jobTitle.toLowerCase())))) {
                if (experienceIndex < workHistory.length) {
                    const currentJob = workHistory[experienceIndex];
                    if (combinedText.includes('title')) await simulateTyping(el, currentJob.jobTitle);
                    else if (combinedText.includes('company')) await simulateTyping(el, currentJob.company);
                    else if (combinedText.includes('start')) await simulateTyping(el, currentJob.startDate);
                    else if (combinedText.includes('end')) await simulateTyping(el, currentJob.endDate);
                    else if (combinedText.includes('responsibilities') || combinedText.includes('description')) {
                        await simulateTyping(el, currentJob.responsibilities);
                        experienceIndex++;
                        const addButton = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(b => b.innerText.toLowerCase().includes('add') && b.innerText.toLowerCase().includes('experience'));
                        if (addButton) {
                            await simulateClick(addButton);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    continue;
                }
            }
            
            const { options, source } = await findOptionsForInput(el);

            if (options.length > 0) {
                const cleanQuestion = question.replace(/[*:]$/, '').trim();
                if (cleanQuestion.length > 5) {
                    const prompt = `You are an expert career assistant. Your task is to select the best option from a list to answer an application question.
---
**CONTEXT:**
- **Job Description:** ${jobDescription || 'Not found on page.'}
- **My Profile:** ${userData.additionalInfo || 'Not provided.'}
- **Answers Already Used on This Page:** ${Array.from(usedAnswers).join(", ")}
---
**TASK: From the list below, choose the single most appropriate and unique option to answer the question. I will provide my resume separately.**
**Question:** "${cleanQuestion}"
**Options:**
- ${options.join("\n- ")}
---
**INSTRUCTIONS:** Return ONLY the exact text of the best option from the list. Do not repeat an answer that has already been used.
---
**BEST OPTION:**`;
                    const aiChoice = await getAIResponse(prompt, userData);
                    if (aiChoice) {
                        usedAnswers.add(aiChoice);
                        if (el.tagName.toLowerCase() === 'select') {
                            for (let option of el.options) {
                                if (option.text.trim() === aiChoice) { await simulateClick(el); el.value = option.value; el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); break; }
                            }
                        } else if (el.type === 'radio' || el.type === 'checkbox') {
                            const inputs = document.querySelectorAll(`input[name="${el.name}"]`);
                            for (const input of inputs) {
                                const label = document.querySelector(`label[for="${input.id}"]`);
                                if (label && label.innerText.trim() === aiChoice) { await simulateClick(input); break; }
                            }
                        } else {
                            const optionElements = Array.from(source.querySelectorAll('[role="option"]'));
                            const targetOption = optionElements.find(opt => opt.innerText.trim() === aiChoice);
                            if (targetOption) {
                                await simulateClick(targetOption);
                            } else {
                                await simulateTyping(el, aiChoice);
                            }
                        }
                    }
                }
                continue;
            }
            
            if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
                let valueToType = '';
                if (combinedText.includes('first') && combinedText.includes('name')) valueToType = userData.firstName || '';
                else if (combinedText.includes('last') && combinedText.includes('name')) valueToType = userData.lastName || '';
                else if (combinedText.includes('preferred') && combinedText.includes('name')) valueToType = userData.firstName || '';
                else if (combinedText.includes('full') && combinedText.includes('name')) valueToType = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                else if (combinedText.includes('email')) valueToType = userData.email || '';
                else if (combinedText.includes('phone') || combinedText.includes('tel')) valueToType = userData.phone || '';
                else if (combinedText.includes('pronouns')) valueToType = userData.pronouns || '';
                else if (combinedText.includes('address')) valueToType = userData.address || '';
                else if (combinedText.includes('city')) valueToType = userData.city || '';
                else if (combinedText.includes('state') || combinedText.includes('province')) valueToType = userData.state || '';
                else if (combinedText.includes('zip') || combinedText.includes('postal')) valueToType = userData.zipCode || '';
                else if (combinedText.includes('country')) valueToType = userData.country || '';
                else if (combinedText.includes('linkedin')) valueToType = userData.linkedinUrl || '';
                else if (combinedText.includes('website') || combinedText.includes('portfolio')) valueToType = userData.portfolioUrl || '';
                
                if (valueToType) {
                     await simulateTyping(el, valueToType);
                } else {
                    const cleanQuestion = question.replace(/[*:]$/, '').trim();
                    if (cleanQuestion.length > 10 && !isDemographic) {
                        const prompt = `You are an expert career assistant. Your primary goal is to align my profile with the role by analyzing the provided Job Description. I will provide my resume separately.
---
**CONTEXT:**
- **Job Description:** ${jobDescription || 'Not found on page.'}
- **My Profile:** ${userData.additionalInfo || 'Not provided.'}
- **Answers Already Used on This Page:** ${Array.from(usedAnswers).join(", ")}
---
**TASK: Answer the following application question concisely and uniquely.**
**Question:** "${cleanQuestion}"
---
**INSTRUCTIONS:**
1. Formulate a professional answer that has not been used before on this page.
2. For salary questions, state my expectations are negotiable and competitive.
3. Write only the answer itself, with no preamble.
---
**ANSWER:**`;
                        const aiAnswer = await getAIResponse(prompt, userData);
                        if (aiAnswer) {
                            usedAnswers.add(aiAnswer);
                            await simulateTyping(el, aiAnswer);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("AI Autofill: Error processing element:", el, error);
        }
    }
    console.log("AI Autofill: Process finished.");
>>>>>>> parent of a212aeb (1.3)
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