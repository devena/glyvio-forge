#!/usr/bin/env node
/*
 * Contact sheets (9 prints per image, file name on each) to review many screenshots at once.
 *   node contact_sheet.js <prints_dir> [prefix] [out_dir]
 * Writes <out_dir>/sheet_<prefix><n>.png. Uses the same Playwright lookup as capture.js.
 */
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2] || 'prints');
const prefix = process.argv[3] || '';
const out = path.resolve(process.argv[4] || path.dirname(dir));
function loadPlaywright() {
  for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(process.cwd(), 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT_MODULE.');
}
(async () => {
  const files = fs.readdirSync(dir).filter((f) => /\.(jpg|png)$/.test(f) && f.startsWith(prefix) && !f.startsWith('_')).sort();
  const { chromium } = loadPlaywright();
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  for (let i = 0; i < files.length; i += 9) {
    const cells = files.slice(i, i + 9).map((f) =>
      `<div style="position:relative"><img src="file://${dir}/${f}" style="width:500px;display:block"><b style="position:absolute;top:0;left:0;background:#ff0;padding:2px">${f}</b></div>`).join('');
    const html = path.join(out, '_sheet.html');
    fs.writeFileSync(html, `<body style="margin:0;display:grid;grid-template-columns:repeat(3,500px);font:14px sans-serif">${cells}</body>`);
    await p.goto('file://' + html);
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, `sheet_${prefix}${i / 9}.png`), fullPage: true });
    fs.unlinkSync(html);
  }
  await b.close();
  console.log(files.length, 'prints');
})();
