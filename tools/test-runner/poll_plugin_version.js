const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  for (let attempt = 1; attempt <= 24; attempt++) {
    await C.navigate(page, '/plugin-edit');
    await page.waitForTimeout(2500);
    let screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
    let pm = screens.find((s) => s.nameObject === 'PluginManagerEditPage');
    if (!pm) {
      console.log('PluginManagerEditPage not found, screens:', JSON.stringify(screens.map((s) => s.nameObject)));
      await page.waitForTimeout(2000);
      screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
      pm = screens.find((s) => s.nameObject === 'PluginManagerEditPage');
      if (!pm) { await page.waitForTimeout(8000); continue; }
    }
    const state = await C.getState(page, pm.callbackId);
    const fin = state.plugins.find((p) => p.namespace === 'financial');
    console.log(`attempt ${attempt}: financial current=${fin.currentVersion} latest=${fin.latestVersion}`);
    if (fin.latestVersion === '0.1.4') {
      console.log('Latest version is now 0.1.4!');
      if (fin.currentVersion === '0.1.4') {
        console.log('Company already on 0.1.4 (auto-updated).');
      } else {
        console.log('Company still on', fin.currentVersion, '- needs manual update trigger.');
        const design = await page.evaluate((cb) => window.__GLYVIO_AI__.getDesign(cb), pm.callbackId);
        require('fs').writeFileSync(
          '/tmp/claude-1000/-opt-data-glyvio-nossos/19f3e91e-4c8d-49a4-90a0-c4600bbd6403/scratchpad/plugin_manager_design.json',
          JSON.stringify(design, null, 2),
        );
      }
      break;
    }
    await page.waitForTimeout(15000);
  }

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
