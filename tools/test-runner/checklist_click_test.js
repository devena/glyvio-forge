require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => '/home/ubuntu/_DISK_AI/glyvio-plugin-project/' + n;

function unwrap(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if ('$_type' in v) {
    const t = v['$_type'];
    if (t === 'undefined') return undefined;
    if (t === 'null') return null;
    const val = v.value;
    if (Array.isArray(val)) return val.map(unwrap);
    if (val && typeof val === 'object') {
      const out = {};
      for (const k in val) out[k] = unwrap(val[k]);
      return out;
    }
    return val;
  }
  const out = {};
  for (const k in v) out[k] = unwrap(v[k]);
  return out;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)),
  ]);
}

async function waitForScreen(page, { nameObject, surfaceType }, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastSeen = null;
  while (Date.now() < deadline) {
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
    lastSeen = screens;
    const m = (screens || []).find(
      (s) => (!nameObject || s.nameObject === nameObject) && (!surfaceType || s.surfaceType === surfaceType),
    );
    if (m) return m.callbackId;
    await page.waitForTimeout(400);
  }
  throw new Error(`waitForScreen timeout for ${nameObject}/${surfaceType}. last seen: ${JSON.stringify(lastSeen)}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

  await page.goto(process.env.GLYVIO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => typeof window.__GLYVIO_AI__?.setPluginDevOverride === 'function', { timeout: 45000 });
  for (let i = 0; i < 60; i++) {
    try {
      await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      break;
    } catch (e) {
      await page.waitForTimeout(500);
    }
  }
  await page.locator('input').first().fill(process.env.GLYVIO_EMAIL, { timeout: 30000 });
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.GLYVIO_PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(15000);
  console.log('post-login url:', page.url());

  await withTimeout(
    page.evaluate(async ({ ns, url }) => {
      await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
      await window.__GLYVIO_AI__.reloadPlugins();
    }, { ns: 'project', url: 'http://localhost:3005/bundle.js' }),
    20000,
    'override+reload',
  );
  await page.waitForTimeout(3000);

  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ path: '/project-task-kanban' }));
  const kanbanCb = await waitForScreen(page, { nameObject: 'ProjectTaskKanbanPage', surfaceType: 'page' }, 20000);
  console.log('kanban:', kanbanCb);
  await page.waitForTimeout(3000);

  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'new', {}), kanbanCb);
  const cartCb = await waitForScreen(page, { nameObject: 'ProjectTaskEditCart', surfaceType: 'cart' }, 20000);
  console.log('cart:', cartCb);
  await page.waitForTimeout(3000);

  console.log('=== add 2 checklist items ===');
  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'checklistAdd', {}), cartCb);
  await page.waitForTimeout(800);
  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'checklistAdd', {}), cartCb);
  await page.waitForTimeout(800);

  let st = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb));
  console.log('checklist before click:', JSON.stringify(st.projectTask.checklist));

  await page.screenshot({ path: shot('click_01_before.png') });

  console.log('=== find checkbox screen position via getDesign bounds (not available) — use screenshot pixel inspection ===');
  // The checklist section starts right after the tags/observers dividers. From the earlier layout-fix
  // screenshot (fix_layout_1.png), item rows sit at y~620 (first item) and y~707 (second item), with
  // the checkbox at x~264 (left edge of the card, matching the width:40 RowLayoutFieldDesign).
  await page.mouse.click(264, 620);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot('click_02_after_click_item0.png') });

  st = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb));
  console.log('checklist after REAL click on item[0] checkbox:', JSON.stringify(st.projectTask.checklist));

  const errors = await page.evaluate((cb) => window.__GLYVIO_AI__.getErrors({ callbackId: cb, limit: 20 }), cartCb);
  console.log('errors:', JSON.stringify(errors).slice(0, 1500));

  await browser.close();
})().catch((e) => {
  console.error('SCRIPT ERROR', e.message);
  process.exit(1);
});
