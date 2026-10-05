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

const CHAT_SESSION_IDS = [TEST_ENV.chatSessionId, TEST_ENV.targetId];
const SESSION_IDENTIFIERS = ['jn3-00000000-0000-0000-0000-000000000000|aae7f875', 'jn3-00000000-0000-0000-0000-000000000000|94609394'];

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
    TEST_ENV.shotDir + '/42_chat_message_check.json',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
