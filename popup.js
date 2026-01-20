// This top-level try...catch block prevents the entire script from failing if an unexpected error occurs during setup.
try {
    document.addEventListener('DOMContentLoaded', async function () {
        // Initialize core UI elements first (Button Listeners) to ensure basic functionality
        const statusEl = document.getElementById('status');
        const resumeFileNameEl = document.getElementById('resumeFileName');
        const resumeFileInput = document.getElementById('resumeFile');
        const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'additionalInfo', 'coverLetter', 'gender', 'hispanic', 'race', 'veteran', 'disability', 'citizenship', 'sponsorship'];

        // --- Event Listeners Setup (Critical) ---

        // Save data when the save button is clicked
        const saveBtn = document.getElementById('save');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                try {
                    // Show saving status immediately
                    if (statusEl) {
                        statusEl.textContent = 'Saving...';
                        statusEl.style.color = '#6b7280';
                    }

                    let dataToSave = {};
                    textFields.forEach(field => {
                        const el = document.getElementById(field);
                        if (el) dataToSave[field] = el.value;
                    });

                    const newResumeFile = resumeFileInput?.files[0];

                    const saveDataToStorage = (data) => {
                        chrome.storage.local.set(data, function () {
                            if (chrome.runtime.lastError) {
                                if (statusEl) {
                                    statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                                    statusEl.style.color = '#ef4444';
                                }
                                console.error("Save error:", chrome.runtime.lastError);
                            } else {
                                if (statusEl) {
                                    if (data.resume) {
                                        statusEl.textContent = 'Information & Resume saved!';
                                    } else {
                                        statusEl.textContent = 'Information saved!';
                                    }
                                    statusEl.style.color = '#16a34a';
                                }
                                if (data.resumeFileName && resumeFileNameEl) {
                                    resumeFileNameEl.textContent = `Saved file: ${data.resumeFileName}`;
                                    resumeFileNameEl.style.color = '';
                                }
                                // Increment usage count on save
                                RatingManager.incrementUsageCount();
                            }
                            setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2500);
                        });
                    };

                    if (newResumeFile) {
                        if (newResumeFile.size === 0) {
                            statusEl.textContent = 'Error: Selected file is empty (0 bytes).';
                            statusEl.style.color = '#ef4444';
                            saveDataToStorage(dataToSave);
                            return;
                        }

                        const reader = new FileReader();
                        reader.onload = function (e) {
                            dataToSave.resume = e.target.result; // The Base64 string
                            dataToSave.resumeFileName = newResumeFile.name;
                            saveDataToStorage(dataToSave);
                        };
                        reader.onerror = function (event) {
                            console.error("File reading error details:", reader.error);
                            if (reader.error) {
                                console.error("Error Name:", reader.error.name);
                                console.error("Error Message:", reader.error.message);
                            }

                            // Still save the text data even if file fails
                            saveDataToStorage(dataToSave);

                            let errorMsg = 'Saved text info, but failed to read resume file: ';
                            if (reader.error && reader.error.name === 'NotReadableError') {
                                errorMsg += 'Access denied. Please re-select the file.';
                                // Clear input so user can re-select the same file to refresh permissions
                                if (resumeFileInput) resumeFileInput.value = '';
                            } else {
                                errorMsg += (reader.error ? reader.error.name : 'Unknown error');
                            }

                            // Override the success message from saveDataToStorage
                            setTimeout(() => {
                                statusEl.textContent = errorMsg;
                                statusEl.style.color = '#ef4444'; // Red for error/warning
                            }, 100); // Small delay to ensure it overrides the "Saved!" message
                        };
                        reader.readAsDataURL(newResumeFile);
                    } else {
                        // Preserve existing resume if no new file is chosen
                        chrome.storage.local.get(['resume', 'resumeFileName'], (result) => {
                            if (result.resume) dataToSave.resume = result.resume;
                            if (result.resumeFileName) dataToSave.resumeFileName = result.resumeFileName;
                            saveDataToStorage(dataToSave);
                        });
                    }
                } catch (error) {
                    if (statusEl) {
                        statusEl.textContent = 'A critical error occurred during save.';
                        statusEl.style.color = '#ef4444';
                    }
                    console.error("Critical error in save handler:", error);
                }
            });
        } else {
            console.error('Save button not found!');
        }

        // Autofill button logic
        const autofillBtn = document.getElementById('autofill');
        if (autofillBtn) {
            autofillBtn.addEventListener('click', async function () {
                try {
                    // App is free for everyone - no restrictions
                    statusEl.textContent = 'Loading your data...';
                    RatingManager.incrementUsageCount();

                    // FIRST: Load user data from storage (in popup context where it's reliable)
                    const fields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'resume', 'resumeFileName', 'additionalInfo', 'coverLetter', 'gender', 'hispanic', 'race', 'veteran', 'disability', 'citizenship', 'sponsorship'];

                    chrome.storage.local.get(fields, function (userData) {
                        if (chrome.runtime.lastError) {
                            statusEl.textContent = 'Error: Could not load your saved data.';
                            console.error("Hired Always: Error loading user data:", chrome.runtime.lastError);
                            setTimeout(() => statusEl.textContent = '', 3000);
                            return;
                        }

                        // Check if user has saved any data
                        if (!Object.keys(userData).length || !userData.firstName) {
                            statusEl.textContent = 'Please save your information first!';
                            setTimeout(() => statusEl.textContent = '', 3000);
                            return;
                        }

                        console.log('✓ User data loaded successfully');
                        statusEl.textContent = 'Autofilling...';

                        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                            if (tabs.length === 0 || !tabs[0].id) {
                                statusEl.textContent = 'Could not find active tab.';
                                return;
                            }

                            // First, check if the page contains an iframe-based application form
                            // BUT ONLY if we're not already on a known ATS domain
                            const currentUrl = tabs[0].url || '';
                            const isAlreadyOnATS = currentUrl.includes('greenhouse.io') ||
                                currentUrl.includes('lever.co') ||
                                currentUrl.includes('myworkdayjobs.com') ||
                                currentUrl.includes('ashbyhq.com') ||
                                currentUrl.includes('bamboohr.com') ||
                                currentUrl.includes('workable.com') ||
                                currentUrl.includes('jobvite.com') ||
                                currentUrl.includes('smartrecruiters.com');

                            if (!isAlreadyOnATS) {
                                chrome.scripting.executeScript({
                                    target: { tabId: tabs[0].id },
                                    function: detectIframeForm,
                                }).then((results) => {
                                    const iframeDetected = results && results[0] && results[0].result;

                                    if (iframeDetected && iframeDetected.hasIframe) {
                                        // Display helpful message about iframe form
                                        statusEl.innerHTML = `<div style="color: #8B5CF6; font-size: 11px;">
                                            <strong>Iframe-based form detected!</strong><br>
                                            This form is embedded from ${iframeDetected.domain}.<br><br>
                                            <span style="color: #666;">Opening the application form directly...</span>
                                        </div>`;

                                        // Open the iframe URL in a new tab
                                        chrome.tabs.create({ url: iframeDetected.url }, (newTab) => {
                                            setTimeout(() => {
                                                statusEl.textContent = 'Form opened in new tab. Click Autofill again on the new tab.';
                                                setTimeout(() => statusEl.textContent = '', 5000);
                                            }, 1000);
                                        });
                                        return;
                                    }

                                    // No iframe detected, proceed with normal autofill
                                    // First save userData to storage so the injected script can access it
                                    chrome.storage.local.set({
                                        _autofillData: userData,
                                        _autofillTimestamp: Date.now()
                                    }, () => {
                                        if (chrome.runtime.lastError) {
                                            statusEl.textContent = 'Error: Could not prepare autofill data.';
                                            console.error('Storage error:', chrome.runtime.lastError);
                                            return;
                                        }

                                        // Now inject the autofill function
                                        chrome.scripting.executeScript({
                                            target: { tabId: tabs[0].id, allFrames: true },
                                            function: autofillPage
                                        }).then(() => {
                                            console.log('✓ Autofill script executed successfully');
                                            statusEl.textContent = 'Autofill complete! Saving to tracker...';

                                            // Clean up temporary storage
                                            chrome.storage.local.remove(['_autofillData', '_autofillTimestamp']);

                                            // Save application to tracker AFTER autofilling completes
                                            setTimeout(() => {
                                                console.log('⏰ Starting tracker save (after 3s delay)...');
                                                saveCurrentApplicationToTracker(tabs[0], statusEl);
                                            }, 3000);
                                        }).catch(err => {
                                            statusEl.textContent = 'Autofill failed on this page.';
                                            console.error('❌ Autofill script injection failed:', err);
                                            chrome.storage.local.remove(['_autofillData', '_autofillTimestamp']);
                                            setTimeout(() => statusEl.textContent = '', 3000);
                                        });
                                    });
                                }).catch(err => {
                                    console.error('Iframe detection failed:', err);
                                    statusEl.textContent = 'Could not analyze page structure.';
                                    setTimeout(() => statusEl.textContent = '', 3000);
                                });
                            } else {
                                // Already on ATS domain, skip iframe detection and proceed with autofill
                                console.log('Already on ATS domain, proceeding with direct autofill');

                                // First save userData to storage so the injected script can access it
                                chrome.storage.local.set({
                                    _autofillData: userData,
                                    _autofillTimestamp: Date.now()
                                }, () => {
                                    if (chrome.runtime.lastError) {
                                        statusEl.textContent = 'Error: Could not prepare autofill data.';
                                        console.error('Storage error:', chrome.runtime.lastError);
                                        return;
                                    }

                                    // Now inject the autofill function
                                    chrome.scripting.executeScript({
                                        target: { tabId: tabs[0].id, allFrames: true },
                                        function: autofillPage
                                    }).then(() => {
                                        console.log('✓ Autofill script executed successfully');
                                        statusEl.textContent = 'Autofill complete! Saving to tracker...';

                                        // Clean up temporary storage
                                        chrome.storage.local.remove(['_autofillData', '_autofillTimestamp']);

                                        // Save application to tracker AFTER autofilling completes
                                        setTimeout(() => {
                                            console.log('⏰ Starting tracker save (after 3s delay)...');
                                            saveCurrentApplicationToTracker(tabs[0], statusEl);
                                        }, 3000);
                                    }).catch(err => {
                                        statusEl.textContent = 'Autofill failed on this page.';
                                        console.error('❌ Autofill script injection failed:', err);
                                        chrome.storage.local.remove(['_autofillData', '_autofillTimestamp']);
                                        setTimeout(() => statusEl.textContent = '', 3000);
                                    });
                                });
                            }
                        });
                    });
                } catch (e) {
                    console.error("Autofill button error:", e);
                }
            });
        }

        // View Tracker button
        const viewTrackerBtn = document.getElementById('viewTracker');
        if (viewTrackerBtn) {
            viewTrackerBtn.addEventListener('click', function () {
                chrome.tabs.create({ url: chrome.runtime.getURL('tracker.html') });
            });
        }

        // Parse Resume button
        const parseResumeBtn = document.getElementById('parseResume');
        const parseStatusEl = document.getElementById('parseStatus');
        if (parseResumeBtn) {
            parseResumeBtn.addEventListener('click', async function () {
                try {
                    parseStatusEl.textContent = 'Parsing resume...';
                    parseStatusEl.style.color = '#8b5cf6';

                    let resumeContent = null;
                    const newFile = resumeFileInput?.files[0];

                    if (newFile) {
                        resumeContent = await readFileAsText(newFile);
                    } else {
                        const stored = await new Promise(resolve => {
                            chrome.storage.local.get(['resume', 'resumeFileName'], resolve);
                        });

                        if (stored.resume) {
                            if (stored.resume.startsWith('data:')) {
                                const base64 = stored.resume.split(',')[1];
                                if (stored.resumeFileName?.endsWith('.txt')) {
                                    resumeContent = atob(base64);
                                } else {
                                    parseStatusEl.textContent = 'Note: PDF/DOCX parsing is limited. For best results, upload a .txt version of your resume.';
                                    parseStatusEl.style.color = '#f59e0b';
                                    resumeContent = extractTextFromBase64(base64);
                                }
                            }
                        }
                    }

                    if (!resumeContent) {
                        parseStatusEl.textContent = 'Please upload a resume file first.';
                        parseStatusEl.style.color = '#ef4444';
                        return;
                    }

                    const extracted = parseResumeContent(resumeContent);
                    let fieldsPopulated = 0;

                    const populateField = (id, value) => {
                        const el = document.getElementById(id);
                        if (el && !el.value && value) {
                            el.value = value;
                            return 1;
                        }
                        return 0;
                    };

                    fieldsPopulated += populateField('firstName', extracted.firstName);
                    fieldsPopulated += populateField('lastName', extracted.lastName);
                    fieldsPopulated += populateField('email', extracted.email);
                    fieldsPopulated += populateField('phone', extracted.phone);
                    fieldsPopulated += populateField('address', extracted.address);
                    fieldsPopulated += populateField('city', extracted.city);
                    fieldsPopulated += populateField('state', extracted.state);
                    fieldsPopulated += populateField('zipCode', extracted.zipCode);
                    fieldsPopulated += populateField('linkedinUrl', extracted.linkedinUrl);
                    fieldsPopulated += populateField('portfolioUrl', extracted.portfolioUrl);
                    fieldsPopulated += populateField('additionalInfo', extracted.skills);

                    if (fieldsPopulated > 0) {
                        parseStatusEl.textContent = `Extracted ${fieldsPopulated} field(s) from resume. Click Save to keep changes.`;
                        parseStatusEl.style.color = '#10b981';
                    } else {
                        parseStatusEl.textContent = 'Could not extract new information. Fields may already be filled.';
                        parseStatusEl.style.color = '#f59e0b';
                    }

                } catch (error) {
                    console.error('Error parsing resume:', error);
                    parseStatusEl.textContent = 'Error parsing resume: ' + error.message;
                    parseStatusEl.style.color = '#ef4444';
                }
            });
        }

        if (resumeFileInput) {
            resumeFileInput.addEventListener('change', function () {
                if (this.files && this.files[0]) {
                    if (resumeFileNameEl) {
                        resumeFileNameEl.textContent = `Selected: ${this.files[0].name} (click Save)`;
                        resumeFileNameEl.style.color = '#D97706';
                    }
                }
            });
        }

        // Load saved data when the popup opens
        chrome.storage.local.get([...textFields, 'resumeFileName', 'resume'], function (result) {
            if (chrome.runtime.lastError) { return console.error("Error loading data:", chrome.runtime.lastError.message); }
            textFields.forEach(field => {
                const el = document.getElementById(field);
                if (el && result[field]) el.value = result[field];
            });
            if (result.resumeFileName && resumeFileNameEl) resumeFileNameEl.textContent = `Saved file: ${result.resumeFileName}`;
        });

        // --- Non-Blocking Background Tasks ---
        // Wrap these in independent try-catch blocks so they don't block the UI

        try {
            // Show free app badge
            const appStatus = await AppManager.getStatus();
            const licenseInfoEl = document.getElementById('licenseInfo');
            if (licenseInfoEl) {
                licenseInfoEl.style.display = 'block';
            }
        } catch (e) {
            console.error("AppManager init error:", e);
        }

        try {
            // Initialize rating system
            await RatingManager.init();
        } catch (e) {
            console.error("RatingManager init error:", e);
        }

    });
} catch (e) {
    console.error("A fatal error occurred in popup.js:", e);
}

