---
name: audit-sync-task-query
description: 'Audits a glyvio-plugin-sync task''s baseQuery (raw SQL against an external dataSource, e.g. an ERP) against the target glyvio_entity structure it binds to — reports structure fields the SQL leaves unfilled, wrong/missing rounding on Decimal columns, incorrect boolean/date/relation parsing, and other column-level mismatches. Read-only analysis — does not edit sync config or write code.'
---

# Agent Skill: Audit Sync Task Query Against Entity Structure

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to review a **single sync task's `baseQuery`** — the raw SQL a `glyvio-plugin-sync` task runs against a registered `dataSource` — and verify that every column it selects correctly and completely fills the target entity's structure.

> ⚠️ **Read-only, single task.** This skill never edits `sync.json`/`SyncConfigModel`, never edits `manifest.json`, and never writes application code. It takes one `entityName` + one SQL string (or a full task object containing both) and returns a findings report. It does not touch `dataSources`, other tasks, or `scheduledTasks`.
>
> **Not a substitute for `query-external-datasource` or `create-sync-interceptor`.** Those skills write code that *calls* the sync engine or *reacts* to it. This skill only audits the *SQL mapping itself*, before or after it's saved in the Sync admin UI.

---

## 🎯 Skill Metadata

```json
{
  "name": "audit_sync_task_query",
  "description": "Diffs a sync task's baseQuery SELECT list against the glyvio_structure interface for its entityName, and flags missing fields, suspect Decimal rounding, and incorrect boolean/date/relation parsing.",
  "Audience": "AI agents or developers with read access to a Glyvio plugin's plugin/*/@types/entity.d.ts, auditing a sync task defined in glyvio-plugin-sync's config.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName": {
        "type": "string",
        "description": "snake_case entity/structure name the query feeds (e.g. sale_item, product, sale) — matches a task's `entityName` field."
      },
      "baseQuery": {
        "type": "string",
        "description": "The raw SQL SELECT (may contain @PREDICATE@ and UNION/UNION ALL branches). Can also be supplied as a full task JSON object, from which entityName and baseQuery are extracted."
      }
    },
    "required": ["entityName", "baseQuery"]
  }
}
```

---

## 📥 Required Input Parameters

1. **`entityName`** (snake_case, e.g. `sale_item`, `product`, `payment_term`) — if the user pastes a full task object instead of loose SQL, read it from the `entityName` key rather than asking.
2. **`baseQuery`** — the SQL string. If pasted as part of a full task object, read it from the `baseQuery` key. Treat `@PREDICATE@` as an opaque, always-appended `AND` filter — never comment on it.
3. **Target plugin root** — if not obvious from context, ask which plugin's `@types/entity.d.ts` to load against (a query written for one plugin's ERP schema is meaningless against another plugin's entity version).

---

## 🚫 Environment Constraints & Rules

1. **Ground truth is `glyvio_structure`, not the `Model` class.** Every entity has two type shapes in `plugin/*/@types/entity.d.ts`:
   - `namespace glyvio_entity { export class <PascalCase> extends Model { get fooBar(): ...; ... } }` — camelCase runtime accessors, not what the SQL binds to.
   - `namespace glyvio_structure { export interface <snake_case> extends Model { foo_bar?: ...; } }` — the exact snake_case field set the sync engine writes into, via `fromStructure()`/`toStructure()`. **Always diff against this interface**, since its field names match SQL column aliases 1:1 (e.g. `total_value`, `parent_product_ic`, `belongs_to_kit`).
   - Locate it with: search `plugin/server/@types/entity.d.ts` (fallback `plugin/app/@types/entity.d.ts`, then `plugin/environment/@types/entity.d.ts`) for `namespace glyvio_structure`, then `export interface <entityName>  extends Model {`.
