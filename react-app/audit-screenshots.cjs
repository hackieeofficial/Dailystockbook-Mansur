const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3006';
const OUTPUT_DIR = path.join(__dirname, 'audit_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const viewports = [
  { width: 360, height: 800, name: '360_Mobile' },
  { width: 390, height: 844, name: '390_Mobile' },
  { width: 768, height: 1024, name: '768_Tablet' },
  { width: 1440, height: 900, name: '1440_Desktop' }
];

const screens = [
  { name: 'Login', path: '/login', needsAuth: false },
  { name: 'Calendar', path: '/', needsAuth: true },
  { name: 'Workspace', path: '/workspace/05%2F09%2F2026', needsAuth: true },
  { name: 'Reports', path: '/reports', needsAuth: true },
  { name: 'Upload', path: '/upload', needsAuth: true },
  { name: 'Settings', path: '/settings', needsAuth: true }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Inject mock auth token into context so we can view the pages
  await context.addInitScript(() => {
    window.localStorage.setItem('mansurActiveUser', JSON.stringify({ id: 'test-user-id', email: 'test@example.com', role: 'admin' }));
  });

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    for (const screen of screens) {
      console.log(`Capturing ${screen.name} at ${vp.name}...`);
      await page.goto(`${BASE_URL}${screen.path}`);
      
      // Wait a bit for layout to settle, maybe some skeleton loading
      await page.waitForTimeout(1000);
      
      // Try to hide toast notifications or loading overlays if they cover the UI
      await page.evaluate(() => {
        document.querySelectorAll('[data-sonner-toaster]').forEach(el => el.remove());
      });
      
      const fileName = `${screen.name}_${vp.name}.png`;
      await page.screenshot({ path: path.join(OUTPUT_DIR, fileName), fullPage: true });
    }
    await page.close();
  }
  
  await browser.close();
  console.log('Screenshots complete!');
})();
