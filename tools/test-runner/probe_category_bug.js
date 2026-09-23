const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-categories');
  await page.waitForTimeout(2000);
  const listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });
  const errs = await C.getErrors(page, listCbId);
  console.log('list page errors:', JSON.stringify(errs, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
