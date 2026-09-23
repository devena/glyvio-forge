const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2'; // "Integrador" user group (required by this company, not exposed in the form)

const ACCOUNTS = [
  { name: 'Banco Itaú - Conta Corrente Principal', code: 'ITAU-01', accountType: 'CHECKING', bankCode: '341', agency: '1234', accountNumber: '56789-0', initialBalance: 15000, editExisting: true },
  { name: 'Caixa Físico - Loja', code: 'CAIXA-01', accountType: 'CASH', bankCode: '', agency: '', accountNumber: '', initialBalance: 500 },
  { name: 'Nubank PJ - Conta Corrente', code: 'NUBANK-PJ', accountType: 'CHECKING', bankCode: '260', agency: '0001', accountNumber: '987654-3', initialBalance: 8000 },
];

async function fillAndSave(page, modalCbId, acc) {
  await C.setField(page, modalCbId, 'state.financialAccount.name', acc.name);
  await C.setField(page, modalCbId, 'state.financialAccount.code', acc.code);
  await C.setField(page, modalCbId, 'state.financialAccount.accountType', acc.accountType);
  if (acc.bankCode) await C.setField(page, modalCbId, 'state.financialAccount.bankCode', acc.bankCode);
  if (acc.agency) await C.setField(page, modalCbId, 'state.financialAccount.agency', acc.agency);
  if (acc.accountNumber) await C.setField(page, modalCbId, 'state.financialAccount.accountNumber', acc.accountNumber);
  if (!acc.editExisting) {
    await C.setField(page, modalCbId, 'state.financialAccount.initialBalance', acc.initialBalance);
    await page.evaluate(async ({ cb, gid }) => {
      await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialAccount.userGroup', gid, true);
    }, { cb: modalCbId, gid: GROUP_ID });
  }
}

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-accounts');
  let tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });

  // Turn the earlier probe's leftover test record into the first real account instead of leaving junk data.
  await page.mouse.click(400, 216);
  await page.waitForTimeout(1500);
  let modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountEditModal', surfaceType: 'modal' });
  await fillAndSave(page, modalCbId, ACCOUNTS[0]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: C.shot('02_modal_nova_conta.png') });
  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(2000);
  tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });

  for (let i = 1; i < ACCOUNTS.length; i++) {
    const acc = ACCOUNTS[i];
    console.log('Creating account:', acc.name);
    await C.dispatch(page, tableCbId, 'create_account');
    modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountEditModal', surfaceType: 'modal' });
    await fillAndSave(page, modalCbId, acc);
    await page.waitForTimeout(500);

    const errs = await C.getErrors(page, modalCbId);
    if (errs && errs.length) console.log('errors before save:', JSON.stringify(errs));

    await C.dispatch(page, modalCbId, 'save');
    await page.waitForTimeout(2000);
    tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: C.shot('01_tabela_contas_bancarias.png') });
  console.log('DONE phase 1 accounts');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
