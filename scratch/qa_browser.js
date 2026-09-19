// scratch/qa_browser.js — headless-Chromium QA observation pass (NOT a Reticle verdict).
// Run: $env:NODE_PATH="$(npm root -g)"; node scratch/qa_browser.js
// Checks: console/page errors, login render, hidden-select contract, dead
// onclick handlers, button names, horizontal overflow (390 + 1440), focus ring.
const { chromium } = require('playwright-core');

const CHROME = 'C:\\Users\\Dhurvesh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/';
const CONTRACT_IDS = [
  'filter-search', 'filter-brand', 'filter-status',
  'filter-final-godown', 'filter-final-status',
  'date-report-user-filter', 'date-report-status-filter',
  'report-from-date', 'report-to-date', 'report-user-filter',
  'report-godown-filter', 'report-status-filter', 'report-view-filter',
  'ds-login-email', 'ds-login-pass', 'ds-login-btn', 'ds-login-msg',
  'pdf-upload', 'calendar-grid', 'review-list', 'final-tbody',
  'report-output', 'set-nav', 'set-panel'
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const out = { url: URL, viewports: [] };
  for (const vp of [{ w: 390, h: 844, name: 'mobile' }, { w: 1440, h: 900, name: 'desktop' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errors = [], warnings = [], pageerrors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 300));
      else if (m.type() === 'warning') warnings.push(m.text().slice(0, 200));
    });
    page.on('pageerror', e => pageerrors.push(String(e).slice(0, 300)));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const data = await page.evaluate((ids) => {
      const r = {};
      r.title = document.title;
      r.loginVisible = !!(document.querySelector('#ds-login-view.visible') || document.querySelector('#ds-login-view'));
      const lv = document.getElementById('ds-login-view');
      r.loginDisplay = lv ? getComputedStyle(lv).display : 'MISSING';
      r.authPending = document.body.classList.contains('ds-auth-pending');
      r.missingIds = ids.filter(id => !document.getElementById(id));
      // dead onclick handlers
      const els = [...document.querySelectorAll('[onclick]')];
      const names = new Set();
      els.forEach(el => {
        const m = (el.getAttribute('onclick') || '').match(/^([A-Za-z_$][\w$]*)\s*\(/);
        if (m) names.add(m[1]);
      });
      r.onclickCount = els.length;
      r.deadHandlers = [...names].filter(n => typeof window[n] !== 'function');
      // buttons without accessible name
      r.namelessButtons = [...document.querySelectorAll('button')].filter(b =>
        !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.title).length;
      r.buttonCount = document.querySelectorAll('button').length;
      // overflow
      r.docScrollW = document.documentElement.scrollWidth;
      r.innerW = window.innerWidth;
      r.overflowEls = [...document.querySelectorAll('body *')].filter(e => {
        const s = getComputedStyle(e);
        return s.display !== 'none' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0;
      }).slice(0, 10).map(e => (e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName));
      // focus ring on login email
      const em = document.getElementById('ds-login-email');
      let focus = null;
      if (em) {
        em.focus();
        const cs = getComputedStyle(em);
        focus = { outline: cs.outlineWidth + ' ' + cs.outlineStyle, boxShadow: cs.boxShadow, border: cs.borderColor };
      }
      r.focusStyle = focus;
      r.flatLoaded = !!document.querySelector('link[href*="flat.css"]');
      return r;
    }, CONTRACT_IDS);
    out.viewports.push({ viewport: vp.name, width: vp.w, consoleErrors: errors, consoleWarnings: warnings.slice(0, 5), pageErrors: pageerrors, ...data });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('QA_SCRIPT_FAILED: ' + e.message); process.exit(1); });
