const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  page.on('request', (r) => { if (r.url().includes('financial_dre_report') || r.url().includes('financial_cashflow_report')) console.log('[request]', r.method(), r.url()); });
  page.on('response', async (r) => {
    if (r.url().includes('financial_dre_report') || r.url().includes('financial_cashflow_report')) {
      console.log('[response]', r.status(), r.url());
      try { console.log('[body]', (await r.text()).slice(0, 500)); } catch (e) {}
    }
  });
  await C.ensureLoggedIn(page);

  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ nameSpace: 'financial', nameObject: 'FinancialReportsModal' })).catch((e) => console.log('nav err', e.message));
  await page.waitForTimeout(2500);
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens:', JSON.stringify(screens.map((s) => s.nameObject)));
  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialReportsModal', surfaceType: 'modal' });
  await C.dispatch(page, modalCbId, 'calculate');
  await page.waitForTimeout(3000);

  const errs = await C.getErrors(page, modalCbId);
  console.log('errors:', JSON.stringify(errs));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
