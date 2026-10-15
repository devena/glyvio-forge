#!/usr/bin/env node
// Landing page (crm_full) from a spec: blocks or free HTML, form, theme, origin links and campaign.
// No dependencies (Node 18+). Used by the create-landing-page skill: it designs the page, this
// checks it, uploads the local files and saves it.
//
//   node glyvio_landing_page.mjs info  [--env f]                  company, base URL, pages, campaigns, groups
//   node glyvio_landing_page.mjs check <spec.json>                offline checks of the page
//   node glyvio_landing_page.mjs save  <spec.json> [--update] [--publish] [--force]
//
// Credentials come from a .env (same keys as the glyvio-dev-helper): G_USERNAME, G_PASSWORD,
// G_COMPANY_ID, optional G_AUTH_URL. Default .env: next to the spec (or the current folder).
//
// Spec (paths relative to the spec file):
//   {
//     "name": "Feira Agro 2026",                 // internal name (required)
//     "slug": "feira-agro-2026",                 // address in the link (default: from the name)
//     "title": "...", "description": "...",      // browser tab / sharing
//     "publish": false,                          // true (or --publish): visible at the public URL
//     "campaign": "000123",                      // campaign code: visits and forms count on it
//     "setAsCampaignLanding": true,              // the campaign's templates link to this page
//     "userGroup": "Vendas",                     // name or id: owns the page, gets the form notifications
//     "theme": { "primaryColor": "#1F9D63", "textColor": "#1F2430", "backgroundColor": "#FFFFFF",
//                "altBackgroundColor": "#F4F6FA", "fontFamily": "...", "radius": 10 },
//     "blocks": [
//       { "type": "html", "file": "blocos/topo.html" },      // free HTML (advanced), full width
//       { "type": "hero", "title": "...", "imageUrl": "img/banner.jpg", "buttonLabel": "...", "buttonUrl": "#form" },
//       { "type": "form", "title": "Receba a proposta" },
//       { "type": "html", "html": "<footer class=\"x\">...</footer>" }
//     ],
//     "form": { "fields": [ { "key": "nome", "label": "Nome", "type": "name", "required": true } ],
//               "submitLabel": "Enviar", "successMessage": "...", "redirectUrl": "", "consentText": "...",
//               "kioskResetSeconds": 8 },
//     "links": [ { "name": "Estande", "source": "feira", "medium": "qrcode", "kiosk": true, "campaign": "000123" } ],
//     "env": ".env"
//   }
//
// Local files the page uses (src/href/background/url() in HTML blocks, imageUrl/logoUrl of blocks
// and items) are uploaded as PUBLIC attachments linked to the page, and the page points to their URLs.
// State (page id, link codes, files already uploaded) goes to <spec>.state.json, so running `save`
// again updates the same page and uploads only new or changed files.
// Exit code: 0 ok, 1 usage/spec error, 2 check problems or server error.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_AUTH = 'https://auth-webapi-prod.glyvio.com';
const DEFAULT_GROUP = 'core_public';
const COMPANY_PARAMETER_ID = '1';
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_HTML_BYTES = 300 * 1024;
const BLOCK_TYPES = ['header', 'hero', 'text', 'richText', 'image', 'video', 'benefits', 'testimonials', 'faq',
  'countdown', 'cta', 'form', 'footer', 'html'];
const LIST_BLOCKS = ['benefits', 'testimonials', 'faq'];
const FIELD_TYPES = ['name', 'email', 'phone', 'company', 'document', 'city', 'state', 'text', 'textarea',
  'number', 'select', 'boolean', 'date'];
