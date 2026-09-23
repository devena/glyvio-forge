require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.message.slice(0, 200)));
  await page.goto('https://app-beta.glyvio.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input').first().fill('environment+devena+test@glyvio.com');
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type('77fffc2e', { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(18000);
  console.log('home URL:', page.url());
  await page.screenshot({ path: shot('30_fresh_home.png') });

  // click the chat bubble icon in the topbar, no override, no manual navigate
  await page.mouse.click(1291, 33);
  await page.waitForTimeout(6000);
  console.log('after click URL:', page.url());
  await page.screenshot({ path: shot('31_fresh_after_chat_click.png') });

  // wait extra long in case of slow list fetch
  await page.waitForTimeout(10000);
  await page.screenshot({ path: shot('32_fresh_after_longer_wait.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
