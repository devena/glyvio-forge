const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);
  await C.navigate(page, '/financial-entries');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: C.shot('dbg_entries_check.png') });
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
