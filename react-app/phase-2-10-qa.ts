import { chromium, type Page } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:3006';

const viewports = [
  { width: 360, height: 800, name: '360 Mobile' },
  { width: 375, height: 812, name: '375 Mobile' },
  { width: 390, height: 844, name: '390 Mobile' },
  { width: 414, height: 896, name: '414 Mobile' },
  { width: 768, height: 1024, name: '768 Tablet' },
  { width: 1024, height: 768, name: '1024 Desktop' },
  { width: 1280, height: 800, name: '1280 Desktop' },
  { width: 1440, height: 900, name: '1440 Desktop' }
];

const screens = [
  {
    name: 'Login',
    url: `${BASE_URL}/login`,
    needsAuth: false
  },
  {
    name: 'Calendar',
    url: `${BASE_URL}/`,
    needsAuth: true
  },
  {
    name: 'Workspace Review',
    url: `${BASE_URL}/workspace/05%2F09%2F2026`,
    needsAuth: true
  },
  {
    name: 'Final List',
    url: `${BASE_URL}/workspace/05%2F09%2F2026`,
    needsAuth: true,
    action: async (page: any) => {
      await page.getByRole('button', { name: /Final List/i }).click();
      await page.waitForTimeout(300);
    }
  },
  {
    name: 'Date Report',
    url: `${BASE_URL}/workspace/05%2F09%2F2026`,
    needsAuth: true,
    action: async (page: any) => {
      await page.getByRole('button', { name: /^Report$/i }).click();
      await page.waitForTimeout(300);
    }
  },
  {
    name: 'Reports',
    url: `${BASE_URL}/reports`,
    needsAuth: true
  },
  {
    name: 'Upload',
    url: `${BASE_URL}/upload`,
    needsAuth: true
  },
  {
    name: 'Settings',
    url: `${BASE_URL}/settings`,
    needsAuth: true
  }
];

async function inspectOverflow(page: any) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;

    const offenders: Array<{
      tag: string;
      className: string;
      id: string;
      left: number;
      right: number;
      width: number;
      overflowRight: number;
      overflowLeft: number;
    }> = [];

    document.querySelectorAll('*').forEach((element) => {
      const el = element as HTMLElement;
      const rect = el.getBoundingClientRect();

      const overflowRight = Math.max(
        0,
        rect.right - viewportWidth
      );

      const overflowLeft = Math.max(
        0,
        -rect.left
      );

      if (overflowRight > 1 || overflowLeft > 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className:
            typeof el.className === 'string'
              ? el.className.slice(0, 200)
              : '',
          id: el.id || '',
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          overflowRight: Math.round(overflowRight * 100) / 100,
          overflowLeft: Math.round(overflowLeft * 100) / 100
        });
      }
    });

    offenders.sort(
      (a, b) =>
        Math.max(b.overflowRight, b.overflowLeft) -
        Math.max(a.overflowRight, a.overflowLeft)
    );

    return {
      viewportWidth,
      documentWidth,
      bodyWidth,
      hasOverflow:
        documentWidth > viewportWidth + 1 ||
        bodyWidth > viewportWidth + 1,
      offenders: offenders.slice(0, 10)
    };
  });
}

async function inspectLayout(page: any) {
  return page.evaluate(() => {
    const selectors = [
      'header',
      'main',
      'nav',
      '[role="main"]',
      'table',
      '[role="dialog"]',
      '[role="tablist"]',
      'input',
      'button'
    ];

    const result: Record<string, unknown> = {};

    for (const selector of selectors) {
      const elements = Array.from(
        document.querySelectorAll(selector)
      );

      result[selector] = elements.slice(0, 10).map((element) => {
        const el = element as HTMLElement;
        const rect = el.getBoundingClientRect();

        return {
          text: (el.innerText || '').trim().slice(0, 100),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right)
        };
      });
    }

    return result;
  });
}

