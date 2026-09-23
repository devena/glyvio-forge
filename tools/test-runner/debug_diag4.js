require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') console.log('[console-error]', m.text().slice(0, 300)); });

  await page.goto('https://app-beta.glyvio.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input').first().fill('environment+devena+test@glyvio.com');
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type('77fffc2e', { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(18000);
  for (let i = 0; i < 60; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; }
    catch (e) { await page.waitForTimeout(1000); }
  }
  await page.waitForTimeout(2000);

  const overrideResult = await page.evaluate(async ({ ns, url }) => {
    try {
      await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
      await window.__GLYVIO_AI__.reloadPlugins();
      return 'ok';
    } catch (e) { return 'error: ' + e.message; }
  }, { ns: 'jeannie_v3', url: 'http://localhost:3100/bundle.js' });
  console.log('override:', overrideResult);

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    try {
      const r = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      console.log(`after ${(i+1)*2}s, routes count:`, r.length);
      break;
    } catch (e) { console.log(`after ${(i+1)*2}s, bridge not ready:`, e.message.slice(0,100)); }
  }
  console.log('final url:', page.url());
  await page.screenshot({ path: shot('96_diag_longwait.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
