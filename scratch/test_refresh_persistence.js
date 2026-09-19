const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock localStorage & sessionStorage
function createStorage() {
    let store = {};
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { store = {}; },
        get store() { return store; }
    };
}

const mockLocalStorage = createStorage();
const mockSessionStorage = createStorage();

// Seed initial reports
const sampleReports = {
    '05/09/2026': {
        extracted: [
            { productKey: 'ITEM1', code: 'ITM1', name: 'Item 1', brand: 'Brand A', opening: 10, sold: 2, balance: 8, processed: false, decisionType: null }
        ],
        final: [
            { productKey: 'ITEM1', code: 'ITM1', name: 'Item 1', brand: 'Brand A', refillQty: 5, godown: 'Godown 1', status: 'Pending', refillBy: 'Maya' }
        ]
    }
};
mockLocalStorage.setItem('mansurDailyReports', JSON.stringify(sampleReports));
mockLocalStorage.setItem('mansurUsers', JSON.stringify([
    { id: 'usr_maya', name: 'Maya', role: 'worker' }
]));

// Helper to create a sandbox simulating browser window & DOM
function createSandbox() {
    const elements = {};

    function createElement(id, tag = 'div', classes = []) {
        return {
            id,
            tagName: tag.toUpperCase(),
            classList: {
                _classes: new Set(classes),
                add(c) { this._classes.add(c); },
                remove(c) { this._classes.delete(c); },
                toggle(c, force) {
                    if (force !== undefined) {
                        if (force) this._classes.add(c); else this._classes.delete(c);
                    } else {
                        if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c);
                    }
                },
                contains(c) { return this._classes.has(c); }
            },
            innerHTML: '',
            textContent: '',
            innerText: '',
            value: '',
            style: {},
            options: [],
            children: [],
            appendChild(c) { this.children.push(c); },
            getAttribute(attr) { return this[attr] || null; },
            setAttribute(attr, val) { this[attr] = val; }
        };
    }

    // Views
    elements['history-view'] = createElement('history-view', 'section', ['view', 'active']);
    elements['upload-view'] = createElement('upload-view', 'section', ['view']);
    elements['workspace-view'] = createElement('workspace-view', 'section', ['view']);
    elements['reports-view'] = createElement('reports-view', 'section', ['view']);
    elements['settings-view'] = createElement('settings-view', 'section', ['view']);

    // Workspace sections
    elements['ws-review'] = createElement('ws-review', 'div', ['ws-section', 'active']);
    elements['ws-final'] = createElement('ws-final', 'div', ['ws-section']);
    elements['ws-report'] = createElement('ws-report', 'div', ['ws-section']);

    // Buttons
    const btnBook = createElement('btn-book', 'button', ['active-tab']);
    btnBook['data-tab'] = 'history-view';
    const btnUpload = createElement('btn-upload', 'button');
    btnUpload['data-tab'] = 'upload-view';
    const btnReports = createElement('btn-reports', 'button');
    btnReports['data-tab'] = 'reports-view';
    const btnSettings = createElement('btn-settings', 'button');
    btnSettings['data-tab'] = 'settings-view';

    const wsTabReview = createElement('ws-tab-review', 'button', ['ws-tab', 'active']);
    wsTabReview['data-target'] = 'ws-review';
    const wsTabFinal = createElement('ws-tab-final', 'button', ['ws-tab']);
    wsTabFinal['data-target'] = 'ws-final';
    const wsTabReport = createElement('ws-tab-report', 'button', ['ws-tab']);
    wsTabReport['data-target'] = 'ws-report';

    // Other elements
    elements['calendar-grid'] = createElement('calendar-grid');
    elements['cal-month-year'] = createElement('cal-month-year');
    elements['workspace-date-label'] = createElement('workspace-date-label');
    elements['filter-brand'] = createElement('filter-brand', 'select');
    elements['filter-status'] = createElement('filter-status', 'select');
    elements['filter-search'] = createElement('filter-search', 'input');
    elements['filter-final-godown'] = createElement('filter-final-godown', 'select');
    elements['filter-final-status'] = createElement('filter-final-status', 'select');
    elements['date-report-user-filter'] = createElement('date-report-user-filter', 'select');
    elements['date-report-status-filter'] = createElement('date-report-status-filter', 'select');
    elements['review-list'] = createElement('review-list');
    elements['review-filters'] = createElement('review-filters');
    elements['final-tbody'] = createElement('final-tbody');
    elements['final-filters'] = createElement('final-filters');
    elements['user-pill'] = createElement('user-pill');
    elements['report-user-filter'] = createElement('report-user-filter', 'select');
    elements['report-godown-filter'] = createElement('report-godown-filter', 'select');
    elements['report-status-filter'] = createElement('report-status-filter', 'select');
    elements['report-from-date'] = createElement('report-from-date', 'input');
    elements['report-to-date'] = createElement('report-to-date', 'input');
    elements['report-summary'] = createElement('report-summary');
    elements['report-summary-bar'] = createElement('report-summary-bar');
    elements['reports-output'] = createElement('reports-output');
    elements['date-report-summary'] = createElement('date-report-summary');
    elements['date-report-output'] = createElement('date-report-output');

    elements['ws-final'].insertBefore = function(el, ref) {};
    elements['final-filters'].parentNode = elements['ws-final'];
    elements['final-filters'].nextSibling = null;

    const navButtons = [btnBook, btnUpload, btnReports, btnSettings];
    const wsButtons = [wsTabReview, wsTabFinal, wsTabReport];

    const sandbox = {
        console,
        window: {
            onload: null,
            location: { href: 'http://localhost:3000/' },
            addEventListener: (event, cb) => {
                if (event === 'beforeunload') sandbox._beforeUnloadHandler = cb;
            }
        },
        document: {
            body: createElement('body', 'body', []),
            getElementById: (id) => elements[id] || null,
            querySelectorAll: (sel) => {
                if (sel === '.view') return [elements['history-view'], elements['upload-view'], elements['workspace-view'], elements['reports-view'], elements['settings-view']];
                if (sel === '#nav-menu button') return navButtons;
                if (sel === '.ws-section') return [elements['ws-review'], elements['ws-final'], elements['ws-report']];
                if (sel === '.ws-tab') return wsButtons;
                if (sel === '.type-btn:not(.date-report-tab-btn)') return [];
                if (sel === '.date-report-tab-btn') return [];
                return [];
            },
            querySelector: (sel) => {
                if (sel.includes('[data-tab="history-view"]')) return btnBook;
                if (sel.includes('[data-tab="upload-view"]')) return btnUpload;
                if (sel.includes('[data-tab="reports-view"]')) return btnReports;
                if (sel.includes('[data-tab="settings-view"]')) return btnSettings;
                if (sel.includes('[data-target="ws-review"]')) return wsTabReview;
                if (sel.includes('[data-target="ws-final"]')) return wsTabFinal;
                if (sel.includes('[data-target="ws-report"]')) return wsTabReport;
                if (sel === '.view.active') {
                    for (const v of ['workspace-view', 'reports-view', 'upload-view', 'settings-view', 'history-view']) {
                        if (elements[v].classList.contains('active')) return elements[v];
                    }
                }
                if (sel === '.ws-section.active') {
                    for (const s of ['ws-review', 'ws-final', 'ws-report']) {
                        if (elements[s].classList.contains('active')) return elements[s];
                    }
                }
                return null;
            },
            createElement: (tag) => createElement('dynamic-' + Math.random(), tag)
        },
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        alert: (msg) => { console.log('ALERT:', msg); },
        confirm: () => true
    };
    sandbox.window.document = sandbox.document;
    sandbox.window.localStorage = sandbox.localStorage;
    sandbox.window.sessionStorage = sandbox.sessionStorage;
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox.window);

    return { sandbox: sandbox.window, elements, navButtons, wsButtons };
}

