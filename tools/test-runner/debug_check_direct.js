require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const shot = (n) => '/tmp/claude-1000/-opt-data-glyvio-services/7b3f0d55-c695-4b5f-90c8-ab63a57cb02d/scratchpad/' + n;

function unwrap(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if ('$_type' in v) {
    const t = v['$_type'];
    if (t === 'undefined') return undefined;
    if (t === 'null') return null;
    const val = v.value;
    if (Array.isArray(val)) return val.map(unwrap);
    if (val && typeof val === 'object') { const out = {}; for (const k in val) out[k] = unwrap(val[k]); return out; }
    return val;
  }
  const out = {}; for (const k in v) out[k] = unwrap(v[k]); return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 45000 });
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

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
  }, { ns: 'jeannie_v3', url: 'http://localhost:3100/bundle.js' });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(20000);
  for (let i = 0; i < 30; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; }
    catch (e) { await page.waitForTimeout(1000); }
  }
  await page.waitForTimeout(2000);

  const navResult = await page.evaluate(async () => {
    try {
      await window.__GLYVIO_AI__.navigate({
        nameSpace: 'jeannie_v3',
        nameObject: 'GlobalJeannieChatView',
        routeParams: { chatSessionId: '99225a2e-55ab-4e72-833d-397eca89dac6' },
      });
      return 'ok';
    } catch (e) { return 'error: ' + e.message; }
  });
  console.log('navigate result:', navResult);
  await page.waitForTimeout(6000);

  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens:', JSON.stringify(screens));
  const chatScreen = screens.find(s => s.nameObject === 'GlobalJeannieChatView');
  if (chatScreen) {
    const st = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId));
    console.log('FULL STATE:', JSON.stringify(st, null, 2).slice(0, 3000));
  }
  await page.screenshot({ path: shot('114_direct_nav.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
