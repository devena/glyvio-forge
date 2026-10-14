---
name: create-mail-template-from-file
description: "Creates and saves a Glyvio e-mail template from a file the user points to (PDF, image, flyer, DOCX, or a video/audio to link): recreates its content as e-mail-safe HTML, uploads every image and file the HTML uses as public Glyvio attachments, links the original file to the template under the name the user chose, and saves the template through the server API. Use when the user asks to turn a PDF/image/arte/folder/catálogo/comunicado into an e-mail template, to 'criar template de e-mail a partir deste arquivo', or to import a template with its attachments into a company."
---
<!-- Generated from src/skills/create-mail-template-from-file/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Skill: E-mail template from a file

The user gives a file (PDF, image, DOCX...) and a template name. You read the file, write the
template's HTML, and `glyvio_mail_template.mjs` uploads the files and saves the template:

```text
file ──► you: read it, cut its images, write body.html + spec.json
              │
              ▼
     glyvio_mail_template.mjs check  (offline: e-mail rules, variables, missing files)
              │
              ▼
     glyvio_mail_template.mjs save
        1. creates the template (POST /entity/{companyId}/save-list)
        2. uploads each local file of body.html as a PUBLIC attachment linked to the template
        3. uploads the original file, linked to the template under the user's name
        4. saves the template again with the body pointing to the public URLs
```

Talk to the user in their language (usually Portuguese) and in business terms: the template, its
images, the attached file. Decide the technical details yourself (ids, URLs, HTML structure). Do not
show the spec JSON or the HTML source unless the user asks.

**Triggers:** "cria um template de e-mail a partir deste PDF", "transforma essa arte em template",
"importa este comunicado como template", "salva este catálogo como template com o anexo".

---

## The script

`node .opencode/skills/create-mail-template-from-file/assets/glyvio_mail_template.mjs <command>` (Node 18+, no
dependencies):

| Command | What it does |
|---|---|
| `info [--env f]` | Company name, whether it has a company e-mail layout (`hasMailLayout`), template types in use, names of the e-mail templates |
| `check <spec.json>` | Offline review: e-mail HTML rules, unknown variables, local files missing or too heavy. Exit 2 when there is a `danger` |
| `save <spec.json> [--update] [--force]` | Uploads and saves (above). Refuses a name that already exists unless `--update`; refuses `danger` issues unless `--force` |

Credentials: a `.env` with `G_USERNAME`, `G_PASSWORD`, `G_COMPANY_ID` (optional `G_AUTH_URL`), the same
keys as the glyvio-dev-helper. Default: next to the spec. **Ask the user for them when missing. Never
write them into a repository, a spec or a message.** Login is `Basic` user:password; the server URL
comes from the company.

`save` keeps `<spec>.state.json` (template id, files already uploaded): running it again after an
error or an HTML change uploads only new or changed files and updates the same template. Keep the
working folder until the user is happy with the result. It also writes `body.publicado.html`, the body
exactly as saved.

### spec.json

```json
{
  "name": "Catálogo de outono",
  "subject": "Chegou o catálogo de outono da $S{company.name}",
  "body": "body.html",
  "key": "core.generic",
  "useLayout": true,
  "original": { "file": "catalogo_outono.pdf", "name": "Catálogo outono 2026" }
}
```

| Field | |
|---|---|
| `name` | Template name, as the user said it. Required |
| `subject` | Required. Short, from the file's title |
| `body` | The HTML file you write |
| `key` | Template type (context). Default `core.generic`, which every send screen offers. Use another only when the user asks for a specific context and `info` lists it |
| `useLayout` | `true`: the company layout (logo, header, footer) goes around the body when it is sent. `false`: the body is sent as it is |
| `original` | The source file, linked to the template under `name` (the extension is added when missing). Private, unless the body links to it or `"public": true` |

---

## Workflow

### 1. Collect

- The file (path). Several files are fine (e.g. a PDF plus a separate logo).
- The **template name**.
- The **name of the attached original** (default: the template name). This is the name the file shows
  in Glyvio.
- Whether the e-mail greets the recipient by name (default: yes when the source has a greeting).

Create a working folder (`.opencode/temp/mail-template/<template-slug>/`, or where the user asks) and copy
the source file into it.

### 2. Look at the company

