---
name: create-import-wizard
description: "Generates a guided spreadsheet import (CSV/XLS/XLSX) for an entity as a step-by-step wizard modal (SimpleWizardModal): pick the file, map columns to fields, review problems, then import in batches with a progress dialog."
---
<!-- Generated from src/skills/create-import-wizard/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Guided Import Wizard in Glyvio

> **Padrão visual moderno:** monte o conteúdo com `glyvio_core.ui` e `SurfaceDesign`/`StackLayoutDesign`/`GridLayoutDesign`
> (guia `antigravity/rules/references/modern_layout.md`): cuidado com a ordem do `padding` (CSS nos modernos, LTRB nos antigos), spans
> responsivos no grid, cor por nome + `variant`, textos com chave ICU (`antigravity/rules/references/i18n.md`) e prints em 1440×900 e 390×844.

This skill generates a modal that imports a spreadsheet into an entity, guided in steps, on top of
`glyvio_core.SimpleWizardModal` (the core's step-by-step modal: stepper on top, Cancelar/Voltar ·
Avançar/Concluir in the footer, validation before moving forward).

---

## 🎯 Skill Metadata

- **Name**: `create_import_wizard`
- **Description**: Guided spreadsheet import (file → column mapping → review → import in batches) for one entity.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

1. **Entity Name** (e.g., `Client`): the `glyvio_entity.*` model the rows become.
2. **Plugin Namespace** (e.g., `my_plugin`).
3. **Route Path** (e.g., `/client-import`).
4. **Importable fields** — for each: the entity property, a label, whether it is required, and the
   header names it usually comes with (used to pre-map the columns, e.g. `['nome', 'razao social']`).
5. **Match key (optional)** — a field that identifies an existing record (usually `code`). When mapped,
   rows whose value already exists UPDATE that record instead of creating a new one.
6. **Route Permission** (e.g., `glyvio_permissions.view_client_import_modal`) — declare it in the
   manifest if it does not exist yet.

---

## 🚫 Environment Constraints & Rules

1. **No imports for Glyvio globals** — use `glyvio_core.*`, `glyvio_entity.*`, `glyvio_structure.*` directly.
2. **No `any` / force casts.** Spreadsheet cells arrive as `unknown`; convert with `String(...)`.
3. **Do not override `getDesign`** on a `SimpleWizardModal` — the base assembles the stepper, the
   step body and the footer. Put the app bar and width in `getWizardDesign`.
4. **The wizard's buttons are internal actions** (`_WIZARD_NEXT`, `_WIZARD_BACK`, …): do not handle
   them in `events`. Validation goes in `validateStep` (throw `glyvio_core.GlyvioError` to stay on
   the step), per-step loading in `onEnterStep`, and the import in `finish`.
5. **Reading the file**: `readSpreadsheet` parses CSV/XLS/XLSX natively and delivers typed rows to
   `fileOnSpreadsheetLoaded` (first row = headers). It needs `this.extensionsManager.registerFile(this)`
   in the constructor and `implements glyvio_core.FileExtensionDelegate<S>`. (`FileDropAreaDesign` /
   `readFiles` deliver raw TEXT or base64 — use them for OFX/CSV-as-text or other formats you parse
   yourself, not for XLSX.)
6. **Progress of a long import**: loop in batches inside `finish` and call
   `this.showProgress(state, { title, subtitle, progress })` between batches (`progress` is `0..1`),
   then `this.hideProgress(state)` in a `finally`. The dialog updates while the action runs.
   Do NOT chain batches with `enqueueAction`: the queue is fired before the current response is
   applied, so the next batch would run against the old state.
7. **New records need `userGroupId`**: set it from `this.getDefaultUserGroupId()` (or the owner's
   group) before saving. Never save an unscoped record.
8. **Very large files** (tens of thousands of rows, or heavy server rules per row) should run on the
   server as a queued operation (`schedule-queued-operation` skill) instead of batches from the app —
   the wizard's review step still applies; `finish` then only enqueues the job.
9. **Interpolation**: `$S{}` text, `$N{}` numbers/Decimal, `$D{}` DateTime only, `$T{}` translations.

---

## 📋 Execution Steps

1. Create `src/views/modals/imports/<entity_snake_case>_import_modal.ts` from the blueprint.
2. Export it from the plugin's `plugin/app/src/index.ts` (`export * from './views/modals/imports/...'`)
   **and** add the route class to the routes list — a route without the export does not open.
3. Open it from a list page button: `await this.pushModal(new <EntityName>ImportModalRoute({ popActionKey: 'imported' }))`,
   and refresh the list on `'imported'`.
4. Build (`pnpm pretty && pnpm lint && pnpm build`) and validate live with `test-plugin-browser`:
   screenshot each step (file picked, mapping, review with a problem, after import).

---