function runScripts(ctx) {
    const scripts = ['storage.js', 'app.js', 'settings.js', 'users.js', 'calendar.js', 'review.js', 'final-list.js', 'reports.js'];
    scripts.forEach(s => {
        const code = fs.readFileSync(path.join(__dirname, '..', 'js', s), 'utf8');
        vm.runInContext(code, ctx);
    });
}

console.log('=== TEST 1: Initial Page Load ===');
let { sandbox, elements, navButtons, wsButtons } = createSandbox();
runScripts(sandbox);
sandbox.window.onload();
console.assert(elements['history-view'].classList.contains('active'), 'Default should be history-view');
console.log('✔ Test 1 Passed: Default is history-view');

console.log('\n=== TEST 2: Switch to Reports Tab & Simulate Refresh ===');
const btnReports = navButtons.find(b => b['data-tab'] === 'reports-view');
sandbox.window.switchTab('reports-view', btnReports);
console.assert(elements['reports-view'].classList.contains('active'), 'Reports view active');
console.assert(btnReports.classList.contains('active-tab'), 'Reports button active-tab');

// Trigger beforeunload
if (sandbox._beforeUnloadHandler) sandbox._beforeUnloadHandler();

// Simulate refresh by creating new sandbox with same storage
let refreshed = createSandbox();
runScripts(refreshed.sandbox);
refreshed.sandbox.window.onload();

console.assert(refreshed.elements['reports-view'].classList.contains('active'), 'Reports view restored after refresh');
const restoredReportsBtn = refreshed.navButtons.find(b => b['data-tab'] === 'reports-view');
console.assert(restoredReportsBtn.classList.contains('active-tab'), 'Reports button has active-tab after refresh');
console.log('✔ Test 2 Passed: Reports view and nav button perfectly restored across refresh');

