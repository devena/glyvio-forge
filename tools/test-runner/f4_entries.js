const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-entries');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('07_tabela_titulos_pagar_receber_vazia.png') });
  let tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTablePage', surfaceType: 'page' });

  async function createEntry({ isReceivable, description, category, costCenter, account, dueDate, competenceDate, issueDate, amountNominal, installments, shotBeforeSave }) {
    console.log('Creating entry:', description);
    await C.dispatch(page, tableCbId, isReceivable ? 'create_receivable' : 'create_payable');
    const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryEditModal', surfaceType: 'modal' });

    await C.setField(page, modalCbId, 'state.financialEntry.description', description);
    await C.selectEntity(page, modalCbId, 'state.financialEntry.category', category, 0);
    if (costCenter) await C.selectEntity(page, modalCbId, 'state.financialEntry.costCenter', costCenter, 0);
    await C.selectEntity(page, modalCbId, 'state.financialEntry.account', account, 0);
    if (dueDate) await C.setField(page, modalCbId, 'state.financialEntry.dueDate', dueDate);
    if (competenceDate) await C.setField(page, modalCbId, 'state.financialEntry.competenceDate', competenceDate);
    if (issueDate) await C.setField(page, modalCbId, 'state.financialEntry.issueDate', issueDate);
    await C.setField(page, modalCbId, 'state.financialEntry.amountNominal', amountNominal);
    if (installments) await C.setField(page, modalCbId, 'state.installmentCount', installments);
    await page.evaluate(async ({ cb, gid }) => {
      await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialEntry.userGroup', gid, true);
    }, { cb: modalCbId, gid: GROUP_ID });
    await page.waitForTimeout(600);

    if (shotBeforeSave) {
      await page.screenshot({ path: C.shot(shotBeforeSave) });
    }

    const errs = await C.getErrors(page, modalCbId);
    if (errs && errs.length) console.log('  errors before save:', JSON.stringify(errs));

    await C.dispatch(page, modalCbId, 'save');
    await page.waitForTimeout(2000);
    tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTablePage', surfaceType: 'page' });
  }

  await createEntry({
    isReceivable: false,
    description: 'Aluguel do Escritório - Setembro',
    category: 'Despesas Administrativas',
    costCenter: 'Administrativo',
    account: 'Banco Itaú',
    dueDate: '2026-09-08',
    competenceDate: '2026-09-01',
    issueDate: '2026-08-25',
    amountNominal: 3500,
  });

  await createEntry({
    isReceivable: false,
    description: 'Compra de Material de Escritório',
    category: 'Despesas Administrativas',
    costCenter: 'Administrativo',
    account: 'Banco Itaú',
    dueDate: '2026-09-15',
    competenceDate: '2026-08-29',
    issueDate: '2026-08-29',
    amountNominal: 900,
    installments: 3,
    shotBeforeSave: '08_modal_novo_titulo_parcelado.png',
  });

  await createEntry({
    isReceivable: true,
    description: 'Prestação de Serviços - Consultoria Financeira',
    category: 'Receita de Serviços',
    costCenter: 'Comercial',
    account: 'Nubank PJ',
    dueDate: '2026-09-13',
    competenceDate: '2026-08-29',
    issueDate: '2026-08-29',
    amountNominal: 5000,
  });

  await createEntry({
    isReceivable: false,
    description: 'Conta de Internet - Agosto',
    category: 'Despesas Administrativas',
    costCenter: 'Administrativo',
    account: 'Banco Itaú',
    dueDate: '2026-08-10',
    competenceDate: '2026-08-01',
    issueDate: '2026-07-25',
    amountNominal: 250,
  });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: C.shot('07_tabela_titulos_pagar_receber.png') });
  console.log('DONE phase 4 entries');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
