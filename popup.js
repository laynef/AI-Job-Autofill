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

                // Save application to tracker before autofilling
                saveCurrentApplicationToTracker(tabs[0]);

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

        // View Tracker button
        document.getElementById('viewTracker').addEventListener('click', function() {
            chrome.tabs.create({ url: chrome.runtime.getURL('tracker.html') });
        });
    });
} catch (e) {
    console.error("A fatal error occurred in popup.js:", e);
}

// Save current job application to tracker
function saveCurrentApplicationToTracker(tab) {
    try {
        // Extract company and job title from page (async function)
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: extractJobInfo,
        }).then((results) => {
            if (results && results[0] && results[0].result) {
                const jobInfo = results[0].result;

                chrome.storage.local.get(['jobApplications'], function(result) {
                    let applications = result.jobApplications || [];

                    // Check if this job was already added (by URL)
                    const existingApp = applications.find(app => app.jobUrl === tab.url);

                    if (!existingApp && jobInfo.company && jobInfo.position) {
                        // Build notes with extracted metadata
                        let notes = 'Auto-saved from extension';
                        if (jobInfo.jobType) {
                            notes += `\nJob Type: ${jobInfo.jobType}`;
                        }

                        const newApp = {
                            id: 'app_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            company: jobInfo.company,
                            position: jobInfo.position,
                            location: jobInfo.location || '',
                            salary: jobInfo.salary || '',
                            applicationDate: new Date().toISOString().split('T')[0],
                            status: 'Applied',
                            jobUrl: tab.url,
                            contactName: '',
                            contactEmail: '',
                            notes: notes,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            timeline: [{
                                status: 'Applied',
                                date: new Date().toISOString().split('T')[0],
                                note: 'Application submitted via AI Autofill'
                            }]
                        };

                        applications.push(newApp);
                        chrome.storage.local.set({ jobApplications: applications }, function() {
                            console.log('Job application saved to tracker:', newApp.company, '-', newApp.position);
                        });
                    } else if (existingApp) {
                        console.log('Job application already exists in tracker');
                    } else {
                        console.warn('Could not save job application - missing company or position info');
                    }
                });
            }
        }).catch(err => {
            console.error('Error extracting job info:', err);
        });
    } catch (e) {
        console.error('Error in saveCurrentApplicationToTracker:', e);
    }
}

