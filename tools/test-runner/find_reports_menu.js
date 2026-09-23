const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/full-menu');
  await page.waitForTimeout(2000);
  // Scroll down to find the "Financeiro" group (registered at position 200, likely near the bottom)
  await page.mouse.wheel(0, 5500);
  await page.waitForTimeout(800);
  await page.screenshot({ path: C.shot('dbg_full_menu_scrolled.png'), fullPage: false });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
