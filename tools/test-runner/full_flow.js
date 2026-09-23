require('dotenv').config({ path: '/home/ubuntu/glyvio-forge/tools/test-runner/.env' });
const { chromium } = require('playwright');
const shot = (n) => '/home/ubuntu/_DISK_AI/glyvio-plugin-project/' + n;

async function waitBridgeReady(page, timeoutMs = 60000) {
  await page.waitForFunction(() => typeof window.__GLYVIO_AI__?.setPluginDevOverride === 'function', { timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      return true;
    } catch (e) {
      await page.waitForTimeout(500);
    }
  }
  throw new Error('bridge never became ready');
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  console.log('=== goto ===');
  await page.goto(process.env.GLYVIO_APP_URL || 'https://app-beta.glyvio.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitBridgeReady(page);
  console.log('bridge ready');
  await page.screenshot({ path: shot('f1_login_page.png') });

  console.log('=== login ===');
  await page.fill('input', process.env.GLYVIO_EMAIL);
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.GLYVIO_PASSWORD, { delay: 30 });
  await page.screenshot({ path: shot('f2_login_filled.png') });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(6000);
  console.log('url after login:', page.url());
  await page.screenshot({ path: shot('f3_after_login.png') });

  console.log('=== wait for company-select / dashboard to settle ===');
  let settled = false;
  for (let i = 0; i < 20; i++) {
    const url = page.url();
    if (url.includes('company-select') || url === (process.env.GLYVIO_APP_URL || 'https://app-beta.glyvio.com/')) {
      settled = true;
      break;
    }
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);
  console.log('url settled at:', page.url());
  await page.screenshot({ path: shot('f4_company_select.png') });

  if (page.url().includes('company-select')) {
    console.log('=== clicking first company card ===');
    await page.mouse.click(720, 450);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: shot('f5_after_company_click.png') });
    console.log('url after company click:', page.url());
  }

  console.log('=== inject local plugin bundle override ===');
  for (let i = 0; i < 10; i++) {
    try {
      await page.evaluate(async () => {
        await window.__GLYVIO_AI__.setPluginDevOverride('project', 'http://localhost:3000/bundle.js');
        await window.__GLYVIO_AI__.reloadPlugins();
      });
      console.log('override injected ok');
      break;
    } catch (e) {
      console.log('override attempt failed:', e.message);
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('f6_after_override.png') });

  const routes = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()).catch((e) => 'ERR:' + e.message);
  console.log('routes:', JSON.stringify(routes).slice(0, 3000));

  await browser.close();
})().catch((e) => {
  console.error('SCRIPT ERROR', e.message);
  process.exit(1);
});
