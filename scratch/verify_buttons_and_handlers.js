/**
 * verify_buttons_and_handlers.js
 * Automated response audit:
 *  1. Every onclick=/onchange=/oninput=/onsubmit= handler root used in
 *     index.html + js/*.js must resolve to a real definition.
 *  2. Every getElementById('x') target must exist in index.html or be
 *     created dynamically in js (id= assignments / templates).
 * Exit 0 = all handlers resolve. Unknown IDs are listed for triage
 * (many are intentionally dynamic).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
const jsAll = jsFiles.map(f => ({ f, src: fs.readFileSync(path.join(root, 'js', f), 'utf8') }));

let failures = 0;
const ok = (m) => console.log('  ✔ ' + m);
const bad = (m) => { console.error('  ❌ ' + m); failures++; };

// ── 1. Collect handler roots from on* attributes ──
const handlerUses = new Map(); // root -> [locations]
const attrRe = /on(click|change|input|submit|keydown|keyup|paste)="([^"]*)"/g;
function collectHandlers(text, loc) {
    let m;
    attrRe.lastIndex = 0;
    while ((m = attrRe.exec(text))) {
        const code = m[2];
        // root identifiers: foo(...) or A.B(...) or document... / if(...) guards
        const roots = [...code.matchAll(/(?:^|[;:,?]\s*|if\s*\(\s*|\)\s*|^\s*)([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g)]
            .map(x => x[1])
            .filter(r => !/^(if|for|while|switch|function)$/.test(r));
        // also bare property sets like document.getElementById('x').value='y'
        roots.forEach(r => {
            if (!handlerUses.has(r)) handlerUses.set(r, []);
            handlerUses.get(r).push(loc);
        });
    }
}
collectHandlers(html, 'index.html');
jsAll.forEach(({ f, src }) => collectHandlers(src, 'js/' + f));

// ── 2. Resolve each root ──
function isDefined(root) {
    if (root === 'document.getElementById' || root === 'document.querySelector' ||
        root === 'document.createElement' || root.startsWith('document.') ||
        root.startsWith('window.') || root === 'confirm' || root === 'alert' ||
        root === 'setTimeout' || root === 'console.warn' || root === 'console.log') return true;
    const parts = root.split('.');
    if (parts.length === 1) {
        const name = parts[0];
        const re = new RegExp(`(function\\s+${name}\\s*\\(|window\\.${name}\\s*=|var\\s+${name}\\s*=|let\\s+${name}\\s*=|const\\s+${name}\\s*=)`);
        return jsAll.some(({ src }) => re.test(src));
    }
    // A.B(.C): base must exist as window.A / var A / namespace, leaf as key/def
    const [base, ...rest] = parts;
    const leaf = rest[rest.length - 1];
    const baseRe = new RegExp(`(window\\.${base}\\s*=|var\\s+${base}\\s*=|let\\s+${base}\\s*=|const\\s+${base}\\s*=|function\\s+${base}\\s*\\(|${base}\\s*=\\s*\\{)`);
    const leafRe = new RegExp(`(\\b${leaf}\\s*[:=]\\s*function|\\b${leaf}\\s*\\(|["']${leaf}["']\\s*:|\\.${leaf}\\s*=)`);
    const baseOk = jsAll.some(({ src }) => baseRe.test(src));
    const leafOk = jsAll.some(({ src }) => leafRe.test(src));
    return baseOk && leafOk;
}

console.log('HANDLERS (' + handlerUses.size + ' distinct roots):');
[...handlerUses.keys()].sort().forEach(r => {
    if (isDefined(r)) ok(r);
    else bad(r + '  <-- used at ' + handlerUses.get(r).slice(0, 3).join(', '));
});

// ── 3. Element ID cross-check ──
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const dynIds = new Set();
jsAll.forEach(({ src }) => {
    [...src.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].forEach(m => dynIds.add(m[1]));
    [...src.matchAll(/id="([A-Za-z][\w-]*)"/g)].forEach(m => dynIds.add(m[1]));
    [...src.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]/g)].forEach(m => {
        // template-literal dynamic ids like `row-item_${...}` — record prefix
        if (/[$+{}]/.test(m[1])) dynIds.add(m[1]);
    });
});
const needed = new Map();
jsAll.forEach(({ f, src }) => {
    [...src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]/g)].forEach(m => {
        if (!needed.has(m[1])) needed.set(m[1], []);
        needed.get(m[1]).push('js/' + f);
    });
});
console.log('\nIDS needed by JS: ' + needed.size);
const missing = [];
[...needed.keys()].sort().forEach(id => {
    if (htmlIds.has(id) || dynIds.has(id)) ok('#' + id);
    else missing.push(id + '  <-- ' + needed.get(id).slice(0, 3).join(', '));
});
if (missing.length) {
    console.log('\nIDS NOT in index.html and not obviously dynamic (' + missing.length + '):');
    missing.forEach(m => console.log('  ? ' + m));
}

console.log('\n' + (failures === 0 ? 'ALL HANDLERS RESOLVE ✔' : failures + ' UNRESOLVED HANDLER(S) ❌'));
process.exit(failures === 0 ? 0 : 1);
