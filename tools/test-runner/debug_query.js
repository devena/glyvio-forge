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
    const total = await window.queryForUser('SELECT count(*) as c FROM chat_session', []);
    const nullAgent = await window.queryForUser('SELECT count(*) as c FROM chat_session WHERE chat_agent_id IS NULL', []);
    const sample = await window.queryForUser(
      'SELECT id, session_identifier, chat_agent_id, subject, deleted, start FROM chat_session ORDER BY start DESC LIMIT 15',
      []
    );
    return { total, nullAgent, sample };
  });
  fs.writeFileSync(
    '<local-path>',
    JSON.stringify(result, null, 2)
  );
  console.log('total:', JSON.stringify(result.total));
  console.log('nullAgent:', JSON.stringify(result.nullAgent));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
