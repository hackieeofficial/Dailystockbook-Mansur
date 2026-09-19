/**
 * verify_login_redesign.js
 * Guards the premium login redesign: functional id contract, desktop
 * two-panel layout, purpose-built mobile tier, CSS scoping, real
 * remember/forgot wiring, storage adapter and cache busters.
 * Run: node scratch/verify_login_redesign.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        console.log(`✔ [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
}

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf-8');
const html = read('index.html');
const css = read('css/login.css');
const desktopCss = read('css/desktop.css');
const auth = read('js/supabase-auth.js');
const client = read('js/supabase-client.js');

test('Login markup keeps every functional id', () => {
    ['ds-login-view', 'ds-login-email', 'ds-login-pass', 'ds-login-show', 'ds-login-btn',
        'ds-login-btn-label', 'ds-login-msg', 'ds-login-remember', 'ds-login-forgot'].forEach(id => {
        assert(html.includes(`id="${id}"`), `missing #${id}`);
    });
    assert(html.includes('class="ds-login-sidebar"'), 'brand panel missing');
    assert(html.includes('class="ds-login-main"'), 'auth panel missing');
});

test('Desktop uses two-panel beige surface with viewport-fit, no scroll', () => {
    assert(css.includes('grid-template-columns: minmax(380px, .92fr) minmax(420px, 1.08fr)'), 'two-panel grid missing');
    assert(css.includes('height: min(720px, calc(100vh - 40px))'), 'viewport-fit card height missing');
    assert(css.includes('.ds-login-flow'), 'operations visual missing');
    assert(css.includes('@media (min-width: 901px) and (max-height: 800px)'), 'short-laptop tier missing');
    assert(css.includes('overflow: hidden;'), 'desktop must not scroll');
    assert(css.includes('0 3px 0 #16389b'), '3D button edge missing');
    assert(css.includes('#f8f3e9'), 'beige background missing');
    assert(css.includes('justify-content: flex-start;'), 'left panel must be top-aligned (no centered dead gaps)');
    assert(css.includes('margin-top: auto;'), 'footer must pin to bottom (no trailing blank)');
    assert(html.includes('class="ds-login-side-meta"'), 'product-detail strip missing');
    ['PDF ingest', 'Opening · Purchase · Sold · Balance', 'Team + cloud', 'A5 output'].forEach(t => {
        assert(html.includes(t), 'detail missing: ' + t);
    });
    assert(html.includes('class="ds-login-side-points"'), 'details checklist missing');
    ['Daily Book calendar', 'Refill list', 'cross-date reports', 'Access + audit'].forEach(t => {
        assert(html.includes(t), 'checklist detail missing: ' + t);
    });
    assert(css.includes('.ds-login-side-points'), 'checklist styling missing');
    assert(css.includes('.ds-login-flow-row { flex: 1 1 0;'), 'flow rows must stretch on short screens');
    const shortTier = css.slice(css.indexOf('@media (min-width: 901px) and (max-height: 800px)'), css.indexOf('@media (max-width: 900px)'));
    assert(!/\.ds-login-side-meta \{ display: none/.test(shortTier), 'short tier must not hide the detail strip');
    assert(!/\.ds-login-side-points \{ display: none/.test(shortTier), 'short tier must not hide the checklist');
});

test('Mobile layout is purpose-built (<=900px), not a squeezed desktop', () => {
    assert(css.includes('@media (max-width: 900px)'), 'mobile tier missing');
    assert(/\.ds-login-sidebar-body,\s*\n\s*\.ds-login-sidebar-foot \{ display: none; \}/.test(css), 'sidebar body/foot must collapse');
    assert(css.includes('backdrop-filter: blur(16px)'), 'mobile glass auth card missing');
    assert(css.includes('#f8f3e9'), 'mobile beige background missing');
    assert(css.includes('.ds-login-feat-card'), 'mobile feature cards missing');
    assert(css.includes('env(safe-area-inset-bottom'), 'safe-area padding missing');
    assert(css.includes('@media (max-width: 360px)'), '320px tightening tier missing');
});

test('Mobile composition: tagline, features, legal footer (security note removed)', () => {
    assert(html.includes('class="ds-login-side-tagline"'), 'mobile tagline missing');
    assert(html.includes('Simple stock management for a smarter business.'), 'tagline copy missing');
    assert(html.includes('class="ds-login-feats"'), 'quick feature cards missing');
    ['Cloud Sync', 'Refill Tracking', 'A5 Print'].forEach(f => {
        assert(html.includes(f), 'feature missing: ' + f);
    });
    assert(!html.includes('Secure staff access'), 'security card should be removed');
    assert(!html.includes('Unauthorized access is not allowed'), 'security copy should be removed');
    assert(!html.includes('ds-login-secure'), 'security markup/CSS hook should be removed');
    assert(html.includes('Reliable • Simple • Built for your business'), 'legal footer line missing');
    assert(html.includes('© 2026 Mansur Enterprises. All rights reserved.'), 'copyright line missing');
    assert(css.includes('.ds-login-mfoot { display: none; }'), 'mobile-only blocks must be desktop-hidden');
});

test('Visual hierarchy uses one operations visual on desktop', () => {
    assert(html.includes('class="ds-login-flow"'), 'operations visual markup missing');
    assert(!html.includes('class="ds-login-trust"'), 'old repeated trust-card strip should be removed');
    assert(!css.includes('.ds-login-trust'), 'old repeated trust-card styling should be removed');
});

test('Mobile tutorial explains the workflow in plain words', () => {
    assert(html.includes('class="ds-login-how"'), 'how-it-works section missing');
    assert(html.includes('How this app works'), 'tutorial title missing');
    assert(html.includes('class="ds-login-how-steps"'), 'tutorial steps missing');
    ['Open the day in the Book', 'Upload the daily PDF', 'Review each item', 'Confirm the refill', 'Finish in Refill list and Reports'].forEach(s => {
        assert(html.includes(s), 'tutorial step missing: ' + s);
    });
    assert(/\.ds-login-how,\s*\n\.ds-login-mfoot \{ display: none; \}/.test(css), 'tutorial must stay hidden on desktop');
    assert(!/\.ds-login-how-steps[^}]*display:\s*none/.test(css), 'tutorial steps must not be hidden');
});

test('Login copy avoids repeated brand and access wording', () => {
    assert(html.includes('Staff portal'), 'staff portal context missing');
    assert(!html.includes('Internal portal'), 'internal portal pill should stay removed');
    assert(!html.includes('Private access'), 'private access pill should stay removed');
    assert(!html.includes('ds-login-card-top'), 'card-top strip should stay removed');
    assert(!html.includes('ds-login-side-badge'), 'side badge should stay removed');
    assert(!css.includes('.ds-login-card-top'), 'card-top CSS should stay removed');
    assert(!css.includes('.ds-login-side-badge'), 'side badge CSS should stay removed');
    assert(!css.includes('.ds-login-private'), 'private pill CSS should stay removed');
    assert(!html.includes('Mansur Enterprises · Daily Stock Book'), 'brand/product line is repeated in the auth sheet');
    assert(!html.includes('Protected workspace'), 'old security card wording should stay removed');
});

test('Every login.css rule is scoped to login/boot (no global leakage)', () => {
    let s = css.replace(/\/\*[\s\S]*?\*\//g, '');
    s = s.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
    const lines = s.split('\n').filter(l => !/^\s*@/.test(l)).join('\n');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    const bad = [];
    while ((m = re.exec(lines))) {
        m[1].split(',').map(x => x.trim()).filter(Boolean).forEach(sel => {
            if (!/^(body\.ds-auth-pending|#ds-login|\.ds-login|#ds-boot|\.ds-boot)/.test(sel)) bad.push(sel);
        });
    }
    assert.deepStrictEqual(bad, [], 'unscoped selectors: ' + bad.join(' | '));
});

test('Auth JS: busy label, icon toggle aria, remember + forgot wired', () => {
    assert(auth.includes("_el('ds-login-btn-label')"), 'busy label span not used');
    assert(auth.includes("setAttribute('aria-pressed'"), 'eye toggle aria missing');
    assert(auth.includes("_el('ds-login-forgot')"), 'forgot not wired');
    assert(auth.includes("_el('ds-login-remember')"), 'remember not wired');
    assert(auth.includes('mansurKeepSignedIn'), 'keep-signed-in flag missing');
});

test('Forgot password is a real Supabase flow (no fake button)', () => {
    assert(auth.includes('window.DSAuth.resetPasswordForEmail(email)'), 'doForgot must call DSAuth.resetPasswordForEmail');
    assert(auth.includes("location.protocol !== 'file:'"), 'file:// redirect guard missing');
});

test('Remember-me persistence adapter wired into Supabase client', () => {
    assert(client.includes('function _authStorage()'), 'adapter missing');
    assert(client.includes('auth: { storage: _authStorage() }'), 'adapter not passed to createClient');
    assert(client.includes("sessionStorage.getItem('mansurKeepSignedIn') === '0'"), 'flag read missing');
    assert(client.includes('if (s === sessionStorage) { try { localStorage.removeItem(k); } catch (e) {} }'), 'stale-token guard missing');
});

test('Cache busters bumped for changed assets', () => {
    assert(html.includes('css/login.css?v=28'), 'login.css v28 missing');
    assert(html.includes('css/desktop.css?v=16'), 'desktop.css v16 missing');
    assert(html.includes('js/supabase-auth.js?v=7'), 'supabase-auth v7 missing');
    assert(html.includes('js/supabase-client.js?v=24'), 'supabase-client v24 missing');
});

test('Desktop sheen rule no longer overrides the login button gradient', () => {
    assert(!/\.rp-generate[^}]*#ds-login-btn/.test(desktopCss), 'desktop.css still targets #ds-login-btn');
});

test('Login controls stay JS-wired (no inline onclick added)', () => {
    ['onclick="doLogin', 'onclick="togglePass', 'onclick="doForgot'].forEach(h => {
        assert(!html.includes(h), 'unexpected inline handler: ' + h);
    });
});

console.log(`\nLOGIN REDESIGN AUDIT: ${passed} / ${total} PASSED`);
if (passed !== total) process.exit(1);
