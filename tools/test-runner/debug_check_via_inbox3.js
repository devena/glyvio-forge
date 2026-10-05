const TEST_ENV = require('./test_env');
const { chromium } = require('playwright');
const shot = (n) => TEST_ENV.shotDir + '/' + n;

const CREDS = {
  serverUrl: TEST_ENV.apiUrl,
  companyId: TEST_ENV.companyId,
  serviceId: TEST_ENV.serviceId,
  environmentId: TEST_ENV.environmentId,
  email: TEST_ENV.inboxUsername,
  senha: process.env.JEANNIE_INBOX_PASSWORD,
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(TEST_ENV.jeannieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.evaluate((creds) => localStorage.setItem('jeannie.inboxTest.settings', JSON.stringify(creds)), CREDS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => { await window.connect(); });
  await page.waitForTimeout(2000);

  await page.locator('input[placeholder="Buscar sessões (código)"]').fill('505792');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('112_search_result.png') });

  await page.mouse.click(150, 305);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('113_session_opened.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
