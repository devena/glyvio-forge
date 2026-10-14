#!/usr/bin/env node
// E-mail template from a file (PDF, image...): uploads the files the HTML uses and saves the template.
// No dependencies (Node 18+). Used by the create-mail-template-from-file skill: it writes the HTML,
// this checks it, uploads and saves.
//
//   node glyvio_mail_template.mjs info  [--env f]                 company, layout, templates in use
//   node glyvio_mail_template.mjs check <spec.json>               offline checks of the body
//   node glyvio_mail_template.mjs save  <spec.json> [--update] [--force]
//
// Credentials come from a .env (same keys as the glyvio-dev-helper): G_USERNAME, G_PASSWORD,
// G_COMPANY_ID, optional G_AUTH_URL. Default .env: next to the spec (or the current folder).
//
// Spec (paths relative to the spec file):
//   {
//     "name": "Catálogo de outono",          // template name (required)
//     "subject": "Novidades da $S{company.name}",
//     "body": "body.html",                   // the HTML; local files in src/href are uploaded
//     "key": "core.generic",                 // template type (default core.generic)
//     "useLayout": true,                     // false: sent without the company e-mail layout
//     "original": { "file": "catalogo.pdf", "name": "Catálogo outono 2026.pdf", "public": false },
//     "env": ".env"                          // optional
//   }
//
// Every local file the body points to (<img src="img/logo.png">, <a href="catalogo.pdf">) is uploaded
// as a PUBLIC attachment (an e-mail reader needs a URL that does not expire) and the body points to
// its public URL. The original file is linked to the template under `original.name`; private unless
// the body links to it or `public` is true. All uploads are linked to the template.
// State (template id, files already uploaded) goes to <spec>.state.json, so running `save` again
// does not upload a file twice nor create a second template.
// Exit code: 0 ok, 1 usage/spec error, 2 check problems or server error.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_AUTH = 'https://auth-webapi-prod.glyvio.com';
const LAYOUT_KEY = 'core.mail_layout';
const GENERIC_KEY = 'core.generic';
const NO_LAYOUT_MARK = '<!-- glyvio:no-layout -->';
const USER_GROUP = 'core_public';
const MAX_MAIL_BYTES = 100 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const COMMON_VARIABLES = ['user.name', 'user.email', 'company.name'];
const CONTENT_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime',
  mp3: 'audio/mpeg', zip: 'application/zip', csv: 'text/csv', txt: 'text/plain',
  doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