Run `info`. With `hasMailLayout: true`, the company layout already has a logo, header and footer:
- if the source has its own header/logo/footer, **ask** whether the e-mail uses the company layout
  (drop the source's header and footer from the body) or the source's own look (`useLayout: false`,
  and the body carries the header and footer);
- otherwise use the layout and write only the content.

Check that the template name is not in `mailTemplates`. If it is, ask whether to replace it
(`save --update`) or use another name.

### 3. Read the source

| Source | How |
|---|---|
| PDF | Read it page by page (the file-reading tool shows text and layout). Extract its embedded images with `pdfimages -png <pdf> img/p` (poppler-utils). For a piece the extraction does not give whole (a chart, a composed banner), render the page with `pdftoppm -png -r 150 -f N -l N` and crop it |
| Image (PNG/JPG/flyer) | Read it. Crop the parts that must stay images (logo, photos, banners) |
| DOCX/PPTX/XLSX | It is a zip: text in `word/document.xml` (`ppt/slides/*.xml`, `xl/sharedStrings.xml`), images in `*/media/` |
| Video / audio / other | It cannot go inside an e-mail. Use a cover image (a frame, the first page, or a styled box) linking to the file. The script makes the file public when the body links to it |

Crop with what the machine has: ImageMagick (`magick in.png -crop WxH+X+Y +repage out.png`), Python
Pillow, or `sharp` via Node. If no tool can extract or crop, tell the user what to install
(poppler-utils, ImageMagick) or ask them for the images as files. **Never use a whole page as one
image** in place of its text: with images blocked (Outlook's default) the e-mail looks empty, and the
text cannot be edited later.

Images go under `img/`, as PNG (logos, flat art) or JPG (photos), at most ~1200 px wide (twice the
width they are shown at) and under 1 MB. No SVG and no `data:` URIs: Gmail and Outlook do not show
them.

### 4. Write body.html

Recreate the content, do not summarize it: same texts, same order, same emphasis. Fix only obvious
extraction errors (broken hyphenation, stray line breaks). Do not invent texts, prices, dates or
links; when the source has a link or a contact, keep it as it is.

E-mail HTML rules (the same ones the Glyvio template editor reviews):

- Layout with tables: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`.
  Columns are `<td>`s. No flexbox, grid, float or `position`.
- With `useLayout: true`: only the content. No `<html>`, `<head>`, `<body>`, header or footer; the
  content starts with a 100%-wide table, and the layout already gives 600 px and padding.
- With `useLayout: false`: an outer 100% table with the background, and a centered inner table
  `width="600" style="width:600px;max-width:100%;"`.
- All CSS inline (`style="..."` on each element). No `<style>`, no `class`.
- Fonts: `font-family:Arial,Helvetica,sans-serif` (or `Georgia,serif`); sizes in px; colors in hex.
- Every `<img>`: `src` = the local path (`img/logo.png`), `alt`, a `width` attribute, and
  `style="display:block;width:Npx;max-width:100%;height:auto;border:0;"`.
- Buttons: an `<a>` inside a table cell with background and padding, never `<button>`.
- Links to the original or to other local files: `href="catalogo_outono.pdf"`. The script uploads
  them and points to the public URL.
- No JavaScript, forms, iframes, video or audio tags.
- Keep it under 100 KB (Gmail clips longer messages).

Variables (replaced when the e-mail is sent):

| Write | Becomes |
|---|---|
| `@PERSON_NAME@` | Recipient's name ("Olá, @PERSON_NAME@,") |
| `$S{company.name}` | Company name |
| `$S{user.name}`, `$S{user.email}` | The user who sends it |

A `core.generic` template has only these. Do not put data of a specific record (a client's name, an
order number) in a generic template. For another `key`, use only variables the user confirms that
context has.

Show the user the result: open `body.html` in a browser (the local images load) or describe it, and
adjust until they approve it.

### 5. Check and save

1. Write `spec.json`.
2. Run `check`. Fix every `danger`. Fix the warnings that apply, and tell the user about any you keep.
3. Run `save` (`--update` only when the user agreed to replace an existing template).
4. Report in business terms: the template name, how many images were published, the original
   attached under its name, and the warnings kept. Point the user to the Glyvio template screen to
   preview it with the company layout and send a test to themselves.

---

## What to tell the user about attachments

- The images and every file the body links to are **public**: anyone with the link can open them.
  This is required, because a recipient's e-mail reader has no Glyvio login. Do not put a confidential
  file in the body; keep it as the private original instead.
- The original stays **linked to the template** under the chosen name, so it is stored with it.
  The send screen does **not** attach it to the e-mail automatically. To deliver the file, the body
  must link to it (`"public": true`, or a link in the HTML), or the user attaches it when sending.
- Running `save` again after changing an image publishes the new image. The old one stays linked to
  the template.

## Errors

| Message | What to do |
|---|---|
| `credenciais ausentes` / `login recusado` | Ask for the user, password and company id again |
| `empresa ... não encontrada` | The user has no access to that company. The message lists the ones they have |
| `já existe um template chamado` | Ask: replace (`--update`) or another name |
| `não ficou com URL pública` | The server did not publish the file. Run `save` again; if it repeats, report it to Glyvio support with the file name |
| `arquivo não encontrado` | A `src`/`href` in body.html points to a file that is not in the folder |
