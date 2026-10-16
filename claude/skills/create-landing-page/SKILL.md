---
name: create-landing-page
description: "Creates or updates a crm_full landing page in a Glyvio company from what the user gives (a briefing, an art/PDF/print, an existing site, a campaign): designs the page with ready-made blocks and/or free HTML (advanced mode, own CSS, full width), sets the form fields, LGPD consent and after-send behaviour, theme, origin links with QR codes (fairs, flyers, kiosk tablets) and the campaign it belongs to; uploads the images as public files and saves it through the server API. Use when the user asks to 'criar uma landing page', 'montar uma página de captura/inscrição/feira', 'transformar esta arte em landing page', 'página com formulário para a campanha', or to change an existing one."
---
<!-- Generated from src/skills/create-landing-page/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Skill: Landing page (crm_full)

The crm_full plugin (0.3.68+) has landing pages: a public page with a form that records every visit
and every form sent, linked to a campaign and to origin links (QR codes). This skill builds one for
the user and saves it in their company — the same record the Glyvio screen **Vendas → Landing
pages** edits, so the user can keep adjusting it there.

```text
briefing / art / site ──► you: design the blocks (ready-made and/or free HTML), the form, the links
                               write spec.json (+ html files, img/)
                                     │
                                     ▼
                  glyvio_landing_page.mjs check   (offline: blocks, HTML, form, links, files)
                                     │
                                     ▼
                  glyvio_landing_page.mjs save    1. creates the page (draft)
                                                  2. uploads every local image/file as PUBLIC, linked to it
                                                  3. saves blocks, form, theme, links, campaign
                                                  4. prints the public URL, the preview URL and the link URLs
```

Talk to the user in their language (usually Portuguese) and in business terms: the page, its
sections, the form, the links/QR codes, the campaign. Decide the technical details yourself (block
JSON, keys, CSS). Do not show the spec or the HTML unless the user asks.

**Triggers:** "cria uma landing page para a feira", "monta uma página de inscrição", "transforma este
folder em landing page", "quero uma página com formulário para a campanha X", "muda o texto da
landing page Y".

---

## The script

`node ~/.claude/skills/create-landing-page/assets/glyvio_landing_page.mjs <command>` (Node 18+, no dependencies):

| Command | What it does |
|---|---|
| `info [--env f]` | Company, base URL of the links, landing pages (slug, status, visits, forms), campaigns (code, active, its landing page), user groups |
| `check <spec.json>` | Offline review: block types, free HTML (no own `<form>`, unscoped CSS, missing `@media`, variables), form fields, consent, colors, links, local files missing or heavy. Exit 2 on a `danger` |
| `save <spec.json> [--update] [--publish] [--force]` | Uploads and saves (above). Refuses a slug already used by another page unless `--update`; refuses `danger` issues unless `--force` |

Credentials: a `.env` with `G_USERNAME`, `G_PASSWORD`, `G_COMPANY_ID` (optional `G_AUTH_URL`) — the
same keys as the glyvio-dev-helper. Default: next to the spec. **Ask the user for them when missing.
Never write them into a repository, a spec or a message.**

`save` keeps `<spec>.state.json` (page id, link codes, files already uploaded): running it again after
an error or a change updates the same page, keeps the links' codes (printed QR codes keep working) and
uploads only new or changed files. Keep the working folder until the user is happy.

A page that is not published is visible only through `previewUrl` (it carries the page id; visits
and forms are not recorded there). `--publish` (or `"publish": true`) puts it on the public URL.

---

## Workflow

### 1. Collect

Ask only what you cannot infer from what the user gave:

