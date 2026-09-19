// scratch/qa_probe2.js — follow-up probes (NOT a Reticle verdict).
// Run: $env:NODE_PATH="$(npm root -g)"; node scratch/qa_probe2.js
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Users\\Dhurvesh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const bad = [];
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => bad.push('FAILED ' + r.url() + ' ' + (r.failure() || {}).errorText));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
      .filter(b => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.title)
      .map(b => b.id ? '#' + b.id : (b.className ? '.' + String(b.className).split(' ').join('.') : b.outerHTML.slice(0, 80)));
    const appOverflow = [...document.querySelectorAll('body *:not([class*="reticle"])')].filter(e => {
      if (e.closest('[class*="reticle"]')) return false;
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.position !== 'fixed' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0;
    }).slice(0, 10).map(e => (e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName) +
      ' sw=' + e.scrollWidth + ' cw=' + e.clientWidth);
    // login form validation attrs
    const em = document.getElementById('ds-login-email'), pw = document.getElementById('ds-login-pass');
    const form = { emailType: em && em.type, emailReq: em && em.required, passType: pw && pw.type, passReq: pw && pw.required };
    // empty-login submit behaviour: click with empty fields, capture msg
    const btn = document.getElementById('ds-login-btn');
    let msgBefore = document.getElementById('ds-login-msg') ? document.getElementById('ds-login-msg').textContent : null;
    if (btn) btn.click();
    return { namelessButtons: btns, appOverflow, form };
  });
  await page.waitForTimeout(2500);
  data.msgAfterEmptySubmit = await page.evaluate(() =>
    document.getElementById('ds-login-msg') ? document.getElementById('ds-login-msg').textContent : null);
  data.badRequests = bad;
  console.log(JSON.stringify(data, null, 1));
  await browser.close();
})().catch(e => { console.error('QA_PROBE2_FAILED: ' + e.message); process.exit(1); });
