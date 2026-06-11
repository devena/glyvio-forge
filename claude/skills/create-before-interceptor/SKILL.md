---
name: create-before-interceptor
description: 'Generates a custom class extending SimpleBeforeInterceptor to perform pre-save modifications, field injection, or validation constraints on a database entity.'
---

# Agent Skill: Create Before Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side pre-save interceptor (`SimpleBeforeInterceptor`) to perform field validation, mutation, default value injection, or abort transactions before database save operations.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_before_interceptor",
  "description": "Generates a custom class extending SimpleBeforeInterceptor to perform pre-save modifications, field injection, or validation constraints on a database entity.",
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
        "description": "Unique identifier for this interceptor (e.g., tag_defaults_validation)"
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

1. **Target Entity Name** (e.g., `Tag`): The name of the model in `glyvio_entity.*` associated with the pre-save hook.
2. **Listener Unique ID** (e.g., `tag_pre_save_validation`): A unique identifier for the decorated class metadata.
3. **Execution Priority** (e.g., `50`): Execution order weight relative to other before interceptors on the same entity.
4. **Trigger Conditions / Field Tracking**: Specific fields to watch (e.g., "watch the `name` field").
5. **Business Logic / Action**: The mutations or validation rules to execute (e.g., "ensure the name is lowercase", "validate that locked tags cannot be renamed").
6. **Error Handling / Rollback Behavior**: Whether specific validation errors should bubble up to trigger database rollbacks (default behavior).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `glyvio_core.SimpleBeforeInterceptor`, NOT `import { SimpleBeforeInterceptor } ...`
2. **Mutable Values — prefer BeforeInterceptor when modifying the entity's own fields**: The `value` parameter is `BeforeInterceptorValue<T>` (`T & ModelModification`) and is fully mutable. You CAN directly assign fields on the intercepted entity inside `handleBefore`. Changes are included in the original save — no extra `saveInput` call is needed. This is the correct hook for computed fields, coordinate copies, default injections, and any other mutation of the entity being saved. `AfterInterceptorValue<T>` is read-only; using it to update the same entity requires a second `saveInput` write, which is wasteful and incorrect.
3. **No Default Try-Catch (Error Propagation & Rollbacks)**: Do not wrap the code in a `try-catch` block unless the user explicitly requests error suppression. By default, let all errors bubble up (throw upwards) so the server can handle the failure and perform a database transaction rollback.
4. **System Save Operations**: When persisting supplementary records during validation, use `glyvio_core.entityService.saveEntityWithoutPermission(entity)` so the write executes successfully regardless of the current user's permission scope.
5. **DB methods are synchronous on the server**: `Entity.findById()`, `QueryBuilder.findFirst()`, `findAll()`, and `entityService.saveInput()` are all **synchronous** in the server runtime. Never add `await`.
6. **Type Safety**: Implement exact typing on arguments using `glyvio_core.BeforeInterceptorValue` and `glyvio_core.BeforeInterceptorContext`.
7. **Execution Pipeline Order**: BeforeInterceptors run **after** SyncInterceptors and **before** AfterInterceptors. The full execution sequence is `SyncInterceptor` > `BeforeInterceptor` > `AfterInterceptor`.

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
> The root `npx tsc --noEmit` compiles **all** files (app + server) together using the app-layer types from `plugin/app/@types/`, where `QueryBuilder.findFirst()`, `findAll()`, and `Entity.findById()` are typed as `Promise<T>`. Server-side code in `plugin/server/src/` uses `plugin/server/@types/` at build time, where **all these methods are synchronous** (`T | undefined`, `T[]`, etc.).
>
> Errors like `Property 'X' does not exist on type 'Promise<...>'` in server files are **expected false positives** from root `tsc` — they are not real compilation errors. The actual server build (via `webpack` with `plugin/server/tsconfig.build.json`) resolves types correctly. Do not attempt to fix them by adding `await`.

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
/**
 * Pre-save interceptor reacting to changes on `<TargetEntityName>` instances before saving.
 */
@glyvio_core.BeforeInterceptor({
  entity: glyvio_entity.<TargetEntityName>,
  id: '<ListenerUniqueId>',
  priority: <PriorityValue_or_50>,
})
export class <InterceptorClassName> extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.<TargetEntityName>> {

  handleBefore(
    value: glyvio_core.BeforeInterceptorValue<glyvio_entity.<TargetEntityName>>,
    context: Readonly<glyvio_core.BeforeInterceptorContext<glyvio_entity.<TargetEntityName>>>,
  ): void {
    // 💡 CHANGE DETECTION EXAMPLE:
    // const nameField = glyvio_structure.AllEntities.<targetEntityCamelCase>.<fieldName>;
    // if (!value.isModified(nameField)) {
    //   return; // Field didn't change
    // }
    // const oldValue = value.getOriginalValue(nameField);
    // const newValue = value.name;

    // 💡 MUTATION EXAMPLE:
    // if (!value.color) {
    //   value.color = '#3b82f6';
    // }

    // 💡 VALIDATION / ROLLBACK EXAMPLE:
    // if (value.isModified(nameField) && context.savedValue?.isLocked) {
    //   throw new Error("Cannot rename a locked record.");
    // }
  }
}
```