## 📄 Code Blueprint (Template)

Replace `<EntityName>`, `<entityNameCamelCase>`, `<PluginNamespace>`, `<RoutePath>`, the permission and
the `IMPORT_FIELDS` list.

```typescript
/** One importable field: where the cell goes, and how to check it. */
interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  /** Header names that pre-map to this field (compared without accents/case). */
  aliases?: string[];
  /** Returns an error message for a bad value, or undefined. */
  validate?: (value: string) => string | undefined;
  /** Writes the (non-empty, trimmed) cell into the record. */
  apply: (item: glyvio_entity.<EntityName>, value: string) => void;
}

/** The field used to find an existing record (update instead of create); undefined: always create. */
const MATCH_FIELD = 'code';
const BATCH_SIZE = 50;

const IMPORT_FIELDS: ImportField[] = [
  { key: 'code', label: 'Código', aliases: ['codigo', 'cod'], apply: (e, v) => (e.code = v) },
  { key: 'name', label: 'Nome', required: true, aliases: ['nome', 'descricao'], apply: (e, v) => (e.name = v) },
];

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export interface ImportIssue {
  /** Line in the spreadsheet (the header is line 1). */
  line: number;
  message: string;
}

export interface <EntityName>ImportModalRouteParams extends glyvio_core.SimpleEditModalRouteParams {}

export interface <EntityName>ImportModalState extends glyvio_core.SimpleWizardModalState<<EntityName>ImportModalRouteParams> {
  fileName?: string;
  headers?: string[];
  rows?: string[][];
  /** Field key -> index of the spreadsheet column (as a string, the value of the dropdown). */
  mapping?: Record<string, string | undefined>;
  issues?: ImportIssue[];
  /** Lines (1-based, header = 1) that passed the review. */
  validLines?: number[];
  result?: { created: number; updated: number; failed: number };
}

export class <EntityName>ImportModalRoute extends glyvio_core.SimpleEditModalRoute<<EntityName>ImportModalRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>';
  }
  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }
  getRouteNameObject(): string {
    return '<EntityName>ImportModal';
  }
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entity_snake_case>_import_modal;
  }
}

export class <EntityName>ImportModal
  extends glyvio_core.SimpleWizardModal<<EntityName>ImportModalState>
  implements glyvio_core.FileExtensionDelegate<<EntityName>ImportModalState>
{
  constructor() {
    super(<EntityName>ImportModalRoute);
    this.extensionsManager.registerFile(this);
  }

  async initState(state: <EntityName>ImportModalState): Promise<void> {
    await super.initState(state);
    state.mapping ??= {};
    state.issues ??= [];
  }

  // ── steps ────────────────────────────────────────────────────────────────

  getSteps(state: <EntityName>ImportModalState): glyvio_core.WizardStep[] {
    const mapped = IMPORT_FIELDS.filter((f) => state.mapping?.[f.key] != undefined).length;
    return [
      { key: 'file', title: 'Arquivo', subtitle: state.fileName },
      { key: 'mapping', title: 'Colunas', subtitle: state.headers ? `${mapped} de ${IMPORT_FIELDS.length} campos` : undefined },
      { key: 'review', title: 'Revisão', status: state.issues?.length ? 'ERROR' : undefined },
    ];
  }

  getLabels(state: <EntityName>ImportModalState, step: string): glyvio_core.WizardLabels {
    if (step == 'review') {
      return { finish: `Importar ${state.validLines?.length ?? 0} linhas` };
    }
    return {};
  }

  getWizardDesign(_state: <EntityName>ImportModalState, design: glyvio_core.SimpleEditModalDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({ key: 'appBar', title: 'Importar planilha' });
    design.maxWidth = 900;
  }

  getStepSections(state: <EntityName>ImportModalState, step: string): glyvio_core.SectionDesign[] {
    if (step == 'mapping') return [this.mappingSection(state)];
    if (step == 'review') return [this.reviewSection(state)];
    return [this.fileSection(state)];
  }

  async validateStep(state: <EntityName>ImportModalState, step: string): Promise<void> {
    if (step == 'file' && !state.rows?.length) {
      throw new glyvio_core.GlyvioError({ message: 'Escolha uma planilha com pelo menos uma linha de dados' });
    }
    if (step == 'mapping') {
      const missing = IMPORT_FIELDS.filter((f) => f.required && state.mapping?.[f.key] == undefined);
      if (missing.length) {
        throw new glyvio_core.GlyvioError({ message: `Escolha a coluna de: ${missing.map((f) => f.label).join(', ')}` });
      }
    }
    if (step == 'review' && !state.validLines?.length) {
      throw new glyvio_core.GlyvioError({ message: 'Nenhuma linha válida para importar' });
    }
  }

  async onEnterStep(state: <EntityName>ImportModalState, step: string): Promise<void> {
    if (step == 'review') {
      this.review(state);
    }
  }

  // ── file ─────────────────────────────────────────────────────────────────

  async events(_state: <EntityName>ImportModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key == 'pickFile') {
      await this.extensionsManager.file?.readSpreadsheet(this.callBackId);
      return 'STATE_FREEZED';
    }
    return undefined;
  }

  async fileOnSpreadsheetLoaded(state: <EntityName>ImportModalState, content: unknown[]): Promise<void> {
    const matrix = content.filter((r): r is unknown[] => Array.isArray(r));
    const cell = (v: unknown) => (v == null ? '' : String(v).trim());
    state.headers = (matrix[0] ?? []).map(cell);
    state.rows = matrix.slice(1).map((r) => r.map(cell)).filter((r) => r.some((c) => c.length > 0));
    state.fileName = `${state.rows.length} linhas · ${state.headers.length} colunas`;
    state.result = undefined;
    // Pre-map each field to the first header that matches its label or an alias.
    state.mapping = {};
    for (const f of IMPORT_FIELDS) {
      const names = [f.label, f.key, ...(f.aliases ?? [])].map(normalize);
      const i = state.headers.findIndex((h) => names.includes(normalize(h)));
      if (i >= 0) state.mapping[f.key] = String(i);
    }
  }

  fileSection(state: <EntityName>ImportModalState): glyvio_core.SectionDesign {
    const ui = glyvio_core.ui;
    return ui.page(
      [
        ui.banner({
          title: state.rows ? 'Planilha carregada' : 'Escolha a planilha',
          text: state.rows
            ? `${state.rows.length} linhas e ${state.headers?.length ?? 0} colunas. Escolha outra para trocar.`
            : 'CSV, XLS ou XLSX. A primeira linha precisa ter os nomes das colunas.',
          icon: 'sax_linear_document_upload',
          color: state.rows ? 'GREEN' : 'BLUE',
        }),
        ui.button(state.rows ? 'Escolher outra planilha' : 'Escolher planilha', new glyvio_core.Action({
          key: 'pickFile',
          keyLoadingComponent: this.callBackId,
        }), { icon: 'sax_linear_folder_open', kind: state.rows ? 'secondary' : 'primary' }),
      ],
      { key: 'import.file' },
    );
  }

  // ── mapping ──────────────────────────────────────────────────────────────

  mappingSection(state: <EntityName>ImportModalState): glyvio_core.SectionDesign {
    const ui = glyvio_core.ui;
    const options = (state.headers ?? []).map((h, i) =>
      glyvio_core.ChoiceSingleTextfieldOption.simple(String(i), h || `Coluna ${i + 1}`),
    );
    return ui.page(
      [
        ui.text('Para cada campo, escolha a coluna da planilha', 'TITLE_SMALL'),
        ui.grid(
          IMPORT_FIELDS.map((f): [glyvio_core.WidgetDesign, glyvio_core.UiSpan] => [
            new glyvio_core.ChoiceSingleTextfieldDesign({
              key: `mapping.${f.key}`,
              name: `state.mapping.${f.key}`,
              label: f.required ? `${f.label} *` : f.label,
              displayMode: 'DROPDOWN',
              allowClear: !f.required,
              options,
            }),
            [6, 6, 12],
          ]),
        ),
      ],
      { key: 'import.mapping' },
    );
  }

  // ── review ───────────────────────────────────────────────────────────────

  cellOf(state: <EntityName>ImportModalState, row: string[], field: ImportField): string {
    const col = state.mapping?.[field.key];
    return col == undefined ? '' : (row[Number(col)] ?? '').trim();
  }

  review(state: <EntityName>ImportModalState): void {
    const issues: ImportIssue[] = [];
    const valid: number[] = [];
    (state.rows ?? []).forEach((row, i) => {
      const line = i + 2;
      const problems = IMPORT_FIELDS.flatMap((f) => {
        const v = this.cellOf(state, row, f);
        if (!v) return f.required ? [`${f.label} vazio`] : [];
        const err = f.validate?.(v);
        return err ? [`${f.label}: ${err}`] : [];
      });
      if (problems.length) issues.push({ line, message: problems.join(' · ') });
      else valid.push(line);
    });
    state.issues = issues;
    state.validLines = valid;
  }

  reviewSection(state: <EntityName>ImportModalState): glyvio_core.SectionDesign {
    const ui = glyvio_core.ui;
    const total = state.rows?.length ?? 0;
    const blocks: glyvio_core.WidgetDesign[] = [
      ui.grid([
        [ui.stat({ label: 'Linhas', value: String(total), icon: 'sax_linear_document_text' }), [4, 4, 12]],
        [ui.stat({ label: 'Prontas', value: String(state.validLines?.length ?? 0), color: 'GREEN', icon: 'sax_linear_tick_circle' }), [4, 4, 12]],
        [ui.stat({ label: 'Com problema', value: String(state.issues?.length ?? 0), color: state.issues?.length ? 'RED' : 'GREY', icon: 'sax_linear_warning_2' }), [4, 4, 12]],
      ]),
    ];
    if (state.result) {
      const r = state.result;
      blocks.push(
        ui.banner({
          title: `Importação concluída com ${r.failed} falha(s)`,
          text: `${r.created} criados, ${r.updated} atualizados. As linhas com falha estão na lista abaixo.`,
          color: 'ORANGE',
          icon: 'sax_linear_info_circle',
        }),
      );
    }
    if (state.issues?.length) {
      blocks.push(ui.text('Linhas que não serão importadas', 'TITLE_SMALL'));
      blocks.push(
        ui.list(
          state.issues.slice(0, 100).map((p) => ui.listRow({ title: `Linha ${p.line}`, subtitle: p.message, icon: 'sax_linear_warning_2', color: 'RED' })),
        ),
      );
    }
    return ui.page(blocks, { key: 'import.review' });
  }

  // ── import ───────────────────────────────────────────────────────────────

  async finish(state: <EntityName>ImportModalState): Promise<glyvio_core.EventReturn> {
    const rows = state.rows ?? [];
    const lines = state.validLines ?? [];
    const result = { created: 0, updated: 0, failed: 0 };
    const failures: ImportIssue[] = [];
    const matchField = IMPORT_FIELDS.find((f) => f.key == MATCH_FIELD);
    const entity = glyvio_structure.AllEntities.<entityNameCamelCase>;

    try {
      for (let start = 0; start < lines.length; start += BATCH_SIZE) {
        const batch = lines.slice(start, start + BATCH_SIZE);
        await this.showProgress(state, {
          title: 'Importando',
          subtitle: `${start} de ${lines.length} linhas`,
          progress: start / lines.length,
        });

        // Existing records of this batch, by the match field.
        const existing = new Map<string, glyvio_entity.<EntityName>>();
        if (matchField && state.mapping?.[matchField.key] != undefined) {
          const keys = batch.map((l) => this.cellOf(state, rows[l - 2], matchField)).filter((k) => k);
          if (keys.length) {
            const found = await glyvio_entity.<EntityName>.getQueryBuilder()
              .setFromEntity(entity)
              .addFilterIN(entity.code, keys)
              .find();
            for (const item of found) if (item.code) existing.set(item.code, item);
          }
        }

        const items: glyvio_entity.<EntityName>[] = [];
        for (const line of batch) {
          const row = rows[line - 2];
          const key = matchField ? this.cellOf(state, row, matchField) : '';
          const item = existing.get(key) ?? (await glyvio_entity.<EntityName>.new({ user_group_id: this.getDefaultUserGroupId() }));
          for (const f of IMPORT_FIELDS) {
            const v = this.cellOf(state, row, f);
            if (v) f.apply(item, v);
          }
          items.push(item);
        }

        try {
          await glyvio_core.entityService.saveList(items);
          const updated = items.filter((i) => existing.has(i.code ?? '')).length;
          result.updated += updated;
          result.created += items.length - updated;
        } catch (e) {
          // One bad row fails its whole batch: report the batch's lines and go on with the next.
          result.failed += batch.length;
          const message = e instanceof glyvio_core.GlyvioError ? (e.message ?? 'Erro ao salvar') : 'Erro ao salvar';
          failures.push(...batch.map((line) => ({ line, message })));
        }
      }
    } finally {
      await this.hideProgress(state);
    }

    if (result.failed == 0) {
      await this.popModal(
        state.routeParams?.popActionKey ? new glyvio_core.Action({ key: state.routeParams.popActionKey, data: result }) : undefined,
      );
      await this.showToastSuccess(state, `${result.created} criados, ${result.updated} atualizados`);
      return 'STATE_FREEZED';
    }
    // Stay on the review with what failed, so the user can fix the file and try again.
    state.result = result;
    state.issues = [...(state.issues ?? []), ...failures].sort((a, b) => a.line - b.line);
    state.validLines = [];
    return 'STATE_UPDATE';
  }
}
```

---

## ✅ Checklist before calling it done

- [ ] The class is exported from `index.ts` and the route is registered (and the permission exists).
- [ ] `registerFile(this)` in the constructor and `implements glyvio_core.FileExtensionDelegate<S>`.
- [ ] `IMPORT_FIELDS` covers every required property of the entity (or `finish` sets it).
- [ ] New records get `userGroupId`.
- [ ] If there is a match field, it is also the one used in `addFilterIN(entity.<field>, keys)` and `existing.set(item.<field>)`.
- [ ] Live test: a file with a bad row shows it in the review; a clean file closes the modal with the toast.
