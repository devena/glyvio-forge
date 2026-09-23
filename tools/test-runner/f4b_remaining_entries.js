const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-entries');
  let tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTablePage', surfaceType: 'page' });

  async function setUserGroupWithRetry(modalCbId) {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(async ({ cb, gid }) => {
        await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialEntry.userGroup', gid, true);
      }, { cb: modalCbId, gid: GROUP_ID });
      await page.waitForTimeout(400);
      const st = await C.getState(page, modalCbId);
      if (st.financialEntry?.userGroup?.id === GROUP_ID) return true;
      console.log('  userGroup not set yet, retrying...', i);
      await page.waitForTimeout(500);
    }
    return false;
  }

  async function createEntry({ isReceivable, description, category, costCenter, account, dueDate, competenceDate, issueDate, amountNominal }) {
    console.log('Creating entry:', description);
    await C.dispatch(page, tableCbId, isReceivable ? 'create_receivable' : 'create_payable');
    const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryEditModal', surfaceType: 'modal' });

    await C.setField(page, modalCbId, 'state.financialEntry.description', description);
    await C.selectEntity(page, modalCbId, 'state.financialEntry.category', category, 0);
    if (costCenter) await C.selectEntity(page, modalCbId, 'state.financialEntry.costCenter', costCenter, 0);
    await C.selectEntity(page, modalCbId, 'state.financialEntry.account', account, 0);
    await C.setField(page, modalCbId, 'state.financialEntry.dueDate', dueDate);
    await C.setField(page, modalCbId, 'state.financialEntry.competenceDate', competenceDate);
    await C.setField(page, modalCbId, 'state.financialEntry.issueDate', issueDate);
    await C.setField(page, modalCbId, 'state.financialEntry.amountNominal', amountNominal);
    await page.waitForTimeout(500);

    const ok = await setUserGroupWithRetry(modalCbId);
    console.log('  userGroup set ok:', ok);

    const errs = await C.getErrors(page, modalCbId);
    if (errs && errs.length) console.log('  pre-existing errors:', errs.length);

    await C.dispatch(page, modalCbId, 'save');
    await page.waitForTimeout(2500);
    const errsAfter = await C.getErrors(page, modalCbId).catch(() => []);
    if (errsAfter && errsAfter.length > (errs?.length || 0)) {
      console.log('  NEW error after save:', JSON.stringify(errsAfter[errsAfter.length - 1]?.errorMessage));
    }
    tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTablePage', surfaceType: 'page' });
  }

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

  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('dbg_after_remaining_entries.png') });
  console.log('DONE');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
