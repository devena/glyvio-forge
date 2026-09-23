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

  const wsFrames = [];
  page.on('websocket', ws => {
    ws.on('framereceived', f => {
      wsFrames.push({ ts: Date.now(), payload: f.payload?.toString?.() ?? String(f.payload) });
    });
  });

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

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: 'jeannie_v3', url: 'http://localhost:3100/bundle.js' });
  await page.waitForTimeout(3000);

  await page.mouse.click(1291, 33);
  await page.waitForTimeout(5000);

  let chatScreen = null;
  const candidateYs = [237, 372, 497, 612, 727, 842];
  for (const y of candidateYs) {
    await page.mouse.click(250, y);
    await page.waitForTimeout(3000);
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
    const cs = screens.find(s => s.nameObject === 'GlobalJeannieChatView');
    if (cs) { chatScreen = cs; break; }
    await page.mouse.click(1291, 33);
    await page.waitForTimeout(3000);
  }
  console.log('chat screen:', !!chatScreen, chatScreen?.callbackId);
  if (!chatScreen) { await browser.close(); return; }

  const preState = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId));
  console.log('session:', preState?.session?.id, preState?.session?.sessionIdentifier);

  wsFrames.length = 0;

  const dispatchResult = await page.evaluate(async (cb) => {
    try {
      const r = await window.__GLYVIO_AI__.dispatchAction(cb, '_SEND_MSG', {
        text: 'Crie uma tarefa de teste chamada "Teste de aprovacao - pode ignorar" nesta sessao.',
        replyToMessageId: null,
      }, true);
      return { ok: true, result: r };
    } catch (e) { return { ok: false, error: e.message }; }
  }, chatScreen.callbackId);
  console.log('send result:', JSON.stringify(dispatchResult).slice(0, 300));

  await page.waitForTimeout(20000);

  const state = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId));
  console.log('pendingApproval:', JSON.stringify(state?.pendingApproval));
  console.log('pendingQuestions:', JSON.stringify(state?.pendingQuestions));
  console.log('liveToolTrace:', JSON.stringify(state?.liveToolTrace));
  console.log('liveTurnActive:', state?.liveTurnActive, 'liveTurnText len:', state?.liveTurnText?.length);

  await page.screenshot({ path: shot('90_after_send_wait_approval.png') });
  fs.writeFileSync(shot('90_ws_frames.json'), JSON.stringify(wsFrames, null, 2));
  console.log('ws frames captured:', wsFrames.length);

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
