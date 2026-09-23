const { chromium } = require('playwright');
const shot = (n) => '<local-path>' + n;

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

  // click session by code 505792 ("Teste de funcionamento do assistente") in the sidebar
  const clicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('*'));
    const target = rows.find(el => el.textContent && el.textContent.trim() === '#505792' && el.children.length === 0);
    return !!target;
  });
  console.log('found #505792 text node:', clicked);

  // Fallback: click via coordinates from the visible sessions list (first row is usually most recent)
  await page.screenshot({ path: shot('111_inbox_sessions.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
