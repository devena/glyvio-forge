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

  await C.navigate(page, '/full-menu');
  await page.waitForTimeout(2000);
  await page.mouse.click(735, 106);
  await page.waitForTimeout(300);
  await page.keyboard.type('Relatórios & DRE', { delay: 30 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: C.shot('dbg_before_click.png') });
  await page.mouse.click(145, 255);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: C.shot('dbg_after_click.png') });
  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens:', JSON.stringify(screens.map((s) => s.nameObject)));

  const modalCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialReportsModal', surfaceType: 'modal' });
  console.log('modal opened:', modalCbId);
  await C.dispatch(page, modalCbId, 'calculate');
  await page.waitForTimeout(3000);

  const errs = await C.getErrors(page, modalCbId);
  console.log('errors:', JSON.stringify(errs));
  await page.screenshot({ path: C.shot('dbg_reports_result.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
