import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const targetUrl = process.env.IBM_COMPOSER_URL ?? 'https://quantum.cloud.ibm.com/composer?initial=N4IgjghgzgtiBcIDyAFAogOQIoEEDKAsgAQBMAdAAwDcAOgHYCWdAxgDYCuAJgKZE3jdWDAEYBGMk2b9ademABO3AOZEwAbQAsAXRnNFK5pp315ADwAUABwYB6EgEpVaisbpmrth09GvmzU04uADTeWiHqJK7u1naO6i4yABaBrsnxriBBIHQQMNwIIACqdAAuDCWs3JxEzAzyzOzlIAC%2BQA';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, '..', 'playwright-output');

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => {
    console.log('[browser]', msg.type(), msg.text());
  });
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.getByRole('button', { name: /Accept all/i }).click({ timeout: 5000 }).catch(() => {});

    const toggle = page.locator('#composer-toolbar-inspect-switch');
    await toggle.waitFor({ timeout: 10000 });
    const ariaChecked = await toggle.getAttribute('aria-checked');
    if (ariaChecked !== 'true') {
      await toggle.click();
    }

    await page.waitForSelector('[data-testid*="inspect"], text=/Step/gi', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);

    await page.screenshot({ path: path.join(screenshotDir, 'composer.png'), fullPage: true });
    const html = await page.content();
    await writeFile(path.join(screenshotDir, 'composer.html'), html, 'utf8');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Playwright run failed', error);
  process.exit(1);
});
