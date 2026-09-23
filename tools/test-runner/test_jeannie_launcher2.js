require('dotenv').config({ path: '/opt/data/glyvio/glyvio-core/glyvio_app/.env' });
const { chromium } = require('playwright');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('input').first().fill(process.env.EMAIL);
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569);

  for (let i = 0; i < 40; i++) {
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()).catch(() => []);
    if (screens.length > 0) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(1000);

  console.log('--- clicking jeannie sparkles button ---');
  await page.mouse.click(1189, 32);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: shot('03_modal_open.png') });

  const screensAfterOpen = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()).catch((e) => String(e));
  console.log('screens after open:', JSON.stringify(screensAfterOpen));

  console.log('DONE_PHASE_1');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
