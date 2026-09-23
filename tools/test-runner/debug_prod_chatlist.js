require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    storageState: '.session_auth.json',
  });
  const page = await context.newPage();
  await page.goto('https://app.glyvio.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 60; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; }
    catch (e) { await page.waitForTimeout(1000); }
  }
  await page.waitForTimeout(15000);
  console.log('URL:', page.url());
  await page.screenshot({ path: shot('23_prod_home.png') });

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: 'jeannie_v3', url: 'http://localhost:3100/bundle.js' });
  await page.waitForTimeout(3000);

  await Promise.race([
    page.evaluate((p) => window.__GLYVIO_AI__.navigate({ path: p }), '/chat-list'),
    page.waitForTimeout(8000),
  ]);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: shot('24_prod_chat_list.png') });
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()).catch(e => 'err:' + e.message);
  console.log('screens:', JSON.stringify(screens));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
