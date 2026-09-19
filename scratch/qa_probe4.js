// scratch/qa_probe4.js — pinpoint the overflowing DIV (NOT a Reticle verdict).
// Run: $env:NODE_PATH="$(npm root -g)"; node scratch/qa_probe4.js
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Users\\Dhurvesh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const t = [...document.querySelectorAll('body *')].find(e => {
      if (e.closest('[class*="reticle"]')) return false;
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.position !== 'fixed' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0;
    });
    if (!t) return { found: false };
    const chain = [];
    let n = t;
    while (n && n !== document.body && chain.length < 7) {
      const cs = getComputedStyle(n);
      chain.unshift({ tag: n.tagName, id: n.id || null, cls: (n.className && n.className.baseVal !== undefined ? '' : String(n.className || '')).slice(0, 80), w: cs.width, ws: cs.whiteSpace, pos: cs.position });
      n = n.parentElement;
    }
    const kids = [...t.children].slice(0, 6).map(c => ({ tag: c.tagName, id: c.id || null, cls: String(c.className || '').slice(0, 60), sw: c.scrollWidth, cw: c.clientWidth }));
    return { found: true, html: t.outerHTML.slice(0, 300), chain, kids };
  });
  console.log(JSON.stringify(data, null, 1));
  await browser.close();
})().catch(e => { console.error('QA_PROBE4_FAILED: ' + e.message); process.exit(1); });
