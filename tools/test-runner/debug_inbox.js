const { chromium } = require('playwright');
const fs = require('fs');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

const CREDS = {
  serverUrl: 'https://webapi-prod.glyvio.com',
  companyId: '39c2102e-0083-411b-a4a7-24ed364ab65b',
  serviceId: 'c6733624-c42a-4427-9942-aee92b902751',
  environmentId: 'env-novo',
  email: 'rodolfo@devena.com.br',
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

  await page.goto('https://alpha.glyvio.com/jeannie/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
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
