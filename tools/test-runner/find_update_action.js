const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);
  await C.navigate(page, '/plugin-edit');
  await page.waitForTimeout(3000);
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  const pm = screens.find((s) => s.nameObject === 'PluginManagerEditPage');
  const design = await page.evaluate((cb) => window.__GLYVIO_AI__.getDesign(cb), pm.callbackId);
  const designStr = JSON.stringify(design);
  console.log('design length:', designStr.length);
  require('fs').writeFileSync(
    '/tmp/claude-1000/-opt-data-glyvio-nossos/19f3e91e-4c8d-49a4-90a0-c4600bbd6403/scratchpad/plugin_manager_design.json',
    JSON.stringify(design, null, 2),
  );
  await page.screenshot({ path: C.shot('dbg_plugin_manager2.png') });
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
