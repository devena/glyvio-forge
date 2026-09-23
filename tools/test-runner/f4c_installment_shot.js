const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-entries');
  const tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTablePage', surfaceType: 'page' });
  await C.dispatch(page, tableCbId, 'create_payable');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryEditModal', surfaceType: 'modal' });

  await C.setField(page, modalCbId, 'state.financialEntry.description', 'Compra de Material de Escritório');
  await C.selectEntity(page, modalCbId, 'state.financialEntry.category', 'Despesas Administrativas', 0);
  await C.selectEntity(page, modalCbId, 'state.financialEntry.costCenter', 'Administrativo', 0);
  await C.selectEntity(page, modalCbId, 'state.financialEntry.account', 'Banco Itaú', 0);
  await C.setField(page, modalCbId, 'state.financialEntry.dueDate', '2026-09-15');
  await C.setField(page, modalCbId, 'state.financialEntry.amountNominal', 900);
  await C.setField(page, modalCbId, 'state.installmentCount', 3);
  await page.waitForTimeout(700);
  await page.screenshot({ path: C.shot('08_modal_novo_titulo_parcelado.png') });

  // Only for the screenshot — installments created via this flow currently can't satisfy the
  // company's required user_group_id (each installment is a fresh entity built internally by
  // onSave, outside what the bridge's unsafeMode can patch beforehand). Cancel instead of save.
  await C.dispatch(page, modalCbId, 'cancel');
  await page.waitForTimeout(1500);

  console.log('DONE installment screenshot');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
