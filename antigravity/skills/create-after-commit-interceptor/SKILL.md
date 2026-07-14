---
name: create-after-commit-interceptor
description: 'Generates a custom class extending SimpleAfterCommitInterceptor to run post-commit side effects (e.g., sending e-mails, pushing webhooks, invalidating external caches, enqueuing background jobs) after a database entity transaction has been fully and durably committed.'
---

# Agent Skill: Create After-Commit Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side post-commit interceptor (`SimpleAfterCommitInterceptor`) to run side-effects that must only fire once the database transaction is durably committed.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_after_commit_interceptor",
  "description": "Generates a custom class extending SimpleAfterCommitInterceptor to run post-commit side effects (e.g., sending e-mails, pushing webhooks, invalidating external caches, enqueuing background jobs) after a database entity transaction has been fully and durably committed.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName": {
        "type": "string",
        "description": "The name of the target entity to intercept (e.g., Tag, Sale, Product)"
      },
      "listenerId": {
        "type": "string",
        "description": "Unique identifier for this interceptor within the plugin (e.g., sale_webhook_sender)"
      },
      "priority": {
        "type": "integer",
        "description": "Execution priority order (lower runs first, defaults to 50)"
      },
      "suppressErrors": {
        "type": "boolean",
        "description": "If true, wraps the interceptor execution in a try-catch block to suppress errors. Defaults to false."
      }
    },
    "required": ["entityName", "listenerId"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Entity Name** (e.g., `Sale`): The name of the model in `glyvio_entity.*` associated with the post-commit hook.
2. **Listener Unique ID** (e.g., `sale_webhook_sender`): A plugin-wide unique identifier for the decorated class metadata. Combined with the entity's structure name internally to form the registry key.
3. **Execution Priority** (e.g., `50`): Execution order weight relative to other after-commit interceptors on the same entity. Lower numbers execute first; ties are broken alphabetically by `id`. Defaults to `50`.
4. **Trigger Conditions / Field Tracking**: Specific fields to watch (e.g., "only fire when the `status` field changes") or whether to fire on every save.
5. **Insert vs. Update Detection**: Whether the logic should distinguish between first-time inserts (`context.savedValue === undefined`) and subsequent updates.
6. **Business Logic / Action**: The side-effect to perform once the commit is confirmed (e.g., "send a webhook to an external URL", "call an environment action", "save a notification").
7. **Error Handling Preferences**: Whether errors should be caught and suppressed (`suppressErrors: true`). **Default: let errors propagate** — note that unlike `AfterInterceptor`, throwing inside `handleAfterCommit` will **not** roll back the already-committed transaction.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.

   - _Correct:_ `glyvio_core.SimpleAfterCommitInterceptor`
   - _Wrong:_ `import { SimpleAfterCommitInterceptor } from '...'`

2. **Read-Only Values — No Entity Mutation**: The `value` parameter is `AfterCommitInterceptorValue<T>`, which is `Readonly<T & ModelModification>`. You **CANNOT** assign to any field on the intercepted entity inside `handleAfterCommit`. Any attempt to mutate it is a compile-time error.

3. **No Rollback Possible**: `AfterCommitInterceptor` runs **outside** the database transaction boundary — the commit is already durable. Throwing an exception here will **not** undo the entity save. This is the key difference from `AfterInterceptor` (which runs within the transaction).

4. **No Default Try-Catch**: Do not wrap the code in a `try-catch` block unless the user explicitly requests error suppression (`suppressErrors: true`). By default, let exceptions propagate so the engine can log and surface them properly.

5. **System Save Operations**: When inserting supplementary records (e.g., notification entries, audit logs), use `glyvio_core.entityService.saveEntityWithoutPermission(entity)` so the write succeeds regardless of the current user's permission scope.

6. **Type Safety — Zero `any`**: Use exact types: `glyvio_core.AfterCommitInterceptorValue<glyvio_entity.<EntityName>>` and `glyvio_core.AfterCommitInterceptorContext<glyvio_entity.<EntityName>>`. Never use `any` or force-casts.

7. **Execution Pipeline Position**: `AfterCommitInterceptor` fires **after** the entire pipeline and after the transaction has been committed. Full sequence:

   ```
   SyncInterceptor → BeforeInterceptor → AfterInterceptor → [COMMIT] → AfterCommitInterceptor
   ```

8. **Insert vs. Update**: Use `context.savedValue === undefined` to detect a first-time insert. `context.savedValue` holds the entity's state **before** the current save; it is `undefined` when the entity did not previously exist in the database.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Interceptor File

Create a new file `src/interceptors/<listener_id_snake_case>.ts` in the server project of the plugin, writing the implementation based on the blueprint below.

### Step 2: Register/Load the Interceptor

Add an `export *` line in `plugin/server/src/index.ts` so the decorator executes during initialization:

```typescript
export * from './interceptors/<category>/<listener_id_snake_case>';
```

> All server modules (interceptors, controllers, strategies) are registered via `export *` in `src/index.ts`; there is no separate `behavior_listeners/` entrypoint.

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
 * After-commit interceptor reacting to committed saves of `<TargetEntityName>` instances.
 * Runs OUTSIDE the transaction boundary — mutations to `value` are NOT allowed.
 * Exceptions thrown here will NOT roll back the already-committed save.
 */
@glyvio_core.AfterCommitInterceptor({
  entity: glyvio_entity.<TargetEntityName>,
  id: '<ListenerUniqueId>',
  priority: <PriorityValue_or_50>,
})
export class <InterceptorClassName> extends glyvio_core.SimpleAfterCommitInterceptor<glyvio_entity.<TargetEntityName>> {

  handleAfterCommit(
    value: glyvio_core.AfterCommitInterceptorValue<glyvio_entity.<TargetEntityName>>,
    context: Readonly<glyvio_core.AfterCommitInterceptorContext<glyvio_entity.<TargetEntityName>>>,
  ): void {

    // 💡 INSERT vs. UPDATE DETECTION:
    // const isNew = context.savedValue === undefined;
    // const action = isNew ? 'created' : 'updated';
    // console.log(`<TargetEntityName> was ${action} (id: ${context.valueId})`);

    // 💡 CHANGE DETECTION EXAMPLE (using ModelModification helpers):
    // const statusField = glyvio_structure.AllEntities.<targetEntityCamelCase>.<fieldName>;
    // if (!value.isModified(statusField)) {
    //   return; // Field didn't change — nothing to do
    // }
    // const oldStatus = value.getOriginalValue(statusField);
    // const newStatus = value.<fieldName>;

    // 💡 CALL EXTERNAL SYSTEM / WEBHOOK EXAMPLE:
    // glyvio_core.environmentService.callEnvironmentActionRaw(
    //   'env-name',
    //   'action-name',
    //   { id: context.valueId, action },
    // );

    // 💡 SAVE A SUPPLEMENTARY RECORD (e.g., notification or audit log) EXAMPLE:
    // const notification = new glyvio_entity.Notification();
    // notification.title = '<TargetEntityName> Updated';
    // notification.description = `Record ${context.valueId} was ${action}.`;
    // notification.viewed = false;
    // notification.userId =
    //   context.extras && typeof context.extras === 'object' && 'userId' in context.extras
    //     ? String((context.extras as Record<string, unknown>).userId)
    //     : 'system';
    // glyvio_core.entityService.saveEntityWithoutPermission(notification);

    // 💡 OPTIONAL ERROR SUPPRESSION (only when suppressErrors: true was requested):
    // try {
    //   // side-effect code
    // } catch (error) {
    //   console.error('[<InterceptorClassName>] Side-effect failed:', error);
    //   // Note: the entity save is already committed — no rollback occurs here.
    // }
  }
}
```

---

## ⚠️ After-Commit vs. After Interceptor — When to Use Each

| Criterion                  | `AfterInterceptor`                                   | `AfterCommitInterceptor`                             |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Runs within transaction?   | ✅ Yes                                               | ❌ No — runs after commit                            |
| Exception rolls back save? | ✅ Yes                                               | ❌ No — commit is already durable                    |
| Can mutate `value`?        | ❌ No (read-only)                                    | ❌ No (read-only)                                    |
| Ideal for…                 | Audit logs, related-record saves that must be atomic | Webhooks, e-mails, cache invalidation, external APIs |

Use `AfterCommitInterceptor` when:

- The side-effect must only fire once persistence is **guaranteed** (e.g., sending an e-mail — you don't want to send it if the `AfterInterceptor` throws and the transaction rolls back).
- The side-effect calls an external system that cannot be rolled back.
- A failure in the side-effect should **not** undo the entity save.

---

## ✅ Completion Checklist

- [ ] Interceptor file created at `src/interceptors/<category>/<listener_id>.ts`.
- [ ] `export * from './interceptors/<category>/<listener_id>'` added in `src/index.ts`.
- [ ] Listener ID is globally unique (checked against existing interceptors).
- [ ] `value` is treated as read-only — no field mutations attempted (compile error if violated).
- [ ] No assumption of rollback on throw — commit is already durable when `handleAfterCommit` runs.
- [ ] No try-catch unless explicitly requested (`suppressErrors: true`).
- [ ] Zero `any` or force-casts.
- [ ] Build passes (`pnpm run build:fast`).
