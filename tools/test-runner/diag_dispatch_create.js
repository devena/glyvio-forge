require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });
const { chromium } = require('playwright');

const LOCAL_BUNDLE = 'http://localhost:3100/bundle.js';
const NS = 'financial';
const SHOT_DIR = '/opt/data/glyvio/nossos/glyvio-plugin-financial/screenshots';

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

  for (let i = 0; i < 60; i++) {
    const routes = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()).catch(() => []);
    if ((routes || []).some((r) => JSON.stringify(r).includes('financial'))) break;
    await page.waitForTimeout(1000);
  }

  await page.evaluate((n) => window.__GLYVIO_AI__.navigate({ nameSpace: 'financial', nameObject: n }), 'FinancialEntryTablePage').catch((e) => console.log('nav err', e.message));
  await page.waitForTimeout(5000); // generous settle time

  let screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens before dispatch:', JSON.stringify(screens));
  const cb = screens[0]?.callbackId;

  try {
    await page.evaluate(({ cb }) => window.__GLYVIO_AI__.dispatchAction(cb, 'create_payable', {}), { cb });
    console.log('dispatch create_payable: SUCCESS');
  } catch (e) {
    console.log('dispatch create_payable FAILED:', e.message);
  }
  await page.waitForTimeout(2500);

  screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens after dispatch:', JSON.stringify(screens));
  await page.screenshot({ path: SHOT_DIR + '/diag_after_create_payable.png' });

  const errs = await page.evaluate((cb) => window.__GLYVIO_AI__.getErrors({ callbackId: cb, limit: 20 }), cb);
  console.log('errors on original screen:', JSON.stringify(errs));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
