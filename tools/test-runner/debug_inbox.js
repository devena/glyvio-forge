const TEST_ENV = require('./test_env');
const { chromium } = require('playwright');
const fs = require('fs');
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.message.slice(0, 300)));

  await page.goto(TEST_ENV.jeannieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  await page.evaluate((creds) => {
    localStorage.setItem('jeannie.inboxTest.settings', JSON.stringify(creds));
  }, CREDS);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('20_inbox_after_reload.png') });

  // Try to trigger connect() if it's a global function; otherwise click the save/connect button.
  const connectResult = await page.evaluate(async () => {
    if (typeof window.connect === 'function') {
      try { await window.connect(); return 'called window.connect()'; }
      catch (e) { return 'connect() threw: ' + e.message; }
    }
    return 'no global connect() found';
  });
  console.log('connect attempt:', connectResult);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('21_inbox_after_connect.png') });

  // list global function names that look relevant, for diagnosis if connect() wasn't found
  const globals = await page.evaluate(() => {
    return Object.keys(window).filter(k => /connect|query|login|session/i.test(k));
  });
  console.log('relevant globals:', JSON.stringify(globals));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
