---
name: create-sync-extraction-action
description: 'Generates an Environment-layer @Action (extending glyvio_core.SimpleSyncAction) used for data synchronization / ingestion into Glyvio — glyvio-plugin-sync invokes it, on the schedule the user configures for the task, as an alternative to a plain baseQuery against a registered dataSource, when the source system has no generic sync connector (e.g. a Firebird database reached only from the customer''s local network). Returned rows are integrated by field name: a key present in a row (e.g. user_group_id) is written into the matching field of the target glyvio_structure entity; a key the row omits is simply left untouched. Not a SystemTool for Jeannie and not a SyncClient caller.'
---
<!-- Generated from src/skills/create-sync-extraction-action/SKILL.md by tools/generate.py. Edit the source, not this file. -->

# Agent Skill: Create Sync Extraction Action

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to write a new Environment-layer `@Action` whose purpose is **data synchronization / bulk data loading — ingesting external data into Glyvio**. It gets wired, from the Sync admin UI, as the **query engine of a `glyvio-plugin-sync` task**: an alternative to a plain SQL `baseQuery` run directly against a registered `dataSource`, for sources the sync engine's generic connectors can't reach on their own (e.g. a Firebird/on-prem database only visible from the plugin's `plugin/environment` runtime). Once wired, the sync engine calls it **on the schedule the user configures for that task** (a `scheduledTask`, e.g. hourly/nightly) to pull fresh data and integrate it into Glyvio — the action itself has no scheduling logic; it just answers "give me the rows for this run" each time it's invoked.

> ⚠️ **Not a `@SystemTool`.** `create-system-tool` exposes a routine to the AI Agent (Jeannie) for natural-language calls. This skill's action is called by the sync engine's own scheduler (Java side, `environmentActionService.runActionForList(actionName, body)`), never by Jeannie and never by app/server code directly.
>
> **Not `query-external-datasource`.** That skill writes code that *calls out* to `sync.SyncClient` to read an already-registered dataSource on demand. This skill is the reverse direction: the sync engine calls *into* this action to do the reading, because the source isn't one of the engine's generic connector types.
>
> **Integration is field-name-based, not a declared mapping.** There is no separate "which SQL column maps to which entity field" config for this action to author — the sync engine reads whatever keys a returned row has and writes each one into the target `glyvio_structure.<entityName>` field of the *same name*. E.g. if a row includes the key `user_group_id`, that value is integrated into the entity's `user_group_id` field; a field the row's keys don't mention is left alone (not nulled out). This is exactly why the row's keys must be spelled precisely like the target structure's fields — see the next point.
>
> **The embedded query still owes `audit-sync-task-query` a look.** Whatever query/filter logic the action's `query` field carries is functionally a `baseQuery` — its result columns must match the target `glyvio_structure.<entityName>` 1:1, with the same rounding/boolean/date/relation conventions. After writing the action, audit the actual SQL text with the `audit-sync-task-query` skill exactly as you would a plain sync task.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_sync_extraction_action",
  "description": "Generates a class extending glyvio_core.SimpleSyncAction, decorated with @glyvio_core.Action, that glyvio-plugin-sync invokes as a task's query engine instead of a plain baseQuery.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin's plugin/environment codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "actionId": {
        "type": "string",
        "description": "Unique dotted id for the action (e.g. lp.query_firebird, lp.query_webservice_orders)."
      },
      "className": {
        "type": "string",
        "description": "PascalCase class name for the action (e.g. QueryFirebirdAction)."
      },
      "sourceKind": {
        "type": "string",
        "description": "What kind of external system this action queries (e.g. 'Firebird database', 'REST webservice', 'SOAP endpoint') — shapes the request fields and the query/pagination translation."
      },
      "requestFields": {
        "type": "string",
        "description": "The source-specific fields the task's mapping must supply beyond limit/offset (e.g. host/user/pass/databasePath/query for a DB; url/headers/params for a webservice)."
      }
    },
    "required": ["actionId", "className", "sourceKind"]
  }
}
```

---

## 📥 Required Input Parameters

1. **Action id** (e.g. `lp.query_webservice_orders`) — the exact string the Sync admin UI's task mapping will reference. Snake/dotted, plugin-prefixed, never invented without confirming the plugin's existing id convention (check sibling actions, e.g. `lp.query_firebird`). To see every id already registered as a `SimpleSyncAction` in this plugin's environment runtime (avoid clashes, or to discover what already exists before writing a new one), call the core-provided `core.list_sync_actions` action — it's built into `glyvio_core` and needs no per-plugin setup.
2. **Class name** — PascalCase, e.g. `QueryWebserviceOrdersAction`.
3. **Source kind** — what the action reaches (a DB via a driver, an HTTP API, etc.) — determines the request's source-specific fields and how `limit`/`offset` get translated into that source's own pagination mechanism.
4. **Source-specific request fields** — connection/query parameters the task's mapping will supply as part of the untyped `body` the sync engine sends (e.g. `host`/`user`/`pass`/`databasePath`/`query` for a DB-backed action; `url`/`headers`/`queryParams` for a webservice-backed one).
5. **Target structure awareness** — which `glyvio_structure.<entityName>` the task feeding this action ultimately writes into, so the rows returned from `fetch` are known to need alignment with it (the actual column-level audit happens afterward via `audit-sync-task-query`), including which of its fields are relations that must be emitted as `<relation>_ic` (see constraint 10).

---

## 🚫 Environment Constraints & Rules

1. **No external imports for Glyvio globals**: reference `glyvio_core.*` directly (`glyvio_core.Action`, `glyvio_core.SimpleSyncAction`, `glyvio_core.GlyvioError`). Do **not** `import` them. Only import genuinely external npm packages (e.g. a DB driver).
2. **Extend `glyvio_core.SimpleSyncAction`, not `GenericActionOnEnvironment` directly.** `SimpleSyncAction<R, T>` is the sync-invoked specialization of `GenericActionOnEnvironment` (same relationship as `SimpleSyncInterceptor` to a plain interceptor): it fixes the response shape to `{ items: T[] }` and requires implementing a single `protected fetch(request: R | undefined): Promise<T[]>` instead of a raw `execute`. Reaching for `GenericActionOnEnvironment` directly for this use case means re-deriving a response envelope that already exists — don't.
3. **Request interfaces extend `glyvio_core.DataExtractionActionRequest`, never redefine `limit`/`offset` locally.** These are core-provided, ambient-global types (same namespace as `glyvio_core.SimpleSyncAction`) — reference them directly, do **not** `import` them. If a plugin's `@types` doesn't expose `SimpleSyncAction`/`DataExtractionActionRequest` yet, its core dependency is stale; ask the user to update it rather than working around it with a local interface or a plain `GenericActionOnEnvironment` subclass.
4. **No separate response interface needed.** `SimpleSyncAction`'s `T` type parameter (defaulting to `glyvio_structure.Model`) IS the row shape — there is nothing to declare beyond the request interface. Pass a concrete `glyvio_structure.<entityName>` as `T` only if the action is permanently bound to one entity; leave the default (`glyvio_structure.Model`) when one action instance can serve tasks targeting different entities (the common case, since the entity is chosen by the task's mapping in the Sync admin UI, not by the action).
5. **`limit`/`offset` are always optional and always the same two keys.** They are the only fields the sync engine (Java side) injects on top of the task's own mapping (`environmentActionService.runActionForList(actionName, body)` builds `body` from the task's static mapping plus these two, only when the task's predicate configures pagination). Never require them; never rename them; translate their *absence* into "no limit" / "no offset" for the target source, not a default page size.
6. **`fetch` returns the rows directly — never wrap them.** Do not return `{ items: [...] }` from `fetch`; `SimpleSyncAction.execute` builds that envelope. Returning an already-wrapped object here would double-nest under `items` and break the sync engine's parsing.
7. **Validate required source fields up front, throw `glyvio_core.GlyvioError`.** No default try/catch beyond wrapping the source SDK's own connection/query errors into `GlyvioError` with a descriptive message (see blueprint) — let everything else propagate.
8. **Row keys ARE the field mapping — get the spelling right.** The sync engine integrates a row by walking its keys and writing each one straight into the identically-named field of `glyvio_structure.<entityName>` (e.g. a row key `user_group_id` lands in that entity's `user_group_id` field); there's no separate column-to-field config to author. This action usually has no compile-time reference to that structure, so remind whoever authors the source-specific query/mapping to run `audit-sync-task-query` against the actual query text once it's known, exactly as they would for a plain `baseQuery`, to confirm the emitted keys are named correctly.
9. **`integration_code` is the row's own external key — always include it.** The sync engine uses this field's value to decide whether an incoming row is a *new* Glyvio record or an *update* to one it already integrated: it matches on `integration_code`, not on any internal `id`. Every row a sync-driving action returns must set `integration_code` to a value that's stable and unique per source record (a natural key from the source, or a composite string built from a few source columns) — a row missing it, or reusing a value another row also uses, either creates duplicates or silently overwrites the wrong record on the next run.
10. **Relations are normally resolved via `<relation>_ic`, matched against the related entity's own `integration_code` — `<relation>_id` is accepted but is the uncommon, deliberate exception.** To link a row to an already-integrated related record, emit a key named `<relation>_ic` (e.g. `user_group_ic`) whose value equals that related record's `integration_code` (e.g. the value previously synced into `user_group.integration_code`) — the sync engine resolves the internal `id` from that lookup itself. A row can instead emit `<relation>_id` directly, and the engine will honor it, but that only makes sense when whoever configured the task already knows the specific Glyvio-internal id and deliberately wants to force the link to it — the row-producing side of the system being synced from virtually never knows Glyvio's internal ids on its own, only the shared integration codes both sides agree on. Default to `_ic`; reach for `_id` only when that specific, known-id scenario applies. This is the same `_ic`-over-`_id` convention `audit-sync-task-query` checks for on plain `baseQuery` tasks — it applies identically here.
11. **Pagination translation is source-specific — do not copy Firebird's `ROWS x TO y` verbatim for a different source.** A DB-backed action embeds pagination into the query text itself (dialect-specific: `ROWS`, `LIMIT/OFFSET`, `OFFSET/FETCH`, ...); a webservice-backed action instead adds `limit`/`offset` (or the API's own paging param names) to the request URL/body. Pick the translation that matches `sourceKind`.
12. **No manifest registration needed for the action itself.** `@glyvio_core.Action({ id })` self-registers via the decorator, the same way `lp.query_firebird` does — there is no `permissions` entry to add (unlike `@SystemTool`, which requires one). The action becomes callable by the sync engine as soon as the class file is loaded (imported from the environment entrypoint, directly or via a barrel file).

---

## 📋 Execution Steps

1. **Confirm `glyvio_core.SimpleSyncAction`/`DataExtractionActionRequest` are available** (check the plugin's `@types`/`bundle.d.ts` for the plugin-core dependency it was generated from). These live in `glyvio-plugin-core`'s `plugin/environment/src/actions/simple_sync_action.ts` and `data_extraction_action.ts`, exported alongside `GenericActionOnEnvironment` — they are not authored per-plugin.
2. **Create `<action_id>_config.ts`** with the source-specific `Request extends glyvio_core.DataExtractionActionRequest` interface only, every field commented (purpose, required/optional, expected format — future readers, human or LLM, rely on this to configure the task mapping correctly). No response interface is needed.
3. **Create `<action_id>.ts`** with the action class per the blueprint below, extending `glyvio_core.SimpleSyncAction<RequestTypeName>` and implementing `fetch`.
4. **Wire the source connection** using whatever driver/HTTP client `sourceKind` calls for; translate `limit`/`offset` per constraint 11, and make sure every row carries `integration_code` (constraint 9) and any relations as `<relation>_ic` (constraint 10).
5. **Import the file** from the environment entrypoint (or an `actions/index.ts` barrel it imports) so the `@Action` decorator runs at init — mirror however `query_firebird.ts` is currently loaded.
6. **Build check**: compile the environment subproject (`pnpm run build:fast` or `pnpm tsc --noEmit`).
7. **Hand off the query/mapping for structural audit.** Once the actual query text (and its target `entityName`) is known — typically decided when the task is configured in the Sync admin UI — run `audit-sync-task-query` against it like any other `baseQuery`.

---

## 📄 Code Blueprint (Template)

**`<action_id>_config.ts`**

```typescript
export interface <RequestTypeName> extends glyvio_core.DataExtractionActionRequest {
  /** <Connection/query field the task's mapping must supply — describe format and whether required.> */
  <sourceField>: <type>;
}
```

**`<action_id>.ts`**

```typescript
import { <RequestTypeName> } from './<action_id>_config';

