// ATS (Applicant Tracking System) Configuration
// Centralizes all selector patterns and ATS-specific logic

const ATSConfig = {
    // Supported ATS platforms
    PLATFORMS: {
        GREENHOUSE: 'greenhouse',
        LEVER: 'lever',
        WORKDAY: 'workday',
        ASHBY: 'ashby',
        BAMBOOHR: 'bamboohr',
        WORKABLE: 'workable',
        JOBVITE: 'jobvite',
        SMARTRECRUITERS: 'smartrecruiters'
    },

    // Iframe detection patterns for embedded application forms
    IFRAME_PATTERNS: [
        {
            domain: 'greenhouse',
            selector: 'iframe[id*="grnhse"], iframe[src*="greenhouse.io/embed/job_app"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'lever',
            selector: 'iframe[src*="jobs.lever.co"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'workday',
            selector: 'iframe[src*="myworkdayjobs.com"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'ashby',
            selector: 'iframe[src*="jobs.ashbyhq.com"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'bamboohr',
            selector: 'iframe[src*="bamboohr.com/jobs"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'workable',
            selector: 'iframe[src*="apply.workable.com"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'jobvite',
            selector: 'iframe[src*="jobs.jobvite.com"]',
            minWidth: 200,
            minHeight: 200
        },
        {
            domain: 'smartrecruiters',
            selector: 'iframe[src*="jobs.smartrecruiters.com"]',
            minWidth: 200,
            minHeight: 200
        }
    ],

    // Patterns to ignore when detecting iframes (analytics, ads, etc.)
    IFRAME_IGNORE_PATTERNS: [
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
    ],

    // Job title extraction selectors (priority order)
    JOB_TITLE_SELECTORS: [
        'h1',
        'h2',
        '[class*="job-title"]',
        '[class*="jobTitle"]',
        '[data-testid*="job-title"]',
        '[class*="position"]',
        '[class*="JobTitle"]',
        '[id*="job-title"]'
    ],

    // Company name extraction selectors (priority order)
    COMPANY_SELECTORS: {
        // Greenhouse-specific
        greenhouse: [
            '.company-name',
            '[class*="app-title"]',
            'div[class*="application--header"] h2'
        ],
        // Generic selectors
        generic: [
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
        ],
        // Form field selectors (filled after autofill)
        formFields: [
            'input[name*="company"]',
            'input[id*="company"]',
            'input[aria-label*="company" i]',
            'input[placeholder*="company" i]',
            '[contenteditable="true"][class*="company"]'
        ]
    },

    // URL patterns for extracting company names from URLs
    URL_PATTERNS: [
        {
            name: 'greenhouse',
            regex: /greenhouse\.io\/([^\/\?]+)/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'lever',
            regex: /lever\.co\/([^\/\?]+)/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'workday',
            regex: /([^\/]+)\.wd\d+\.myworkdayjobs\.com/,
            transform: (match) => match[1].split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'ashby',
            regex: /ashbyhq\.com\/([^\/\?]+)/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'bamboohr',
            regex: /([^\/]+)\.bamboohr\.com/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'gem',
            regex: /gem\.com\/careers\/([^\/\?]+)/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'jobvite',
            regex: /jobvite\.com\/([^\/\?]+)/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        },
        {
            name: 'smartrecruiters',
            regex: /smartrecruiters\.com\/([^\/\?]+)/,
            transform: (match) => match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        }
    ],

    // Location extraction selectors
    LOCATION_SELECTORS: [
        '[class*="location"]',
        '[class*="jobLocation"]',
        '[data-testid*="location"]',
        '[class*="city"]',
        '[id*="location"]',
        '[class*="work-location"]',
        '[class*="office-location"]'
    ],

    // Salary extraction selectors
    SALARY_SELECTORS: [
        '[class*="salary"]',
        '[class*="compensation"]',
        '[class*="pay"]',
        '[data-testid*="salary"]',
        '[id*="salary"]'
    ],

    // Job type extraction selectors
    JOB_TYPE_SELECTORS: [
        '[class*="job-type"]',
        '[class*="employment-type"]',
        '[data-testid*="job-type"]',
        '[class*="work-type"]'
    ],

    // Meta tags for extraction
    META_TAGS: {
        company: [
            'meta[property="og:site_name"]',
            'meta[name="company"]',
            'meta[property="og:description"]'
        ],
        jobTitle: [
            'meta[property="og:title"]',
            'meta[name="title"]'
        ]
    },

    // Common job board names to filter out
    JOB_BOARD_NAMES: [
        'greenhouse',
        'lever',
        'linkedin',
        'indeed',
        'glassdoor',
        'monster',
        'ziprecruiter',
        'careerbuilder'
    ],

    // Text patterns for company extraction from body text
    TEXT_PATTERNS: {
        hiring: /(?:Join|About)\s+([A-Z][a-zA-Z0-9\s&]{2,50}?)(?:\s+is\s+(?:hiring|looking|seeking)|'s\s+team)/,
        companyIs: /([A-Z][a-zA-Z0-9\s&\.]+?)\s+is\s+(?:hiring|looking|seeking)/,
        atCompany: /\s+(?:at|-|@)\s+([A-Z][a-zA-Z0-9\s&\.]+?)(?:\s+\||$)/
    },

    /**
     * Checks if current URL is an ATS domain
     * @param {string} url - URL to check
     * @returns {boolean} True if on ATS domain
     */
    isATSDomain(url) {
        if (!url) return false;
        return url.includes('greenhouse.io') ||
               url.includes('lever.co') ||
               url.includes('myworkdayjobs.com') ||
               url.includes('ashbyhq.com') ||
               url.includes('bamboohr.com') ||
               url.includes('workable.com') ||
               url.includes('jobvite.com') ||
               url.includes('smartrecruiters.com');
    },

    /**
     * Gets the ATS platform from URL
     * @param {string} url - URL to check
     * @returns {string|null} Platform name or null
     */
    getATSPlatform(url) {
        if (!url) return null;
        if (url.includes('greenhouse.io')) return this.PLATFORMS.GREENHOUSE;
        if (url.includes('lever.co')) return this.PLATFORMS.LEVER;
        if (url.includes('myworkdayjobs.com')) return this.PLATFORMS.WORKDAY;
        if (url.includes('ashbyhq.com')) return this.PLATFORMS.ASHBY;
        if (url.includes('bamboohr.com')) return this.PLATFORMS.BAMBOOHR;
        if (url.includes('workable.com')) return this.PLATFORMS.WORKABLE;
        if (url.includes('jobvite.com')) return this.PLATFORMS.JOBVITE;
        if (url.includes('smartrecruiters.com')) return this.PLATFORMS.SMARTRECRUITERS;
        return null;
    },

    /**
     * Sanitizes company name by removing common suffixes
     * @param {string} company - Company name to sanitize
     * @returns {string} Sanitized company name
     */
    sanitizeCompanyName(company) {
        if (!company) return '';
        let sanitized = company;

        // Remove common suffixes
        sanitized = sanitized.replace(/\s*\|\s*.*/g, ''); // Remove "| Career Page" etc
        sanitized = sanitized.replace(/\s*-\s*.*/g, ''); // Remove "- Jobs" etc
        sanitized = sanitized.split('\n')[0].trim(); // Take only first line
        sanitized = sanitized.replace(/\s*\(.*?\)\s*/g, '').trim(); // Remove parentheses content

        // Filter out invalid company names
        if (sanitized.toLowerCase().includes('apply') ||
            sanitized.toLowerCase().includes('application') ||
            sanitized.length > 100 ||
            sanitized.length < 2) {
            return '';
        }

        return sanitized;
    },

    /**
     * Checks if a string is likely a job board name
     * @param {string} name - Name to check
     * @returns {boolean} True if likely a job board
     */
    isJobBoardName(name) {
        if (!name) return false;
        const lowerName = name.toLowerCase();
        return this.JOB_BOARD_NAMES.some(board => lowerName.includes(board));
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ATSConfig };
}
