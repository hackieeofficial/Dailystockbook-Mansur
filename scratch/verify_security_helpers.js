/**
 * verify_security_helpers.js
 * Regression test for 2026-09-11 hardening: DSEsc / DSEscJs /
 * DSDownload.cell from js/app.js (loaded for real, with storage.js).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const store = {};
const sandbox = {
    console,
    localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    window: { addEventListener: () => {}, scrollTo: () => {} },
    document: { documentElement: { style: { setProperty: () => {} } }, querySelector: () => null },
    history: {}
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8'), sandbox);
const { DSEsc, DSEscJs, DSDownload } = sandbox.window;

assert.strictEqual(typeof DSEsc, 'function', 'DSEsc defined');
assert.strictEqual(typeof DSEscJs, 'function', 'DSEscJs defined');
assert.strictEqual(typeof DSDownload.csv, 'function', 'DSDownload.csv defined');

// HTML text + attribute slots
assert.strictEqual(
    DSEsc('<img src=x onerror="y(\'z\')">&'),
    '&lt;img src=x onerror=&quot;y(&#39;z&#39;)&quot;&gt;&amp;'
);
// JS single-quoted string slots (entities would NOT protect here)
assert.strictEqual(DSEscJs("o'brien@x.com"), "o\\'brien@x.com");
assert.strictEqual(DSEscJs('a\\b'), 'a\\\\b');
// CSV formula-injection guard + quoting
assert.strictEqual(DSDownload.cell("=cmd|'/c calc'!A0"), "\"'=cmd|'/c calc'!A0\"");
assert.strictEqual(DSDownload.cell('+123'), "\"'+123\"");
assert.strictEqual(DSDownload.cell('Normal 12" box'), '"Normal 12"" box"');
assert.strictEqual(DSDownload.cell(null), '""');
assert.strictEqual(DSDownload.cell(0), '"0"');

console.log('SECURITY HELPERS OK ✔ (DSEsc, DSEscJs, DSDownload.cell)');
