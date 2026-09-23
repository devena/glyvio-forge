require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const hosts = new Set();
  page.on('request', req => {
    try {
      const u = new URL(req.url());
      if (u.hostname.includes('glyvio') && !u.hostname.includes('app-beta')) hosts.add(u.hostname + ' :: ' + u.pathname.split('/').slice(0,4).join('/'));
    } catch(e) {}
  });
  await page.goto('https://app-beta.glyvio.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input').first().fill('environment+devena+test@glyvio.com');
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type('77fffc2e', { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(20000);
  console.log('URL:', page.url());
  console.log([...hosts].join('\n'));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
