const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-entries');
  await page.waitForTimeout(1500);
  await page.mouse.click(400, 216); // "Conta de Internet - Agosto" (first row, due date ASC)
  await page.waitForTimeout(1500);
  const sidebarCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTabSidebar', surfaceType: 'sidebar' });

  console.log('Clicking Baixas & Pagamentos tab...');
  await page.mouse.click(717, 91);
  await page.waitForTimeout(1500);
  await C.waitForScreenByName(page, { nameObject: 'FinancialSettlementTableSidebar', surfaceType: 'sidebar' });
  await page.screenshot({ path: C.shot('12_subaba_baixas_e_pagamentos_vazia.png') });

  console.log('Clicking "Pagar" button...');
  await page.mouse.click(1316, 38);
  await page.waitForTimeout(1500);
  const settleModalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialSettlementEditModal', surfaceType: 'modal' });

  await C.setField(page, settleModalCbId, 'state.financialSettlement.settlementDate', '2026-08-29');
  await C.setField(page, settleModalCbId, 'state.financialSettlement.paymentMethod', 'PIX');
  await C.setField(page, settleModalCbId, 'state.financialSettlement.transactionCode', 'E18236120202608291234E1');
  await page.evaluate(async ({ cb, gid }) => {
    await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialSettlement.userGroup', gid, true);
  }, { cb: settleModalCbId, gid: GROUP_ID });
  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'recalc_net', {}), settleModalCbId).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: C.shot('13_modal_baixa_pagamento.png') });

  const errs = await C.getErrors(page, settleModalCbId);
  if (errs?.length) console.log('errors before save:', JSON.stringify(errs));

  await C.dispatch(page, settleModalCbId, 'save');
  await page.waitForTimeout(2500);

  await C.waitForScreenByName(page, { nameObject: 'FinancialSettlementTableSidebar', surfaceType: 'sidebar' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('12_subaba_baixas_e_pagamentos.png') });

  console.log('DONE settlement');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
