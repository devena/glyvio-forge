require('dotenv').config({ path: '/opt/data/glyvio/glyvio-core/glyvio_app/.env' });
const { chromium } = require('playwright');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text()); });

  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.locator('input').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('input').first().fill(process.env.EMAIL, { timeout: 30000 });
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(15000);
  await page.screenshot({ path: shot('00_after_login.png') });

  // Open jeannie quick-access modal via the JeannieButton icon in the topbar.
  // Try the AI bridge first if available, else fall back to clicking by icon.
  const opened = await page.evaluate(async () => {
    try {
      const screens = await window.__GLYVIO_AI__.describeCurrentScreens();
      return { ok: true, screens };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }).catch((e) => ({ ok: false, error: String(e) }));
  console.log('bridge check:', JSON.stringify(opened));

  await page.screenshot({ path: shot('01_before_open.png') });
  console.log('DONE_SETUP');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
