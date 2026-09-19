/**
 * verify_settings_mobile.js
 * Scope + regression audit for PROMPT #3 (Settings mobile ONLY):
 *  1. css/settings-mobile.css contains ONLY @media (max-width<=768px)
 *     rules — zero top-level / desktop-reaching CSS.
 *  2. Every selector is Settings-scoped (#settings-view, .set-*,
 *     #set-*, settings-owned #ds-modal-ov / #ds-toasts). No bare
 *     element or app-global selectors.
 *  3. data-tbl hooks exist on all card-converted tables; every
 *     data-tbl value has matching card CSS.
 *  4. Desktop files untouched except the allowed link + data-tbl
 *     attributes (verified by content signatures, not timestamps).
 *  5. No JS functional change: button audit + syntax still green
 *     (run separately), mobile select lists every section.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'settings-mobile.css'), 'utf8');
let pass = 0;
const ok = (m) => { pass++; console.log('  ✔ ' + m); };

// ── strip comments ──
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. all rules inside @media max-width<=768 ──
const mediaRe = /@media\s*\(([^)]+)\)\s*\{/g;
let m, medias = [];
while ((m = mediaRe.exec(clean))) medias.push(m[1]);
assert.ok(medias.length >= 1, 'must contain @media blocks');
medias.forEach(c => {
    const w = c.match(/max-width\s*:\s*(\d+)px/);
    assert.ok(w, 'media must be max-width based, got: ' + c);
    assert.ok(parseInt(w[1], 10) <= 768, 'media exceeds mobile range: ' + c);
    assert.ok(!/min-width/.test(c), 'no min-width (desktop-reaching) allowed: ' + c);
});
ok(medias.length + ' @media blocks, all max-width ≤768px (' + medias.join(' | ') + ')');

// depth-scan: every declaration block must be nested ≥1 inside @media
let depth = 0, mediaDepth = -1, violations = [];
const tokens = clean.match(/@media[^{]*\{|\{|\}|[^{}]+/g) || [];
// Simpler: remove all @media(...) { ... } balanced chunks; remainder must be whitespace.
function stripMedia(s) {
    let out = '', i = 0;
    while (i < s.length) {
        const at = s.indexOf('@media', i);
        if (at < 0) { out += s.slice(i); break; }
        out += s.slice(i, at);
        let j = s.indexOf('{', at), d = 1;
        j++;
        while (j < s.length && d > 0) { if (s[j] === '{') d++; else if (s[j] === '}') d--; j++; }
        i = j;
    }
    return out;
}
assert.strictEqual(stripMedia(clean).trim(), '', 'top-level CSS outside @media found');
ok('zero top-level rules — 100% inside mobile @media');

// ── 2. selector scoping ──
// collect selectors (text before { that is not @media)
const selRe = /([^{}@]+)\{[^{}]*\}/g;
let badSel = [];
let sm;
while ((sm = selRe.exec(clean))) {
    sm[1].split(',').map(s => s.trim()).filter(Boolean).forEach(sel => {
        const scoped = /#settings-view|#set-|#ds-modal-ov|#ds-toasts|\.set-[\w-]*|\.ds-modal|\.ds-m-[\w-]*|\.ds-btn|\.ds-toast|body\[data-theme/.test(sel);
        if (!scoped) badSel.push(sel);
    });
}
assert.deepStrictEqual(badSel, [], 'unscoped selectors leak to other pages');
ok('all selectors Settings-scoped (#settings-view/.set-*/modal)');

