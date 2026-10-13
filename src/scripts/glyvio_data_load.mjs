#!/usr/bin/env node
// Initial data load for a Glyvio company: CSV/JSON files -> POST /entity/{companyId}/save-list.
// No dependencies (Node 18+). Used by the data import agent; it writes the load plan, this runs it.
//
//   node glyvio_data_load.mjs model <entity.d.ts> [--entity a,b]     data model as JSON (from the JSDoc)
//   node glyvio_data_load.mjs query "<sql>" [--param v]... [--env f]   rows as JSON (query-for-user)
//   node glyvio_data_load.mjs check <plan.json> [--only s] [--offline] [--sample n]
//   node glyvio_data_load.mjs load  <plan.json> [--only s] [--skip-invalid]
//   node glyvio_data_load.mjs count <plan.json> [--only s]
//
// Credentials come from a .env (same keys as the glyvio-dev-helper): G_USERNAME, G_PASSWORD,
// G_COMPANY_ID, optional G_AUTH_URL. Default .env: next to the plan (or the current folder).
//
// Plan (paths relative to the plan file):
//   {
//     "model": "../plugin/server/@types/entity.d.ts",
//     "env": ".env",                       // optional
//     "workdir": "carga",                  // state, log and error reports (default: <plan dir>/carga)
//     "timezone": "America/Sao_Paulo",     // optional; default: the company zoneinfo
//     "steps": [{
//       "name": "01_clientes", "entity": "client", "file": "clientes.csv",
//       "csv": { "delimiter": ";", "encoding": "utf-8" },        // optional (delimiter is detected)
//       "decimalSeparator": ",",                                  // optional: "," or "." (default: detect)
//       "integrationCode": "CNPJ",              // a column, or a template like "cli-{Código}"
//       "columns": {
//         "Razão Social": "name",
//         "Nascimento": { "field": "birth_date", "format": "DD/MM/YYYY" },
//         "Status": { "field": "status_id", "lookup": { "Ativo": "<id>", "Inativo": "<id>" } },
//         "Vendedor": { "field": "salesperson_id", "ref": "id" },   // value already is a Glyvio id
//         "Cliente": "client_id",                // FK without lookup: value = integration_code
//         "Grupo": { "field": "tag_group_id", "ic": "grp-{value}" },  // code built like the other step's
//         "Origem": { "field": "entity_id", "polymorphic": "entity_name" },
//         "Etiquetas": { "field": "tags", "json": "list", "separator": ",", "lookup": { "VIP": "<id>" } }
//       },
//       "constants": { "user_group_id": "<id>" },
//       "pluginsOff": ["glyvio-plugin-x"]       // shown as a reminder before the step is loaded
//     }]
//   }
//
// FK resolution (field with @foreignKey, no lookup/ref): the value is the integration_code of the
// referenced record. Its id is the id already on the server for that code, else the id this load
// gives the record (when another step loads it), else it is an error.
// Record ids: the server id for the integration_code when it exists, else uuid5(entity:code), so
// running a step again updates instead of duplicating.
//
// Output: check/load/count print a JSON summary on stdout; progress goes to stderr and
// <workdir>/carga.log. Rows with problems go to <workdir>/<step>.erros.csv (original columns + motivo);
// rows the server refused go to <workdir>/<step>.erros-servidor.csv.
// Exit code: 0 ok, 1 usage/plan error, 2 validation or load errors.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const NAMESPACE = '6f1f4c1e-9d0a-4c5e-8b1a-2f6d0c3a7e11';
const MAX_BATCH = 500;
const SEP = String.fromCharCode(31);
const DEFAULT_AUTH = 'https://auth-webapi-prod.glyvio.com';
// default fields the load may fill; the other @defaultEntitiesField are kept by the server
const WRITABLE_DEFAULT_FIELDS = new Set(['integration_code', 'user_group_id', 'tags', 'observers']);

class PlanError extends Error {}

// ── args ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opt = { _: [], param: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a == '--param') opt.param.push(argv[++i]);
    else if (['--env', '--only', '--entity', '--sample'].includes(a)) opt[a.slice(2)] = argv[++i];
    else if (a == '--offline') opt.offline = true;
    else if (a == '--skip-invalid') opt.skipInvalid = true;
    else opt._.push(a);
  }
  return opt;
}

// ── model (entity.d.ts JSDoc written by the glyvio-dev-helper) ─────────────
const TAGS = ['notNull', 'unique', 'defaultValue', 'foreignKey', 'sequence', 'decimal', 'defaultEntitiesField', 'plugin'];
const TAG_RE = new RegExp(`(?:^|\\s)@(${TAGS.join('|')})\\b`);
const RUNTIME_TYPES = {
  EntityFieldString: 'TEXT', EntityFieldEnum: 'ENUM', EntityFieldBoolean: 'BOOLEAN',
  EntityFieldDateTime: 'TIMESTAMP', EntityFieldDecimal: 'DECIMAL', EntityFieldInteger: 'INTEGER',
  EntityFieldJsonAsString: 'JSON', EntityFieldJsonAsMap: 'JSON', EntityFieldEntity: 'ENTITY',
  EntityFieldSequence: 'SEQUENCE',
};

