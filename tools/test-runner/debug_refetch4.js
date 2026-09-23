require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto('https://app-beta.glyvio.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input').first().fill('environment+devena+test@glyvio.com');
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type('77fffc2e', { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(18000);
  for (let i = 0; i < 60; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; }
    catch (e) { await page.waitForTimeout(1000); }
  }
  await page.waitForTimeout(2000);

  await page.mouse.click(1291, 33);
  await page.waitForTimeout(5000);
  await page.mouse.click(250, 612);
  await page.waitForTimeout(4000);

  let screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  let chatScreen = screens.find(s => s.nameObject === 'GlobalJeannieChatView');
  if (!chatScreen) { console.log('no chat screen, screens:', JSON.stringify(screens)); await browser.close(); return; }
  console.log('session id for this screen:', unwrapId(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId)));

  function unwrapId(state) {
    try { return state?.session?.value?.id?.value ?? state?.session?.id; } catch(e) { return 'err'; }
  }

  // try several calling conventions for unsafeMode
  const attempts = [
    async () => window.__GLYVIO_AI__.dispatchAction(chatScreen.callbackId, '_FETCH_MESSAGES', { limit: 30, offset: 0 }, true),
  ];

  const r1 = await page.evaluate(async (cb) => {
    try {
      const r = await window.__GLYVIO_AI__.dispatchAction(cb, '_FETCH_MESSAGES', { limit: 30, offset: 0 }, true);
      return { ok: true, result: r };
    } catch (e) { return { ok: false, error: e.message }; }
  }, chatScreen.callbackId);
  console.log('attempt (4th positional boolean):', JSON.stringify(r1).slice(0, 1000));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
