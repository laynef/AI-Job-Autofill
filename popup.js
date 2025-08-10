// This top-level try...catch block prevents the entire script from failing if an unexpected error occurs during setup.
try {
    document.addEventListener('DOMContentLoaded', function () {
        const statusEl = document.getElementById('status');
        const resumeFileNameEl = document.getElementById('resumeFileName');
        const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'company', 'currentJobTitle', 'additionalInfo', 'apiKey'];

        // Load saved data when the popup opens
        chrome.storage.local.get([...textFields, 'resumeFileName'], function (result) {
            if (chrome.runtime.lastError) {
                console.error("Error loading data:", chrome.runtime.lastError.message);
                return;
            }
            textFields.forEach(field => {
                const el = document.getElementById(field);
                if (el && result[field]) {
                    el.value = result[field];
                }
            });
            if (result.resumeFileName && resumeFileNameEl) {
                resumeFileNameEl.textContent = `Saved file: ${result.resumeFileName}`;
            }
        });

        // Save data when the save button is clicked
        document.getElementById('save').addEventListener('click', function () {
            try {
                let dataToSave = {};
                textFields.forEach(field => {
                    const el = document.getElementById(field);
                    if (el) {
                        dataToSave[field] = el.value;
                    } else {
                        // This warning helps debug if the HTML is missing an element.
                        console.warn(`Element with ID "${field}" not found in popup.html.`);
                    }
                });

                const resumeFile = document.getElementById('resumeFile')?.files[0];

                const saveDataToStorage = (data) => {
                    chrome.storage.local.set(data, function () {
                        if (chrome.runtime.lastError) {
                            statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                            console.error("Save error:", chrome.runtime.lastError);
                        } else {
                            statusEl.textContent = 'Information saved!';
                            if (data.resumeFileName && resumeFileNameEl) {
                                resumeFileNameEl.textContent = `Saved file: ${data.resumeFileName}`;
                            }
                        }
                        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2500);
                    });
                };

                if (resumeFile) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        dataToSave.resume = e.target.result; // The Base64 string
                        dataToSave.resumeFileName = resumeFile.name;
                        saveDataToStorage(dataToSave);
                    };
                    reader.onerror = function (err) {
                        statusEl.textContent = 'Error reading file.';
                        console.error("File reading error:", err);
                    };
                    reader.readAsDataURL(resumeFile);
                } else {
                    saveDataToStorage(dataToSave);
                }
            } catch (error) {
                statusEl.textContent = 'A critical error occurred during save.';
                console.error("Critical error in save handler:", error);
            }
        });

        // Autofill button logic
        document.getElementById('autofill').addEventListener('click', function () {
            statusEl.textContent = 'Autofilling...';
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                // Check if we have a valid tab to inject into
                if (tabs.length === 0 || !tabs[0].id) {
                    statusEl.textContent = 'Could not find active tab.';
                    return;
                }
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
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

    // --- Enhanced Question Finder ---
    function findQuestionForInput(element) {
        const checks = [
            element.getAttribute('aria-label'),
            element.placeholder,
            element.id ? document.querySelector(`label[for="${element.id}"]`)?.innerText : null,
            element.getAttribute('aria-labelledby') ? document.getElementById(element.getAttribute('aria-labelledby'))?.innerText : null
        ];
        for (const check of checks) {
            if (check && check.trim()) return check.trim();
        }
        let current = element.parentElement;
        for (let i = 0; i < 5 && current; i++) { // Increased search depth
            const clone = current.cloneNode(true);
            // Attempt to find the element within the cloned structure
            const cloneEl = clone.querySelector(`[name="${element.name}"]`) || (element.id && clone.querySelector(`#${element.id}`));
            if (cloneEl) {
                cloneEl.parentElement.removeChild(cloneEl); // More robust removal
            }
            // Find the most likely label text, avoiding overly long strings
            const text = clone.innerText.trim().split('\n')[0].trim();
            if (text && text.length > 3 && text.length < 200) return text;
            current = current.parentElement;
        }
        return ''; // Return empty if no question is found
    }

    // --- Page Context Scraping ---
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
        console.log("AI Autofill: Found job title:", jobTitle);
    } catch (e) {
        console.error("AI Autofill: Could not parse page context:", e);
    }

    // --- Load User Data ---
    const userData = await new Promise(resolve => {
        // Added apiKey to the list of fields to retrieve
        const fields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'company', 'currentJobTitle', 'resume', 'additionalInfo', 'apiKey'];
        chrome.storage.local.get(fields, (result) => {
            if (chrome.runtime.lastError) {
                console.error("AI Autofill: Error getting user data from storage.");
                resolve(null); // Resolve with null on error
            } else {
                resolve(result);
            }
        });
    });

    if (!userData) {
        console.error("AI Autofill: Could not load user data. Aborting.");
        alert("AI Autofill: Could not load your saved data. Please check the extension settings.");
        return;
    }
    if (!userData.apiKey) {
        console.error("AI Autofill: API Key is missing.");
        alert("AI Autofill: Your API key is not saved. Please add it in the extension popup.");
        return;
    }

    // --- Main Processing Logic ---
    const elements = document.querySelectorAll('input, textarea, select');
    console.log(`AI Autofill: Found ${elements.length} form elements to process.`);
    const demographicKeywords = ['race', 'ethnicity', 'gender', 'disability', 'veteran', 'sexual orientation', 'lgbtq'];

    for (const el of elements) {
        try { // Wrap each element processing in a try-catch block
            if (el.type === 'hidden' || el.disabled || el.readOnly || (el.value && el.type !== 'radio' && el.type !== 'checkbox')) {
                continue;
            }

            const question = findQuestionForInput(el);
            const combinedText = `${el.name} ${el.id} ${el.placeholder} ${question}`.toLowerCase();
            console.log(`AI Autofill: Processing element -> NAME: ${el.name}, ID: ${el.id}, Q: "${question}"`);


            // --- Demographic Questions ---
            const isDemographic = demographicKeywords.some(keyword => combinedText.includes(keyword));
            if (isDemographic) {
                console.log(`AI Autofill: Detected demographic question for ${el.name || el.id}.`);
                if (el.tagName.toLowerCase() === 'select') {
                    for (let option of el.options) {
                        if (option.text.toLowerCase().includes('decline') || option.text.toLowerCase().includes('prefer not')) {
                            el.value = option.value;
                            break;
                        }
                    }
                } else if (el.type === 'radio' || el.type === 'checkbox') {
                    const labelText = (document.querySelector(`label[for="${el.id}"]`)?.innerText || '').toLowerCase();
                    if (labelText.includes('decline') || labelText.includes('prefer not')) {
                        el.checked = true;
                    }
                }
                continue; // Skip to next element
            }

            // --- File Input ---
            if (el.type === 'file') {
                el.style.border = '2px solid #8B5CF6';
                let notice = document.createElement('p');
                notice.textContent = 'Please attach your resume PDF here.';
                notice.style.color = '#8B5CF6';
                notice.style.fontSize = '12px';
                notice.style.marginTop = '4px';
                if (!el.parentElement.querySelector('p[style*="color: #8B5CF6"]')) {
                    el.parentElement.insertBefore(notice, el.nextSibling);
                }
                continue;
            }

            // --- Standard Input Fields ---
            if (el.tagName.toLowerCase() === 'input' && el.type !== 'radio' && el.type !== 'checkbox') {
                let filled = true;
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
                else filled = false;
                if (filled) continue;
            }

            // --- AI-Powered Selection (Radio/Select) ---
            if (el.tagName.toLowerCase() === 'select' || el.type === 'radio' || el.type === 'checkbox') {
                const cleanQuestion = question.replace(/[*:]$/, '').trim();
                let options = [];
                if (el.tagName.toLowerCase() === 'select') {
                    options = Array.from(el.options).map(opt => opt.text).filter(t => t.trim() !== '' && !t.toLowerCase().includes('select'));
                } else {
                    const groupName = el.name;
                    options = Array.from(document.querySelectorAll(`input[name="${groupName}"]`)).map(radio => document.querySelector(`label[for="${radio.id}"]`)?.innerText.trim()).filter(Boolean);
                }

                if (cleanQuestion.length > 5 && options.length > 0) {
                    console.log(`AI Autofill: Calling AI for selection question: "${cleanQuestion}"`);
                    const prompt = `You are an expert career assistant. Your task is to select the best option from a list to answer an application question, based on my profile and the job description.\n---\n**CONTEXT: THE JOB DESCRIPTION**\n${jobDescription || 'Not found on page.'}\n---\n**CONTEXT: MY PROFILE**\n- **Additional Info/Skills:** ${userData.additionalInfo || 'Not provided.'}\n- **Current/Last Company:** ${userData.company || 'Not provided'}\n- **Current/Last Job Title:** ${userData.currentJobTitle || 'Not provided'}\n---\n**TASK: From the list below, choose the single most appropriate option to answer the question. I will provide my resume separately.**\n**Question:** "${cleanQuestion}"\n**Options:**\n- ${options.join("\n- ")}\n---\n**INSTRUCTIONS:**\n- Analyze my profile and the job description to make the most logical choice.\n- If the question is about experience, choose the option that best reflects the skills in my profile.\n- If the question is about work style, choose the option that sounds most proactive, collaborative, and positive.\n- For "How did you hear about us?", prefer "LinkedIn" or "Company Website".\n- For authorization/sponsorship, choose "Yes" for authorization and "No" for sponsorship.\n- For opting out of texts, choose the option that opts out or says no.\n- Return ONLY the exact text of the best option from the list. Do not add any other words, explanation, or punctuation.\n---\n**BEST OPTION:**`;
                    const parts = [{
                        text: prompt
                    }];
                    if (userData.resume && userData.resume.startsWith('data:application/pdf;base64,')) {
                        const base64Data = userData.resume.split(',')[1];
                        parts.push({
                            inlineData: {
                                mimeType: "application/pdf",
                                data: base64Data
                            }
                        });
                    }
                    const payload = {
                        contents: [{
                            parts: parts
                        }]
                    };
                    const apiKey = userData.apiKey;
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const result = await response.json();
                    const aiChoice = result.candidates?.[0]?.content?.parts?.[0]?.text.trim();

                    if (aiChoice) {
                        console.log(`AI Autofill: AI choice for "${cleanQuestion}" -> "${aiChoice}"`);
                        if (el.tagName.toLowerCase() === 'select') {
                            for (let option of el.options) {
                                if (option.text.trim() === aiChoice) {
                                    el.value = option.value;
                                    break;
                                }
                            }
                        } else if (el.type === 'radio' || el.type === 'checkbox') {
                            const groupName = el.name;
                            const inputs = document.querySelectorAll(`input[name="${groupName}"]`);
                            for (const input of inputs) {
                                const label = document.querySelector(`label[for="${input.id}"]`);
                                if (label && label.innerText.trim() === aiChoice) {
                                    input.checked = true;
                                    break;
                                }
                            }
                        }
                    } else {
                        console.warn(`AI Autofill: AI did not provide a choice for "${cleanQuestion}".`);
                    }
                }
            }

            // --- AI-Powered Text Generation (Textarea/Input) ---
            if ((el.tagName.toLowerCase() === 'textarea' || el.type === 'text') && !el.value) {
                const cleanQuestion = question.replace(/[*:]$/, '').trim();
                if (cleanQuestion.length > 10 && !isDemographic) {
                    console.log(`AI Autofill: Calling AI for text question: "${cleanQuestion}"`);
                    const prompt = `You are an expert career assistant. Your primary goal is to align my profile with the role by analyzing the provided Job Description. I will provide my resume separately.\n---\n**CONTEXT: THE JOB DESCRIPTION**\n${jobDescription || 'Not found on page.'}\n---\n**CONTEXT: MY PROFILE**\n- **Additional Info/Skills:** ${userData.additionalInfo || 'Not provided.'}\n---\n**TASK: Answer the following application question.**\n**Question:** "${cleanQuestion}"\n---\n**INSTRUCTIONS:**\n1. Analyze the Job Description and my profile to formulate a concise, professional answer.\n2. For salary questions, state my expectations are negotiable and competitive.\n3. Write only the answer itself, with no preamble.\n---\n**ANSWER:**`;
                    const parts = [{
                        text: prompt
                    }];
                    if (userData.resume && userData.resume.startsWith('data:application/pdf;base64,')) {
                        const base64Data = userData.resume.split(',')[1];
                        parts.push({
                            inlineData: {
                                mimeType: "application/pdf",
                                data: base64Data
                            }
                        });
                    }
                    const payload = {
                        contents: [{
                            parts: parts
                        }]
                    };
                    const apiKey = userData.apiKey;
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const result = await response.json();
                    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                        const answer = result.candidates[0].content.parts[0].text.trim();
                        console.log(`AI Autofill: AI answer for "${cleanQuestion}" -> "${answer}"`);
                        el.value = answer;
                    } else {
                        console.warn(`AI Autofill: AI did not provide an answer for "${cleanQuestion}".`);
                    }
                }
            }
        } catch (error) {
            console.error(`AI Autofill: Failed to process element ${el.name || el.id}.`, error);
        }
    }
    console.log("AI Autofill: Process finished.");
    alert("AI Autofill has finished running!");
}
