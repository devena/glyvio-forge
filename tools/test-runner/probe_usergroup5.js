const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2'; // "Integrador" user group

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-accounts');
  const tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  await C.dispatch(page, tableCbId, 'create_account');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountEditModal', surfaceType: 'modal' });

  await C.setField(page, modalCbId, 'state.financialAccount.name', 'Teste UserGroup Unsafe');
  await C.setField(page, modalCbId, 'state.financialAccount.initialBalance', 100);

  try {
    await page.evaluate(async ({ cb, gid }) => {
      await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialAccount.userGroup', gid, true);
    }, { cb: modalCbId, gid: GROUP_ID });
    console.log('setField userGroup with unsafeMode=true succeeded');
  } catch (e) {
    console.log('setField unsafeMode positional failed:', e.message);
  }

  const state1 = await C.getState(page, modalCbId);
  console.log('userGroup after set:', JSON.stringify(state1.financialAccount?.userGroup));

  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(2000);
  const errs = await C.getErrors(page, modalCbId);
  console.log('errors after save attempt:', JSON.stringify(errs));

  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens after save:', JSON.stringify(screens.map((s) => s.nameObject)));

  await page.screenshot({ path: C.shot('dbg_after_save_unsafe.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
