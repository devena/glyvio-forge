const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);
  await C.navigate(page, '/plugin-edit');
  await page.waitForTimeout(3000);
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  const pm = screens.find((s) => s.nameObject === 'PluginManagerEditPage');
  if (!pm) {
    console.log('no PluginManagerEditPage, screens:', JSON.stringify(screens.map((s) => s.nameObject)));
  } else {
    const state = await C.getState(page, pm.callbackId);
    console.log('plugins:', JSON.stringify(state.plugins?.map((p) => ({ ns: p.namespace, cur: p.currentVersion, latest: p.latestVersion }))));
  }
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
