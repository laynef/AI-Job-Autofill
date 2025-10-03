// This top-level try...catch block prevents the entire script from failing if an unexpected error occurs during setup.
try {
    document.addEventListener('DOMContentLoaded', function() {
        const statusEl = document.getElementById('status');
        const resumeFileNameEl = document.getElementById('resumeFileName');
        const resumeFileInput = document.getElementById('resumeFile');
        const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'apiKey', 'additionalInfo'];

        // Load saved data when the popup opens
        chrome.storage.local.get([...textFields, 'resumeFileName', 'resume'], function(result) {
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
                    // Preserve existing resume if no new file is chosen
                    chrome.storage.local.get(['resume', 'resumeFileName'], (result) => {
                         if(result.resume) dataToSave.resume = result.resume;
                         if(result.resumeFileName) dataToSave.resumeFileName = result.resumeFileName;
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
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    async function simulateTyping(element, text) {
        if (typeof text !== 'string') return;
        await simulateClick(element);
        element.focus();
        
        const isContentEditable = element.isContentEditable;
        if (isContentEditable) {
            element.textContent = '';
        } else {
            element.value = '';
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));

        for (const char of text) {
            if (isContentEditable) {
                element.textContent += char;
            } else {
                element.value += char;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 15));
        }
        
        // Fallback: If simulation fails, directly set the value.
        if (!isContentEditable && !element.value) {
            element.value = text;
        }
        if (isContentEditable && !element.textContent) {
            element.textContent = text;
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
    }

    async function base64ToFile(base64, filename, mimeType) {
        try {
            const res = await fetch(base64);
            const blob = await res.blob();
            return new File([blob], filename, { type: mimeType });
        } catch (e) {
            console.error("Error converting base64 to File:", e);
            return null;
        }
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
            try {
                const clone = current.cloneNode(true);
                const selector = `[name="${element.name}"], #${element.id}`;
                Array.from(clone.querySelectorAll(selector)).forEach(el => el.remove());
                const text = clone.innerText.trim().split('\n')[0].trim();
                if (text && text.length > 5 && text.length < 200) return text;
            } catch (e) {}
            current = current.parentElement;
        }
        return '';
    }
    
    async function findOptionsForInput(element) {
        let options = [];
        const parent = element.parentElement;

        // Button group detection
        if (element.tagName.toLowerCase() === 'button' || element.getAttribute('role') === 'button') {
             const buttonGroup = parent.querySelectorAll('button, [role="button"]');
             if(buttonGroup.length > 1) {
                 options = Array.from(buttonGroup).map(btn => btn.innerText.trim());
                 if (options.length > 0) return { options, source: parent };
             }
        }
        
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
                    await simulateClick(document.body); // Close the dropdown
                    return { options: optionElements.map(opt => opt.innerText.trim()), source: controlledEl };
                }
            }
            await simulateClick(document.body); // Click away to close
        }
        return { options: [] };
    }

    async function getAIResponse(prompt, userData) {
        if (!userData.apiKey) {
            console.warn("AI Autofill: No API key provided. Skipping AI call.");
            return "";
        }

        const parts = [{ text: prompt }];
        
        if (userData.resume && userData.resume.startsWith('data:')) {
            const [meta, base64Data] = userData.resume.split(',');
            const mimeTypeMatch = meta.match(/:(.*?);/);
            
            if (mimeTypeMatch && mimeTypeMatch[1] && base64Data) {
                const mimeType = mimeTypeMatch[1];
                if (mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    parts.push({ inlineData: { mimeType, data: base64Data } });
                }
            }
        }

        const payload = { contents: [{ role: "user", parts }] };
        const apiKey = userData.apiKey;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                 console.error("AI API Error:", response.status, await response.text());
                 return "";
            }
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "";
        } catch (error) {
            console.error("AI Fetch Error:", error);
            return "";
        }
    }


    // --- MAIN SCRIPT LOGIC ---

    const jobTitle = document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText || '';
    let jobDescription = '';
    try {
        const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
        if (ldJsonScript) {
            const jsonData = JSON.parse(ldJsonScript.textContent);
            const descContainer = (Array.isArray(jsonData) ? jsonData.find(j => j.description) : jsonData) || {};
            if (descContainer.description) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = descContainer.description;
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

    if (!Object.keys(userData).length) {
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
    
    const allElements = Array.from(document.querySelectorAll('input, textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"], button'));

    for (const el of allElements) {
        try {
            const style = window.getComputedStyle(el);
            if (el.disabled || el.readOnly || style.display === 'none' || style.visibility === 'hidden' || el.closest('[style*="display: none"]')) {
                continue;
            }

            const elType = el.tagName.toLowerCase();
            const isButton = elType === 'button' || el.getAttribute('role') === 'button';

            // Skip non-interactive buttons
            if (isButton && (el.type ==='submit' || el.type === 'reset')) continue;
            
            // --- Check if already filled ---
            const isRadioOrCheckbox = el.type === 'radio' || el.type === 'checkbox';
            let isFilled = false;

            if (isRadioOrCheckbox) {
                if (el.name && document.querySelector(`input[name="${el.name}"]:checked`)) {
                    isFilled = true;
                }
            } else if (elType === 'select') {
                const selectedOption = el.options[el.selectedIndex];
                if (el.selectedIndex > 0 || (selectedOption && selectedOption.value && selectedOption.value.trim() !== '')) {
                    isFilled = true;
                }
            } else if (el.isContentEditable) {
                if (el.textContent?.trim()) {
                    isFilled = true;
                }
            } else if (typeof el.value === 'string' && el.value.trim()) {
                if (el.placeholder && el.value === el.placeholder) {
                    // Value is just a placeholder, not filled.
                    isFilled = false;
                } else {
                    isFilled = true;
                }
            }

            if (isFilled) {
                continue;
            }

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 200));

            const question = findQuestionForInput(el);
            const combinedText = `${el.id} ${el.name} ${question}`.toLowerCase();
            const isDemographic = demographicKeywords.some(keyword => combinedText.includes(keyword));

            if (isDemographic) {
                // Handle demographic questions and move on
                continue;
            }
            
            // --- Resume Field ---
            if (combinedText.includes('resume') || combinedText.includes('cv')) {
                 if (el.type === 'file' || (isButton && combinedText.includes('attach'))) {
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
                if(elType === 'textarea' || el.isContentEditable) {
                    const resumeText = await getAIResponse("Summarize the attached resume into a plain text version, focusing on skills and experience.", userData);
                    if (resumeText) await simulateTyping(el, resumeText);
                    continue;
                }
            }

            // --- Cover Letter ---
            if (el.dataset.testid === 'cover_letter-text') {
                await simulateClick(el);
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for textarea to appear

                const coverLetterTextArea = document.getElementById('cover_letter_text');
                if (coverLetterTextArea) {
                    const coverLetterPrompt = `You are a helpful career assistant. Based on the provided resume, user profile, and job description, write a compelling cover letter.
                        ---
                        **CONTEXT:**
                        - Job Title: ${jobTitle || 'Not found.'}
                        - Job Description: ${jobDescription || 'Not found.'}
                        - My Profile & Skills: ${userData.additionalInfo || 'Not provided.'}
                        ---
                        **INSTRUCTIONS:**
                        - The cover letter should be professional, concise, and tailored to the job.
                        - Highlight relevant skills and experiences from my profile.
                        - Address it to the hiring manager if possible, otherwise use a generic salutation.
                        - Keep it to 3-4 paragraphs.
                        - Return only the cover letter text.
                        **COVER LETTER:**`;
                    const coverLetterText = await getAIResponse(coverLetterPrompt, userData);
                    if (coverLetterText) {
                        await simulateTyping(coverLetterTextArea, coverLetterText);
                    }
                }
                continue; // Move to the next element
            }
            
            // --- Work Experience ---
            if (combinedText.includes('experience') || (workHistory[experienceIndex] && (combinedText.includes(workHistory[experienceIndex].company.toLowerCase()) || combinedText.includes(workHistory[experienceIndex].jobTitle.toLowerCase())))) {
                 if (experienceIndex < workHistory.length) {
                    const currentJob = workHistory[experienceIndex];
                    if (combinedText.includes('title')) await simulateTyping(el, currentJob.jobTitle);
                    else if (combinedText.includes('company')) await simulateTyping(el, currentJob.company);
                    else if (combinedText.includes('start')) await simulateTyping(el, currentJob.startDate);
                    else if (combinedText.includes('end')) await simulateTyping(el, currentJob.endDate);
                    else if (combinedText.includes('responsibilit')) {
                        await simulateTyping(el, currentJob.responsibilities);
                        experienceIndex++; 
                        const addButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => b.innerText.toLowerCase().includes('add') && b.innerText.toLowerCase().includes('experience'));
                        if (addButton) {
                            await simulateClick(addButton);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    continue;
                }
            }
            
            // --- Options (Dropdowns, Radios, etc.) ---
            const { options, source } = await findOptionsForInput(el);
            if (options.length > 0) {
                const cleanQuestion = question.replace(/[*:]$/, '').trim();
                 const prompt = `You are a helpful career assistant. Your task is to select the single best option from a list to answer a job application question.
                    ---
                    **CONTEXT:**
                    - Job Description: ${jobDescription || 'Not found.'}
                    - My Profile: ${userData.additionalInfo || 'Not provided.'}
                    - Answers Already Used: ${Array.from(usedAnswers).join(", ") || 'None'}
                    ---
                    **TASK:**
                    - Question: "${cleanQuestion}"
                    - Options:
                    - ${options.join("\n- ")}
                    ---
                    **INSTRUCTIONS:** Return ONLY the exact text of the best option from the list.
                    **BEST OPTION:**`;
                    
                const aiChoice = await getAIResponse(prompt, userData) || options[0]; // Fallback to first option
                
                usedAnswers.add(aiChoice);
                if (el.tagName.toLowerCase() === 'select') {
                    for (let option of el.options) {
                        if (option.text.trim() === aiChoice) { el.value = option.value; el.dispatchEvent(new Event('change', { bubbles: true })); break; }
                    }
                } else if (el.type === 'radio' || el.type === 'checkbox') {
                    for (const input of document.querySelectorAll(`input[name="${el.name}"]`)) {
                        const label = document.querySelector(`label[for="${input.id}"]`);
                        if (label && label.innerText.trim() === aiChoice) { await simulateClick(input); break; }
                    }
                } else {
                    const optionElements = Array.from(source.querySelectorAll('[role="option"], button'));
                    const targetOption = optionElements.find(opt => opt.innerText.trim() === aiChoice);
                    if (targetOption) await simulateClick(targetOption);
                    else await simulateTyping(el, aiChoice); // Type if direct match fails
                }
                continue;
            }
            
            // --- Standard Text Fields ---
            if (elType === 'input' || elType === 'textarea' || el.isContentEditable) {
                let valueToType = '';
                if (combinedText.includes('first') && combinedText.includes('name')) valueToType = userData.firstName;
                else if (combinedText.includes('last') && combinedText.includes('name')) valueToType = userData.lastName;
                else if (combinedText.includes('full') && combinedText.includes('name')) valueToType = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                else if (combinedText.includes('email')) valueToType = userData.email;
                else if (combinedText.includes('phone')) valueToType = userData.phone;
                else if (combinedText.includes('pronoun')) valueToType = userData.pronouns;
                else if (combinedText.includes('address')) valueToType = userData.address;
                else if (combinedText.includes('city')) valueToType = userData.city;
                else if (combinedText.includes('state') || combinedText.includes('province')) valueToType = userData.state;
                else if (combinedText.includes('zip') || combinedText.includes('postal')) valueToType = userData.zipCode;
                else if (combinedText.includes('country')) valueToType = userData.country;
                else if (combinedText.includes('linkedin')) valueToType = userData.linkedinUrl;
                else if (combinedText.includes('website') || combinedText.includes('portfolio')) valueToType = userData.portfolioUrl;
                
                if (valueToType) {
                     await simulateTyping(el, valueToType);
                } else {
                    const cleanQuestion = question.replace(/[*:]$/, '').trim();
                    if (cleanQuestion.length > 10 && !isDemographic) {
                        const prompt = `You are a helpful career assistant. Answer the following job application question concisely, based on my resume and the job description.
                            ---
                            **CONTEXT:**
                            - Job Description: ${jobDescription || 'Not found.'}
                            - My Profile: ${userData.additionalInfo || 'Not provided.'}
                            - Answers Already Used: ${Array.from(usedAnswers).join(", ") || 'None'}
                            ---
                            **TASK:**
                            - Question: "${cleanQuestion}"
                            ---
                            **INSTRUCTIONS:** Write only the answer itself, with no preamble.
                            **ANSWER:**`;
                        const aiAnswer = await getAIResponse(prompt, userData) || "Based on my experience, I am a strong fit for this role."; // Final fallback
                        usedAnswers.add(aiAnswer);
                        await simulateTyping(el, aiAnswer);
                    }
                }
            }
        } catch (error) {
            console.error("AI Autofill: Error processing element:", el, error);
        }
    }
    console.log("AI Autofill: Process finished.");
}

