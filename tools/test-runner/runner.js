#!/usr/bin/env node

/**
 * Glyvio AI Bridge Automated Test Runner
 *
 * Drives a headless/headed browser against a published Glyvio App (staging/production sandbox),
 * serves the local plugin bundle with CORS, injects dev overrides via window.__GLYVIO_AI__,
 * navigates, executes actions, and checks for errors.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { program } = require('commander');
require('dotenv').config();

// Simple zero-dependency static file server with CORS
function createCorsServer(serveDir, port = 3000) {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Clean and resolve path
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/bundle.js';

    // Normalize path to prevent directory traversal
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(serveDir, safePath);

    // If request has prefix like /dist/bundle.js or /bundle.js
    if (!fs.existsSync(filePath)) {
      const fileName = path.basename(safePath);
      const directFile = path.join(serveDir, fileName);
      if (fs.existsSync(directFile)) {
        filePath = directFile;
      }
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`File not found: ${reqPath}`);
      return;
    }

    let contentType = 'application/javascript; charset=utf-8';
    if (filePath.endsWith('.json')) contentType = 'application/json';
    else if (filePath.endsWith('.html')) contentType = 'text/html';
    else if (filePath.endsWith('.css')) contentType = 'text/css';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

// Helper to auto-detect plugin info from current workspace or argument
function detectPluginInfo(projectDir) {
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const name = pkg.name || '';
      const pluginId = pkg.pluginId || '';
      let distDir = path.join(projectDir, 'plugin', 'app', 'dist');
      if (!fs.existsSync(distDir)) {
        distDir = path.join(projectDir, 'dist');
      }
      return { name, pluginId, distDir };
    }
  } catch (e) {}
  return { name: '', pluginId: '', distDir: '' };
}

// Session state file path
const SESSION_FILE = path.resolve(__dirname, '.session_auth.json');

// window.__GLYVIO_AI__.getState()/getDesign() wrap every field as {"$_type": "...", "value": ...}
// instead of the plain value. Reading a nested path directly off the raw result (e.g.
// `state.projectTask.checklist`) returns that wrapper object, or — for a path that crosses an
// intermediate wrapper — silently reads as `undefined`, which is easy to mistake for genuinely
// missing/unsaved data. Always unwrap before inspecting a getState() result.
function unwrapBridgeValue(value) {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, '$_type')) {
    const type = value['$_type'];
    if (type === 'undefined') return undefined;
    if (type === 'null') return null;
    const inner = value.value;
    if (Array.isArray(inner)) return inner.map(unwrapBridgeValue);
    if (inner && typeof inner === 'object') {
      const out = {};
      for (const key in inner) out[key] = unwrapBridgeValue(inner[key]);
      return out;
    }
    return inner;
  }
  const out = {};
  for (const key in value) out[key] = unwrapBridgeValue(value[key]);
  return out;
}

// navigate()/dispatchAction() calls can resolve slowly or never resolve their own promise even
// though the underlying app-side effect (navigation, state change) already happened — confirmed
// empirically (a `navigate` call that never resolved still changed the active screen). Treat a
// timeout on the call itself as informational, not fatal; the caller is expected to verify the real
// outcome separately (waitForScreen, getErrors, getState) rather than trust the call's own promise.
function fireAndTolerate(promiseFactory, ms, label) {
  let settled = false;
  const guarded = promiseFactory()
    .then(() => { settled = true; })
    .catch((err) => {
      settled = true;
      console.log(`[Test Runner] "${label}" rejected (possibly after the timeout below already fired): ${err.message}`);
    });
  return Promise.race([guarded, new Promise((resolve) => setTimeout(resolve, ms))]).then(() => {
    if (!settled) {
      console.log(`[Test Runner] "${label}" did not resolve within ${ms}ms — continuing anyway (verify via waitForScreen/getErrors).`);
    }
  });
}

async function run() {
  program
    .name('glyvio-test')
    .description('Glyvio AI Bridge Test Runner for Hosted App')
    .option('--url <url>', 'Glyvio App base URL', process.env.GLYVIO_APP_URL || 'https://app-beta.glyvio.com/')
    .option('--project <path>', 'Plugin project root directory', process.cwd())
    .option('--plugin-name <name>', 'Plugin namespace name (e.g. crm, project, travel)')
    .option('--bundle-dir <dir>', 'Directory containing dist/bundle.js')
    .option('--port <port>', 'Port for local CORS dev server', '3000')
    .option('--email <email>', 'Login email', process.env.GLYVIO_EMAIL)
    .option('--password <password>', 'Login password', process.env.GLYVIO_PASSWORD)
    .option('--company <nameOrId>', 'Company to select', process.env.GLYVIO_COMPANY)
    .option('--navigate <path>', 'Target route path to navigate (e.g. /crm/clients/kanban)')
    .option('--list-routes', 'List all registered routes and exit')
    .option('--describe-screens', 'List all currently open screens and exit')
    .option('--get-design [callbackId]', 'Get design tree for callbackId (or top screen)')
    .option('--get-state [callbackId]', 'Get state for callbackId (or top screen)')
    .option('--dispatch <key>', 'Dispatch an action key')
    .option('--dispatch-data <json>', 'JSON data payload for dispatch action', '{}')
    .option('--set-field <keyVal>', 'Set field value in format "fieldName=value"')
    .option('--select-entity <entityVal>', 'Select entity in format "fieldName=searchText[:pickIndex]"')
    .option('--callback-id <id>', 'Target callbackId for actions')
    .option('--scenario <file>', 'Path to JSON scenario test script')
    .option('--screenshot <path>', 'Take screenshot after operations')
    .option('--headed', 'Run browser in headed mode (visible window)', false)
    .option('--timeout <ms>', 'Operation timeout in milliseconds', '45000')
    .option('--no-server', 'Do not start local CORS dev server')
    .option('--clear-session', 'Clear saved authentication session', false)
    .parse(process.argv);

  const opts = program.opts();

  if (opts.clearSession && fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
    console.log('[Test Runner] Cleared saved session state.');
  }

  const detected = detectPluginInfo(opts.project);
  const pluginNamespace = opts.pluginName || detected.name || 'crm';
  const bundleDir = opts.bundleDir || detected.distDir || path.join(opts.project, 'plugin/app/dist');
  const port = parseInt(opts.port, 10);
  const bundleUrl = `http://localhost:${port}/bundle.js`;

  let devServer = null;
  if (opts.server !== false && fs.existsSync(bundleDir)) {
    try {
      devServer = await createCorsServer(bundleDir, port);
      console.log(`[Test Runner] Local CORS server running on port ${port} serving ${bundleDir}`);
    } catch (e) {
      if (e.code === 'EADDRINUSE') {
        console.log(`[Test Runner] Port ${port} already in use; assuming existing dev server.`);
      } else {
        console.warn(`[Test Runner] Could not start dev server: ${e.message}`);
      }
    }
  }

  const cleanup = () => {
    if (devServer) {
      try { devServer.close(); } catch (e) {}
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(); });
  process.on('SIGTERM', () => { cleanup(); process.exit(); });

  console.log(`[Test Runner] Launching Chromium (headed: ${opts.headed})...`);
  const browser = await chromium.launch({
    headless: !opts.headed,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    // Without an explicit locale, headless Chromium in a container with no system locale set
    // (LANG=C/POSIX, common in CI/sandboxed environments) reports something Flutter's Intl init
    // rejects outright: `RangeError: Incorrect locale information provided`, thrown before the
    // Dart side ever registers window.__GLYVIO_AI__'s callback — every AI-bridge call then fails
    // with "Dart callback never registered", with no indication the real cause is locale-related.
    locale: 'pt-BR',
    // Flutter web registers a service worker that aggressively caches JS assets (including the
    // glyvio_core plugin bundle) for offline support. Right after a fresh deploy, the SW can keep
    // serving a stale/incomplete cached copy of that bundle even though the CDN/origin already has
    // the correct one — a plain fetch()/curl against the same URL looks perfectly fine, but the app
    // itself throws "SyntaxError: Unexpected token '<'" trying to eval() the stale cached body.
    // Blocking service workers entirely for these automated runs avoids that class of false
    // failure (this is a disposable test browser context, not a real user session that benefits
    // from SW caching).
    serviceWorkers: 'block',
  };

  if (fs.existsSync(SESSION_FILE) && !opts.clearSession) {
    try {
      contextOptions.storageState = SESSION_FILE;
    } catch (e) {}
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Listen to browser console and app errors
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[AI Bridge]') || text.includes('CORE-') || text.includes('Error')) {
      console.log(`[Browser Console - ${msg.type()}]: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`[Browser PageError]: ${err.message}`);
  });

  const timeoutMs = parseInt(opts.timeout, 10);
  page.setDefaultTimeout(timeoutMs);

  console.log(`[Test Runner] Navigating to ${opts.url}...`);
  await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  // Handle Authentication if on login page
  const checkAuth = async () => {
    // This app does not reliably change the URL to `/login` — it can render the login form directly
    // at the base path without any URL change. URL-based detection alone misses that case, so also
    // probe for a visible <input> this early in the load (before any real screen has rendered, the
    // only thing that legitimately shows up in the DOM this fast is the login form's auto-focused
    // first field).
    // isVisible() does NOT poll - it's a single, immediate DOM check (confirmed empirically: it
    // returned in ~25ms regardless of the timeout passed to it). Right after domcontentloaded the
    // app is still booting (Firebase/canvaskit init observed to take 10-20s+ before the login form
    // paints), so an immediate check almost always sees nothing yet. waitFor({state: 'visible'})
    // is the one that actually polls up to its timeout.
    const hasVisibleInput = await page
      .locator('input')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    const looksLikeLogin = page.url().includes('/login') || hasVisibleInput;

    if (looksLikeLogin) {
      console.log('[Test Runner] Login form detected.');
      if (!opts.email || !opts.password) {
        throw new Error(
          'Login required, but --email and --password (or GLYVIO_EMAIL and GLYVIO_PASSWORD env vars) were not provided.'
        );
      }

      console.log(`[Test Runner] Submitting credentials for ${opts.email}...`);
      // Flutter web's login inputs carry no distinguishing type/name/role attribute (a CSS selector
      // for "the password field" reliably matches nothing), and the password field only exists in the
      // DOM while focused (Flutter's IME-input-proxy renders native <input> elements on demand) — so
      // fill the one field Playwright CAN find (the auto-focused first field, i.e. email) via a
      // selector, then reach the password field by coordinate click instead. A Tab keypress was tried
      // first as a more "portable" alternative and empirically does NOT move focus in this Flutter web
      // app (confirmed: the typed password went nowhere, field stayed empty) — coordinate clicks are
      // the only thing that has actually worked, tied to the fixed 1440x900 viewport this tool always
      // launches with. If that viewport ever changes, these coordinates must be re-validated.
      await page.locator('input').first().fill(opts.email);
      await page.mouse.click(1050, 496); // password field
      await page.waitForTimeout(300);
      await page.keyboard.type(opts.password, { delay: 30 });
      await page.mouse.click(1050, 569); // "Logar" button

      await page.waitForTimeout(15000);
      console.log(`[Test Runner] Post-login URL: ${page.url()}`);

      // Check if login failed — URL-based only (see caveat above); a false negative here just means
      // the run continues and fails loudly later at the bridge-ready wait instead.
      if (page.url().includes('/login')) {
        throw new Error('Login failed: credentials were not accepted or login stayed on /login.');
      }

      // Save session storage
      try {
        await context.storageState({ path: SESSION_FILE });
        console.log('[Test Runner] Saved session state to .session_auth.json.');
      } catch (e) {}
    }

    // Check company selection
    if (page.url().includes('/company-select')) {
      console.log('[Test Runner] Company select page detected.');
      await page.waitForTimeout(2000);
      if (opts.company) {
        // Try clicking specific company
        const companyEl = page.locator(`text="${opts.company}"`).first();
        if (await companyEl.isVisible()) {
          await companyEl.click();
        } else {
          // Select first company card
          await page.locator('.company-card, [role="button"]').first().click();
        }
      } else {
        // Select first available company
        const firstCard = page.locator('button, [role="button"]').first();
        if (await firstCard.isVisible()) {
          await firstCard.click();
        }
      }
      await page.waitForTimeout(4000);
    }
  };

  await checkAuth();

  // Wait for Flutter Web and AI Bridge to initialize
  console.log('[Test Runner] Waiting for window.__GLYVIO_AI__...');
  await page.waitForFunction(() => {
    return typeof window.__GLYVIO_AI__ !== 'undefined' &&
           typeof window.__GLYVIO_AI__.setPluginDevOverride === 'function';
  }, { timeout: timeoutMs });

  // The check above only confirms the JS-side bridge object/functions exist — they're defined by a
  // static bootstrap script and are present immediately, well before Flutter finishes booting. The
  // Dart side only registers its own callback once the app has actually initialized, and calling
  // into the bridge before that throws "AI bridge is not available on this page (Dart callback
  // never registered)" even though the structural check above already passed. Poll a real,
  // harmless, read-only bridge call until it actually succeeds (or the same timeout budget elapses).
  console.log('[Test Runner] Waiting for Dart-side bridge callback to register...');
  const bridgeReadyDeadline = Date.now() + timeoutMs;
  let bridgeReady = false;
  let lastBridgeError = null;
  while (Date.now() < bridgeReadyDeadline) {
    try {
      await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      bridgeReady = true;
      break;
    } catch (e) {
      lastBridgeError = e;
      await page.waitForTimeout(500);
    }
  }
  if (!bridgeReady) {
    throw new Error(`Dart-side AI bridge callback never registered after ${timeoutMs}ms: ${lastBridgeError ? lastBridgeError.message : ''}`);
  }

  console.log(`[Test Runner] Injecting dev override: ${pluginNamespace} -> ${bundleUrl}`);
  try {
    await page.evaluate(async ({ pluginNamespace, bundleUrl }) => {
      await window.__GLYVIO_AI__.setPluginDevOverride(pluginNamespace, bundleUrl);
      await window.__GLYVIO_AI__.reloadPlugins();
    }, { pluginNamespace, bundleUrl });
    console.log('[Test Runner] Plugins reloaded with local bundle override.');
  } catch (e) {
    console.error(`[Test Runner] Error setting dev override: ${e.message}`);
  }

  // Wait for stability
  await page.waitForTimeout(2500);

  // Helper to get active callback ID
  const getActiveCallbackId = async () => {
    if (opts.callbackId) return opts.callbackId;
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
    if (screens && screens.length > 0) {
      return screens[screens.length - 1].callbackId;
    }
    return null;
  };

  // Polls describeCurrentScreens() for a screen matching by name/type instead of assuming the last
  // array entry is the one that just opened — needed for flows nested 2+ levels deep (list -> cart ->
  // modal), where a fixed sleep + "last item" guess is fragile: the target screen may take longer
  // than the sleep to mount, or a leftover screen from an earlier step may still be last in the array.
  const waitForScreenByName = async ({ nameObject, surfaceType, timeoutMs: stepTimeoutMs }) => {
    const deadline = Date.now() + (stepTimeoutMs || timeoutMs);
    let lastSeen = null;
    while (Date.now() < deadline) {
      const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
      lastSeen = screens;
      const match = (screens || []).find(
        (s) => (!nameObject || s.nameObject === nameObject) && (!surfaceType || s.surfaceType === surfaceType),
      );
      if (match) return match.callbackId;
      await page.waitForTimeout(400);
    }
    throw new Error(
      `waitForScreen: no screen matching nameObject=${nameObject || '*'} surfaceType=${surfaceType || '*'} appeared within ${stepTimeoutMs || timeoutMs}ms. Last seen screens: ${JSON.stringify(lastSeen)}`,
    );
  };

  const results = {
    success: true,
    timestamp: new Date().toISOString(),
    plugin: pluginNamespace,
    bundleUrl,
    actionsPerformed: [],
    errors: [],
  };

  // Check if scenario file was passed
  if (opts.scenario) {
    const scenarioPath = path.resolve(process.cwd(), opts.scenario);
    if (!fs.existsSync(scenarioPath)) {
      throw new Error(`Scenario file not found: ${scenarioPath}`);
    }
    console.log(`[Test Runner] Executing scenario from ${scenarioPath}...`);
    const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
    const steps = scenario.steps || [];
    // Screen "pinned" by the most recent `waitForScreen` step — subsequent steps target it by
    // default instead of falling back to "last entry in describeCurrentScreens()", which is a poor
    // proxy once a flow nests 2+ screens deep (list -> cart -> modal).
    let pinnedCallbackId = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[Test Runner] Scenario step ${i + 1}/${steps.length}: ${step.action}`);
      results.actionsPerformed.push(step);

      if (step.action === 'navigate') {
        // A bare `path` is ambiguous whenever two routes register the same path string (e.g. a page
        // and a modal both at "/sale-table") — navigate({path}) then resolves to whichever the
        // framework prefers, not necessarily the one you meant, and there is no error to catch (it
        // just opens the wrong screen). Prefer `nameSpace`+`nameObject` (the exact identifiers from
        // listRoutes()/describeCurrentScreens()) whenever the target's path might collide with
        // another route; `path` remains supported for the common non-colliding case.
        await fireAndTolerate(
          () => page.evaluate((p) => window.__GLYVIO_AI__.navigate(p), {
            path: step.path,
            nameSpace: step.nameSpace,
            nameObject: step.nameObject,
          }),
          15000,
          `navigate ${step.path || `${step.nameSpace}/${step.nameObject}`}`,
        );
        await page.waitForTimeout(2000);
      } else if (step.action === 'waitForScreen') {
        pinnedCallbackId = await waitForScreenByName({
          nameObject: step.nameObject,
          surfaceType: step.surfaceType,
          timeoutMs: step.timeoutMs,
        });
        console.log(`[Test Runner] Screen matched (${step.nameObject || '*'}/${step.surfaceType || '*'}): ${pinnedCallbackId}`);
      } else if (step.action === 'dispatch') {
        const cbId = step.callbackId || pinnedCallbackId || (await getActiveCallbackId());
        // Same tolerance as navigate: a dispatch that trips a business-rule validation (GlyvioError)
        // can leave its own promise unresolved while the real error surfaces only via getErrors() —
        // confirmed empirically (a "price list is required" validation on a cart's action). Don't let
        // an unresolved dispatch promise block the scenario; check results.errors afterward instead.
        await fireAndTolerate(
          () => page.evaluate(({ cbId, key, data, unsafe }) => window.__GLYVIO_AI__.dispatchAction(cbId, key, data || {}, unsafe || false), { cbId, key: step.key, data: step.data, unsafe: step.unsafe }),
          15000,
          `dispatch ${step.key}`,
        );
        await page.waitForTimeout(1000);
      } else if (step.action === 'setField') {
        const cbId = step.callbackId || pinnedCallbackId || (await getActiveCallbackId());
        await page.evaluate(async ({ cbId, key, value }) => {
          await window.__GLYVIO_AI__.setFieldValue(cbId, key, value);
        }, { cbId, key: step.key, value: step.value });
      } else if (step.action === 'selectEntity') {
        const cbId = step.callbackId || pinnedCallbackId || (await getActiveCallbackId());
        await page.evaluate(async ({ cbId, fieldName, searchText, pickIndex }) => {
          await window.__GLYVIO_AI__.selectEntityField(cbId, fieldName, searchText, pickIndex || 0);
        }, { cbId, fieldName: step.fieldName, searchText: step.searchText, pickIndex: step.pickIndex });
      } else if (step.action === 'waitForIdle') {
        const cbId = step.callbackId || pinnedCallbackId || (await getActiveCallbackId());
        if (cbId) {
          await page.evaluate(async (cbId) => {
            await window.__GLYVIO_AI__.waitForIdle(cbId, 15000);
          }, cbId);
        }
      } else if (step.action === 'screenshot') {
        // Lets a scenario document its own steps visually (e.g. "01_empty.png", "02_after_add.png")
        // without a hand-rolled script — the standard way to satisfy a "screenshot every step" review.
        const screenshotPath = path.resolve(process.cwd(), step.path);
        const parentDir = path.dirname(screenshotPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: !!step.fullPage });
        console.log(`[Test Runner] Saved step screenshot to ${screenshotPath}`);
      }
    }
  }

  // Handle single CLI action flags
  if (opts.navigate) {
    console.log(`[Test Runner] Navigating to ${opts.navigate}...`);
    await page.evaluate(async (targetPath) => {
      await window.__GLYVIO_AI__.navigate({ path: targetPath });
    }, opts.navigate);
    await page.waitForTimeout(2500);
    results.actionsPerformed.push({ action: 'navigate', path: opts.navigate });
  }

  if (opts.listRoutes) {
    const routes = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
    console.log('[Test Runner] Registered Routes:');
    console.log(JSON.stringify(routes, null, 2));
    results.routes = routes;
  }

  if (opts.describeScreens) {
    const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
    console.log('[Test Runner] Current Screens:');
    console.log(JSON.stringify(screens, null, 2));
    results.screens = screens;
  }

  if (opts.setField) {
    const [key, ...rest] = opts.setField.split('=');
    const value = rest.join('=');
    const cbId = await getActiveCallbackId();
    console.log(`[Test Runner] Setting field "${key}" to "${value}" on screen ${cbId}...`);
    await page.evaluate(async ({ cbId, key, value }) => {
      await window.__GLYVIO_AI__.setFieldValue(cbId, key, value);
    }, { cbId, key, value });
    results.actionsPerformed.push({ action: 'setField', callbackId: cbId, key, value });
  }

  if (opts.selectEntity) {
    const [fieldName, rest] = opts.selectEntity.split('=');
    const [searchText, pickIndexStr] = (rest || '').split(':');
    const pickIndex = pickIndexStr ? parseInt(pickIndexStr, 10) : 0;
    const cbId = await getActiveCallbackId();
    console.log(`[Test Runner] Selecting entity on field "${fieldName}" with query "${searchText}" on screen ${cbId}...`);
    await page.evaluate(async ({ cbId, fieldName, searchText, pickIndex }) => {
      await window.__GLYVIO_AI__.selectEntityField(cbId, fieldName, searchText, pickIndex);
    }, { cbId, fieldName, searchText, pickIndex });
    results.actionsPerformed.push({ action: 'selectEntity', callbackId: cbId, fieldName, searchText, pickIndex });
  }

  if (opts.dispatch) {
    const cbId = await getActiveCallbackId();
    const data = JSON.parse(opts.dispatchData || '{}');
    console.log(`[Test Runner] Dispatching action "${opts.dispatch}" on screen ${cbId}...`);
    await page.evaluate(async ({ cbId, key, data }) => {
      await window.__GLYVIO_AI__.dispatchAction(cbId, key, data);
    }, { cbId, key: opts.dispatch, data });
    results.actionsPerformed.push({ action: 'dispatch', callbackId: cbId, key: opts.dispatch, data });
    await page.waitForTimeout(1500);
  }

  if (opts.getDesign !== undefined) {
    const cbId = typeof opts.getDesign === 'string' ? opts.getDesign : (await getActiveCallbackId());
    console.log(`[Test Runner] Fetching design for callbackId: ${cbId}...`);
    const design = await page.evaluate(async (cbId) => {
      return await window.__GLYVIO_AI__.getDesign(cbId);
    }, cbId);
    results.design = design;
    console.log(JSON.stringify(design, null, 2));
  }

  if (opts.getState !== undefined) {
    const cbId = typeof opts.getState === 'string' ? opts.getState : (await getActiveCallbackId());
    console.log(`[Test Runner] Fetching state for callbackId: ${cbId}...`);
    const rawState = await page.evaluate(async (cbId) => {
      return await window.__GLYVIO_AI__.getState(cbId);
    }, cbId);
    results.stateRaw = rawState;
    results.state = unwrapBridgeValue(rawState);
    console.log(JSON.stringify(results.state, null, 2));
  }

  // Check errors from AI bridge
  const appErrors = await page.evaluate(async () => {
    return await window.__GLYVIO_AI__.getErrors({ limit: 10 });
  });

  results.errors = appErrors || [];
  if (results.errors.length > 0) {
    console.warn(`[Test Runner] App reported ${results.errors.length} error(s):`);
    console.warn(JSON.stringify(results.errors, null, 2));
  } else {
    console.log('[Test Runner] No app errors detected.');
  }

  if (opts.screenshot) {
    const screenshotPath = path.resolve(process.cwd(), opts.screenshot);
    const parentDir = path.dirname(screenshotPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[Test Runner] Saved screenshot to ${screenshotPath}`);
    results.screenshot = screenshotPath;
  }

  await browser.close();
  cleanup();

  console.log('\n================== TEST RUN SUMMARY ==================');
  console.log(`Status: ${results.errors.length === 0 ? 'SUCCESS' : 'ERRORS DETECTED'}`);
  console.log(`Plugin: ${results.plugin}`);
  console.log(`Actions: ${results.actionsPerformed.length}`);
  console.log('======================================================\n');

  if (results.errors.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(`\n[Test Runner FATAL ERROR]: ${err.message}`);
  process.exit(1);
});
