#!/usr/bin/env node
// Generated from src/scripts/i18n_check.mjs by tools/generate.py.
// i18n check for Glyvio plugins (keys, locales and ICU parameters in .arb files).
//
//   node tools/i18n_check.mjs [projectDir] [options]
//
//   --arb <dir>        .arb folder of the project (default: <projectDir>/assets/i18n)
//   --extra <dir>      more .arb folders whose keys the project may use (repeatable), e.g. the
//                      .arb folder of another plugin your code reads keys from
//   --ignore-prefix <p> skip "missing" reports for keys starting with <p> (repeatable). Defaults
//                      to `core_` when no --extra folder is given, since the core's own .arb files
//                      are not shipped with plugins and its keys resolve at runtime
//   --src <dir>        source folders to scan (repeatable; default: plugin, shared, lib)
//   --strict           exit 1 when any problem is found (for CI / release)
//   --json             machine-readable output
//
// Reports:
//   missing      key used in code ($T{key}, t('key'), translate('key'), translateKey('key'))
//                but absent from every loaded .arb
//   locale       key present in one locale of the project and absent from another
//   placeholder  {placeholders} of a message differ between locales
//   params       $T{key a=…} / t('key', { a }) passing names the message doesn't use
//   risk         .arb value with {{…}} or a dotted path ($S{state.x}) — translations are run
//                through the template engine, so those would read the screen's data
//   legacy       .arb value with the old $S{param} parameters (server error messages filled
//                from the error's params); fine as is, migrate to ICU {param} when touched
//   syntax       message whose braces don't balance (ICU would fail to parse)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = { arb: undefined, extra: [], ignore: [], src: [], strict: false, json: false, dir: '.' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a == '--arb') opt.arb = args[++i];
  else if (a == '--extra') opt.extra.push(args[++i]);
  else if (a == '--ignore-prefix') opt.ignore.push(args[++i]);
  else if (a == '--src') opt.src.push(args[++i]);
  else if (a == '--strict') opt.strict = true;
  else if (a == '--json') opt.json = true;
  else opt.dir = a;
}

const root = path.resolve(opt.dir);
const arbDir = path.resolve(root, opt.arb ?? 'assets/i18n');
if (opt.extra.length == 0 && opt.ignore.length == 0) {
  opt.ignore.push('core_');
}
const srcDirs = (opt.src.length ? opt.src : ['plugin', 'shared', 'lib'])
  .map((d) => path.resolve(root, d))
  .filter((d) => fs.existsSync(d));

