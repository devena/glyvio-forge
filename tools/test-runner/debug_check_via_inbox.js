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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(TEST_ENV.jeannieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.evaluate((creds) => localStorage.setItem('jeannie.inboxTest.settings', JSON.stringify(creds)), CREDS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => { await window.connect(); });
  await page.waitForTimeout(2000);

  // list sessions and find "Teste de funcionamento do assistente" or the recent one under Jeannie Tests
  const sessions = await page.evaluate(async () => {
    return await window.queryForUser(
      "SELECT s.id, s.session_identifier, s.code, s.subject, s.last_message_timestamp FROM chat_session s JOIN chat_agent a ON a.id = s.chat_agent_id WHERE a.id = 'jn3-00000000-0000-0000-0000-000000000000' AND s.deleted = false ORDER BY s.last_message_timestamp DESC LIMIT 5",
      []
    );
  });
  console.log('recent Jeannie Tests sessions:', JSON.stringify(sessions, null, 2));

  // for each, check pending interaction
  for (const s of sessions) {
    const pending = await page.evaluate(async (sessionId) => {
      try {
        return await window.callService('jeannie_get_pending_interaction', { sessionId });
      } catch (e) { return { error: e.message }; }
    }, s.session_identifier);
    console.log(`session ${s.session_identifier} (${s.code}):`, JSON.stringify(pending));
  }

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
