---
name: create-app-strategy
description: "Registers a new app-layer strategy (CoreAppStrategyAsync/CoreAppStrategySync), or overrides the default implementation of an existing core one (e.g. EntityHasAttachmentTypesStrategy), via appStrategyService.registerStrategies."
---
# Agent Skill: Create or Override an App-Layer Strategy in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to register a new app-layer (`plugin/app`) strategy, or to override the default implementation of an existing one already shipped by `glyvio-plugin-core`.

**Do not confuse this with `create-strategy`.** That skill covers server-side `SimpleStrategy` + `@glyvio_core.Strategy({id})` — a queued, deduplicated pattern for server business logic (`pushToQueue`, `executionFlagService`). This skill covers a completely different, **app-layer** mechanism: a singleton registered by event key, resolved synchronously or asynchronously via `appStrategyService`, used as an overridable extension point for app-side view/component logic (e.g. "does this entity use attachment types?", "how should timelines save links?", "what's the default user group for a user?").

---

## 🎯 Skill Metadata

- **Name**: `create_app_strategy`
- **Description**: Registers a new app-layer strategy (`CoreAppStrategyAsync`/`CoreAppStrategySync`), or overrides the default implementation of an existing one, via `appStrategyService.registerStrategies`.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase (`plugin/app`).

---

## 📥 Required Input Parameters

1. **Are you creating a brand-new strategy, or overriding an existing one?**
   - **Overriding**: search `@types` / `dist/bundle.d.ts` for the existing abstract class (e.g. `EntityHasAttachmentTypesStrategy`). Confirm its `eventKey` (a `static eventKey` on the class, or read it off the JSDoc/source) and its `run(...)` request/response shape — you must match both exactly.
   - **Creating new**: pick a unique `eventKey` string, and the request (`R`) / response (`Q`) types.
2. **Sync or async?**: does the logic need to `await` anything (a DB query via `QueryBuilder`, another service call)? Use `CoreAppStrategyAsync<R, Q>` (`handle(request: R): Promise<Q>`). If it's pure, synchronous computation, use `CoreAppStrategySync<R, Q>` (`handle(request: R): Q`).
3. **The business logic** to run inside `handle(request)`.

---

## 🚫 Environment Constraints & Rules

