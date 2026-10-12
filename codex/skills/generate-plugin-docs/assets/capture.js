#!/usr/bin/env node
/*
 * Screenshots of a plugin's screens in the published Glyvio App, for its user documentation.
 *
 *   node capture.js --env <plugin>/.env --ns <namespace> --routes <out_dir>
 *       logs in, waits for the plugin routes and writes <out_dir>/routes.json
 *   node capture.js --env <plugin>/.env --ns <namespace> --steps steps.json --out <dir> [--ids ids.js]
 *       runs the steps and writes <dir>/<f>.jpg for each one, logging the open screens and errors
 *
 * .env: G_APP_URL, G_USERNAME, G_PASSWORD (never printed). Optional G_COMPANY_NAME picks the company
 * on the company screen; without it the first card is clicked.
 * Playwright: require('playwright') from the current project, or PLAYWRIGHT_MODULE=/path/to/node_modules/playwright.
 *
 * ids.js (optional): the body of an async function run in the page after login, returning an object
 * of ids. A step param written as "$name" is replaced by ids.name. Example:
 *   const A = glyvio_structure.AllEntities, E = glyvio_entity;
 *   const r = await E.FinancialEntry.getQueryBuilder().setFromEntity(A.financialEntry).find();
 *   return { entryId: r[0] && r[0].id };
 *
 * Step: { "f": "file name", "reload": true, "base": {"ns","o","params"}, "baseWait": ms,
 *         "nav": {"ns","o","params"}, "wait": ms, "click": [[x,y],...], "cwait": ms,
 *         "dispatch": {"key","data"}, "dwait": ms, "scroll": px }
 *   "ns" defaults to --ns. "base" opens a page first (sidebars and modals need one under them).
 *   A step with only "reload" (f "_reload") reloads the app and takes no screenshot.
 */
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
}
function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(process.cwd(), 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT_MODULE to a node_modules/playwright folder.');
}
function unwrap(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if ('$_type' in v) {
    if (v.$_type === 'undefined') return undefined;
    if (v.$_type === 'null') return null;
    const val = v.value;
    if (Array.isArray(val)) return val.map(unwrap);
    if (val && typeof val === 'object') { const o = {}; for (const k in val) o[k] = unwrap(val[k]); return o; }
    return val;
  }
  if (Array.isArray(v)) return v.map(unwrap);
  const o = {}; for (const k in v) o[k] = unwrap(v[k]); return o;
}
// navigate()/dispatchAction() may never resolve their promise even when the effect happened.
function tolerate(page, fn, a, ms = 8000) {
  return Promise.race([page.evaluate(fn, a).catch((e) => ({ err: e.message })), new Promise((r) => setTimeout(() => r({ timeout: true }), ms))]);
}

async function waitPluginRoutes(page, ns, companyName) {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      if (JSON.stringify(r).includes('"' + ns + '"')) return true;
    } catch (e) { /* bridge not ready */ }
    if (i % 10 === 5) {
      // company screen: pick by name, else the first card
      try {
        if (companyName) await page.getByText(companyName, { exact: false }).first().click({ timeout: 2000 });
        else await page.mouse.click(720, 352);
      } catch (e) { /* not on the company screen */ }
    }
    await page.waitForTimeout(2000);
  }
  return false;
}

async function start(env, ns) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(env.G_APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 120; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; } catch (e) { await page.waitForTimeout(500); }
  }
  try {
    // only the first input is reachable by selector; password and button by coordinate (viewport 1440x900)
    await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('input').first().fill(env.G_USERNAME);
    await page.mouse.click(1050, 496);
    await page.waitForTimeout(300);
    await page.keyboard.type(env.G_PASSWORD, { delay: 30 });
    await page.mouse.click(1050, 569);
    await page.waitForTimeout(15000);
  } catch (e) { console.log('login form not shown (session already open?)'); }
  if (!(await waitPluginRoutes(page, ns, env.G_COMPANY_NAME))) {
    await page.screenshot({ path: 'capture_no_routes.png' });
    throw new Error('Routes of "' + ns + '" did not load: wrong company, plugin not installed, or app down. See capture_no_routes.png');
  }
  await page.waitForTimeout(3000);
  return { browser, page };
}

async function reload(page, ns, env) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitPluginRoutes(page, ns, env.G_COMPANY_NAME);
  await page.waitForTimeout(2000);
}

(async () => {
  const env = loadEnv(arg('env', '.env'));
  const ns = arg('ns');
  if (!ns) throw new Error('--ns <plugin namespace> is required');
  const { browser, page } = await start(env, ns);
  try {
    const routesDir = arg('routes');
    if (routesDir) {
      fs.mkdirSync(routesDir, { recursive: true });
      const r = unwrap(await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()));
      fs.writeFileSync(path.join(routesDir, 'routes.json'), JSON.stringify(r, null, 1));
      console.log('routes:', r.length, 'of the plugin:', r.filter((x) => x.nameSpace === ns).length);
      return;
    }
    const steps = JSON.parse(fs.readFileSync(arg('steps'), 'utf8'));
    const out = arg('out', 'prints');
    fs.mkdirSync(out, { recursive: true });
    let ids = {};
    if (arg('ids')) {
      const body = fs.readFileSync(arg('ids'), 'utf8');
      ids = await page.evaluate((b) => new Function('return (async () => {' + b + '})()')(), body);
      fs.writeFileSync(path.join(out, '_ids.json'), JSON.stringify(ids));
    }
    const sub = (o) => JSON.parse(JSON.stringify(o || {}).replace(/"\$(\w+)"/g, (m, k) => JSON.stringify(ids[k] ?? null)));
    const go = (r) => tolerate(page, (n) => window.__GLYVIO_AI__.navigate(n), { nameSpace: r.ns || ns, nameObject: r.o, params: sub(r.params) });
    for (const s of steps) {
      try {
        if (s.reload) { await reload(page, ns, env); if (!s.nav && !s.base) continue; }
        if (s.base) { await go(s.base); await page.waitForTimeout(s.baseWait || 4000); }
        if (s.nav) await go(s.nav);
        await page.waitForTimeout(s.wait || 5000);
        if (s.dispatch) {
          const sc = unwrap(await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()));
          const cb = sc[sc.length - 1].callbackId;
          await tolerate(page, (a) => window.__GLYVIO_AI__.dispatchAction(a[0], a[1], a[2], true), [cb, s.dispatch.key, s.dispatch.data || {}]);
          await page.waitForTimeout(s.dwait || 3000);
        }
        for (const c of s.click || []) { await page.mouse.click(c[0], c[1]); await page.waitForTimeout(s.cwait || 3000); }
        if (s.scroll) { await page.mouse.move(720, 500); await page.mouse.wheel(0, s.scroll); await page.waitForTimeout(1500); }
        await page.screenshot({ path: path.join(out, s.f + '.jpg'), type: 'jpeg', quality: 72, timeout: 30000 });
        const sc = unwrap(await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens()));
        const errs = unwrap(await page.evaluate(() => window.__GLYVIO_AI__.getErrors({ limit: 3 })));
        await page.evaluate(() => window.__GLYVIO_AI__.clearErrors());
        const top = (sc || []).slice(-2).map((x) => x.surfaceType + ':' + x.nameObject).join(' > ');
        console.log(s.f, '|', top, '| errs', JSON.stringify(errs).slice(0, 200));
      } catch (e) {
        console.log(s.f, 'FAIL', e.message.split('\n')[0]);
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
