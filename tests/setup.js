
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null
  }
};

// Mock ATSConfig globally since it's used in JobExtractor but defined in another file
global.ATSConfig = {
    JOB_TITLE_SELECTORS: ['h1', '.job-title', '[data-test="job-title"]'],
    COMPANY_SELECTORS: {
        generic: ['.company', '.employer', '[data-test="company-name"]'],
        formFields: ['input[name="company"]', 'input[name="employer"]']
    },
    getATSPlatform: jest.fn(() => null),
    sanitizeCompanyName: jest.fn(name => name)
};
