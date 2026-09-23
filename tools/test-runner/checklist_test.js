require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const shot = (n) => '/home/ubuntu/_DISK_AI/glyvio-plugin-project/' + n;

async function waitBridgeReady(page, timeoutMs = 60000) {
  await page.waitForFunction(() => typeof window.__GLYVIO_AI__?.setPluginDevOverride === 'function', { timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await page.evaluate(() => window.__GLYVIO_AI__.listRoutes());
      return true;
    } catch (e) {
      await page.waitForTimeout(500);
    }
  }
  throw new Error('bridge never became ready');
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  const page = await context.newPage();

  console.log('=== login flow ===');
  await page.goto(process.env.GLYVIO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitBridgeReady(page);
  await page.fill('input', process.env.GLYVIO_EMAIL);
  await page.mouse.click(1050, 496);
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.GLYVIO_PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569);
  await page.waitForTimeout(15000);
  console.log('url:', page.url());

  console.log('=== inject local plugin override ===');
  for (let i = 0; i < 10; i++) {
    try {
      await page.evaluate(async () => {
        await window.__GLYVIO_AI__.setPluginDevOverride('project', 'http://localhost:3000/bundle.js');
        await window.__GLYVIO_AI__.reloadPlugins();
      });
      console.log('override ok');
      break;
    } catch (e) {
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(3000);

  console.log('=== navigate to kanban, create task ===');
  await page.evaluate(() => window.__GLYVIO_AI__.navigate({ path: '/project-task-kanban' }));
  await page.waitForTimeout(6000);
  const s1 = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  const kanbanCb = s1[0].callbackId;

  const design = await page.evaluate((cb) => window.__GLYVIO_AI__.getDesign(cb), kanbanCb);
  const s = JSON.stringify(design);
  const idx = s.indexOf('"projectTaskStatusId"');
  const idMatch = s.slice(idx, idx + 200).match(/"value": "([a-f0-9-]+)"/);
  const statusId = idMatch ? idMatch[1] : null;
  console.log('using statusId:', statusId);

  await page.evaluate((args) => window.__GLYVIO_AI__.dispatchAction(args.cb, 'new', { projectTaskStatusId: args.statusId }), { cb: kanbanCb, statusId });
  await page.waitForTimeout(4000);
  const s2 = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  const cartCb = s2.find((sc) => sc.nameObject === 'ProjectTaskEditCart').callbackId;
  console.log('cart callbackId:', cartCb);
  await page.screenshot({ path: shot('u1_cart_opened.png') });

  console.log('=== checklist test ===');
  const st0 = await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb);
  fs.writeFileSync('/tmp/u_state_0.json', JSON.stringify(st0, null, 2));
  console.log('checklist@0:', JSON.stringify(st0?.projectTask?.checklist));

  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'checklistAdd', {}), cartCb);
  await page.waitForTimeout(1500);
  const st1 = await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb);
  fs.writeFileSync('/tmp/u_state_1.json', JSON.stringify(st1, null, 2));
  console.log('checklist@1 (after add #1):', JSON.stringify(st1?.projectTask?.checklist));
  await page.screenshot({ path: shot('u2_after_add1.png') });

  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'checklistAdd', {}), cartCb);
  await page.waitForTimeout(1500);
  const st2 = await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cartCb);
  fs.writeFileSync('/tmp/u_state_2.json', JSON.stringify(st2, null, 2));
  console.log('checklist@2 (after add #2):', JSON.stringify(st2?.projectTask?.checklist));
  await page.screenshot({ path: shot('u3_after_add2.png') });

  const errors = await page.evaluate((cb) => window.__GLYVIO_AI__.getErrors({ callbackId: cb, limit: 20 }), cartCb).catch((e) => 'ERR:' + e.message);
  console.log('errors:', JSON.stringify(errors).slice(0, 2000));

  await browser.close();
})().catch((e) => {
  console.error('SCRIPT ERROR', e.message);
  process.exit(1);
});
