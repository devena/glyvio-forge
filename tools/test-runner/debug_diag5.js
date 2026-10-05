const TEST_ENV = require('./test_env');
require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => TEST_ENV.shotDir + '/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(TEST_ENV.appUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input').first().fill(TEST_ENV.username);
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(TEST_ENV.password, { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(18000);
  console.log('home url:', page.url());
  await page.screenshot({ path: shot('97_no_override_home.png') });
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