2. **`_id` vs `_ic` relation fields — only `_ic` is the sync contract, but only when both exist.** Most relations appear as a pair: `<rel>_id` (internal id, resolved server-side) and `<rel>_ic` (integration code, the value sync actually links by) — for a pair, never flag the missing `_id`, only `_ic`. But some fields end in `_id` with **no** sibling `_ic` in the structure (e.g. a self-referencing sequence/kit-parent field) — those are not relation pairs, they're ordinary scalar fields, and must be checked for presence like any other field. Before applying the "skip `_id`" rule, confirm the matching `_ic` actually exists in the structure interface.
3. **Base `Model` audit fields are usually framework-managed, except two.** `id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_ic`, `observers`, `tags`, `block_task_count`, `open_task_count` are not normally hand-filled by a sync task's SELECT — do not flag their absence. `integration_code` and `deleted` are the two exceptions: **every** task query in this codebase selects both explicitly (deleted as the literal string `'true'`/`'false'`), so their absence is always a real finding, not noise.
4. **This SQL dialect skews T-SQL (Senior ERP / SQL Server), but stay dialect-agnostic in advice.** Expect `(nolock)`, `FORMAT(CAST(x AS DATETIMEOFFSET), 'yyyy-MM-ddTHH:mm:ss.fffzzz')` for dates, and string literals `'true'`/`'false'` (not native booleans) for boolean columns — the destination is Postgres-backed but ships through this SQL, cast to strings the sync layer parses. Apply the same literal-string convention when suggesting fixes; don't suggest native `BIT`/`BOOLEAN` types.
5. **No fixed rounding table — infer precision from sibling columns, don't invent one.** Real tasks in this codebase are inconsistent (e.g. `round(x, 2)` for most `*_value` columns, `round(x, 5)` for most `quantity` columns, `round(x, 10)` for `unitary_value`/unit-price columns, `round(x, 3)` for `weight`, but some `*_perc` columns are left unrounded). If only the target query is available, flag any Decimal-typed column with **zero** cast/round as a possible precision-loss risk rather than asserting a "correct" number; if multiple sibling tasks are visible (a full `tasks` block was pasted), cite the majority convention for that column-name family and flag outliers against it.
6. **UNION/UNION ALL branches must select the same structure fields.** When a query has multiple branches (see `address`, `person_contact`, `sale_type_status` patterns), diff each branch's alias list against every other branch, not just against the structure — a branch silently missing a column the sibling branch has is a common real bug.

---

## 📋 Column-Class Checks Reference

| Structure field type | What to check in the SQL expression |
|---|---|
| `string?` scalar (`code`, `name`, `description`, ...) | Present; if source is numeric/typed, explicitly `cast(... as varchar(...))` — an un-cast numeric alias silently coerced by the driver is a finding. |
| `Decimal?` (`*_value`, `*_perc`, `quantity`, `weight`) | Wrapped in `round(<expr>, N)` (or an equivalent explicit cast) — a bare column/arithmetic expression with no rounding is a finding. Compare `N` against sibling columns per constraint 5. Also flag `cast(x as integer)` on a field whose structure type is `Decimal` (truncates fractional data — this is a correctness bug, not just a style nit). |
| `boolean?` | Must resolve to the literal string `'true'` or `'false'` via `case when ... then 'true' else 'false' end` (or equivalent). Flag if the raw source flag (`'S'/'N'`, `1/0`, `sitxxx = 'A'` unconverted) is aliased directly — the sync layer expects the literal string, not the source encoding. |
| `DateTime?` | Must go through `FORMAT(CAST(<col> AS DATETIMEOFFSET), 'yyyy-MM-ddTHH:mm:ss.fffzzz')`. Flag a raw date column with no `FORMAT`/`CAST`. Also flag missing sentinel-date guarding (`case when <col> > '1900-12-31'/'1901-01-01' then FORMAT(...) else null end`) — Senior ERP tables commonly default empty dates to `1900-01-01`/`1901-01-01`, and forwarding that literal to the entity is a recurring real bug in this codebase; a bare `FORMAT(CAST(<col> ...))` with no `case`/`>` guard is a finding whenever the column can plausibly be unset. |
| `<rel>_ic` (relation) | Cast to string (`cast(... as varchar)`); if the source FK uses a sentinel "unset" value (`0`, `''`), must null it out (`case when <col> = 0 then null else cast(<col> as varchar) end`) rather than emitting `'0'`/`''` as a fake integration code. |
| `integration_code` | Must be present, string, and stable/unique per row (composite concatenation like `numped + '-' + codemp + '-' + codfil` is the established pattern — fine). Flag only if absent, or if it's not obviously unique per row (e.g. reuses a non-unique source column alone when siblings in the row set clearly repeat it). |
| `deleted` | Must be present and literal `'true'`/`'false'`. Flag if absent, or if it's hardcoded to `'false'` in a task whose source table clearly has an active/inactive flag that should drive it (compare against how `deleted` is derived for the same source table elsewhere in the file, if visible). |

