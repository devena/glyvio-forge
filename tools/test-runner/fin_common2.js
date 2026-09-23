require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });
const { chromium } = require('playwright');

const SHOT_DIR = '/opt/data/glyvio/nossos/glyvio-plugin-financial/docs/test-evidence';

function shot(sub, n) {
  return SHOT_DIR + '/' + sub + '/' + n;
}

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

async function fireAndTolerate(fn, ms, label) {
  let settled = false;
  const guarded = fn()
    .then(() => { settled = true; })
    .catch((err) => {
      settled = true;
      console.log(`"${label}" rejected: ${err.message}`);
    });
  await Promise.race([guarded, new Promise((resolve) => setTimeout(resolve, ms))]);
  if (!settled) console.log(`"${label}" did not resolve within ${ms}ms — continuing.`);
}

async function waitForScreenByName(page, { nameObject, surfaceType, timeoutMs = 20000 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()).catch(() => []);
    const match = screens.find(
      (s) => (!nameObject || s.nameObject === nameObject) && (!surfaceType || s.surfaceType === surfaceType),
    );
    if (match) return match.callbackId;
    await page.waitForTimeout(400);
  }
  throw new Error(`waitForScreen timeout: nameObject=${nameObject} surfaceType=${surfaceType}`);
}

async function launch({ headless = true } = {}) {
  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { browser, context, page };
}

async function ensureLoggedInAndOverride(page, port) {
  await page.goto(process.env.G_APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const hasVisibleInput = await page
    .locator('input')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  const looksLikeLogin = page.url().includes('/login') || hasVisibleInput;

  if (looksLikeLogin) {
    console.log('Login form detected, submitting credentials for', process.env.G_USERNAME);
    await page.locator('input').first().fill(process.env.G_USERNAME);
    await page.mouse.click(1050, 496);
    await page.waitForTimeout(300);
    await page.keyboard.type(process.env.G_PASSWORD, { delay: 30 });
    await page.mouse.click(1050, 569);
    await page.waitForTimeout(8000);
  } else {
    console.log('No login form detected (reused existing session).');
  }

  await page.waitForFunction(
    () => typeof window.__GLYVIO_AI__ !== 'undefined' && typeof window.__GLYVIO_AI__.setPluginDevOverride === 'function',
    { timeout: 30000 },
  );

  for (let i = 0; i < 60; i++) {
    try {
      await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      break;
    } catch (e) {
      await page.waitForTimeout(500);
    }
  }

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: 'financial', url: `http://localhost:${port}/bundle.js` });
  await page.waitForTimeout(2500);

  console.log('Ready. Current url:', page.url());
}

async function navigate(page, path, opts) {
  await fireAndTolerate(() => page.evaluate((p) => window.__GLYVIO_AI__.navigate(p), { path, ...opts }), 15000, `navigate ${path}`);
  await page.waitForTimeout(2000);
}

async function dispatch(page, cbId, key, data) {
  await fireAndTolerate(
    () => page.evaluate(({ cbId, key, data }) => window.__GLYVIO_AI__.dispatchAction(cbId, key, data || {}), { cbId, key, data }),
    15000,
    `dispatch ${key}`,
  );
  await page.waitForTimeout(1200);
}

async function setField(page, cbId, key, value) {
  await page.evaluate(async ({ cbId, key, value }) => {
    await window.__GLYVIO_AI__.setFieldValue(cbId, key, value);
  }, { cbId, key, value });
}

async function selectEntity(page, cbId, fieldName, searchText, pickIndex = 0) {
  await page.evaluate(async ({ cbId, fieldName, searchText, pickIndex }) => {
    await window.__GLYVIO_AI__.selectEntityField(cbId, fieldName, searchText, pickIndex);
  }, { cbId, fieldName, searchText, pickIndex });
}

async function getErrors(page, cbId) {
  return page.evaluate((cbId) => window.__GLYVIO_AI__.getErrors({ callbackId: cbId, limit: 20 }), cbId);
}

async function clearErrors(page) {
  return page.evaluate(() => window.__GLYVIO_AI__.clearErrors());
}

async function getState(page, cbId) {
  const raw = await page.evaluate((cbId) => window.__GLYVIO_AI__.getState(cbId), cbId);
  return unwrap(raw);
}

async function getDesign(page, cbId) {
  const raw = await page.evaluate((cbId) => window.__GLYVIO_AI__.getDesign(cbId), cbId);
  return unwrap(raw);
}

module.exports = {
  launch,
  ensureLoggedInAndOverride,
  shot,
  unwrap,
  fireAndTolerate,
  waitForScreenByName,
  navigate,
  dispatch,
  setField,
  selectEntity,
  getErrors,
  clearErrors,
  getState,
  getDesign,
};
