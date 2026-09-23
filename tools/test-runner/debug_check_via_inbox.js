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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto('https://alpha.glyvio.com/jeannie/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.evaluate((creds) => localStorage.setItem('jeannie.inboxTest.settings', JSON.stringify(creds)), CREDS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => { await window.connect(); });
  await page.waitForTimeout(2000);

  // list sessions and find "Teste de funcionamento do assistente" or the recent one under Jeannie Tests
  const sessions = await page.evaluate(async () => {
    return await window.queryForUser(
      "SELECT s.id, s.session_identifier, s.code, s.subject, s.last_message_timestamp FROM chat_session s JOIN chat_agent a ON a.id = s.chat_agent_id WHERE a.id = 'jn3-aa5e1da0-a271-4e79-a63b-0a3f53922cc3' AND s.deleted = false ORDER BY s.last_message_timestamp DESC LIMIT 5",
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