function objectName(name, firstUpper) {
  let out = '';
  let upper = firstUpper;
  for (const c of name) {
    if (c == '_') upper = true;
    else if (upper) { out += c.toUpperCase(); upper = false; }
    else out += c.toLowerCase();
  }
  return out;
}

function parseFieldDoc(text) {
  const doc = { description: null };
  const m = text.match(TAG_RE);
  const desc = (m ? text.slice(0, m.index) : text).trim();
  if (desc) doc.description = desc;
  if (!m) return doc;
  const parts = text.slice(m.index).split(new RegExp(`\\s@(?=(?:${TAGS.join('|')})\\b)`));
  for (const raw of parts) {
    const p = raw.trim().replace(/^@/, '');
    const [tag, ...rest] = p.split(' ');
    const value = rest.join(' ').trim();
    if (tag == 'notNull') doc.notNull = true;
    else if (tag == 'unique') doc.unique = true;
    else if (tag == 'defaultEntitiesField') doc.defaultField = true;
    else if (tag == 'defaultValue') doc.defaultValue = value;
    else if (tag == 'plugin') doc.plugin = value;
    else if (tag == 'sequence') doc.sequence = value;
    else if (tag == 'foreignKey') {
      const fk = value.match(/^(\S+)\s*\((physical|logical)\)/);
      if (fk) doc.foreignKey = { entity: fk[1], physical: fk[2] == 'physical' };
    } else if (tag == 'decimal') {
      const [p1, s1] = value.split(',');
      doc.decimal = { precision: p1 ? Number(p1) : null, scale: s1 ? Number(s1) : null };
    }
  }
  return doc;
}

