// Form Handler Module
// Handles saving and loading form data

const FormHandler = {
    /**
     * Text fields to save/load
     */
    TEXT_FIELDS: [
        'firstName', 'lastName', 'email', 'phone', 'pronouns',
        'address', 'city', 'state', 'zipCode', 'country',
        'linkedinUrl', 'portfolioUrl', 'additionalInfo', 'coverLetter',
        'gender', 'hispanic', 'race', 'veteran', 'disability',
        'citizenship', 'sponsorship'
    ],

    /**
     * Load all saved data from storage
     * @returns {Promise<Object>} Saved data
     */
    async loadSavedData() {
        try {
            const keys = [...this.TEXT_FIELDS, 'resumeFileName', 'resume'];
            return await StorageUtils.get(keys);
        } catch (error) {
            console.error('Error loading saved data:', error);
            return {};
        }
    },

    /**
     * Populate form fields with saved data
     * @param {Object} data - Saved data
     */
    populateFormFields(data) {
        this.TEXT_FIELDS.forEach(field => {
            const element = document.getElementById(field);
            if (element && data[field]) {
                element.value = data[field];
            }
        });

        // Update resume file name display
        const resumeFileNameEl = document.getElementById('resumeFileName');
        if (data.resumeFileName && resumeFileNameEl) {
            resumeFileNameEl.textContent = `Saved file: ${data.resumeFileName}`;
        }
    },

    /**
     * Collect data from form fields
     * @returns {Object} Form data
     */
    collectFormData() {
        const data = {};
        this.TEXT_FIELDS.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                data[field] = DataUtils.safeTrim(element.value);
            }
        });
        return data;
    },

    /**
     * Validate form data
     * @param {Object} data - Form data to validate
     * @returns {Object} Validation result {valid: boolean, errors: Array}
     */
    validateFormData(data) {
        const errors = [];

        // Validate email
        if (data.email && !DataUtils.isValidEmail(data.email)) {
            errors.push('Invalid email address format');
        }

        // Validate required fields
        if (!data.firstName || data.firstName.length < 1) {
            errors.push('First name is required');
        }

        if (!data.lastName || data.lastName.length < 1) {
            errors.push('Last name is required');
        }

        // Validate phone (if provided)
        if (data.phone && !this.isValidPhone(data.phone)) {
            errors.push('Invalid phone number format');
        }

        // Validate URLs (if provided)
        if (data.linkedinUrl && !this.isValidURL(data.linkedinUrl)) {
            errors.push('Invalid LinkedIn URL');
        }

        if (data.portfolioUrl && !this.isValidURL(data.portfolioUrl)) {
            errors.push('Invalid portfolio URL');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Validate phone number format
     * @param {string} phone - Phone number
     * @returns {boolean} True if valid
     */
    isValidPhone(phone) {
        // Accept various phone formats
        const phoneRegex = /^[\d\s\-\(\)\+]{10,}$/;
        return phoneRegex.test(phone);
    },

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Save form data to storage
     * @param {Object} data - Data to save
     * @param {File|null} resumeFile - Resume file if provided
     * @returns {Promise<Object>} Save result {success: boolean, message: string}
     */
    async saveFormData(data, resumeFile = null) {
        try {
            // Validate data first
            const validation = this.validateFormData(data);
            if (!validation.valid) {
                return {
                    success: false,
                    message: validation.errors.join(', ')
                };
            }

            // If there's a new resume file, convert it to base64
            if (resumeFile) {
                const resumeData = await this.processResumeFile(resumeFile);
                data.resume = resumeData.base64;
                data.resumeFileName = resumeFile.name;
            } else {
                // Preserve existing resume
                const existing = await StorageUtils.get(['resume', 'resumeFileName']);
                if (existing.resume) data.resume = existing.resume;
                if (existing.resumeFileName) data.resumeFileName = existing.resumeFileName;
            }

            // Save to storage
            await StorageUtils.set(data);

            return {
                success: true,
                message: 'Information saved successfully!'
            };
        } catch (error) {
            console.error('Error saving form data:', error);
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    },

    /**
     * Process resume file and convert to base64
     * @param {File} file - Resume file
     * @returns {Promise<Object>} {base64: string, fileName: string}
     */
    async processResumeFile(file) {
        return new Promise((resolve, reject) => {
            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                reject(new Error('File size must be less than 10MB'));
                return;
            }

            // Validate file type
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allowedTypes.includes(file.type)) {
                reject(new Error('Only PDF and Word documents are allowed'));
                return;
            }

            const reader = new FileReader();

            reader.onload = function(e) {
                resolve({
                    base64: e.target.result,
                    fileName: file.name
                });
            };

            reader.onerror = function(err) {
                reject(new Error('Error reading file'));
            };

            reader.readAsDataURL(file);
        });
    },

    /**
     * Setup file input change handler
     * @param {HTMLInputElement} fileInput - File input element
     * @param {HTMLElement} displayElement - Element to show file name
     */
    setupFileInputHandler(fileInput, displayElement) {
        if (!fileInput || !displayElement) return;

        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                displayElement.textContent = `Selected: ${file.name} (click Save)`;
                displayElement.style.color = '#D97706';

                // Show file size
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                displayElement.title = `Size: ${sizeMB} MB`;
            }
        });
    },

    /**
     * Clear all form data
     * @returns {Promise<boolean>} Success status
     */
    async clearAllData() {
        try {
            const keysToRemove = [...this.TEXT_FIELDS, 'resumeFileName', 'resume'];
            await StorageUtils.remove(keysToRemove);
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    },

    /**
     * Export form data as JSON
     * @returns {Promise<string>} JSON string
     */
    async exportData() {
        try {
            const data = await this.loadSavedData();
            // Don't include base64 resume in export (too large)
            delete data.resume;
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            return null;
        }
    },

    /**
     * Import form data from JSON
     * @param {string} jsonString - JSON data string
     * @returns {Promise<Object>} Import result
     */
    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // Validate imported data
            const validation = this.validateFormData(data);
            if (!validation.valid) {
                return {
                    success: false,
                    message: 'Invalid data format: ' + validation.errors.join(', ')
                };
            }

            // Don't override existing resume
            delete data.resume;
            delete data.resumeFileName;

            await StorageUtils.set(data);

            return {
                success: true,
                message: 'Data imported successfully!'
            };
        } catch (error) {
            console.error('Error importing data:', error);
            return {
                success: false,
                message: 'Invalid JSON format'
            };
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FormHandler };
}
