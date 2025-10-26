// Rating Manager Module
// Handles user rating prompts and interactions

const RatingManager = {
    /**
     * Initialize rating system
     */
    async init() {
        this.setupEventListeners();
        await this.checkShouldShowRating();
    },

    /**
     * Setup event listeners for rating modal
     */
    setupEventListeners() {
        const stars = document.querySelectorAll('.star');
        const rateNowBtn = document.getElementById('rateNowBtn');
        const remindLaterBtn = document.getElementById('remindLaterBtn');
        const dontAskAgainBtn = document.getElementById('dontAskAgainBtn');
        const starsContainer = document.querySelector('.stars-container');

        let selectedRating = 0;

        // Star hover and click handlers
        if (stars.length > 0) {
            stars.forEach(star => {
                star.addEventListener('mouseenter', () => {
                    const rating = parseInt(star.getAttribute('data-rating'));
                    this.highlightStars(stars, rating);
                });

                star.addEventListener('click', () => {
                    selectedRating = parseInt(star.getAttribute('data-rating'));
                    this.highlightStars(stars, selectedRating);
                    if (rateNowBtn) rateNowBtn.style.display = 'block';
                });
            });

            // Reset stars on mouse leave
            if (starsContainer) {
                starsContainer.addEventListener('mouseleave', () => {
                    this.highlightStars(stars, selectedRating);
                });
            }
        }

        // Rate Now button
        if (rateNowBtn) {
            rateNowBtn.addEventListener('click', async () => {
                await this.handleRateNow();
            });
        }

        // Remind Later button
        if (remindLaterBtn) {
            remindLaterBtn.addEventListener('click', async () => {
                await this.handleRemindLater();
            });
        }

        // Don't Ask Again button
        if (dontAskAgainBtn) {
            dontAskAgainBtn.addEventListener('click', async () => {
                await this.handleDontAskAgain();
            });
        }
    },

    /**
     * Highlight stars up to given rating
     * @param {NodeList} stars - Star elements
     * @param {number} rating - Rating (1-5)
     */
    highlightStars(stars, rating) {
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('filled');
            } else {
                star.classList.remove('filled');
            }
        });
    },

    /**
     * Show rating modal
     */
    show() {
        const modal = document.getElementById('ratingModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    },

    /**
     * Hide rating modal
     */
    hide() {
        const modal = document.getElementById('ratingModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    /**
     * Check if should show rating prompt
     * @returns {Promise<boolean>} True if should show
     */
    async checkShouldShowRating() {
        try {
            const data = await StorageUtils.get([
                CONSTANTS.STORAGE_KEYS.USAGE_COUNT,
                CONSTANTS.STORAGE_KEYS.HAS_RATED,
                CONSTANTS.STORAGE_KEYS.RATING_DISMISSED
            ]);

            const usageCount = data[CONSTANTS.STORAGE_KEYS.USAGE_COUNT] || 0;
            const hasRated = data[CONSTANTS.STORAGE_KEYS.HAS_RATED] || false;
            const ratingDismissed = data[CONSTANTS.STORAGE_KEYS.RATING_DISMISSED] || false;

            // Show after 5 uses if user hasn't rated or dismissed
            if (usageCount >= 5 && !hasRated && !ratingDismissed) {
                setTimeout(() => this.show(), 1000);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking rating status:', error);
            return false;
        }
    },

    /**
     * Increment usage count
     * @returns {Promise<void>}
     */
    async incrementUsageCount() {
        try {
            const data = await StorageUtils.get([
                CONSTANTS.STORAGE_KEYS.USAGE_COUNT,
                CONSTANTS.STORAGE_KEYS.HAS_RATED,
                CONSTANTS.STORAGE_KEYS.RATING_DISMISSED
            ]);

            const usageCount = (data[CONSTANTS.STORAGE_KEYS.USAGE_COUNT] || 0) + 1;

            await StorageUtils.set({
                [CONSTANTS.STORAGE_KEYS.USAGE_COUNT]: usageCount
            });

            // Show rating prompt after 5 uses if user hasn't rated or dismissed
            if (usageCount >= 5 &&
                !data[CONSTANTS.STORAGE_KEYS.HAS_RATED] &&
                !data[CONSTANTS.STORAGE_KEYS.RATING_DISMISSED]) {
                setTimeout(() => this.show(), 500);
            }
        } catch (error) {
            console.error('Error incrementing usage count:', error);
        }
    },

    /**
     * Handle "Rate Now" button click
     * @returns {Promise<void>}
     */
    async handleRateNow() {
        try {
            // Open Chrome Web Store review page
            const extensionId = chrome.runtime.id;
            const webStoreUrl = `https://chromewebstore.google.com/detail/${extensionId}`;

            await chrome.tabs.create({ url: webStoreUrl });

            // Mark as rated
            await StorageUtils.set({
                [CONSTANTS.STORAGE_KEYS.HAS_RATED]: true
            });

            this.hide();
        } catch (error) {
            console.error('Error handling rate now:', error);
        }
    },

    /**
     * Handle "Remind Later" button click
     * @returns {Promise<void>}
     */
    async handleRemindLater() {
        try {
            // Reset usage count so it will ask again after another 5 uses
            await StorageUtils.set({
                [CONSTANTS.STORAGE_KEYS.USAGE_COUNT]: 0
            });

            this.hide();
        } catch (error) {
            console.error('Error handling remind later:', error);
        }
    },

    /**
     * Handle "Don't Ask Again" button click
     * @returns {Promise<void>}
     */
    async handleDontAskAgain() {
        try {
            await StorageUtils.set({
                [CONSTANTS.STORAGE_KEYS.RATING_DISMISSED]: true
            });

            this.hide();
        } catch (error) {
            console.error('Error handling don\'t ask again:', error);
        }
    },

    /**
     * Get rating statistics
     * @returns {Promise<Object>} Rating stats
     */
    async getStats() {
        try {
            const data = await StorageUtils.get([
                CONSTANTS.STORAGE_KEYS.USAGE_COUNT,
                CONSTANTS.STORAGE_KEYS.HAS_RATED,
                CONSTANTS.STORAGE_KEYS.RATING_DISMISSED
            ]);

            return {
                usageCount: data[CONSTANTS.STORAGE_KEYS.USAGE_COUNT] || 0,
                hasRated: data[CONSTANTS.STORAGE_KEYS.HAS_RATED] || false,
                dismissed: data[CONSTANTS.STORAGE_KEYS.RATING_DISMISSED] || false
            };
        } catch (error) {
            console.error('Error getting rating stats:', error);
            return {
                usageCount: 0,
                hasRated: false,
                dismissed: false
            };
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RatingManager };
}
