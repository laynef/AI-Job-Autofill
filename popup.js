// Subscription verification for ad-free experience
function validateSubscriptionKey(key) {
    return key && key.startsWith('HA-') && key.length >= 23;
}

function isSubscriptionExpired(activationDate) {
    if (!activationDate) return true;
    const daysSinceActivation = (Date.now() - new Date(activationDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActivation > 31;
}

function checkSubscription() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['subscriptionKey', 'subscriptionActive', 'subscriptionStartDate'], function(result) {
            // If user has active subscription, they get ad-free experience
            if (result.subscriptionActive && result.subscriptionKey && validateSubscriptionKey(result.subscriptionKey)) {
                // Check if subscription expired
                if (isSubscriptionExpired(result.subscriptionStartDate)) {
                    resolve({
                        valid: true, // App is always free to use
                        isPaid: false, // Expired subscription means ads shown
                        expired: true,
                        startDate: result.subscriptionStartDate
                    });
                    return;
                }

                resolve({
                    valid: true,
                    isPaid: true, // Active subscription = ad-free
                    startDate: result.subscriptionStartDate
                });
                return;
            }

            // Free user with ads
            resolve({
                valid: true, // App is always free to use
                isPaid: false, // Free users see ads
                isFree: true
            });
        });
    });
}

// Show or hide ads based on subscription status
function manageAdVisibility(isPaid) {
    const adContainers = document.querySelectorAll('.ad-container');
    adContainers.forEach(container => {
        if (isPaid) {
            container.style.display = 'none'; // Hide ads for subscribers
        } else {
            container.style.display = 'block'; // Show ads for free users
        }
    });
}

function showLicenseModal() {
    document.getElementById('licenseModal').style.display = 'block';
}

function hideLicenseModal() {
    document.getElementById('licenseModal').style.display = 'none';
}

window.deactivateLicense = function() {
    if (confirm('Are you sure you want to deactivate your license? You will need to re-enter it to use Hired Always.')) {
        chrome.storage.local.set({ licenseActivated: false }, function() {
            location.reload();
        });
    }
};

