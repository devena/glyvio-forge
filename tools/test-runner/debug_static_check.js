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

  await page.mouse.click(1291, 33); // chat icon
  await page.waitForTimeout(5000);

  // click first Jeannie row ("Jeannie Rodolfo Zacche de Aguiar", ~y=372)
  await page.mouse.click(250, 372);
  await page.waitForTimeout(4000);
  let screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens after click 1:', JSON.stringify(screens));
  let chatScreen = screens.find(s => s.nameObject === 'GlobalJeannieChatView');
  let state1 = chatScreen ? unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId)) : null;
  fs.writeFileSync(shot('40_chatview1_state.json'), JSON.stringify(state1, null, 2));
  await page.screenshot({ path: shot('40_chatview1.png') });
  console.log('session1 id/subject:', state1?.session?.id, state1?.session?.subject, state1?.session?.sessionIdentifier);

  // go back to list
  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, '_ON_SELECT_CHAT_VIEW', {}), screens[0]?.callbackId).catch(()=>{});
  await page.waitForTimeout(1000);
  await page.mouse.click(1291, 33);
  await page.waitForTimeout(4000);

  // click "Teste de carga do sistema" row (~y=612)
  await page.mouse.click(250, 612);
  await page.waitForTimeout(4000);
  screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens after click 2:', JSON.stringify(screens));
  chatScreen = screens.find(s => s.nameObject === 'GlobalJeannieChatView');
  let state2 = chatScreen ? unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId)) : null;
  fs.writeFileSync(shot('41_chatview2_state.json'), JSON.stringify(state2, null, 2));
  await page.screenshot({ path: shot('41_chatview2.png') });
  console.log('session2 id/subject:', state2?.session?.id, state2?.session?.subject, state2?.session?.sessionIdentifier);

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
