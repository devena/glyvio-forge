---
name: create-custom-page
description: 'Generates a Custom Page: a single-file HTML page (dashboard, relatório, painel, printable document) rendered server-side by a SimpleController in plugin/server and opened by a direct URL at /custom/{private|public|external}/page/{companyId}/{path}. Use whenever the user asks for a dashboard, relatório, painel, gráfico, KPI, indicadores, analytics, visualização de dados, página HTML customizada, or any "abrir em nova aba" page built from SQL queries. Covers the controller, the access mode, registration, the invocation URL and how to surface it from a screen. NOT for the Report Record model (glyvio_entity.Report configured in the app admin screen) — that is data entry, not code; see the disambiguation below.'
---

# Skill: Create a Custom Page

A **Custom Page** is an HTML page produced by your plugin's server layer and opened by a direct
URL. The controller runs the query, builds the HTML string, and returns it.

---

## 🔀 Step 0 — Confirm this is a Custom Page, not a Report Record

Glyvio has two unrelated mechanisms here and users call both "relatório". **Disambiguate by where
the thing is authored, never by the word.**

| | **Custom Page** (this skill) | **Report Record** |
| --- | --- | --- |
| Authored in | Code (`plugin/server/src/controllers/`) | The app's "Relatório" admin screen |
| Query lives in | The controller's `handle()` | The record's `dataQueries` field |
| Requires a deploy | Yes | No |
| URL segment | `/custom/{access}/**page**/…` | `/custom/{access}/**report**/…` |
| Appears in the app's report button | No (see the bridge below) | Yes, via `screenPaths` |

### If the user has not said which one, ASK — do not guess

The word "relatório" matches both models, so a bare request like *"quero um relatório de vendas"*
is **not** enough to choose. Asking costs one turn; guessing wrong costs the whole build (a
published controller the user cannot edit, or a record that cannot do what they wanted).

Ask in the user's terms — where it is authored, not which class it extends:

> "Esse relatório você quer **configurar pelo app** — cadastrar a consulta e os filtros na tela de
> Relatórios, sem publicar nada —, ou quer que eu **escreva em código** uma página HTML com
> gráficos, que exige publicar o plugin?"

Signals that already answer it, when present:

| Points to **Report Record** | Points to **Custom Page** |
| --- | --- |
| "configurar pelo app", "sem publicar", "sem deploy" | "com gráficos", "dashboard", "Plotly" |
| "o usuário mesmo altera a consulta" | "layout customizado", "igual a este print" |
| "cadastrar um relatório" | "uma página", "abrir em nova aba" |
| PDF / XLSX / CSV as the output | an interactive HTML page |

Only when neither the request nor the answer settles it, default to asking again — never start
building on a coin flip.

If the user wants to configure it in the app without publishing, they want a **Report Record** —
switch to the **`configure-report-record`** skill, which covers the record's fields, why a report
does not show up on a screen (`screenPaths`), and when a custom processor is needed.

**The bridge**: a Custom Page never shows up in the native report button, which lists only
`Report` records whose `screenPaths` match the current screen. To put one there you need *both* a
controller *and* a `Report` record whose `processor` returns the page's URL — see
`configure-report-record` §5. Only do this when the user explicitly asks for it; a plain button
calling `openCustomPage` is simpler and leaves no record to maintain.

---

## 📥 Required Input Parameters

1. **Page name / `controllerPath`** (e.g. `visit_page`, `sales_dashboard`): snake_case; becomes the
   last URL segment.
2. **Access mode**: `private` (logged-in user, default), `public` (no auth) or `external`
   (ExternalUser with a shareable link).
3. **SQL query + a sample of returned rows** — required before any layout work; do not invent data.
4. **What the page must show**: KPIs, charts, tables, and any grouping/time window.

---

## 🛣️ The invocation URL

```
{BASE_URL}/custom/{access}/page/{companyId}/{controllerPath}
```

| `{access}` | Base class + flag | Auth parameter |
| --- | --- | --- |
| `private` | `SimpleController`, `allowPrivateAccess: true` | `?authorization=Bearer%20<jwt>` |
| `public` | `SimpleController`, `allowPublicAccess: true` | none |
| `external` | `ExternalSimpleController`, `allowExternalUserAccess: true` | `?auth_token=<jwt>` |

The access segment and the auth parameter change **together**.

> ⚠️ **Migration in progress: `report` → `page`.** The segment was
> `/custom/{access}/report/{companyId}/{name}`; that is now reserved for the **Report Record** model.
> Use `page` for anything new. The legacy `report` segment still responds while the migration lands,
> so do **not** rewrite an existing plugin to `page` until the target environment serves it.

### ⚠️ `{BASE_URL}` is not the app's host

