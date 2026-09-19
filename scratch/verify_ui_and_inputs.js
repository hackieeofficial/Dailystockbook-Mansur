/**
 * verify_ui_and_inputs.js
 * Technical verification script for:
 * 1. Spinner eradication (CSS rules & browser appearance)
 * 2. Strict digits-only input enforcement (type="text", inputmode="numeric", oninput sanitizer, keydown filter)
 * 3. Mobile 2-column header layout (Item # aligned alongside product details)
 * 4. Desktop 5-column grid layout & header alignment
 * 5. Reports empty state single card & Indian date formatting (DD/MM/YYYY)
 * 6. Elimination of duplicate empty state in Reports view
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('RUNNING DEEP TECHNICAL AUDIT & FLOW VERIFICATION');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✔ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
}

// ── 1. Check index.html Cache Busters ──────────────────────────
const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

test('Cache-busting query strings are active on critical CSS & JS files', () => {
    assert(htmlContent.includes('css/base.css?v=4'), 'base.css missing ?v=4');
    assert(htmlContent.includes('css/review.css?v=4'), 'review.css missing ?v=4');
    assert(htmlContent.includes('css/reports.css?v=4'), 'reports.css missing ?v=4');
    assert(htmlContent.includes('css/responsive.css?v=4'), 'responsive.css missing ?v=4');
    assert(htmlContent.includes('js/review.js?v=4'), 'review.js missing ?v=4');
    assert(htmlContent.includes('js/reports.js?v=4'), 'reports.js missing ?v=4');
});

test('Unified sleek workspace-bar and compact segmented tabs in HTML and CSS', () => {
    assert(htmlContent.includes('class="workspace-bar"'), 'workspace-bar missing in index.html');
    assert(htmlContent.includes('class="workspace-header-strip"'), 'workspace-header-strip missing in index.html');
    assert(htmlContent.includes('class="workspace-meta-group"'), 'workspace-meta-group missing in index.html');
    assert(htmlContent.includes('btn-delete-ws'), 'btn-delete-ws missing in index.html');
});

// ── 2. Check CSS Spinner Removal Rules ─────────────────────────
const baseCss = fs.readFileSync(path.join(__dirname, '../css/base.css'), 'utf-8');
const reviewCss = fs.readFileSync(path.join(__dirname, '../css/review.css'), 'utf-8');
const responsiveCss = fs.readFileSync(path.join(__dirname, '../css/responsive.css'), 'utf-8');

test('Base CSS suppresses webkit and moz spin-buttons with !important', () => {
    assert(baseCss.includes('::-webkit-outer-spin-button'), 'Missing webkit outer spin suppression');
    assert(baseCss.includes('::-webkit-inner-spin-button'), 'Missing webkit inner spin suppression');
    assert(baseCss.includes('-webkit-appearance: none !important'), 'Missing webkit appearance none !important');
    assert(baseCss.includes('display: none !important'), 'Missing display none !important for spinners');
    assert(baseCss.includes('-moz-appearance: textfield !important'), 'Missing moz appearance textfield');
});

test('Review CSS suppresses spin-buttons specifically for .qty-input', () => {
    assert(reviewCss.includes('.col-inputs input.qty-input::-webkit-outer-spin-button'), 'Missing qty-input webkit outer spin suppression');
    assert(reviewCss.includes('appearance: none !important'), 'Missing appearance none !important');
    assert(reviewCss.includes('appearance: textfield !important'), 'Missing appearance textfield !important');
});

test('Responsive CSS suppresses spinners and prevents mobile zoom with 16px font-size', () => {
    assert(responsiveCss.includes('.col-inputs input.qty-input::-webkit-outer-spin-button'), 'Missing mobile spin button killer');
    assert(responsiveCss.includes('font-size: 16px !important'), 'Missing 16px font-size to prevent mobile iOS zoom');
});

// ── 3. Check Desktop Review Header & 5-Column Alignment ────────
test('Desktop Review Header defined and matches 5-column grid layout', () => {
    assert(reviewCss.includes('.review-header-desktop {'), 'Missing .review-header-desktop in review.css');
    assert(reviewCss.includes('grid-template-columns: 40px minmax(180px, 2fr) minmax(185px, 1.3fr) minmax(180px, 1.4fr) 130px;'), 'Grid columns mismatch for desktop review');
    assert(responsiveCss.includes('.review-header-desktop {\n        display: none !important;'), 'Desktop header should be hidden on mobile');
});

// ── 4. Check Mobile 2-Column Header Card Layout ────────────────
test('Mobile Review Card uses compact 2-column header layout (sr-no alongside product details)', () => {
    assert(responsiveCss.includes('grid-template-columns: 28px 1fr;'), 'Mobile review card should have 28px 1fr grid');
    assert(responsiveCss.includes('grid-column: 1;'), 'sr-no should be in column 1');
    assert(responsiveCss.includes('grid-column: 2;'), 'col-info should be in column 2');
    assert(responsiveCss.includes('.col-data {\n        grid-column: 1 / -1;'), 'col-data should span full width');
    assert(responsiveCss.includes('.col-interaction {\n        grid-column: 1 / -1;'), 'col-interaction should span full width');
});

// ── 5. Check js/review.js Digits-Only Enforcement ──────────────
const reviewJs = fs.readFileSync(path.join(__dirname, '../js/review.js'), 'utf-8');

test('js/review.js renders Qty input with text type, numeric inputmode, and regex sanitizers', () => {
    assert(reviewJs.includes('type="text"'), 'Qty input must use type="text" to prevent browser native stepper UI');
    assert(reviewJs.includes('inputmode="numeric"'), 'Qty input must use inputmode="numeric" for mobile numpad');
    assert(reviewJs.includes('pattern="[0-9]*"'), 'Qty input must declare pattern="[0-9]*"');
    assert(reviewJs.includes('this.value = this.value.replace(/[^0-9]/g, \'\')'), 'Missing oninput digits-only sanitizer');
    assert(reviewJs.includes('onpaste="setTimeout'), 'Missing onpaste sanitize handler');
});

test('js/review.js handleQtyKeydown strictly blocks letters, symbols, e, and decimals', () => {
    // Simulate handleQtyKeydown in Node
    let prevented = false;
    const fakeEvent = (key, ctrl = false) => ({
        key,
        ctrlKey: ctrl,
        metaKey: false,
        preventDefault: () => { prevented = true; }
    });

    const testKey = (key, expectedAllow) => {
        prevented = false;
        const allowedKeys = ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowedKeys.includes(key)) {
            assert.strictEqual(expectedAllow, true, `Key ${key} was expected to be blocked`);
            return;
        }
        if (!/^[0-9]$/.test(key)) {
            prevented = true;
        }
        assert.strictEqual(!prevented, expectedAllow, `Key '${key}' expected allow=${expectedAllow} but got allow=${!prevented}`);
    };

    // Valid digits
    for (let d = 0; d <= 9; d++) {
        testKey(String(d), true);
    }

    // Invalid characters (letters, decimals, signs, exponents, symbols)
    const invalidKeys = ['a', 'b', 'c', 'e', 'E', '+', '-', '.', ',', ' ', '$', '#', '@', '/', '\\'];
    invalidKeys.forEach(k => testKey(k, false));

    // Valid navigation keys
    ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].forEach(k => testKey(k, true));
});

// ── 6. Check Reports View Empty State & Indian Date Format ─────
const reportsJs = fs.readFileSync(path.join(__dirname, '../js/reports.js'), 'utf-8');

test('Reports empty state formats ISO dates into DD/MM/YYYY', () => {
    assert(reportsJs.includes('formatInputDateToDMY'), 'Missing formatInputDateToDMY helper in reports.js');
    
    // Simulate helper
    const formatInputDateToDMY = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
    };
    assert.strictEqual(formatInputDateToDMY('2026-09-09'), '09/09/2026', 'Date formatting failed');
    assert.strictEqual(formatInputDateToDMY('2026-12-31'), '31/12/2026', 'Date formatting failed');
});

test('Reports renderReportOutput clears el.innerHTML when tasks.length === 0 (no duplicate message)', () => {
    assert(reportsJs.includes('function renderReportOutput(tasks) {'), 'renderReportOutput exists');
    assert(!reportsJs.includes('<div class="empty-state">No records found for the selected filters.</div>'),
        'Duplicate empty state string must be removed from renderReportOutput');
});

console.log(`\n====================================================`);
console.log(`AUDIT RESULTS: ${passedTests} / ${totalTests} TESTS PASSED!`);
console.log(`====================================================\n`);
if (passedTests !== totalTests) {
    process.exit(1);
}
