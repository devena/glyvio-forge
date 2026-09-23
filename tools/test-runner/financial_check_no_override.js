const { launch, shot } = require('./financial_common');
require('dotenv').config({ path: '/opt/data/glyvio/nossos/glyvio-plugin-financial/.env' });

(async () => {
  const { browser, context, page } = await launch({ reuseSession: false });

  await page.goto(process.env.APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const hasVisibleInput = await page.locator('input').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (page.url().includes('/login') || hasVisibleInput) {
    await page.locator('input').first().fill(process.env.USERNAME);
    await page.mouse.click(1050, 496);
    await page.waitForTimeout(300);
    await page.keyboard.type(process.env.PASSWORD, { delay: 30 });
    await page.mouse.click(1050, 569);
    await page.waitForTimeout(6000);
  }
  if (page.url().includes('/company-select')) {
    for (let i = 0; i < 20 && page.url().includes('/company-select'); i++) await page.waitForTimeout(1000);
  }
  await page.waitForFunction(
    () => typeof window.__GLYVIO_AI__ !== 'undefined' && typeof window.__GLYVIO_AI__.setPluginDevOverride === 'function',
    { timeout: 30000 },
  );
  for (let i = 0; i < 60; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; } catch (e) { await page.waitForTimeout(500); }
  }
  console.log('logged in, url=', page.url());

  // NO override call here - testing the real published plugin bundle as installed on the company
  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ path: '/full-menu' }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shot('11_full_menu_no_override.png') });

  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ path: '/financial-entries' }));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('12_entries_no_override.png') });

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