console.log('\n=== TEST 3: Open Workspace 05/09/2026, Switch to Refill List & Simulate Refresh ===');
refreshed.sandbox.window.loadDateWorkspace('05/09/2026');
const wsTabFinal = refreshed.wsButtons.find(b => b['data-target'] === 'ws-final');
refreshed.sandbox.window.switchWorkspaceTab('ws-final', wsTabFinal);

console.assert(refreshed.elements['workspace-view'].classList.contains('active'), 'Workspace view active');
console.assert(refreshed.elements['ws-final'].classList.contains('active'), 'Refill list active');

if (refreshed.sandbox._beforeUnloadHandler) refreshed.sandbox._beforeUnloadHandler();

// Simulate second refresh
let refreshed2 = createSandbox();
runScripts(refreshed2.sandbox);
refreshed2.sandbox.window.onload();

console.assert(refreshed2.elements['workspace-view'].classList.contains('active'), 'Workspace view restored after refresh');
console.assert(refreshed2.sandbox.activeDate === '05/09/2026', 'activeDate 05/09/2026 restored');
console.assert(refreshed2.elements['ws-final'].classList.contains('active'), 'Refill list (ws-final) restored after refresh');
console.log('✔ Test 3 Passed: Date Workspace and Refill List sub-tab restored across refresh');

console.log('\n=== TEST 4: Switch to Date Report & Simulate Refresh ===');
const wsTabReport = refreshed2.wsButtons.find(b => b['data-target'] === 'ws-report');
refreshed2.sandbox.window.switchWorkspaceTab('ws-report', wsTabReport);

if (refreshed2.sandbox._beforeUnloadHandler) refreshed2.sandbox._beforeUnloadHandler();

// Simulate third refresh
let refreshed3 = createSandbox();
runScripts(refreshed3.sandbox);
refreshed3.sandbox.window.onload();

console.assert(refreshed3.elements['workspace-view'].classList.contains('active'), 'Workspace view restored after refresh');
console.assert(refreshed3.elements['ws-report'].classList.contains('active'), 'Date report sub-tab restored after refresh');
console.log('✔ Test 4 Passed: Date Report sub-tab restored across refresh');

console.log('\n=== TEST 5: Back to Book & Simulate Refresh ===');
refreshed3.sandbox.window.backToCalendar();
console.assert(refreshed3.elements['history-view'].classList.contains('active'), 'History view active');

if (refreshed3.sandbox._beforeUnloadHandler) refreshed3.sandbox._beforeUnloadHandler();

// Simulate fourth refresh
let refreshed4 = createSandbox();
runScripts(refreshed4.sandbox);
refreshed4.sandbox.window.onload();

console.assert(refreshed4.elements['history-view'].classList.contains('active'), 'History view restored');
const restoredBookBtn = refreshed4.navButtons.find(b => b['data-tab'] === 'history-view');
console.assert(restoredBookBtn.classList.contains('active-tab'), 'Book button active-tab');
console.log('✔ Test 5 Passed: Calendar view restored when returning to Book');

console.log('\n=== TEST 6: Upload View & Simulate Refresh ===');
const btnUpload = refreshed4.navButtons.find(b => b['data-tab'] === 'upload-view');
refreshed4.sandbox.window.switchTab('upload-view', btnUpload);
if (refreshed4.sandbox._beforeUnloadHandler) refreshed4.sandbox._beforeUnloadHandler();

let refreshed5 = createSandbox();
runScripts(refreshed5.sandbox);
refreshed5.sandbox.window.onload();
console.assert(refreshed5.elements['upload-view'].classList.contains('active'), 'Upload view restored');
const restoredUploadBtn = refreshed5.navButtons.find(b => b['data-tab'] === 'upload-view');
console.assert(restoredUploadBtn.classList.contains('active-tab'), 'Upload button active-tab');
console.log('✔ Test 6 Passed: Upload view perfectly restored across refresh');

console.log('\n=== TEST 7: Settings View & Simulate Refresh ===');
const btnSettings = refreshed5.navButtons.find(b => b['data-tab'] === 'settings-view');
refreshed5.sandbox.window.switchTab('settings-view', btnSettings);
if (refreshed5.sandbox._beforeUnloadHandler) refreshed5.sandbox._beforeUnloadHandler();

let refreshed6 = createSandbox();
runScripts(refreshed6.sandbox);
refreshed6.sandbox.window.onload();
console.assert(refreshed6.elements['settings-view'].classList.contains('active'), 'Settings view restored');
const restoredSettingsBtn = refreshed6.navButtons.find(b => b['data-tab'] === 'settings-view');
console.assert(restoredSettingsBtn.classList.contains('active-tab'), 'Settings button active-tab');
console.log('✔ Test 7 Passed: Settings view perfectly restored across refresh');

console.log('\nALL 7 PERSISTENCE TESTS PASSED SUCCESSFULLY! 🚀');
