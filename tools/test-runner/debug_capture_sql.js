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

const TARGET_ID = 'dc832223-2be8-4aca-9a27-71cd28e45870';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const capturedQueries = [];
  page.on('request', req => {
    if (req.url().includes('/query-for-user') && req.method() === 'POST') {
      try {
        const body = req.postDataJSON();
        capturedQueries.push(body);
      } catch (e) {}
    }
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

  await page.mouse.click(1291, 33);
  await page.waitForTimeout(5000);

  const candidateYs = [237, 372, 497, 612, 727, 842];
  let found = null;
  for (const y of candidateYs) {
    capturedQueries.length = 0; // reset before each attempt, we only want the one that matches
    await page.mouse.click(250, y);
    await page.waitForTimeout(3000);
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
    const chatScreen = screens.find(s => s.nameObject === 'GlobalJeannieChatView');
    if (!chatScreen) continue;
    const state = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), chatScreen.callbackId));
    if (state?.session?.id === TARGET_ID) { found = chatScreen; break; }
    await page.mouse.click(1291, 33);
    await page.waitForTimeout(3000);
  }

  fs.writeFileSync(shot('70_captured_queries.json'), JSON.stringify(capturedQueries, null, 2));
  console.log('found target:', !!found);
  console.log('captured queries during initial open:', capturedQueries.length);
  console.log(JSON.stringify(capturedQueries, null, 2).slice(0, 3000));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
