const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';

const COST_CENTERS = [
  { code: 'ADM', name: 'Administrativo', parentSearch: null },
  { code: 'COM', name: 'Comercial', parentSearch: null },
  { code: 'TI', name: 'Tecnologia da Informação', parentSearch: 'Administrativo' },
];

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-cost-centers');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('05_lista_centros_de_custo_vazia.png') });
  let listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCostCenterListPage', surfaceType: 'page' });

  for (let i = 0; i < COST_CENTERS.length; i++) {
    const cc = COST_CENTERS[i];
    console.log('Creating cost center:', cc.code, cc.name);
    await C.dispatch(page, listCbId, 'create_cost_center');
    const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCostCenterEditModal', surfaceType: 'modal' });

    await C.setField(page, modalCbId, 'state.financialCostCenter.code', cc.code);
    await C.setField(page, modalCbId, 'state.financialCostCenter.name', cc.name);
    await page.evaluate(async ({ cb, gid }) => {
      await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialCostCenter.userGroup', gid, true);
    }, { cb: modalCbId, gid: GROUP_ID });

    if (cc.parentSearch) {
      try {
        await C.selectEntity(page, modalCbId, 'state.financialCostCenter.parent', cc.parentSearch, 0);
        console.log('  parent linked to', cc.parentSearch);
      } catch (e) {
        console.log('  parent link failed:', e.message);
      }
      await page.waitForTimeout(500);
    }

    if (i === 0) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: C.shot('06_modal_novo_centro_de_custo.png') });
    }

    const errs = await C.getErrors(page, modalCbId);
    if (errs && errs.length) console.log('errors before save:', JSON.stringify(errs));

    await C.dispatch(page, modalCbId, 'save');
    await page.waitForTimeout(2000);
    listCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialCostCenterListPage', surfaceType: 'page' });
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: C.shot('05_lista_centros_de_custo.png') });
  console.log('DONE phase 3 cost centers');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
