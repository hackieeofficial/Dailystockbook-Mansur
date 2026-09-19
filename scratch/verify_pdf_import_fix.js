/**
 * verify_pdf_import_fix.js
 * Regression test for the 2026-09-11 pdf-parser fix.
 * Feeds synthetic PDF.js text items that mirror the REAL problem rows
 * from the 05/09/2026 sheet (BAJAJ Sr 17, NATIONAL Sr 94 pur-only,
 * zero-balance, normal sold rows, "BRANDED" product name trap,
 * split "Brand :" header) through the ACTUAL js/pdf-parser.js
 * extractDataFromPDF() and asserts every Sr row is imported with
 * correct pur/opening/sold/balance numbers.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// ── Column layout mirroring the real PDFs ──
const X = { sr: 30, prod: 70, opening: 300, pur: 360, sold: 420, mrp: 500, rate: 560, bal: 640 };
function T(text, x, y) { return { str: text, transform: [1, 0, 0, 1, x, y] }; }

let y = 800;
const Y = () => (y -= 22);

function buildItems() {
    const items = [];
    // Page header junk (must be ignored, date must be found)
    items.push(T('MANSUR ENTERPRISES', 70, Y()));
    items.push(T('Sales-Purchase-Stock Summary From 05/09/2026 to 05/09/2026', 70, Y()));
    items.push(T('Print Date :  9/8/26', 500, Y()));
    items.push(T('Page 1 of 16', 500, Y()));
    // Column headers
    const hy = Y();
    items.push(T('Sr.', X.sr, hy)); items.push(T('Product', X.prod, hy));
    items.push(T('Opening', X.opening, hy)); items.push(T('Pur Qty', X.pur, hy));
    items.push(T('Sold Qty', X.sold, hy)); items.push(T('MRP', X.mrp, hy));
    items.push(T('Sale Rate', X.rate, hy)); items.push(T('Balance Qty', X.bal, hy));

    // Brand (single-item form)
    items.push(T('Brand : NATIONAL', X.prod, Y()));

    // Sr 94 — PURCHASE-ONLY (was DROPPED before fix): opening blank, pur 2, sold blank, bal 2
    items.push(T('94', X.sr, Y()));
    let r1 = Y();
    items.push(T('1" BLUE CHOPPING BOARD', X.prod, r1));
    items.push(T('2.00', X.pur, r1)); items.push(T('1,450.00', X.mrp, r1));
    items.push(T('1,450.00', X.rate, r1)); items.push(T('2.00', X.bal, r1));
    items.push(T('18X12X1" CHOPPING BOARD', X.prod, Y())); // 2nd desc line
    items.push(T('Total', X.prod, Y()));
    items.push(T('10.00', X.opening, y)); items.push(T('38.00', X.pur, y));

    // Brand (split two-item form: "Brand :" + name)
    const by = Y();
    items.push(T('Brand :', X.prod, by)); items.push(T('XYZ', X.prod + 60, by));

    // Sr 177-style — opening 1, pur 198, sold blank, bal 199 (was DROPPED before fix)
    items.push(T('177', X.sr, Y()));
    let r2 = Y();
    items.push(T('1PC PLACE MAT / TABLE MAT', X.prod, r2));
    items.push(T('1.00', X.opening, r2)); items.push(T('198.00', X.pur, r2));
    items.push(T('108.00', X.mrp, r2)); items.push(T('108.00', X.rate, r2));
    items.push(T('199.00', X.bal, r2));
    items.push(T('1PC PLACE MAT / TABLE MAT', X.prod, Y()));

    // Normal sold row — opening 47, sold 2, bal 45
    items.push(T('1', X.sr, Y()));
    let r3 = Y();
    items.push(T('BLACK MATT MINISO OVAL BOWL', X.prod, r3));
    items.push(T('47.00', X.opening, r3)); items.push(T('2.00', X.sold, r3));
    items.push(T('58.00', X.mrp, r3)); items.push(T('58.00', X.rate, r3));
    items.push(T('45.00', X.bal, r3));
    items.push(T('4EVER 3.5X2.75" MINISO OVAL BOWL', X.prod, Y()));

    // Zero-balance row — opening 1, sold 1, balance blank (=0, sold out)
    items.push(T('19', X.sr, Y()));
    let r4 = Y();
    items.push(T('SC500F', X.prod, r4));
    items.push(T('1.00', X.opening, r4)); items.push(T('1.00', X.sold, r4));
    items.push(T('58,000.00', X.mrp, r4)); items.push(T('58,000.00', X.rate, r4));
    items.push(T('BLUESTAR 500L SINGLE DOOR SUPERCOOLER', X.prod, Y()));

    // "BRANDED" trap — product starting with Brand-letters must NOT reset brand
    items.push(T('200', X.sr, Y()));
    let r5 = Y();
    items.push(T('BRANDED STEEL MUG', X.prod, r5));
    items.push(T('5.00', X.opening, r5)); items.push(T('1.00', X.sold, r5));
    items.push(T('200.00', X.mrp, r5)); items.push(T('200.00', X.rate, r5));
    items.push(T('4.00', X.bal, r5));
    items.push(T('BRANDED MUG LARGE', X.prod, Y()));

    items.push(T('Grand Total', X.prod, Y()));
    return items;
}

// ── Fake PDF.js document ──
const pageItems = buildItems();
const fakePdf = {
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: pageItems }) })
};

// ── Browser-ish sandbox for the REAL parser source ──
let savedReports = null;
const els = { 'upload-status': { innerHTML: '' }, 'pdf-upload': { files: [], value: '', addEventListener: () => {} } };
const sandbox = {
    console,
    pdfjsLib: { GlobalWorkerOptions: {} },
    document: { getElementById: (id) => els[id] || { innerHTML: '', value: '' } },
    alert: (m) => { throw new Error('ALERT: ' + m); },
    productMaster: {},
    configuredGodowns: [],
    dailyReports: {},
    currentDateView: null,
    saveDailyReports: (r) => { savedReports = r; },
    renderCalendar: () => {},
    loadDateWorkspace: () => {},
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pdf-parser.js'), 'utf8');
vm.runInContext(src, sandbox);

(async () => {
    await vm.runInContext('extractDataFromPDF(pdf)', Object.assign(sandbox, { pdf: fakePdf }));
    const rep = savedReports['05/09/2026'];
    assert(rep, 'report 05/09/2026 must be saved');
    const ex = rep.extracted;
    console.log('Imported rows:', ex.length);
    ex.forEach(p => console.log(` - ${p.brand} | ${p.code} | opn=${p.opening} pur=${p.purQty} sold=${p.soldQty} bal=${p.balanceQty}`));

    assert.strictEqual(ex.length, 5, `ALL 5 Sr rows must be imported (got ${ex.length})`);

    const nat = ex.find(p => p.code === '1" BLUE CHOPPING BOARD');
    assert(nat, 'pur-only NATIONAL row imported');
    assert.strictEqual(nat.opening, 0);
    assert.strictEqual(nat.purQty, 2, 'pur qty parsed, not mis-assigned');
    assert.strictEqual(nat.soldQty, 0, 'blank sold stays 0 (no phantom sold)');
    assert.strictEqual(nat.balanceQty, 2);
    assert.strictEqual(nat.category, '18X12X1" CHOPPING BOARD');

    const mat = ex.find(p => p.code === '1PC PLACE MAT / TABLE MAT');
    assert(mat, 'opening+pur row imported');
    assert.strictEqual(mat.brand, 'XYZ', 'split Brand header parsed');
    assert.strictEqual(mat.opening, 1);
    assert.strictEqual(mat.purQty, 198);
    assert.strictEqual(mat.soldQty, 0);
    assert.strictEqual(mat.balanceQty, 199);

    const nrm = ex.find(p => p.code === 'BLACK MATT MINISO OVAL BOWL');
    assert(nrm, 'normal sold row imported');
    assert.strictEqual(nrm.opening, 47);
    assert.strictEqual(nrm.soldQty, 2);
    assert.strictEqual(nrm.balanceQty, 45);
    assert.strictEqual(nrm.purQty, 0);

    const zb = ex.find(p => p.code === 'SC500F');
    assert(zb, 'zero-balance row imported');
    assert.strictEqual(zb.balanceQty, 0);

    const br = ex.find(p => p.code === 'BRANDED STEEL MUG');
    assert(br, 'BRANDED product imported');
    assert.strictEqual(br.brand, 'XYZ', 'BRANDED product must NOT reset brand');

    assert(els['upload-status'].innerHTML.includes('5 items'), 'status shows 5 items');
    console.log('\nALL PDF IMPORT FIX TESTS PASSED ✔ (5/5 Sr rows, pur parsed, no drops)');
})().catch(e => { console.error('❌ FAIL:', e.message); process.exit(1); });
