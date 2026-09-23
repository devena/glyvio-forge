const { chromium } = require('playwright');
const fs = require('fs');

const CREDS = {
  serverUrl: 'https://api.example.com',
  companyId: '00000000-0000-0000-0000-000000000000',
  serviceId: '00000000-0000-0000-0000-000000000000',
  environmentId: 'env-novo',
  email: 'inbox-user@example.com',
  senha: process.env.JEANNIE_INBOX_PASSWORD,
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto('https://jeannie.example.com/jeannie/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
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
      one_row_for_dc832223: await safe("SELECT * FROM chat_message WHERE chat_session_id = ? LIMIT 3", [{value:'00000000-0000-0000-0000-000000000000', dataType:'TEXT'}]),
    };
  });

  fs.writeFileSync(
    '<local-path>',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