function readModel(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('namespace glyvio_structure');
  if (start < 0) throw new PlanError(`${file}: namespace glyvio_structure não encontrado`);
  const lines = text.slice(start).split('\n');
  const entities = {};
  const classes = {};
  let docLines = null;
  let lastDoc = null;
  let current = null;
  let currentClass = null;
  let hasMetadata = false;
  for (const line of lines) {
    const t = line.trim();
    if (current) {
      if (t == '}') { current = null; continue; }
      const doc = t.match(/^\/\*\*\s?(.*?)\s?\*\/$/);
      if (doc) { lastDoc = doc[1]; continue; }
      const f = t.match(/^(\w+)\?: (.+?) \| null;$/);
      if (f) {
        if (f[1].endsWith('_ic') && current.fields[f[1].slice(0, -3) + '_id']?.foreignKey) {
          lastDoc = null;
          continue;
        }
        current.fields[f[1]] = { name: f[1], tsType: f[2], ...(lastDoc ? parseFieldDoc(lastDoc) : { description: null }) };
        current.order.push(f[1]);
        lastDoc = null;
      }
      continue;
    }
    if (currentClass) {
      if (t == '}') { currentClass = null; continue; }
      const f = t.match(/^(\w+): (EntityField\w+);$/);
      if (f) currentClass.push(f[2]);
      continue;
    }
    if (t == '/**') { docLines = []; continue; }
    if (docLines) {
      if (t == '*/') { lastDoc = docLines; docLines = null; } else docLines.push(t.replace(/^\*\s?/, ''));
      continue;
    }
    const iface = t.match(/^export interface (\w+)\s+extends Model \{$/);
    if (iface) {
      const e = { name: iface[1], description: null, plugin: null, parentPermission: null, uniqueIndexes: [], fields: {}, order: [] };
      const desc = [];
      for (const d of Array.isArray(lastDoc) ? lastDoc : []) {
        if (d.startsWith('@plugin ')) { e.plugin = d.slice(8).trim(); hasMetadata = true; }
        else if (d.startsWith('@parentPermission ')) {
          const pp = d.slice(18).match(/^(\w+) -> (\w+)\.(\w+)/);
          if (pp) e.parentPermission = { field: pp[1], entity: pp[2], foreignField: pp[3] };
        } else if (d.startsWith('@unique ')) {
          const u = d.slice(8).match(/^(\S+) \((.*)\)$/);
          if (u) e.uniqueIndexes.push({ name: u[1], fields: u[2].split(',').map((s) => s.trim()) });
        } else if (d) desc.push(d);
      }
      e.description = desc.join(' ') || null;
      entities[e.name] = e;
      current = e;
      lastDoc = null;
      continue;
    }
    const cls = t.match(/^class __(\w+)\s+extends Entity \{$/);
    if (cls) { currentClass = classes[cls[1]] = []; continue; }
    lastDoc = null;
  }
  // field type: runtime class of the __Entity declaration (same field order as the interface)
  for (const e of Object.values(entities)) {
    const runtime = classes[objectName(e.name, true)] ?? [];
    e.order.forEach((name, i) => {
      const f = e.fields[name];
      f.type = RUNTIME_TYPES[runtime[i]] ?? (f.foreignKey ? 'ENTITY' : f.sequence ? 'SEQUENCE' : tsToType(f.tsType));
    });
    delete e.order;
    for (const f of Object.values(e.fields)) delete f.tsType;
  }
  return { hasMetadata, entities };
}

function tsToType(ts) {
  return { Decimal: 'DECIMAL', number: 'INTEGER', boolean: 'BOOLEAN', DateTime: 'TIMESTAMP' }[ts] ?? 'TEXT';
}

// ── .env / server ───────────────────────────────────────────────────────────
function readEnv(file) {
  const env = {};
  if (!file || !fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

class Glyvio {
  constructor(envFile) {
    const env = { ...readEnv(envFile) };
    const pick = (...keys) => keys.map((k) => env[k] ?? process.env[k]).find((v) => v);
    this.user = pick('G_USERNAME', 'GLYVIO_USER');
    this.password = pick('G_PASSWORD', 'GLYVIO_PASSWORD');
    this.companyId = pick('G_COMPANY_ID', 'GLYVIO_COMPANY_ID');
    this.authUrl = (pick('G_AUTH_URL', 'GLYVIO_URL_AUTH') ?? DEFAULT_AUTH).replace(/\/+$/, '');
    if (!this.user || !this.password || !this.companyId) {
      throw new PlanError(`credenciais ausentes: G_USERNAME, G_PASSWORD e G_COMPANY_ID no ${envFile ?? '.env'}`);
    }
    this.auth = 'Basic ' + Buffer.from(`${this.user}:${this.password}`).toString('base64');
  }

  async connect() {
    const companies = await this.request('GET', `${this.authUrl}/user/companies`);
    const company = (companies ?? []).find((c) => c.id == this.companyId);
    if (!company) {
      const names = (companies ?? []).map((c) => `${c.name} (${c.id})`).join(', ');
      throw new PlanError(`empresa ${this.companyId} não encontrada para este usuário. Disponíveis: ${names || 'nenhuma'}`);
    }
    this.companyName = company.name;
    this.zoneinfo = company.zoneinfo;
    this.serverUrl = (company.server?.serverUrl ?? '').replace(/\/+$/, '');
    return this;
  }

  async request(method, url, body) {
    let last;
    for (let attempt = 0; attempt < 6; attempt++) {
      let resp;
      try {
        resp = await fetch(url, {
          method,
          headers: { Authorization: this.auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(600_000),
        });
      } catch (e) {
        last = String(e);
        await sleep(Math.min(2 ** attempt, 30) * 1000);
        continue;
      }
      const text = await resp.text();
      if ([502, 503, 504].includes(resp.status)) {
        last = text.slice(0, 300);
        await sleep(Math.min(2 ** attempt, 30) * 1000);
        continue;
      }
      if (resp.status == 401) throw new PlanError('login recusado (usuário ou senha do .env)');
      if (resp.status >= 400) throw new ServerError(`${method} ${url} -> ${resp.status}`, text);
      return text ? JSON.parse(text) : null;
    }
    throw new ServerError(`${method} ${url} falhou após várias tentativas`, last ?? '');
  }

  query(sql, params = []) {
    return this.request('POST', `${this.serverUrl}/query/${this.companyId}/query-for-user`, {
      query: sql,
      typedParams: params.map((value) => ({ dataType: 'TEXT', value })),
    }).then((r) => r ?? []);
  }

  saveList(entityName, records) {
    const data = {};
    records.forEach((r, i) => { data[i] = { entityName, objectId: r.id, entity: r }; });
    return this.request('POST', `${this.serverUrl}/entity/${this.companyId}/save-list`, data);
  }
}

class ServerError extends Error {
  constructor(message, body) {
    super(message);
    this.body = body;
  }
  get readable() {
    try {
      const body = JSON.parse(this.body);
      if (Array.isArray(body.errors) && body.errors.length) {
        return [...new Set(body.errors.map((e) => {
          const reason = REASONS[e.reason] ?? e.jsMessage ?? e.description ?? e.reason ?? 'erro';
          const a = e.args ?? {};
          const where = [a.fieldName && `campo ${a.fieldName}`, a.value != null && `valor "${a.value}"`].filter(Boolean).join(', ');
          return where ? `${reason} (${where})` : reason;
        }))].join(' | ');
      }
    } catch {
      // not JSON: fall back to the message fields in the text
    }
    const found = [...String(this.body).matchAll(/"(?:jsMessage|description|reason|message)"\s*:\s*"((?:[^"\\]|\\.){1,500})"/g)].map((m) => m[1]);
    return found.length ? [...new Set(found)].join(' | ') : String(this.body).slice(0, 500);
  }
}

const REASONS = {
  invalid_value_for_field: 'valor inválido ou registro relacionado inexistente',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── values ──────────────────────────────────────────────────────────────────
function uuid5(name) {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const h = crypto.createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

function normalizeNumber(raw, sep) {
  let v = String(raw).trim().replace(/\s|R\$|%/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
  if (v.startsWith('-')) { neg = !neg; v = v.slice(1); }
  if (sep == ',') v = v.replace(/\./g, '').replace(',', '.');
  else if (sep == '.') v = v.replace(/,/g, '');
  else if (v.includes(',') && v.includes('.')) {
    v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  } else if (v.includes(',')) v = v.replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(v)) return null;
  return (neg ? '-' : '') + v.replace(/\.$/, '');
}

function roundDecimal(num, scale) {
  const neg = num.startsWith('-');
  const [i, f = ''] = num.replace('-', '').split('.');
  if (scale == null) return { value: num, intDigits: i.replace(/^0+/, '').length };
  let digits = BigInt(i + f.padEnd(scale + 1, '0').slice(0, scale + 1));
  digits = (digits + 5n) / 10n; // half up on the absolute value
  let s = digits.toString().padStart(scale + 1, '0');
  const intPart = s.slice(0, s.length - scale).replace(/^0+(?=\d)/, '');
  const value = (neg && digits != 0n ? '-' : '') + intPart + (scale > 0 ? '.' + s.slice(-scale) : '');
  return { value, intDigits: intPart.replace(/^0+/, '').length };
}

const TRUE = new Set(['true', 't', '1', 'sim', 's', 'yes', 'y', 'x', 'verdadeiro', 'v', 'ativo']);
const FALSE = new Set(['false', 'f', '0', 'não', 'nao', 'n', 'no', 'falso', 'inativo']);

function zoneOffset(utcMs, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}

function localToUtc(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = guess - zoneOffset(guess, tz);
  utc = guess - zoneOffset(utc, tz);
  return new Date(utc).toISOString();
}

function parseDate(raw, format, tz) {
  const v = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  }
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
  let y, mo, d;
  if (m) [, y, mo, d] = m;
  else {
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    const us = (format ?? '').toUpperCase().startsWith('MM');
    [d, mo] = us ? [m[2], m[1]] : [m[1], m[2]];
    y = m[3].length == 2 ? (Number(m[3]) > 50 ? '19' : '20') + m[3] : m[3];
  }
  const [h, mi, s] = [m[4] ?? 0, m[5] ?? 0, m[6] ?? 0].map(Number);
  [y, mo, d] = [y, mo, d].map(Number);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() != mo - 1 || check.getUTCDate() != d || h > 23 || mi > 59 || s > 59) return null;
  return localToUtc(y, mo, d, h, mi, s, tz); // date-only: midnight in the company time zone
}

// ── files ───────────────────────────────────────────────────────────────────
function readRows(file, csvOpt = {}) {
  const buf = fs.readFileSync(file);
  if (file.toLowerCase().endsWith('.json')) {
    let data = JSON.parse(buf.toString('utf8'));
    if (!Array.isArray(data)) data = data.rows ?? data.data ?? Object.values(data).find(Array.isArray) ?? [];
    return data.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [
      k, v == null ? '' : typeof v == 'object' ? JSON.stringify(v) : String(v),
    ])));
  }
  const enc = (csvOpt.encoding ?? 'utf-8').toLowerCase().replace(/[^a-z0-9]/g, '');
  let text = ['latin1', 'iso88591', 'windows1252', 'cp1252'].includes(enc) ? buf.toString('latin1') : buf.toString('utf8');
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = csvOpt.delimiter ?? [';', ',', '\t', '|'].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c == '"' && text[i + 1] == '"') { cell += '"'; i++; }
      else if (c == '"') quoted = false;
      else cell += c;
    } else if (c == '"' && cell == '') quoted = true;
    else if (c == delimiter) { row.push(cell); cell = ''; }
    else if (c == '\n' || c == '\r') {
      if (c == '\r' && text[i + 1] == '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell != '' || row.length) { row.push(cell); rows.push(row); }
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => c.trim() != ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function writeCsv(file, rows) {
  if (!rows.length) {
    if (fs.existsSync(file)) fs.rmSync(file);
    return;
  }
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  fs.writeFileSync(file, '﻿' + [cols.map(esc).join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\r\n') + '\r\n');
}

// ── plan ────────────────────────────────────────────────────────────────────
function loadPlan(planFile, opt) {
  const dir = path.dirname(path.resolve(planFile));
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const rel = (p) => (p ? path.resolve(dir, p) : p);
  if (!plan.model) throw new PlanError('plano sem "model" (caminho do entity.d.ts)');
  const model = readModel(rel(plan.model));
  if (!model.hasMetadata) {
    throw new PlanError('o entity.d.ts não tem os metadados (@notNull, @foreignKey…): gere os @types de novo com o glyvio-dev-helper atual');
  }
  const steps = (plan.steps ?? []).map((s, i) => normalizeStep(s, i, model, rel));
  const names = new Set();
  for (const s of steps) {
    if (names.has(s.name)) throw new PlanError(`etapa repetida: ${s.name}`);
    names.add(s.name);
  }
  const workdir = rel(plan.workdir ?? 'carga');
  fs.mkdirSync(workdir, { recursive: true });
  const envFile = opt.env ? path.resolve(opt.env) : rel(plan.env ?? '.env');
  return { plan, model, steps, workdir, envFile, timezone: plan.timezone };
}

function normalizeStep(s, i, model, rel) {
  const where = `etapa ${s.name ?? i + 1}`;
  const entity = model.entities[s.entity];
  if (!entity) throw new PlanError(`${where}: entity "${s.entity}" não existe no modelo`);
  if (!s.file) throw new PlanError(`${where}: sem "file"`);
  if (!s.integrationCode) throw new PlanError(`${where}: sem "integrationCode" (coluna ou modelo "{Coluna}")`);
  const columns = [];
  for (const [col, spec0] of Object.entries(s.columns ?? {})) {
    const spec = typeof spec0 == 'string' ? { field: spec0 } : { ...spec0 };
    const field = entity.fields[spec.field];
    if (!field) throw new PlanError(`${where}: coluna "${col}" aponta para "${spec.field}", que não existe em ${s.entity}`);
    if (spec.polymorphic && !entity.fields[spec.polymorphic]) {
      throw new PlanError(`${where}: "${spec.polymorphic}" (polymorphic de ${spec.field}) não existe em ${s.entity}`);
    }
    columns.push({ column: col, ...spec, meta: field });
  }
  for (const f of Object.keys(s.constants ?? {})) {
    if (!entity.fields[f]) throw new PlanError(`${where}: constante "${f}" não existe em ${s.entity}`);
  }
  return {
    name: s.name ?? `${String(i + 1).padStart(2, '0')}_${s.entity}`,
    entity: s.entity,
    meta: entity,
    file: rel(s.file),
    csv: s.csv ?? {},
    decimalSeparator: s.decimalSeparator,
    integrationCode: s.integrationCode,
    columns,
    constants: s.constants ?? {},
    pluginsOff: s.pluginsOff ?? [],
  };
}

function integrationCodeOf(step, row) {
  const t = step.integrationCode;
  if (!t.includes('{')) return String(row[t] ?? '').trim();
  let missing = false;
  const v = t.replace(/\{([^}]+)\}/g, (_, c) => {
    const x = String(row[c] ?? '').trim();
    if (!x) missing = true;
    return x;
  });
  return missing ? '' : v;
}

// ── conversion & validation ─────────────────────────────────────────────────
// Converts the rows of every step. Server lookups (existing ids, FK by integration_code, unique
// values) are batched per entity; with --offline they are skipped and reported as warnings.
async function prepare(ctx) {
  const { steps, g, tz } = ctx;
  const known = new Map(); // entity -> Map(ic -> id) from the server
  const planned = new Map(); // entity -> Set(ic) loaded by this plan
  const warnings = [];
  ctx.planned = planned;
  ctx.warnings = warnings;

  for (const step of steps) {
    if (!fs.existsSync(step.file)) throw new PlanError(`${step.name}: arquivo não encontrado: ${step.file}`);
    step.rows = readRows(step.file, step.csv);
    const missingCols = step.columns.map((c) => c.column).filter((c) => step.rows.length && !(c in step.rows[0]));
    if (missingCols.length) throw new PlanError(`${step.name}: colunas ausentes no arquivo: ${missingCols.join(', ')}`);
    step.ics = step.rows.map((r) => integrationCodeOf(step, r));
    const set = planned.get(step.entity) ?? new Set();
    step.ics.forEach((ic) => ic && set.add(ic));
    planned.set(step.entity, set);
  }

  const fetchIds = async (entity, ics) => {
    const map = known.get(entity) ?? new Map();
    known.set(entity, map);
    const todo = [...new Set(ics)].filter((ic) => ic && !map.has(ic));
    if (!g || !todo.length) return map;
    for (let i = 0; i < todo.length; i += 1000) {
      const chunk = todo.slice(i, i + 1000);
      const rows = await g.query(
        `select id, integration_code, deleted from ${entity} where integration_code = any(string_to_array(?, chr(31)))`,
        [chunk.join(SEP)],
      );
      for (const r of rows) map.set(r.integration_code, { id: r.id, deleted: r.deleted === true });
      for (const ic of chunk) if (!map.has(ic)) map.set(ic, null);
    }
    return map;
  };

  for (const [entity, ics] of planned) await fetchIds(entity, [...ics]);

  const resolveRef = async (target, ic) => {
    const fromServer = (await fetchIds(target, [ic])).get(ic);
    if (fromServer) return fromServer.id;
    if (planned.get(target)?.has(ic)) return uuid5(`${target}:${ic}`);
    return null;
  };

  for (const step of steps) {
    const existing = known.get(step.entity);
    step.records = [];
    step.problems = [];
    const seen = new Map();
    const uniqueSeen = new Map();
    const order = steps.indexOf(step);
    for (const [idx, row] of step.rows.entries()) {
      const line = idx + 2; // header is line 1
      const errors = [];
      const ic = step.ics[idx];
      if (!ic) errors.push(`código de integração vazio (${step.integrationCode})`);
      else if (seen.has(ic)) errors.push(`código de integração repetido (linha ${seen.get(ic)})`);
      else seen.set(ic, line);
      const server = ic ? existing.get(ic) : null;
      const rec = { id: server?.id ?? uuid5(`${step.entity}:${ic}`), integration_code: ic };
      Object.assign(rec, step.constants);

      for (const c of step.columns) {
        const raw = row[c.column];
        if (raw == null || String(raw).trim() == '') continue; // empty does not overwrite
        try {
          const v = await convert(c, String(raw), rec, row, step, ctx, resolveRef);
          if (v !== undefined) rec[c.field] = v;
        } catch (e) {
          errors.push(`${c.column}: ${e.message}`);
        }
      }

      if (!server) {
        for (const f of Object.values(step.meta.fields)) {
          if (f.notNull && f.defaultValue == null && !f.sequence && f.name != 'id' && rec[f.name] == null) {
            errors.push(`campo obrigatório sem valor: ${f.name}${f.description ? ` (${f.description})` : ''}`);
          }
        }
      } else if (server.deleted) {
        warnings.push(`${step.name} linha ${line}: o registro ${ic} está excluído no Glyvio; será atualizado e continua excluído`);
      }

      for (const f of Object.values(step.meta.fields)) {
        if (f.unique && f.name != 'integration_code' && rec[f.name] != null) {
          const key = `${f.name}=${rec[f.name]}`;
          if (uniqueSeen.has(key)) errors.push(`${f.name} repetido no arquivo (linha ${uniqueSeen.get(key)})`);
          else uniqueSeen.set(key, line);
        }
      }
      for (const u of step.meta.uniqueIndexes) {
        if (u.fields.every((f) => rec[f] != null)) {
          const key = `${u.name}=${u.fields.map((f) => rec[f]).join(SEP)}`;
          if (uniqueSeen.has(key)) errors.push(`combinação ${u.fields.join(' + ')} repetida no arquivo (linha ${uniqueSeen.get(key)})`);
          else uniqueSeen.set(key, line);
        }
      }

      if (errors.length) step.problems.push({ line, row, errors });
      else step.records.push({ line, row, rec, exists: !!server });
    }

    // single-field unique values that already belong to another record on the server
    if (g) {
      for (const f of Object.values(step.meta.fields)) {
        if (!f.unique || f.name == 'integration_code') continue;
        const values = [...new Set(step.records.map((r) => r.rec[f.name]).filter((v) => v != null).map(String))];
        for (let i = 0; i < values.length; i += 1000) {
          const rows = await g.query(
            `select id, ${f.name} as v from ${step.entity} where ${f.name}::text = any(string_to_array(?, chr(31)))`,
            [values.slice(i, i + 1000).join(SEP)],
          );
          const owner = new Map(rows.map((r) => [String(r.v), r.id]));
          step.records = step.records.filter((r) => {
            const o = owner.get(String(r.rec[f.name]));
            if (!o || o == r.rec.id) return true;
            step.problems.push({ line: r.line, row: r.row, errors: [`${f.name} "${r.rec[f.name]}" já pertence a outro registro no Glyvio`] });
            return false;
          });
        }
      }
    }

    // FKs to entities loaded by a later step
    for (const c of step.columns) {
      const target = c.meta.foreignKey?.entity;
      if (!target || c.lookup || c.ref == 'id') continue;
      const later = steps.findIndex((s, i) => i > order && s.entity == target);
      if (later >= 0 && !steps.slice(0, order + 1).some((s) => s.entity == target)) {
        warnings.push(`${step.name}: ${c.field} aponta para ${target}, que só é carregado depois (${steps[later].name}); carregue antes`);
      }
    }
    for (const c of step.columns) {
      if (c.meta.defaultField && !WRITABLE_DEFAULT_FIELDS.has(c.field)) {
        warnings.push(`${step.name}: ${c.field} é um campo padrão mantido pelo Glyvio; o valor do arquivo pode ser ignorado ou sobrescrito`);
      }
    }
    step.problems.sort((a, b) => a.line - b.line);
  }
  return warnings;
}

async function convert(c, raw, rec, row, step, ctx, resolveRef) {
  const f = c.meta;
  const v = raw.trim();
  if (c.lookup && f.type != 'JSON') {
    const id = lookupValue(c.lookup, v);
    if (id === undefined) throw new Error(`valor "${v}" sem correspondência na tabela de conversão`);
    return id;
  }
  if (c.polymorphic) {
    const target = rec[c.polymorphic] ?? row[step.columns.find((x) => x.field == c.polymorphic)?.column];
    if (!target) throw new Error(`sem ${c.polymorphic} para saber a entity de destino`);
    if (c.ref == 'id') return v;
    const ic = refCode(c, v);
    if (ctx.offline) return offlineRef(ctx, step, target, ic);
    const id = await resolveRef(target, ic);
    if (!id) throw new Error(`${target} com código de integração "${ic}" não encontrado`);
    return id;
  }
  switch (f.type) {
    case 'ENTITY': {
      if (c.ref == 'id') return v;
      const target = f.foreignKey.entity;
      const ic = refCode(c, v);
      if (ctx.offline) return offlineRef(ctx, step, target, ic);
      const id = await resolveRef(target, ic);
      if (!id) throw new Error(`${target} com código de integração "${ic}" não encontrado (nem no Glyvio, nem nesta carga)`);
      return id;
    }
    case 'DECIMAL':
    case 'INTEGER': {
      const n = normalizeNumber(v, c.decimalSeparator ?? step.decimalSeparator);
      if (n == null) throw new Error(`número inválido "${v}"`);
      const scale = f.type == 'INTEGER' ? 0 : f.decimal?.scale;
      if ((f.type == 'INTEGER' || scale === 0) && n.includes('.') && !/\.0*$/.test(n)) throw new Error(`esperado número inteiro, veio "${v}"`);
      const r = roundDecimal(n, scale ?? null);
      const p = f.decimal?.precision;
      if (p && scale != null && r.intDigits > p - scale) throw new Error(`número grande demais "${v}" (máximo ${p - scale} dígitos inteiros)`);
      return f.type == 'INTEGER' ? Number(r.value) : r.value;
    }
    case 'BOOLEAN': {
      const k = v.toLowerCase();
      if (TRUE.has(k)) return true;
      if (FALSE.has(k)) return false;
      throw new Error(`esperado sim/não, veio "${v}"`);
    }
    case 'TIMESTAMP': {
      if (/^\d+([.,]\d+)?$/.test(v)) throw new Error(`data em número "${v}" (data do Excel? converta para dd/mm/aaaa)`);
      const d = parseDate(v, c.format, ctx.tz);
      if (!d) throw new Error(`data inválida "${v}"${c.format ? ` (formato ${c.format})` : ''}`);
      return d;
    }
    case 'JSON': {
      if (c.json == 'list') {
        const items = v.split(c.separator ?? /[,;|]/).map((x) => x.trim()).filter(Boolean);
        const out = items.map((x) => {
          if (!c.lookup) return x;
          const id = lookupValue(c.lookup, x);
          if (id === undefined) throw new Error(`item "${x}" sem correspondência na tabela de conversão`);
          return id;
        });
        return JSON.stringify(out);
      }
      try {
        return JSON.stringify(JSON.parse(v));
      } catch {
        throw new Error(`JSON inválido "${v.slice(0, 60)}" (defina "json": "list" se for uma lista separada por vírgula)`);
      }
    }
    default:
      return v;
  }
}

// Offline the server is not asked: a code missing from the plan may still exist in the Glyvio.
function offlineRef(ctx, step, target, ic) {
  if (ctx.planned.get(target) && !ctx.planned.get(target).has(ic)) {
    ctx.warnings.push(`${step.name}: ${target} "${ic}" não está nesta carga; confirme sem --offline se já existe no Glyvio`);
  }
  return uuid5(`${target}:${ic}`);
}

function refCode(c, v) {
  return c.ic ? c.ic.replace(/\{value\}/g, v) : v;
}

function lookupValue(table, v) {
  if (v in table) return table[v];
  const k = v.toLowerCase();
  for (const [key, id] of Object.entries(table)) if (key.trim().toLowerCase() == k) return id;
  return '*' in table ? table['*'] : undefined;
}

// ── commands ────────────────────────────────────────────────────────────────
async function context(planFile, opt, needServer) {
  const p = loadPlan(planFile, opt);
  let steps = p.steps;
  if (opt.only) {
    const only = new Set(opt.only.split(','));
    steps = steps.filter((s) => only.has(s.name) || only.has(s.entity));
    if (!steps.length) throw new PlanError(`--only ${opt.only}: nenhuma etapa com esse nome`);
  }
  let g = null;
  if (needServer || !opt.offline) g = await new Glyvio(p.envFile).connect();
  const tz = p.timezone ?? g?.zoneinfo ?? 'America/Sao_Paulo';
  const logFile = path.join(p.workdir, 'carga.log');
  const log = (msg) => {
    process.stderr.write(msg + '\n');
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
  };
  return { ...p, steps, allSteps: p.steps, g, tz, offline: !g, log };
}

function stepSummary(step) {
  return {
    step: step.name, entity: step.entity, file: path.basename(step.file),
    rows: step.rows.length, valid: step.records.length, invalid: step.problems.length,
  };
}

function writeProblems(ctx, step) {
  const file = path.join(ctx.workdir, `${step.name}.erros.csv`);
  writeCsv(file, step.problems.map((p) => ({ linha: p.line, ...p.row, motivo: p.errors.join(' | ') })));
  return step.problems.length ? file : null;
}

async function cmdCheck(planFile, opt) {
  const ctx = await context(planFile, opt, false);
  // FK resolution needs every step of the plan, even with --only
  const all = ctx.allSteps;
  const warnings = await prepare({ ...ctx, steps: all });
  const out = { company: ctx.g ? `${ctx.g.companyName} (${ctx.g.companyId})` : null, timezone: ctx.tz, offline: ctx.offline, warnings, steps: [] };
  for (const step of ctx.steps) {
    const s = stepSummary(step);
    s.errorsFile = writeProblems(ctx, step);
    s.firstErrors = step.problems.slice(0, 5).map((p) => `linha ${p.line}: ${p.errors.join(' | ')}`);
    s.new = step.records.filter((r) => !r.exists).length;
    s.update = step.records.length - s.new;
    if (opt.sample) s.sample = step.records.slice(0, Number(opt.sample)).map((r) => r.rec);
    out.steps.push(s);
  }
  console.log(JSON.stringify(out, null, 1));
  return out.steps.some((s) => s.invalid) ? 2 : 0;
}

async function cmdLoad(planFile, opt) {
  const ctx = await context(planFile, opt, true);
  const warnings = await prepare({ ...ctx, steps: ctx.allSteps });
  const stateFile = path.join(ctx.workdir, 'estado.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));
  const out = { company: `${ctx.g.companyName} (${ctx.g.companyId})`, warnings, steps: [] };
  ctx.log(`== carga em ${out.company}`);
  for (const w of warnings) ctx.log(`  aviso: ${w}`);

  const invalid = ctx.steps.filter((s) => s.problems.length);
  for (const s of invalid) writeProblems(ctx, s);
  if (invalid.length && !opt.skipInvalid) {
    out.aborted = 'há linhas com problema; corrija ou rode com --skip-invalid para carregar só as válidas';
    out.steps = invalid.map((s) => ({ ...stepSummary(s), errorsFile: path.join(ctx.workdir, `${s.name}.erros.csv`) }));
    console.log(JSON.stringify(out, null, 1));
    return 2;
  }

  for (const step of ctx.steps) {
    const hash = crypto.createHash('sha1').update(fs.readFileSync(step.file)).update(JSON.stringify(step.columns.map(({ meta, ...c }) => c))).digest('hex');
    const st = state[step.name]?.hash == hash ? state[step.name] : (state[step.name] = { hash, done: 0, status: 'pending' });
    const summary = { ...stepSummary(step), saved: 0, serverErrors: 0 };
    out.steps.push(summary);
    if (st.status == 'ok') {
      ctx.log(`> ${step.name}: já carregada (estado.json)`);
      summary.saved = step.records.length;
      summary.skipped = 'já carregada';
      continue;
    }
    if (step.pluginsOff.length) ctx.log(`> ${step.name}: lembrete — plugins que deveriam estar desligados: ${step.pluginsOff.join(', ')}`);
    ctx.log(`> ${step.name} (${step.entity}): ${step.records.length} registros, começando em ${st.done}`);
    const failures = [];
    for (let start = st.done; start < step.records.length; start += MAX_BATCH) {
      const batch = step.records.slice(start, start + MAX_BATCH);
      await sendBatch(ctx, step, batch, failures);
      st.done = start + batch.length;
      save();
      ctx.log(`  ${Math.min(st.done, step.records.length)}/${step.records.length}`);
    }
    summary.serverErrors = failures.length;
    summary.saved = step.records.length - failures.length;
    const errFile = path.join(ctx.workdir, `${step.name}.erros-servidor.csv`);
    writeCsv(errFile, failures.map((f) => ({ linha: f.line, ...f.row, motivo: f.error })));
    if (failures.length) {
      st.done = 0; // fixed ids: sending the whole file again is safe
      st.status = 'errors';
      summary.errorsFile = errFile;
      ctx.log(`  ! ${failures.length} registro(s) recusados pelo servidor — ${path.basename(errFile)}`);
    } else st.status = 'ok';
    save();
  }
  console.log(JSON.stringify(out, null, 1));
  return out.steps.some((s) => s.serverErrors) ? 2 : 0;
}

// A refused batch is sent once more (interceptors sometimes answer "duplicate key" for new records that
// were saved anyway; the second send is an update), then record by record.
async function sendBatch(ctx, step, batch, failures) {
  const records = batch.map((b) => b.rec);
  try {
    await ctx.g.saveList(step.entity, records);
    return;
  } catch (e) {
    if (!(e instanceof ServerError)) throw e;
    ctx.log(`  ! lote recusado, reenviando: ${e.readable.slice(0, 300)}`);
  }
  try {
    await ctx.g.saveList(step.entity, records);
    return;
  } catch (e) {
    if (!(e instanceof ServerError)) throw e;
    ctx.log('  ! reenvio recusado, enviando registro a registro');
  }
  for (const b of batch) {
    try {
      await ctx.g.saveList(step.entity, [b.rec]);
    } catch (e) {
      if (!(e instanceof ServerError)) throw e;
      failures.push({ line: b.line, row: b.row, error: e.readable });
    }
  }
}

async function cmdCount(planFile, opt) {
  const ctx = await context(planFile, opt, true);
  const out = { company: `${ctx.g.companyName} (${ctx.g.companyId})`, steps: [] };
  for (const step of ctx.steps) {
    const ics = [...new Set(readRows(step.file, step.csv).map((r) => integrationCodeOf(step, r)).filter(Boolean))];
    let found = 0;
    for (let i = 0; i < ics.length; i += 1000) {
      const r = await ctx.g.query(
        `select count(*) as n from ${step.entity} where deleted = false and integration_code = any(string_to_array(?, chr(31)))`,
        [ics.slice(i, i + 1000).join(SEP)],
      );
      found += Number(r[0]?.n ?? 0);
    }
    out.steps.push({ step: step.name, entity: step.entity, inFile: ics.length, inGlyvio: found, missing: ics.length - found });
  }
  console.log(JSON.stringify(out, null, 1));
  return out.steps.some((s) => s.missing) ? 2 : 0;
}

async function cmdModel(file, opt) {
  const m = readModel(path.resolve(file));
  let entities = m.entities;
  if (opt.entity) {
    const want = opt.entity.split(',');
    entities = Object.fromEntries(want.map((e) => [e, m.entities[e] ?? null]));
  }
  console.log(JSON.stringify({ hasMetadata: m.hasMetadata, entities }, null, 1));
  return m.hasMetadata ? 0 : 2;
}

async function cmdQuery(sql, opt) {
  const g = await new Glyvio(path.resolve(opt.env ?? '.env')).connect();
  console.log(JSON.stringify(await g.query(sql, opt.param), null, 1));
  return 0;
}

// ── main ────────────────────────────────────────────────────────────────────
const opt = parseArgs(process.argv.slice(2));
const [cmd, arg] = opt._;
const commands = { model: cmdModel, query: cmdQuery, check: cmdCheck, load: cmdLoad, count: cmdCount };
if (!commands[cmd] || !arg) {
  process.stderr.write(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(1);
}
try {
  process.exitCode = await commands[cmd](arg, opt);
} catch (e) {
  if (e instanceof PlanError) {
    process.stderr.write(`erro: ${e.message}\n`);
    process.exitCode = 1;
  } else if (e instanceof ServerError) {
    process.stderr.write(`erro do servidor: ${e.message}: ${e.readable}\n`);
    process.exitCode = 1;
  } else throw e;
}
