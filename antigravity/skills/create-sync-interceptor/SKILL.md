---
name: create-sync-interceptor
description: 'Generates a custom class extending SimpleSyncInterceptor to normalize, denormalize, or validate fields exclusively on data arriving via the Glyvio sync engine (third-party integrations such as ERPs). NOT a substitute for BeforeInterceptor — does not fire on regular user-facing saves.'
---

# Agent Skill: Create Sync Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side synchronization interceptor (`SimpleSyncInterceptor`).

> ⚠️ **This is an integration-only hook.** `SyncInterceptor` fires **exclusively** when a record arrives through the Glyvio **sync engine** — the pipeline used by third-party integrations (ERPs, external systems) to push data into the platform. It does **NOT** fire on regular user-facing saves (app UI, API calls, or any save triggered by `entityService`). If the requirement is to react to every save regardless of origin, use `BeforeInterceptor` instead.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_sync_interceptor",
  "description": "Generates a custom class extending SimpleSyncInterceptor to normalize, denormalize, or validate fields on data arriving via the Glyvio sync engine (third-party integrations such as ERPs). Fires ONLY on the sync pipeline — not on regular user-facing saves. Use BeforeInterceptor for logic that must run on every save regardless of origin.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName": {
        "type": "string",
        "description": "The name of the target entity to intercept (e.g., Tag, AppUser, Product)"
      },
      "listenerId": {
        "type": "string",
        "description": "Unique identifier for this interceptor (e.g., tag_fields_sync)"
      },
      "priority": {
        "type": "integer",
        "description": "Execution priority order (lower runs first, defaults to 50)"
      }
    },
    "required": ["entityName", "listenerId"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Entity Name** (e.g., `Sale`): The name of the model in `glyvio_entity.*` whose sync pipeline this interceptor should hook into.
2. **Listener Unique ID** (e.g., `sale_erp_normalization`): A unique identifier for the decorated class metadata.
3. **Execution Priority** (e.g., `50`): Execution order weight relative to other sync interceptors on the same entity.
4. **Integration Source / Context**: Which external system (ERP, marketplace, etc.) sends the data through the sync engine, and what data shape is expected.
5. **Trigger Conditions / Field Tracking**: Specific fields to watch when they arrive from the integration (e.g., "normalize the `external_code` field from the ERP payload").
6. **Business Logic / Action**: The field normalization, denormalization, or validation to perform on the incoming integration data (e.g., "map `external_status` to the internal `status_id`").

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `glyvio_core.SimpleSyncInterceptor`, NOT `import { SimpleSyncInterceptor } ...`
2. **Integration-Only Trigger — Do NOT use as a BeforeInterceptor substitute**: `SyncInterceptor` is an **alternative flow**. It fires **exclusively** when a record is received through the Glyvio sync engine (third-party integration pipeline). It does **NOT** execute on regular saves triggered by the app UI, API requests, or `entityService` calls. If the logic must run on every save regardless of origin, use `@BeforeInterceptor` instead.
3. **Mutable Values**: The `value` parameter is `SyncInterceptorValue<T>` (which is `T & ModelModification`). You CAN modify fields on the intercepted entity inside `handleSync` to normalize or map incoming integration data.
4. **No Default Try-Catch (Error Propagation & Rollbacks)**: Do not wrap the code in a `try-catch` block unless the user explicitly requests error suppression. By default, let all errors bubble up (throw upwards) so the server can handle the failure and perform a database transaction rollback.
5. **System Save Operations**: When persisting supplementary records, use `glyvio_core.entityService.saveEntityWithoutPermission(entity)` so the write executes successfully regardless of the current user's permission scope.
6. **Type Safety**: Implement exact typing on arguments using `glyvio_core.SyncInterceptorValue` and `glyvio_core.SyncInterceptorContext`.
7. **Execution Pipeline Order**: `SyncInterceptor` is the **first hook** in the pipeline, running only on the sync path — **before** `BeforeInterceptor`. The full execution sequence is `SyncInterceptor` > `BeforeInterceptor` > `AfterInterceptor` > `[COMMIT]` > `AfterCommitInterceptor`.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Interceptor File

Create a new file `src/interceptors/<listener_id_snake_case>.ts` in the server project of the plugin, writing the implementation based on the blueprint below.

### Step 2: Register/Load the Interceptor

Add an `export *` line in `plugin/server/src/index.ts` so the decorator executes during initialization:

```typescript
export * from './interceptors/sync/<listener_id_snake_case>';
```

> Sync interceptors live under `interceptors/sync/`. All server modules are registered via `export *` in `src/index.ts`; there is no separate `behavior_listeners/` entrypoint.

### Step 3: Build & Validate

Compile the codebase using standard workspace scripts (such as `pnpm run build` or `pnpm tsc --noEmit`) to verify that the types resolve correctly.

> ⚠️ **Root `tsc --noEmit` False Positives for Server Code**
>
> The root `npx tsc --noEmit` compiles **all** files (app + server) together using the app-layer types from `plugin/app/@types/`, where `QueryBuilder.findFirst()`, `findAll()`, and `Entity.findById()` are typed as `Promise<T>`. Server-side code in `plugin/server/src/` uses `plugin/server/@types/` at build time, where **all these methods are synchronous** (`T | undefined`, `T[]`, etc.).
>
> Errors like `Property 'X' does not exist on type 'Promise<...>'` in server files are **expected false positives** from root `tsc` — they are not real compilation errors. The actual server build (via `webpack` with `plugin/server/tsconfig.build.json`) resolves types correctly. Do not attempt to fix them by adding `await`.

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
/**
 * Sync interceptor for `<TargetEntityName>` — fires ONLY on data arriving via the
 * Glyvio sync engine (third-party integration pipeline, e.g. ERP).
 * Does NOT execute on regular user-facing saves.
 */
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.<TargetEntityName>,
  id: '<ListenerUniqueId>',
  priority: <PriorityValue_or_50>,
})
export class <InterceptorClassName> extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.<TargetEntityName>> {

  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.<TargetEntityName>>,
    context: Readonly<glyvio_core.SyncInterceptorContext<glyvio_entity.<TargetEntityName>>>,
  ): void {
    // 💡 CHANGE DETECTION EXAMPLE:
    // const nameField = glyvio_structure.AllEntities.<targetEntityCamelCase>.<fieldName>;
    // if (!value.isModified(nameField)) {
    //   return; // Field didn't change
    // }
    // const oldValue = value.getOriginalValue(nameField);
    // const newValue = value.name;

    // 💡 SYNCHRONIZATION MUTATION EXAMPLE:
    // if (value.isModified(nameField) && value.name) {
    //   value.normalizedName = value.name.toUpperCase().trim();
    // }
  }
}
```

---

## ✅ Completion Checklist

- [ ] Interceptor file created at `src/interceptors/sync/<listener_id>.ts`.
- [ ] `export * from './interceptors/sync/<listener_id>'` added in `src/index.ts`.
- [ ] Listener ID is globally unique (checked against existing interceptors).
- [ ] No `await` added to synchronous server methods — see false-positive warning above.
- [ ] No try-catch unless explicitly requested by the user.
- [ ] Zero `any` or force-casts.
- [ ] Only used for sync-engine pipeline (ERP/marketplace/external systems) — NOT for regular user saves (use `@BeforeInterceptor` for those).
- [ ] Build passes (`pnpm run build:fast`).
