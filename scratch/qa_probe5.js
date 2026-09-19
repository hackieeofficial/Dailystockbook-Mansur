// scratch/qa_probe5.js — invalid-login error path (NOT a Reticle verdict).
// Uses a bogus account: exercises submit -> Supabase -> error msg -> busy reset.
// Run: $env:NODE_PATH="$(npm root -g)"; node scratch/qa_probe5.js
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Users\\Dhurvesh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#ds-login-email', 'qa-nonexistent@example.com');
  await page.fill('#ds-login-pass', 'WrongPass123!');
  // NOTE: Reticle's dev overlay intercepts real pointer clicks in this
  // environment, so dispatch the click via JS (same handler chain).
  await page.evaluate(() => document.getElementById('ds-login-btn').click());
  await page.waitForTimeout(8000);
  const data = await page.evaluate(() => ({
    msg: document.getElementById('ds-login-msg') ? document.getElementById('ds-login-msg').textContent : 'MISSING',
    btnLabel: document.getElementById('ds-login-btn-label') ? document.getElementById('ds-login-btn-label').textContent : 'MISSING',
    stillPending: document.body.classList.contains('ds-auth-pending'),
    passType: document.getElementById('ds-login-pass').type
  }));
  data.pageErrors = errs;
  console.log(JSON.stringify(data, null, 1));
  await browser.close();
})().catch(e => { console.error('QA_PROBE5_FAILED: ' + e.message); process.exit(1); });