/**
 * Query engine for glyvio-plugin-sync tasks reading from <sourceKind>. Called
 * from the Java side via
 * `environmentActionService.runActionForList('<actionId>', body)`; `body`
 * supplies the fields of `<RequestTypeName>`, with `limit`/`offset` injected
 * by the engine on top of the task's own mapping when pagination is
 * configured.
 *
 * Extends `glyvio_core.SimpleSyncAction`, which builds the `{ items }`
 * response envelope itself — this class only implements `fetch`.
 */
@glyvio_core.Action({
  id: '<actionId>',
})
export class <ClassName> extends glyvio_core.SimpleSyncAction<<RequestTypeName>> {
  protected async fetch(request: <RequestTypeName> | undefined): Promise<glyvio_structure.Model[]> {
    if (!request?.<requiredField>) {
      throw new glyvio_core.GlyvioError({
        message: '<requiredField> is required',
      });
    }

    // 💡 Translate request.limit / request.offset into this source's own
    // pagination mechanism (embedded in the query for a DB source, request
    // params for a webservice source). Both may be undefined — that means
    // "no limit" / "no offset", not a default page.

    // 💡 IMPLEMENT SOURCE ACCESS HERE. Every row must include:
    //   - integration_code: a stable, unique-per-record key from the source
    //     (natural key, or a composite string) — decides new-vs-update on the
    //     Glyvio side.
    //   - <relation>_ic for each relation (e.g. user_group_ic), set to the
    //     related record's own integration_code. Only use <relation>_id
    //     instead if the task deliberately targets a known Glyvio-internal id.
    // Wrap connection/query failures:
    // throw new glyvio_core.GlyvioError({ message: `<sourceKind> query failed: ${err.message}` });
    return [];
  }
}
```

---

## 📄 Example: REST/webservice-backed action

Same base class, same contract — only the request fields and the `fetch` implementation change. Add an HTTP client as a real dependency of `plugin/environment`'s `package.json` (e.g. `axios`, the same way `query_firebird.ts` adds `node-firebird`) rather than assuming one is already there.

**`query_webservice_orders_config.ts`**

```typescript
export interface QueryWebserviceOrdersActionRequest extends glyvio_core.DataExtractionActionRequest {
  /** Base REST endpoint to call, e.g. https://api.example.com/orders. */
  url: string;
  /** Sent as `Authorization: Bearer <apiKey>`. */
  apiKey: string;
}
```

**`query_webservice_orders.ts`**

```typescript
import axios from 'axios';