const THEME_COLORS = ['primaryColor', 'textColor', 'backgroundColor', 'altBackgroundColor'];
const CONTENT_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon', pdf: 'application/pdf', mp4: 'video/mp4',
  webm: 'video/webm', mp3: 'audio/mpeg', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  zip: 'application/zip', csv: 'text/csv', txt: 'text/plain',
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
    else if (a == '--publish') opt.publish = true;
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

  saveList(items) {
    const data = {};
    items.forEach((r, i) => { data[i] = { entityName: r.entityName, objectId: r.entity.id, entity: r.entity }; });
    return this.request('POST', `${this.serverUrl}/entity/${this.companyId}/save-list`, data);
  }

  /** Uploads `bytes` as a public attachment linked to `links`; returns its public URL. */
  async upload({ bytes, name, contentType, links }) {
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
    await this.request('POST', `${this.serverUrl}/attachment/${this.companyId}/temp-attach/`, {
      attachment: {
        id,
        fileContentType: contentType,
        fileName: name,
        fileSize: String(bytes.length),
        userGroupId: DEFAULT_GROUP,
        thumbCreated: false,
      },
      attachmentEntities: links.map((l) => ({
        id: crypto.randomUUID(),
        userGroup: { id: DEFAULT_GROUP },
        attachment: { id },
        entityName: l.entityName,
        entityId: l.entityId,
      })),
      fullKeyPublic: temp.key,
    });
    const rows = await this.query('select public_url from attachment where id = ?', [id]);
    const publicUrl = rows[0]?.public_url ?? null;
    if (!publicUrl) throw new ServerError(`${name} foi enviado mas não ficou com URL pública`, '');
    return { attachmentId: id, publicUrl };
  }
}