// Extract job information from page - returns a promise for async AI extraction
async function extractJobInfo() {
    // Extract job title with enhanced selectors
    const jobTitle = document.querySelector('h1')?.innerText ||
                     document.querySelector('h2')?.innerText ||
                     document.querySelector('[class*="job-title"]')?.innerText ||
                     document.querySelector('[class*="jobTitle"]')?.innerText ||
                     document.querySelector('[data-testid*="job-title"]')?.innerText ||
                     document.querySelector('[class*="position"]')?.innerText ||
                     document.querySelector('[class*="JobTitle"]')?.innerText ||
                     document.querySelector('[id*="job-title"]')?.innerText || '';

    // Extract company name with enhanced selectors
    let company = '';

    // First, try Greenhouse-specific selectors
    const greenhouseCompany = document.querySelector('.company-name')?.innerText ||
                             document.querySelector('[class*="app-title"]')?.innerText ||
                             document.querySelector('div[class*="application--header"] h2')?.innerText;

    if (greenhouseCompany && greenhouseCompany.length > 2 && greenhouseCompany.length < 100) {
        company = greenhouseCompany.trim();
        // Clean up if it says "Apply for this job" or similar
        if (!company.toLowerCase().includes('apply') && !company.toLowerCase().includes('application')) {
            company = company.replace(/\s*\(.*?\)\s*/g, '').trim();
        } else {
            company = ''; // Reset if it's just a generic header
        }
    }

    // Try standard selectors if Greenhouse didn't work
    if (!company) {
        const companySelectors = [
            '[class*="company-name"]',
            '[class*="companyName"]',
            '[class*="employer"]',
            '[data-testid*="company"]',
            '[class*="company"]',
            '[id*="company"]',
            'a[href*="/company/"]',
            '[class*="CompanyName"]',
            '[class*="employerName"]',
            '[class*="organization"]',
            'h2',
            'h3'
        ];

        for (const selector of companySelectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText && el.innerText.length < 100 && el.innerText.length > 2) {
                company = el.innerText.trim();
                // Clean up common patterns
                company = company.replace(/\s*\(.*?\)\s*/g, '').trim();
                if (company && company !== jobTitle.trim() &&
                    !company.toLowerCase().includes('apply') &&
                    !company.toLowerCase().includes('application')) {
                    break;
                }
                company = ''; // Reset if invalid
            }
        }
    }

    // If no company found via selectors, try to extract from meta tags
    if (!company) {
        const metaCompany = document.querySelector('meta[property="og:site_name"]') ||
                           document.querySelector('meta[name="company"]') ||
                           document.querySelector('meta[property="og:description"]');
        if (metaCompany && metaCompany.content) {
            company = metaCompany.content.trim();
            // If it's the description, try to extract company name from it
            if (metaCompany.getAttribute('property') === 'og:description') {
                const companyMatch = company.match(/(?:at|for|with)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s+is|\s+in|\s+based|\.|\,)/);
                if (companyMatch && companyMatch[1]) {
                    company = companyMatch[1].trim();
                }
            }
        }
    }

    // Try to extract from page URL (common pattern: company.com/jobs or boards.greenhouse.io/company)
    if (!company) {
        try {
            const url = window.location.href;

            // Greenhouse pattern: boards.greenhouse.io/COMPANY
            if (url.includes('greenhouse.io/')) {
                const greenhouseMatch = url.match(/greenhouse\.io\/([^\/\?]+)/);
                if (greenhouseMatch && greenhouseMatch[1]) {
                    company = greenhouseMatch[1]
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                }
            }

            // Lever pattern: jobs.lever.co/COMPANY
            if (!company && url.includes('lever.co/')) {
                const leverMatch = url.match(/lever\.co\/([^\/\?]+)/);
                if (leverMatch && leverMatch[1]) {
                    company = leverMatch[1]
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                }
            }

            // Generic careers page: company.com/careers or jobs.company.com
            if (!company) {
                const domain = new URL(url).hostname;
                if (domain.includes('jobs.') || domain.includes('careers.')) {
                    const domainParts = domain.split('.');
                    const companyPart = domainParts.find(part => part !== 'jobs' && part !== 'careers' && part !== 'www' && part !== 'com' && part !== 'io' && part !== 'net' && part !== 'org');
                    if (companyPart) {
                        company = companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
                    }
                }
            }
        } catch (e) {
            // Ignore URL parsing errors
        }
    }

    // Try to extract from document title
    if (!company) {
        try {
            const title = document.title;
            // Pattern: "Job Title - Company Name" or "Job Title at Company Name"
            const titlePatterns = [
                /\s+(?:at|-|@)\s+([A-Z][a-zA-Z0-9\s&\.]+?)(?:\s+\||$)/,
                /^([A-Z][a-zA-Z0-9\s&\.]+?)\s+[-:]\s+/
            ];

            for (const pattern of titlePatterns) {
                const titleMatch = title.match(pattern);
                if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 2 && titleMatch[1].trim().length < 50) {
                    const potentialCompany = titleMatch[1].trim();
                    // Filter out common job board names
                    if (!potentialCompany.toLowerCase().includes('greenhouse') &&
                        !potentialCompany.toLowerCase().includes('lever') &&
                        !potentialCompany.toLowerCase().includes('linkedin') &&
                        !potentialCompany.toLowerCase().includes('indeed')) {
                        company = potentialCompany;
                        break;
                    }
                }
            }
        } catch (e) {
            // Ignore title parsing errors
        }
    }

    // Try to extract from job description text if still not found
    if (!company) {
        try {
            // Look in structured data first (most reliable)
            const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
            if (ldJsonScript) {
                try {
                    const jsonData = JSON.parse(ldJsonScript.textContent);
                    const jobPosting = Array.isArray(jsonData) ? jsonData.find(j => j['@type'] === 'JobPosting') : jsonData;
                    if (jobPosting && jobPosting.hiringOrganization) {
                        company = jobPosting.hiringOrganization.name || jobPosting.hiringOrganization;
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }

            // Look for common patterns in the page text
            if (!company) {
                const bodyText = document.body.innerText;

                // Pattern: "Company Name is hiring" or "Join Company Name"
                const hiringPattern = /(?:Join|About)\s+([A-Z][a-zA-Z0-9\s&]{2,50}?)(?:\s+is\s+(?:hiring|looking|seeking)|'s\s+team)/;
                const hiringMatch = bodyText.match(hiringPattern);
                if (hiringMatch && hiringMatch[1]) {
                    company = hiringMatch[1].trim();
                }
            }
        } catch (e) {
            // Ignore extraction errors
        }
    }

    // Final cleanup
    if (company) {
        // Remove common suffixes and clean up
        company = company.replace(/\s*\|\s*.*/g, '').trim(); // Remove "| Career Page" etc
        company = company.replace(/\s*-\s*.*/g, '').trim(); // Remove "- Jobs" etc
        company = company.split('\n')[0].trim(); // Take only first line
        if (company.length > 100) company = ''; // Too long, probably not a company name
    }

    // If company is still not found, try to extract from job description using AI
    if (!company) {
        try {
            // Get job description text
            let jobDescription = '';
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

            // Use AI to extract company name from description
            if (jobDescription) {
                const userData = await new Promise(resolve => {
                    chrome.storage.local.get(['apiKey'], (result) => {
                        resolve(result);
                    });
                });

                if (userData.apiKey) {
                    const companyPrompt = `Extract the company name from this job description. Return ONLY the company name, nothing else.

Job Description:
${jobDescription.substring(0, 3000)}`;

                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userData.apiKey}`;
                    const payload = { contents: [{ role: "user", parts: [{ text: companyPrompt }] }] };

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        const extractedCompany = result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "";
                        if (extractedCompany && extractedCompany.length > 2 && extractedCompany.length < 100) {
                            company = extractedCompany;
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Could not extract company via AI:', e);
        }
    }

    // Extract location with enhanced selectors
    let location = '';
    const locationSelectors = [
        '[class*="location"]',
        '[class*="jobLocation"]',
        '[data-testid*="location"]',
        '[class*="city"]',
        '[id*="location"]'
    ];

    for (const selector of locationSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText) {
            location = el.innerText.trim();
            if (location.length > 2 && location.length < 100) break;
        }
    }

    // Extract salary information
    let salary = '';
    const salarySelectors = [
        '[class*="salary"]',
        '[class*="compensation"]',
        '[class*="pay"]',
        '[data-testid*="salary"]',
        '[id*="salary"]'
    ];

    for (const selector of salarySelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText) {
            const text = el.innerText.trim();
            // Look for salary patterns ($XX,XXX or $XXk)
            if (text.match(/\$[\d,]+k?/i) || text.match(/\d+[kK]\s*-\s*\d+[kK]/)) {
                salary = text;
                break;
            }
        }
    }

    // If no salary found, search page text for common patterns
    if (!salary) {
        const bodyText = document.body.innerText;
        const salaryMatch = bodyText.match(/\$\d{2,3}[,\.]?\d{0,3}[kK]?\s*[-–]\s*\$\d{2,3}[,\.]?\d{0,3}[kK]?/);
        if (salaryMatch) {
            salary = salaryMatch[0];
        }
    }

    // Extract job type (Full-time, Part-time, Contract, etc.)
    let jobType = '';
    const jobTypePatterns = ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'remote', 'hybrid'];
    const pageTextLower = document.body.innerText.toLowerCase();

    for (const pattern of jobTypePatterns) {
        if (pageTextLower.includes(pattern)) {
            jobType = pattern.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
            break;
        }
    }

    return {
        position: jobTitle.trim(),
        company: company,
        location: location,
        salary: salary,
        jobType: jobType
    };
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
        element.focus();
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    async function selectReactSelectOption(inputElement, optionText) {
        try {
            // Click to open dropdown
            await simulateClick(inputElement);
            await new Promise(resolve => setTimeout(resolve, 300));

            // Find the listbox
            const ariaControls = inputElement.getAttribute('aria-controls');
            let listbox = null;

            if (ariaControls) {
                listbox = document.getElementById(ariaControls);
            }

            if (!listbox) {
                listbox = document.querySelector('[role="listbox"]:not(.iti__hide)');
            }

            if (listbox) {
                const options = Array.from(listbox.querySelectorAll('[role="option"]'));
                const targetOption = options.find(opt =>
                    opt.innerText.toLowerCase().includes(optionText.toLowerCase()) ||
                    optionText.toLowerCase().includes(opt.innerText.toLowerCase())
                );

                if (targetOption) {
                    await simulateClick(targetOption);
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Verify selection was successful
                    const selectedValue = inputElement.value || inputElement.getAttribute('aria-activedescendant');
                    if (selectedValue) {
                        return true;
                    }
                }
            }

            console.warn("Could not find matching option in dropdown for:", optionText);
            // Close dropdown by clicking away
            await simulateClick(document.body);
            await new Promise(resolve => setTimeout(resolve, 200));
            return false;
        } catch (error) {
            console.error("Error selecting React Select option:", error);
            return false;
        }
    }

    async function attachResumeFile(resumeBase64, fileName) {
        try {
            // Find resume upload button
            const resumeButtons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(btn => {
                const text = btn.innerText.toLowerCase();
                return text.includes('attach') && (text.includes('resume') || text.includes('cv'));
            });

            if (resumeButtons.length === 0) return false;

            // Find file input
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(input => {
                const id = input.id.toLowerCase();
                return id.includes('resume') || id.includes('cv');
            });

            if (fileInputs.length === 0) return false;

            const fileInput = fileInputs[0];

            // Convert base64 to file
            const file = await base64ToFile(resumeBase64, fileName, fileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            if (!file) return false;

            // Create a DataTransfer object to set files
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;

            // Trigger change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 500));

            return true;
        } catch (error) {
            console.error("Error attaching resume:", error);
            return false;
        }
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

    const educationPrompt = "Analyze the attached resume and extract education history. Return a JSON array where each object has 'degree', 'school', 'fieldOfStudy', 'startDate', 'endDate', and 'gpa' keys. If GPA is not mentioned, use an empty string.";
    let educationHistory = [];
    try {
        const educationJson = await getAIResponse(educationPrompt, userData);
        if (educationJson) {
            const cleanedJson = educationJson.replace(/```json/g, '').replace(/```/g, '').trim();
            educationHistory = JSON.parse(cleanedJson);
        }
    } catch(e) { console.error("AI Autofill: Could not parse education from resume.", e); }

    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for the page to finish loading dynamic content
    
    const demographicKeywords = ['race', 'ethnicity', 'gender', 'disability', 'veteran', 'sexual orientation'];
    let usedAnswers = new Set();
    let experienceIndex = 0;
    let educationIndex = 0;
    
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
                if (el.selectedIndex > 0 || (selectedOption && selectedOption.value && selectedOption.text.toLowerCase().trim() !== 'select' && selectedOption.value.trim() !== '')) {
                    isFilled = true;
                }
            } else if (el.isContentEditable) {
                if (el.textContent?.trim()) {
                    isFilled = true;
                }
            } else if (typeof el.value === 'string' && el.value.trim()) {
                if (el.placeholder && el.value.trim() === el.placeholder.trim()) {
                    isFilled = false;
                } else {
                    isFilled = true;
                }
            }

            if (isFilled) {
                console.log("AI Autofill: Skipping already filled element:", el);
                continue;
            }

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 200));

            const question = findQuestionForInput(el);
            const combinedText = `${el.id} ${el.name} ${question}`.toLowerCase();
            const isDemographic = demographicKeywords.some(keyword => combinedText.includes(keyword));

            // --- Handle EEOC/Demographic Fields ---
            if (isDemographic) {
                const inputRole = el.getAttribute('role');

                // Handle race/ethnicity dropdown (React Select)
                if ((combinedText.includes('race') || combinedText.includes('ethnicity')) &&
                    inputRole === 'combobox') {
                    await selectReactSelectOption(el, 'Decline To Self Identify');
                    continue;
                }

                // Handle gender dropdown (React Select)
                if (combinedText.includes('gender') && inputRole === 'combobox') {
                    await selectReactSelectOption(el, 'Decline to Self-Identify');
                    continue;
                }

                // Handle veteran status dropdown (React Select)
                if (combinedText.includes('veteran') && inputRole === 'combobox') {
                    await selectReactSelectOption(el, 'I don\'t wish to answer');
                    continue;
                }

                // Handle disability status dropdown (React Select)
                if (combinedText.includes('disability') && inputRole === 'combobox') {
                    await selectReactSelectOption(el, 'I don\'t wish to answer');
                    continue;
                }

                // Handle hispanic/latino dropdown (React Select)
                if ((combinedText.includes('hispanic') || combinedText.includes('latino')) &&
                    inputRole === 'combobox') {
                    await selectReactSelectOption(el, 'I don\'t wish to answer');
                    continue;
                }

                // Skip other demographic fields
                continue;
            }
            
            // --- Resume Field ---
            if (combinedText.includes('resume') || combinedText.includes('cv')) {
                 if (el.type === 'file') {
                    // Attempt to attach resume file
                    if (userData.resume && userData.resumeFileName) {
                        console.log("AI Autofill: Attempting to attach resume file...");
                        const attached = await attachResumeFile(userData.resume, userData.resumeFileName);
                        if (attached) {
                            console.log("AI Autofill: Resume attached successfully!");
                        } else {
                            console.log("AI Autofill: Could not automatically attach resume. User will need to upload manually.");
                            el.style.border = '2px solid #8B5CF6';
                            let notice = el.parentElement.querySelector('p.autofill-notice');
                            if (!notice) {
                                notice = document.createElement('p');
                                notice.className = 'autofill-notice';
                                notice.textContent = 'Please attach your resume file here.';
                                notice.style.cssText = 'color: #8B5CF6; font-size: 12px; margin-top: 4px;';
                                el.parentElement.insertBefore(notice, el.nextSibling);
                            }
                        }
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
            const isWorkExperienceField = combinedText.includes('experience') || combinedText.includes('employment') ||
                                         combinedText.includes('work history') || combinedText.includes('job history') ||
                                         (workHistory[experienceIndex] && (combinedText.includes(workHistory[experienceIndex].company.toLowerCase()) ||
                                          combinedText.includes(workHistory[experienceIndex].jobTitle.toLowerCase())));

            if (isWorkExperienceField && experienceIndex < workHistory.length) {
                const currentJob = workHistory[experienceIndex];
                let filled = false;

                // Job title
                if (combinedText.includes('title') || combinedText.includes('position') || combinedText.includes('role')) {
                    await simulateTyping(el, currentJob.jobTitle);
                    filled = true;
                }
                // Company/Employer
                else if (combinedText.includes('company') || combinedText.includes('employer') || combinedText.includes('organization')) {
                    await simulateTyping(el, currentJob.company);
                    filled = true;
                }
                // Start date
                else if (combinedText.includes('start') && (combinedText.includes('date') || combinedText.includes('from'))) {
                    await simulateTyping(el, currentJob.startDate);
                    filled = true;
                }
                // End date
                else if (combinedText.includes('end') && (combinedText.includes('date') || combinedText.includes('to'))) {
                    await simulateTyping(el, currentJob.endDate || 'Present');
                    filled = true;
                }
                // Responsibilities/Description
                else if (combinedText.includes('responsibilit') || combinedText.includes('dut') ||
                         combinedText.includes('description') || combinedText.includes('achievement')) {
                    await simulateTyping(el, currentJob.responsibilities);
                    filled = true;

                    // Move to next job and look for "Add Another" button
                    experienceIndex++;
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Find and click "Add" button for next experience if more jobs exist
                    if (experienceIndex < workHistory.length) {
                        const addButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                            const btnText = b.innerText.toLowerCase();
                            return (btnText.includes('add') && (btnText.includes('experience') || btnText.includes('another') || btnText.includes('more'))) ||
                                   btnText.includes('+ experience');
                        });
                        if (addButton) {
                            await simulateClick(addButton);
                            await new Promise(resolve => setTimeout(resolve, 800)); // Wait for new fields to appear
                        }
                    }
                }

                if (filled) continue;
            }

            // --- Education ---
            const isEducationField = combinedText.includes('education') || combinedText.includes('school') ||
                                    combinedText.includes('university') || combinedText.includes('college') ||
                                    combinedText.includes('degree') || combinedText.includes('academic') ||
                                    (educationHistory[educationIndex] && (combinedText.includes(educationHistory[educationIndex].school.toLowerCase()) ||
                                     combinedText.includes(educationHistory[educationIndex].degree.toLowerCase())));

            if (isEducationField && educationIndex < educationHistory.length) {
                const currentEd = educationHistory[educationIndex];
                let filled = false;

                // School/University name
                if (combinedText.includes('school') || combinedText.includes('university') ||
                    combinedText.includes('college') || combinedText.includes('institution')) {
                    await simulateTyping(el, currentEd.school);
                    filled = true;
                }
                // Degree
                else if (combinedText.includes('degree') || combinedText.includes('qualification') ||
                         combinedText.includes('level of education')) {
                    await simulateTyping(el, currentEd.degree);
                    filled = true;
                }
                // Field of study/Major
                else if (combinedText.includes('major') || combinedText.includes('field') ||
                         combinedText.includes('study') || combinedText.includes('concentration')) {
                    await simulateTyping(el, currentEd.fieldOfStudy);
                    filled = true;
                }
                // GPA
                else if (combinedText.includes('gpa') || combinedText.includes('grade point')) {
                    if (currentEd.gpa) {
                        await simulateTyping(el, currentEd.gpa);
                        filled = true;
                    }
                }
                // Start date
                else if (combinedText.includes('start') && (combinedText.includes('date') || combinedText.includes('from'))) {
                    await simulateTyping(el, currentEd.startDate);
                    filled = true;
                }
                // End date / Graduation date
                else if ((combinedText.includes('end') || combinedText.includes('graduation') || combinedText.includes('completion')) &&
                         (combinedText.includes('date') || combinedText.includes('year'))) {
                    await simulateTyping(el, currentEd.endDate || 'Expected 2024');
                    filled = true;

                    // Move to next education entry
                    educationIndex++;
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Find and click "Add" button for next education if more entries exist
                    if (educationIndex < educationHistory.length) {
                        const addButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                            const btnText = b.innerText.toLowerCase();
                            return (btnText.includes('add') && (btnText.includes('education') || btnText.includes('another') || btnText.includes('more'))) ||
                                   btnText.includes('+ education');
                        });
                        if (addButton) {
                            await simulateClick(addButton);
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                    }
                }

                if (filled) continue;
            }

            // --- Certifications and Skills ---
            if ((combinedText.includes('certification') || combinedText.includes('license') ||
                 combinedText.includes('credential')) && !isDemographic) {
                const certPrompt = `Based on my resume, list any professional certifications, licenses, or credentials I have. If the question asks for a specific certification like "${question}", respond with whether I have it (Yes/No) or provide the certification details if I have it.

Question: ${question}

Provide a concise answer.`;
                const certAnswer = await getAIResponse(certPrompt, userData);
                if (certAnswer) {
                    await simulateTyping(el, certAnswer);
                    continue;
                }
            }

            // Technical skills / Programming languages
            if ((combinedText.includes('programming') || combinedText.includes('language') ||
                 combinedText.includes('framework') || combinedText.includes('tool')) &&
                (combinedText.includes('skill') || combinedText.includes('familiar') ||
                 combinedText.includes('proficien') || combinedText.includes('experience'))) {
                const techSkillsPrompt = `Based on my resume and profile, list the relevant technical skills, programming languages, frameworks, or tools that match this question: "${question}". Provide a concise, comma-separated list or a brief answer.`;
                const techAnswer = await getAIResponse(techSkillsPrompt, userData);
                if (techAnswer) {
                    await simulateTyping(el, techAnswer);
                    continue;
                }
            }

            // --- Options (Dropdowns, Radios, etc.) ---
            const { options, source } = await findOptionsForInput(el);
            if (options.length > 0) {
                const cleanQuestion = question.replace(/[*:]$/, '').trim();

                // Determine question type for better AI context
                let questionType = 'general';
                if (combinedText.includes('willing') || combinedText.includes('relocat')) questionType = 'relocation';
                else if (combinedText.includes('remote') || combinedText.includes('hybrid')) questionType = 'work-location';
                else if (combinedText.includes('how') && combinedText.includes('hear')) questionType = 'referral-source';
                else if (combinedText.includes('status') || combinedText.includes('citizenship')) questionType = 'work-status';
                else if (combinedText.includes('notice') || combinedText.includes('period')) questionType = 'notice-period';

                const prompt = `You are a helpful career assistant. Your task is to select the single best option from a list to answer a job application question.
                    ---
                    **CONTEXT:**
                    - Job Title: ${jobTitle || 'Not specified'}
                    - Job Description: ${jobDescription || 'Not specified'}
                    - My Profile: ${userData.additionalInfo || 'Not provided'}
                    - Question Type: ${questionType}
                    - Answers Already Used: ${Array.from(usedAnswers).join(", ") || 'None'}
                    ---
                    **TASK:**
                    - Question: "${cleanQuestion}"
                    - Available Options:
                    ${options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}
                    ---
                    **INSTRUCTIONS:**
                    - Return ONLY the exact text of the best option from the list above.
                    - Do not add any explanation or preamble.
                    - Choose the most professional and appropriate answer.
                    - For yes/no questions, choose based on what would make me the strongest candidate.
                    - If unsure, prefer options that show flexibility and willingness.
                    **BEST OPTION:**`;

                let aiChoice = await getAIResponse(prompt, userData);

                // Clean up the AI response to match an option exactly
                aiChoice = aiChoice.trim();

                // Try fuzzy matching if exact match fails
                let bestMatch = options.find(opt => opt.trim().toLowerCase() === aiChoice.toLowerCase());
                if (!bestMatch) {
                    // Try partial match
                    bestMatch = options.find(opt => opt.toLowerCase().includes(aiChoice.toLowerCase()) || aiChoice.toLowerCase().includes(opt.toLowerCase()));
                }
                if (!bestMatch) {
                    // Fallback to first non-empty option
                    bestMatch = options.find(opt => opt.trim() && opt.toLowerCase() !== 'select' && opt.toLowerCase() !== 'choose') || options[0];
                }

                usedAnswers.add(bestMatch);

                // Select the option based on element type
                let selectionSuccessful = false;

                if (el.tagName.toLowerCase() === 'select') {
                    for (let option of el.options) {
                        if (option.text.trim() === bestMatch || option.text.trim().toLowerCase() === bestMatch.toLowerCase()) {
                            el.value = option.value;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            selectionSuccessful = true;
                            break;
                        }
                    }
                    // Verify selection
                    if (selectionSuccessful) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } else if (el.type === 'radio' || el.type === 'checkbox') {
                    for (const input of document.querySelectorAll(`input[name="${el.name}"]`)) {
                        const label = document.querySelector(`label[for="${input.id}"]`);
                        if (label && (label.innerText.trim() === bestMatch || label.innerText.trim().toLowerCase() === bestMatch.toLowerCase())) {
                            await simulateClick(input);
                            selectionSuccessful = true;
                            break;
                        }
                    }
                    // Verify selection
                    if (selectionSuccessful) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const isChecked = document.querySelector(`input[name="${el.name}"]:checked`);
                        if (!isChecked) {
                            console.warn("Radio/checkbox selection failed for:", question);
                        }
                    }
                } else if (el.getAttribute('role') === 'combobox') {
                    // Use AI-guided selection for combobox elements
                    selectionSuccessful = await selectReactSelectOption(el, bestMatch);

                    // If selection failed, try opening and selecting again with more time
                    if (!selectionSuccessful) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        selectionSuccessful = await selectReactSelectOption(el, bestMatch);
                    }

                    if (!selectionSuccessful) {
                        console.warn("Could not select dropdown option for:", question, "Tried to select:", bestMatch);
                    }
                } else {
                    // Custom dropdowns - button groups or other custom elements
                    const optionElements = Array.from(source.querySelectorAll('[role="option"], button'));
                    const targetOption = optionElements.find(opt =>
                        opt.innerText.trim() === bestMatch ||
                        opt.innerText.trim().toLowerCase() === bestMatch.toLowerCase()
                    );
                    if (targetOption) {
                        await simulateClick(targetOption);
                        selectionSuccessful = true;
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } else {
                        console.warn("Could not find option to click for:", question);
                    }
                }

                // Wait for any UI updates after selection
                if (selectionSuccessful) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                continue;
            }
            
            // --- Standard Text Fields ---
            if (elType === 'input' || elType === 'textarea' || el.isContentEditable) {
                let valueToType = '';

                // Name fields
                if ((combinedText.includes('first') && combinedText.includes('name')) ||
                    combinedText.includes('firstname') || combinedText.includes('given name')) {
                    valueToType = userData.firstName;
                }
                else if ((combinedText.includes('last') && combinedText.includes('name')) ||
                         combinedText.includes('lastname') || combinedText.includes('surname') ||
                         combinedText.includes('family name')) {
                    valueToType = userData.lastName;
                }
                else if ((combinedText.includes('full') && combinedText.includes('name')) ||
                         combinedText.includes('fullname') || combinedText.includes('legal name') ||
                         (combinedText.includes('name') && !combinedText.includes('user') && !combinedText.includes('file'))) {
                    valueToType = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                }
                // Contact information
                else if (combinedText.includes('email') || combinedText.includes('e-mail')) {
                    valueToType = userData.email;
                }
                else if (combinedText.includes('phone') || combinedText.includes('mobile') ||
                         combinedText.includes('telephone') || combinedText.includes('contact number')) {
                    // Handle intl-tel-input library if present
                    if (el.classList.contains('iti__tel-input') || el.hasAttribute('data-intl-tel-input-id')) {
                        // Find the country dropdown if it exists
                        const itiContainer = el.closest('.iti');
                        if (itiContainer && userData.country) {
                            const countryButton = itiContainer.querySelector('.iti__selected-country');
                            if (countryButton) {
                                await simulateClick(countryButton);
                                await new Promise(resolve => setTimeout(resolve, 300));

                                const countryList = itiContainer.querySelector('.iti__country-list');
                                if (countryList) {
                                    const countryOptions = Array.from(countryList.querySelectorAll('.iti__country'));
                                    const targetCountry = countryOptions.find(opt =>
                                        opt.querySelector('.iti__country-name')?.innerText.toLowerCase().includes(userData.country.toLowerCase())
                                    );
                                    if (targetCountry) {
                                        await simulateClick(targetCountry);
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                    }
                                }
                            }
                        }
                    }
                    valueToType = userData.phone;
                }
                else if (combinedText.includes('pronoun')) {
                    valueToType = userData.pronouns;
                }
                // Address fields
                else if ((combinedText.includes('address') && !combinedText.includes('email')) ||
                         combinedText.includes('street')) {
                    valueToType = userData.address;
                }
                else if (combinedText.includes('city') || combinedText.includes('town') ||
                         (combinedText.includes('location') && !combinedText.includes('work') && !combinedText.includes('job'))) {
                    // Check if this is a React Select combobox (like Greenhouse's location field)
                    if (el.getAttribute('role') === 'combobox' && el.hasAttribute('aria-autocomplete')) {
                        // Type the city and let autocomplete handle it
                        await simulateTyping(el, userData.city);
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Try to select the first option that appears
                        const ariaControls = el.getAttribute('aria-controls');
                        if (ariaControls) {
                            const listbox = document.getElementById(ariaControls);
                            if (listbox) {
                                const firstOption = listbox.querySelector('[role="option"]');
                                if (firstOption) {
                                    await simulateClick(firstOption);
                                }
                            }
                        }
                    } else {
                        valueToType = userData.city;
                    }
                    continue;
                }
                else if (combinedText.includes('state') || combinedText.includes('province') ||
                         combinedText.includes('region')) {
                    valueToType = userData.state;
                }
                else if (combinedText.includes('zip') || combinedText.includes('postal')) {
                    valueToType = userData.zipCode;
                }
                else if (combinedText.includes('country') || combinedText.includes('nation')) {
                    // Check if this is a React Select combobox
                    if (el.getAttribute('role') === 'combobox' && el.hasAttribute('aria-autocomplete')) {
                        await selectReactSelectOption(el, userData.country || 'United States');
                        continue;
                    }
                    valueToType = userData.country;
                }
                // Social/Professional links
                else if (combinedText.includes('linkedin')) {
                    valueToType = userData.linkedinUrl;
                }
                else if (combinedText.includes('website') || combinedText.includes('portfolio') ||
                         combinedText.includes('personal site') || combinedText.includes('url')) {
                    valueToType = userData.portfolioUrl;
                }
                // Availability and start date
                else if (combinedText.includes('available') || combinedText.includes('start date') ||
                         combinedText.includes('availability')) {
                    const availabilityPrompt = `Based on the job application context, provide a professional availability response. Common options: "Immediately", "2 weeks notice", "1 month", etc. Provide just the answer.`;
                    valueToType = await getAIResponse(availabilityPrompt, userData) || "Immediately";
                }
                // Salary expectations
                else if (combinedText.includes('salary') || combinedText.includes('compensation') ||
                         combinedText.includes('expected pay') || combinedText.includes('wage')) {
                    const salaryPrompt = `Based on the job description and my profile, what would be a reasonable salary expectation? Provide just a number or range (e.g., "$80,000 - $100,000" or "Negotiable").

Job: ${jobTitle || 'Not specified'}
Description: ${jobDescription || 'Not specified'}`;
                    valueToType = await getAIResponse(salaryPrompt, userData) || "Negotiable";
                }
                // Years of experience
                else if (combinedText.includes('years') && (combinedText.includes('experience') || combinedText.includes('exp'))) {
                    const yearsPrompt = `Based on my resume, how many years of relevant experience do I have? Provide just a number.`;
                    valueToType = await getAIResponse(yearsPrompt, userData) || "5";
                }
                // Skills/Technologies
                else if (combinedText.includes('skills') || combinedText.includes('technologies') ||
                         combinedText.includes('expertise') || combinedText.includes('proficienc')) {
                    valueToType = userData.additionalInfo || await getAIResponse("List my key technical skills from my resume in a concise format.", userData);
                }
                // References
                else if (combinedText.includes('reference') && !combinedText.includes('preference')) {
                    valueToType = "Available upon request";
                }
                // Authorization to work
                else if (combinedText.includes('authorized') || combinedText.includes('authorization') ||
                         combinedText.includes('eligible to work') || combinedText.includes('work permit')) {
                    valueToType = "Yes";
                }
                // Sponsorship
                else if (combinedText.includes('sponsor') || combinedText.includes('visa')) {
                    valueToType = "No";
                }
                // Notice period / Current employment
                else if (combinedText.includes('notice period') || combinedText.includes('notice required')) {
                    valueToType = "2 weeks";
                }
                else if (combinedText.includes('currently employed') || combinedText.includes('current employment')) {
                    valueToType = "Yes";
                }
                // Why are you interested / Why this company
                else if ((combinedText.includes('why') && (combinedText.includes('interested') || combinedText.includes('applying'))) ||
                         (combinedText.includes('why') && (combinedText.includes('company') || combinedText.includes('role') || combinedText.includes('position')))) {
                    const whyPrompt = `Based on the job description and my profile, write a concise 2-3 sentence answer explaining why I'm interested in this role/company.

Job Title: ${jobTitle || 'Not specified'}
Job Description: ${jobDescription || 'Not specified'}
My Profile: ${userData.additionalInfo || 'Not provided'}

Be specific and professional. Focus on alignment between my skills and the role.`;
                    valueToType = await getAIResponse(whyPrompt, userData) || "I am excited about this opportunity because it aligns with my skills and career goals.";
                }
                // Cover letter (if not handled earlier)
                else if (combinedText.includes('cover letter') && (elType === 'textarea' || el.isContentEditable)) {
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
                    valueToType = await getAIResponse(coverLetterPrompt, userData);
                }
                // LinkedIn profile
                else if (combinedText.includes('github')) {
                    valueToType = userData.portfolioUrl; // Assuming portfolio might include GitHub
                }
                // Desired job title
                else if (combinedText.includes('desired') && combinedText.includes('title')) {
                    valueToType = jobTitle || await getAIResponse("Based on my resume, what job title am I best suited for? Provide just the title.", userData);
                }

                if (valueToType) {
                     await simulateTyping(el, valueToType);
                } else {
                    const cleanQuestion = question.replace(/[*:]$/, '').trim();
                    if (cleanQuestion.length > 10 && !isDemographic) {
                        // Determine question category for better prompting
                        let questionCategory = 'general';
                        let maxLength = '2-4 sentences';

                        if (elType === 'textarea' || el.isContentEditable) {
                            maxLength = '3-5 sentences or a short paragraph';
                        } else if (elType === 'input' && el.type === 'text') {
                            maxLength = '1-2 sentences or a brief phrase';
                        }

                        if (cleanQuestion.toLowerCase().includes('tell me about') || cleanQuestion.toLowerCase().includes('describe yourself')) {
                            questionCategory = 'self-introduction';
                        } else if (cleanQuestion.toLowerCase().includes('strength') || cleanQuestion.toLowerCase().includes('weakness')) {
                            questionCategory = 'strengths-weaknesses';
                        } else if (cleanQuestion.toLowerCase().includes('challenge') || cleanQuestion.toLowerCase().includes('difficult')) {
                            questionCategory = 'behavioral-challenge';
                        } else if (cleanQuestion.toLowerCase().includes('achieve') || cleanQuestion.toLowerCase().includes('accomplishment')) {
                            questionCategory = 'achievement';
                        } else if (cleanQuestion.toLowerCase().includes('team') || cleanQuestion.toLowerCase().includes('collaboration')) {
                            questionCategory = 'teamwork';
                        }

                        const prompt = `You are a helpful career assistant. Answer the following job application question concisely, based on my resume and the job description.
                            ---
                            **CONTEXT:**
                            - Job Title: ${jobTitle || 'Not found.'}
                            - Job Description: ${jobDescription || 'Not found.'}
                            - My Profile: ${userData.additionalInfo || 'Not provided.'}
                            - Question Category: ${questionCategory}
                            - Answers Already Used: ${Array.from(usedAnswers).join(", ") || 'None'}
                            ---
                            **TASK:**
                            - Question: "${cleanQuestion}"
                            ---
                            **INSTRUCTIONS:**
                            - Write only the answer itself, with no preamble or explanation.
                            - Keep the answer concise and relevant to the job: ${maxLength}.
                            - If it's a yes/no question, respond with just "Yes" or "No" followed by a brief explanation if needed.
                            - For behavioral questions, use the STAR method (Situation, Task, Action, Result) if appropriate.
                            - Be specific and professional.
                            - Avoid repeating previous answers.
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

