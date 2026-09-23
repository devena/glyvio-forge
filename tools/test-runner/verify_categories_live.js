const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-categories');
  await page.waitForTimeout(2000);
  const listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });
  const errs = await C.getErrors(page, listCbId);
  console.log('category list errors:', JSON.stringify(errs));
  await page.screenshot({ path: C.shot('03_lista_plano_de_contas.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
