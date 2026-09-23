const { chromium } = require('playwright');
const fs = require('fs');

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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto('https://alpha.glyvio.com/jeannie/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.evaluate((creds) => localStorage.setItem('jeannie.inboxTest.settings', JSON.stringify(creds)), CREDS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => { await window.connect(); });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(async ({ csIds }) => {
    const out = {};
    out.one_row = await window.queryForUser('SELECT * FROM chat_message ORDER BY message_timestamp DESC LIMIT 1', []);
    for (const id of csIds) {
      out['by_chat_session_id__' + id] = await window.queryForUser(
        'SELECT count(*) as c FROM chat_message WHERE chat_session_id = ?',
        [{ value: id, dataType: 'TEXT' }]
      );
    }
    out.by_chat_agent_recent = await window.queryForUser(
      "SELECT id, chat_session_id, chat_agent_id, chat_channel_id, message_text, message_direction, message_timestamp FROM chat_message WHERE chat_agent_id LIKE 'jn3-%' ORDER BY message_timestamp DESC LIMIT 10",
      []
    );
    return out;
  }, { csIds: ['99225a2e-55ab-4e72-833d-397eca89dac6', 'dc832223-2be8-4aca-9a27-71cd28e45870'] });

  fs.writeFileSync(
    '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/43_schema_check.json',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