| Item | Notes |
|---|---|
| Content | Briefing, texts, art/PDF/print, logo, photos, an existing site to follow. Recreate the source's texts, do not invent prices, dates, claims or contacts |
| Name | Internal name. The address (slug) comes from it unless the user wants another |
| Form | Which data to capture (see field types). Default: name, e-mail, phone. Which are required |
| Consent (LGPD) | Default: "Concordo em receber contato e com o tratamento dos meus dados conforme a LGPD." |
| After sending | Thank-you message, or a page to redirect to |
| Campaign | Code of the campaign that uses this page (see `info`). The campaign points to the page — the page itself has no campaign |
| Origin links | One per place the link/QR code goes: fair booth, flyer, Instagram... Kiosk mode for a tablet at a booth (the form resets after each send, no per-visitor limit) |
| Group | User group that owns the page and receives the "new form" notifications (default `core_public`) |
| Look | Colors (or take them from the logo/art), font, light or dark sections |

Working folder: `.claude/temp/landing-page/<slug>/` (or where the user asks), with `spec.json`, the HTML
files of the free blocks (`blocos/*.html`) and the images (`img/`).

### 2. Look at the company

Run `info`:
- `baseUrlConfigured: false` → the links use the server URL; tell the user they can set the public URL
  in **Landing pages → engrenagem**.
- the slug must not be in `landingPages` (unless updating that page, with `--update`);
- the campaign code must be in `campaigns`; if that campaign already uses another page (`landing_slug`),
  ask before replacing it;
- the group, when given, must be in `userGroups`.

### 3. Design the page

