#!/usr/bin/env node
// Generated from src/scripts/check_icons.mjs by tools/generate.py.
/**
 * Finds icon names a plugin uses that the app cannot draw (they show up as a triangle, with no
 * error at build or run time):
 *
 *   node check_icons.mjs <plugin dir> [more dirs...]
 *
 * Checks every string literal in the `.ts` sources that looks like an icon name — starts with
 * `fa_`, `ma_` or `sax_` — against the `glyvio_core.GlyvioIconName` union declared in the
 * plugin's `plugin/app/@types/glyvio_core.d.ts` (run `run_helper.sh` first if it is missing). Unprefixed names (which the app also
 * resolves) and names built at run time cannot be told apart from other strings and are not
 * checked. Exits with 1 when something is wrong, so it can run in CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('usage: node check_icons.mjs <plugin dir> [more dirs...]');
  process.exit(2);
}

/** Reads the `GlyvioIconName` union from the first `glyvio_core.d.ts` found under the given dirs. */
function loadKnownNames() {
  for (const dir of dirs) {
    for (const layer of ['app', 'server', 'environment']) {
      const file = path.join(dir, 'plugin', layer, '@types', 'glyvio_core.d.ts');
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const start = text.search(/type GlyvioIconName\s*=/);
      if (start < 0) continue;
      const end = text.indexOf(';', start);
      return new Set([...text.slice(start, end).matchAll(/['"]([a-z0-9_]+)['"]/g)].map((m) => m[1]));
    }
  }
  console.error('GlyvioIconName not found: expected plugin/<layer>/@types/glyvio_core.d.ts (run run_helper.sh).');
  process.exit(2);
}
const known = loadKnownNames();

const SKIP = new Set(['node_modules', 'dist', '@types', '.git']);
const LITERAL = /(['"`])((?:fa|ma|sax)_[a-z0-9_]+)\1/g;

function* sources(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(full);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) yield full;
  }
}

/** A close known name, to suggest a fix (same family, most shared words). */
function suggest(name) {
  const [family, ...words] = name.split('_');
  let best;
  let bestScore = 0;
  for (const candidate of known) {
    if (!candidate.startsWith(family + '_')) continue;
    const other = candidate.split('_').slice(1);
    const score = words.filter((w) => other.includes(w)).length - Math.abs(other.length - words.length) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

let problems = 0;
for (const dir of dirs) {
  for (const file of sources(dir)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(LITERAL)) {
        const name = match[2];
        if (known.has(name)) continue;
        problems++;
        const hint = suggest(name);
        console.log(`${path.relative(process.cwd(), file)}:${index + 1}  ${name}${hint ? `  (talvez ${hint}?)` : ''}`);
      }
    });
  }
}
console.log(problems ? `\n${problems} nome(s) de ícone desconhecido(s)` : 'nenhum nome de ícone desconhecido');
process.exit(problems ? 1 : 0);