// Save current job application to tracker
function saveCurrentApplicationToTracker(tab, statusEl) {
    try {
        console.log('🔄 Starting tracker save process...');
        console.log('   Tab ID:', tab.id);
        console.log('   Tab URL:', tab.url);

        // Extract company and job title from page (async function)
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractJobInfo,
        }).then((results) => {
            console.log('📦 Raw results from extractJobInfo:', results);

            // Initialize default job info in case extraction fails
            let jobInfo = {
                position: '',
                company: '',
                location: '',
                salary: '',
                jobType: ''
            };

            if (!results || !results[0]) {
                console.error('❌ No results from extractJobInfo - using defaults');
            } else if (results[0].error) {
                console.error('❌ Script execution error:', results[0].error);
            } else if (!results[0].result) {
                console.error('❌ extractJobInfo returned no data - using defaults');
                console.error('   Full result object:', results[0]);
            } else {
                jobInfo = results[0].result;
                console.log('✅ Successfully extracted job info:', jobInfo);
            }

            chrome.storage.local.get(['jobApplications'], function (result) {
                let applications = result.jobApplications || [];

                // Debug: Log what was extracted
                console.log('📊 Tracker received job info:', jobInfo);
                console.log('  • URL:', tab.url);

                // Check if this job was already added (by URL)
                const existingApp = applications.find(app => app.jobUrl === tab.url);

                // Clean up empty strings and whitespace
                if (jobInfo.company) jobInfo.company = jobInfo.company.trim();
                if (jobInfo.position) jobInfo.position = jobInfo.position.trim();

                // If company is missing or empty, try to extract from URL
                if (!jobInfo.company || jobInfo.company === '') {
                    console.log('🔍 Company not found, attempting URL extraction...');
                    const urlMatch = tab.url.match(/(?:greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|bamboohr\.com|gem\.com|jobvite\.com|smartrecruiters\.com)\/([^\/\?]+)/);
                    if (urlMatch && urlMatch[1]) {
                        jobInfo.company = urlMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        console.log('✓ Company extracted from URL:', jobInfo.company);
                    } else {
                        jobInfo.company = 'Unknown Company';
                        console.log('⚠ Using fallback: Unknown Company');
                    }
                }

                // If position is missing or empty, use a fallback
                if (!jobInfo.position || jobInfo.position === '') {
                    console.log('⚠ Position not found, using fallback');
                    jobInfo.position = 'Position Not Detected';
                }

                // At this point, both should have values
                console.log('✓ Final values - Company:', jobInfo.company, '| Position:', jobInfo.position);

                // Build notes with extracted metadata
                let notes = 'Auto-saved from extension';
                if (jobInfo.jobType) {
                    notes += `\nJob Type: ${jobInfo.jobType}`;
                }

                if (existingApp) {
                    // UPDATE existing application with latest data
                    existingApp.company = jobInfo.company || existingApp.company;
                    existingApp.position = jobInfo.position || existingApp.position;
                    existingApp.location = jobInfo.location || existingApp.location;
                    existingApp.salary = jobInfo.salary || existingApp.salary;
                    existingApp.updatedAt = new Date().toISOString();

                    // Update notes if new info is available
                    if (jobInfo.jobType && !existingApp.notes.includes('Job Type:')) {
                        existingApp.notes += `\nJob Type: ${jobInfo.jobType}`;
                    }

                    // Add timeline entry if status changed or it's been updated
                    const lastTimeline = existingApp.timeline[existingApp.timeline.length - 1];
                    if (!lastTimeline || lastTimeline.note !== 'Application data updated') {
                        existingApp.timeline.push({
                            status: existingApp.status || 'Applied',
                            date: new Date().toISOString().split('T')[0],
                            note: 'Application data updated'
                        });
                    }

                    chrome.storage.local.set({ jobApplications: applications }, function () {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Error saving to tracker:', chrome.runtime.lastError);
                            if (statusEl) {
                                statusEl.textContent = '⚠ Tracker save failed';
                                setTimeout(() => statusEl.textContent = '', 4000);
                            }
                        } else {
                            console.log('✅ Job application UPDATED in tracker:', existingApp.company, '-', existingApp.position);
                            if (statusEl) {
                                statusEl.textContent = '✓ Autofill complete & tracked! (updated)';
                                setTimeout(() => statusEl.textContent = '', 3000);
                            }
                        }
                    });
                } else {
                    // CREATE new application
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
                            note: 'Application submitted via Hired Always'
                        }]
                    };

                    applications.push(newApp);
                    chrome.storage.local.set({ jobApplications: applications }, function () {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Error saving to tracker:', chrome.runtime.lastError);
                            if (statusEl) {
                                statusEl.textContent = '⚠ Tracker save failed';
                                setTimeout(() => statusEl.textContent = '', 4000);
                            }
                        } else {
                            console.log('✅ Job application CREATED in tracker:', newApp.company, '-', newApp.position);
                            if (statusEl) {
                                statusEl.textContent = '✓ Autofill complete & tracked!';
                                setTimeout(() => statusEl.textContent = '', 3000);
                            }
                        }
                    });
                }
            });
        }).catch(err => {
            console.error('❌ Error executing extractJobInfo script:', err);
            console.log('⚠️ Proceeding with tracker save using URL-based fallbacks...');

            // Even if extraction fails completely, still save the application with fallback values
            chrome.storage.local.get(['jobApplications'], function (result) {
                let applications = result.jobApplications || [];

                // Use URL-based extraction as fallback
                let company = 'Unknown Company';
                const urlMatch = tab.url.match(/(?:greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|bamboohr\.com|gem\.com|jobvite\.com|smartrecruiters\.com)\/([^\/\?]+)/);
                if (urlMatch && urlMatch[1]) {
                    company = urlMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    console.log('✓ Company extracted from URL:', company);
                }

                const existingApp = applications.find(app => app.jobUrl === tab.url);

                if (existingApp) {
                    existingApp.updatedAt = new Date().toISOString();
                    console.log('✅ Job application UPDATED in tracker (fallback)');
                    if (statusEl) {
                        statusEl.textContent = '✓ Autofill complete & tracked! (updated)';
                        setTimeout(() => statusEl.textContent = '', 3000);
                    }
                } else {
                    const newApp = {
                        id: 'app_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        company: company,
                        position: 'Position Not Detected',
                        location: '',
                        salary: '',
                        applicationDate: new Date().toISOString().split('T')[0],
                        status: 'Applied',
                        jobUrl: tab.url,
                        contactName: '',
                        contactEmail: '',
                        notes: 'Auto-saved from extension (extraction failed)',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        timeline: [{
                            status: 'Applied',
                            date: new Date().toISOString().split('T')[0],
                            note: 'Application submitted via Hired Always'
                        }]
                    };

                    applications.push(newApp);
                    console.log('✅ Job application CREATED in tracker (fallback):', newApp.company);
                    if (statusEl) {
                        statusEl.textContent = '✓ Autofill complete & tracked!';
                        setTimeout(() => statusEl.textContent = '', 3000);
                    }
                }

                chrome.storage.local.set({ jobApplications: applications });
            });
        });
    } catch (e) {
        console.error('❌ Error in saveCurrentApplicationToTracker:', e);
        if (statusEl) {
            statusEl.textContent = '⚠ Tracker save error';
            setTimeout(() => statusEl.textContent = '', 4000);
        }
    }
}

// Detect iframe-based application forms
function detectIframeForm() {
    // URLs/domains to ignore (helper iframes, not application forms)
    const ignorePatterns = [
        'googleapis.com',
        'google.com/recaptcha',
        'accounts.google.com',
        'googletagmanager.com',
        'doubleclick.net',
        'facebook.com/plugins',
        'connect.facebook.net',
        'platform.twitter.com',
        'linkedin.com/embed',
        'analytics',
        'ads',
        'tracking',
        'cdn.',
        'static.'
    ];

    // Common ATS iframe patterns
    const atsIframePatterns = [
        { domain: 'greenhouse', selector: 'iframe[id*="grnhse"], iframe[src*="greenhouse.io/embed/job_app"]' },
        { domain: 'lever', selector: 'iframe[src*="jobs.lever.co"]' },
        { domain: 'workday', selector: 'iframe[src*="myworkdayjobs.com"]' },
        { domain: 'ashby', selector: 'iframe[src*="jobs.ashbyhq.com"]' },
        { domain: 'bamboohr', selector: 'iframe[src*="bamboohr.com/jobs"]' },
        { domain: 'workable', selector: 'iframe[src*="apply.workable.com"]' },
        { domain: 'jobvite', selector: 'iframe[src*="jobs.jobvite.com"]' },
        { domain: 'smartrecruiters', selector: 'iframe[src*="jobs.smartrecruiters.com"]' }
    ];

    for (const pattern of atsIframePatterns) {
        const iframe = document.querySelector(pattern.selector);
        if (iframe && iframe.src) {
            // Check if this iframe should be ignored
            const shouldIgnore = ignorePatterns.some(ignorePattern =>
                iframe.src.toLowerCase().includes(ignorePattern.toLowerCase())
            );

            if (shouldIgnore) {
                console.log(`Ignoring helper iframe:`, iframe.src);
                continue;
            }

            // Additional check: iframe must be reasonably sized (not a tiny tracking pixel)
            if (iframe.offsetWidth > 200 && iframe.offsetHeight > 200) {
                console.log(`Detected ${pattern.domain} iframe:`, iframe.src);
                return {
                    hasIframe: true,
                    url: iframe.src,
                    domain: pattern.domain
                };
            } else {
                console.log(`Ignoring small iframe (${iframe.offsetWidth}x${iframe.offsetHeight}):`, iframe.src);
            }
        }
    }

    return { hasIframe: false };
}

