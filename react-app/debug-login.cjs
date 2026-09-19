const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3006/login');
  await page.fill('input[type="email"]', 'admin@mansur.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  const error = await page.locator('.text-destructive').textContent().catch(()=>null);
  console.log('ERROR:', error);
  console.log('URL:', page.url());
  await browser.close();
})();
