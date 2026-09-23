const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/user-group-list');
  await page.waitForTimeout(1500);
  await page.mouse.click(400, 239); // "Integrador" row
  await page.waitForTimeout(2000);
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens after click:', JSON.stringify(screens));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
