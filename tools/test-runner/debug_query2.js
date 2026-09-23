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
    '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/25_query_agents.json',
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
