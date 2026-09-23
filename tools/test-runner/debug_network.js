require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true,
    storageState: '.session_auth.json',
  });
  const page = await context.newPage();
  const hosts = new Set();
  page.on('request', req => {
    try {
      const u = new URL(req.url());
      if (u.hostname.includes('glyvio') && !u.hostname.includes('app-beta')) hosts.add(u.hostname + ' :: ' + u.pathname.split('/').slice(0,3).join('/'));
    } catch(e) {}
  });
  await page.goto('https://app-beta.glyvio.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(15000);
  console.log([...hosts].join('\n'));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