import { QueryWebserviceOrdersActionRequest } from './query_webservice_orders_config';

/**
 * Query engine for glyvio-plugin-sync tasks pulling orders from a REST
 * webservice. Called from the Java side via
 * `environmentActionService.runActionForList('lp.query_webservice_orders', body)`.
 * `limit`/`offset` are injected by the engine and translated here into the
 * API's own `limit`/`offset` query-string params (constraint 11) — a SOAP
 * endpoint would instead build a request envelope/XML body here and parse
 * the XML response into the same flat row shape.
 */
@glyvio_core.Action({
  id: 'lp.query_webservice_orders',
})
export class QueryWebserviceOrdersAction extends glyvio_core.SimpleSyncAction<QueryWebserviceOrdersActionRequest> {
  protected async fetch(request: QueryWebserviceOrdersActionRequest | undefined): Promise<glyvio_structure.Model[]> {
    if (!request?.url || !request?.apiKey) {
      throw new glyvio_core.GlyvioError({
        message: 'url and apiKey are required',
      });
    }

    try {
      const response = await axios.get(request.url, {
        headers: { Authorization: `Bearer ${request.apiKey}` },
        params: {
          limit: request.limit,
          offset: request.offset,
        },
      });

      const orders = (response.data.orders ?? []) as Record<string, unknown>[];
      return orders.map((order) => ({
        // integration_code (constraint 9): the source's own order code, stable/unique per row.
        integration_code: `${order.orderCode}`,
        // client_ic (constraint 10): the related client's own integration_code, not client_id.
        client_ic: `${order.clientCode}`,
        total_value: order.total,
        created_at: order.createdAt,
      }));
    } catch (err) {
      throw new glyvio_core.GlyvioError({
        message: `REST webservice query failed: ${(err as Error).message}`,
      });
    }
  }
}
```

---

## ✅ Completion Checklist

- [ ] Action class extends `glyvio_core.SimpleSyncAction<RequestTypeName>`, not `glyvio_core.GenericActionOnEnvironment` directly.
- [ ] Request extends `glyvio_core.DataExtractionActionRequest` — referenced from the core namespace, never redefined locally. No separate response interface declared.
- [ ] Every source-specific request field JSDoc-commented (purpose, required/optional, format).
- [ ] `fetch` is `protected`, returns `T[]` (rows) directly — never `{ items: [...] }`.
- [ ] Required fields validated up front inside `fetch`; missing ones throw `glyvio_core.GlyvioError`.
- [ ] Every row includes `integration_code` (constraint 9), stable and unique per source record.
- [ ] Every relation is emitted as `<relation>_ic` matching the related entity's own `integration_code` (constraint 10) — `<relation>_id` used only for the deliberate known-id exception, not as the default.
- [ ] `limit`/`offset` handled as optional and translated into the source's native pagination mechanism, matching `sourceKind` (constraint 11) — absence means "unbounded", not a default page size.
- [ ] Source connection/query errors wrapped in `glyvio_core.GlyvioError` with a descriptive message; no other try/catch added.
- [ ] Action file imported from the environment entrypoint (or a barrel it imports) so the `@Action` decorator registers at init.
- [ ] No manifest permission entry added for the action itself (only `@SystemTool`s need one).
- [ ] Build passes (`pnpm run build:fast` / `pnpm tsc --noEmit`).
- [ ] Once the real query/mapping is configured, its column output audited against `glyvio_structure.<entityName>` via `audit-sync-task-query`.