class SpecError extends Error {}
class ServerError extends Error {
  constructor(message, body) {
    super(message);
    this.body = body;
  }
  get readable() {
    try {
      const b = JSON.parse(this.body);
      const errors = Array.isArray(b.errors) ? b.errors : [b];
      return errors.map((e) => e.jsMessage ?? e.description ?? e.message ?? e.reason ?? 'erro').join('; ');
    } catch (_e) {
      return (this.body ?? '').slice(0, 300);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const opt = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a == '--env') opt.env = argv[++i];
    else if (a == '--update') opt.update = true;
    else if (a == '--force') opt.force = true;
    else opt._.push(a);
  }
  return opt;
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
    const env = readEnv(envFile);
    const pick = (...keys) => keys.map((k) => env[k] ?? process.env[k]).find((v) => v);
    this.user = pick('G_USERNAME', 'GLYVIO_USER');
    this.password = pick('G_PASSWORD', 'GLYVIO_PASSWORD');
    this.companyId = pick('G_COMPANY_ID', 'GLYVIO_COMPANY_ID');
    this.authUrl = (pick('G_AUTH_URL', 'GLYVIO_URL_AUTH') ?? DEFAULT_AUTH).replace(/\/+$/, '');
    if (!this.user || !this.password || !this.companyId) {
      throw new SpecError(`credenciais ausentes: G_USERNAME, G_PASSWORD e G_COMPANY_ID no ${envFile ?? '.env'}`);
    }
    this.auth = 'Basic ' + Buffer.from(`${this.user}:${this.password}`).toString('base64');
  }

  async connect() {
    const companies = await this.request('GET', `${this.authUrl}/user/companies`);
    const company = (companies ?? []).find((c) => c.id == this.companyId);
    if (!company) {
      const names = (companies ?? []).map((c) => `${c.name} (${c.id})`).join(', ');
      throw new SpecError(`empresa ${this.companyId} não encontrada para este usuário. Disponíveis: ${names || 'nenhuma'}`);
    }
    this.companyName = company.name;
    this.serverUrl = (company.server?.serverUrl ?? '').replace(/\/+$/, '');
    return this;
  }

  async request(method, url, body) {
    let last;
    for (let attempt = 0; attempt < 5; attempt++) {
      let resp;
      try {
        resp = await fetch(url, {
          method,
          headers: { Authorization: this.auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(300_000),
        });
      } catch (e) {
        last = String(e);
        await sleep(2 ** attempt * 1000);
        continue;
      }
      const text = await resp.text();
      if ([502, 503, 504].includes(resp.status)) {
        last = text.slice(0, 300);
        await sleep(2 ** attempt * 1000);
        continue;
      }
      if (resp.status == 401) throw new SpecError('login recusado (usuário ou senha do .env)');
      if (resp.status >= 400) throw new ServerError(`${method} ${url} -> ${resp.status}`, text);
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (_e) {
        return text;
      }
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

  /** Uploads `bytes` as an attachment linked to `links` (public: permanent public URL). */
  async upload({ bytes, name, contentType, isPublic, links }) {
    const temp = await this.request('GET', `${this.serverUrl}/attachment/${this.companyId}/get-temp-upload-url`);
    if (!temp?.putUrl || !temp?.key) throw new ServerError('get-temp-upload-url sem putUrl/key', JSON.stringify(temp));
    let put;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        put = await fetch(temp.putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType, 'Content-Length': String(bytes.length) },
          body: bytes,
          signal: AbortSignal.timeout(300_000),
        });
        if (put.ok) break;
      } catch (_e) {
        put = undefined;
      }
      await sleep(2 ** attempt * 1000);
    }
    if (!put?.ok) throw new ServerError(`upload de ${name} recusado pelo storage (${put?.status ?? 'sem resposta'})`, '');

    const id = crypto.randomUUID();
    const body = {
      attachment: {
        id,
        fileContentType: contentType,
        fileName: name,
        fileSize: String(bytes.length),
        userGroupId: USER_GROUP,
        thumbCreated: false,
      },
      attachmentEntities: links.map((l) => ({
        id: crypto.randomUUID(),
        userGroup: { id: USER_GROUP },
        attachment: { id },
        entityName: l.entityName,
        entityId: l.entityId,
      })),
      [isPublic ? 'fullKeyPublic' : 'fullKey']: temp.key,
    };
    await this.request('POST', `${this.serverUrl}/attachment/${this.companyId}/temp-attach/`, body);
    let publicUrl = null;
    if (isPublic) {
      const rows = await this.query('select public_url from attachment where id = ?', [id]);
      publicUrl = rows[0]?.public_url ?? null;
      if (!publicUrl) throw new ServerError(`${name} foi enviado mas não ficou com URL pública`, '');
    }
    return { attachmentId: id, publicUrl };
  }
}

// ── spec / body ─────────────────────────────────────────────────────────────
function readSpec(file) {
  const specFile = path.resolve(file);
  if (!fs.existsSync(specFile)) throw new SpecError(`${file} não existe`);
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  } catch (e) {
    throw new SpecError(`${file}: JSON inválido (${e.message})`);
  }
  const dir = path.dirname(specFile);
  if (!spec.name?.trim()) throw new SpecError('spec sem "name" (nome do template)');
  if (!spec.body) throw new SpecError('spec sem "body" (arquivo HTML)');
  const bodyFile = path.resolve(dir, spec.body);
  if (!fs.existsSync(bodyFile)) throw new SpecError(`body ${spec.body} não existe`);
  if (spec.original) {
    if (!spec.original.file) throw new SpecError('"original" sem "file"');
    spec.original.path = path.resolve(dir, spec.original.file);
    if (!fs.existsSync(spec.original.path)) throw new SpecError(`original ${spec.original.file} não existe`);
    spec.original.name = (spec.original.name ?? '').trim() || path.basename(spec.original.path);
    // the name keeps the file's extension, so it opens with the right app
    const ext = path.extname(spec.original.path);
    if (ext && !spec.original.name.toLowerCase().endsWith(ext.toLowerCase())) spec.original.name += ext;
  }
  return {
    ...spec,
    specFile,
    dir,
    bodyFile,
    bodyDir: path.dirname(bodyFile),
    html: fs.readFileSync(bodyFile, 'utf8'),
    key: spec.key ?? GENERIC_KEY,
    useLayout: spec.useLayout != false,
    envFile: path.resolve(dir, spec.env ?? '.env'),
    stateFile: specFile.replace(/\.json$/i, '') + '.state.json',
  };
}

