require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });
const { chromium } = require('playwright');
const fs = require('fs');

const SHOT_DIR = '/opt/data/glyvio/nossos/glyvio-plugin-financial/screenshots';
const LOCAL_BUNDLE = 'http://localhost:3100/bundle.js';
const NS = 'financial';

function shot(n) { return SHOT_DIR + '/retest_' + n; }

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
  const guarded = fn().then(() => { settled = true; }).catch((err) => {
    settled = true;
    console.log(`"${label}" rejected: ${err.message}`);
  });
  await Promise.race([guarded, new Promise((resolve) => setTimeout(resolve, ms))]);
  if (!settled) console.log(`"${label}" did not resolve within ${ms}ms — continuing.`);
}

async function navigate(page, path) {
  await fireAndTolerate(page, () => page.evaluate((p) => window.__GLYVIO_AI__.navigate({ path: p }), path), 15000, `navigate ${path}`);
  await page.waitForTimeout(4500);
}

async function navigateByName(page, nameObject) {
  await fireAndTolerate(page, () => page.evaluate((n) => window.__GLYVIO_AI__.navigate({ nameSpace: 'financial', nameObject: n }), nameObject), 15000, `navigate ${nameObject}`);
  await page.waitForTimeout(4500);
}

async function dispatch(page, cbId, key, data) {
  if (!cbId) { console.log(`dispatch ${key} skipped: no callbackId (screen not loaded)`); return; }
  await fireAndTolerate(
    page,
    () => page.evaluate(({ cbId, key, data }) => window.__GLYVIO_AI__.dispatchAction(cbId, key, data || {}), { cbId, key, data }),
    15000,
    `dispatch ${key}`,
  );
  await page.waitForTimeout(2000);
}

async function setField(page, cbId, key, value) {
  await page.evaluate(async ({ cbId, key, value }) => { await window.__GLYVIO_AI__.setFieldValue(cbId, key, value); }, { cbId, key, value });
}