Measured live: on `app-beta.glyvio.com` the app serves only static assets and the API is
`webapi-prod.glyvio.com`. Pointing at the app host returns the SPA fallback HTML with **HTTP 200** —
no error, wrong body. Discover it instead of guessing: the app calls
`POST {BASE_URL}/query/{companyId}/query-for-user` right after login; strip that suffix and the
remainder is `BASE_URL`. Automated by `discover_base_url.js` (skill `test-plugin-browser`, §1.5).
On some environments the API is same-host under a prefix such as `/web-api`.

---

## ⚙️ Execution Steps

### Step 1 — Create the controller

`plugin/server/src/controllers/<controller_path>_controller.ts`:

```typescript
interface <RowType> {
  /* one field per selected column */
}

@glyvio_core.Controller({
  path: '<controllerPath>',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class <ClassName> extends glyvio_core.SimpleController<void, string> {
  handle(_request: glyvio_core.WebRequest<void>): string {
    // Bind every caller-influenced value via `params` — never interpolate into the SQL string.
    const rows = glyvio_core.queryService.find<<RowType>>(
      `SELECT /* columns */ FROM /* table */ WHERE /* condition */ = $1`,
      [/* bound value */],
    );
    return this.buildHtml(rows);
  }

  private buildHtml(rows: <RowType>[]): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title><Page Title></title></head>
<body>
  <script>const rawData = ${safeJson(rows)};</script>
</body>
</html>`;
  }
}
```

> ⚠️ **Escape the data you embed.** `JSON.stringify` does **not** escape `</script>`: a single row
> containing that string (a note, a description, an imported field) closes the tag early and the
> rest of the document is parsed as HTML — a broken page at best, script injection at worst. Wrap it:
>
> ```typescript
> private safeJson(value: unknown): string {
>   return JSON.stringify(value).replace(/</g, '\\u003c');
> }
> ```
>
> The same applies to any row value interpolated into the HTML body — escape it, never concatenate
> raw. This is a separate risk from SQL injection (which `params` handles) and is not covered by it.

For `external` access, extend `glyvio_core.ExternalSimpleController<T, string>` instead, set
`allowExternalUserAccess: true` / `allowPrivateAccess: false`, and take the extra
`externalUser: glyvio_entity.ExternalUser` parameter in `handle` — scoping every query to that user.

### Step 2 — Register it (NON-NEGOTIABLE)

The decorator only fires if the module is loaded. Add to `plugin/server/src/index.ts`:

```typescript
export * from './controllers/<controller_path>_controller';
```

Skipping this is a **silent failure**: the build passes, the URL returns 404, and nothing says why.
There is no separate `behavior_listeners/` entrypoint, and controllers are **not** discovered
automatically without this line.

### Step 3 — Scope the data (NON-NEGOTIABLE for `private`)

`@glyvio_core.Controller` has **no permission field** — its only access flags are
`allowPrivateAccess` / `allowPublicAccess` / `allowExternalUserAccess`. So `private` means *any
authenticated user of the company can open this page*. There is no per-permission ACL.

- Filter inside `handle()` by whatever the business rule requires (`glyvio_core.sessionService.getCurrentSession()`
  for the logged user, the `externalUser` argument in `external` mode).
- Never rely on "nobody knows the URL". For `private` and `external` the token travels in the query
  string, so it lands in browser history, proxy logs and `Referer` headers — treat the URL as
  shareable-by-accident and keep the page's data scoped accordingly.
- `allowPublicAccess: true` means genuinely unauthenticated: only for data that may be fully public.

### Step 3.5 — Parameters

A Custom Page **can** be parameterized. `openCustomPage` takes a third argument, and the client turns
it into a query string:

```typescript
await this.openCustomPage('sale_report', false, { saleId: sale.id, format: 'pdf' });
// -> {BASE_URL}/custom/private/page/{companyId}/sale_report?saleId=...&format=pdf&authorization=...
```

The controller reads them from `glyvio_core.WebRequest.requestParams`.

Four things the contract guarantees — get these wrong and the page misbehaves silently:

1. **Everything arrives as a string.** The client converts and URL-encodes every value, so a
   `number` sent as `42` is read back as `'42'` and a `boolean` as `'true'`. Parse and validate
   server-side; never compare a `requestParams` value directly against a number or boolean.
2. **`null` / `undefined` entries are dropped**, not sent as empty. A parameter your `handle()`
   depends on may simply be absent — treat every one as optional and fail explicitly when required.
3. **`authorization` is a reserved key** — it carries the session token on private pages. Never use
   that name for your own parameter.
4. **Parameters are untrusted input.** They live in the URL and any user can edit it. Combined with
   Step 3 (`private` = *any* authenticated user of the company, no per-permission ACL), a `saleId`
   handed in from a button is **not** proof the caller may see that sale.

   > Always re-authorize server-side: bind the value via SQL `params` *and* constrain the query by
   > what the session is actually allowed to read. Passing an id from the app is a convenience, never
   > an authorization.

Also: because parameters end up in the URL, they reach browser history, proxy logs and `Referer`
headers. Never pass secrets — ids and filters only.

Reading them:

```typescript
handle(request: glyvio_core.WebRequest<void>): string {
  const params = request.requestParams as Record<string, string | undefined>;
  const saleId = params.saleId;
  if (!saleId) {
    throw new glyvio_core.GlyvioError({ message: 'saleId é obrigatório' });
  }
  const rows = glyvio_core.queryService.find<<RowType>>(
    `SELECT /* columns */ FROM /* table */ WHERE id = $1 /* AND <scope by session> */`,
    [saleId],
  );
  return this.buildHtml(rows);
}
```

If the page needs no parameters at all, keep `WebRequest<void>` and ignore `requestParams`.

---

### Step 4 — Build and validate

```sh
pnpm pretty && pnpm lint && pnpm build
```

For a live check against a real backend without publishing, use the `fork-company-script` skill.
Discover `BASE_URL` with `discover_base_url.js` and open the page URL in a browser.

### Step 5 — Offer the button (ALWAYS ASK)

A Custom Page is useless if nobody can reach it. **After the page is approved and building, always
ask the user** — do not assume, and do not skip:

> "Quer que eu crie um botão para abrir esta página dentro do app? Se sim, me diga onde: em qual
> tela (lista, tabela, sidebar, modal…), de qual entidade, e em que posição (app bar, menu de linha,
> botão de ação)."

Let the user describe the place in their own words, then map it to the concrete surface:

| What the user describes | Where the button goes |
| --- | --- |
| "na tela de listagem de X" | `getDesign` of the X list/table page → `appBar.putButtonOn(...)` |
| "quando abro um registro de X" | the X sidebar / tab-sidebar → a button passing that record id as a parameter |
| "num item da lista" | the page's row/cell design → a per-row action |
| "no menu" | a menu item via `FullMenuPage.fullMenuGroupAdd` on a route that opens the page |

If the user says no, or wants it delivered as a plain link, stop here — the page is already usable
by URL.

#### Wiring the button

`CoreView.openCustomPage(name, isPublic?)` does everything — **never build the URL by hand**:

```typescript
// no design
new glyvio_core.ActionButtonDesign({
  key: 'open<PageName>.button',
  type: 'SECONDARY',
  iconName: 'sax_linear_document_text',
  tooltip: '<tooltip>',
  action: new glyvio_core.Action({ key: 'open<PageName>', data: {} }),
})