// Extract job information from page - returns a promise for async AI extraction
async function extractJobInfo() {
    console.log('🔍 extractJobInfo: Starting job info extraction...');
    console.log('   Current URL:', window.location.href);

    // Extract job title with enhanced selectors
    let jobTitle = document.querySelector('h1')?.innerText ||
        document.querySelector('h2')?.innerText ||
        document.querySelector('[class*="job-title"]')?.innerText ||
        document.querySelector('[class*="jobTitle"]')?.innerText ||
        document.querySelector('[data-testid*="job-title"]')?.innerText ||
        document.querySelector('[class*="position"]')?.innerText ||
        document.querySelector('[class*="JobTitle"]')?.innerText ||
        document.querySelector('[id*="job-title"]')?.innerText || '';

    // Fallback: try to extract from page title
    if (!jobTitle || jobTitle.length < 3) {
        const pageTitle = document.title;
        // Common patterns: "Job Title - Company" or "Job Title at Company" or "Company - Job Title"
        const titleMatch = pageTitle.match(/^([^-|]+?)(?:\s*[-|@]\s*|$)/);
        if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 3) {
            jobTitle = titleMatch[1].trim();
        }
    }

    // Helper function to validate company names
    function isValidCompany(companyName) {
        if (!companyName) return false;
        const trimmed = companyName.trim();
        return trimmed.length > 2 &&
            trimmed.length < 100 &&
            !trimmed.toLowerCase().includes('apply') &&
            !trimmed.toLowerCase().includes('application');
    }

    // Extract company name with enhanced selectors
    let company = '';

    // First try to extract from filled form fields (since autofill just ran)
    const companyInputSelectors = [
        'input[name*="company"]',
        'input[id*="company"]',
        'input[aria-label*="company" i]',
        'input[placeholder*="company" i]',
        '[contenteditable="true"][class*="company"]'
    ];

    for (const selector of companyInputSelectors) {
        try {
            const input = document.querySelector(selector);
            if (input) {
                const value = input.value || input.textContent || input.innerText;
                if (value && value.trim()) {
                    const trimmed = value.trim();
                    if (isValidCompany(trimmed)) {
                        company = trimmed;
                        console.log('Company extracted from form field:', company);
                        break;
                    }
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }

    // Try Greenhouse-specific selectors if no company found yet
    if (!company) {
        const greenhouseCompany = document.querySelector('.company-name')?.innerText ||
            document.querySelector('[class*="app-title"]')?.innerText ||
            document.querySelector('div[class*="application--header"] h2')?.innerText;

        if (greenhouseCompany) {
            const cleaned = greenhouseCompany.trim().replace(/\s*\(.*?\)\s*/g, '').trim();
            if (isValidCompany(cleaned)) {
                company = cleaned;
            }
        }
    }

    // Try standard selectors if still no company found
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
            if (el && el.innerText) {
                const cleaned = el.innerText.trim().replace(/\s*\(.*?\)\s*/g, '').trim();
                if (isValidCompany(cleaned) && cleaned !== jobTitle.trim()) {
                    company = cleaned;
                    break;
                }
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
            const urlPatterns = [
                // Greenhouse pattern: boards.greenhouse.io/COMPANY
                { regex: /greenhouse\.io\/([^\/\?]+)/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // Lever pattern: jobs.lever.co/COMPANY
                { regex: /lever\.co\/([^\/\?]+)/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // Workday pattern: company.wd1.myworkdayjobs.com or company.wd5.myworkdayjobs.com
                { regex: /([^\/]+)\.wd\d+\.myworkdayjobs\.com/, transform: (match) => match[1].split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // Ashby pattern: jobs.ashbyhq.com/COMPANY
                { regex: /ashbyhq\.com\/([^\/\?]+)/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // BambooHR pattern: company.bamboohr.com
                { regex: /([^\/]+)\.bamboohr\.com/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // Gem pattern: gem.com/careers/COMPANY
                { regex: /gem\.com\/careers\/([^\/\?]+)/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // Jobvite pattern: jobs.jobvite.com/COMPANY
                { regex: /jobvite\.com\/([^\/\?]+)/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },

                // SmartRecruiters pattern: jobs.smartrecruiters.com/COMPANY
                { regex: /smartrecruiters\.com\/([^\/\?]+)/, transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }
            ];

            // Try each pattern
            for (const pattern of urlPatterns) {
                const match = url.match(pattern.regex);
                if (match && match[1]) {
                    company = pattern.transform(match);
                    break;
                }
            }

            // Generic careers page: company.com/careers or jobs.company.com
            if (!company) {
                const domain = new URL(url).hostname;
                if (domain.includes('jobs.') || domain.includes('careers.') || domain.includes('recruiting.')) {
                    const domainParts = domain.split('.');
                    const companyPart = domainParts.find(part =>
                        part !== 'jobs' && part !== 'careers' && part !== 'recruiting' &&
                        part !== 'www' && part !== 'com' && part !== 'io' &&
                        part !== 'net' && part !== 'org' && part !== 'co'
                    );
                    if (companyPart && companyPart.length > 2) {
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

    // Note: AI-based company extraction removed because chrome.storage is not available
    // when this function is injected into page context via chrome.scripting.executeScript

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

    const extractedData = {
        position: jobTitle.trim(),
        company: company,
        location: location,
        salary: salary,
        jobType: jobType
    };

    // Log what was extracted for debugging
    console.log('📊 Job Info Extracted:', extractedData);
    console.log('  • Company:', company || '❌ NOT FOUND');
    console.log('  • Position:', jobTitle.trim() || '❌ NOT FOUND');
    console.log('  • Location:', location || '(empty)');
    console.log('  • Salary:', salary || '(empty)');
    console.log('  • Job Type:', jobType || '(empty)');

    return extractedData;
}


// This function is injected into the page to perform the autofill
async function autofillPage() {
    console.log("Hired Always: Starting autofill process...");

    // Load userData from temporary storage (set by popup before injection)
    const userData = await new Promise(resolve => {
        try {
            chrome.storage.local.get(['_autofillData'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error("Hired Always: Error loading autofill data:", chrome.runtime.lastError);
                    resolve(null);
                } else if (result._autofillData) {
                    console.log("Hired Always: ✓ User data loaded from storage");
                    resolve(result._autofillData);
                } else {
                    console.error("Hired Always: No autofill data found in storage");
                    resolve(null);
                }
            });
        } catch (error) {
            console.error("Hired Always: Exception loading data:", error);
            resolve(null);
        }
    });

    // Validate that userData was loaded correctly
    if (!userData || !Object.keys(userData).length) {
        console.error("Hired Always: Could not load user data!");
        alert("Autofill failed: Could not load your saved data. Please try again.");
        return;
    }

    console.log("Hired Always: User data loaded successfully!", {
        hasName: !!(userData.firstName),
        hasEmail: !!(userData.email),
        hasPhone: !!(userData.phone),
        hasResume: !!(userData.resume)
    });

    // --- HELPER FUNCTIONS ---
    async function simulateClick(element) {
        if (!element) return;
        
        // Scroll into view first
        try {
            element.scrollIntoView({ behavior: 'instant', block: 'center' });
        } catch (e) { /* ignore */ }
        
        const eventOptions = { bubbles: true, cancelable: true, view: window };
        
        // Dispatch full sequence of mouse events
        element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
        element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
        element.dispatchEvent(new MouseEvent('click', eventOptions));
        
        // If it's an input/select/textarea, also focus it
        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(element.tagName)) {
            element.focus();
            element.dispatchEvent(new Event('focus', { bubbles: true }));
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Helper to set value that triggers React/Angular/Vue listeners
    function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
        
        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else if (valueSetter) {
            valueSetter.call(element, value);
        } else {
            element.value = value;
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Robust label text finder
    function getLabelTextForElement(element) {
        let labelText = '';
        
        // 1. Check for label with 'for' attribute
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) labelText = label.innerText;
        }
        
        // 2. Check for parent label
        if (!labelText) {
            const parentLabel = element.closest('label');
            if (parentLabel) {
                // Clone and remove the input itself to get just the text
                const clone = parentLabel.cloneNode(true);
                const inputInClone = clone.querySelector('input, select, textarea');
                if (inputInClone) inputInClone.remove();
                labelText = clone.innerText;
            }
        }
        
        // 3. Check aria-label
        if (!labelText && element.getAttribute('aria-label')) {
            labelText = element.getAttribute('aria-label');
        }
        
        // 4. Check aria-labelledby
        if (!labelText && element.getAttribute('aria-labelledby')) {
            const labelId = element.getAttribute('aria-labelledby');
            const labelEl = document.getElementById(labelId);
            if (labelEl) labelText = labelEl.innerText;
        }

        return labelText.trim();
    }

    async function selectReactSelectOption(inputElement, optionText) {
        try {
            console.log(`🔍 Attempting to select dropdown option: "${optionText}"`);
            console.log(`   Element:`, inputElement);

            // Check if already has correct value - skip if so
            const currentValue = inputElement.value || inputElement.innerText || inputElement.textContent || '';
            const currentValueLower = currentValue.toLowerCase().trim();
            const targetValueLower = optionText.toLowerCase().trim();

            if (currentValueLower === targetValueLower ||
                currentValueLower.includes(targetValueLower) ||
                targetValueLower.includes(currentValueLower)) {
                console.log(`⏭️ Dropdown already has correct value: "${currentValue}", skipping`);
                return true;
            }

            // Also check if a meaningful value is already selected (not placeholder)
            if (currentValue.length > 0 &&
                !currentValueLower.includes('select') &&
                !currentValueLower.includes('choose') &&
                !currentValueLower.includes('please') &&
                currentValueLower !== '--' &&
                currentValueLower !== '-') {
                console.log(`⏭️ Dropdown already has a value: "${currentValue}", not overwriting`);
                return true;
            }

            // Click to open dropdown
            inputElement.focus();
            await simulateClick(inputElement);
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400)); // Random delay 300-700ms

            // Type to filter (helps with virtualization and huge lists)
            // Only type if it's an input and editable
            if (inputElement.tagName === 'INPUT' && !inputElement.readOnly && !inputElement.disabled) {
                // Clear existing text if it's just a search/filter input
                setNativeValue(inputElement, '');
                
                // Type the option text
                const chars = optionText; 
                setNativeValue(inputElement, chars);
                // Dispatch input event specifically for filtering
                inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: chars }));
                await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400)); // Random wait for filtering
            }

            // Find the listbox or menu - try multiple strategies
            const ariaControls = inputElement.getAttribute('aria-controls') || inputElement.getAttribute('aria-owns');
            let listbox = null;

            // Strategy 1: Use aria-controls/owns
            if (ariaControls) {
                listbox = document.getElementById(ariaControls);
                if (listbox) console.log(`   ✓ Found listbox via aria-controls: #${ariaControls}`);
            }

            // Strategy 2: Look for visible listbox/menu (global search)
            if (!listbox) {
                // Select all potential listboxes
                const potentialListboxes = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], .css-26l3qy-menu, .css-1nmdiq5-menu')); // Common react-select classes
                
                // Filter for visible ones
                const visibleListboxes = potentialListboxes.filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                });

                // Sort by z-index (highest usually on top) or proximity
                visibleListboxes.sort((a, b) => {
                    const zA = parseInt(window.getComputedStyle(a).zIndex) || 0;
                    const zB = parseInt(window.getComputedStyle(b).zIndex) || 0;
                    return zB - zA;
                });

                if (visibleListboxes.length > 0) {
                    listbox = visibleListboxes[0];
                    console.log(`   ✓ Found visible listbox (z-index strategy)`);
                }
            }

            // Strategy 3: Look for any visible dropdown container
            if (!listbox) {
                const visibleDropdowns = Array.from(document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="options"], [class*="list"], [id*="react-select"]'))
                    .filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null && 
                               el !== inputElement && !inputElement.contains(el);
                    });
                if (visibleDropdowns.length > 0) {
                    // Pick the one that appeared most recently or is closest to input
                    listbox = visibleDropdowns[visibleDropdowns.length - 1]; // Often appended last
                    console.log(`   ✓ Found dropdown container via class name`);
                }
            }

            if (listbox) {
                console.log(`   Searching for options in listbox...`);
                // Wait for options to populate if listbox is empty (async loading)
                let retries = 0;
                let options = [];
                while (retries < 5) { // Increased retries
                    // Broadened selector for options
                    options = Array.from(listbox.querySelectorAll('[role="option"], [role="menuitem"], li, div[class*="option"], [id*="option"], div[id*="react-select"]'));
                    
                    // If no options found with specific roles, try generic divs with text content if listbox is small
                    if (options.length === 0 && listbox.children.length < 50) {
                         options = Array.from(listbox.querySelectorAll('div, span, p')).filter(el => el.innerText.trim().length > 0);
                    }

                    if (options.length > 0) break;
                    await new Promise(r => setTimeout(r, 400));
                    retries++;
                }
                
                console.log(`   Found ${options.length} potential options`);

                if (options.length > 0) {
                    // Log all available options for debugging (limit to first 10)
                    console.log(`   Available options (first 10):`, options.slice(0, 10).map(opt => opt.innerText.trim()).join(', '));
                }

                // Try exact match first
                let targetOption = options.find(opt =>
                    opt.innerText.trim().toLowerCase() === optionText.toLowerCase()
                );

                // Try partial match
                if (!targetOption) {
                    targetOption = options.find(opt =>
                        opt.innerText.toLowerCase().includes(optionText.toLowerCase()) ||
                        optionText.toLowerCase().includes(opt.innerText.toLowerCase())
                    );
                }

                // Try fuzzy match (words in any order)
                if (!targetOption) {
                    const optionWords = optionText.toLowerCase().split(/\s+/);
                    targetOption = options.find(opt => {
                        const optText = opt.innerText.toLowerCase();
                        return optionWords.every(word => optText.includes(word));
                    });
                }

                if (targetOption) {
                    console.log(`   ✓ Found matching option: "${targetOption.innerText.trim()}"`);
                    targetOption.scrollIntoView({ block: 'nearest' });
                    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // Random hover delay
                    
                    // Try to click the option
                    await simulateClick(targetOption);
                    
                    // Sometimes the click needs to be on a child element
                    if (targetOption.firstElementChild) {
                        await simulateClick(targetOption.firstElementChild);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300)); // Random post-click delay

                    // Verify selection was successful
                    const selectedValue = inputElement.value || inputElement.getAttribute('aria-activedescendant') || inputElement.innerText;
                    if (selectedValue && selectedValue !== 'Please select' && selectedValue !== 'Select...') {
                        console.log(`   ✓ Selection successful! Value: "${selectedValue}"`);
                        return true;
                    }
                }
            }
            
            // FALLBACK: Keyboard navigation
            // If we couldn't find the option or clicking didn't work, try keyboard
            console.log("   ⚠️ Trying keyboard navigation fallback...");
            
            inputElement.focus();
            // Press ArrowDown to select first filtered option
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
            await new Promise(r => setTimeout(r, 100));
            
            // Press Enter to confirm
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            inputElement.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
            
            // Blur to commit
            inputElement.blur();
            
            await new Promise(resolve => setTimeout(resolve, 200));
            return true; // Assume success after fallback

        } catch (error) {
            console.error("❌ Error selecting React Select option:", error);
            return false;
        }
    }

    async function selectDropdownOption(selectElement, optionText) {
        try {
            console.log(`🔽 Selecting dropdown option: "${optionText}"`);

            // For regular <select> elements
            if (selectElement.tagName.toLowerCase() === 'select') {
                const options = Array.from(selectElement.options);

                // Check if already has correct value - skip if so
                const currentOption = selectElement.options[selectElement.selectedIndex];
                if (currentOption) {
                    const currentText = currentOption.text.toLowerCase().trim();
                    const currentValue = currentOption.value.toLowerCase().trim();
                    const targetLower = optionText.toLowerCase().trim();

                    if (currentText === targetLower ||
                        currentValue === targetLower ||
                        currentText.includes(targetLower) ||
                        targetLower.includes(currentText)) {
                        console.log(`⏭️ Select already has correct value: "${currentOption.text}", skipping`);
                        return true;
                    }

                    // Also skip if a meaningful value is already selected (not placeholder)
                    if (selectElement.selectedIndex > 0 &&
                        currentValue.length > 0 &&
                        !currentText.includes('select') &&
                        !currentText.includes('choose') &&
                        !currentText.includes('please')) {
                        console.log(`⏭️ Select already has a value: "${currentOption.text}", not overwriting`);
                        return true;
                    }
                }

                // Try exact match first
                let matchingOption = options.find(opt => opt.text.trim() === optionText || opt.value === optionText);

                // Try partial match (case-insensitive)
                if (!matchingOption) {
                    const optionLower = optionText.toLowerCase();
                    matchingOption = options.find(opt =>
                        opt.text.toLowerCase().includes(optionLower) ||
                        opt.value.toLowerCase().includes(optionLower)
                    );
                }

                // Try matching keywords
                if (!matchingOption) {
                    const keywords = optionText.toLowerCase().split(/\s+/);
                    matchingOption = options.find(opt => {
                        const optText = opt.text.toLowerCase();
                        return keywords.some(keyword => optText.includes(keyword));
                    });
                }

                if (matchingOption) {
                    // Set by value
                    selectElement.value = matchingOption.value;

                    // Also set by selectedIndex for frameworks that need it
                    const optionIndex = options.indexOf(matchingOption);
                    if (optionIndex >= 0) {
                        selectElement.selectedIndex = optionIndex;
                    }

                    // Fire multiple events for maximum compatibility
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                    selectElement.dispatchEvent(new Event('blur', { bubbles: true }));

                    // For React/Angular - fire native events
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
                    if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(selectElement, matchingOption.value);
                        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    console.log(`   ✓ Selected: "${matchingOption.text}" (index: ${optionIndex})`);
                    return true;
                } else {
                    console.warn(`   ✗ Could not find matching option for: "${optionText}"`);
                    // Log available options for debugging
                    console.log(`   Available options: ${options.map(o => o.text).join(', ')}`);
                    return false;
                }
            }

            return false;
        } catch (error) {
            console.error("❌ Error selecting dropdown option:", error);
            return false;
        }
    }

    async function attachResumeFile(resumeBase64, fileName) {
        try {
            // Find file input - look for resume/CV or any file input that accepts PDF/doc
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(input => {
                const id = input.id.toLowerCase();
                const accept = input.getAttribute('accept') || '';
                const hasResumeInId = id.includes('resume') || id.includes('cv');
                const acceptsPdf = accept.includes('pdf') || accept.includes('.doc');
                return hasResumeInId || acceptsPdf;
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
        if (typeof text !== 'string' || !text.trim()) return false;

        try {
            const isContentEditable = element.isContentEditable;
            const isReactElement = element._reactInternalFiber || element._reactInternalInstance || Object.keys(element).some(key => key.startsWith('__react'));

            // Check if field already has the correct value
            const currentValue = isContentEditable ? (element.textContent || '').trim() : (element.value || '').trim();
            const newValue = text.trim();

            if (currentValue === newValue) {
                console.log('⏭️ Field already has correct value, skipping:', newValue.substring(0, 50));
                return true;
            }

            if (currentValue.length > 0 &&
                currentValue !== 'Select' &&
                currentValue !== 'Choose' &&
                currentValue !== 'Please select' &&
                currentValue !== '-- Select --') {
                console.log('⏭️ Field already has value, not overwriting:', currentValue.substring(0, 50));
                return true;
            }

            // Focus the element
            element.focus();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Clear existing content
            if (isContentEditable) {
                element.textContent = '';
            } else {
                element.value = '';
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(element, '');
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Human-like typing simulation
            const chars = text.split('');
            
            // For longer text, we type faster to avoid timeouts
            const typeDelay = chars.length > 50 ? 2 : 10; 
            
            // Helper to dispatch input events
            const dispatchInput = (char) => {
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: char
                });
                element.dispatchEvent(inputEvent);
            };

            // Type character by character for "human-like" behavior
            if (isContentEditable) {
                element.textContent = text; // ContentEditable is hard to simulate char-by-char safely
                dispatchInput(text);
            } else {
                let currentText = '';
                for (let i = 0; i < chars.length; i++) {
                    const char = chars[i];
                    currentText += char;
                    
                    // Update value
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

                    if (element.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter) {
                        nativeTextAreaValueSetter.call(element, currentText);
                    } else if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(element, currentText);
                    } else {
                        element.value = currentText;
                    }

                    // Dispatch events for this character
                    dispatchInput(char);
                    // element.dispatchEvent(new Event('change', { bubbles: true })); // Some frameworks need change on every keystroke
                    
                    // Random small delay for realism (but fast enough)
                    if (i % 5 === 0) await new Promise(r => setTimeout(r, Math.random() * typeDelay));
                }
            }

            // Final event dispatch sequence
            const events = ['input', 'change', 'keyup', 'keydown'];
            for (const eventType of events) {
                element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
            }

            if (isReactElement) {
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify
            const verifyValue = (isContentEditable ? element.textContent : element.value) || '';
            const verifyTrimmed = verifyValue.trim();
            const textTrimmed = text.trim();

            if (verifyTrimmed.length === 0) {
                console.warn(`Hired Always: Field empty after fill, retrying with direct set.`);
                if (isContentEditable) element.textContent = text;
                else element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }

            element.blur();
            return true;
        } catch (error) {
            console.error("Error in simulateTyping:", error);
            // Last resort fallback
            try {
                element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            } catch (e) {
                return false;
            }
        }
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
        // Priority 1: Explicit labels
        const checks = [
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
            element.id ? document.querySelector(`label[for="${element.id}"]`)?.innerText : null,
            element.getAttribute('aria-labelledby') ? document.getElementById(element.getAttribute('aria-labelledby'))?.innerText : null
        ];
        for (const check of checks) {
            if (check && check.trim() && check.length > 2) return check.trim();
        }

        // Priority 2: Check for sibling elements that might contain the question
        const parent = element.parentElement;
        if (parent) {
            // Look for various text-containing elements
            const siblingSelectors = [
                'span[class*="body"]',
                'div[class*="body"]',
                'span[class*="text"]',
                'div[class*="question"]',
                'label',
                'legend',
                'span[class*="label"]',
                'div[class*="label"]',
                'p',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
            ];

            const siblings = Array.from(parent.querySelectorAll(siblingSelectors.join(', ')));
            for (const sibling of siblings) {
                const text = sibling.innerText?.trim();
                if (text && text.length > 3 && text.length < 500 && sibling !== element && !sibling.contains(element)) {
                    // Skip if it's just a single character or common UI text
                    if (text.length === 1 || text.toLowerCase() === 'required') continue;
                    return text;
                }
            }
        }

        // Priority 3: Walk up the DOM tree
        let current = element.parentElement;
        for (let i = 0; i < 4 && current; i++) {
            try {
                const clone = current.cloneNode(true);
                // Remove the input element and similar siblings from the clone
                const selector = element.name ? `[name="${element.name}"]` : `#${element.id}`;
                Array.from(clone.querySelectorAll('input, textarea, select, button')).forEach(el => el.remove());
                const text = clone.innerText.trim().split('\n')[0].trim();
                if (text && text.length > 3 && text.length < 300) return text;
            } catch (e) { }
            current = current.parentElement;
        }

        // Priority 4: Use element attributes as fallback
        const name = element.name || element.id || '';
        if (name) {
            // Convert camelCase or snake_case to readable text
            return name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        }

        return '';
    }

    async function findOptionsForInput(element) {
        let options = [];
        const parent = element.parentElement;

        // Button group detection
        if (element.tagName.toLowerCase() === 'button' || element.getAttribute('role') === 'button') {
            const buttonGroup = parent.querySelectorAll('button, [role="button"]');
            if (buttonGroup.length > 1) {
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

        // Check if this is a button-based dropdown (common in modern forms)
        const isButtonDropdown = element.tagName.toLowerCase() === 'button' &&
            (element.hasAttribute('aria-haspopup') ||
                element.querySelector('svg') ||
                element.innerText.toLowerCase().includes('select'));

        const isComboBox = element.getAttribute('role') === 'combobox' ||
            element.hasAttribute('aria-controls') ||
            element.getAttribute('aria-haspopup') === 'listbox' ||
            isButtonDropdown;

        if (isComboBox) {
            await simulateClick(element);
            await new Promise(resolve => setTimeout(resolve, 750));

            const ariaControlsId = element.getAttribute('aria-controls');
            let controlledEl = ariaControlsId ? document.getElementById(ariaControlsId) : document.querySelector('[role="listbox"]:not([style*="display: none"])');

            // Also check for menu role (common in Material-UI and similar libraries)
            if (!controlledEl) {
                controlledEl = document.querySelector('[role="menu"]:not([style*="display: none"])');
            }

            if (controlledEl) {
                const optionElements = Array.from(controlledEl.querySelectorAll('[role="option"], [role="menuitem"]'));
                if (optionElements.length > 0) {
                    const opts = optionElements.map(opt => opt.innerText.trim()).filter(t => t.length > 0);
                    await simulateClick(document.body); // Close the dropdown
                    return { options: opts, source: controlledEl };
                }
            }
            await simulateClick(document.body); // Click away to close
        }
        return { options: [] };
    }

    function classifyFieldType(element, question, combinedText) {
        // Returns: { type: string, confidence: number, keywords: string[] }
        const classifications = [];

        // Enhanced text analysis - include all available text sources
        const allText = [
            combinedText,
            element.placeholder || '',
            element.id || '',
            element.name || '',
            element.className || '',
            element.title || '',
            question || ''
        ].join(' ').toLowerCase();

        // Personal Information - Enhanced patterns
        if (allText.match(/\b(first\s*name|firstname|given\s*name|fname)\b/)) {
            classifications.push({ type: 'firstName', confidence: 0.95, keywords: ['first', 'name'] });
        }
        if (allText.match(/\b(last\s*name|lastname|surname|family\s*name|lname)\b/)) {
            classifications.push({ type: 'lastName', confidence: 0.95, keywords: ['last', 'name'] });
        }
        if (allText.match(/\b(full\s*name|fullname|legal\s*name|complete\s*name)\b/) ||
            (allText.includes('name') && !allText.match(/\b(first|last|user|file|company)\b/))) {
            classifications.push({ type: 'fullName', confidence: 0.9, keywords: ['full', 'name'] });
        }
        if (allText.match(/\b(email|e-mail|mail|email\s*address)\b/)) {
            classifications.push({ type: 'email', confidence: 0.95, keywords: ['email'] });
        }
        if (allText.match(/\b(phone|mobile|telephone|contact\s*number|cell|tel)\b/)) {
            classifications.push({ type: 'phone', confidence: 0.9, keywords: ['phone'] });
        }

        // Additional contact fields
        if (allText.match(/\b(website|url|homepage|site)\b/)) {
            classifications.push({ type: 'website', confidence: 0.8, keywords: ['website'] });
        }
        if (allText.match(/\b(pronouns|pronoun|he\/him|she\/her|they\/them)\b/)) {
            classifications.push({ type: 'pronouns', confidence: 0.9, keywords: ['pronouns'] });
        }

        // Personal statements and summaries
        if (allText.match(/\b(summary|about.*me|professional.*summary|objective|personal.*statement)\b/)) {
            classifications.push({ type: 'summary', confidence: 0.85, keywords: ['summary'] });
        }
        if (allText.match(/\b(cover.*letter|covering.*letter|motivation.*letter)\b/)) {
            classifications.push({ type: 'coverLetter', confidence: 0.9, keywords: ['cover', 'letter'] });
        }
        if (allText.match(/\b(additional.*info|additional.*information|tell.*us.*more|anything.*else)\b/)) {
            classifications.push({ type: 'additionalInfo', confidence: 0.85, keywords: ['additional', 'info'] });
        }

        // Location
        if (combinedText.match(/\b(city|town)\b/i) && !combinedText.includes('work') && !combinedText.includes('job')) {
            classifications.push({ type: 'city', confidence: 0.85, keywords: ['city'] });
        }
        if (combinedText.match(/\b(state|province|region)\b/i)) {
            classifications.push({ type: 'state', confidence: 0.85, keywords: ['state'] });
        }
        if (combinedText.match(/\b(zip|postal)\b/i)) {
            classifications.push({ type: 'zipCode', confidence: 0.9, keywords: ['zip'] });
        }
        if (combinedText.match(/\b(country|nation)\b/i)) {
            classifications.push({ type: 'country', confidence: 0.85, keywords: ['country'] });
        }
        if (combinedText.match(/\b(address|street)\b/i) && !combinedText.includes('email')) {
            classifications.push({ type: 'address', confidence: 0.8, keywords: ['address'] });
        }

        // Professional Links
        if (combinedText.includes('linkedin')) {
            classifications.push({ type: 'linkedinUrl', confidence: 0.95, keywords: ['linkedin'] });
        }
        if (combinedText.match(/\b(github|gitlab|portfolio|website|personal.*site)\b/i)) {
            classifications.push({ type: 'portfolioUrl', confidence: 0.85, keywords: ['github', 'portfolio'] });
        }

        // Work Experience
        if (combinedText.match(/\b(years|yrs).*experience\b/i) || combinedText.includes('hands on')) {
            classifications.push({ type: 'yearsExperience', confidence: 0.85, keywords: ['years', 'experience'] });
        }
        if (combinedText.match(/\b(current|previous).*company\b/i) || (combinedText.includes('employer') && !combinedText.includes('former'))) {
            classifications.push({ type: 'company', confidence: 0.8, keywords: ['company'] });
        }
        if (combinedText.match(/\b(job.*title|position|role)\b/i) && !combinedText.includes('desired')) {
            classifications.push({ type: 'jobTitle', confidence: 0.8, keywords: ['title', 'position'] });
        }

        // Availability
        if (combinedText.match(/\b(available|availability|start.*date)\b/i)) {
            classifications.push({ type: 'availability', confidence: 0.8, keywords: ['available'] });
        }
        if (combinedText.match(/\b(salary|compensation|expected.*pay|wage)\b/i)) {
            classifications.push({ type: 'salary', confidence: 0.85, keywords: ['salary'] });
        }

        // Authorization
        if (combinedText.match(/\b(citizen|citizenship|u\.?s\.? citizen)\b/i)) {
            classifications.push({ type: 'citizenship', confidence: 0.95, keywords: ['citizen'] });
        }
        if (combinedText.match(/\b(authorized|authorization|eligible.*work|work.*permit|legally.*work|right.*work)\b/i)) {
            classifications.push({ type: 'workAuthorization', confidence: 0.9, keywords: ['authorized'] });
        }
        if (combinedText.match(/\b(sponsor|sponsorship|visa|require.*sponsorship|need.*sponsorship)\b/i)) {
            classifications.push({ type: 'sponsorship', confidence: 0.9, keywords: ['sponsor'] });
        }

        // Demographic / EEOC Questions
        if (combinedText.match(/\b(gender|sex)\b/i) && !combinedText.includes('transgender')) {
            classifications.push({ type: 'gender', confidence: 0.95, keywords: ['gender'] });
        }
        if (combinedText.match(/\b(race|ethnicity|ethnic)\b/i)) {
            classifications.push({ type: 'race', confidence: 0.95, keywords: ['race', 'ethnicity'] });
        }
        if (combinedText.match(/\b(veteran|military|armed\s*forces|served)\b/i)) {
            classifications.push({ type: 'veteran', confidence: 0.95, keywords: ['veteran'] });
        }
        if (combinedText.match(/\b(disability|disabled|handicap|impairment)\b/i)) {
            classifications.push({ type: 'disability', confidence: 0.95, keywords: ['disability'] });
        }
        if (combinedText.match(/\b(hispanic|latino|latina|latinx)\b/i)) {
            classifications.push({ type: 'hispanic', confidence: 0.95, keywords: ['hispanic', 'latino'] });
        }

        // Motivation
        if (combinedText.match(/\bwhy.*(interested|applying|company|role|position)\b/i)) {
            classifications.push({ type: 'whyInterested', confidence: 0.85, keywords: ['why', 'interested'] });
        }
        if (combinedText.match(/\b(cover.*letter)\b/i)) {
            classifications.push({ type: 'coverLetter', confidence: 0.95, keywords: ['cover', 'letter'] });
        }

        // Resume
        if (combinedText.match(/\b(resume|cv)\b/i)) {
            classifications.push({ type: 'resume', confidence: 0.95, keywords: ['resume', 'cv'] });
        }

        // References
        if (combinedText.match(/\breference(?!.*preference)\b/i)) {
            classifications.push({ type: 'references', confidence: 0.85, keywords: ['reference'] });
        }

        // Enhanced fallback for unclassified fields
        if (classifications.length === 0) {
            // Try to infer from input type and context
            const inputType = element.type?.toLowerCase();
            const tagName = element.tagName?.toLowerCase();

            // Specific input type handling
            if (inputType === 'email') {
                return { type: 'email', confidence: 0.8, keywords: ['email', 'inferred'] };
            }
            if (inputType === 'tel') {
                return { type: 'phone', confidence: 0.8, keywords: ['phone', 'inferred'] };
            }
            if (inputType === 'url') {
                return { type: 'website', confidence: 0.8, keywords: ['url', 'inferred'] };
            }
            if (inputType === 'date' || inputType === 'datetime-local') {
                return { type: 'date', confidence: 0.7, keywords: ['date', 'inferred'] };
            }

            // Pattern matching for common missed fields
            if (allText.match(/\b(comment|note|message|description|additional|other)\b/)) {
                return { type: 'comment', confidence: 0.6, keywords: ['comment'] };
            }
            if (allText.match(/\b(referr|source|how.*hear)\b/)) {
                return { type: 'referralSource', confidence: 0.7, keywords: ['referral'] };
            }
            if (allText.match(/\b(start|available|date)\b/)) {
                return { type: 'startDate', confidence: 0.6, keywords: ['date'] };
            }

            // Generic text field - might be fillable with AI
            if (tagName === 'textarea' || inputType === 'text' || !inputType) {
                return { type: 'unknownText', confidence: 0.3, keywords: ['text', 'ai-fillable'] };
            }

            return { type: 'unknown', confidence: 0, keywords: [] };
        }

        // Return highest confidence classification
        classifications.sort((a, b) => b.confidence - a.confidence);
        return classifications[0];
    }

    async function getAIResponse(prompt, userData) {
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
        const apiKey = 'AIzaSyAIaKT-GSfWOgaF_bH9hyEgJMwsK1cGqVU';
        const apiUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorText = await response.text();
                console.error("AI API Error:", response.status, errorText);
                console.error("Failed prompt preview:", prompt.substring(0, 200) + "...");
                return "";
            }
            const result = await response.json();
            const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "";

            // Log successful AI responses for debugging
            if (aiResponse) {
                console.log('✅ AI Response received:', aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''));
            } else {
                console.warn('⚠️ Empty AI response received');
                console.log('Raw AI result:', JSON.stringify(result, null, 2));
            }

            return aiResponse;
        } catch (error) {
            console.error("AI Fetch Error:", error);
            console.error("Failed prompt preview:", prompt.substring(0, 200) + "...");
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
    } catch (e) { console.error("Hired Always: Could not parse page context:", e); }

    // userData was already loaded at the start of the function
    console.log("Hired Always: Starting form filling process...");

    const workHistoryPrompt = `Extract work experience from the resume with MAXIMUM ACCURACY. Only include information explicitly stated in the resume.

**CRITICAL REQUIREMENTS:**
- Extract ONLY positions explicitly mentioned in the resume
- Use exact job titles, company names, and dates as written
- For dates: Use format "MM/YYYY" or "Month YYYY" as shown in resume
- If start/end dates unclear, use "Present" for current positions or leave empty if unknown
- Responsibilities: Extract exact bullet points or descriptions from resume

**RESPONSE FORMAT:**
Return ONLY a valid JSON array with this exact structure:
[
  {
    "jobTitle": "exact title from resume",
    "company": "exact company name",
    "startDate": "MM/YYYY or Month YYYY",
    "endDate": "MM/YYYY or Month YYYY or Present",
    "responsibilities": "key achievements and duties as stated in resume"
  }
]

**VALIDATION RULES:**
- NO fictional companies or positions
- NO estimated dates if not in resume
- NO enhanced job titles
- Include ALL positions mentioned in resume
- If resume shows gaps, don't fill them with assumptions

**JSON RESPONSE:**`;
    let workHistory = [];
    try {
        const historyJson = await getAIResponse(workHistoryPrompt, userData);
        if (historyJson) {
            const cleanedJson = historyJson.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedHistory = JSON.parse(cleanedJson);

            // Validate the extracted data
            if (Array.isArray(parsedHistory)) {
                workHistory = parsedHistory.filter(job =>
                    job.jobTitle && job.jobTitle.trim() &&
                    job.company && job.company.trim() &&
                    typeof job.jobTitle === 'string' &&
                    typeof job.company === 'string'
                );
            }
        }
    } catch (e) {
        console.error("Hired Always: Could not parse work history from resume.", e);
        console.log("Raw AI response for debugging:", historyJson);
    }

    const educationPrompt = `Extract education information from the resume with COMPLETE ACCURACY. Only include education explicitly mentioned in the resume.

**CRITICAL REQUIREMENTS:**
- Extract ONLY degrees/education explicitly stated in the resume
- Use exact degree names, school names, and dates as written
- For GPA: Only include if explicitly mentioned in resume, otherwise leave empty
- Field of study: Extract exact major/concentration if mentioned
- Dates: Use exact format from resume (MM/YYYY or Month YYYY)

**RESPONSE FORMAT:**
Return ONLY a valid JSON array with this structure:
[
  {
    "degree": "exact degree name from resume",
    "school": "exact institution name",
    "fieldOfStudy": "exact major/field if mentioned",
    "startDate": "MM/YYYY or Month YYYY or empty if not specified",
    "endDate": "MM/YYYY or Month YYYY or empty if not specified",
    "gpa": "exact GPA if mentioned, otherwise empty string"
  }
]

**VALIDATION RULES:**
- NO fictional schools or degrees
- NO estimated GPAs if not stated
- NO standardized degree names if resume uses different format
- Include certifications only if they're academic degrees
- If multiple degrees, include all that are explicitly mentioned

**JSON RESPONSE:**`;
    let educationHistory = [];
    try {
        const educationJson = await getAIResponse(educationPrompt, userData);
        if (educationJson) {
            const cleanedJson = educationJson.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedEducation = JSON.parse(cleanedJson);

            // Validate the extracted education data
            if (Array.isArray(parsedEducation)) {
                educationHistory = parsedEducation.filter(edu =>
                    edu.degree && edu.degree.trim() &&
                    edu.school && edu.school.trim() &&
                    typeof edu.degree === 'string' &&
                    typeof edu.school === 'string'
                );
            }
        }
    } catch (e) {
        console.error("Hired Always: Could not parse education from resume.", e);
        console.log("Raw AI education response for debugging:", educationJson);
    }

    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for the page to finish loading dynamic content

    const demographicKeywords = ['race', 'ethnicity', 'gender', 'disability', 'veteran', 'sexual orientation'];
    let usedAnswers = new Set();
    let experienceIndex = 0;
    let educationIndex = 0;

    // Dynamic form element discovery - finds ALL potential form inputs
    function discoverFormElements() {
        const selectors = [
            // Standard HTML form elements
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
            'textarea',
            'select',

            // ARIA roles for custom controls
            '[role="textbox"]',
            '[role="combobox"]',
            '[role="listbox"]',
            '[role="radiogroup"] input[type="radio"]',
            '[role="group"] input[type="checkbox"]',

            // Content editable
            '[contenteditable="true"]',

            // Button-based dropdowns (common in React/Material-UI)
            'button[aria-haspopup]',
            'button[aria-expanded]',
            'button[class*="select"]',
            'button[class*="dropdown"]',
            'button[class*="button"][class*="-"]', // Catches CSS-module buttons

            // Custom input patterns
            '[data-testid*="input"]',
            '[data-testid*="field"]',
            '[data-testid*="select"]',
            '[class*="input"]',
            '[class*="field"]',
            '[class*="textField"]',
            '[class*="textarea"]',

            // Additional common patterns
            '[name]:not([type="hidden"])',  // Any element with a name attribute
            'div[role="textbox"]',  // Div-based inputs
            'span[role="textbox"]',  // Span-based inputs
            '[aria-label]:not(button):not(a)',  // Elements with aria-label (likely form fields)
            '[placeholder]',  // Any element with placeholder text

            // Modern framework patterns
            '[data-field]', '[data-input]', '[data-form-field]',
            'input[id*="field"]', 'input[id*="input"]',
            'textarea[id*="field"]', 'textarea[id*="input"]',
            '[class*="FormField"]', '[class*="form-field"]', '[class*="form_field"]',
            '[class*="Input"]', '[class*="TextArea"]', '[class*="Select"]',

            // Common form library patterns (Formik, React Hook Form, etc)
            '[id^="formik-"]', '[name^="formik-"]',
            '[id*="react-hook-form"]', '[name*="react-hook-form"]',

            // Additional ARIA patterns
            '[role="spinbutton"]', '[role="slider"]',

            // MUI/Material-UI specific
            '.MuiTextField-root input', '.MuiTextArea-root textarea',
            '.MuiSelect-root', '.MuiAutocomplete-root input',

            // Bootstrap and common CSS framework patterns
            '.form-control', '.form-select', '.form-check-input'
        ];

        const elements = new Set();

        selectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    // Only add if element is likely interactive
                    if (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0) {
                        elements.add(el);
                    }
                });
            } catch (e) {
                // Selector might be invalid in some contexts
                console.warn(`Hired Always: Invalid selector "${selector}"`);
            }
        });

        return Array.from(elements);
    }

    // Wait for dynamic content to load (important for SPAs)
    console.log('Hired Always: Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    let allElements = discoverFormElements();
    console.log(`Hired Always: Initial discovery found ${allElements.length} form elements`);

    // Check for dynamic content loading (React/Vue/Angular apps)
    let attempts = 0;
    let lastElementCount = allElements.length;

    while (attempts < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const newElements = discoverFormElements();

        if (newElements.length > lastElementCount) {
            console.log(`Hired Always: Found ${newElements.length - lastElementCount} additional dynamic elements`);
            allElements = newElements;
            lastElementCount = newElements.length;
            attempts = 0; // Reset attempts if we found new elements
        } else {
            attempts++;
        }
    }

    console.log(`Hired Always: Final discovery found ${allElements.length} form elements`);
    console.log('Hired Always: Element types found:', allElements.map(el => `${el.tagName.toLowerCase()}[${el.type || el.getAttribute('role') || 'no-type'}]`).join(', '));

    for (const el of allElements) {
        try {
            const style = window.getComputedStyle(el);
            // More accurate visibility check - only skip truly hidden elements
            if (el.disabled || el.readOnly || style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null) {
                console.log(`Hired Always: Skipping disabled/hidden element:`, el);
                continue;
            }

            // Skip elements that already have values (unless they're default/placeholder values)
            if (el.value && el.value.trim() !== '' &&
                el.value.trim() !== 'Select' &&
                el.value.trim() !== 'Choose' &&
                el.value.trim() !== 'Please select' &&
                el.value.trim() !== '-- Select --') {
                console.log('⏭️ Skipping field with existing value:', el.value.substring(0, 50));
                continue;
            }

            // For checkboxes and radio buttons, skip if already selected
            if ((el.type === 'checkbox' || el.type === 'radio') && el.checked) {
                console.log('⏭️ Skipping already selected radio/checkbox');
                continue;
            }

            // For select dropdowns, skip if a meaningful option is already selected
            if (el.tagName.toLowerCase() === 'select' && el.selectedIndex > 0) {
                const selectedText = el.options[el.selectedIndex].text.trim();
                if (selectedText &&
                    selectedText !== 'Select' &&
                    selectedText !== 'Choose' &&
                    selectedText !== 'Please select' &&
                    selectedText !== '-- Select --') {
                    console.log('⏭️ Skipping dropdown with existing selection:', selectedText);
                    continue;
                }
            }

            const elType = el.tagName.toLowerCase();
            const isButton = elType === 'button' || el.getAttribute('role') === 'button';

            // Skip non-interactive buttons and submit buttons
            if (isButton) {
                const buttonText = el.innerText.toLowerCase().trim();
                const buttonType = el.type;

                // Skip submit, reset, and action buttons
                if (buttonType === 'submit' ||
                    buttonType === 'reset' ||
                    buttonText.includes('apply') ||
                    buttonText.includes('submit') ||
                    buttonText.includes('upload') ||
                    buttonText.includes('attach') ||
                    buttonText.includes('remove') ||
                    buttonText.includes('delete') ||
                    buttonText.includes('cross')) {
                    continue;
                }
            }

            // Log field being processed for better debugging
            console.log("Hired Always: Processing form element:", el);

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 200));

            const question = findQuestionForInput(el);
            const combinedText = `${el.id} ${el.name} ${question}`.toLowerCase();
            const isDemographic = demographicKeywords.some(keyword => combinedText.includes(keyword));

            // Classify the field type for smarter handling
            const fieldClassification = classifyFieldType(el, question, combinedText);
            console.log(`Hired Always: Field classified as "${fieldClassification.type}" (confidence: ${fieldClassification.confidence}) - Question: "${question}"`);

            // --- Handle EEOC/Demographic Fields ---
            if (isDemographic) {
                const inputRole = el.getAttribute('role');
                const elType = el.tagName.toLowerCase();

                // Helper function to check if dropdown already has a meaningful value
                function isDropdownAlreadyAnswered(element) {
                    const tagName = element.tagName.toLowerCase();
                    let currentValue = '';

                    if (tagName === 'select') {
                        const selectedOption = element.options[element.selectedIndex];
                        if (selectedOption && element.selectedIndex > 0) {
                            currentValue = selectedOption.text.toLowerCase().trim();
                        }
                    } else {
                        currentValue = (element.value || element.innerText || element.textContent || '').toLowerCase().trim();
                    }

                    // Check if it's a placeholder or empty
                    const isPlaceholder = !currentValue ||
                        currentValue.includes('select') ||
                        currentValue.includes('choose') ||
                        currentValue.includes('please') ||
                        currentValue === '--' ||
                        currentValue === '-' ||
                        currentValue === '';

                    if (!isPlaceholder && currentValue.length > 0) {
                        console.log(`⏭️ Dropdown already answered with: "${currentValue}", skipping`);
                        return true;
                    }
                    return false;
                }

                // Handle race/ethnicity dropdown
                if (combinedText.includes('race') || combinedText.includes('ethnicity')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const raceValue = userData.race || 'Decline To Self Identify';
                    console.log('🏷️ Using saved race/ethnicity:', raceValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, raceValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, raceValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, raceValue);
                    }
                    continue;
                }

                // Handle gender dropdown
                if (combinedText.includes('gender') && !combinedText.includes('transgender')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const genderValue = userData.gender || 'Decline to Self-Identify';
                    console.log('🏷️ Using saved gender:', genderValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, genderValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, genderValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, genderValue);
                    }
                    continue;
                }

                // Handle veteran status dropdown
                if (combinedText.includes('veteran')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const veteranValue = userData.veteran || 'I don\'t wish to answer';
                    console.log('🏷️ Using saved veteran status:', veteranValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, veteranValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, veteranValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, veteranValue);
                    }
                    continue;
                }

                // Handle disability status dropdown
                if (combinedText.includes('disability')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const disabilityValue = userData.disability || 'I don\'t wish to answer';
                    console.log('🏷️ Using saved disability status:', disabilityValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, disabilityValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, disabilityValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, disabilityValue);
                    }
                    continue;
                }

                // Handle hispanic/latino dropdown
                if (combinedText.includes('hispanic') || combinedText.includes('latino')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const hispanicValue = userData.hispanic || 'I don\'t wish to answer';
                    console.log('🏷️ Using saved hispanic/latino status:', hispanicValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, hispanicValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, hispanicValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, hispanicValue);
                    }
                    continue;
                }

                // Handle citizenship/work authorization dropdown
                if (combinedText.includes('authorized') || combinedText.includes('authorization') ||
                    combinedText.includes('eligible') || combinedText.includes('legally') ||
                    combinedText.includes('citizen')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const authValue = userData.citizenship || 'Yes';
                    console.log('🏷️ Using saved work authorization:', authValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, authValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, authValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, authValue);
                    }
                    continue;
                }

                // Handle sponsorship dropdown
                if (combinedText.includes('sponsor') || combinedText.includes('visa')) {
                    if (isDropdownAlreadyAnswered(el)) {
                        continue;
                    }
                    const sponsorValue = userData.sponsorship || 'No';
                    console.log('🏷️ Using saved sponsorship status:', sponsorValue);

                    if (inputRole === 'combobox') {
                        await selectReactSelectOption(el, sponsorValue);
                    } else if (elType === 'select') {
                        await selectDropdownOption(el, sponsorValue);
                    } else if (elType === 'button') {
                        await selectReactSelectOption(el, sponsorValue);
                    }
                    continue;
                }

                // Skip other demographic fields
                console.log('⏭️ Skipping other demographic field');
                continue;
            }

            // --- Resume Field ---
            if (combinedText.includes('resume') || combinedText.includes('cv')) {
                if (el.type === 'file') {
                    // Attempt to attach resume file
                    if (userData.resume && userData.resumeFileName) {
                        console.log("Hired Always: Attempting to attach resume file...");
                        const attached = await attachResumeFile(userData.resume, userData.resumeFileName);
                        if (attached) {
                            console.log("Hired Always: Resume attached successfully!");
                        } else {
                            console.log("Hired Always: Could not automatically attach resume. User will need to upload manually.");

                            // Enhanced file upload guidance
                            el.style.border = '3px solid #8B5CF6';
                            el.style.backgroundColor = '#F3F4F6';

                            let notice = el.parentElement.querySelector('p.autofill-notice');
                            if (!notice) {
                                notice = document.createElement('p');
                                notice.className = 'autofill-notice';
                                notice.innerHTML = `📄 <strong>Resume Upload Required</strong><br>` +
                                    `Please click here to upload your resume file.<br>` +
                                    `<small>Supported formats: PDF, DOC, DOCX</small>`;
                                notice.style.cssText = `
                                    color: #8B5CF6;
                                    font-size: 13px;
                                    margin: 8px 0;
                                    padding: 8px;
                                    background: #F8FAFC;
                                    border: 1px solid #E5E7EB;
                                    border-radius: 4px;
                                    cursor: pointer;
                                `;

                                // Make notice clickable to trigger file input
                                notice.addEventListener('click', () => {
                                    el.click();
                                });

                                el.parentElement.insertBefore(notice, el.nextSibling);
                            }

                            // Scroll to file input for user attention
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                    continue;
                }
                if (elType === 'textarea' || el.isContentEditable) {
                    let resumePrompt;
                    const lowerQuestion = question ? question.toLowerCase() : '';
                    
                    if (lowerQuestion.includes('paste') || lowerQuestion.includes('copy') || 
                        lowerQuestion.includes('full text') || lowerQuestion.includes('entire')) {
                        resumePrompt = "Provide the FULL plain text content of the resume. Do not summarize, do not omit details. Output the raw text.";
                    } else {
                        resumePrompt = `You are answering a specific question in a job application: "${question}". 
                        Based on the candidate's resume, provide a professional, well-written response that directly answers the question.
                        Highlight relevant skills and experience. Keep it professional and concise.`;
                    }
                    
                    const resumeText = await getAIResponse(resumePrompt, userData);
                    if (resumeText) await simulateTyping(el, resumeText);
                    continue;
                }
            }

            // --- Cover Letter ---
            // Enhanced detection: Check for "Enter manually" button in cover letter upload sections
            const isCoverLetterButton =
                el.dataset.testid === 'cover_letter-text' ||
                (elType === 'button' &&
                    el.innerText.toLowerCase().includes('enter manually') &&
                    (combinedText.includes('cover letter') ||
                        el.closest('.file-upload')?.querySelector('[id*="cover_letter"], [for*="cover_letter"]')));

            if (isCoverLetterButton) {
                console.log('📝 Found cover letter "Enter manually" button');
                await simulateClick(el);
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for textarea to appear

                // Try multiple selectors to find the textarea that appears
                const coverLetterTextArea = document.getElementById('cover_letter_text') ||
                    document.querySelector('textarea[id*="cover_letter"]') ||
                    document.querySelector('textarea[name*="cover_letter"]') ||
                    document.querySelector('[contenteditable="true"][class*="cover"]');

                if (coverLetterTextArea) {
                    let coverLetterText = '';

                    // Check if user provided a manual cover letter
                    if (userData.coverLetter && userData.coverLetter.trim()) {
                        console.log('✍️ Using manual cover letter provided by user');
                        coverLetterText = userData.coverLetter.trim();
                    } else {
                        // Generate cover letter with AI
                        console.log('🤖 Generating AI cover letter');
                        const coverLetterPrompt = `You are a professional career writer crafting a cover letter. Create a compelling, ACCURATE cover letter based ONLY on the provided information.

**CRITICAL REQUIREMENTS:**
- Use ONLY information from the resume and user profile - never invent experience or skills
- Tailor the letter specifically to the job title and requirements
- Maintain professional tone and proper business letter format
- Be truthful about qualifications while highlighting strengths
- Keep to 3-4 concise paragraphs

**JOB APPLICATION DETAILS:**
- Position: ${jobTitle || 'Not specified'}
- Job Requirements: ${jobDescription || 'Not available'}
- Candidate Background: ${userData.additionalInfo || 'See resume for details'}

**COVER LETTER STRUCTURE:**
1. Opening: Express interest in the specific position and company
2. Body (1-2 paragraphs): Connect resume experience to job requirements
3. Closing: Reiterate interest and request for interview

**WRITING GUIDELINES:**
- Start with "Dear Hiring Manager," if no specific name available
- Use specific examples from the resume when possible
- Focus on how the candidate can contribute to the company
- End with "Sincerely, [Candidate Name]" or similar professional closing
- NO fictional experiences, skills, or achievements

**COVER LETTER:**`;
                        coverLetterText = await getAIResponse(coverLetterPrompt, userData);
                    }

                    if (coverLetterText) {
                        await simulateTyping(coverLetterTextArea, coverLetterText);
                        console.log('✅ Cover letter filled successfully');
                    }
                } else {
                    console.warn('⚠️ Cover letter textarea not found after clicking "Enter manually"');
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

                // Job title
                if (combinedText.includes('title') || combinedText.includes('position') || combinedText.includes('role')) {
                    await simulateTyping(el, currentJob.jobTitle);
                    continue;
                }
                // Company/Employer
                else if (combinedText.includes('company') || combinedText.includes('employer') || combinedText.includes('organization')) {
                    await simulateTyping(el, currentJob.company);
                    continue;
                }
                // Start date
                else if (combinedText.includes('start') && (combinedText.includes('date') || combinedText.includes('from'))) {
                    await simulateTyping(el, currentJob.startDate);
                    continue;
                }
                // End date
                else if (combinedText.includes('end') && (combinedText.includes('date') || combinedText.includes('to'))) {
                    await simulateTyping(el, currentJob.endDate || 'Present');
                    continue;
                }
                // Responsibilities/Description
                else if (combinedText.includes('responsibilit') || combinedText.includes('dut') ||
                    combinedText.includes('description') || combinedText.includes('achievement')) {
                    await simulateTyping(el, currentJob.responsibilities);

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
                    continue;
                }
            }

            // --- Education ---
            const isEducationField = combinedText.includes('education') || combinedText.includes('school') ||
                combinedText.includes('university') || combinedText.includes('college') ||
                combinedText.includes('degree') || combinedText.includes('academic') ||
                (educationHistory[educationIndex] && (combinedText.includes(educationHistory[educationIndex].school.toLowerCase()) ||
                    combinedText.includes(educationHistory[educationIndex].degree.toLowerCase())));

            if (isEducationField && educationIndex < educationHistory.length) {
                const currentEd = educationHistory[educationIndex];

                // School/University name
                if (combinedText.includes('school') || combinedText.includes('university') ||
                    combinedText.includes('college') || combinedText.includes('institution')) {
                    await simulateTyping(el, currentEd.school);
                    continue;
                }
                // Degree
                else if (combinedText.includes('degree') || combinedText.includes('qualification') ||
                    combinedText.includes('level of education')) {
                    await simulateTyping(el, currentEd.degree);
                    continue;
                }
                // Field of study/Major
                else if (combinedText.includes('major') || combinedText.includes('field') ||
                    combinedText.includes('study') || combinedText.includes('concentration')) {
                    await simulateTyping(el, currentEd.fieldOfStudy);
                    continue;
                }
                // GPA
                else if (combinedText.includes('gpa') || combinedText.includes('grade point')) {
                    if (currentEd.gpa) {
                        await simulateTyping(el, currentEd.gpa);
                        continue;
                    }
                }
                // Start date
                else if (combinedText.includes('start') && (combinedText.includes('date') || combinedText.includes('from'))) {
                    await simulateTyping(el, currentEd.startDate);
                    continue;
                }
                // End date / Graduation date
                else if ((combinedText.includes('end') || combinedText.includes('graduation') || combinedText.includes('completion')) &&
                    (combinedText.includes('date') || combinedText.includes('year'))) {
                    await simulateTyping(el, currentEd.endDate || 'Expected 2024');

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
                    continue;
                }
            }

            // --- Certifications and Skills ---
            if ((combinedText.includes('certification') || combinedText.includes('license') ||
                combinedText.includes('credential')) && !isDemographic) {
                const certPrompt = `You are analyzing a resume to answer a certification/license question ACCURATELY.

**CRITICAL INSTRUCTION**: Only mention certifications, licenses, or credentials that are EXPLICITLY stated in the resume. DO NOT assume or infer certifications that are not clearly mentioned.

**QUESTION TO ANSWER:**
"${question}"

**ANALYSIS REQUIREMENTS:**
1. Search the resume for exact mentions of certifications, licenses, professional credentials
2. If the question asks for a specific certification, respond "Yes" ONLY if it's explicitly listed in the resume
3. If asking to list certifications, only include those explicitly mentioned
4. If no relevant certifications are found, respond with "None currently" or "Not specified"
5. Never guess or suggest certifications based on job experience alone

**RESPONSE FORMAT:**
- For yes/no questions: Answer "Yes" or "No" based on explicit resume content
- For listing questions: Provide comma-separated list of exact certifications found
- If none found: State "None currently listed"

**ACCURATE RESPONSE:**`;
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
                const techSkillsPrompt = `You are analyzing a resume to identify technical skills that ACCURATELY match the question.

**CRITICAL REQUIREMENTS:**
- Only list skills, languages, frameworks, or tools that are EXPLICITLY mentioned in the resume
- Match the question's specific requirements (don't list irrelevant skills)
- Be honest about skill level - don't oversell or undersell abilities
- If asking for years of experience, base it on resume work history dates

**QUESTION TO ANSWER:**
"${question}"

**ANALYSIS PROCESS:**
1. Identify what specific technical skills the question is asking for
2. Search the resume for exact mentions of these technologies
3. Consider context - work projects, education, or explicitly listed skills sections
4. If years of experience requested, calculate based on resume dates
5. Format response appropriately for the question type

**RESPONSE GUIDELINES:**
- For skill lists: Provide comma-separated list of relevant skills found in resume
- For yes/no questions: Answer based on explicit resume evidence
- For experience years: Calculate from actual work history dates
- If no relevant skills found: Respond "Not specified in resume"

**ACCURATE RESPONSE:**`;
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

                const prompt = `You are an expert career advisor helping with job application forms. You must select the MOST ACCURATE and TRUTHFUL option from the provided list.

**CRITICAL REQUIREMENTS:**
- ACCURACY: Choose the option that best reflects the candidate's actual qualifications and situation
- TRUTH: Never select misleading answers that could lead to job application rejection
- CONTEXT AWARENESS: Consider the specific job requirements and how they match the candidate's background

**CANDIDATE PROFILE:**
- Name: ${userData.firstName || ''} ${userData.lastName || ''}
- Location: ${userData.city || ''} ${userData.state || ''} ${userData.country || ''}
- Email: ${userData.email || 'Not provided'}
- Phone: ${userData.phone || 'Not provided'}
- Professional Links: ${userData.linkedinUrl || userData.portfolioUrl || 'Not provided'}
- Citizenship/Work Auth: ${userData.citizenship || 'Not provided'}
- Sponsorship Status: ${userData.sponsorship || 'Not provided'}
- Job Title Applied For: ${jobTitle || 'Not specified'}
- Job Requirements: ${jobDescription || 'Not specified'}
- Additional Information: ${userData.additionalInfo || 'Not provided'}
- Question Category: ${questionType}
- Previously Selected: ${Array.from(usedAnswers).join(", ") || 'None'}

**QUESTION TO ANSWER:**
"${cleanQuestion}"

**AVAILABLE OPTIONS:**
${options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}

**SELECTION CRITERIA:**
1. FIRST PRIORITY: Choose the most truthful option based on the candidate's actual background
2. SECOND PRIORITY: If multiple truthful options exist, choose the most professionally favorable
3. THIRD PRIORITY: For ambiguous cases, choose options showing competence and reliability
4. NEVER select obviously false information (wrong location, impossible experience levels, etc.)

**RESPONSE FORMAT:**
Return ONLY the exact text of the selected option. No explanation, no additional text.

**SELECTED OPTION:**`;

                let aiChoice = await getAIResponse(prompt, userData);

                // Clean up the AI response to match an option exactly
                aiChoice = aiChoice.trim();

                // Advanced option matching with validation
                let bestMatch = null;

                // Step 1: Try exact match (case insensitive)
                bestMatch = options.find(opt => opt.trim().toLowerCase() === aiChoice.toLowerCase());

                // Step 2: Try partial match - AI choice contains option or vice versa
                if (!bestMatch) {
                    bestMatch = options.find(opt => {
                        const optLower = opt.toLowerCase();
                        const choiceLower = aiChoice.toLowerCase();
                        return optLower.includes(choiceLower) || choiceLower.includes(optLower);
                    });
                }

                // Step 3: Try word-based matching for better accuracy
                if (!bestMatch && aiChoice.length > 2) {
                    const aiWords = aiChoice.toLowerCase().split(/\s+/);
                    bestMatch = options.find(opt => {
                        const optWords = opt.toLowerCase().split(/\s+/);
                        return aiWords.some(aiWord =>
                            optWords.some(optWord =>
                                aiWord.length > 2 && optWord.includes(aiWord)
                            )
                        );
                    });
                }

                // Step 4: Intelligent fallback based on question type
                if (!bestMatch) {
                    console.warn(`⚠️ AI choice "${aiChoice}" doesn't match any option. Question type: ${questionType}`);

                    // Context-aware fallback selection
                    if (questionType === 'work-status') {
                        bestMatch = options.find(opt => opt.toLowerCase().includes('authorized') || opt.toLowerCase().includes('citizen')) ||
                            options.find(opt => opt.toLowerCase().includes('yes'));
                    } else if (questionType === 'relocation') {
                        bestMatch = options.find(opt => opt.toLowerCase().includes('yes') || opt.toLowerCase().includes('willing'));
                    } else if (questionType === 'notice-period') {
                        bestMatch = options.find(opt => opt.includes('2') || opt.includes('weeks') || opt.includes('immediately'));
                    } else {
                        // Generic fallback: avoid negative options, prefer professional responses
                        bestMatch = options.find(opt =>
                            opt.trim() &&
                            opt.toLowerCase() !== 'select' &&
                            opt.toLowerCase() !== 'choose' &&
                            opt.toLowerCase() !== 'none' &&
                            !opt.toLowerCase().includes('prefer not')
                        ) || options[0];
                    }
                }

                usedAnswers.add(bestMatch);

                // Select the option based on element type
                let selectionSuccessful = false;

                if (el.tagName.toLowerCase() === 'select') {
                    for (let option of el.options) {
                        const optText = option.text.trim();
                        if (optText === bestMatch || optText.toLowerCase() === bestMatch.toLowerCase()) {
                            // Use robust value setter
                            setNativeValue(el, option.value);
                            selectionSuccessful = true;
                            break;
                        }
                    }
                    // Verify selection
                    if (selectionSuccessful) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } else if (el.type === 'radio' || el.type === 'checkbox') {
                    // Find all related inputs (by name or by grouping)
                    let relatedInputs = [];
                    if (el.name) {
                        relatedInputs = Array.from(document.querySelectorAll(`input[name="${el.name}"]`));
                    } else {
                        // Fallback: look for siblings if no name (rare but happens in some frameworks)
                        // Or maybe we are just processing 'el' itself if it's a single checkbox
                        relatedInputs = [el]; 
                        // If it's a radio group without name, we might be in trouble, but let's try to find siblings in same container
                        if (el.type === 'radio') {
                            const container = el.closest('div, fieldset, [role="group"]');
                            if (container) {
                                relatedInputs = Array.from(container.querySelectorAll('input[type="radio"]'));
                            }
                        }
                    }

                    for (const input of relatedInputs) {
                        const labelText = getLabelTextForElement(input);
                        
                        if (labelText && (labelText === bestMatch || labelText.toLowerCase() === bestMatch.toLowerCase() || labelText.includes(bestMatch))) {
                            if (!input.checked) {
                                await simulateClick(input);
                            }
                            selectionSuccessful = true;
                            break;
                        }
                    }
                    
                    // Verify selection
                    if (selectionSuccessful) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        // Re-query to check status
                        const isChecked = el.name ? 
                            document.querySelector(`input[name="${el.name}"]:checked`) : 
                            (el.checked ? el : null);
                            
                        if (!isChecked) {
                            console.warn("Radio/checkbox selection failed for:", question);
                            // Try one more time with direct click on the best match element found
                        }
                    }
                } else if (el.getAttribute('role') === 'combobox' || (el.tagName.toLowerCase() === 'button' && el.hasAttribute('aria-haspopup'))) {
                    // Handle combobox and button-based dropdowns
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
                    const optionElements = Array.from(source.querySelectorAll('[role="option"], [role="menuitem"], button'));
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

                // Use the improved field classification system
                switch (fieldClassification.type) {
                    case 'firstName':
                        valueToType = userData.firstName;
                        break;
                    case 'lastName':
                        valueToType = userData.lastName;
                        break;
                    case 'fullName':
                        valueToType = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                        break;
                    case 'email':
                        valueToType = userData.email;
                        break;
                    case 'phone':
                        valueToType = userData.phone;
                        break;
                    case 'address':
                        valueToType = userData.address;
                        break;
                    case 'city':
                        valueToType = userData.city;
                        break;
                    case 'state':
                        valueToType = userData.state;
                        break;
                    case 'zipCode':
                        valueToType = userData.zipCode;
                        break;
                    case 'country':
                        valueToType = userData.country;
                        break;
                    case 'linkedinUrl':
                        valueToType = userData.linkedinUrl;
                        break;
                    case 'portfolioUrl':
                        valueToType = userData.portfolioUrl;
                        break;
                    case 'website':
                        valueToType = userData.website || userData.portfolioUrl;
                        break;
                    case 'yearsExperience':
                        valueToType = userData.yearsExperience;
                        break;
                    case 'company':
                        valueToType = userData.company;
                        break;
                    case 'jobTitle':
                        valueToType = userData.jobTitle;
                        break;
                    case 'university':
                        valueToType = userData.university;
                        break;
                    case 'degree':
                        valueToType = userData.degree;
                        break;
                    case 'graduationYear':
                        valueToType = userData.graduationYear;
                        break;
                    case 'referralSource':
                        valueToType = userData.referralSource || "Online job board";
                        break;
                    case 'comment':
                        valueToType = userData.additionalInfo || "Thank you for considering my application.";
                        break;
                    case 'startDate':
                        valueToType = userData.startDate || "Immediately";
                        break;
                    case 'pronouns':
                        valueToType = userData.pronouns;
                        break;
                    case 'additionalInfo':
                        valueToType = userData.additionalInfo;
                        break;
                    case 'coverLetter':
                        valueToType = userData.coverLetter;
                        break;
                    case 'summary':
                        valueToType = userData.additionalInfo || "Experienced professional seeking new opportunities";
                        break;
                    case 'citizenship':
                        valueToType = userData.citizenship || "Yes, I am authorized to work in the U.S.";
                        break;
                    case 'workAuthorization':
                        valueToType = userData.citizenship || "Yes, I am authorized to work in the U.S.";
                        break;
                    case 'sponsorship':
                        valueToType = userData.sponsorship || "No, I do not require sponsorship";
                        break;
                    case 'gender':
                        valueToType = userData.gender || "Decline to Self-Identify";
                        console.log('🏷️ Using saved gender preference:', valueToType);
                        break;
                    case 'race':
                        valueToType = userData.race || "Decline To Self Identify";
                        console.log('🏷️ Using saved race/ethnicity preference:', valueToType);
                        break;
                    case 'veteran':
                        valueToType = userData.veteran || "I don't wish to answer";
                        console.log('🏷️ Using saved veteran status preference:', valueToType);
                        break;
                    case 'disability':
                        valueToType = userData.disability || "I don't wish to answer";
                        console.log('🏷️ Using saved disability status preference:', valueToType);
                        break;
                    case 'hispanic':
                        valueToType = userData.hispanic || "I don't wish to answer";
                        console.log('🏷️ Using saved hispanic/latino preference:', valueToType);
                        break;
                    case 'unknownText':
                        // Use AI for unknown text fields if question is present
                        if (question && question.length > 3) {
                            console.log(`Hired Always: Using AI for unknown text field: "${question}"`);
                            try {
                                const unknownTextPrompt = `You are helping fill out a job application form. Provide a professional, concise answer based on the candidate's profile.

**CANDIDATE PROFILE:**
- Name: ${userData.firstName || ''} ${userData.lastName || ''}
- Location: ${userData.city || ''} ${userData.state || ''} ${userData.country || ''}
- Email: ${userData.email || 'Not provided'}
- Professional Links: ${userData.linkedinUrl || userData.portfolioUrl || 'Not provided'}
- Work Authorization: ${userData.citizenship || 'Not provided'}
- Visa Sponsorship: ${userData.sponsorship || 'Not provided'}
- Gender: ${userData.gender || 'Not provided'}
- Race/Ethnicity: ${userData.race || 'Not provided'}
- Veteran Status: ${userData.veteran || 'Not provided'}
- Disability Status: ${userData.disability || 'Not provided'}
- Hispanic/Latino: ${userData.hispanic || 'Not provided'}
- Additional Info: ${userData.additionalInfo || 'Not provided'}
- Job Applied For: ${jobTitle || 'Not specified'}

**QUESTION:**
"${question}"

**REQUIREMENTS:**
- Provide a brief, professional response (1-3 sentences)
- Base answer on the candidate's actual background and saved preferences
- Use the candidate's saved demographic preferences when answering EEOC questions
- If the question can't be answered from the profile, provide a reasonable professional default
- Avoid saying "not provided" or "not applicable" - be constructive
- Keep response under 100 words

**RESPONSE:**`;

                                const aiResponse = await getAIResponse(unknownTextPrompt, userData);
                                if (aiResponse && aiResponse.trim() &&
                                    !aiResponse.toLowerCase().includes('not applicable') &&
                                    !aiResponse.toLowerCase().includes('unable to') &&
                                    !aiResponse.toLowerCase().includes('not provided') &&
                                    aiResponse.length > 3 && aiResponse.length < 300) {
                                    valueToType = aiResponse.trim();
                                    console.log(`Hired Always: AI provided answer: "${valueToType}"`);
                                } else {
                                    console.log(`Hired Always: AI provided unhelpful answer: "${aiResponse}"`);
                                }
                            } catch (error) {
                                console.warn(`Hired Always: AI request failed for question: "${question}"`, error);
                            }
                        }
                        break;
                    default:
                        // Fallback to old keyword matching for backward compatibility
                        if ((combinedText.includes('first') && combinedText.includes('name')) ||
                            combinedText.includes('firstname') || combinedText.includes('given name')) {
                            valueToType = userData.firstName;
                        }
                        else if ((combinedText.includes('last') && combinedText.includes('name')) ||
                            combinedText.includes('lastname') || combinedText.includes('surname') ||
                            combinedText.includes('family name')) {
                            valueToType = userData.lastName;
                        }
                        // If no match found and we have a good question, use AI
                        else if (question && question.length > 5 && question.includes('?')) {
                            console.log(`Hired Always: Using AI for unclassified field: "${question}"`);
                            try {
                                const isTextArea = elType === 'textarea';
                                const maxWords = isTextArea ? 150 : 40;
                                
                                const fallbackPrompt = `You are helping fill out a job application form. Provide a brief, professional answer based on the candidate's profile.

**CANDIDATE PROFILE:**
- Name: ${userData.firstName || ''} ${userData.lastName || ''}
- Location: ${userData.city || ''} ${userData.state || ''} ${userData.country || ''}
- Work Authorization: ${userData.citizenship || 'Not provided'}
- Visa Sponsorship: ${userData.sponsorship || 'Not provided'}
- Professional Info: ${userData.additionalInfo || 'Not provided'}
- Job Applied For: ${jobTitle || 'Not specified'}

**QUESTION:**
"${question}"

**RESPONSE (keep under ${maxWords} words):**`;

                                const fallbackResponse = await getAIResponse(fallbackPrompt, userData);
                                if (fallbackResponse && fallbackResponse.trim() &&
                                    fallbackResponse.length > 3 && fallbackResponse.length < (isTextArea ? 1000 : 200)) {
                                    valueToType = fallbackResponse.trim();
                                    console.log(`Hired Always: AI fallback answer: "${valueToType}"`);
                                }
                            } catch (error) {
                                console.warn(`Hired Always: AI fallback failed for question: "${question}"`, error);
                            }
                        }
                        break;
                }

                // Special handling for international phone inputs
                if (fieldClassification.type === 'phone' &&
                    (el.classList.contains('iti__tel-input') || el.hasAttribute('data-intl-tel-input-id'))) {
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
                    valueToType = "Immediately"; // Simple default, user can change if needed
                }
                // Salary expectations
                else if (combinedText.includes('salary') || combinedText.includes('compensation') ||
                    combinedText.includes('expected pay') || combinedText.includes('wage')) {
                    valueToType = "Negotiable"; // Simple default, user can change if needed
                }
                // Years of experience (with specific technology or general)
                else if (combinedText.includes('years') && (combinedText.includes('experience') || combinedText.includes('exp') || combinedText.includes('hands on'))) {
                    // Check if question asks about specific technology
                    const techMatch = question.match(/\b(react|vue|angular|node|python|java|javascript|typescript|go|rust|swift|kotlin|c\+\+|\.net|aws|docker|kubernetes)\b/i);

                    // Check if user's additionalInfo mentions years
                    const userYearsMatch = userData.additionalInfo?.match(/(\d+)\+?\s*(?:years?|yrs?)/i);

                    if (userYearsMatch) {
                        // Use the years mentioned in user's profile
                        valueToType = userYearsMatch[1];
                    } else if (techMatch && userData.additionalInfo?.toLowerCase().includes(techMatch[1].toLowerCase())) {
                        // User mentions the tech, estimate conservatively
                        valueToType = "3";
                    } else {
                        // General experience - use default
                        valueToType = "3";
                    }
                }
                // Skills/Technologies
                else if (combinedText.includes('skills') || combinedText.includes('technologies') ||
                    combinedText.includes('expertise') || combinedText.includes('proficienc') ||
                    combinedText.includes('technical background') || combinedText.includes('qualifications')) {
                    // Always use additionalInfo first if available
                    if (userData.additionalInfo && userData.additionalInfo.trim()) {
                        valueToType = userData.additionalInfo.trim();
                    } else {
                        valueToType = await getAIResponse("List my top 5 key skills from my resume in a brief comma-separated format.", userData);
                    }
                }
                // References
                else if (combinedText.includes('reference') && !combinedText.includes('preference')) {
                    valueToType = "Available upon request";
                }
                // Authorization to work
                else if (combinedText.includes('authorized') || combinedText.includes('authorization') ||
                    combinedText.includes('eligible to work') || combinedText.includes('work permit')) {
                    // Use user's saved citizenship preference, default to "Yes" if not set
                    valueToType = userData.citizenship || "Yes";
                    console.log('🏷️ Using saved work authorization:', valueToType);
                }
                // Sponsorship
                else if (combinedText.includes('sponsor') || combinedText.includes('visa')) {
                    // Use user's saved sponsorship preference, default to "No" if not set
                    valueToType = userData.sponsorship || "No";
                    console.log('🏷️ Using saved sponsorship status:', valueToType);
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
                    // Check if user has additionalInfo that can answer this
                    if (userData.additionalInfo && userData.additionalInfo.trim().length > 50) {
                        valueToType = `I am interested because my skills align well with this role. ${userData.additionalInfo.split('.')[0]}.`;
                    } else {
                        const whyPrompt = `Write a brief 1-2 sentence answer: Why am I interested in this ${jobTitle || 'role'}? Use my profile: ${userData.additionalInfo || 'experienced professional'}. Be specific and concise.`;
                        valueToType = await getAIResponse(whyPrompt, userData) || "I am excited about this opportunity because it aligns with my skills and career goals.";
                    }
                }
                // Cover letter (if not handled earlier)
                else if (combinedText.includes('cover letter') && (elType === 'textarea' || el.isContentEditable)) {
                    // Check if user provided a manual cover letter
                    if (userData.coverLetter && userData.coverLetter.trim()) {
                        console.log('✍️ Using manual cover letter provided by user');
                        valueToType = userData.coverLetter.trim();
                    } else {
                        // Generate cover letter with AI
                        console.log('🤖 Generating AI cover letter');
                        const coverLetterPrompt = `You are a professional career writer crafting a cover letter. Create a compelling, ACCURATE cover letter based ONLY on the provided information.

**CRITICAL REQUIREMENTS:**
- Use ONLY information from the resume and user profile - never invent experience or skills
- Tailor the letter specifically to the job title and requirements
- Maintain professional tone and proper business letter format
- Be truthful about qualifications while highlighting strengths
- Keep to 3-4 concise paragraphs

**JOB APPLICATION DETAILS:**
- Position: ${jobTitle || 'Not specified'}
- Job Requirements: ${jobDescription || 'Not available'}
- Candidate Background: ${userData.additionalInfo || 'See resume for details'}

**COVER LETTER STRUCTURE:**
1. Opening: Express interest in the specific position and company
2. Body (1-2 paragraphs): Connect resume experience to job requirements
3. Closing: Reiterate interest and request for interview

**WRITING GUIDELINES:**
- Start with "Dear Hiring Manager," if no specific name available
- Use specific examples from the resume when possible
- Focus on how the candidate can contribute to the company
- End with "Sincerely, [Candidate Name]" or similar professional closing
- NO fictional experiences, skills, or achievements

**COVER LETTER:**`;
                        valueToType = await getAIResponse(coverLetterPrompt, userData);
                    }
                }
                // GitHub/portfolio links
                else if (combinedText.includes('github') || combinedText.includes('gitlab') || combinedText.includes('online portfolio')) {
                    valueToType = userData.portfolioUrl || userData.linkedinUrl;
                }
                // Desired job title
                else if (combinedText.includes('desired') && combinedText.includes('title')) {
                    valueToType = jobTitle || await getAIResponse("Based on my resume, what job title am I best suited for? Provide just the title.", userData);
                }

                if (valueToType) {
                    const success = await simulateTyping(el, valueToType);
                    if (success) {
                        console.log(`✅ Successfully filled field (${fieldClassification.type}): "${valueToType}"`);
                    } else {
                        console.warn(`❌ Failed to fill field (${fieldClassification.type}): "${valueToType}"`);
                    }
                } else {
                    const cleanQuestion = question.replace(/[*:]$/, '').trim();
                    if (cleanQuestion.length > 10 && !isDemographic) {
                        // First, try to use additionalInfo if the question seems general
                        if ((cleanQuestion.toLowerCase().includes('about yourself') ||
                            cleanQuestion.toLowerCase().includes('background') ||
                            cleanQuestion.toLowerCase().includes('experience')) &&
                            userData.additionalInfo && userData.additionalInfo.trim().length > 30) {
                            // Use user's profile directly for general questions
                            await simulateTyping(el, userData.additionalInfo.trim());
                            continue;
                        }

                        // Determine max length - MUCH SHORTER
                        let maxLength = '1 brief sentence';
                        if (elType === 'textarea' || el.isContentEditable) {
                            maxLength = '2-3 sentences maximum';
                        } else if (elType === 'input' && el.type === 'text') {
                            maxLength = 'one short phrase or sentence';
                        }

                        // Enhanced AI prompt with better context
                        const prompt = `You are filling out a job application. Answer this question accurately based on the candidate's resume and profile.

**RESUME & PROFILE:**
${userData.additionalInfo || 'Experienced professional seeking new opportunities'}

**JOB DETAILS:**
- Position: ${jobTitle || 'Not specified'}
- Description: ${jobDescription ? jobDescription.substring(0, 500) : 'Not available'}

**QUESTION TO ANSWER:**
"${cleanQuestion}"

**IMPORTANT INSTRUCTIONS:**
1. Answer in ${maxLength}
2. Be truthful based on the resume/profile provided
3. For yes/no questions, respond with only "Yes" or "No"
4. For work authorization questions, only answer "Yes" if clearly stated in profile
5. For technical skills, only confirm if mentioned in resume
6. Do NOT exaggerate or fabricate information
7. Be direct - no preamble or explanation
8. If unsure, give a conservative answer
9. NEVER say "the question is missing" or ask for clarification - always provide a reasonable answer based on the context
10. If you cannot determine a specific answer, provide a generic professional response relevant to the field

**YOUR ANSWER:**`;
                        let aiAnswer = await getAIResponse(prompt, userData) || "";

                        // Validate AI response - ensure it's not an unhelpful message
                        const unhelpfulPatterns = [
                            /question.*missing/i,
                            /please provide.*question/i,
                            /need more information/i,
                            /cannot answer without/i,
                            /unclear what you're asking/i
                        ];

                        const isUnhelpful = unhelpfulPatterns.some(pattern => pattern.test(aiAnswer));

                        if (!aiAnswer || aiAnswer.trim().length === 0 || isUnhelpful) {
                            // Provide a reasonable fallback based on field context
                            console.warn('AI provided unhelpful response, using fallback for:', cleanQuestion);
                            if (elType === 'textarea' || el.isContentEditable) {
                                aiAnswer = userData.additionalInfo ?
                                    userData.additionalInfo.substring(0, 200) :
                                    "I am a motivated professional with relevant experience and skills that align well with this position.";
                            } else {
                                aiAnswer = "Yes";
                            }
                        }

                        usedAnswers.add(aiAnswer);
                        await simulateTyping(el, aiAnswer);
                    }
                }
            }
        } catch (error) {
            console.error("Hired Always: Error processing element:", el, error);
        }
    }

    // Post-fill verification and retry for empty fields
    console.log("Hired Always: Verifying form completion and retrying empty fields...");

    // Verify filled fields and retry empty ones
    // Reduced to 1 retry to avoid messing up already correct answers
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount < maxRetries) {
        const emptyFields = [];
        const elementsToCheck = discoverFormElements();

        for (const el of elementsToCheck) {
            try {
                const style = window.getComputedStyle(el);
                if (el.disabled || el.readOnly || style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null) {
                    continue;
                }

                const elType = el.tagName.toLowerCase();
                const isButton = elType === 'button' || el.getAttribute('role') === 'button';

                // Skip action buttons
                if (isButton) {
                    const buttonText = el.innerText.toLowerCase().trim();
                    const buttonType = el.type;
                    if (buttonType === 'submit' || buttonType === 'reset' ||
                        buttonText.includes('apply') || buttonText.includes('submit') ||
                        buttonText.includes('upload') || buttonText.includes('attach') ||
                        buttonText.includes('remove') || buttonText.includes('delete') ||
                        buttonText.includes('cross')) {
                        continue;
                    }
                }

                // Check if field is actually empty and needs filling
                let isEmpty = false;
                if (el.type === 'radio' || el.type === 'checkbox') {
                    if (el.name && !document.querySelector(`input[name="${el.name}"]:checked`)) {
                        isEmpty = true;
                    }
                } else if (elType === 'select') {
                    if (el.selectedIndex <= 0 || !el.options[el.selectedIndex]?.value?.trim()) {
                        isEmpty = true;
                    }
                } else if (el.isContentEditable) {
                    if (!el.textContent?.trim()) {
                        isEmpty = true;
                    }
                } else if (elType === 'textarea' || elType === 'input') {
                    if (!el.value?.trim() || (el.placeholder && el.value.trim() === el.placeholder.trim())) {
                        isEmpty = true;
                    }
                } else if (isButton) {
                    const buttonText = el.innerText.toLowerCase().trim();
                    if (!buttonText || buttonText.includes('select') || buttonText.includes('please') || buttonText === 'choose') {
                        isEmpty = true;
                    }
                }

                if (isEmpty) {
                    emptyFields.push(el);
                }
            } catch (error) {
                console.warn("Hired Always: Error checking field:", el, error);
            }
        }

        if (emptyFields.length === 0) {
            console.log("Hired Always: All fields verified as filled!");
            break;
        }

        console.log(`Hired Always: Found ${emptyFields.length} empty fields, retry attempt ${retryCount + 1}/${maxRetries}`);

        // Retry filling empty fields
        for (const el of emptyFields.slice(0, 10)) { // Limit to first 10 empty fields per retry
            try {
                console.log("Hired Always: Retrying empty field:", el);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 100));

                const question = findQuestionForInput(el);
                const combinedText = `${el.id} ${el.name} ${question}`.toLowerCase();
                const fieldClassification = classifyFieldType(el, question, combinedText);

                // Try to fill the field based on its classification with comprehensive data mapping
                let retryValue = null;

                switch (fieldClassification.type) {
                    case 'firstName':
                        retryValue = userData.firstName;
                        break;
                    case 'lastName':
                        retryValue = userData.lastName;
                        break;
                    case 'fullName':
                        retryValue = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                        break;
                    case 'email':
                        retryValue = userData.email;
                        break;
                    case 'phone':
                        retryValue = userData.phone;
                        break;
                    case 'pronouns':
                        retryValue = userData.pronouns;
                        break;
                    case 'address':
                        retryValue = userData.address;
                        break;
                    case 'city':
                        retryValue = userData.city;
                        break;
                    case 'state':
                        retryValue = userData.state;
                        break;
                    case 'zipCode':
                        retryValue = userData.zipCode;
                        break;
                    case 'country':
                        retryValue = userData.country;
                        break;
                    case 'linkedinUrl':
                        retryValue = userData.linkedinUrl;
                        break;
                    case 'portfolioUrl':
                        retryValue = userData.portfolioUrl;
                        break;
                    case 'website':
                        retryValue = userData.portfolioUrl;
                        break;
                    case 'additionalInfo':
                        retryValue = userData.additionalInfo;
                        break;
                    case 'coverLetter':
                        retryValue = userData.coverLetter;
                        break;
                    case 'summary':
                        retryValue = userData.additionalInfo;
                        break;
                    case 'citizenship':
                        retryValue = userData.citizenship;
                        break;
                    case 'workAuthorization':
                        retryValue = userData.citizenship;
                        break;
                    case 'sponsorship':
                        retryValue = userData.sponsorship;
                        break;
                    case 'gender':
                        retryValue = userData.gender;
                        break;
                    case 'race':
                        retryValue = userData.race;
                        break;
                    case 'veteran':
                        retryValue = userData.veteran;
                        break;
                    case 'disability':
                        retryValue = userData.disability;
                        break;
                    case 'hispanic':
                        retryValue = userData.hispanic;
                        break;
                    default:
                        // Use AI for unknown fields during retry
                        if (question && question.length > 3) {
                            console.log(`Hired Always: Using AI for retry field: "${question}"`);
                            try {
                                const aiPrompt = `You are helping fill out a job application form. Based on the candidate's background, provide a brief, professional answer to this question.

**Candidate Background:**
- Name: ${userData.firstName || ''} ${userData.lastName || ''}
- Email: ${userData.email || 'Not provided'}
- Location: ${userData.city || ''} ${userData.state || ''}
- Work Authorization: ${userData.citizenship || 'Not provided'}
- Visa Sponsorship: ${userData.sponsorship || 'Not provided'}
- Gender: ${userData.gender || 'Not provided'}
- Race/Ethnicity: ${userData.race || 'Not provided'}
- Veteran Status: ${userData.veteran || 'Not provided'}
- Disability Status: ${userData.disability || 'Not provided'}
- Hispanic/Latino: ${userData.hispanic || 'Not provided'}
- Additional Info: ${userData.additionalInfo || 'Not provided'}

**Question to Answer:**
"${question}"

**Requirements:**
- Keep answer concise (1-3 sentences max)
- Be professional and truthful
- Use the candidate's saved preferences when answering demographic questions
- If uncertain, provide a reasonable professional response
- Don't make up specific details not in the background

**Response:**`;
                                const aiResponse = await getAIResponse(aiPrompt, userData);
                                if (aiResponse && aiResponse.trim() && aiResponse.length > 3 && aiResponse.length < 200) {
                                    retryValue = aiResponse.trim();
                                    console.log(`Hired Always: AI provided retry answer: "${retryValue}"`);
                                }
                            } catch (error) {
                                console.warn(`Hired Always: AI retry failed for question: "${question}"`, error);
                            }
                        }
                        break;
                }

                if (retryValue && retryValue.trim()) {
                    await simulateTyping(el, retryValue);
                }

            } catch (error) {
                console.warn("Hired Always: Error retrying field:", el, error);
            }
        }

        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before next verification
    }

    console.log("Hired Always: Process finished.");
}