---

## 📋 Execution Steps

1. **Extract inputs.** If given a full task object, pull `entityName` and `baseQuery` from it; otherwise use the loose SQL + stated entity name.
2. **Load the structure.** Find `namespace glyvio_structure { export interface <entityName> extends Model { ... } }` in the plugin's `entity.d.ts`. If the entity isn't found, say so and stop — do not guess field names.
3. **Extract selected aliases.** Walk the outermost `SELECT` list(s) (one per `UNION`/`UNION ALL` branch) at paren-depth 0 relative to that `SELECT`; for each item, take the alias — either after `AS <alias>`, or the bare trailing identifier (`col alias` / `expr alias` with no `AS`) — normalized to lowercase snake_case. Ignore aliases that only exist inside a subquery feeding a join (they never reach the outer SELECT).
4. **Diff aliases vs. structure fields**, applying constraints 2–3 (skip `_id` only when a sibling `_ic` exists, skip framework audit fields except `integration_code`/`deleted`). Produce the MISSING list.
5. **Run the column-class checks** (table above) on every alias that *is* present, using the structure field's declared type (`Decimal`, `boolean`, `DateTime`, `string`, relation) to pick which check applies.
6. **Flag aliases with no matching structure field** ("EXTRA") — a query selecting a column the structure interface doesn't declare at all (not even under a different but similar name) either means the entity model hasn't caught up with a field the ERP side already anticipated, or it's a stale leftover column the sync engine silently drops. Either way it's worth surfacing, not silently ignoring — but don't guess which case it is; just report the alias and let the user judge.
7. **If multiple UNION branches**, additionally diff branch-vs-branch alias sets (constraint 6) and report any asymmetry.
8. **Report** using the template below. Do not edit any file — this skill only produces the report; the user applies fixes.

---

## 📄 Report Template

```markdown
### Audit: `<entityName>` sync task query

**Missing structure fields** (in `glyvio_structure.<entityName>`, not selected by the query):
| Field | Type | Note |
|---|---|---|
| <field> | <Decimal/boolean/...> | <why it likely matters, if evident from the field name/relation> |

**Suspect columns** (selected, but parsing/rounding looks off):
| Alias | Issue | Detail |
|---|---|---|
| <alias> | MISSING_ROUND / TRUNCATED / BOOLEAN_NOT_LITERAL / DATE_NOT_FORMATTED / NO_SENTINEL_GUARD / FK_ZERO_NOT_NULLED / OTHER | <one line: what's wrong + suggested fix expression> |

**Extra columns** (selected, but no matching field in `glyvio_structure.<entityName>` — likely ignored by the sync engine, or the entity model is missing this field):
| Alias | Note |
|---|---|
| <alias> | |

**UNION branch mismatches** (only if the query has multiple branches):
| Branch | Missing vs. sibling branch(es) |
|---|---|

**OK** — <N> fields matched with no issues.
```

Keep the report terse: a field/alias with no issue is not listed individually, only counted in the OK line. Only list rows that need the user's attention.

---

## ✅ Completion Checklist

- [ ] Diffed against `glyvio_structure.<entityName>`, not the camelCase `glyvio_entity.<PascalCase>` `Model` class.
- [ ] `_id` fields only skipped when a sibling `_ic` exists in the structure; a lone `_id` with no `_ic` counterpart (e.g. a self-referencing sequence field) was checked like any normal field.
- [ ] `id`/`created_at`/`updated_at`/`created_by`/`updated_by`/`deleted_ic`/`observers`/`tags`/`block_task_count`/`open_task_count` not flagged as missing; `integration_code`/`deleted` are always checked.
- [ ] Every `Decimal` column checked for rounding/truncation; every `boolean` for literal `'true'`/`'false'`; every `DateTime` for `FORMAT(CAST(... AS DATETIMEOFFSET), ...)` + sentinel-date guard; every `_ic` for string cast + zero/empty nulling.
- [ ] Rounding precision judged against sibling columns actually visible in the input, not an invented fixed table.
- [ ] All `UNION`/`UNION ALL` branches cross-checked against each other when present.
- [ ] Aliases with no matching structure field surfaced as EXTRA, not silently dropped.
- [ ] No file edited, no sync config authored — output is the report only.
