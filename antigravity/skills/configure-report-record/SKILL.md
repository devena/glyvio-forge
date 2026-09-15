---
name: configure-report-record
description: 'Guides a user through the Report Record model: a glyvio_entity.Report row configured in the app''s "Relatório" admin screen (no deploy), whose SQL lives in the record itself and which is rendered by a processor plugin. Use when the user wants a relatório/report they can configure in the app without publishing code, asks why their report does not appear on a screen, asks about screenPaths / dataQueries / filterParameters / processor / outputFormat, or wants to write a custom report processor. This is mostly ORIENTATION, not code generation — the only code involved is a custom PluginServiceInterfaceReportProcessor. For an HTML page written in code and opened by URL, use create-custom-page instead.'
---

# Skill: Configure a Report Record

A **Report Record** is a `glyvio_entity.Report` row. The user creates it in the app's **Relatório**
screen (`/report-list` → `/report-edit`); its SQL, filters and output format live in the record, and
a **processor plugin** turns it into a file or page. **No deploy is involved.**

> This skill is mostly **orientation**: you explain fields and diagnose, the user fills the form.
> The single exception is writing a custom processor (Step 5) — that is real plugin code.

---

## 🔀 Step 0 — Confirm the model

| | **Report Record** (this skill) | **Custom Page** |
| --- | --- | --- |
| Authored in | The app's "Relatório" screen | Code (`plugin/server/src/controllers/`) |
| Query lives in | The record's `dataQueries` | The controller's `handle()` |
| Requires a deploy | **No** | Yes |
| Rendered by | A processor plugin (`processor`) | Your own `buildHtml` |
| Reaches a screen via | `screenPaths` matching the route | A button calling `openCustomPage` |
| URL segment | `/custom/{access}/**report**/…` | `/custom/{access}/**page**/…` |

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

If the user wants to write the HTML/SQL themselves and publish it, they want **`create-custom-page`**.
Disambiguate by **where the thing is authored**, never by the word "relatório" — users say it for both.

---

## 🗂️ The record's fields

Measured from a real record. Everything below is filled in `/report-edit`.

| Field | Meaning |
| --- | --- |
| `name` | Display name in the report picker. |
| `processor` | **Plugin id** of the service that renders it (e.g. the `html_report` plugin). Without a matching registered processor the run fails with `Processor not found: <id>`. |
| `screenPaths` | `[{ path, type }]` — which screens offer this report. See Step 2. |
| `showFilterScreen` | `true` → the filter modal opens before running; `false` → runs immediately. |
| `filterParameters` | The filter form definition. See Step 3. |
| `dataQueries` | The SQL. See Step 4. |
| `outputFormat` | `PDF` \| `XLSX` \| `CSV` \| `HTML`. |
| `outputName` | File name handed to the user (e.g. `travel.html`). |
| `evalStartProcess` / `evalEndProcess` | Optional hooks evaluated around the run. |
| `mainAttachment` | Optional template file (used by template-based processors). |
| `integrationCode` | Optional external correlation code. |

---

## 🖥️ Step 2 — Why the report does not appear on a screen

This is the most common question, and the answer is **data, not code**.

The report button on a page (`registerReport` + `getButton()`) opens a picker that lists **only**
records whose `screenPaths` contains an entry matching the current route **exactly**:

```json
"screenPaths": [{ "path": "/travel-view", "type": "SIDEBAR" }]
```

- `path` is the route's `getRoutePath()` — with the leading `/`.
- `type` is the route type: `PAGE`, `MODAL`, `SIDEBAR`, `CART`.
- Both must match. A `SIDEBAR` entry will **not** show the report on the `PAGE` of the same entity.

To diagnose: get the target screen's real path and type from `listRoutes()` (skill
`test-plugin-browser`) and compare them character by character with `screenPaths`. A trailing slash
or the wrong `type` is enough to make the report invisible, with no error anywhere.

If the target screen has **no** report button at all, that is code: the view must call
`this.extensionsManager.registerReport(this)` in its constructor and place
`this.extensionsManager.report!.getButton()` in its design. The view implements nothing else —
`openExternalUrl` already comes from `CoreView`.

---

## 🎛️ Step 3 — `filterParameters` (only used when `showFilterScreen: true`)

Each entry is `{ name, type, label?, entity?, formatter? }`. What the processor receives depends on
the type — and two of them do **not** map 1:1:

