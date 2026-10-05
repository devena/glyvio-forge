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
    const recentSessions = await window.queryForUser(
      'SELECT cs.id, cs.chat_agent_id, cs.subject, cs.deleted, cs.user_group_id FROM chat_session cs ORDER BY cs.start DESC LIMIT 10',
      []
    );
    const agentIds = [...new Set(recentSessions.map(r => r.chat_agent_id))];
    const agentRows = [];
    for (const id of agentIds) {
      const rows = await window.queryForUser(
        'SELECT id, name, deleted, plugin_id, user_group_id FROM chat_agent WHERE id = ?',
        [{ value: id, dataType: 'TEXT' }]
      );
      agentRows.push({ chat_agent_id: id, found: rows });
    }
    return { recentSessions, agentRows };
  });
  fs.writeFileSync(
    TEST_ENV.shotDir + '/25_query_agents.json',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
