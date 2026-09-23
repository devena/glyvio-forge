const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  // Check for a user/group switcher near the avatar
  await page.mouse.click(1391, 33);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: C.shot('dbg_avatar_menu.png') });

  await C.navigate(page, '/financial-accounts');
  const tableCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  await C.dispatch(page, tableCbId, 'create_account');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountEditModal', surfaceType: 'modal' });

  const design = await page.evaluate((cb) => window.__GLYVIO_AI__.getDesign(cb), modalCbId);
  const designStr = JSON.stringify(design);
  console.log('design contains userGroup?', designStr.includes('userGroup') || designStr.includes('user_group'));

  await C.setField(page, modalCbId, 'state.financialAccount.name', 'Teste UserGroup');
  try {
    await page.evaluate(async (cb) => {
      await window.__GLYVIO_AI__.setFieldValue(cb, 'state.financialAccount.userGroup', 'Admin');
    }, modalCbId);
    console.log('setField userGroup=Admin (string) succeeded');
  } catch (e) {
    console.log('setField userGroup by name failed:', e.message);
  }

  const state = await C.getState(page, modalCbId);
  console.log('financialAccount.userGroup after set:', JSON.stringify(state.financialAccount?.userGroup));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