| `type` | What reaches the processor under which key |
| --- | --- |
| `TEXT` | `{name}` — the string |
| `DECIMAL` | `{name}` — a number |
| `DATE` | `{name}` — the date |
| `BOOLEAN` | `{name}` — boolean, defaults to `false` |
| `SINGLE_ENTITY` | `{name}` — **the entity's `id`**, not the object (`entity` names the target entity) |
| `LIST_ENTITY` | `{name}` — **array of ids**, `[]` when empty |
| `DATA_RANGE` | **two keys**: `{name}_min` and `{name}_max` |
| `DECIMAL_RANGE` | **two keys**: `{name}_min` and `{name}_max` |

> ⚠️ **`LIST_CHOICE` and `SINGLE_CHOICE` are accepted by the type but never mapped.** The filter
> modal's `onSave` handles every type in the table above and silently skips these two, so the
> processor receives **nothing** for them — no error, just a missing parameter. Confirmed in
> `report_filter_modal.ts`. Use `TEXT` or an entity type instead until this is fixed.

> ⚠️ **Range types produce two parameters, not one.** A `DATA_RANGE` named `periodo` arrives as
> `periodo_min` / `periodo_max`. SQL that binds `:periodo` will never match.

---

## 🗃️ Step 4 — `dataQueries`

Each entry is:

```json
{ "name": "vendas", "sql": "SELECT ...", "isList": true,
  "fields": [{ "name": "total", "type": "DECIMAL" }] }
```

- `name` — how the processor/template refers to this result set.
- `sql` — the query. Filter values arrive as named parameters (see Step 3 for the exact keys).
- `isList` — `true` for many rows, `false` for a single-row result.
- `fields` — the declared columns and their types (`TEXT`, `DECIMAL`, `DATE`, `BOOLEAN`,
  `SINGLE_ENTITY`). The edit screen can infer them from the query ("tryGetFields"), but confirm:
  a wrong type here mis-renders the value in the output.

A report may hold several `dataQueries` — one per section/table of the output.

---

## 🔌 Step 5 — Custom processor (the only code in this skill)

Only needed when no existing processor fits (the stock ones cover HTML/template rendering). A
processor is a plugin service that receives the report id plus the resolved filter values and
returns **a URL** to the produced output.

```typescript
export class <Name>ReportService extends glyvio_core.PluginServiceInterfaceReportProcessor {
  constructor() {
    super();
    glyvio_core.pluginService.registerService(
      glyvio_core.PluginServiceInterfaceReportProcessor.type, // 'REPORT_PROCESSOR'
      this,
    );
  }

  getPluginId(): string { return PLUGIN_ID; }
  getPluginName(): string { return PLUGIN_NAME; }
  getVersion(): string { return VERSION; }

  async processReport(args: {
    environmentId?: string;
    reportId: string;
    params: { [key: string]: unknown };
  }): Promise<string> {
    const report = await glyvio_entity.Report.findById(args.reportId);
    if (!report) {
      throw new glyvio_core.GlyvioError({ message: 'Report não encontrado' });
    }
    // ...produce the output and return its URL
    return '<url>';
  }
}
```

- The record's `processor` field must hold **this plugin's id**, or the run fails with
  `Processor not found: <id>`.
- The returned URL is handed straight to `openExternalUrl` — it must be openable as-is.
- `getContentTypeFromProcessFormat(outputFormat)` gives the right MIME for `PDF`/`XLSX`/`CSV`/`HTML`.

### Bridging to a Custom Page

To make a **Custom Page** appear in the app's native report picker, this is the seam: create a
Report Record whose `processor` is a custom service returning the page's URL. Only do this when the
user explicitly wants the page inside that picker — otherwise a plain button calling
`openCustomPage` is simpler and has no record to maintain.

> **Open**: the core's own `AiReportService` returns the literal placeholder `{{_BASE_URL_}}`, which
> the Flutter client expands at runtime. It appears exactly once in the whole codebase and is
> undocumented, so its exact expansion is unverified. If you need a processor that points at a
> Glyvio URL, confirm the expected form with the team rather than guessing.

---

## ✅ Checklist

- [ ] Confirmed this is a Report Record, not a Custom Page.
- [ ] `processor` holds the id of a plugin that actually registers a `REPORT_PROCESSOR` service.
- [ ] `screenPaths` entries match the target route's `path` **and** `type` exactly.
- [ ] The target screen actually registers the report button (`registerReport` + `getButton`).
- [ ] No filter uses `LIST_CHOICE` / `SINGLE_CHOICE` (silently dropped).
- [ ] SQL binds `{name}_min` / `{name}_max` for every range filter, not `{name}`.
- [ ] `dataQueries[].fields` types match what the SQL really returns.
- [ ] `outputFormat` and `outputName` agree (e.g. `HTML` → `.html`).
