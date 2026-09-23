require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });
const { chromium } = require('playwright');

const shot = (n) => '/opt/data/glyvio/nossos/glyvio-plugin-financial/screenshots/dbg_' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto(process.env.APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });

  await page.locator('input').first().fill(process.env.USERNAME);
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(6000);
  console.log('url after login=', page.url());
  await page.screenshot({ path: shot('10_company_select.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
