// Shared Utilities Module
// This module contains common functions used across the extension to eliminate code duplication

// Constants
const CONSTANTS = {
    STORAGE_KEYS: {
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
    },
    APP_NAME: 'Hired Always',
    VERSION: '3.13'
};

// App Manager - Simplified for free version
const AppManager = {
    /**
     * Get app status - Always free!
     * @returns {Promise<Object>} App status object
     */
    async getStatus() {
        return {
            valid: true,
            isFree: true,
            isPaid: false,
            message: 'Hired Always is 100% free!'
        };
    },

    /**
     * Get app information
     * @returns {Object} App info
     */
    getInfo() {
        return {
            name: CONSTANTS.APP_NAME,
            version: CONSTANTS.VERSION,
            isFree: true,
            description: 'AI-powered job application assistant - 100% free forever'
        };
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
    },

    /**
     * Show free app badge
     * @param {HTMLElement} element - Element to show badge in
     */
    showFreeBadge(element) {
        if (!element) return;
        element.innerHTML = '<span style="color: #10b981; font-weight: bold;">✓ 100% FREE Forever</span>';
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
        return function (...args) {
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
        AppManager,
        UIUtils,
        DataUtils,
        StorageUtils,
        PerformanceUtils
    };
}
