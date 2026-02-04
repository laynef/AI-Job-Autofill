
const { JobExtractor } = require('../job-extractor');

describe('JobExtractor', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        // Reset console mocks if any
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    test('extractJobTitle finds title from h1', async () => {
        document.body.innerHTML = '<h1>Software Engineer</h1>';
        const title = await JobExtractor.extractJobTitle();
        expect(title).toBe('Software Engineer');
    });

    test('extractJobTitle falls back to page title', async () => {
        // Clear body to ensure no h1 is found
        document.body.innerHTML = '<div>No title here</div>';
        
        Object.defineProperty(document, 'title', {
            writable: true,
            value: 'Product Manager - Company Inc'
        });
        
        const title = await JobExtractor.extractJobTitle();
        expect(title).toBe('Product Manager');
    });

    test('extractJobInfo returns object with all fields', async () => {
        document.body.innerHTML = '<h1>DevOps Engineer</h1>';
        
        const info = await JobExtractor.extractJobInfo();
        
        expect(info).toHaveProperty('position');
        expect(info).toHaveProperty('company');
        expect(info).toHaveProperty('location');
        expect(info).toHaveProperty('salary');
        expect(info).toHaveProperty('jobType');
        expect(info.position).toBe('DevOps Engineer');
    });
});
