---
name: create-after-interceptor
description: 'Generates a custom class extending SimpleAfterInterceptor to run post-save side effects (e.g., saving notifications, recording audit logs, notifying external services) after a database entity is successfully committed.'
---

# Agent Skill: Create After Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side post-save interceptor (`SimpleAfterInterceptor`) to run asynchronous side-effects after database entity save operations.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_after_interceptor",
  "description": "Generates a custom class extending SimpleAfterInterceptor to run post-save side effects (e.g., saving notifications, recording audit logs, notifying external services) after a database entity is successfully committed.",
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
        "description": "Unique identifier for this interceptor (e.g., tag_color_notification)"
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

1. **Target Entity Name** (e.g., `Tag`): The name of the model in `glyvio_entity.*` associated with the save hook.
2. **Listener Unique ID** (e.g., `tag_post_save_action`): A unique identifier for the decorated class metadata.
3. **Execution Priority** (e.g., `50`): Execution order weight relative to other after interceptors on the same entity.
4. **Trigger Conditions / Field Tracking**: Specific fields to watch (e.g., "watch the `color` field").
5. **Business Logic / Action**: The side-effect to perform (e.g., "create a system notification and save it" or "call external environment integrations").
6. **Error Handling Preferences**: Whether errors should be caught and suppressed (only if explicitly requested by the user). By default, let errors propagate.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `glyvio_core.SimpleAfterInterceptor`, NOT `import { SimpleAfterInterceptor } ...`
2. **Read-Only Values**: The value parameter is `Readonly<T & ModelModification>`. You CANNOT assign values to the intercepted entity inside `handleAfter`. Any attempt to mutate it is a compiler error.
3. **No Default Try-Catch (Error Propagation & Rollbacks)**: Do not wrap the code in a `try-catch` block unless the user explicitly requests error suppression or custom error handling. By default, let all errors bubble up (throw upwards) so the server can handle the failure and perform any necessary database transaction rollbacks.
4. **System Save Operations**: When inserting supplementary records (like notification entries or logs), use `glyvio_core.entityService.saveEntityWithoutPermission(entity)` so the write executes successfully regardless of the current user's entity permission scope.
5. **DB methods are synchronous on the server**: `Entity.findById()`, `QueryBuilder.findFirst()`, `findAll()`, and `entityService.saveInput()` are all **synchronous** in the server runtime. Never add `await` or wrap them in a `Strategy` just to perform these operations — call them directly.
6. **`Strategy` is only needed for deduplication or deferral**: Use `pushToQueue` + `executionFlagService` only when you need to debounce multiple rapid saves of the same entity (e.g., recalculating a total when many child rows are saved at once). For a simple side-effect that runs once per save, execute the logic directly in `handleAfter`.
7. **Use `@BeforeInterceptor` when modifying the entity's own fields**: If the goal is to set fields on the **same entity being saved** (e.g., copy coordinates from a related address into the entity), use a `@BeforeInterceptor` instead — `BeforeInterceptorValue<T>` is mutable, so the changes are included in the original single save. `AfterInterceptorValue<T>` is read-only; using it to update the entity requires an extra `saveInput` call and a second DB write, which is wasteful for same-entity mutations.
8. **Type Safety**: Implement exact typing on arguments using `glyvio_core.AfterInterceptorValue` and `glyvio_core.AfterInterceptorContext`.
9. **Execution Pipeline Order**: AfterInterceptors execute last, **after** both SyncInterceptors and BeforeInterceptors have executed, and the transaction has been committed. The full execution sequence is `SyncInterceptor` > `BeforeInterceptor` > `AfterInterceptor`.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Interceptor File

Create a new file `src/interceptors/<listener_id_snake_case>.ts` in the server project of the plugin, writing the implementation based on the blueprint below.

### Step 2: Register/Load the Interceptor

Ensure the interceptor file is imported in the plugin's server entrypoint (typically `src/index.ts` or `src/behavior_listeners/index.ts`) so that the decorator executes during initialization:

```typescript
import './interceptors/<listener_id_snake_case>';
```

### Step 3: Build & Validate

Compile the codebase using standard workspace scripts (such as `pnpm run build` or `pnpm tsc --noEmit`) to verify that the types resolve correctly.

> ⚠️ **Root `tsc --noEmit` False Positives for Server Code**
>
> The root `npx tsc --noEmit` compiles **all** files (app + server) together using the app-layer types from `plugin/app/@types/`, where `QueryBuilder.findFirst()`, `findAll()`, `findGrouped()`, and `Entity.findById()` are typed as `Promise<T>`. Server-side code in `plugin/server/src/` uses `plugin/server/@types/` at build time, where **all these methods are synchronous** (`T | undefined`, `T[]`, etc.).
>
> Errors like `Property 'X' does not exist on type 'Promise<...>'` in server files are **expected false positives** from root `tsc` — they are not real compilation errors. The actual server build (via `webpack` with `plugin/server/tsconfig.build.json`) resolves types correctly. Do not attempt to fix them by adding `await` or wrapping in a `Strategy`.

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
/**
 * Post-save interceptor reacting to changes on `<TargetEntityName>` instances.
 */
@glyvio_core.AfterInterceptor({
  entity: glyvio_entity.<TargetEntityName>,
  id: '<ListenerUniqueId>',
  priority: <PriorityValue_or_50>,
})
export class <InterceptorClassName> extends glyvio_core.SimpleAfterInterceptor<glyvio_entity.<TargetEntityName>> {

  handleAfter(
    value: glyvio_core.AfterInterceptorValue<glyvio_entity.<TargetEntityName>>,
    context: Readonly<glyvio_core.AfterInterceptorContext<glyvio_entity.<TargetEntityName>>>,
  ): void {
    // 💡 CHANGE DETECTION EXAMPLE:
    // const colorField = glyvio_structure.AllEntities.<targetEntityCamelCase>.<fieldName>;
    // if (!value.isModified(colorField)) {
    //   return; // Field didn't change
    // }
    // const oldValue = value.getOriginalValue(colorField);
    // const newValue = value.color;

    // 💡 BUSINESS LOGIC: SAVE A NOTIFICATION EXAMPLE:
    // const notification = new glyvio_entity.Notification();
    // notification.title = "Record Updated";
    // notification.description = `The field changed from "${oldValue}" to "${newValue}".`;
    // notification.viewed = false;
    // notification.userId = context.extras && typeof context.extras === 'object' && 'userId' in context.extras
    //   ? String((context.extras as any).userId)
    //   : 'system';
    //
    // glyvio_core.entityService.saveEntityWithoutPermission(notification);

    // 💡 BUSINESS LOGIC: CALL EXTERNAL SYSTEM EXAMPLE:
    // glyvio_core.environmentService.callEnvironmentActionRaw('env-name', 'action-name', { id: context.valueId });

    // 💡 OPTIONAL ERROR HANDLING (TRY-CATCH):
    // Only wrap logic in a try-catch block if the user explicitly requested error suppression.
    // Otherwise, let errors bubble up so the server handles the rollback.
    // try {
    //   // Code that might fail
    // } catch (error) {
    //   glyvio_core.logger.error('Failed to execute after interceptor', error);
    // }
  }
}
```
