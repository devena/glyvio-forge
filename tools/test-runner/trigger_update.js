const TEST_ENV = require('./test_env');
const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);
  await C.navigate(page, '/plugin-edit');
  await page.waitForTimeout(3000);
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  const pm = screens.find((s) => s.nameObject === 'PluginManagerEditPage');

  console.log('Dispatching onTapUpdate for financial plugin...');
  await page.evaluate(async (cb) => {
    await window.__GLYVIO_AI__.dispatchAction(cb, 'onTapUpdate', {
      id: TEST_ENV.pluginRecordId,
      latestVersion: '0.1.4',
    });
  }, pm.callbackId);
  await page.waitForTimeout(8000);

  const state = await C.getState(page, pm.callbackId);
  const fin = state.plugins.find((p) => p.namespace === 'financial');
  console.log('after update: current=', fin.currentVersion, 'latest=', fin.latestVersion);

  const errs = await C.getErrors(page, pm.callbackId);
  console.log('errors:', JSON.stringify(errs));

  await page.screenshot({ path: C.shot('dbg_after_update.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
