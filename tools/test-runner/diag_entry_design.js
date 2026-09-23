require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });
const { chromium } = require('playwright');
const fs = require('fs');

const LOCAL_BUNDLE = 'http://localhost:3100/bundle.js';
const NS = 'financial';

function unwrap(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if (Object.prototype.hasOwnProperty.call(v, '$_type')) {
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

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto(process.env.APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const hasVisibleInput = await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  if (page.url().includes('/login') || hasVisibleInput) {
    await page.locator('input').first().fill(process.env.USERNAME);
    await page.mouse.click(1050, 496);
    await page.waitForTimeout(300);
    await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
    await page.mouse.click(1050, 569);
    await page.waitForTimeout(6000);
  }
  if (page.url().includes('/company-select')) {
    for (let i = 0; i < 20 && page.url().includes('/company-select'); i++) await page.waitForTimeout(1000);
    if (page.url().includes('/company-select')) { await page.mouse.click(720, 300); await page.waitForTimeout(3000); }
  }
  await page.waitForFunction(() => typeof window.__GLYVIO_AI__ !== 'undefined' && typeof window.__GLYVIO_AI__.setPluginDevOverride === 'function', { timeout: 30000 });

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: NS, url: LOCAL_BUNDLE });

  let ready = false;
  for (let i = 0; i < 60; i++) {
    const routes = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()).catch(() => []);
    if ((routes || []).some((r) => JSON.stringify(r).includes('financial'))) { ready = true; break; }
    await page.waitForTimeout(1000);
  }
  console.log('routes ready:', ready);

  await page.evaluate((n) => window.__GLYVIO_AI__.navigate({ nameSpace: 'financial', nameObject: n }), 'FinancialEntryTablePage').catch((e) => console.log('nav err', e.message));
  await page.waitForTimeout(3000);

  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens:', JSON.stringify(screens));
  const cb = screens[0]?.callbackId;

  const design = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getDesign(cb), cb));
  fs.writeFileSync('/tmp/claude-1000/-opt-data-glyvio-nossos/b9e490e6-f712-4088-92fd-15f87ce6e5fc/scratchpad/entry_table_design.json', JSON.stringify(design, null, 2));
  console.log('design written, length:', JSON.stringify(design).length);

  const state = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cb));
  fs.writeFileSync('/tmp/claude-1000/-opt-data-glyvio-nossos/b9e490e6-f712-4088-92fd-15f87ce6e5fc/scratchpad/entry_table_state.json', JSON.stringify(state, null, 2));

  const errs = await page.evaluate((cb) => window.__GLYVIO_AI__.getErrors({ callbackId: cb, limit: 20 }), cb);
  console.log('errors:', JSON.stringify(errs));

  await page.screenshot({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/screenshots/diag_entry_table.png' });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
