document.addEventListener('DOMContentLoaded', function () {
    const statusEl = document.getElementById('status');
    const resumeFileNameEl = document.getElementById('resumeFileName');
    const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'company', 'currentJobTitle', 'additionalInfo'];

    // Load saved data when the popup opens
    chrome.storage.local.get([...textFields, 'resumeFileName'], function (result) {
        textFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && result[field]) el.value = result[field];
        });
        if (result.resumeFileName) {
            resumeFileNameEl.textContent = `Saved file: ${result.resumeFileName}`;
        }
    });

    // Save data when the save button is clicked
    document.getElementById('save').addEventListener('click', function () {
        // This function handles the actual saving to Chrome's storage.
        const finalSave = (data) => {
            chrome.storage.local.set(data, function () {
                // Check for errors during the save operation.
                if (chrome.runtime.lastError) {
                    statusEl.textContent = 'Error saving data.';
                    console.error(chrome.runtime.lastError.message);
                } else {
                    statusEl.textContent = 'Information saved!';
                    // Update the displayed file name if it was part of the save.
                    if (data.resumeFileName) {
                        resumeFileNameEl.textContent = `Saved file: ${data.resumeFileName}`;
                    }
                }
                // Clear the status message after a few seconds.
                setTimeout(() => statusEl.textContent = '', 2500);
            });
        };

        // Start building the object to save with all the text fields.
        let dataToSave = {};
        textFields.forEach(field => {
            const el = document.getElementById(field);
            if (el) { // Check if the element exists before getting its value.
                dataToSave[field] = el.value;
            }
        });

        const resumeFile = document.getElementById('resumeFile').files[0];

        // If a new resume file was selected, read it before saving.
        if (resumeFile) {
            const reader = new FileReader();
            reader.onload = function (e) {
                // Add the new file content and name to our data object.
                dataToSave.resume = e.target.result;
                dataToSave.resumeFileName = resumeFile.name;
                // Now, save the complete data object.
                finalSave(dataToSave);
            };
            reader.onerror = function () {
                statusEl.textContent = 'Error reading file.';
                setTimeout(() => statusEl.textContent = '', 3000);
            };
            reader.readAsText(resumeFile);
        } else {
            // If no new file was selected, just save the text fields.
            // The existing resume data in storage will be preserved by Chrome's API.
            finalSave(dataToSave);
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
    } catch (e) { console.error("Could not parse page context:", e); }

    const userData = await new Promise(resolve => {
        const fields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'company', 'currentJobTitle', 'resume', 'additionalInfo'];
        chrome.storage.local.get(fields, resolve);
    });

    const elements = document.querySelectorAll('input, textarea, select');
    const demographicKeywords = ['race', 'ethnicity', 'gender', 'disability', 'veteran', 'sexual orientation'];

    for (const el of elements) {
        if (el.type === 'hidden' || el.disabled || el.readOnly || (el.value && el.type !== 'radio')) continue;

        const question = findQuestionForInput(el);
        const combinedText = `${el.name} ${el.id} ${el.placeholder} ${question}`.toLowerCase();

        const isDemographic = demographicKeywords.some(keyword => combinedText.includes(keyword));
        if (isDemographic) {
            if (el.tagName.toLowerCase() === 'select') {
                for (let option of el.options) {
                    if (option.text.toLowerCase().includes('decline') || option.text.toLowerCase().includes('prefer not')) {
                        el.value = option.value; break;
                    }
                }
            } else if (el.type === 'radio') {
                const labelText = (document.querySelector(`label[for="${el.id}"]`)?.innerText || '').toLowerCase();
                if (labelText.includes('decline') || labelText.includes('prefer not')) el.checked = true;
            }
            continue;
        }

        if (el.tagName.toLowerCase() === 'input' && el.type !== 'radio' && el.type !== 'checkbox') {
            if (combinedText.includes('first') && combinedText.includes('name')) el.value = userData.firstName || '';
            else if (combinedText.includes('last') && combinedText.includes('name')) el.value = userData.lastName || '';
            else if (combinedText.includes('preferred') && combinedText.includes('name')) el.value = userData.firstName || '';
            else if (combinedText.includes('full') && combinedText.includes('name')) el.value = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
            else if (combinedText.includes('email')) el.value = userData.email || '';
            else if (combinedText.includes('phone') || combinedText.includes('tel')) el.value = userData.phone || '';
            else if (combinedText.includes('pronouns')) el.value = userData.pronouns || '';
            else if (combinedText.includes('address')) el.value = userData.address || '';
            else if (combinedText.includes('city')) el.value = userData.city || '';
            else if (combinedText.includes('state') || combinedText.includes('province')) el.value = userData.state || '';
            else if (combinedText.includes('zip') || combinedText.includes('postal')) el.value = userData.zipCode || '';
            else if (combinedText.includes('country')) el.value = userData.country || '';
            else if (combinedText.includes('linkedin')) el.value = userData.linkedinUrl || '';
            else if (combinedText.includes('website') || combinedText.includes('portfolio')) el.value = userData.portfolioUrl || '';
            else if (combinedText.includes('company')) el.value = userData.company || '';
            else if (combinedText.includes('title')) el.value = userData.currentJobTitle || '';
        }

        if (el.tagName.toLowerCase() === 'select' || (el.tagName.toLowerCase() === 'input' && el.type === 'radio')) {
            const cleanQuestion = question.replace(/[*:]$/, '').trim();
            const options = el.tagName.toLowerCase() === 'select' ?
                Array.from(el.options).map(opt => opt.text).filter(t => t.trim() !== '' && !t.toLowerCase().includes('select')) :
                Array.from(document.querySelectorAll(`input[name="${el.name}"]`)).map(radio => document.querySelector(`label[for="${radio.id}"]`)?.innerText.trim()).filter(Boolean);

            if (cleanQuestion.length > 5 && options.length > 1) {
                try {
                    const prompt = `You are an expert career assistant. Your task is to select the best option from a list to answer an application question, based on my profile and the job description.
---
**CONTEXT: THE JOB DESCRIPTION**
${jobDescription || 'Not found on page.'}
---
**CONTEXT: MY PROFILE**
- **Resume:** ${userData.resume || 'Not provided.'}
- **Additional Info/Skills:** ${userData.additionalInfo || 'Not provided.'}
- **Current/Last Company:** ${userData.company || 'Not provided'}
- **Current/Last Job Title:** ${userData.currentJobTitle || 'Not provided'}
---
**TASK: From the list below, choose the single most appropriate option to answer the question.**
**Question:** "${cleanQuestion}"
**Options:**
- ${options.join("\n- ")}
---
**INSTRUCTIONS:**
- Analyze my profile and the job description to make the most logical choice.
- If the question is about experience (e.g., "experience with X"), choose the option that best reflects the skills mentioned in my resume.
- If the question is about work style or approach, choose the option that sounds most proactive, collaborative, and positive.
- For "How did you hear about us?", prefer "LinkedIn" or "Company Website".
- For authorization/sponsorship, choose "Yes" for authorization and "No" for sponsorship.
- For opting out of texts, choose the option that opts out or says no.
- Return ONLY the exact text of the best option from the list. Do not add any other words, explanation, or punctuation.
---
**BEST OPTION:**`;
                    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
                    const apiKey = "";
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

                    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const result = await response.json();
                    const aiChoice = result.candidates?.[0]?.content?.parts?.[0]?.text.trim();

                    if (aiChoice) {
                        if (el.tagName.toLowerCase() === 'select') {
                            for (let option of el.options) {
                                if (option.text.trim() === aiChoice) { el.value = option.value; break; }
                            }
                        } else if (el.type === 'radio') {
                            const radios = document.querySelectorAll(`input[name="${el.name}"]`);
                            for (const radio of radios) {
                                const label = document.querySelector(`label[for="${radio.id}"]`);
                                if (label && label.innerText.trim() === aiChoice) { radio.checked = true; break; }
                            }
                        }
                    }
                } catch (error) { console.error('AI Selection Error:', error); }
            }
        }

        if ((el.tagName.toLowerCase() === 'textarea' || el.type === 'text') && !el.value) {
            const cleanQuestion = question.replace(/[*:]$/, '').trim();
            if (cleanQuestion.length > 10 && !isDemographic) {
                try {
                    const prompt = `You are an expert career assistant. Your primary goal is to align my profile with the role by analyzing the provided Job Description.
---
**CONTEXT: THE JOB DESCRIPTION**
${jobDescription || 'Not found on page.'}
---
**CONTEXT: MY PROFILE**
- **Resume:** ${userData.resume || 'Not provided.'}
- **Additional Info/Skills:** ${userData.additionalInfo || 'Not provided.'}
---
**TASK: Answer the following application question.**
**Question:** "${cleanQuestion}"
---
**INSTRUCTIONS:**
1. Analyze the Job Description and my profile to formulate a concise, professional answer.
2. For salary questions, state my expectations are negotiable and competitive.
3. Write only the answer itself, with no preamble.
---
**ANSWER:**`;
                    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
                    const apiKey = "";
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

                    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const result = await response.json();
                    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                        el.value = result.candidates[0].content.parts[0].text.trim();
                    }
                } catch (error) { console.error('AI Text Error:', error); }
            }
        }
    }
}