// Helper function to read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);

        if (file.name.endsWith('.txt')) {
            reader.readAsText(file);
        } else if (file.name.endsWith('.pdf')) {
            // For PDF, we read as ArrayBuffer and try to extract text
            reader.readAsArrayBuffer(file);
            reader.onload = (e) => {
                const text = extractTextFromPDF(e.target.result);
                resolve(text);
            };
        } else if (file.name.endsWith('.docx')) {
            // For DOCX, read as ArrayBuffer and extract text
            reader.readAsArrayBuffer(file);
            reader.onload = (e) => {
                const text = extractTextFromDOCX(e.target.result);
                resolve(text);
            };
        } else {
            reader.readAsText(file);
        }
    });
}

// Extract text from PDF (basic extraction)
function extractTextFromPDF(arrayBuffer) {
    try {
        const uint8Array = new Uint8Array(arrayBuffer);
        let text = '';

        // Convert to string and look for text between BT and ET markers
        const pdfString = String.fromCharCode.apply(null, uint8Array);

        // Look for text streams
        const textMatches = pdfString.match(/\(([^)]+)\)/g);
        if (textMatches) {
            text = textMatches.map(m => m.slice(1, -1)).join(' ');
        }

        // Also try to find plain text sections
        const plainText = pdfString.match(/[\x20-\x7E]{4,}/g);
        if (plainText) {
            text += ' ' + plainText.join(' ');
        }

        return cleanExtractedText(text);
    } catch (e) {
        console.warn('PDF extraction error:', e);
        return '';
    }
}

