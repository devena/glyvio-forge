require('dotenv').config({ path: '/home/ubuntu/glyvio-forge/tools/test-runner/.env' });
const { chromium } = require('playwright');
const shot = (n) => '/home/ubuntu/_DISK_AI/glyvio-plugin-crm/' + n;

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

// Some bridge calls (navigate/dispatchAction) can be slow or never resolve their own promise even
// though the underlying app-side effect (navigation, state change) already happened. Fire the call,
// tolerate a timeout on the call itself, and let the caller verify the real outcome separately
// (e.g. via waitForScreen) instead of treating a slow promise as a hard failure.
async function fireAndTolerate(promise, ms, label) {
  try {
    await withTimeout(promise, ms, label);
    console.log(`  (call resolved: ${label})`);
  } catch (e) {
    console.log(`  (call did not resolve in time, continuing anyway: ${label})`);
  }
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
  page.on('console', (msg) => console.log(`[browser] ${msg.text()}`));
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

  console.log('=== goto ===');
  await page.goto(process.env.GLYVIO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  console.log('=== waiting for bridge shim ===');
  await page.waitForFunction(() => typeof window.__GLYVIO_AI__?.setPluginDevOverride === 'function', { timeout: 45000 });

  console.log('=== polling bridge ready ===');
  let bridgeReady = false;
  for (let i = 0; i < 60; i++) {
    try {
      await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      bridgeReady = true;
      break;
    } catch (e) {
      await page.waitForTimeout(500);
    }
  }
  console.log('bridgeReady:', bridgeReady);

  console.log('=== login ===');
  await page.locator('input').first().fill(process.env.GLYVIO_EMAIL, { timeout: 30000 });
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.GLYVIO_PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(15000);
  console.log('post-login url:', page.url());

  console.log('=== override + reload ===');
  await withTimeout(
    page.evaluate(
      async ({ ns, url }) => {
        await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
        await window.__GLYVIO_AI__.reloadPlugins();
      },
      { ns: 'crm', url: 'http://localhost:3000/bundle.js' },
    ),
    20000,
    'setPluginDevOverride+reloadPlugins',
  );
  console.log('override done');
  await page.waitForTimeout(3000);

  console.log('=== 1. navigate to SaleTablePage ===');
  // /sale-table is ambiguous by path alone — both SaleTablePage (page) and SaleTableModal (modal)
  // register that exact path (confirmed via listRoutes()); navigate({path: '/sale-table'}) resolved
  // to the modal in an earlier run, which has no 'new' action and dead-ends the flow. Disambiguate
  // with nameSpace+nameObject instead (also accepted by navigate(), confirmed via the bridge's own
  // error message listing path/nameSpace/nameObject as its match keys).
  await fireAndTolerate(
    page.evaluate(() => window.__GLYVIO_AI__.navigate({ nameSpace: 'crm', nameObject: 'SaleTablePage' })),
    15000,
    'navigate SaleTablePage',
  );
  const listCb = await waitForScreen(page, { nameObject: 'SaleTablePage', surfaceType: 'page' }, 20000);
  console.log('list screen:', listCb);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('flow_01_sale_table.png') });

  console.log('=== 2. dispatch new -> cart ===');
  await fireAndTolerate(
    page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'new', {}), listCb),
    15000,
    'dispatch new',
  );
  const cartCb = await waitForScreen(page, { nameObject: 'SaleEditCart', surfaceType: 'cart' }, 20000);
  console.log('cart screen:', cartCb);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('flow_02_sale_cart_opened.png') });

  console.log('=== 3. select client ===');
  try {
    await withTimeout(
      page.evaluate((cb) => window.__GLYVIO_AI__.selectEntityField(cb, 'state.saleDto.sale.client', '', 0), cartCb),
      15000,
      'selectEntityField client',
    );
    console.log('selectEntity client: ok');
  } catch (e) {
    console.log('selectEntity client FAILED:', e.message);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('flow_03_after_client.png') });

  const st1 = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb));
  console.log('client after select:', JSON.stringify(st1?.saleDto?.sale?.client));

  console.log('=== 4. select priceList ===');
  try {
    await withTimeout(
      page.evaluate((cb) => window.__GLYVIO_AI__.selectEntityField(cb, 'state.saleDto.sale.priceList', '', 0), cartCb),
      15000,
      'selectEntityField priceList',
    );
    console.log('selectEntity priceList: ok');
  } catch (e) {
    console.log('selectEntity priceList FAILED:', e.message);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('flow_04_after_pricelist.png') });

  const st2 = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb));
  console.log('priceList after select:', JSON.stringify(st2?.saleDto?.sale?.priceList));

  console.log('=== 5. dispatch callAddStock -> modal ===');
  try {
    await fireAndTolerate(
      page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'callAddStock', {}), cartCb),
      15000,
      'dispatch callAddStock',
    );
    const modalCb = await waitForScreen(page, { nameObject: 'StockSelectForSaleTableModal', surfaceType: 'modal' }, 20000);
    console.log('modal screen:', modalCb);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: shot('flow_05_stock_select_modal.png') });
  } catch (e) {
    console.log('callAddStock/modal FAILED:', e.message);
    await page.screenshot({ path: shot('flow_05_stock_select_modal_FAILED.png') });
  }

  const errors = await page
    .evaluate((cb) => window.__GLYVIO_AI__.getErrors({ callbackId: cb, limit: 20 }), cartCb)
    .catch((e) => 'ERR:' + e.message);
  console.log('errors:', JSON.stringify(errors).slice(0, 1500));

  await browser.close();
  console.log('=== DONE ===');
})().catch((e) => {
  console.error('SCRIPT ERROR', e.message);
  process.exit(1);
});
