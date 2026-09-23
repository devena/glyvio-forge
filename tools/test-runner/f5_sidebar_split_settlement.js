const C = require('./financial_common');

const GROUP_ID = 'c3791df1-81b3-497e-9735-c6dea81776f2';

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-entries');
  await page.waitForTimeout(1500);
  // Row 1: "Aluguel do Escritório - Setembro"
  await page.mouse.click(400, 216);
  await page.waitForTimeout(1500);
  const sidebarCbId = await C.waitForScreenByName(page, { nameObject: 'FinancialEntryTabSidebar', surfaceType: 'sidebar' });
  const sbState = await C.getState(page, sidebarCbId);
  const entryId = sbState.routeParams?.id;
  console.log('entry id:', entryId);
  await page.waitForTimeout(500);
  await page.screenshot({ path: C.shot('09_painel_lateral_detalhes_titulo.png') });

  // --- Step 10/11: Rateio Contábil ---
  await page.evaluate((cb) => window.__GLYVIO_AI__.navigate({ path: '/financial-entry-split-table-sidebar' }), sidebarCbId).catch(() => {});
  // Better: dispatch via the tab sidebar's own "others" content route using navigate with nameObject
  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ nameSpace: 'financial', nameObject: 'FinancialEntrySplitTableSidebar' })).catch((e) => console.log('nav split tab failed (expected, needs entryId):', e.message));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