// Extract text from DOCX (basic extraction)
function extractTextFromDOCX(arrayBuffer) {
    try {
        const uint8Array = new Uint8Array(arrayBuffer);
        const text = String.fromCharCode.apply(null, uint8Array);

        // DOCX is a ZIP file containing XML, try to extract text from document.xml
        // Look for text between <w:t> tags
        const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
        if (matches) {
            return cleanExtractedText(matches.map(m => m.replace(/<[^>]+>/g, '')).join(' '));
        }

        // Fallback: extract readable ASCII
        const plainText = text.match(/[\x20-\x7E]{4,}/g);
        return cleanExtractedText(plainText ? plainText.join(' ') : '');
    } catch (e) {
        console.warn('DOCX extraction error:', e);
        return '';
    }
}

// Extract text from base64 encoded content
function extractTextFromBase64(base64) {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Try to extract readable text
        let text = '';
        const str = String.fromCharCode.apply(null, bytes);

        // Extract text from PDF-like content
        const textMatches = str.match(/\(([^)]+)\)/g);
        if (textMatches) {
            text += textMatches.map(m => m.slice(1, -1)).join(' ');
        }

        // Extract XML text content (for DOCX)
        const xmlMatches = str.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
        if (xmlMatches) {
            text += ' ' + xmlMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
        }

        // Extract plain readable text
        const plainText = str.match(/[\x20-\x7E]{4,}/g);
        if (plainText) {
            text += ' ' + plainText.join(' ');
        }

        return cleanExtractedText(text);
    } catch (e) {
        console.warn('Base64 extraction error:', e);
        return '';
    }
}