const isExternal = (ref) => /^([a-z][a-z0-9+.-]*:|\/\/|#|\$|@|\{\{)/i.test(ref);

/** Every src/href of `html` that points to a local file: the attribute match and the file path. */
function localRefs(html, baseDir) {
  const out = [];
  for (const m of html.matchAll(/\b(src|href|background)\s*=\s*(["'])(.*?)\2/gi)) {
    const ref = m[3].trim();
    if (!ref || isExternal(ref)) continue;
    let rel = ref.split(/[?#]/)[0];
    try { rel = decodeURIComponent(rel); } catch (_e) { /* keep as written */ }
    out.push({ ref, attr: m[1].toLowerCase(), file: path.resolve(baseDir, rel) });
  }
  return out;
}

function contentTypeOf(file) {
  return CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream';
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function utf8Length(s) {
  return Buffer.byteLength(s, 'utf8');
}

/** What the template editor's review would warn about, plus the upload rules of this script. */
function check(spec) {
  const issues = [];
  const add = (level, text) => issues.push({ level, text });
  const html = spec.html;
  const text = `${spec.subject ?? ''}\n${html}`;

  if (!spec.subject?.trim()) add('danger', 'sem assunto ("subject")');
  if (/<script[\s>]/i.test(html)) add('danger', '<script>: leitores de e-mail removem ou bloqueiam');
  if (/display\s*:\s*(flex|grid|inline-flex)/i.test(html)) add('warning', 'flex/grid: Outlook e Gmail ignoram; use tabelas');
  if (/position\s*:\s*(absolute|fixed)/i.test(html)) add('warning', 'position absolute/fixed: ignorado pela maioria dos leitores');
  if (/float\s*:/i.test(html)) add('warning', 'float: quebra no Outlook; use colunas de tabela');
  if (/<style[\s>]/i.test(html) || /\bclass\s*=/i.test(html)) add('warning', '<style>/class: use estilo inline em cada elemento');
  if (/<button[\s>]/i.test(html)) add('warning', '<button>: use um <a> com estilo de botão');
  if (/<(div|p|td|table)\b[^>]*style="[^"]*\b(width|max-width)\s*:\s*(6[5-9]\d|[7-9]\d\d|\d{4,})px/i.test(html)) {
    add('warning', 'largura acima de 640px: o e-mail deve caber em 600px');
  }
  if (/<table\b[^>]*>\s*(<tbody[^>]*>\s*)?\{\{#each/i.test(html) || /\{\{#each[^}]*\}\}\s*<tr\b/i.test(html)) {
    add('warning', '{{#each}} entre <table> e <tr>: o editor do Glyvio tira o laço de lá; repita uma tabela por item');
  }
  if (spec.useLayout && /<html[\s>]|<body[\s>]/i.test(html)) {
    add('warning', 'documento inteiro (<html>/<body>) é enviado sem o layout da empresa; tire as tags ou use "useLayout": false');
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] ?? '';
    if (!/\balt\s*=/i.test(tag)) add('warning', `imagem sem alt: ${src.slice(0, 80)}`);
    if (!/\bwidth\s*=/i.test(tag)) add('warning', `imagem sem atributo width (Outlook mostra no tamanho real): ${src.slice(0, 80)}`);
    if (/^data:/i.test(src)) add('danger', 'imagem embutida (data:): Gmail e Outlook bloqueiam; salve como arquivo e aponte o src para ele');
    else if (/^http:/i.test(src)) add('warning', `imagem em http (sem https): ${src.slice(0, 80)}`);
  }

  const opened = (text.match(/\$[SMDNB]\{/g) ?? []).length;
  const closed = (text.match(/\$[SMDNB]\{[^{}]*\}/g) ?? []).length;
  if (opened > closed) add('danger', 'variável sem fechar ($S{...)');
  if (spec.key == GENERIC_KEY) {
    for (const m of text.matchAll(/\$[SMDNB]\{([^{}]*)\}/g)) {
      const v = m[1].trim();
      if (!COMMON_VARIABLES.includes(v)) add('danger', `variável ${v} não existe em templates gerais (só ${COMMON_VARIABLES.join(', ')} e @PERSON_NAME@)`);
    }
  }

  const seen = new Set();
  for (const r of localRefs(html, spec.bodyDir)) {
    if (seen.has(r.file)) continue;
    seen.add(r.file);
    if (!fs.existsSync(r.file)) {
      add('danger', `arquivo não encontrado: ${r.ref}`);
      continue;
    }
    const size = fs.statSync(r.file).size;
    if (contentTypeOf(r.file).startsWith('image/')) {
      if (size > MAX_IMAGE_BYTES) add('warning', `imagem pesada (${Math.round(size / 1024)} KB): ${r.ref}; comprima ou reduza para até 1200px de largura`);
      if (/\.svg$/i.test(r.file)) add('warning', `SVG: Gmail e Outlook não mostram; converta para PNG: ${r.ref}`);
    }
  }
  const bytes = utf8Length(html);
  if (bytes > MAX_MAIL_BYTES) add('warning', `HTML com ${Math.round(bytes / 1024)} KB: o Gmail corta mensagens acima de 100 KB`);
  return issues;
}

function readState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return { files: {} };
  }
}

function writeState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 1));
}

/** The body as the template editor reads it: a lone backslash is dropped there, so it is doubled. */
function toStored(html, useLayout) {
  const body = html.replace(NO_LAYOUT_MARK, '').trim().replace(/\\/g, '\\\\');
  return useLayout ? body : `${NO_LAYOUT_MARK}\n${body}`;
}

function replaceRefs(html, baseDir, urlOf) {
  return html.replace(/\b(src|href|background)(\s*=\s*)(["'])(.*?)\3/gi, (all, attr, eq, q, ref) => {
    const r = ref.trim();
    if (!r || isExternal(r)) return all;
    let rel = r.split(/[?#]/)[0];
    try { rel = decodeURIComponent(rel); } catch (_e) { /* keep */ }
    const url = urlOf(path.resolve(baseDir, rel));
    return url ? `${attr}${eq}${q}${url}${q}` : all;
  });
}

// ── commands ────────────────────────────────────────────────────────────────
async function cmdInfo(_arg, opt) {
  const g = await new Glyvio(path.resolve(opt.env ?? '.env')).connect();
  const layout = await g.query(`select id from template where key = ? and deleted = false`, [LAYOUT_KEY]);
  const keys = await g.query(
    `select key, chat_agent_type, count(*) as n from template where deleted = false and key <> ? group by key, chat_agent_type order by key`,
    [LAYOUT_KEY],
  );
  const names = await g.query(
    `select name from template where deleted = false and key <> ? and chat_agent_type = 'mail' order by name`,
    [LAYOUT_KEY],
  );
  console.log(JSON.stringify({
    company: `${g.companyName} (${g.companyId})`,
    hasMailLayout: layout.length > 0,
    templateKeys: keys,
    mailTemplates: names.map((r) => r.name),
  }, null, 1));
  return 0;
}

async function cmdCheck(file) {
  const spec = readSpec(file);
  const issues = check(spec);
  const refs = [...new Set(localRefs(spec.html, spec.bodyDir).map((r) => path.relative(spec.dir, r.file)))];
  console.log(JSON.stringify({ name: spec.name, key: spec.key, useLayout: spec.useLayout, uploads: refs, original: spec.original?.name ?? null, issues }, null, 1));
  return issues.some((i) => i.level == 'danger') ? 2 : 0;
}

async function cmdSave(file, opt) {
  const spec = readSpec(file);
  const issues = check(spec);
  if (issues.some((i) => i.level == 'danger') && !opt.force) {
    console.log(JSON.stringify({ saved: false, issues }, null, 1));
    process.stderr.write('erro: o template tem problemas graves (rode check); use --force para salvar mesmo assim\n');
    return 2;
  }
  const g = await new Glyvio(path.resolve(opt.env ?? spec.envFile)).connect();
  const state = readState(spec.stateFile);
  state.files ??= {};
  const log = (s) => process.stderr.write(`${s}\n`);

  // The template: the one this spec created before, else one with the same name (only with --update).
  let exists = false;
  if (state.templateId) {
    exists = (await g.query('select id from template where id = ? and deleted = false', [state.templateId])).length > 0;
    if (!exists) state.templateId = undefined;
  }
  if (!state.templateId) {
    const same = await g.query(
      `select id from template where deleted = false and key <> ? and lower(name) = lower(?)`,
      [LAYOUT_KEY, spec.name.trim()],
    );
    if (same.length > 0 && !opt.update) {
      throw new SpecError(`já existe um template chamado "${spec.name}"; use --update para substituí-lo ou mude o nome`);
    }
    state.templateId = same[0]?.id ?? crypto.randomUUID();
    exists = same.length > 0;
  }
  const record = (body) => ({
    id: state.templateId,
    name: spec.name.trim(),
    key: spec.key,
    chat_agent_type: 'mail',
    template_subject: spec.subject ?? '',
    template_body: body,
    ...(exists ? {} : { user_group_id: USER_GROUP }),
  });
  // A link to a template that does not exist yet is refused: it is saved first, then the files.
  if (!exists) {
    log(`criando o template "${spec.name}"`);
    await g.saveList('template', [record(toStored(spec.html, spec.useLayout))]);
    exists = true;
  }
  writeState(spec.stateFile, state);
  const links = [{ entityName: 'template', entityId: state.templateId }];

  // Files: everything the body points to (public), and the original under the user's name.
  const wanted = new Map();
  for (const r of localRefs(spec.html, spec.bodyDir)) {
    wanted.set(r.file, { file: r.file, name: path.basename(r.file), isPublic: true });
  }
  if (spec.original) {
    const inBody = wanted.get(spec.original.path);
    wanted.set(spec.original.path, {
      file: spec.original.path,
      name: spec.original.name,
      isPublic: !!inBody || spec.original.public == true,
      original: true,
    });
  }
  const urls = new Map();
  const uploaded = [];
  for (const w of wanted.values()) {
    const bytes = fs.readFileSync(w.file);
    const id = `${sha256(bytes)}:${w.name}:${w.isPublic ? 'pub' : 'priv'}:${state.templateId}`;
    let done = state.files[id];
    if (!done) {
      log(`enviando ${path.relative(spec.dir, w.file)}${w.original ? ` como "${w.name}"` : ''}`);
      done = await g.upload({ bytes, name: w.name, contentType: contentTypeOf(w.file), isPublic: w.isPublic, links });
      state.files[id] = done;
      writeState(spec.stateFile, state);
    }
    if (done.publicUrl) urls.set(w.file, done.publicUrl);
    uploaded.push({ file: path.relative(spec.dir, w.file), name: w.name, public: w.isPublic, attachmentId: done.attachmentId, url: done.publicUrl });
  }

  const body = replaceRefs(spec.html, spec.bodyDir, (f) => urls.get(f));
  const left = localRefs(body, spec.bodyDir);
  if (left.length > 0) throw new SpecError(`referências locais sem URL depois do envio: ${left.map((r) => r.ref).join(', ')}`);
  await g.saveList('template', [record(toStored(body, spec.useLayout))]);
  fs.writeFileSync(spec.bodyFile.replace(/(\.html?)?$/i, '.publicado.html'), body);
  console.log(JSON.stringify({
    saved: true,
    company: `${g.companyName} (${g.companyId})`,
    template: { id: state.templateId, name: spec.name.trim(), key: spec.key, useLayout: spec.useLayout },
    files: uploaded,
    warnings: issues.filter((i) => i.level != 'danger').map((i) => i.text),
  }, null, 1));
  return 0;
}

// ── main ────────────────────────────────────────────────────────────────────
const opt = parseArgs(process.argv.slice(2));
const [cmd, arg] = opt._;
const commands = { info: cmdInfo, check: cmdCheck, save: cmdSave };
if (!commands[cmd] || (cmd != 'info' && !arg)) {
  process.stderr.write(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(1);
}
try {
  process.exitCode = await commands[cmd](arg, opt);
} catch (e) {
  if (e instanceof SpecError) {
    process.stderr.write(`erro: ${e.message}\n`);
    process.exitCode = 1;
  } else if (e instanceof ServerError) {
    process.stderr.write(`erro do servidor: ${e.message}: ${e.readable}\n`);
    process.exitCode = 2;
  } else {
    throw e;
  }
}