// ── spec ────────────────────────────────────────────────────────────────────
function slugify(text) {
  return `${text ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function fieldKey(label) {
  return slugify(label).replace(/-/g, '_') || 'campo';
}

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
  if (!spec.name?.trim()) throw new SpecError('spec sem "name" (nome da landing page)');
  const blocks = (spec.blocks ?? []).map((b, i) => {
    const block = { ...b, _index: i, _dir: dir };
    if (b?.type == 'html' && b.file) {
      const htmlFile = path.resolve(dir, b.file);
      if (!fs.existsSync(htmlFile)) throw new SpecError(`bloco ${i + 1}: arquivo ${b.file} não existe`);
      block.html = fs.readFileSync(htmlFile, 'utf8');
      block._dir = path.dirname(htmlFile);
      block._file = htmlFile;
    }
    return block;
  });
  const form = spec.form ?? {};
  const fields = (form.fields ?? []).map((f) => ({
    ...f,
    key: f?.key?.trim() || fieldKey(f?.label),
    label: `${f?.label ?? ''}`.trim(),
    type: f?.type ?? 'text',
  }));
  return {
    ...spec,
    specFile,
    dir,
    slug: slugify(spec.slug || spec.name),
    blocks,
    form: { ...form, fields },
    links: spec.links ?? [],
    envFile: path.resolve(dir, spec.env ?? '.env'),
    stateFile: specFile.replace(/\.json$/i, '') + '.state.json',
  };
}

const isExternal = (ref) => /^([a-z][a-z0-9+.-]*:|\/\/|#|\$|@|\{\{|data:)/i.test(ref);

function decodeRef(ref) {
  let rel = ref.split(/[?#]/)[0];
  try { rel = decodeURIComponent(rel); } catch (_e) { /* keep as written */ }
  return rel;
}

/** Local files an HTML fragment uses: src/href/background attributes and CSS url(). */
function htmlRefs(html, baseDir) {
  const out = [];
  for (const m of html.matchAll(/\b(src|href|background|poster)\s*=\s*(["'])(.*?)\2/gi)) {
    const ref = m[3].trim();
    if (ref && !isExternal(ref)) out.push({ ref, file: path.resolve(baseDir, decodeRef(ref)) });
  }
  for (const m of html.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
    const ref = m[2].trim();
    if (ref && !isExternal(ref)) out.push({ ref, file: path.resolve(baseDir, decodeRef(ref)) });
  }
  for (const m of html.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) {
    for (const part of m[2].split(',')) {
      const ref = part.trim().split(/\s+/)[0];
      if (ref && !isExternal(ref)) out.push({ ref, file: path.resolve(baseDir, decodeRef(ref)) });
    }
  }
  return out;
}

/** Local files of the non-HTML blocks: imageUrl/logoUrl and the items' imageUrl. */
function blockFileRefs(block) {
  const out = [];
  const add = (ref, where) => {
    const r = `${ref ?? ''}`.trim();
    if (r && !isExternal(r)) out.push({ ref: r, file: path.resolve(block._dir, decodeRef(r)), where });
  };
  add(block.imageUrl, 'imageUrl');
  add(block.logoUrl, 'logoUrl');
  (block.items ?? []).forEach((item, i) => add(item?.imageUrl, `items[${i}].imageUrl`));
  return out;
}

function allRefs(spec) {
  const refs = [];
  for (const b of spec.blocks) {
    if (b.type == 'html' || b.type == 'richText') refs.push(...htmlRefs(b.html ?? '', b._dir));
    refs.push(...blockFileRefs(b));
  }
  return refs;
}

function contentTypeOf(file) {
  return CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream';
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** CSS rules of a free HTML block that reach outside it (bare element selectors, *, body...). */
function globalSelectors(html) {
  const found = new Set();
  for (const style of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = style[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
    for (const m of css.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
      for (const sel of m[2].split(',')) {
        const s = sel.trim();
        if (!s || /^(from|to|\d+%)$/.test(s)) continue;
        if (/^(html|body|\*|:root)\b/.test(s) || /^[a-z][a-z0-9]*(\s|$|:|\[|>)/i.test(s)) found.add(s);
      }
    }
  }
  return [...found];
}

function check(spec) {
  const issues = [];
  const add = (level, text) => issues.push({ level, text });

  if (!spec.slug) add('danger', 'endereço (slug) vazio: dê um "name" ou "slug" com letras ou números');
  if (!spec.blocks.length) add('danger', 'página sem blocos');
  const fieldsCount = spec.form.fields.length;
  const formBlocks = spec.blocks.filter((b) => b.type == 'form').length;
  if (formBlocks > 1) add('warning', 'mais de um bloco de formulário: só o primeiro envia, os outros repetem o formulário');
  if (!fieldsCount) add('warning', 'formulário sem campos: a página não capta contatos');
  else if (!formBlocks) add('warning', 'sem bloco "form": o formulário vai para o fim da página');

  spec.blocks.forEach((b) => {
    const n = `bloco ${b._index + 1} (${b.type})`;
    if (!BLOCK_TYPES.includes(b.type)) {
      add('danger', `${n}: tipo desconhecido; use ${BLOCK_TYPES.join(', ')}`);
      return;
    }
    if (b.type == 'html' || b.type == 'richText') {
      const html = b.html ?? '';
      if (!html.trim()) add('danger', `${n}: sem HTML ("file" ou "html")`);
      if (/<form[\s>]/i.test(html)) {
        add('danger', `${n}: <form> próprio não é registrado no Glyvio; use o bloco "form" e links para #form`);
      }
      if (/<(html|head|body)[\s>]/i.test(html)) add('warning', `${n}: <html>/<head>/<body> dentro do bloco; escreva só o conteúdo da seção`);
      if (/<script[\s>]/i.test(html)) add('warning', `${n}: <script> roda na página pública; mantenha só o necessário e sem dados sensíveis`);
      if (/\$[SMDNB]\{/.test(html) || /@PERSON_NAME@/.test(html)) {
        add('warning', `${n}: variáveis ($S{...}, @PERSON_NAME@) não são trocadas na landing page; aparecem como texto`);
      }
      if (b.type == 'html') {
        const globals = globalSelectors(html);
        if (globals.length) {
          add('warning', `${n}: CSS sem classe própria afeta a página toda e o formulário: ${globals.slice(0, 5).join(', ')}`);
        }
        if (/<style[\s>]/i.test(html) && !/@media/i.test(html) && /(grid-template-columns|display\s*:\s*flex|width\s*:\s*\d{3,}px)/i.test(html)) {
          add('warning', `${n}: layout em colunas/largura fixa sem @media; confira no celular (390px)`);
        }
      }
      if (/<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(html)) add('warning', `${n}: imagem sem alt`);
      if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) add('warning', `${n}: HTML com mais de ${MAX_HTML_BYTES / 1024} KB`);
      if (/src\s*=\s*["']http:/i.test(html)) add('warning', `${n}: recurso em http (sem https) é bloqueado na página https`);
    }
    if (LIST_BLOCKS.includes(b.type) && !(b.items ?? []).length) add('warning', `${n}: sem itens`);
    if (b.type == 'video' && !/youtu|vimeo|^https:/i.test(b.videoUrl ?? '')) add('warning', `${n}: link de vídeo do YouTube ou Vimeo`);
    if (b.type == 'image' && !b.imageUrl) add('danger', `${n}: sem imageUrl`);
  });

  const keys = new Set();
  spec.form.fields.forEach((f, i) => {
    const n = `campo ${i + 1} (${f.label || f.key})`;
    if (!f.label) add('danger', `${n}: sem "label"`);
    if (!FIELD_TYPES.includes(f.type)) add('danger', `${n}: tipo "${f.type}" desconhecido; use ${FIELD_TYPES.join(', ')}`);
    if (!/^[a-z][a-z0-9_]*$/.test(f.key)) add('danger', `${n}: chave "${f.key}" deve ter só letras minúsculas, números e _`);
    if (keys.has(f.key)) add('danger', `${n}: chave "${f.key}" repetida`);
    keys.add(f.key);
    if (f.type == 'select' && !(f.options ?? []).length) add('danger', `${n}: lista de opções vazia ("options")`);
  });
  if (fieldsCount && !spec.form.fields.some((f) => ['email', 'phone'].includes(f.type))) {
    add('warning', 'formulário sem e-mail nem telefone: não dá para retornar o contato');
  }
  if (fieldsCount && !spec.form.consentText) add('warning', 'sem texto de consentimento (LGPD)');
  if (spec.form.redirectUrl && !/^https:\/\//i.test(spec.form.redirectUrl)) add('warning', 'redirectUrl deve começar com https://');

  for (const key of THEME_COLORS) {
    const v = spec.theme?.[key];
    if (v && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) add('warning', `tema: ${key} "${v}" não é uma cor #RRGGBB`);
  }

  const names = new Set();
  spec.links.forEach((l, i) => {
    if (!l?.name?.trim()) add('danger', `link ${i + 1}: sem "name"`);
    else if (names.has(l.name.trim().toLowerCase())) add('danger', `link "${l.name}" repetido`);
    names.add(`${l?.name ?? ''}`.trim().toLowerCase());
    if (l?.kiosk && spec.form.redirectUrl) add('warning', `link "${l.name}": no modo quiosque o redirectUrl é ignorado`);
  });
  if (spec.setAsCampaignLanding && !spec.campaign) add('danger', '"setAsCampaignLanding" sem "campaign"');

  const seen = new Set();
  for (const r of allRefs(spec)) {
    if (seen.has(r.file)) continue;
    seen.add(r.file);
    if (!fs.existsSync(r.file)) {
      add('danger', `arquivo não encontrado: ${r.ref}`);
      continue;
    }
    const size = fs.statSync(r.file).size;
    if (contentTypeOf(r.file).startsWith('image/') && size > MAX_IMAGE_BYTES) {
      add('warning', `imagem pesada (${Math.round(size / 1024)} KB): ${r.ref}; comprima ou reduza (até ~1600px de largura)`);
    }
  }
  return issues;
}

