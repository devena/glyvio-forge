---
name: query-external-datasource
description: 'Writes code (server, app, or environment layer) that reads or triggers third-party data (ERPs, marketplaces, external systems) on demand through glyvio-plugin-sync''s `sync.SyncClient` — ad-hoc queries against an already-registered dataSource, forcing a sync task to run now, or excluding a record from future sync. Does NOT configure dataSources/tasks/scheduledTasks (done by the end user via the Sync admin UI) and does NOT react to inbound synced data (use create-sync-interceptor for that).'
---

# Agent Skill: Query External Datasource via Sync

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to write code that reaches a third-party database/API **on demand**, exclusively through `glyvio-plugin-sync`'s `SyncClient`.

> ⚠️ **`sync.SyncClient` is the only sanctioned path to a third-party system.** Never open a raw DB driver, HTTP client, or direct connection to an external ERP/marketplace/system from `@Action`, `@CustomTool`, `@SystemTool`, interceptor, or controller code, in any layer. The user registers the third-party connection once (as a `dataSource`) via the Sync admin UI; from then on, all plugin code reaches it only through `SyncClient`.
>
> **Not a substitute for `create-sync-interceptor`.** That skill is *reactive* — it fires automatically when the scheduled sync pipeline pulls a record in. This skill is for code that *actively* asks the sync engine to read or trigger something **right now** (e.g. a button, an `@Action`, a Jeannie `@CustomTool`).
>
> **Not a config-authoring skill.** `dataSources`, `tasks`, and `scheduledTasks` are configured by the end user through the Sync plugin's own admin page (`sync_config_edit_page.ts`). This skill never creates or edits that config — it only discovers existing names (via `getConfig()`) and writes code against them.

---

## 🎯 Skill Metadata

```json
{
  "name": "query_external_datasource",
  "description": "Writes code that calls sync.SyncClient to read or trigger a third-party datasource on demand (ad-hoc query, force-run a task, or ignore a record). Does not author sync config and does not handle inbound sync data.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin's plugin/server, plugin/app, or plugin/environment codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "accessPattern": {
        "type": "string",
        "enum": ["adHocQuery", "aiContextQuery", "forceSyncTask", "ignoreRecord", "readConfig"],
        "description": "Which SyncClient capability the task needs."
      },
      "dataSourceName": {
        "type": "string",
        "description": "Name of the already-registered dataSource to query against (required for adHocQuery/aiContextQuery)."
      },
      "taskName": {
        "type": "string",
        "description": "Name of the already-configured sync task to force-run (required for forceSyncTask)."
      }
    },
    "required": ["accessPattern"]
  }
}
```

---

## 📥 Required Input Parameters

