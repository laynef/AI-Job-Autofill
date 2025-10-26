// Shared Utilities Module
// This module contains common functions used across the extension to eliminate code duplication

// Constants
const CONSTANTS = {
    SUBSCRIPTION: {
        PREFIX: 'HA-',
        MIN_LENGTH: 23,
        DURATION_DAYS: 31,
        RENEWAL_WARNING_DAYS: 7
    },
    STORAGE_KEYS: {
        SUBSCRIPTION_KEY: 'subscriptionKey',
        SUBSCRIPTION_ACTIVE: 'subscriptionActive',
        SUBSCRIPTION_START_DATE: 'subscriptionStartDate',
        JOB_APPLICATIONS: 'jobApplications',
        USAGE_COUNT: 'usageCount',
        HAS_RATED: 'hasRated',
        RATING_DISMISSED: 'ratingDismissed'
    },
    JOB_STATUS: {
        APPLIED: 'Applied',
        SCREENING: 'Screening',
        INTERVIEW: 'Interview',
        TECHNICAL: 'Technical',
        FINAL: 'Final',
        OFFER: 'Offer',
        REJECTED: 'Rejected',
        WITHDRAWN: 'Withdrawn'
    }
};

// Subscription Management
const SubscriptionManager = {
    /**
     * Validates subscription key format
     * @param {string} key - The subscription key to validate
     * @returns {boolean} True if valid format
     */
    validateKey(key) {
        return key &&
               key.startsWith(CONSTANTS.SUBSCRIPTION.PREFIX) &&
               key.length >= CONSTANTS.SUBSCRIPTION.MIN_LENGTH;
    },

    /**
     * Checks if subscription has expired
     * @param {string} activationDate - ISO date string
     * @returns {boolean} True if expired
     */
    isExpired(activationDate) {
        if (!activationDate) return true;
        const daysSinceActivation = (Date.now() - new Date(activationDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceActivation > CONSTANTS.SUBSCRIPTION.DURATION_DAYS;
    },

    /**
     * Gets days remaining in subscription
     * @param {string} startDate - ISO date string
     * @returns {number} Days remaining (negative if expired)
     */
    getDaysRemaining(startDate) {
        if (!startDate) return 0;
        const daysSinceStart = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
        return CONSTANTS.SUBSCRIPTION.DURATION_DAYS - daysSinceStart;
    },

    /**
     * Checks subscription status
     * @returns {Promise<Object>} Subscription status object
     */
    async checkStatus() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_KEY,
                CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_ACTIVE,
                CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_START_DATE
            ], (result) => {
                if (result[CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_ACTIVE] &&
                    result[CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_KEY] &&
                    this.validateKey(result[CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_KEY])) {

                    const expired = this.isExpired(result[CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_START_DATE]);

                    resolve({
                        valid: true,
                        isPaid: !expired,
                        expired: expired,
                        startDate: result[CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_START_DATE],
                        daysRemaining: this.getDaysRemaining(result[CONSTANTS.STORAGE_KEYS.SUBSCRIPTION_START_DATE])
                    });
                    return;
                }

                resolve({
                    valid: true,
                    isPaid: false,
                    isFree: true
                });
            });
        });
    }
};

// UI Utilities
const UIUtils = {
    /**
     * Safely escapes HTML to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Safely sets text content (preferred over innerHTML)
     * @param {HTMLElement} element - DOM element
     * @param {string} text - Text to set
     */
    setTextContent(element, text) {
        if (element) {
            element.textContent = text || '';
        }
    },

    /**
     * Manages ad visibility based on subscription status
     * @param {boolean} isPaid - Whether user has active subscription
     */
    manageAdVisibility(isPaid) {
        const adContainers = document.querySelectorAll('.ad-container');
        adContainers.forEach(container => {
            container.style.display = isPaid ? 'none' : 'flex';
        });
    },

    /**
     * Shows status message with auto-clear
     * @param {HTMLElement} statusEl - Status element
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', or 'info'
     * @param {number} duration - Duration in ms before auto-clear
     */
    showStatus(statusEl, message, type = 'info', duration = 3000) {
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `status status-${type}`;

        if (duration > 0) {
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'status';
            }, duration);
        }
    }
};

// Data Utilities
const DataUtils = {
    /**
     * Generates unique ID for applications
     * @returns {string} Unique ID
     */
    generateId() {
        return 'app_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Formats date for display
     * @param {string} dateStr - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Calculates days since a date
     * @param {string} dateStr - ISO date string
     * @returns {number} Days elapsed
     */
    getDaysSince(dateStr) {
        if (!dateStr) return 0;
        const date = new Date(dateStr);
        const today = new Date();
        const diffTime = Math.abs(today - date);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Safely trims string
     * @param {string} str - String to trim
     * @returns {string} Trimmed string
     */
    safeTrim(str) {
        return (str || '').toString().trim();
    },

    /**
     * Validates email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};

// Storage Utilities
const StorageUtils = {
    /**
     * Gets data from Chrome storage with error handling
     * @param {string|string[]} keys - Keys to retrieve
     * @returns {Promise<Object>} Storage data
     */
    async get(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Storage get error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    },

    /**
     * Sets data in Chrome storage with error handling
     * @param {Object} data - Data to store
     * @returns {Promise<void>}
     */
    async set(data) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('Storage set error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * Removes data from Chrome storage
     * @param {string|string[]} keys - Keys to remove
     * @returns {Promise<void>}
     */
    async remove(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                    console.error('Storage remove error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }
};

// Performance Utilities
const PerformanceUtils = {
    /**
     * Creates a debounced function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Creates a throttled function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in ms
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Export for use in other scripts
// Note: For Chrome extensions, this will be loaded as a script tag
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONSTANTS,
        SubscriptionManager,
        UIUtils,
        DataUtils,
        StorageUtils,
        PerformanceUtils
    };
}
