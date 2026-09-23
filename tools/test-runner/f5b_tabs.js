const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';
const ENTRY_ID = '45c38428-9292-46e1-bc01-86310b9973fc'; // Conta de Internet - Agosto (overdue)

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-entries');
  await page.waitForTimeout(1500);
  await page.mouse.click(400, 216); // first row (Conta de Internet, due date ASC sort)
  await page.waitForTimeout(1500);
  await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTabSidebar', surfaceType: 'sidebar' });

  console.log('Clicking Rateio Contábil tab...');
  await page.mouse.click(550, 91);
  await page.waitForTimeout(1500);
  const splitCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntrySplitTableSidebar', surfaceType: 'sidebar' });
  await page.screenshot({ path: C.shot('10_subaba_rateio_contabil_vazia.png') });

  console.log('Creating split entries...');
  await C.dispatch(page, splitCbId, 'create_split');
  const splitModalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntrySplitEditModal', surfaceType: 'modal' });
  await C.selectEntity(page, splitModalCbId, 'state.financialEntrySplit.category', 'Despesas Administrativas', 0);
  await C.selectEntity(page, splitModalCbId, 'state.financialEntrySplit.costCenter', 'Administrativo', 0);
  await C.setField(page, splitModalCbId, 'state.financialEntrySplit.percentage', 60);
  await C.setField(page, splitModalCbId, 'state.financialEntrySplit.amount', 150);
  await page.evaluate(async ({ cb, gid }) => {
    await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialEntrySplit.userGroup', gid, true);
  }, { cb: splitModalCbId, gid: GROUP_ID });
  await page.waitForTimeout(500);
  await page.screenshot({ path: C.shot('11_modal_novo_rateio.png') });
  await C.dispatch(page, splitModalCbId, 'save');
  await page.waitForTimeout(2000);

  let splitCbId2 = await C.waitForScreenByName(page, { nameObject: 'FinancialEntrySplitTableSidebar', surfaceType: 'sidebar' });
  await C.dispatch(page, splitCbId2, 'create_split');
  const splitModalCbId2 = await C.waitForScreenByName(page, { nameObject: 'FinancialEntrySplitEditModal', surfaceType: 'modal' });
  await C.selectEntity(page, splitModalCbId2, 'state.financialEntrySplit.category', 'Despesas com Pessoal', 0);
  await C.selectEntity(page, splitModalCbId2, 'state.financialEntrySplit.costCenter', 'Tecnologia', 0);
  await C.setField(page, splitModalCbId2, 'state.financialEntrySplit.percentage', 40);
  await C.setField(page, splitModalCbId2, 'state.financialEntrySplit.amount', 100);
  await page.evaluate(async ({ cb, gid }) => {
    await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialEntrySplit.userGroup', gid, true);
  }, { cb: splitModalCbId2, gid: GROUP_ID });
  await page.waitForTimeout(500);
  await C.dispatch(page, splitModalCbId2, 'save');
  await page.waitForTimeout(2000);

  await C.waitForScreenByName(page, { nameObject: 'FinancialEntrySplitTableSidebar', surfaceType: 'sidebar' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('10_subaba_rateio_contabil.png') });

  console.log('DONE splits');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
