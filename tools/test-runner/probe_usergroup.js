const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/user-group-list');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: C.shot('dbg_user_groups.png') });

  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens:', JSON.stringify(screens));
  if (screens[0]) {
    const state = await C.getState(page, screens[0].callbackId);
    console.log('state:', JSON.stringify(state).slice(0, 2000));
  }

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