Choose per section: a **ready-made block** (consistent, editable by anyone in the Glyvio screen) or a
**free HTML block** (advanced: any layout, the user's or your own CSS). Mix them freely — e.g. a free
HTML hero and showcase, then the ready-made `form` and `faq` blocks.

**Ready-made blocks** (fields in the spec, all optional unless noted):

| type | Fields |
|---|---|
| `header` | `title` (brand), `logoUrl`, `buttonLabel`, `buttonUrl` |
| `hero` | `title`, `subtitle`, `text`, `imageUrl`, `buttonLabel`, `buttonUrl`; `variant`: `centered`, `split` (image beside), `image` (photo background), `form` (the page's form beside the text — the layout that converts the most; the `form` block is then hidden) |
| `text` | `title`, `subtitle`, `text` (line breaks kept), `buttonLabel`, `buttonUrl` |
| `richText` | `title`, `subtitle`, `html` (simple formatted text; centered column up to 860 px) |
| `image` | `imageUrl` (required), `imageAlt`, `title`, `text` (caption) |
| `video` | `videoUrl` (YouTube/Vimeo link), `title` |
| `benefits` | `title`, `subtitle`, `items: [{ icon (emoji), title, text, imageUrl }]`; `variant`: `cards`, `icons`, `list` (checklist) |
| `testimonials` | `title`, `items: [{ title (name), subtitle (role/company), text (quote), imageUrl (photo) }]`; `variant`: `cards`, `highlight` |
| `faq` | `title`, `items: [{ title (question), text (answer) }]` |
| `countdown` | `title`, `endsAt` (`YYYY-MM-DD` or ISO; empty = the campaign's final date), `buttonLabel`, `buttonUrl` |
| `cta` | `title`, `text`, `buttonLabel`, `buttonUrl` (primary-color band) |
| `form` | `title`, `subtitle`, `text` — where the form goes (one per page; without it, at the end); `variant`: `card`, `split` (text beside), `banner` (gradient band) |
| `logos` | `title`, `items: [{ title (client name), imageUrl (logo) }]` (grayscale, color on hover) |
| `stats` | `title`, `items: [{ title (the number: "+500"), text (what it counts) }]`; `variant`: `plain`, `cards` |
| `steps` | `title`, `subtitle`, `items: [{ title, text, icon (optional, instead of the number) }]`; `variant`: `numbers`, `timeline` |
| `gallery` | `title`, `items: [{ imageUrl, title (caption) }]`; `variant`: `grid`, `carousel` |
| `map` | `title`, `text`, `address` (searched on Google Maps), `buttonLabel`, `buttonUrl` |
| `divider` | `variant`: `wave`, `slant`, `curve`; `background` = color of the shape (the next section's) |
| `whatsapp` | `phone` (country + area code, e.g. `5511999998888`), `text` (first message), `buttonLabel` — floating button |
| `footer` | `logoUrl`, `text` |
| `html` | `file` (an HTML file of the folder) or `html` — **free HTML, advanced mode** (below). Needs crm_full 0.3.70+ |

Style of any section block: `background` (`default`, `alt`, `primary`, `gradient`, `dark`, `image` +
`backgroundImageUrl`), `spacing` (`compact`, `normal`, `airy`), `width: "full"` (image, gallery, map,
richText, video), `align` (`center`, `left`), `hidden: true` (kept in the editor, not shown).
`buttonUrl: "#form"` scrolls to the form. Image fields take a local path (`img/banner.jpg`, uploaded)
or an `https://` URL. Layouts, styles and the new blocks need crm_full 0.3.82+.

Theme: `primaryColor`, `textColor`, `backgroundColor`, `altBackgroundColor`, `fontFamily`,
`headingFontFamily`, `radius`, `buttonStyle` (`rounded`, `pill`, `square`, `outline`), `shadow`
(`none`, `soft`, `strong`). The page exposes them as CSS variables for free HTML: `var(--lp-primary)`,
`--lp-text`, `--lp-bg`, `--lp-alt`, `--lp-radius`, `--lp-btn-radius`, `--lp-font`, `--lp-heading-font`,
`--lp-shadow`.

**Page type** (`type`): `generic` (the form is only recorded) or `leads` (each form becomes client,
person, contacts and a tag on the client; `typeConfig: { "tagName": "...", "clientStatusId": "..." }`),
or the id of a type registered by another plugin.

**Full HTML mode** (`"mode": "html"`, `fullHtmlFile: "pagina.html"` or `fullHtml`): the whole page is
your HTML document; the form (with visit and send tracking, consent, anti-spam) goes where
`<!-- glyvio:form -->` is, and the form styles, tags and script are added to it. Local files in it are
uploaded like in free blocks. The blocks are kept but not shown.

**Advanced**: `customCss` (added after the page CSS), `tracking: { metaPixelId, ga4Id, gtmId }` (the
send is also reported as `Lead` / `generate_lead` / `glyvio_landing_submit`), `ogImageUrl` (share
image, 1200×630) and `faviconUrl` — local paths or `https://` URLs.

**Free HTML blocks — rules** (the page shows them as written, full width, no wrapper):

- Write only the section: no `<html>`, `<head>`, `<body>`. Put its CSS in a `<style>` inside the block.
- **Scope every CSS rule under the block's own class** (`.agro-hero h1 { ... }`, never a bare `h1`,
  `body`, `*` or `section`): the page has other blocks and the form, styled by the page theme.
- Responsive: mobile first, or `@media (max-width: 760px)` for columns/fixed widths. The page is read
  on phones (390 px) — always check it.
- **Never write a `<form>`**: it would not be recorded. Calls to action are `<a href="#form">`, which
  scroll to the `form` block (it records the visit and the send, applies consent and anti-spam).
- Images and files: local paths (`img/x.webp`, also in `url()`, `srcset`, `poster`) are uploaded as
  public files; or `https://` URLs. Give every `<img>` an `alt`, `width`/`height` or `aspect-ratio`, and
  `loading="lazy"` below the fold. Use WebP/JPG for photos (≤ ~1600 px wide, < 1 MB), SVG/PNG for logos.
- Fonts: the theme font, or Google Fonts via `<link href="https://fonts.googleapis.com/...">` inside the
  block. Animations only with CSS; `<script>` runs on the public page — avoid it unless needed and never
  put data or keys in it.
- Glyvio variables (`$S{...}`, `@PERSON_NAME@`) are **not** replaced on a landing page.
- Use the theme colors in the free CSS too, so the ready-made blocks match.

Look at the result before saving: open the free HTML files in a browser (wrap them in a basic
`<!DOCTYPE html><meta name="viewport" content="width=device-width,initial-scale=1">` file) at 1280 px
and 390 px. After `save`, open `previewUrl` to see the real page (with the form and the theme).

### 4. The form

| type | Input | Use for |
|---|---|---|
| `name` | text | Name |
| `email` | e-mail (validated) | E-mail |
| `phone` | phone | Phone / WhatsApp |
| `company` | text | Company |
| `document` | text | CPF/CNPJ |
| `city`, `state` | text (state: 2 letters) | Location |
| `text` / `textarea` | short / long text | Free answers, message |
| `number`, `date` | number / date | Quantity, date of interest |
| `select` | list (`options: [...]`) | Interest, product, size of the farm... |
| `boolean` | checkbox | "Quero receber uma visita" |

Each field: `label` (shown), `key` (default: from the label — `e_mail`, `telefone`...; keys are what
each company's interceptors read from `landing_submission.data`), `required`, `placeholder`. Keep the
form short: every extra field costs conversions. Always have an e-mail or a phone.

What happens with a form: crm_full records it (`landing_submission`) with the values, the origin
(link, campaign, UTM, channel, device) and the consent, notifies the page's group and records it on the
campaign's timeline. **It does not create people or clients**: each company does that in its own
interceptor (the plugin skill `create-after-interceptor`, reading the values with
`crm_full.landingSubmissionValues(submission)`). Tell the user that, and offer it when they expect
leads to become people/clients.

### 5. Links, campaign and QR codes

- `links`: one per place (`name`, `source` → utm_source, `medium` → utm_medium, `campaign` code,
  `kiosk`). Each gets its own URL and QR code; visits and forms are counted per link.
- QR codes: in the Glyvio screen (**Landing pages → the page → Links e QR codes**). The link's code
  never changes on `save`, so printed QR codes keep working.
- `campaign` (spec root): the campaign that **uses** this page (`campaign.landing_page_id`, the
  same field as **Landing page** in the campaign's cart). Its templates get the variable **Link da
  landing page** — an individual link per recipient and channel, so the page knows who came from which
  message — and anonymous visits/forms (no link campaign, no `utm_campaign`) count on it while it is
  active and in its period. Several campaigns may use the same page; the page has no campaign field.
- A link's `campaign`: that origin link (a fair's QR code) always counts on this campaign, whatever
  campaigns use the page.

### 6. Check, save and report

1. Write `spec.json` (reference below).
2. `check`. Fix every `danger`; fix the warnings that apply and tell the user about any you keep.
3. `save` as a draft. Open `previewUrl` (desktop and phone) and show the user (screenshots, or the link).
4. When the user approves: `save --publish` (and `--update` only for a page that already existed
   before this spec).
5. Report in business terms: the page's public link, each origin link (and that its QR code is in
   the Glyvio screen), the campaign that uses it, how many images were published, and the warnings kept.

### spec.json

```json
{
  "name": "Feira Agro 2026",
  "slug": "feira-agro-2026",
  "title": "Feira Agro 2026 — condições especiais",
  "description": "Cadastre-se e receba a proposta com taxa zero.",
  "campaign": "000123",
  "userGroup": "Vendas",
  "type": "leads",
  "typeConfig": { "tagName": "Feira Agro 2026" },
  "theme": { "primaryColor": "#1F9D63", "textColor": "#1F2430", "backgroundColor": "#FFFFFF", "altBackgroundColor": "#F2F7F4", "radius": 12, "buttonStyle": "pill", "shadow": "strong" },
  "tracking": { "metaPixelId": "123456789012345" },
  "ogImageUrl": "img/compartilhar.jpg",
  "blocks": [
    { "type": "html", "file": "blocos/topo.html" },
    { "type": "stats", "variant": "cards", "background": "alt", "items": [
      { "title": "+30 anos", "text": "no campo" }, { "title": "+2 mil", "text": "máquinas entregues" } ] },
    { "type": "benefits", "variant": "icons", "title": "Por que aproveitar", "items": [
      { "icon": "🚜", "title": "Pronta entrega", "text": "Em até 7 dias." },
      { "icon": "💰", "title": "Taxa zero", "text": "Em 12x no cartão." } ] },
    { "type": "form", "variant": "split", "title": "Receba sua proposta", "subtitle": "Retornamos em 1 dia útil." },
    { "type": "faq", "title": "Dúvidas", "items": [ { "title": "Preciso ir à feira?", "text": "Não, vale online." } ] },
    { "type": "whatsapp", "phone": "5511999998888", "text": "Olá! Vim pela página da feira.", "buttonLabel": "Fale conosco" },
    { "type": "footer", "logoUrl": "img/logo.png", "text": "© Acme Máquinas" }
  ],
  "form": {
    "fields": [
      { "label": "Nome", "type": "name", "required": true },
      { "label": "E-mail", "type": "email", "required": true },
      { "label": "WhatsApp", "key": "telefone", "type": "phone" },
      { "label": "Interesse", "type": "select", "options": ["Tratores", "Implementos", "Peças"] }
    ],
    "submitLabel": "Quero minha proposta",
    "successMessage": "Obrigado! Um consultor vai falar com você.",
    "consentText": "Concordo em receber contato e com o tratamento dos meus dados conforme a LGPD.",
    "kioskResetSeconds": 8
  },
  "links": [
    { "name": "Estande (tablet)", "source": "feira", "medium": "quiosque", "kiosk": true },
    { "name": "Panfleto", "source": "panfleto", "medium": "qrcode" },
    { "name": "Instagram", "source": "instagram", "medium": "social" }
  ]
}
```

`blocos/topo.html` (free HTML, advanced mode):

```html
<style>
  .agro-topo { background: linear-gradient(135deg, #0f3d2e, #1f9d63); color: #fff; padding: 72px 20px; }
  .agro-topo .wrap { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 1.1fr .9fr; gap: 40px; align-items: center; }
  .agro-topo h1 { font-size: clamp(32px, 5vw, 52px); line-height: 1.1; margin: 0 0 16px; }
  .agro-topo p { font-size: 19px; opacity: .92; margin: 0 0 28px; }
  .agro-topo a.cta { display: inline-block; background: #fff; color: #0f3d2e; font-weight: 700; padding: 14px 28px; border-radius: 12px; text-decoration: none; }
  .agro-topo img { width: 100%; height: auto; border-radius: 16px; }
  @media (max-width: 760px) { .agro-topo .wrap { grid-template-columns: 1fr; text-align: center; } }
</style>
<section class="agro-topo">
  <div class="wrap">
    <div>
      <h1>Condições exclusivas da Feira Agro 2026</h1>
      <p>Taxa zero em 12x e frete grátis para quem se cadastrar.</p>
      <a class="cta" href="#form">Quero minha proposta</a>
    </div>
    <img src="img/trator.webp" alt="Trator Acme" width="640" height="420">
  </div>
</section>
```

---

## Errors

| Message | What to do |
|---|---|
| `credenciais ausentes` / `login recusado` | Ask for the user, password and company id again |
| `esta empresa não tem landing pages` | The company's crm_full is older than 0.3.68 (or 0.3.70 for `html` blocks): ask the user to update it |
| `já existe uma landing page com o endereço` | Updating that page? `--update`. Otherwise another `slug` |
| `campanha "..." não encontrada` | Use the campaign code from `info` |
| `não ficou com URL pública` | The server did not publish the file. Run `save` again; if it repeats, report it with the file name |
| `arquivo não encontrado` | An image/file path in the spec or in a free HTML block is not in the folder |