async function selectEntity(page, cbId, fieldName, searchText, pickIndex = 0) {
  return page.evaluate(async ({ cbId, fieldName, searchText, pickIndex }) => {
    try {
      await window.__GLYVIO_AI__.selectEntityField(cbId, fieldName, searchText, pickIndex);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, { cbId, fieldName, searchText, pickIndex });
}

async function describeScreens(page) {
  return page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()).catch(() => []);
}

// Multiple pages can be simultaneously present in describeCurrentScreens() (page navigation
// does not necessarily pop the previous page) — always resolve the callbackId by exact
// nameObject match, never assume screens[0]/screens[last] is the one just navigated to.
function findScreen(screens, nameObject) {
  return screens.find((s) => s.nameObject === nameObject);
}

async function getErrors(page, cbId) {
  return page.evaluate((cbId) => window.__GLYVIO_AI__.getErrors({ callbackId: cbId, limit: 20 }), cbId);
}

async function getState(page, cbId) {
  const raw = await page.evaluate((cbId) => window.__GLYVIO_AI__.getState(cbId), cbId);
  return unwrap(raw);
}

const results = [];
function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} - ${step}${detail ? ' :: ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  try {
    await page.goto(process.env.APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const hasVisibleInput = await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    const looksLikeLogin = page.url().includes('/login') || hasVisibleInput;

    if (looksLikeLogin) {
      console.log('Login form detected, submitting credentials...');
      await page.locator('input').first().fill(process.env.USERNAME);
      await page.mouse.click(1050, 496);
      await page.waitForTimeout(300);
      await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
      await page.mouse.click(1050, 569);
      await page.waitForTimeout(6000);
    }

    if (page.url().includes('/company-select')) {
      console.log('Company-select screen detected...');
      for (let i = 0; i < 20 && page.url().includes('/company-select'); i++) await page.waitForTimeout(1000);
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
      try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; }
      catch (e) { await page.waitForTimeout(500); }
    }
    record('login', true, 'url=' + page.url());

    await page.evaluate(async ({ ns, url }) => {
      await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
      await window.__GLYVIO_AI__.reloadPlugins();
    }, { ns: NS, url: LOCAL_BUNDLE });
    record('dev-override + reloadPlugins', true, LOCAL_BUNDLE);

    // Route table rebuild after reloadPlugins() is not necessarily done when the promise
    // resolves — poll listRoutes() until financial routes actually show up (confirmed race
    // in a first run: early navigate() calls got "no route matches" while later ones,
    // several seconds further in, succeeded).
    let financialRoutes = [];
    for (let i = 0; i < 60; i++) {
      const routes = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()).catch(() => []);
      financialRoutes = (routes || []).filter((r) => JSON.stringify(r).includes('financial'));
      if (financialRoutes.length > 0) break;
      await page.waitForTimeout(1000);
    }
    fs.writeFileSync('/tmp/claude-1000/-opt-data-glyvio-nossos/b9e490e6-f712-4088-92fd-15f87ce6e5fc/scratchpad/financial_routes.json', JSON.stringify(financialRoutes, null, 2));
    record('listRoutes (financial namespace)', financialRoutes.length > 0, `${financialRoutes.length} routes found`);

    // ---- 1. Dashboard ----
    await navigateByName(page, 'FinancialDashboardPage');
    await page.screenshot({ path: shot('01_dashboard.png') });
    let screens = await describeScreens(page);
    let cb = findScreen(screens, 'FinancialDashboardPage')?.callbackId;
    let errs = cb ? await getErrors(page, cb) : [];
    record('Dashboard loads', !!cb, JSON.stringify(errs));

    // ---- 2. Entry table (Contas a Pagar/Receber) ----
    await navigateByName(page, 'FinancialEntryTablePage');
    await page.screenshot({ path: shot('02_entry_table.png') });
    screens = await describeScreens(page);
    cb = findScreen(screens, 'FinancialEntryTablePage')?.callbackId;
    errs = cb ? await getErrors(page, cb) : [];
    record('Entry table loads', !!cb, JSON.stringify(errs));

    // ---- 3. Create a payable entry end-to-end ----
    await dispatch(page, cb, 'create_payable', {});
    await page.waitForTimeout(3000);
    screens = await describeScreens(page);
    const modalScreen = screens.find((s) => s.surfaceType === 'modal');
    await page.screenshot({ path: shot('03_entry_create_modal.png') });
    record('Entry create modal opened', !!modalScreen, JSON.stringify(screens.map((s) => s.nameObject)));

    if (modalScreen) {
      const mcb = modalScreen.callbackId;
      await setField(page, mcb, 'state.financialEntry.description', 'Teste automatizado — verificação pós-implementação');
      await setField(page, mcb, 'state.financialEntry.amountNominal', 123.45);
      await page.waitForTimeout(500);
      const catSel = await selectEntity(page, mcb, 'state.financialEntry.category', '', 0);
      const accSel = await selectEntity(page, mcb, 'state.financialEntry.account', '', 0);
      await page.screenshot({ path: shot('04_entry_create_filled.png') });
      record('Entry form fields set', true, `category:${JSON.stringify(catSel)} account:${JSON.stringify(accSel)}`);

      await dispatch(page, mcb, 'save', {});
      await page.waitForTimeout(3000);
      const errsAfterSave = await getErrors(page, mcb);
      screens = await describeScreens(page);
      await page.screenshot({ path: shot('05_entry_after_save.png') });
      record('Entry saved (no blocking error)', errsAfterSave.length === 0, JSON.stringify(errsAfterSave));
    }

    // ---- 4. Category Wizard ----
    await navigateByName(page, 'FinancialCategoryListPage');
    await page.waitForTimeout(2500);
    screens = await describeScreens(page);
    cb = findScreen(screens, 'FinancialCategoryListPage')?.callbackId;
    await page.screenshot({ path: shot('06_category_list.png') });
    record('Category list loads', !!cb, '');

    await dispatch(page, cb, 'open_wizard', {});
    await page.waitForTimeout(3000);
    screens = await describeScreens(page);
    const wizardModal = screens.find((s) => s.surfaceType === 'modal');
    await page.screenshot({ path: shot('07_category_wizard_modal.png') });
    record('Category wizard modal opened', !!wizardModal, JSON.stringify(screens.map((s) => s.nameObject)));

    // ---- 5. Reports (DRE) ----
    await navigateByName(page, 'FinancialReportsModal');
    await page.waitForTimeout(3000);
    screens = await describeScreens(page);
    cb = findScreen(screens, 'FinancialReportsModal')?.callbackId;
    await page.screenshot({ path: shot('08_reports_modal.png') });
    record('Reports modal loads', !!cb, JSON.stringify(screens.map((s) => s.nameObject)));

    if (cb) {
      await dispatch(page, cb, 'calculate', {});
      await page.waitForTimeout(4500);
      const dreErrors = await getErrors(page, cb);
      await page.screenshot({ path: shot('09_dre_result.png') });
      record('DRE calculated', dreErrors.length === 0, JSON.stringify(dreErrors));
    }

    // ---- 6. New pages: recurring, commissions, advances, offsetting, negotiation, closing, accounting export, reconcile history, ofx import, nfe import ----
    const simplePages = [
      'FinancialRecurringTablePage',
      'FinancialCommissionTablePage',
      'FinancialAdvanceTablePage',
      'FinancialOffsettingModal',
      'FinancialNegotiationModal',
      'FinancialClosingEditModal',
      'FinancialAccountingExportModal',
      'FinancialReconcileListPage',
      'FinancialOfxImportModal',
      'FinancialNfeImportModal',
      'FinancialAccountTablePage',
      'FinancialCostCenterListPage',
      'FinancialSettlementTablePage',
    ];
    let shotIdx = 10;
    for (const nameObject of simplePages) {
      await navigateByName(page, nameObject);
      await page.waitForTimeout(3000);
      screens = await describeScreens(page);
      const idStr = String(shotIdx).padStart(2, '0');
      await page.screenshot({ path: shot(`${idStr}_${nameObject}.png`) });
      const topCb = findScreen(screens, nameObject)?.callbackId;
      const e = topCb ? await getErrors(page, topCb) : [];
      record(`${nameObject} loads`, !!topCb, JSON.stringify(e));
      shotIdx++;
    }

    fs.writeFileSync('/tmp/claude-1000/-opt-data-glyvio-nossos/b9e490e6-f712-4088-92fd-15f87ce6e5fc/scratchpad/verify_results.json', JSON.stringify(results, null, 2));
  } catch (e) {
    console.error('SCRIPT ERROR', e.message);
    fs.writeFileSync('/tmp/claude-1000/-opt-data-glyvio-nossos/b9e490e6-f712-4088-92fd-15f87ce6e5fc/scratchpad/verify_results.json', JSON.stringify(results, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
