require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });
const { chromium } = require('playwright');

const PROJECT_DIR = '/opt/data/glyvio/nossos/glyvio-plugin-financial';
const SHOT_DIR = PROJECT_DIR + '/screenshots';

function shot(n) {
  return SHOT_DIR + '/' + n;
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

async function fireAndTolerate(page, fn, ms, label) {
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

// Logs in against the REAL published plugin bundle (no dev-override) so screenshots show
// properly translated, production UI suitable for training material.
async function ensureLoggedIn(page) {
  await page.goto(process.env.APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const hasVisibleInput = await page
    .locator('input')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  const looksLikeLogin = page.url().includes('/login') || hasVisibleInput;

  if (looksLikeLogin) {
    console.log('Login form detected, submitting credentials...');
    await page.locator('input').first().fill(process.env.USERNAME);
    await page.mouse.click(1050, 496);
    await page.waitForTimeout(300);
    await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
    await page.mouse.click(1050, 569);
    await page.waitForTimeout(6000);

    if (page.url().includes('/login')) {
      const inputCount = await page.locator('input').count();
      if (inputCount >= 1) {
        console.log('First-access "create password" screen detected, reusing same password as definitive...');
        await page.mouse.click(1050, 508);
        await page.waitForTimeout(300);
        await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
        await page.mouse.click(1050, 581);
        await page.waitForTimeout(6000);
      }
    }
  }

  if (page.url().includes('/company-select')) {
    console.log('Company-select screen detected, waiting for it to resolve...');
    for (let i = 0; i < 20 && page.url().includes('/company-select'); i++) {
      await page.waitForTimeout(1000);
    }
    if (page.url().includes('/company-select')) {
      await page.mouse.click(720, 300);
      await page.waitForTimeout(3000);
    }
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
  console.log('Logged in. Current url:', page.url());
}

async function navigate(page, path) {
  await fireAndTolerate(page, () => page.evaluate((p) => window.__GLYVIO_AI__.navigate({ path: p }), path), 15000, `navigate ${path}`);
  await page.waitForTimeout(2000);
}

async function dispatch(page, cbId, key, data) {
  await fireAndTolerate(
    page,
    () => page.evaluate(({ cbId, key, data }) => window.__GLYVIO_AI__.dispatchAction(cbId, key, data || {}), { cbId, key, data }),
    15000,
    `dispatch ${key}`,
  );
  await page.waitForTimeout(1000);
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

async function getState(page, cbId) {
  const raw = await page.evaluate((cbId) => window.__GLYVIO_AI__.getState(cbId), cbId);
  return unwrap(raw);
}

module.exports = {
  launch,
  ensureLoggedIn,
  shot,
  unwrap,
  fireAndTolerate,
  waitForScreenByName,
  navigate,
  dispatch,
  setField,
  selectEntity,
  getErrors,
  getState,
  PROJECT_DIR,
  SHOT_DIR,
};