async function run() {
  fs.mkdirSync(
    'artifacts/phase-2-10',
    { recursive: true }
  );

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: {
      width: 390,
      height: 844
    }
  });

  const page = await context.newPage();

  let loggedIn = false;

  const results: Array<{
    screen: string;
    viewport: string;
    status: 'PASS' | 'FAIL';
    overflow: boolean;
    documentWidth: number;
    bodyWidth: number;
    viewportWidth: number;
    error?: string;
  }> = [];

  for (const screen of screens) {
    console.log('\n========================================');
    console.log(`SCREEN: ${screen.name}`);
    console.log('========================================');

    /*
     * Authenticate once.
     *
     * Credentials MUST come from environment variables.
     */
    if (screen.needsAuth && !loggedIn) {
      const email = process.env.PLAYWRIGHT_EMAIL;
      const password = process.env.PLAYWRIGHT_PASSWORD;

      if (!email || !password) {
        throw new Error(
          'Missing PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD environment variables.'
        );
      }

      await page.setViewportSize({
        width: 390,
        height: 844
      });

      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'networkidle'
      });

      await page.waitForSelector('input[type="email"]');
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      
      // Wait for React state to update before clicking
      await page.waitForTimeout(500);

      await page.click('button[type="submit"]');

      await page.waitForURL(
        `${BASE_URL}/`,
        { timeout: 15000 }
      );

      loggedIn = true;

      console.log(
        '✅ Authentication successful'
      );
    }

    for (const viewport of viewports) {
      const viewportLabel =
        `${viewport.width}x${viewport.height}`;

      console.log(
        `\n[${viewport.name}] ${viewportLabel}`
      );

      /*
       * Clear per-viewport diagnostics.
       */
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];

      const consoleHandler = (message: any) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      };

      const requestHandler = (request: any) => {
        failedRequests.push(
          `${request.method()} ${request.url()} — ${
            request.failure()?.errorText ||
            'unknown'
          }`
        );
      };

      page.on(
        'console',
        consoleHandler
      );

      page.on(
        'requestfailed',
        requestHandler
      );

      try {
        /*
         * IMPORTANT:
         * Establish viewport BEFORE navigation.
         */
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height
        });

        await page.goto(screen.url, {
          waitUntil: 'domcontentloaded'
        });

        /*
         * Allow React, effects and Supabase-backed
         * UI rendering to settle.
         */
        await page.waitForTimeout(1000);

        /*
         * Perform screen-specific action.
         */
        if (screen.action) {
          await screen.action(page);
        }

        await page.waitForTimeout(500);

        /*
         * Inspect actual rendered layout.
         */
        const overflow =
          await inspectOverflow(page);

        await inspectLayout(page);

        /*
         * Screenshot evidence.
         */
        const safeScreenName =
          screen.name
            .toLowerCase()
            .replace(
              /[^a-z0-9]+/g,
              '-'
            );

        const screenshotPath =
          `artifacts/phase-2-10/` +
          `${safeScreenName}-${viewport.width}x${viewport.height}.png`;

        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        });

        /*
         * Determine result.
         */
        const failed =
          overflow.hasOverflow ||
          consoleErrors.length > 0;

        if (failed) {
          console.log(
            '❌ FAIL'
          );
        } else {
          console.log(
            '✅ PASS'
          );
        }

        if (overflow.hasOverflow) {
          console.log(
            `   OVERFLOW: viewport=${overflow.viewportWidth}px ` +
            `document=${overflow.documentWidth}px ` +
            `body=${overflow.bodyWidth}px`
          );

          console.log(
            '   Offending elements:'
          );

          for (
            const offender of
            overflow.offenders
          ) {
            console.log(
              `   - ${offender.tag}` +
              `${offender.id ? `#${offender.id}` : ''}` +
              `${
                offender.className
                  ? `.${offender.className.replace(
                      /\s+/g,
                      '.'
                    )}`
                  : ''
              }` +
              ` | left=${offender.left}` +
              ` right=${offender.right}` +
              ` width=${offender.width}` +
              ` overflowRight=${offender.overflowRight}` +
              ` overflowLeft=${offender.overflowLeft}`
            );
          }
        }

        if (consoleErrors.length) {
          console.log(
            `   ❌ Console errors: ${consoleErrors.length}`
          );

          consoleErrors.forEach(
            (error) =>
              console.log(
                `      ${error}`
              )
          );
        }

        if (failedRequests.length) {
          console.log(
            `   ⚠️ Failed requests: ${failedRequests.length}`
          );

          failedRequests.forEach(
            (request) =>
              console.log(
                `      ${request}`
              )
          );
        }

        results.push({
          screen: screen.name,
          viewport: viewportLabel,
          status: failed
            ? 'FAIL'
            : 'PASS',
          overflow:
            overflow.hasOverflow,
          documentWidth:
            overflow.documentWidth,
          bodyWidth:
            overflow.bodyWidth,
          viewportWidth:
            overflow.viewportWidth,
          error:
            consoleErrors.length
              ? consoleErrors.join(
                  ' | '
                )
              : undefined
        });
      } catch (error) {
        console.log(
          '❌ TEST ERROR:',
          error
        );

        results.push({
          screen: screen.name,
          viewport: viewportLabel,
          status: 'FAIL',
          overflow: false,
          documentWidth: 0,
          bodyWidth: 0,
          viewportWidth: viewport.width,
          error: String(error)
        });
      } finally {
        page.off(
          'console',
          consoleHandler
        );

        page.off(
          'requestfailed',
          requestHandler
        );
      }
    }
  }

  /*
   * FINAL SUMMARY
   */
  console.log(
    '\n\n========================================'
  );

  console.log(
    'PHASE 2.10 RESPONSIVE QA SUMMARY'
  );

  console.log(
    '========================================\n'
  );

  const passed =
    results.filter(
      (result) =>
        result.status === 'PASS'
    ).length;

  const failed =
    results.filter(
      (result) =>
        result.status === 'FAIL'
    ).length;

  console.log(
    `Total checks: ${results.length}`
  );

  console.log(
    `Passed: ${passed}`
  );

  console.log(
    `Failed: ${failed}`
  );

  console.log('\nRESULT MATRIX:\n');

  for (const screen of screens) {
    console.log(
      `${screen.name}:`
    );

    for (const viewport of viewports) {
      const result =
        results.find(
          (item) =>
            item.screen ===
              screen.name &&
            item.viewport ===
              `${viewport.width}x${viewport.height}`
        );

      console.log(
        `  ${viewport.width}x${viewport.height}: ` +
        `${result?.status || 'NOT TESTED'}`
      );
    }
  }

  /*
   * Save machine-readable report.
   */
  fs.writeFileSync(
    'artifacts/phase-2-10/qa-results.json',
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        generatedAt:
          new Date().toISOString(),
        totalChecks:
          results.length,
        passed,
        failed,
        results
      },
      null,
      2
    )
  );

  console.log(
    '\nQA report saved to:'
  );

  console.log(
    'artifacts/phase-2-10/qa-results.json'
  );

  if (failed > 0) {
    console.log(
      '\n❌ PHASE 2.10 NOT ACCEPTED'
    );
  } else {
    console.log(
      '\n✅ ALL RESPONSIVE QA CHECKS PASSED'
    );
  }

  await browser.close();

  /*
   * Exit with failure code if any test failed.
   */
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(
    '\n❌ QA SCRIPT FAILED'
  );

  console.error(error);

  process.exit(1);
});
