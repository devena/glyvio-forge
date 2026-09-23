const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';
const BUNDLE_URL = 'http://localhost:3001/bundle.js';

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  console.log('Injecting local dev bundle override...');
  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: 'financial', url: BUNDLE_URL });
  await page.waitForTimeout(3000);

  await C.navigate(page, '/financial-categories');
  await page.waitForTimeout(2000);
  const listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });
  const errs1 = await C.getErrors(page, listCbId);
  console.log('category list errors:', JSON.stringify(errs1));
  await page.screenshot({ path: C.shot('dbg_fix_category_list.png') });

  // Try creating a category and linking it to a synthetic parent (e.g. "Receitas")
  await C.dispatch(page, listCbId, 'create_category');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryEditModal', surfaceType: 'modal' });
  await C.setField(page, modalCbId, 'state.financialCategory.code', '1.03');
  await C.setField(page, modalCbId, 'state.financialCategory.name', 'Teste Filha de Sintetica');
  await C.setField(page, modalCbId, 'state.financialCategory.categoryType', 'INCOME');
  await page.evaluate(async ({ cb, gid }) => {
    await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialCategory.userGroup', gid, true);
  }, { cb: modalCbId, gid: GROUP_ID });

  try {
    await C.selectEntity(page, modalCbId, 'state.financialCategory.parent', 'Receitas', 0);
    console.log('selectEntity parent=Receitas succeeded');
  } catch (e) {
    console.log('selectEntity parent failed:', e.message);
  }
  const st = await C.getState(page, modalCbId);
  console.log('parent after select:', JSON.stringify(st.financialCategory?.parent));

  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(2000);
  const errs2 = await C.getErrors(page, modalCbId);
  console.log('errors after save:', JSON.stringify(errs2));

  const listCbId2 = await C.waitForScreenByName(page, { nameObject: 'FinancialCategoryListPage', surfaceType: 'page' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('dbg_fix_category_list2.png') });

  // Cost centers too
  await C.navigate(page, '/financial-cost-centers');
  await page.waitForTimeout(2000);
  const ccCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCostCenterListPage', surfaceType: 'page' });
  const errs3 = await C.getErrors(page, ccCbId);
  console.log('cost center list errors:', JSON.stringify(errs3));
  await page.screenshot({ path: C.shot('dbg_fix_costcenter_list.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
