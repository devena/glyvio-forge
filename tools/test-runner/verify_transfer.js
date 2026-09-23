const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-settlements');
  await page.waitForTimeout(3000);
  const cbId = await C.waitForScreenByName(page, { nameObject: 'FinancialSettlementTablePage', surfaceType: 'page' });
  const errs = await C.getErrors(page, cbId);
  console.log('settlement page errors:', JSON.stringify(errs));

  // scroll the table horizontally a bit and take a full screenshot
  await page.screenshot({ path: C.shot('dbg_settlements_recheck.png'), fullPage: true });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
