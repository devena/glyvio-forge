const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/full-menu');
  await page.waitForTimeout(2000);
  await page.mouse.click(735, 106);
  await page.waitForTimeout(300);
  await page.keyboard.type('Relatórios', { delay: 30 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: C.shot('dbg_full_menu_search.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
