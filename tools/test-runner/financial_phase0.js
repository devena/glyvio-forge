const { launch, ensureLoggedInAndOverridden, shot } = require('./financial_common');

(async () => {
  const { browser, context, page } = await launch({ reuseSession: false });
  await ensureLoggedInAndOverridden(page, context);

  const routes = await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
  const financialRoutes = routes.filter((r) => r.nameSpace === 'financial');
  console.log('financial routes:', financialRoutes.length);
  console.log(JSON.stringify(financialRoutes.map((r) => ({ nameObject: r.nameObject, path: r.path })), null, 2));

  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ path: '/full-menu' }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shot('dbg_full_menu.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
