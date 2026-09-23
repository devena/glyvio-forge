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

const CHAT_SESSION_IDS = ['99225a2e-55ab-4e72-833d-397eca89dac6', 'dc832223-2be8-4aca-9a27-71cd28e45870'];
const SESSION_IDENTIFIERS = ['jn3-aa5e1da0-a271-4e79-a63b-0a3f53922cc3|aae7f875', 'jn3-129c4744-62e1-4217-b20a-f0fbf6c2c3eb|94609394'];

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

  const result = await page.evaluate(async ({ csIds, sIdents }) => {
    const out = {};
    for (const id of csIds) {
      out['by_chat_session_id__' + id] = await window.queryForUser(
        'SELECT count(*) as c FROM chat_message WHERE chat_session_id = ?',
        [{ value: id, dataType: 'TEXT' }]
      );
    }
    for (const ident of sIdents) {
      out['by_session_identifier__' + ident] = await window.queryForUser(
        'SELECT count(*) as c, min(message_timestamp) as first_ts, max(message_timestamp) as last_ts FROM chat_message WHERE session_identifier = ?',
        [{ value: ident, dataType: 'TEXT' }]
      );
      out['sample__' + ident] = await window.queryForUser(
        'SELECT id, chat_session_id, session_identifier, message_text, message_direction, message_timestamp FROM chat_message WHERE session_identifier = ? ORDER BY message_timestamp ASC LIMIT 5',
        [{ value: ident, dataType: 'TEXT' }]
      );
    }
    return out;
  }, { csIds: CHAT_SESSION_IDS, sIdents: SESSION_IDENTIFIERS });

  fs.writeFileSync(
    '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/42_chat_message_check.json',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
