const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-accounts');
  const tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  await C.dispatch(page, tableCbId, 'create_account');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountEditModal', surfaceType: 'modal' });

  await C.setField(page, modalCbId, 'state.financialAccount.name', 'Banco Bradesco - Conta Corrente');
  await C.setField(page, modalCbId, 'state.financialAccount.code', 'BRAD-01');
  await C.setField(page, modalCbId, 'state.financialAccount.accountType', 'CHECKING');
  await C.setField(page, modalCbId, 'state.financialAccount.bankCode', '237');
  await C.setField(page, modalCbId, 'state.financialAccount.agency', '5678');
  await C.setField(page, modalCbId, 'state.financialAccount.accountNumber', '11223-4');
  await C.setField(page, modalCbId, 'state.financialAccount.initialBalance', 3000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: C.shot('02_modal_nova_conta.png') });

  // Discard - this was only for the screenshot, not part of the real dataset.
  await C.dispatch(page, modalCbId, 'cancel');
  await page.waitForTimeout(1500);

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
