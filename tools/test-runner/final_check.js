const TEST_ENV = require('./test_env');
const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);
  await C.navigate(page, '/financial-accounts');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: TEST_ENV.shotDir + '/final_accounts.png', fullPage: true });
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
