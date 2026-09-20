const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleErrors = [];
  const networkFailures = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('requestfailed', request => {
    networkFailures.push(`${request.url()} - ${request.failure()?.errorText}`);
  });
  
  page.on('response', response => {
    if (!response.ok() && response.status() >= 400) {
      networkFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:3006/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'test_password');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    
    const errorText = await page.locator('.text-destructive').textContent().catch(() => null);
    
    console.log('--- RESULTS ---');
    console.log('Current URL:', page.url());
    console.log('Error Displayed on Screen:', errorText);
    console.log('Console Errors:', JSON.stringify(consoleErrors));
    console.log('Failed Network Requests:', JSON.stringify(networkFailures));
    console.log('Supabase rejected credentials:', !!errorText || networkFailures.some(u => u.includes('supabase.co')));
    
  } catch (e) {
    console.log('Script exception:', e);
  } finally {
    await browser.close();
  }
})();
