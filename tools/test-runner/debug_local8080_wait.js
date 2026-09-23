require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 45000 });
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

  console.log('=== calling override ===');
  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: 'jeannie_v3', url: 'http://localhost:3100/bundle.js' });
  console.log('=== override returned, polling ===');

  for (let i = 1; i <= 20; i++) {
    await page.waitForTimeout(3000);
    const ok = await page.evaluate(() => {
      try { return window.__GLYVIO_AI__.describeCurrentScreens() ? 'bridge-alive' : 'no-bridge'; }
      catch(e) { return 'err:' + e.message; }
    }).catch(e => 'evalfail:' + e.message);
    console.log(`t=${i*3}s bridge=${ok}`);
  }
  await page.screenshot({ path: shot('104_debug_longpoll.png') });
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
