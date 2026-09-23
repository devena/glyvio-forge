const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';

// NOTE: parent-category linking is skipped — the "Categoria Pai" picker forces isSynthetic:false
// (see FinancialCategoryEntityModal.populateQueryBuilder), so a synthetic root can never be
// selected as a parent through the published UI. Flat list only, until that bug is fixed.
const CATEGORIES = [
  { code: '1.01', name: 'Receita de Serviços', categoryType: 'INCOME', isSynthetic: false },
  { code: '1.02', name: 'Receita de Vendas', categoryType: 'INCOME', isSynthetic: false },
  { code: '2.01', name: 'Despesas Administrativas', categoryType: 'EXPENSE', isSynthetic: false },
  { code: '2.02', name: 'Despesas com Pessoal', categoryType: 'EXPENSE', isSynthetic: false },
  { code: '2.03', name: 'Despesas com Fornecedores', categoryType: 'EXPENSE', isSynthetic: false },
];

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-categories');
  let listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });

  for (const cat of CATEGORIES) {
    console.log('Creating category:', cat.code, cat.name);
    await C.dispatch(page, listCbId, 'create_category');
    const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryEditModal', surfaceType: 'modal' });

    await C.setField(page, modalCbId, 'state.financialCategory.code', cat.code);
    await C.setField(page, modalCbId, 'state.financialCategory.name', cat.name);
    await C.setField(page, modalCbId, 'state.financialCategory.categoryType', cat.categoryType);
    await C.setField(page, modalCbId, 'state.financialCategory.isSynthetic', cat.isSynthetic);
    await page.evaluate(async ({ cb, gid }) => {
      await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialCategory.userGroup', gid, true);
    }, { cb: modalCbId, gid: GROUP_ID });

    const errs = await C.getErrors(page, modalCbId);
    if (errs && errs.length) console.log('errors before save:', JSON.stringify(errs));

    await C.dispatch(page, modalCbId, 'save');
    await page.waitForTimeout(2000);
    listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: C.shot('03_lista_plano_de_contas.png') });
  console.log('DONE phase 2 categories (remaining)');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