1. **Access pattern** — which of the five `SyncClient` capabilities the task needs (see table below).
2. **`dataSourceName` / `taskName`** — the exact, already-registered name to target. **Never invent these.** If unknown, either ask the user or call `sync.SyncClient().getConfig()` first and read `dataSources` / `tasks` from the result.
3. **Call context** (`environmentId`, optional `secretId`) — every `SyncClient` method returns a thunk requiring `.call({ environmentId, secretId })`; source these from the current request/session context, the same way other cross-plugin service calls in this codebase do.
4. **Target layer** — `plugin/server`, `plugin/app`, or `plugin/environment`. `SyncClient` exposes the identical 9 methods in all three (it's a separately generated `service.ts` per layer), but `.call(...)` is **synchronous** in `plugin/server` and returns a **`Promise`** in `plugin/app`/`plugin/environment` (must `await`) — see constraint 2.
5. **Business logic** — what to do with the result (e.g. map external rows onto a local entity, decide when to force a resync, which record to exclude and why).

---

## 🚫 Environment Constraints & Rules

1. **Global namespace, no import**: the consuming plugin must declare a dependency on the sync plugin in its own `manifest.json`:
   ```json
   { "dependencies": [{ "pluginName": "sync", "version": "latest" }] }
   ```
   Once declared, `sync.SyncClient` (and its types) are available as an ambient global in `plugin/server/src/**`, `plugin/app/src/**`, and `plugin/environment/src/**` alike — same convention as `glyvio_core.*` / `glyvio_entity.*`. Do **not** `import` it.
2. **Available in all three layers, but sync vs. async**: `SyncClient` exposes the same 9 methods in `plugin/server`, `plugin/app`, and `plugin/environment`. In `plugin/server`, `.call(...)` returns the result directly (synchronous). In `plugin/app` and `plugin/environment`, `.call(...)` returns a `Promise` — you **must** `await` it. Do not add `await` on the server side (that would be a type error, mirroring the sync/async split documented for `QueryBuilder` in `create-sync-interceptor`) and do not forget it on the app/environment side.
3. **Raw SQL, external schema**: `queryList`/`queryFirst`/`jeannieQueryList`/`jeannieQueryFirst` run the given `query` string **against the third-party system's own schema** (via the registered `dataSource`), not against `glyvio_entity` models. Column names are whatever the external system uses — do not assume they match local entity fields.
4. **Config is read-only from here**: use `getConfig()` to discover valid `dataSourceName`/`taskName`/`entityName` values. Never generate or write `SyncConfigModel`/`SyncTaskConfigModel` entries — that is the end user's job in the Sync admin UI.
5. **No default try-catch**: let `SyncClient` call failures propagate. Throw `glyvio_core.GlyvioError` for business-relevant failures (e.g. "no rows returned from ERP for this code").
6. **Type Safety**: type the generic on `queryList<T>`/`queryFirst<T>`/`jeannieQueryList<T>`/`jeannieQueryFirst<T>` to the shape of the external row you expect — this is a plain data shape you define, not a `glyvio_entity` class.

---

## 📋 Access Patterns Reference

| Need | Method | Key args | Returns |
|------|--------|----------|---------|
| Ad-hoc read against an external DB | `queryList<T>` / `queryFirst<T>` | `{ query, dataSourceName }` | `{ result: T[] }` / `{ result: T \| undefined }` |
| Read scoped to an AI agent / Jeannie conversation | `jeannieQueryList<T>` / `jeannieQueryFirst<T>` | `{ query, appUserId, zoneInfo? }` | same shape as above |
| Force a configured task to run now (instead of waiting for its cron) | `callTask` | `{ taskName, predicate: { predicateGlyvio?, predicateDataSource? }, forced, extraAttributes? }` | `{ value, requestId }` |
| Exclude one record from all future sync runs | `putIgnoreId` / `putIgnoreIc` | `{ id, entityName }` / `{ ic, entityName }` | `{ value }` |
| Discover registered dataSources/tasks/scheduledTasks | `getConfig` | — | `{ value?: SyncConfigModel }` |
| Check whether the environment's initial full sync has completed | `isFirstLoadDone` | — | `{ value }` |

Every method returns `{ call: (args: { environmentId, secretId? }) => Result }`. In `plugin/server`, `Result` is the plain value; in `plugin/app`/`plugin/environment`, `Result` is `Promise<...>` — you must invoke (and, outside `plugin/server`, `await`) `.call(...)` to actually execute it.

---

## 📋 Execution Steps

1. **Resolve the target name.** If `dataSourceName`/`taskName` wasn't given, call `sync.SyncClient().getConfig().call({ environmentId })` and read `.value.dataSources` / `.value.tasks` to confirm the exact name — or ask the user.
2. **Declare the dependency.** Check the plugin's `manifest.json` for `{ "pluginName": "sync" }` under `dependencies`; add it if missing (this makes the `sync` global namespace available at compile time).
3. **Write the call site** in the layer where the trigger originates — an `@Action`/`@CustomTool`/controller in `plugin/server`, a `@SystemTool`/`@Action` in `plugin/environment`, or a UI handler in `plugin/app` — never inside a `@SyncInterceptor` (that's the inbound/reactive path, see `create-sync-interceptor`).
4. **Build check**: compile the affected subproject(s) (`pnpm run build:fast` or `pnpm tsc --noEmit`) to confirm types resolve, paying attention to the sync/async split from constraint 2.

---

## 📄 Code Blueprint (Template)

**`plugin/server`** — synchronous `.call(...)`:

```typescript
interface ExternalOrderRow {
  order_code: string;
  customer_document: string;
  total_amount: number;
}

const result = new sync.SyncClient()
  .queryList<ExternalOrderRow>({
    query: `SELECT order_code, customer_document, total_amount FROM orders WHERE updated_at > '<since>'`,
    dataSourceName: '<RegisteredDataSourceName>',
  })
  .call({ environmentId: context.environmentId });

if (!result?.result.length) {
  throw new glyvio_core.GlyvioError({ message: 'No rows returned from external datasource' });
}

// Force a specific task to run now instead of waiting for its schedule:
new sync.SyncClient()
  .callTask({
    taskName: '<RegisteredTaskName>',
    predicate: { predicateGlyvio: undefined, predicateDataSource: undefined },
    forced: true,
  })
  .call({ environmentId: context.environmentId });
```

**`plugin/app`** / **`plugin/environment`** — same API, but `.call(...)` returns a `Promise`:

```typescript
const result = await new sync.SyncClient()
  .queryList<ExternalOrderRow>({
    query: `SELECT order_code, customer_document, total_amount FROM orders WHERE updated_at > '<since>'`,
    dataSourceName: '<RegisteredDataSourceName>',
  })
  .call({ environmentId: context.environmentId });
```

---

## ✅ Completion Checklist

- [ ] `dataSourceName`/`taskName` confirmed against `getConfig()` or the user — never invented.
- [ ] `sync` declared as a dependency in `manifest.json` (`pluginName: "sync"`).
- [ ] Call site lives in the correct layer (`@Action`/`@CustomTool`/controller in server, `@SystemTool`/`@Action` in environment, UI handler in app), not in an interceptor.
- [ ] `await` used on `.call(...)` in `plugin/app`/`plugin/environment`, omitted in `plugin/server`.
- [ ] No config authored or edited (`dataSources`/`tasks`/`scheduledTasks` are the end user's responsibility).
- [ ] No try-catch unless explicitly requested; business failures throw `glyvio_core.GlyvioError`.
- [ ] Generic row types (`<T>`) reflect the external system's own schema, not a `glyvio_entity` model.
- [ ] Build passes (`pnpm run build:fast`) for every layer touched.
