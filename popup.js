document.addEventListener('DOMContentLoaded', function () {
    const statusEl = document.getElementById('status');
    const resumeFileNameEl = document.getElementById('resumeFileName');
    const textFields = ['firstName', 'lastName', 'email', 'phone', 'location', 'linkedinUrl', 'portfolioUrl', 'additionalInfo'];

    // Load saved data
    chrome.storage.local.get([...textFields, 'resumeFileName'], function (result) {
        textFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && result[field]) el.value = result[field];
        });
        if (result.resumeFileName) {
            resumeFileNameEl.textContent = `Saved file: ${result.resumeFileName}`;
        }
    });

    // Save data
    document.getElementById('save').addEventListener('click', function () {
        let dataToSave = {};
        textFields.forEach(field => {
            dataToSave[field] = document.getElementById(field).value;
        });

        const resumeFile = document.getElementById('resumeFile').files[0];

        const saveToStorage = (data) => {
            const finalData = {};
            for (const key in data) {
                if (data[key] !== undefined) {
                    finalData[key] = data[key];
                }
            }
            chrome.storage.local.set(finalData, function () {
                statusEl.textContent = 'Information saved!';
                setTimeout(() => statusEl.textContent = '', 2000);
            });
        };

        if (resumeFile) {
            const reader = new FileReader();
            reader.onload = function (e) {
                dataToSave.resume = e.target.result;
                dataToSave.resumeFileName = resumeFile.name;
                resumeFileNameEl.textContent = `Saved file: ${resumeFile.name}`;
                saveToStorage(dataToSave);
            };
            reader.onerror = function () {
                statusEl.textContent = 'Error reading file.';
                setTimeout(() => statusEl.textContent = '', 3000);
            };
            reader.readAsText(resumeFile);
        } else {
            saveToStorage(dataToSave);
        }
    });

    // Autofill button logic
    document.getElementById('autofill').addEventListener('click', function () {
        statusEl.textContent = 'Autofilling...';
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: autofillPage,
            }).then(() => {
                statusEl.textContent = 'Autofill complete!';
                setTimeout(() => statusEl.textContent = '', 3000);
            }).catch(err => {
                statusEl.textContent = 'Error during autofill.';
                console.error('Autofill script injection failed:', err);
                setTimeout(() => statusEl.textContent = '', 3000);
            });
        });
    });
});


// This function is injected into the page to perform the autofill
async function autofillPage() {
    // --- HELPER FUNCTIONS ---
    function findQuestionForInput(element) {
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label && label.innerText.trim()) return label.innerText.trim();
        }
        let current = element;
        for (let i = 0; i < 3; i++) {
            const parent = current.parentElement;
            if (!parent) break;
            const clone = parent.cloneNode(true);
            const cloneEl = clone.querySelector(`[name="${element.name}"]`) || clone.querySelector(`#${element.id}`);
            if (cloneEl) cloneEl.remove();
            const text = clone.innerText.trim().split('\n')[0].trim();
            if (text && text.length > 3 && text.length < 200) return text;
            current = parent;
        }
        return '';
    }

    // --- MAIN AUTOFILL LOGIC ---
    const userData = await new Promise(resolve => {
        const fields = ['firstName', 'lastName', 'email', 'phone', 'location', 'linkedinUrl', 'portfolioUrl', 'resume', 'additionalInfo'];
        chrome.storage.local.get(fields, resolve);
    });

    const jobTitle = document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText || '';
    const elements = document.querySelectorAll('input, textarea, select');

    for (const el of elements) {
        if (el.type === 'hidden' || el.disabled || el.readOnly || el.value) continue;

        const question = findQuestionForInput(el);
        const combinedText = `${el.name} ${el.id} ${el.placeholder} ${question}`.toLowerCase();

        // 1. Standard Inputs
        if (el.tagName.toLowerCase() === 'input') {
            if (combinedText.includes('first') && combinedText.includes('name')) el.value = userData.firstName || '';
            else if (combinedText.includes('last') && combinedText.includes('name')) el.value = userData.lastName || '';
            else if (combinedText.includes('full') && combinedText.includes('name')) el.value = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
            else if (combinedText.includes('email')) el.value = userData.email || '';
            else if (combinedText.includes('phone') || combinedText.includes('tel')) el.value = userData.phone || '';
            else if (combinedText.includes('linkedin')) el.value = userData.linkedinUrl || '';
            else if (combinedText.includes('website') || combinedText.includes('portfolio')) el.value = userData.portfolioUrl || '';
            else if (combinedText.includes('location') || combinedText.includes('city')) el.value = userData.location || '';
        }

        // 2. Dropdown (Select) Menus
        if (el.tagName.toLowerCase() === 'select') {
            const cleanQuestion = question.replace(/[*:]$/, '').trim().toLowerCase();
            if (cleanQuestion.includes('authorized to work')) {
                for (let option of el.options) if (option.text.toLowerCase().includes('yes')) el.value = option.value;
            } else if (cleanQuestion.includes('sponsorship')) {
                for (let option of el.options) if (option.text.toLowerCase().includes('no')) el.value = option.value;
            } else if (cleanQuestion.includes('how did you hear') || cleanQuestion.includes('source') || cleanQuestion.includes('influenced')) {
                for (let option of el.options) if (option.text.toLowerCase().includes('linkedin')) el.value = option.value;
            }
        }

        // 3. Radio Buttons
        if (el.type === 'radio') {
            const cleanQuestion = question.replace(/[*:]$/, '').trim().toLowerCase();
            const label = document.querySelector(`label[for="${el.id}"]`);
            const labelText = label ? label.innerText.toLowerCase() : '';
            if (cleanQuestion.includes('authorized to work') && labelText.includes('yes')) el.checked = true;
            if (cleanQuestion.includes('sponsorship') && labelText.includes('no')) el.checked = true;
        }

        // 4. AI-Powered Text Fields & Textareas
        if ((el.tagName.toLowerCase() === 'textarea' || el.type === 'text') && !el.value) {
            const cleanQuestion = question.replace(/[*:]$/, '').trim();
            if (cleanQuestion.length > 15) {
                try {
                    const prompt = `You are an expert AI assistant helping a candidate fill out a job application. Your task is to answer the application question based on the provided resume and key info. Your tone should be professional, positive, and concise.
---
**GUIDELINES:**
- For standard professional questions (e.g., "Why are you a good fit?"), use the resume and key info to provide a direct, relevant answer.
- For questions about salary expectations, if no specific number is provided in my info, state that my expectations are negotiable and competitive for the role and my experience level.
- For unusual or creative questions (e.g., "What's your favorite color?"), provide a brief, safe, and professional-sounding answer that shows a bit of personality without being unprofessional.
- If a question is completely unclear or unanswerable with the given information, politely state that more clarification is needed.
---
**MY RESUME & INFO:**
${userData.resume || 'Not provided.'}
${userData.additionalInfo || 'Not provided.'}
My current location is ${userData.location || 'Not provided.'}.
---
**JOB TITLE:** ${jobTitle || 'Not specified'}
---
**APPLICATION QUESTION:** "${cleanQuestion}"
---
**YOUR ANSWER (write only the answer, no preamble):**`;

                    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
                    const apiKey = "";
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const result = await response.json();
                    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                        el.value = result.candidates[0].content.parts[0].text.trim();
                    }
                } catch (error) {
                    console.error('AI Autofill Error:', error);
                }
            }
        }
    }
}
