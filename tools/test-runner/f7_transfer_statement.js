const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-accounts');
  await page.waitForTimeout(1500);
  const accCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  await C.dispatch(page, accCbId, 'transfer');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialTransferEditModal', surfaceType: 'modal' });

  await C.selectEntity(page, modalCbId, 'state.sourceAccount', 'Banco Itaú', 0);
  await C.selectEntity(page, modalCbId, 'state.destinationAccount', 'Caixa Físico', 0);
  await C.setField(page, modalCbId, 'state.amount', 500);
  await C.setField(page, modalCbId, 'state.fee', 0);
  await C.setField(page, modalCbId, 'state.notes', 'Suprimento de caixa para pequenas despesas');
  await page.waitForTimeout(600);
  await page.screenshot({ path: C.shot('15_modal_transferencia_contas.png') });

  const errs = await C.getErrors(page, modalCbId);
  if (errs?.length) console.log('errors before save:', JSON.stringify(errs));

  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(2500);
  const errsAfter = await C.getErrors(page, modalCbId).catch(() => []);
  console.log('errors after save:', JSON.stringify(errsAfter));

  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('dbg_after_transfer.png') });

  // Step 14: unified statement
  await C.navigate(page, '/financial-settlements');
  await page.waitForTimeout(2000);
  await C.waitForScreenByName(page, { nameObject: 'FinancialSettlementTablePage', surfaceType: 'page' });
  await page.screenshot({ path: C.shot('14_tabela_extrato_movimentacoes.png') });

  console.log('DONE transfer + statement');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