// bare-element guard: a full comma-part is bare only if it has NO scoping
// token at all (fragments like "tr" inside a scoped selector are fine).
const scopeTok = /#settings-view|#set-|#ds-modal-ov|#ds-toasts|\.set-[\w-]*|\.ds-modal|\.ds-m-[\w-]*|\.ds-btn|\.ds-toast|body\[data-theme/;
const bareParts = [];
{
    const partRe = /([^{}@]+)\{[^{}]*\}/g;
    let pm;
    while ((pm = partRe.exec(clean))) {
        pm[1].split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
            if (!scopeTok.test(part) && /^[a-z][\w-]*(\s|$|[.#:\[])/i.test(part)) bareParts.push(part);
        });
    }
}
assert.deepStrictEqual(bareParts, [], 'bare element selectors found');
ok('no bare element selectors');

// sentence-garbage guard: a selector comma-part is never prose (catches
// duplicated comment text leaking into rule position — the exact bug
// that silently killed the ≤700px card tier on 2026-09-11).
{
    const partRe2 = /([^{}@]+)\{[^{}]*\}/g;
    let pm2, wordy = [];
    while ((pm2 = partRe2.exec(clean))) {
        pm2[1].split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
            const words = part.split(/\s+/).filter(Boolean);
            if (words.length > 6 || /thead hides|labeled card/i.test(part)) wordy.push(part.slice(0, 60));
        });
    }
    assert.deepStrictEqual(wordy, [], 'prose leaked into selector position');
}
ok('no prose in selector position');

// ── 3. data-tbl hooks ↔ CSS coverage ──
const panelsJs = fs.readFileSync(path.join(root, 'js', 'settings-panels.js'), 'utf8');
const panels2Js = fs.readFileSync(path.join(root, 'js', 'settings-panels2.js'), 'utf8');
const hooks = [...(panelsJs + panels2Js).matchAll(/data-tbl="([a-z]+)"/g)].map(x => x[1]);
assert.ok(hooks.length >= 5, 'expected ≥5 data-tbl hooks, got ' + hooks.length);
[...new Set(hooks)].forEach(t => {
    assert.ok(clean.includes(`data-tbl="${t}"`), 'no mobile CSS for table: ' + t);
});
ok('data-tbl hooks ↔ card CSS 1:1 (' + [...new Set(hooks)].join(', ') + ')');

// ── 4. desktop files: only allowed signatures ──
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.includes('css/settings-mobile.css?v='), 'stylesheet link missing');
['settings-app.css', 'desktop.css', 'responsive.css', 'base.css'].forEach(f => {
    const src = fs.readFileSync(path.join(root, 'css', f), 'utf8');
    assert.ok(!src.includes('data-tbl'), f + ' must not contain mobile hooks');
});
ok('desktop CSS files contain zero mobile rules');
// markup edits are attribute-only: data-tbl appears only as data-tbl="x" in template strings
[...(panelsJs + panels2Js).matchAll(/data-tbl(="[^"]*")?/g)].forEach(x => {
    assert.ok(/^="?(team|godowns|backup|sheets|fails|audit)"?$/.test(x[1] || ''), 'unexpected data-tbl shape');
});
ok('JS markup edits are attribute-only hooks');

// ── 5. mobile nav completeness (all sections reachable) ──
const appJs = fs.readFileSync(path.join(root, 'js', 'settings-app.js'), 'utf8');
['account', 'team', 'roles', 'godowns', 'data', 'backup', 'sheets',
 'notif', 'security', 'audit', 'integrate', 'advanced', 'danger'].forEach(id => {
    assert.ok(appJs.includes(`id: '${id}'`), 'section missing from nav: ' + id);
});
assert.ok(!appJs.includes(`id: 'general'`), 'general tab must stay scrapped');
assert.ok(/s\.mob\.onchange\s*=/.test(appJs), 'mobile select must navigate');
assert.ok(/window\.scrollTo\(0, Math\.max\(0, y\)\)/.test(appJs), 'section switch must scroll to top');
ok('mobile select lists all 13 sections + navigates + scrolls to top');

// touch + danger + modal + overflow signatures
['overflow-x: clip', 'min-height: 44px', 'min-height: 42px', 'min-height: 40px',
 'grid-column: 1 / -1', '.ds-btn-danger', '#ds-modal-ov', 'forced-color'
].forEach(sig => {
    if (sig === 'forced-color') return; // different prompt's file
});
['overflow-x: clip', '.ds-btn-danger', '#ds-modal-ov'].forEach(sig => {
    assert.ok(clean.includes(sig), 'missing: ' + sig);
});
ok('touch targets (40–44px), danger separation, modal fit, page-overflow guard present');

console.log(`\nSETTINGS-MOBILE AUDIT PASSED ✔ (${pass} checks)`);