1. **No External Imports for Glyvio Globals**: use `glyvio_core.CoreAppStrategyAsync`/`CoreAppStrategySync`/`appStrategyService`, never `import { ... } from ...`.
2. **No `any` or force cast**: type the request/response generics precisely.
3. **Registration, not decoration**: unlike server-side `@Strategy`, there is no decorator here. You must explicitly call `glyvio_core.appStrategyService.registerStrategies([YourStrategyClass])` — typically in `plugin/app/src/index.ts`, alongside the plugin's other app-layer registrations (routes, interceptors).
4. **Overriding an existing strategy = registering your own class for the same `eventKey`.** There's no separate "override" API: `registerStrategies` keys its internal cache by each class's `getEventKey()`. Registering your own class with the same key as an existing one (e.g. `EntityHasAttachmentTypesStrategyDefault`'s key, `'EntityHasAttachmentTypesStrategy'`) replaces it for every caller of `Strategy.run(...)`, everywhere in the app — this is a global, not a per-view, override. Because your plugin's `index.ts` runs its own `registerStrategies` call after `glyvio-plugin-core`'s own initialization, your registration wins.
5. **One class, one strategy**: don't try to make a single class serve two different `eventKey`s — register a separate class per key.
6. **`handle()` must not throw for "no answer" cases** unless that's genuinely exceptional — most existing strategies (e.g. `EntityHasAttachmentTypesStrategy`) return a default/falsy value (`false`, `undefined`) instead of throwing when there's nothing to compute, since `appStrategyService.runAsync`/`runSync` **do** throw if no strategy is registered for the key at all (a real "nobody answered" case) — don't compound that with your own `handle()` also throwing for a normal empty-result case.

---

## 📋 Execution Steps

### Step 1: Locate or Define the Abstract Strategy Class

- **Overriding**: find the existing abstract class in `@types` (e.g. `glyvio_core.EntityHasAttachmentTypesStrategy`). It already defines `getEventKey()` and (usually) a static `run(request)` convenience wrapper around `appStrategyService.runAsync`/`runSync` — reuse it as-is, you only write the concrete subclass.
- **Creating new**: define the abstract base yourself (see blueprint below) if you also want other plugins/interceptors to be able to override *your* strategy later; otherwise a single concrete class registered directly is enough.

### Step 2: Implement the Concrete Strategy

Create `src/strategies/<strategy_name_snake_case>.ts` implementing `handle(request)`.

### Step 3: Register It

In `src/index.ts` (app entrypoint):

```typescript
glyvio_core.appStrategyService.registerStrategies([
  <YourStrategyClassName>,
  // ... other app strategies registered by this plugin
]);
```

### Step 4: Build & Validate

Run `pnpm build` / `pnpm tsc --noEmit` to confirm types resolve, and — if overriding an existing strategy — manually exercise the flow that calls `Strategy.run(...)` to confirm your override actually fires (log inside `handle()` temporarily if needed).

---

## 📄 Code Blueprint (Template)

### A) Overriding an existing strategy (most common case)

```typescript
/**
 * Overrides the default `<ExistingStrategyName>` for this plugin's specific business rule.
 */
export class <YourStrategyClassName> extends glyvio_core.<ExistingStrategyName> {
  async handle(request: <RequestType>): Promise<<ResponseType>> {
    // 💡 IMPLEMENT BUSINESS LOGIC HERE — replaces the core default entirely for this eventKey.
    return <defaultOrComputedValue>;
  }
}
```

```typescript
// src/index.ts
glyvio_core.appStrategyService.registerStrategies([<YourStrategyClassName>]);
```

### B) Creating a brand-new app-layer strategy (async example)

```typescript
/**
 * Request payload for `<StrategyEventKey>`.
 */
export interface <RequestTypeName> {
  // Define custom input properties
}

/**
 * Abstract base — lets other plugins/interceptors override this strategy later.
 */
export abstract class <StrategyClassName> extends glyvio_core.CoreAppStrategyAsync<<RequestTypeName>, <ResponseTypeName>> {
  static eventKey = '<StrategyEventKey>';

  static async run(request: <RequestTypeName>): Promise<<ResponseTypeName>> {
    return glyvio_core.appStrategyService.runAsync<<RequestTypeName>, <ResponseTypeName>>(
      <StrategyClassName>.eventKey,
      request,
    );
  }

  getEventKey(): string {
    return <StrategyClassName>.eventKey;
  }
}

/**
 * Default implementation, registered by this plugin.
 */
export class <StrategyClassName>Default extends <StrategyClassName> {
  async handle(request: <RequestTypeName>): Promise<<ResponseTypeName>> {
    // 💡 IMPLEMENT BUSINESS LOGIC HERE
    return <defaultValue>;
  }
}
```

```typescript
// src/index.ts
glyvio_core.appStrategyService.registerStrategies([<StrategyClassName>Default]);
```

**Calling it from anywhere in the app** (a view, an interceptor, another strategy):

```typescript
const result = await <StrategyClassName>.run(<requestValue>);
```

---

## 📚 Known Framework Usages (for reference when overriding)

| Strategy | Event key | Request → Response | Where it's called from |
|---|---|---|---|
| `EntityHasAttachmentTypesStrategy` | `'EntityHasAttachmentTypesStrategy'` | `string` (entity structure name) → `boolean` | `AttachmentSidebar`/`AttachmentSidePanel`'s `finishFileUpload`, to decide whether to prompt the user for an `AttachmentType` after upload. |
| `TimelineSaveWithLinksStrategy` | (see class) | request DTO → `void` | Timeline entries that carry linked-entity references. |
| `UserGroupGetDefaultForUserStrategy` | (see class) | `undefined` → `void`/default group | Resolving a user's default `UserGroup`. |

Before overriding any of these, re-read the current abstract class in `@types` — this table is a pointer, not a substitute for confirming the exact signature.