// ── save helpers ────────────────────────────────────────────────────────────
function readState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return { files: {}, links: {} };
  }
}

function writeState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 1));
}

function replaceHtmlRefs(html, baseDir, urlOf) {
  const swap = (ref) => {
    const r = ref.trim();
    if (!r || isExternal(r)) return null;
    return urlOf(path.resolve(baseDir, decodeRef(r)));
  };
  return html
    .replace(/\b(src|href|background|poster)(\s*=\s*)(["'])(.*?)\3/gi, (all, attr, eq, q, ref) => {
      const url = swap(ref);
      return url ? `${attr}${eq}${q}${url}${q}` : all;
    })
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (all, q, ref) => {
      const url = swap(ref);
      return url ? `url(${q}${url}${q})` : all;
    })
    .replace(/\bsrcset(\s*=\s*)(["'])(.*?)\2/gi, (all, eq, q, value) => {
      const parts = value.split(',').map((part) => {
        const [ref, ...rest] = part.trim().split(/\s+/);
        const url = swap(ref);
        return [url ?? ref, ...rest].join(' ');
      });
      return `srcset${eq}${q}${parts.join(', ')}${q}`;
    });
}

/** The blocks as `landing_page.blocks` stores them, with local files swapped for their URLs. */
function storedBlocks(spec, urlOf) {
  return spec.blocks.map((b, i) => {
    const { _index, _dir, _file, file, ...block } = b;
    const local = (ref) => {
      const r = `${ref ?? ''}`.trim();
      return r && !isExternal(r) ? urlOf(path.resolve(_dir, decodeRef(r))) ?? r : ref;
    };
    const out = { id: block.id || `b${i + 1}-${sha256(Buffer.from(JSON.stringify(block))).slice(0, 8)}`, ...block };
    if (out.html) out.html = replaceHtmlRefs(out.html, _dir, urlOf);
    if (out.imageUrl) out.imageUrl = local(out.imageUrl);
    if (out.logoUrl) out.logoUrl = local(out.logoUrl);
    if (out.items) out.items = out.items.map((it) => (it?.imageUrl ? { ...it, imageUrl: local(it.imageUrl) } : it));
    return out;
  });
}

function landingUrl(base, companyId, query) {
  const q = Object.entries(query)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base.replace(/\/+$/, '')}/custom/public/page/${companyId}/landing?${q}`;
}

function linkCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(8), (b) => chars[b % chars.length]).join('');
}

async function assertLandingSupport(g) {
  const rows = await g.query(
    `select table_name from information_schema.tables where table_name in ('landing_page','landing_link') `,
  );
  if (rows.length < 2) {
    throw new SpecError('esta empresa não tem landing pages: atualize o plugin crm_full (0.3.68 ou mais novo; o bloco "html" pede 0.3.70)');
  }
}

async function campaignByCode(g, code) {
  if (!code) return null;
  const rows = await g.query('select id, name, code from campaign where deleted = false and code = ?', [`${code}`]);
  if (!rows.length) throw new SpecError(`campanha "${code}" não encontrada (use o código da campanha; veja "info")`);
  return rows[0];
}

async function resolveGroup(g, group) {
  if (!group) return DEFAULT_GROUP;
  const rows = await g.query('select id, name from user_group where deleted = false and (id = ? or lower(name) = lower(?))', [group, group]);
  if (!rows.length) throw new SpecError(`grupo de usuários "${group}" não encontrado (veja "info")`);
  return rows[0].id;
}

// ── commands ────────────────────────────────────────────────────────────────
async function cmdInfo(_arg, opt) {
  const g = await new Glyvio(path.resolve(opt.env ?? '.env')).connect();
  await assertLandingSupport(g);
  const param = await g.query('select landing_base_url from company_parameter where id = ?', [COMPANY_PARAMETER_ID]);
  const pages = await g.query(
    `select name, slug, status, visits, submissions from landing_page where deleted = false order by created_at desc limit 50`,
  );
  const campaigns = await g.query(
    `select c.code, c.name, c.is_active, c.final_date, p.slug as landing_slug from campaign c
     left join landing_page p on p.id = c.landing_page_id
     where c.deleted = false order by c.created_at desc limit 30`,
  );
  const groups = await g.query(`select id, name from user_group where deleted = false order by name limit 50`);
  console.log(JSON.stringify({
    company: `${g.companyName} (${g.companyId})`,
    baseUrl: param[0]?.landing_base_url || g.serverUrl,
    baseUrlConfigured: !!param[0]?.landing_base_url,
    landingPages: pages,
    campaigns,
    userGroups: groups,
  }, null, 1));
  return 0;
}

async function cmdCheck(file) {
  const spec = readSpec(file);
  const issues = check(spec);
  const uploads = [...new Set(allRefs(spec).map((r) => path.relative(spec.dir, r.file)))];
  console.log(JSON.stringify({
    name: spec.name,
    slug: spec.slug,
    blocks: spec.blocks.map((b) => b.type),
    fields: spec.form.fields.map((f) => `${f.key} (${f.type}${f.required ? ', obrigatório' : ''})`),
    links: spec.links.map((l) => `${l.name}${l.kiosk ? ' (quiosque)' : ''}`),
    uploads,
    issues,
  }, null, 1));
  return issues.some((i) => i.level == 'danger') ? 2 : 0;
}

async function cmdSave(file, opt) {
  const spec = readSpec(file);
  const issues = check(spec);
  if (issues.some((i) => i.level == 'danger') && !opt.force) {
    console.log(JSON.stringify({ saved: false, issues }, null, 1));
    process.stderr.write('erro: a página tem problemas graves (rode check); use --force para salvar mesmo assim\n');
    return 2;
  }
  const g = await new Glyvio(path.resolve(opt.env ?? spec.envFile)).connect();
  await assertLandingSupport(g);
  const log = (s) => process.stderr.write(`${s}\n`);
  const state = readState(spec.stateFile);
  state.files ??= {};
  state.links ??= {};

  // The page: the one this spec saved before, else one with the same slug (only with --update).
  let current = null;
  if (state.pageId) {
    current = (await g.query('select id, status, user_group_id from landing_page where id = ? and deleted = false', [state.pageId]))[0] ?? null;
    if (!current) state.pageId = undefined;
  }
  const sameSlug = await g.query('select id, status, user_group_id from landing_page where deleted = false and slug = ?', [spec.slug]);
  if (!state.pageId) {
    if (sameSlug.length && !opt.update) {
      throw new SpecError(`já existe uma landing page com o endereço "${spec.slug}"; use --update para substituí-la ou mude o "slug"`);
    }
    current = sameSlug[0] ?? null;
    state.pageId = current?.id ?? crypto.randomUUID();
  } else if (sameSlug.some((p) => p.id != state.pageId)) {
    throw new SpecError(`o endereço "${spec.slug}" já é de outra landing page; mude o "slug"`);
  }

  const campaign = await campaignByCode(g, spec.campaign);
  const groupId = spec.userGroup ? await resolveGroup(g, spec.userGroup) : current?.user_group_id ?? DEFAULT_GROUP;
  const status = opt.publish || spec.publish == true ? 'published' : spec.publish == false ? 'draft' : current?.status ?? 'draft';
  const record = (blocks) => ({
    id: state.pageId,
    name: spec.name.trim(),
    slug: spec.slug,
    status,
    title: spec.title ?? null,
    description: spec.description ?? null,
    theme: spec.theme ?? {},
    blocks,
    form_fields: spec.form.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      ...(f.required ? { required: true } : {}),
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      ...(f.type == 'select' ? { options: f.options ?? [] } : {}),
    })),
    submit_label: spec.form.submitLabel ?? 'Enviar',
    success_message: spec.form.successMessage ?? 'Obrigado! Recebemos seus dados e entraremos em contato.',
    redirect_url: spec.form.redirectUrl || null,
    consent_text: spec.form.consentText ?? null,
    kiosk_reset_seconds: spec.form.kioskResetSeconds ?? 8,
    campaign_id: campaign?.id ?? null,
    user_group_id: groupId,
  });

  // Uploads are linked to the page, so it is saved first (as it is, or as a draft when new).
  if (!current) {
    log(`criando a landing page "${spec.name}"`);
    await g.saveList([{ entityName: 'landing_page', entity: { ...record([]), status: 'draft' } }]);
  }
  writeState(spec.stateFile, state);

  const links = [{ entityName: 'landing_page', entityId: state.pageId }];
  const urls = new Map();
  const uploaded = [];
  for (const r of allRefs(spec)) {
    if (urls.has(r.file)) continue;
    const bytes = fs.readFileSync(r.file);
    const key = `${sha256(bytes)}:${path.basename(r.file)}:${state.pageId}`;
    let done = state.files[key];
    if (!done) {
      log(`enviando ${path.relative(spec.dir, r.file)}`);
      done = await g.upload({ bytes, name: path.basename(r.file), contentType: contentTypeOf(r.file), links });
      state.files[key] = done;
      writeState(spec.stateFile, state);
    }
    urls.set(r.file, done.publicUrl);
    uploaded.push({ file: path.relative(spec.dir, r.file), url: done.publicUrl });
  }

  const blocks = storedBlocks(spec, (f) => urls.get(f));
  const items = [{ entityName: 'landing_page', entity: record(blocks) }];

  // Origin links: the ones this spec created (by name), or the page's links with the same name.
  const existingLinks = await g.query(
    'select id, name, code from landing_link where deleted = false and landing_page_id = ?',
    [state.pageId],
  );
  const savedLinks = [];
  for (const l of spec.links) {
    const name = l.name.trim();
    const known = state.links[name.toLowerCase()] ?? existingLinks.find((e) => e.name.toLowerCase() == name.toLowerCase());
    const id = known?.id ?? crypto.randomUUID();
    const code = known?.code ?? linkCode();
    state.links[name.toLowerCase()] = { id, code };
    const linkCampaign = l.campaign ? await campaignByCode(g, l.campaign) : null;
    items.push({
      entityName: 'landing_link',
      entity: {
        id,
        landing_page_id: state.pageId,
        name,
        code,
        source: l.source ?? null,
        medium: l.medium ?? null,
        campaign_id: linkCampaign?.id ?? null,
        kiosk: !!l.kiosk,
        user_group_id: groupId,
      },
    });
    savedLinks.push({ name, code, kiosk: !!l.kiosk, campaign: linkCampaign?.code ?? null });
  }
  if (spec.setAsCampaignLanding && campaign) {
    items.push({ entityName: 'campaign', entity: { id: campaign.id, landing_page_id: state.pageId } });
  }
  log(`salvando a landing page${savedLinks.length ? ` e ${savedLinks.length} link(s)` : ''}`);
  await g.saveList(items);
  writeState(spec.stateFile, state);

  const param = await g.query('select landing_base_url from company_parameter where id = ?', [COMPANY_PARAMETER_ID]);
  const base = param[0]?.landing_base_url || g.serverUrl;
  const pageUrl = landingUrl(base, g.companyId, { s: spec.slug });
  const unknownLinks = existingLinks.filter((e) => !spec.links.some((l) => l.name.trim().toLowerCase() == e.name.toLowerCase()));
  console.log(JSON.stringify({
    saved: true,
    company: `${g.companyName} (${g.companyId})`,
    page: { id: state.pageId, name: spec.name.trim(), slug: spec.slug, status },
    url: pageUrl,
    previewUrl: landingUrl(base, g.companyId, { s: spec.slug, p: state.pageId }),
    links: savedLinks.map((l) => ({ ...l, url: landingUrl(base, g.companyId, { l: l.code }) })),
    linksNotInSpec: unknownLinks.map((e) => e.name),
    campaign: campaign ? { code: campaign.code, name: campaign.name, templatesLinkHere: !!spec.setAsCampaignLanding } : null,
    files: uploaded,
    baseUrlConfigured: !!param[0]?.landing_base_url,
    warnings: issues.filter((i) => i.level != 'danger').map((i) => i.text),
  }, null, 1));
  return 0;
}

// ── main ────────────────────────────────────────────────────────────────────
const opt = parseArgs(process.argv.slice(2));
const [cmd, arg] = opt._;
const commands = { info: cmdInfo, check: cmdCheck, save: cmdSave };
if (!commands[cmd] || (cmd != 'info' && !arg)) {
  process.stderr.write(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
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
