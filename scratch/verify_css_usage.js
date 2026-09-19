/**
 * verify_css_usage.js
 * Maps every CSS class/id selector in css/*.css to live-markup usage
 * (index.html + js templates). Reports:
 *  A. DEAD selectors (defined, never used) — safe-delete candidates
 *  B. UNSTYLED live classes (used in markup, no CSS rule) — gap check
 * (Skips: js-constructed dynamic names, :hover variants counted with base.)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssFiles = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css'));
const markup = fs.readFileSync(path.join(root, 'index.html'), 'utf8') +
    fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'))
        .map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');

const dead = [], live = new Map();
cssFiles.forEach(f => {
    const src = fs.readFileSync(path.join(root, 'css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const sels = new Set();
    [...src.matchAll(/\.([A-Za-z][\w-]*)/g)].forEach(m => sels.add(m[1]));
    [...src.matchAll(/#([A-Za-z][\w-]*)/g)].forEach(m => sels.add('#' + m[1]));
    sels.forEach(s => {
        const isId = s.startsWith('#');
        const name = isId ? s.slice(1) : s;
        // usage: class="... name ..." / class='...' / id="name" / 'name' in class strings / .name in JS
        const re = isId
            ? new RegExp(`id=["']${name}["']|getElementById\\(['"]${name}['"]\\)|querySelector\\(['"]#${name}['"]\\)`)
            : new RegExp(`[\\s"'\\\`]${name}(?![\\w-])`);
        if (re.test(markup)) {
            live.set(s, (live.get(s) || []).concat(f));
        } else {
            dead.push({ sel: (isId ? '#' : '.') + name, file: f });
        }
    });
});

console.log('=== DEAD SELECTORS (defined, zero markup hits) ===');
const byFile = {};
dead.forEach(d => { (byFile[d.file] = byFile[d.file] || []).push(d.sel); });
Object.keys(byFile).sort().forEach(f => {
    console.log(`\n${f} [${byFile[f].length}]`);
    console.log('  ' + [...new Set(byFile[f])].join(' '));
});

// B. live classes with no rule (sample: rv-/fl-/ds- families)
console.log('\n=== SPOT-CHECK: markup classes missing any CSS rule ===');
const cssAll = cssFiles.map(f => fs.readFileSync(path.join(root, 'css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
['rv-m-pur', 'rv-undo', 'rv-lock', 'rv-done', 'fl-reopen', 'is-done', 'ws-badge', 'dsp-toast',
 'user-pill-role', 'ds-no-upload', 'ds-no-reports', 'ds-admin', 'in-workspace', 'ds-auth-pending'
].forEach(c => {
    const hasRule = new RegExp(`\\.${c}(?![\\w-])`).test(cssAll);
    console.log(`  ${hasRule ? '✔' : '❌'} .${c}`);
});
console.log('\nDone. Review DEAD list before deleting (dynamic names need eyeballs).');
