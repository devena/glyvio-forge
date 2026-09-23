const C = require('./financial_common');

(async () => {
  const { browser, page } = await C.launch();
  const seen = new Set();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'app-beta.glyvio.com' && !seen.has(u.hostname)) {
      seen.add(u.hostname);
      console.log('[other-host]', u.hostname, r.url());
    }
    if (r.resourceType() === 'xhr' || r.resourceType() === 'fetch') {
      console.log('[xhr/fetch]', r.method(), r.url());
    }
  });
  await C.ensureLoggedIn(page);

  await C.navigate(page, '/financial-accounts');
  await page.waitForTimeout(3000);

  console.log('--- known hosts ---', [...seen]);
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
