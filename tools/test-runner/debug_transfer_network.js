const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  page.on('request', (r) => { if (r.url().includes('financial_transfer')) console.log('[request]', r.method(), r.url(), r.postData()); });
  page.on('response', async (r) => {
    if (r.url().includes('financial_transfer')) {
      console.log('[response]', r.status(), r.url());
      try { console.log('[body]', (await r.text()).slice(0, 1000)); } catch (e) {}
    }
  });
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-accounts');
  await page.waitForTimeout(1500);
  const accCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  await C.dispatch(page, accCbId, 'transfer');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialTransferEditModal', surfaceType: 'modal' });

  await C.selectEntity(page, modalCbId, 'state.sourceAccount', 'Nubank PJ', 0);
  await C.selectEntity(page, modalCbId, 'state.destinationAccount', 'Caixa Físico', 0);
  await C.setField(page, modalCbId, 'state.amount', 200);
  await C.setField(page, modalCbId, 'state.fee', 0);
  await page.waitForTimeout(500);

  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(4000);

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
