const TEST_ENV = require('./test_env');
const { chromium } = require('playwright');
const fs = require('fs');

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

  const result = await page.evaluate(async () => {
    async function safe(q, params) {
      try { return await window.queryForUser(q, params || []); }
      catch (e) { return { error: e.message }; }
    }
    return {
      one_row: await safe('SELECT * FROM chat_message ORDER BY message_timestamp DESC LIMIT 1'),
      one_row_for_dc832223: await safe("SELECT * FROM chat_message WHERE chat_session_id = ? LIMIT 3", [{value:TEST_ENV.targetId, dataType:'TEXT'}]),
    };
  });

  fs.writeFileSync(
    TEST_ENV.shotDir + '/44_schema_check2.json',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
