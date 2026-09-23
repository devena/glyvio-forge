const C = require('./financial_common');

const BUNDLE_URL = 'http://localhost:3001/bundle.js';

(async () => {
  const { browser, page } = await C.launch();
  page.on('request', (r) => { if (r.url().includes('financial_transfer')) console.log('[request]', r.method(), r.url()); });
  page.on('response', async (r) => {
    if (r.url().includes('financial_transfer')) {
      console.log('[response]', r.status(), r.url());
      try { console.log('[body]', (await r.text()).slice(0, 2000)); } catch (e) { console.log('[body read failed]', e.message); }
    }
  });
  await C.ensureLoggedIn(page);

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: 'financial', url: BUNDLE_URL });
  await page.waitForTimeout(3000);

  await C.navigate(page, '/financial-accounts');
  await page.waitForTimeout(1500);
  const accCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialAccountTablePage', surfaceType: 'page' });
  await C.dispatch(page, accCbId, 'transfer');
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialTransferEditModal', surfaceType: 'modal' });

  await C.selectEntity(page, modalCbId, 'state.sourceAccount', 'Itaú', 0);
  await C.selectEntity(page, modalCbId, 'state.destinationAccount', 'Caixa', 0);
  await C.setField(page, modalCbId, 'state.amount', 500);
  await page.waitForTimeout(500);
  await C.dispatch(page, modalCbId, 'save');
  await page.waitForTimeout(3000);

  await C.navigate(page, '/financial-settlements');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: C.shot('dbg_transfer_fix_test.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
