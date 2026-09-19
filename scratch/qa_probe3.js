// scratch/qa_probe3.js — overflow-DIV identity + fix confirmation (NOT a Reticle verdict).
// Run: $env:NODE_PATH="$(npm root -g)"; node scratch/qa_probe3.js
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Users\\Dhurvesh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const bad = [];
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const path = (e) => {
      const parts = [];
      let n = e;
      while (n && n !== document.body && parts.length < 5) {
        parts.unshift(n.id ? '#' + n.id : n.className ? '.' + String(n.className).split(' ').slice(0, 2).join('.') : n.tagName);
        n = n.parentElement;
      }
      return parts.join(' > ');
    };
    const over = [...document.querySelectorAll('body *')].filter(e => {
      if (e.closest('[class*="reticle"]')) return false;
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.position !== 'fixed' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0;
    }).map(e => ({ path: path(e), sw: e.scrollWidth, cw: e.clientWidth, ml: getComputedStyle(e).marginLeft, mr: getComputedStyle(e).marginRight }));
    const em = document.getElementById('ds-login-email');
    em.focus();
    const cs = getComputedStyle(em);
    const sold = document.getElementById('rfm-sold');
    return {
      overflow: over,
      docScrollW: document.documentElement.scrollWidth,
      focusOutline: cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor,
      rfmSoldLabel: sold ? sold.getAttribute('aria-label') : 'MISSING',
      favicon: document.querySelector('link[rel="icon"]') ? document.querySelector('link[rel="icon"]').getAttribute('href') : 'MISSING'
    };
  });
  data.badRequests = bad;
  console.log(JSON.stringify(data, null, 1));
  await browser.close();
})().catch(e => { console.error('QA_PROBE3_FAILED: ' + e.message); process.exit(1); });
