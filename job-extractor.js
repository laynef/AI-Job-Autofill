// Job Information Extraction Module
// Extracts job details from application pages

const JobExtractor = {
    /**
     * Main extraction function - extracts all job information from current page
     * @returns {Promise<Object>} Extracted job information
     */
    async extractJobInfo() {
        console.log('🔍 extractJobInfo: Starting job info extraction...');
        console.log('   Current URL:', window.location.href);

        const jobInfo = {
            position: await this.extractJobTitle(),
            company: await this.extractCompanyName(),
            location: await this.extractLocation(),
            salary: await this.extractSalary(),
            jobType: await this.extractJobType()
        };

        console.log('📊 Job Info Extracted:', jobInfo);
        return jobInfo;
    },

    /**
     * Extract job title from page
     * @returns {Promise<string>} Job title
     */
    async extractJobTitle() {
        // Try selectors in priority order
        for (const selector of ATSConfig.JOB_TITLE_SELECTORS) {
            const element = document.querySelector(selector);
            if (element && element.innerText && element.innerText.trim().length > 3) {
                return element.innerText.trim();
            }
        }

        // Fallback: extract from page title
        const pageTitle = document.title;
        const titleMatch = pageTitle.match(/^([^-|]+?)(?:\s*[-|@]\s*|$)/);
        if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 3) {
            return titleMatch[1].trim();
        }

        return '';
    },

    /**
     * Extract company name from page
     * @returns {Promise<string>} Company name
     */
    async extractCompanyName() {
        let company = '';

        // Strategy 1: Try filled form fields (best after autofill)
        company = await this.extractFromFormFields();
        if (company) return company;

        // Strategy 2: Platform-specific selectors
        const platform = ATSConfig.getATSPlatform(window.location.href);
        if (platform && ATSConfig.COMPANY_SELECTORS[platform]) {
            company = this.extractFromSelectors(ATSConfig.COMPANY_SELECTORS[platform]);
            if (company) return ATSConfig.sanitizeCompanyName(company);
        }

        // Strategy 3: Generic selectors
        company = this.extractFromSelectors(ATSConfig.COMPANY_SELECTORS.generic);
        if (company) return ATSConfig.sanitizeCompanyName(company);

        // Strategy 4: Meta tags
        company = this.extractFromMetaTags();
        if (company) return ATSConfig.sanitizeCompanyName(company);

        // Strategy 5: URL patterns
        company = this.extractFromURL();
        if (company) return company;

        // Strategy 6: Page title patterns
        company = this.extractFromPageTitle();
        if (company) return company;

        // Strategy 7: Structured data (JSON-LD)
        company = this.extractFromStructuredData();
        if (company) return ATSConfig.sanitizeCompanyName(company);

        // Strategy 8: Text patterns
        company = this.extractFromBodyText();
        if (company) return ATSConfig.sanitizeCompanyName(company);

        return '';
    },

    /**
     * Extract company from filled form fields
     * @returns {string} Company name or empty string
     */
    extractFromFormFields() {
        for (const selector of ATSConfig.COMPANY_SELECTORS.formFields) {
            try {
                const input = document.querySelector(selector);
                if (input) {
                    const value = input.value || input.textContent || input.innerText;
                    if (value && value.trim().length > 2 && value.trim().length < 100) {
                        console.log('Company extracted from form field:', value.trim());
                        return value.trim();
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return '';
    },

    /**
     * Extract text from array of selectors
     * @param {Array<string>} selectors - CSS selectors
     * @returns {string} Extracted text or empty string
     */
    extractFromSelectors(selectors) {
        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element && element.innerText) {
                    const text = element.innerText.trim();
                    if (text.length > 2 && text.length < 100 &&
                        !text.toLowerCase().includes('apply') &&
                        !text.toLowerCase().includes('application')) {
                        return text;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return '';
    },

    /**
     * Extract company from meta tags
     * @returns {string} Company name or empty string
     */
    extractFromMetaTags() {
        for (const selector of ATSConfig.META_TAGS.company) {
            const metaTag = document.querySelector(selector);
            if (metaTag && metaTag.content) {
                const content = metaTag.content.trim();

                // If it's a description, try to extract company name
                if (metaTag.getAttribute('property') === 'og:description') {
                    const match = content.match(/(?:at|for|with)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s+is|\s+in|\s+based|\.|\,)/);
                    if (match && match[1]) {
                        return match[1].trim();
                    }
                }

                return content;
            }
        }
        return '';
    },

    /**
     * Extract company name from URL
     * @returns {string} Company name or empty string
     */
    extractFromURL() {
        const url = window.location.href;

        // Try each URL pattern
        for (const pattern of ATSConfig.URL_PATTERNS) {
            const match = url.match(pattern.regex);
            if (match && match[1]) {
                return pattern.transform(match);
            }
        }

        // Generic careers page: company.com/careers or jobs.company.com
        try {
            const domain = new URL(url).hostname;
            if (domain.includes('jobs.') || domain.includes('careers.') || domain.includes('recruiting.')) {
                const domainParts = domain.split('.');
                const companyPart = domainParts.find(part =>
                    !['jobs', 'careers', 'recruiting', 'www', 'com', 'io', 'net', 'org', 'co'].includes(part)
                );
                if (companyPart && companyPart.length > 2) {
                    return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
                }
            }
        } catch (e) {
            console.error('URL parsing error:', e);
        }

        return '';
    },

    /**
     * Extract company from page title
     * @returns {string} Company name or empty string
     */
    extractFromPageTitle() {
        try {
            const title = document.title;

            for (const pattern of ATSConfig.TEXT_PATTERNS) {
                const match = title.match(pattern);
                if (match && match[1]) {
                    const company = match[1].trim();
                    if (company.length > 2 && company.length < 50 &&
                        !ATSConfig.isJobBoardName(company)) {
                        return company;
                    }
                }
            }
        } catch (e) {
            console.error('Title parsing error:', e);
        }
        return '';
    },

    /**
     * Extract company from structured data (JSON-LD)
     * @returns {string} Company name or empty string
     */
    extractFromStructuredData() {
        try {
            const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
            if (ldJsonScript) {
                const jsonData = JSON.parse(ldJsonScript.textContent);
                const jobPosting = Array.isArray(jsonData)
                    ? jsonData.find(j => j['@type'] === 'JobPosting')
                    : jsonData;

                if (jobPosting && jobPosting.hiringOrganization) {
                    return jobPosting.hiringOrganization.name || jobPosting.hiringOrganization;
                }
            }
        } catch (e) {
            console.error('Structured data parsing error:', e);
        }
        return '';
    },

    /**
     * Extract company from body text patterns
     * @returns {string} Company name or empty string
     */
    extractFromBodyText() {
        try {
            const bodyText = document.body.innerText;

            for (const [, pattern] of Object.entries(ATSConfig.TEXT_PATTERNS)) {
                const match = bodyText.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
        } catch (e) {
            console.error('Body text extraction error:', e);
        }
        return '';
    },

    /**
     * Extract location information
     * @returns {Promise<string>} Location
     */
    async extractLocation() {
        for (const selector of ATSConfig.LOCATION_SELECTORS) {
            const element = document.querySelector(selector);
            if (element && element.innerText) {
                const location = element.innerText.trim();
                if (location.length > 2 && location.length < 100) {
                    return location;
                }
            }
        }
        return '';
    },

    /**
     * Extract salary information
     * @returns {Promise<string>} Salary
     */
    async extractSalary() {
        // Try structured selectors first
        for (const selector of ATSConfig.SALARY_SELECTORS) {
            const element = document.querySelector(selector);
            if (element && element.innerText) {
                const text = element.innerText.trim();
                if (this.isSalaryPattern(text)) {
                    return text;
                }
            }
        }

        // Search page text for salary patterns
        try {
            const bodyText = document.body.innerText;
            const salaryMatch = bodyText.match(/\$\d{2,3}[,\.]?\d{0,3}[kK]?\s*[-–]\s*\$\d{2,3}[,\.]?\d{0,3}[kK]?/);
            if (salaryMatch) {
                return salaryMatch[0];
            }
        } catch (e) {
            console.error('Salary extraction error:', e);
        }

        return '';
    },

    /**
     * Check if text matches salary pattern
     * @param {string} text - Text to check
     * @returns {boolean} True if salary pattern
     */
    isSalaryPattern(text) {
        return text.match(/\$[\d,]+k?/i) || text.match(/\d+[kK]\s*-\s*\d+[kK]/);
    },

    /**
     * Extract job type (Full-time, Part-time, etc.)
     * @returns {Promise<string>} Job type
     */
    async extractJobType() {
        const jobTypePatterns = [
            'full-time', 'part-time', 'contract',
            'temporary', 'internship', 'remote', 'hybrid'
        ];

        const pageTextLower = document.body.innerText.toLowerCase();

        for (const pattern of jobTypePatterns) {
            if (pageTextLower.includes(pattern)) {
                return pattern.split('-')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join('-');
            }
        }

        return '';
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JobExtractor };
}
