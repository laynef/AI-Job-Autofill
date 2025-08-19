// This top-level try...catch block prevents the entire script from failing if an unexpected error occurs during setup.
try {
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
                    // Preserve existing resume data if no new file is uploaded
                    chrome.storage.local.get(['resume', 'resumeFileName'], function(result) {
                        if (chrome.runtime.lastError) {
                            console.error("Error getting existing resume data:", chrome.runtime.lastError.message);
                            saveDataToStorage(dataToSave); // Save other fields even if resume fetch fails
                            return;
                        }
                        // Add existing resume data to the save object
                        if (result.resume) dataToSave.resume = result.resume;
                        if (result.resumeFileName) dataToSave.resumeFileName = result.resumeFileName;
                        saveDataToStorage(dataToSave);
                    });
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
} catch (e) {
    console.error("A fatal error occurred in popup.js:", e);
}


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
        
        if (element.isContentEditable) {
            element.textContent = '';
        } else {
            element.value = '';
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));

        for (const char of text) {
            if (element.isContentEditable) {
                element.textContent += char;
            } else {
                element.value += char;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 20));
        }
        
        // Fallback: If simulation fails, directly set the value.
        if (element.value === '' && !element.isContentEditable) {
            element.value = text;
        }
        if (element.textContent === '' && element.isContentEditable) {
            element.textContent = text;
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

    function parseJsonFromAiResponse(text) {
        if (!text) return null;
        const match = text.match(/```(json)?\n?([\s\S]+?)\n?```/);
        const jsonString = match ? match[2] : text;
        try {
            return JSON.parse(jsonString.trim());
        } catch (e) {
            console.error("AI Autofill: Failed to parse JSON from AI response.", e, "Raw text:", text);
            return null;
        }
    }

    async function getAIResponse(prompt, userData) {
        const parts = [{ text: prompt }];
        let mimeType = '';
        if (userData.resumeFileName?.endsWith('.pdf')) {
            mimeType = 'application/pdf';
        } else if (userData.resumeFileName?.endsWith('.docx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }

        if (userData.resume && mimeType && userData.resume.startsWith('data:')) {
            const base64Data = userData.resume.split(',')[1];
            if (base64Data) {
                parts.push({ inlineData: { mimeType, data: base64Data } });
            }
        }

        const payload = { contents: [{ role: "user", parts: parts }] };
        const apiKey = userData.apiKey || "";
        if (!apiKey) {
            console.error("AI Autofill: API Key is missing.");
            throw new Error("API Key is missing.");
        }

        const model = 'gemini-1.5-flash-latest';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AI Autofill: API Error Response:", errorBody);
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content || !result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
            console.warn("AI Autofill: Received an empty or invalid response from the AI.", result);
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                console.error("AI Autofill: The request was blocked due to safety settings.", result.candidates[0].safetyRatings);
                throw new Error("The content was blocked by the API's safety filters.");
            }
            return '';
        }
        return result.candidates[0].content.parts[0].text.trim();
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
    } catch (e) { console.error("AI Autofill: Could not parse page context:", e); }

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
        const historyJsonText = await getAIResponse(workHistoryPrompt, userData);
        const parsedHistory = parseJsonFromAiResponse(historyJsonText);
        if (Array.isArray(parsedHistory)) {
            workHistory = parsedHistory;
        }
    } catch (e) { console.error("AI Autofill: Could not get work history from resume.", e); }


    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for the page to finish loading dynamic content
    await simulateClick(document.body); // Click the page to activate it

    const demographicKeywords = ['race', 'ethnicity', 'gender', 'disability', 'veteran', 'sexual orientation'];
    let usedAnswers = new Set();
    let experienceIndex = 0;
    let lastScrollY = -1;
    let stallCounter = 0;

    while (true) {
        // Find the next element to process. Re-query the DOM in each iteration to find dynamically added elements.
        const el = Array.from(document.querySelectorAll('input, textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"]')).find(e => !e.hasAttribute('data-autofilled'));

        if (!el) {
            // No more unprocessed elements found. Try scrolling to load more.
            lastScrollY = window.scrollY;
            window.scrollBy(0, window.innerHeight * 0.8);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for lazy load

            // If scrolling didn't change position, we're likely at the bottom or on a non-scrolling page.
            if (window.scrollY === lastScrollY) {
                stallCounter++;
                if (stallCounter > 2) {
                    console.log("AI Autofill: Page seems to be fully scrolled. Finishing process.");
                    break; // Exit the while loop
                }
            } else {
                stallCounter = 0; // Reset counter if we successfully scrolled
            }
            continue; // Re-run the loop to find new elements after scrolling.
        }

        stallCounter = 0; // Reset stall counter since we found an element to process.
        el.setAttribute('data-autofilled', 'true'); // Mark as processed to avoid re-processing.

        try {
            const style = window.getComputedStyle(el);
            if (el.disabled || el.readOnly || style.display === 'none' || style.visibility === 'hidden') {
                continue;
            }

            const elType = el.tagName.toLowerCase();
            if ((elType === 'input' || elType === 'textarea' || el.isContentEditable) && (el.value?.trim() !== '' || el.textContent?.trim() !== '') && el.type !== 'radio' && el.type !== 'checkbox') continue;
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
            
            const combinedText = `${el.name} ${el.id} ${el.placeholder} ${question} ${el.innerText}`.toLowerCase();
            const isResumeField = combinedText.includes('resume') || combinedText.includes('cv') || combinedText.includes('attach');

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
            
            if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea' || el.isContentEditable) {
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
}