// This top-level try...catch block prevents the entire script from failing if an unexpected error occurs during setup.
try {
    document.addEventListener('DOMContentLoaded', async function() {
        const statusEl = document.getElementById('status');
        const resumeFileNameEl = document.getElementById('resumeFileName');
        const resumeFileInput = document.getElementById('resumeFile');
        const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'additionalInfo', 'coverLetter', 'gender', 'hispanic', 'race', 'veteran', 'disability'];

        // Check subscription on load
        const subscriptionStatus = await checkSubscription();
        const licenseInfoEl = document.getElementById('licenseInfo');
        const autofillBtn = document.getElementById('autofill');

        // Manage ad visibility based on subscription
        manageAdVisibility(subscriptionStatus.isPaid);

        // Update UI based on subscription status
        licenseInfoEl.style.display = 'block';
        if (subscriptionStatus.isPaid) {
            // Paid subscriber - ad-free
            licenseInfoEl.style.color = '#10b981';
            licenseInfoEl.innerHTML = '✓ Ad-Free Subscription Active';
            const daysLeft = 31 - Math.floor((Date.now() - new Date(subscriptionStatus.startDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7) {
                licenseInfoEl.innerHTML = `✓ Ad-Free (${daysLeft} days left)`;
            }
        } else if (subscriptionStatus.expired) {
            licenseInfoEl.style.color = '#f59e0b';
            licenseInfoEl.innerHTML = 'Subscription Expired - <a href="https://hiredalways.com/purchase.html" target="_blank" style="text-decoration:underline">Remove Ads for $9.99/mo</a>';
        } else {
            // Free user with ads
            licenseInfoEl.style.color = '#3b82f6';
            licenseInfoEl.innerHTML = 'Free Version - <a href="https://hiredalways.com/purchase.html" target="_blank" style="text-decoration:underline">Remove Ads for $9.99/mo</a>';
        }

        // Subscription activation
        document.getElementById('activateLicense').addEventListener('click', function() {
            const subscriptionKey = document.getElementById('licenseKeyInput').value.trim();
            const errorDiv = document.getElementById('licenseError');
            const statusDiv = document.getElementById('licenseStatus');

            if (!validateSubscriptionKey(subscriptionKey)) {
                errorDiv.textContent = 'Invalid subscription key format. Keys start with "HA-" or "HA-SUB-".';
                errorDiv.style.display = 'block';
                return;
            }

            chrome.storage.local.set({
                subscriptionKey: subscriptionKey,
                subscriptionActive: true,
                subscriptionStartDate: new Date().toISOString()
            }, function() {
                errorDiv.style.display = 'none';
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#d1fae5';
                statusDiv.style.color = '#065f46';
                statusDiv.innerHTML = '✓ Subscription activated! Ads removed for 31 days.';

                setTimeout(() => {
                    hideLicenseModal();
                    location.reload(); // Reload to hide ads
                }, 1500);
            });
        });

        // Manage Subscription button
        document.getElementById('manageLicense').addEventListener('click', function() {
            chrome.storage.local.get(['subscriptionKey', 'subscriptionActive', 'subscriptionStartDate'], function(result) {
                const modal = document.getElementById('licenseModal');
                const statusDiv = document.getElementById('licenseStatus');
                const errorDiv = document.getElementById('licenseError');

                showLicenseModal();
                errorDiv.style.display = 'none';

                if (result.subscriptionActive) {
                    const daysLeft = 31 - Math.floor((Date.now() - new Date(result.subscriptionStartDate).getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = daysLeft < 0;

                    statusDiv.style.display = 'block';
                    statusDiv.style.background = isExpired ? '#fee2e2' : '#d1fae5';
                    statusDiv.style.color = isExpired ? '#991b1b' : '#065f46';
                    statusDiv.innerHTML = `
                        ${isExpired ? '⚠️ Subscription Expired' : '✓ Subscription Active'}<br>
                        <strong>Key:</strong> ${result.subscriptionKey}<br>
                        <strong>Days Left:</strong> ${Math.max(0, daysLeft)} days<br>
                        <strong>Started:</strong> ${new Date(result.subscriptionStartDate).toLocaleDateString()}<br>
                        ${isExpired ? '<a href="https://hiredalways.com/purchase.html" target="_blank" style="color: #991b1b; text-decoration: underline;">Renew Subscription</a><br>' : ''}
                        <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" style="color: #065f46; text-decoration: underline;">Manage in PayPal</a><br>
                        <button onclick="deactivateLicense()" style="margin-top: 0.5rem; background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">Deactivate</button>
                    `;
                }
            });
        });

        // Close modal when clicking outside
        document.getElementById('licenseModal').addEventListener('click', function(e) {
            if (e.target.id === 'licenseModal') {
                hideLicenseModal();
            }
        });

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
        document.getElementById('autofill').addEventListener('click', async function() {
            // App is free for everyone - no restrictions
            statusEl.textContent = 'Autofilling...';
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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
                        target: {tabId: tabs[0].id},
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
                        chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id, allFrames: true},
                            function: autofillPage,
                        }).then(() => {
                             console.log('✓ Autofill script executed successfully');
                             statusEl.textContent = 'Autofill complete! Saving to tracker...';

                             // Save application to tracker AFTER autofilling completes
                             // Increased delay to 3000ms to ensure form fields are fully populated and dynamic content loads
                             setTimeout(() => {
                                 console.log('⏰ Starting tracker save (after 3s delay)...');
                                 saveCurrentApplicationToTracker(tabs[0], statusEl);
                             }, 3000);
                        }).catch(err => {
                             statusEl.textContent = 'Autofill failed on this page.';
                             console.error('❌ Autofill script injection failed:', err);
                             setTimeout(() => statusEl.textContent = '', 3000);
                        });
                    }).catch(err => {
                        console.error('Iframe detection failed:', err);
                        statusEl.textContent = 'Could not analyze page structure.';
                        setTimeout(() => statusEl.textContent = '', 3000);
                    });
                } else {
                    // Already on ATS domain, skip iframe detection and proceed with autofill
                    console.log('Already on ATS domain, proceeding with direct autofill');
                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id, allFrames: true},
                        function: autofillPage,
                    }).then(() => {
                         console.log('✓ Autofill script executed successfully');
                         statusEl.textContent = 'Autofill complete! Saving to tracker...';

                         // Save application to tracker AFTER autofilling completes
                         // Increased delay to 3000ms to ensure form fields are fully populated and dynamic content loads
                         setTimeout(() => {
                             console.log('⏰ Starting tracker save (after 3s delay)...');
                             saveCurrentApplicationToTracker(tabs[0], statusEl);
                         }, 3000);
                    }).catch(err => {
                         statusEl.textContent = 'Autofill failed on this page.';
                         console.error('❌ Autofill script injection failed:', err);
                         setTimeout(() => statusEl.textContent = '', 3000);
                    });
                }
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
function saveCurrentApplicationToTracker(tab, statusEl) {
    try {
        console.log('🔄 Starting tracker save process...');
        console.log('   Tab ID:', tab.id);
        console.log('   Tab URL:', tab.url);

        // Extract company and job title from page (async function)
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
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

            chrome.storage.local.get(['jobApplications'], function(result) {
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

                            chrome.storage.local.set({ jobApplications: applications }, function() {
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
                            chrome.storage.local.set({ jobApplications: applications }, function() {
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
            chrome.storage.local.get(['jobApplications'], function(result) {
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

    // Extract company name with enhanced selectors
    let company = '';

    // NEW: First try to extract from filled form fields (since autofill just ran)
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
                if (value && value.trim().length > 2 && value.trim().length < 100) {
                    company = value.trim();
                    console.log('Company extracted from form field:', company);
                    break;
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }

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
    console.log("Hired Always: Starting process...");

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
            console.log(`🔍 Attempting to select dropdown option: "${optionText}"`);
            console.log(`   Element:`, inputElement);

            // Click to open dropdown
            inputElement.focus();
            await simulateClick(inputElement);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Find the listbox or menu - try multiple strategies
            const ariaControls = inputElement.getAttribute('aria-controls');
            let listbox = null;

            // Strategy 1: Use aria-controls
            if (ariaControls) {
                listbox = document.getElementById(ariaControls);
                if (listbox) console.log(`   ✓ Found listbox via aria-controls: #${ariaControls}`);
            }

            // Strategy 2: Look for visible listbox/menu
            if (!listbox) {
                listbox = document.querySelector('[role="listbox"]:not(.iti__hide):not([style*="display: none"]):not([style*="display:none"])');
                if (listbox) console.log(`   ✓ Found listbox via role="listbox"`);
            }

            // Strategy 3: Look for menu (Material-UI style)
            if (!listbox) {
                listbox = document.querySelector('[role="menu"]:not([style*="display: none"]):not([style*="display:none"])');
                if (listbox) console.log(`   ✓ Found menu via role="menu"`);
            }

            // Strategy 4: Look for any visible dropdown container
            if (!listbox) {
                const visibleDropdowns = Array.from(document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="options"], [class*="list"]'))
                    .filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                    });
                if (visibleDropdowns.length > 0) {
                    listbox = visibleDropdowns[0];
                    console.log(`   ✓ Found dropdown container via class name`);
                }
            }

            if (listbox) {
                console.log(`   Searching for options in listbox...`);
                const options = Array.from(listbox.querySelectorAll('[role="option"], [role="menuitem"], li, div[class*="option"]'));
                console.log(`   Found ${options.length} potential options`);

                if (options.length > 0) {
                    // Log all available options for debugging
                    console.log(`   Available options:`, options.map(opt => opt.innerText.trim()).join(', '));
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
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await simulateClick(targetOption);
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Verify selection was successful
                    const selectedValue = inputElement.value || inputElement.getAttribute('aria-activedescendant') || inputElement.innerText;
                    if (selectedValue && selectedValue !== 'Please select' && selectedValue !== 'Select...') {
                        console.log(`   ✓ Selection successful! Value: "${selectedValue}"`);
                        return true;
                    } else {
                        console.warn(`   ⚠ Selection may have failed. Current value: "${selectedValue}"`);
                    }
                } else {
                    console.warn(`   ✗ Could not find matching option for: "${optionText}"`);
                }
            } else {
                console.warn(`   ✗ Could not find dropdown menu for element`, inputElement);
            }

            // Close dropdown by clicking away
            await simulateClick(document.body);
            await new Promise(resolve => setTimeout(resolve, 200));
            return false;
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
                    selectElement.value = matchingOption.value;
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`   ✓ Selected: "${matchingOption.text}"`);
                    return true;
                } else {
                    console.warn(`   ✗ Could not find matching option for: "${optionText}"`);
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
            } catch (e) {}
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

        // Personal Information
        if (combinedText.includes('first') && combinedText.includes('name')) {
            classifications.push({ type: 'firstName', confidence: 0.95, keywords: ['first', 'name'] });
        }
        if (combinedText.includes('last') && combinedText.includes('name')) {
            classifications.push({ type: 'lastName', confidence: 0.95, keywords: ['last', 'name'] });
        }
        if (combinedText.match(/\b(full|legal)\s*name\b/i)) {
            classifications.push({ type: 'fullName', confidence: 0.9, keywords: ['full', 'name'] });
        }
        if (combinedText.match(/\b(email|e-mail)\b/i)) {
            classifications.push({ type: 'email', confidence: 0.95, keywords: ['email'] });
        }
        if (combinedText.match(/\b(phone|mobile|telephone|contact.*number)\b/i)) {
            classifications.push({ type: 'phone', confidence: 0.9, keywords: ['phone'] });
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
        if (combinedText.match(/\b(authorized|authorization|eligible.*work|work.*permit)\b/i)) {
            classifications.push({ type: 'workAuthorization', confidence: 0.9, keywords: ['authorized'] });
        }
        if (combinedText.match(/\b(sponsor|visa)\b/i)) {
            classifications.push({ type: 'sponsorship', confidence: 0.9, keywords: ['sponsor'] });
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

        // Unclassified - will need AI
        if (classifications.length === 0) {
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
    } catch(e) { console.error("Hired Always: Could not parse page context:", e); }

    const userData = await new Promise(resolve => {
        const fields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'resume', 'resumeFileName', 'additionalInfo'];
        chrome.storage.local.get(fields, (result) => {
            if (chrome.runtime.lastError) {
                console.error("Hired Always: Error getting user data from storage.");
                resolve({});
            } else {
                resolve(result);
            }
        });
    });

    if (!Object.keys(userData).length) {
        console.error("Hired Always: Could not load user data. Aborting.");
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
    } catch(e) { console.error("Hired Always: Could not parse work history from resume.", e); }

    const educationPrompt = "Analyze the attached resume and extract education history. Return a JSON array where each object has 'degree', 'school', 'fieldOfStudy', 'startDate', 'endDate', and 'gpa' keys. If GPA is not mentioned, use an empty string.";
    let educationHistory = [];
    try {
        const educationJson = await getAIResponse(educationPrompt, userData);
        if (educationJson) {
            const cleanedJson = educationJson.replace(/```json/g, '').replace(/```/g, '').trim();
            educationHistory = JSON.parse(cleanedJson);
        }
    } catch(e) { console.error("Hired Always: Could not parse education from resume.", e); }

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
            '[class*="textarea"]'
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

    const allElements = discoverFormElements();
    console.log(`Hired Always: Discovered ${allElements.length} form elements`);
    console.log('Hired Always: Element types found:', allElements.map(el => `${el.tagName.toLowerCase()}[${el.type || el.getAttribute('role') || 'no-type'}]`).join(', '));

    for (const el of allElements) {
        try {
            const style = window.getComputedStyle(el);
            if (el.disabled || el.readOnly || style.display === 'none' || style.visibility === 'hidden' || el.closest('[style*="display: none"]')) {
                console.log(`Hired Always: Skipping disabled/hidden element:`, el);
                continue;
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
            } else if (elType === 'textarea') {
                // Check if textarea has content
                if (el.value && el.value.trim() && el.value.trim().length > 0) {
                    // Make sure it's not just the placeholder
                    if (!el.placeholder || el.value.trim() !== el.placeholder.trim()) {
                        isFilled = true;
                    }
                }
            } else if (elType === 'button') {
                // Check if button-based dropdown has been filled (doesn't contain "select" or "please")
                const buttonText = el.innerText.toLowerCase().trim();
                if (buttonText && !buttonText.includes('select') && !buttonText.includes('please') && buttonText.length > 0) {
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
                console.log("Hired Always: Skipping already filled element:", el);
                continue;
            }

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

                // Handle race/ethnicity dropdown
                if (combinedText.includes('race') || combinedText.includes('ethnicity')) {
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
                     await simulateTyping(el, valueToType);
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
    console.log("Hired Always: Process finished.");
}

