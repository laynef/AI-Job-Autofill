// This top-level try...catch block prevents the entire script from failing if an unexpected error occurs during setup.
try {
    document.addEventListener('DOMContentLoaded', function() {
        const statusEl = document.getElementById('status');
        const resumeFileNameEl = document.getElementById('resumeFileName');
        const resumeFileInput = document.getElementById('resumeFile');
        const textFields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', 'address', 'city', 'state', 'zipCode', 'country', 'linkedinUrl', 'portfolioUrl', 'apiKey', 'additionalInfo', 'gender', 'race', 'veteranStatus', 'disabilityStatus'];

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
                chrome.tabs.sendMessage(tabs[0].id, {type: "AUTOFILL_NOW"}, function(response) {
                    if (chrome.runtime.lastError) {
                        statusEl.textContent = 'Autofill failed on this page.';
                        console.error('Autofill message failed:', chrome.runtime.lastError.message);
                        setTimeout(() => statusEl.textContent = '', 3000);
                    } else {
                        statusEl.textContent = 'Autofill complete!';
                        setTimeout(() => statusEl.textContent = '', 3000);
                    }
                });
            });
        });
    });
} catch (e) {
    console.error("A fatal error occurred in popup.js:", e);
}