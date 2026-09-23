const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-categories');
  await page.waitForTimeout(2000);
  // Row 3 in the list (1.03 - Teste Filha de Sintetica), per the last screenshot's y-position
  await page.mouse.click(400, 413);
  await page.waitForTimeout(1500);
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryEditModal', surfaceType: 'modal' });
  const st = await C.getState(page, modalCbId);
  console.log('editing category:', st.financialCategory?.name, st.financialCategory?.code);
  if (st.financialCategory?.name !== 'Teste Filha de Sintetica') {
    throw new Error('Row mismatch - refusing to deactivate the wrong record: ' + st.financialCategory?.name);
  }
  await C.setField(page, modalCbId, 'state.financialCategory.isActive', false);
  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(2000);

  const listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('03_lista_plano_de_contas.png') });
  console.log('cleanup done');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
