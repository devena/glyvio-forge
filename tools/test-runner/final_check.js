const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);
  await C.navigate(page, '/financial-accounts');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/claude-1000/-opt-data-glyvio-nossos/19f3e91e-4c8d-49a4-90a0-c4600bbd6403/scratchpad/final_accounts.png', fullPage: true });
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
