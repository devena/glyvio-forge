const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/full-menu');
  await C.waitForScreenByName(page, { nameObject: 'FullMenuPage', surfaceType: 'page' });
  await page.waitForTimeout(1500);
  await page.mouse.click(735, 106);
  await page.waitForTimeout(300);
  await page.keyboard.type('Relatórios & DRE', { delay: 30 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.mouse.click(252, 248);
  await page.waitForTimeout(1800);

  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  console.log('screens:', JSON.stringify(screens.map((s) => s.nameObject)));
  const modal = screens.find((s) => s.nameObject === 'FinancialReportsModal');
  if (modal) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: C.shot('16_modal_relatorios_dre_fluxo_caixa.png') });
    console.log('captured reports modal');
  } else {
    console.log('reports modal did not open');
  }

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