// no events()
if (action.key === 'open<PageName>') {
  await this.openCustomPage('<controllerPath>');                    // private, sem params
  // await this.openCustomPage('<controllerPath>', true);           // rota pública
  // await this.openCustomPage('<controllerPath>', false, {         // com parâmetros
  //   saleId: state.sale!.id,
  // });
  return 'STATE_FREEZED';                                           // navegação, não muda estado
}
```

- The Flutter client resolves `BASE_URL`, the logged company id and — for private pages — appends the
  session token itself. The plugin passes the page name (the `@Controller` `path`) and, optionally,
  parameters (see Step 3.5 — they arrive as **strings** and are **untrusted**).
- Return `'STATE_FREEZED'`, not `'STATE_UPDATE'`: opening a page is navigation, it mutates nothing.
- `openCustomPage` covers `private` and `public`. `external` pages are handed out as links, not
  opened from inside a view.
- Do **not** use `this.extensionsManager.registerReport(...)` — that is the Report Record picker and
  will never list your controller.

---

## 🎨 Page content

For KPI/chart layout, the colour system, Plotly configuration and the HTML preview iteration loop,
this skill defers to the **`glyvio-custom-page-agent`** — invoke it for anything beyond a plain
table. This skill owns the controller, the access mode, registration and the URL; the agent owns
what the page looks like.

---

## ✅ Checklist

- [ ] Confirmed with the user that this is a Custom Page, not a Report Record.
- [ ] `path` matches the last URL segment and is snake_case.
- [ ] Access mode matches the audience, and the flags match the base class.
- [ ] `export *` added to `plugin/server/src/index.ts`.
- [ ] Every caller-influenced SQL value is bound via `params`, never interpolated.
- [ ] Data is scoped inside `handle()` — no reliance on URL secrecy.
- [ ] `handle()` returns a complete HTML document as a `string`.
- [ ] `pnpm lint && pnpm build` clean.
- [ ] The URL handed to the user uses the **discovered** `BASE_URL`, not the app's host.
- [ ] **Asked the user whether they want an in-app button, and where** — never assumed, never skipped.
- [ ] If a button was requested: it calls `openCustomPage(name, isPublic?, parameters?)` (never a
      hand-built URL) and its handler returns `'STATE_FREEZED'`.
- [ ] Every parameter read from `requestParams` is treated as a **string** and as **untrusted**:
      parsed, validated, bound via SQL `params`, and re-authorized against the session.