// ── .arb files ──────────────────────────────────────────────────────────────
function readArbDir(dir) {
  const locales = {};
  if (!fs.existsSync(dir)) return locales;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.arb')) continue;
    const locale = f.replace(/\.arb$/, '').replace(/^.*\./, '');
    try {
      const json = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      locales[locale] = Object.fromEntries(Object.entries(json).filter(([k]) => !k.startsWith('@')));
    } catch (e) {
      console.error(`Invalid JSON in ${path.join(dir, f)}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  return locales;
}

const project = readArbDir(arbDir);
const extras = opt.extra.map(readArbDir);
const known = new Set();
for (const set of [project, ...extras])
  for (const loc of Object.values(set)) for (const k of Object.keys(loc)) known.add(k);

// Argument names of an ICU message: {name}, {name, plural, …}, {name, select, …}, including the
// ones inside plural/select branches. Branch bodies (`one{…}`, `other {…}`) are text, not arguments.
function placeholders(msg) {
  const names = new Set();
  const stack = ['text']; // 'text' = message text, 'options' = the branch list of a plural/select
  for (let i = 0; i < msg.length; i++) {
    const c = msg[i];
    const frame = stack[stack.length - 1];
    if (frame == 'text' && c == "'" && '{}#'.includes(msg[i + 1] ?? '')) {
      const end = msg.indexOf("'", i + 1);
      i = end < 0 ? msg.length : end;
      continue;
    }
    if (c == '{') {
      if (frame == 'options') {
        stack.push('text');
        continue;
      }
      const m = /^\{\s*([A-Za-z_]\w*)\s*(,\s*(plural|select|selectordinal)\s*,)?/.exec(msg.substring(i));
      if (m) {
        names.add(m[1]);
        if (m[2]) {
          stack.push('options');
          i += m[0].length - 1;
          continue;
        }
      }
      // A simple argument ({name} or {n, number}): skip to its closing brace.
      const end = msg.indexOf('}', i);
      i = end < 0 ? msg.length : end;
      continue;
    }
    if (c == '}' && stack.length > 1) stack.pop();
  }
  return names;
}

function balanced(msg) {
  let depth = 0;
  for (let i = 0; i < msg.length; i++) {
    const c = msg[i];
    if (c == "'" && '{}#'.includes(msg[i + 1] ?? '')) {
      const end = msg.indexOf("'", i + 1);
      if (end < 0) return false;
      i = end;
      continue;
    }
    if (c == '{') depth++;
    if (c == '}' && --depth < 0) return false;
  }
  return depth == 0;
}

// ── sources ─────────────────────────────────────────────────────────────────
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', '.dart_tool', '@types'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|mjs|js|dart)$/.test(e.name) && !/\.(d\.ts|g\.dart|freezed\.dart)$/.test(e.name)) files.push(p);
  }
}
srcDirs.forEach(walk);

const uses = new Map(); // key -> [{ file, line, params }]
const reToken = /\$T\{([A-Za-z_][\w.]*)((?:\s+[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|[^\s}]+))*)\s*\}/g;
const reCall =
  /\b(?:t|translate|translateKey)\(\s*['"]([A-Za-z_][\w.]*)['"]\s*(?:,\s*(?:undefined|null)\s*)?(?:,\s*\{([^}]*)\})?/g;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const lineOf = (idx) => text.substring(0, idx).split('\n').length;
  // Examples in doc comments aren't uses.
  const inComment = (idx) => {
    const start = text.lastIndexOf('\n', idx) + 1;
    return /^\s*(\*|\/\/|\/\*)/.test(text.substring(start, idx));
  };
  for (const m of text.matchAll(reToken)) {
    if (inComment(m.index)) continue;
    const params = [...(m[2] ?? '').matchAll(/([A-Za-z_]\w*)=/g)].map((p) => p[1]);
    add(m[1], f, lineOf(m.index), params);
  }
  for (const m of text.matchAll(reCall)) {
    if (inComment(m.index)) continue;
    // { a: x, 'b': y, c } → a, b, c (the key side only; shorthand TS props count as keys).
    const params =
      m[2] != undefined
        ? m[2]
            .split(',')
            .map((part) => {
              const left = part.includes(':') ? part.split(':')[0] : part;
              return left.trim().replace(/^['"]|['"]$/g, '');
            })
            .filter((n) => /^[A-Za-z_]\w*$/.test(n))
        : [];
    add(m[1], f, lineOf(m.index), params);
  }
}
function add(key, file, line, params) {
  if (!uses.has(key)) uses.set(key, []);
  uses.get(key).push({ file: path.relative(root, file), line, params: params.filter(Boolean) });
}

// ── checks ──────────────────────────────────────────────────────────────────
const problems = [];
const report = (type, key, detail) => problems.push({ type, key, detail });

for (const [key, list] of uses) {
  if (!known.has(key) && !opt.ignore.some((p) => key.startsWith(p)))
    report('missing', key, `${list[0].file}:${list[0].line}${list.length > 1 ? ` (+${list.length - 1})` : ''}`);
}

const locales = Object.keys(project);
const projectKeys = new Set(locales.flatMap((l) => Object.keys(project[l])));
for (const key of projectKeys) {
  const missingIn = locales.filter((l) => !(key in project[l]));
  if (missingIn.length) report('locale', key, `missing in ${missingIn.join(', ')}`);

  const sets = locales.filter((l) => key in project[l]).map((l) => [l, placeholders(`${project[l][key]}`)]);
  const ref = sets[0] ? [...sets[0][1]].sort().join(',') : '';
  for (const [l, set] of sets.slice(1)) {
    const cur = [...set].sort().join(',');
    if (cur != ref) report('placeholder', key, `${sets[0][0]} {${ref}} vs ${l} {${cur}}`);
  }
  for (const l of locales) {
    const v = project[l][key];
    if (typeof v != 'string') continue;
    if (/\{\{|\$[SNDMB]\{[^}]*[.[]/.test(v)) report('risk', key, `${l}: ${JSON.stringify(v.slice(0, 80))}`);
    else if (/\$[SNDMB]\{/.test(v)) report('legacy', key, `${l}: ${JSON.stringify(v.slice(0, 80))}`);
    if (!balanced(v)) report('syntax', key, `${l}: ${JSON.stringify(v.slice(0, 80))}`);
  }
}

for (const [key, list] of uses) {
  const msg = [project, ...extras].map((set) => set[Object.keys(set)[0]]?.[key]).find((v) => v != undefined);
  if (msg == undefined) continue;
  const declared = placeholders(`${msg}`);
  for (const u of list) {
    const extra = u.params.filter((p) => !declared.has(p));
    if (extra.length) report('params', key, `${u.file}:${u.line} passes {${extra.join(', ')}} not in the message`);
  }
}

// ── output ──────────────────────────────────────────────────────────────────
const order = ['missing', 'locale', 'placeholder', 'params', 'syntax', 'risk', 'legacy'];
// legacy is informative: it never fails --strict.
const failing = problems.filter((p) => p.type != 'legacy');
if (opt.json) {
  console.log(JSON.stringify({ root, keysUsed: uses.size, arbKeys: projectKeys.size, problems }, null, 2));
} else {
  console.log(`i18n check · ${path.relative(process.cwd(), root) || '.'}`);
  console.log(
    `  ${files.length} files · ${uses.size} keys used · ${projectKeys.size} keys in ${locales.join(', ') || '(no .arb)'}${opt.extra.length ? ` · +${opt.extra.length} extra .arb dir(s)` : ''}`,
  );
  for (const type of order) {
    const list = problems.filter((p) => p.type == type);
    if (!list.length) continue;
    console.log(`\n${type} (${list.length})`);
    for (const p of list.slice(0, 40)) console.log(`  ${p.key}  ${p.detail}`);
    if (list.length > 40) console.log(`  … ${list.length - 40} more (use --json for all)`);
  }
  if (!failing.length) console.log('\n  no problems');
}
if (opt.strict && failing.length) process.exitCode = 1;
