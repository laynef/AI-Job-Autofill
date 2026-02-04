
const { AppManager, UIUtils, CONSTANTS } = require('../utils');

describe('AppManager', () => {
    test('getStatus returns free status', async () => {
        const status = await AppManager.getStatus();
        expect(status.valid).toBe(true);
        expect(status.isFree).toBe(true);
        expect(status.message).toContain('free');
    });

    test('getInfo returns correct app info', () => {
        const info = AppManager.getInfo();
        expect(info.name).toBe(CONSTANTS.APP_NAME);
        expect(info.isFree).toBe(true);
    });
});

describe('UIUtils', () => {
    test('escapeHtml prevents XSS', () => {
        const malicious = '<script>alert(1)</script>';
        const escaped = UIUtils.escapeHtml(malicious);
        expect(escaped).not.toContain('<script>');
        expect(escaped).toContain('&lt;script&gt;');
    });

    test('setTextContent sets text correctly', () => {
        const el = document.createElement('div');
        UIUtils.setTextContent(el, 'Hello World');
        expect(el.textContent).toBe('Hello World');
    });
});