// Clean extracted text
function cleanExtractedText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
}

// Parse resume content and extract structured data
function parseResumeContent(text) {
    const result = {};

    // Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
        result.email = emailMatch[0].toLowerCase();
    }

    // Extract phone number
    const phonePatterns = [
        /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        /\d{3}[-.\s]\d{3}[-.\s]\d{4}/
    ];
    for (const pattern of phonePatterns) {
        const phoneMatch = text.match(pattern);
        if (phoneMatch) {
            result.phone = phoneMatch[0].replace(/[^\d+()-\s]/g, '').trim();
            break;
        }
    }

    // Extract LinkedIn URL
    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);
    if (linkedinMatch) {
        let url = linkedinMatch[0];
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        result.linkedinUrl = url;
    }

    // Extract portfolio/website URL
    const urlPatterns = [
        /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i,
        /(?:https?:\/\/)?[a-zA-Z0-9-]+\.(?:com|io|dev|me|co|org)(?:\/[a-zA-Z0-9_/-]*)?/i
    ];
    for (const pattern of urlPatterns) {
        const urlMatch = text.match(pattern);
        if (urlMatch && !urlMatch[0].includes('linkedin.com') && !urlMatch[0].includes('google.com')) {
            let url = urlMatch[0];
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            result.portfolioUrl = url;
            break;
        }
    }

    // Extract name (usually at the beginning)
    const lines = text.split(/[\n\r]+/).filter(l => l.trim());
    if (lines.length > 0) {
        // First non-empty line is often the name
        const firstLine = lines[0].trim();
        // Check if it looks like a name (2-4 words, no numbers, not too long)
        const nameMatch = firstLine.match(/^([A-Z][a-zA-Z]+)\s+([A-Z][a-zA-Z]+)(?:\s+([A-Z][a-zA-Z]+))?$/);
        if (nameMatch && firstLine.length < 50 && !/\d/.test(firstLine)) {
            result.firstName = nameMatch[1];
            result.lastName = nameMatch[nameMatch[3] ? 3 : 2];
        } else {
            // Try to find a name-like pattern anywhere in the first few lines
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i].trim();
                const namePattern = line.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)$/);
                if (namePattern && line.length < 40) {
                    result.firstName = namePattern[1];
                    result.lastName = namePattern[2];
                    break;
                }
            }
        }
    }

    // Extract address components
    // Look for city, state zip pattern
    const addressMatch = text.match(/([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
    if (addressMatch) {
        result.city = addressMatch[1].trim();
        result.state = addressMatch[2];
        result.zipCode = addressMatch[3];
    }

    // Extract skills (look for common skill keywords or a skills section)
    const skillKeywords = [
        'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'TypeScript',
        'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Flask', 'Spring', 'Rails',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'SQL', 'MongoDB',
        'HTML', 'CSS', 'REST', 'GraphQL', 'Agile', 'Scrum', 'Machine Learning', 'AI',
        'Data Science', 'Project Management', 'Leadership', 'Communication'
    ];

    const foundSkills = [];
    const lowerText = text.toLowerCase();
    for (const skill of skillKeywords) {
        if (lowerText.includes(skill.toLowerCase())) {
            foundSkills.push(skill);
        }
    }

    if (foundSkills.length > 0) {
        result.skills = foundSkills.slice(0, 15).join(', ');
    }

    return result;
}


