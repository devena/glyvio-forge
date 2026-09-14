---
name: create-simple-cart-interceptor
description: 'Generates a custom class extending an abstract `SimpleCartListener` to dynamically modify cart layouts, customize buttons, intercept item additions/removals, or override item status resolution logic, and registers it.'
---

# Agent Skill: Create SimpleCart Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register an interceptor/listener to customize the behavior of an existing `SimpleCart` view in another project.

---

## 🎯 Skill Metadata

- **Name**: `create_simple_cart_interceptor`
- **Description**: Generates a custom class extending an abstract `SimpleCartListener` to dynamically modify cart layouts, customize buttons, intercept item additions/removals, or override item status resolution logic, and registers it.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## ⚙️ Pre-Execution

### Step 0 — Collect the current design JSON using SpyInterceptor

1. Determine the temp file path: `{{TEMP_DIR}}/<CartName>_design.json` (e.g., `SaleEditCart_design.json`).
2. Check if that file already exists. If it does, remove/delete the file from disk and proceed with the collection flow normally to capture a fresh design.
3. Create and register a temporary **SpyInterceptor** in the plugin:
   - Create a file `src/interceptors/views/spy_interceptor.ts`.
   - Implement `SpyInterceptor` extending `<TargetBaseInterceptorClass>` to capture the `design` in `getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleCartDesign)`:
     ```typescript
     export class SpyInterceptor extends <TargetBaseInterceptorClass> {
       override getListenerId(): string {
         return 'gramil_SpyInterceptor';
       }
       override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
         return <TargetRouteClass>;
       }
       override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleCartDesign): void {
         if (typeof window !== 'undefined') {
           (window as any).__finalDesign = JSON.parse(JSON.stringify(design));
           console.log("SPY_INTERCEPTOR: Design captured successfully!", JSON.stringify(design));
         }
       }
     }
     ```
   - Register it temporarily in `src/index.ts`.
   - Run `pnpm build` via {{SHELL_TOOL}} to compile the codebase with the temporary `SpyInterceptor`.
4. Retrieve the design JSON using the browser inspection script:
   - Ask the user to make sure Chrome is running with remote debugging enabled (`--remote-debugging-port=9222`) and that the target view is open/active.
   - Run the script `{{SCRIPTS_DIR}}/chrome_inspector.js` via {{SHELL_TOOL}} to connect to Chrome, automatically wait for `window.__finalDesign` to be populated, and save the retrieved JSON to `{{TEMP_DIR}}/<CartName>_design.json`.
     _Command:_ `node {{SCRIPTS_DIR}}/chrome_inspector.js <CartName>` (e.g., `node {{SCRIPTS_DIR}}/chrome_inspector.js SaleEditCart`).
     _(Note: This script automatically starts an `httpster` server on port 9998 with CORS enabled serving `plugin/app/dist` beforehand, injects the localStorage rules for `app_rule_plugins` and `USER_PREFERENCE`, reloads the page to apply them, and automatically reconnects to continue polling.)_
5. Once the design JSON is collected and saved to `{{TEMP_DIR}}/<CartName>_design.json`, remove the temporary `SpyInterceptor` and its registration from the codebase, and run `pnpm build` again to clean up the compiled distribution.
6. If Chrome debugging is not available or fails, fallback to asking the user to send the **current design JSON** of the cart (obtained from `cart.getDesignRaw(state)` or the console) in the next message, or to save it manually to `{{TEMP_DIR}}/<CartName>_design.json`.
7. Do NOT proceed to Step 0.1 until the JSON is saved to disk.

### Step 0.1 — Interpret the design JSON (read-only)

**THE JSON IS THE GROUND TRUTH.** Do NOT use prior knowledge about cart structure. Every navigation decision in the generated code must be derived exclusively from what the JSON contains.
Rules:

- The `runtimeClass` value of a JSON node is the exact TypeScript class name to instantiate or match with `instanceof`.
- Match target nodes depending on the section type:
  - **`TableSectionDesign`**: Iterate `interopDesign.cells` and find the target cell using `cell.columnName === 'target_field'`.
  - **`GridSectionDesign`**: Cells are `CardCellDesign[]` which do not have columns. You must search recursively within the cell's `child` layout tree (or template `interopDesign.child`) for a widget with a matching `key`.
  - **`ListSectionDesign`**: Cells are `LineCellDesign[]` which do not have columns. You must search recursively within the cell's `child` layout tree (or template `interopDesign.child`) for a widget with a matching `key`.
- In the generated interceptor code, always use the built-in `findWidgetByKey(key)` method on the design tree to find and modify components. Never write custom recursive search helpers or traverse using hardcoded indices like `cells[0]`.
- Before writing code, confirm that the referenced types/properties exist by inspecting `@types/glyvio_core.d.ts` and the target plugin's type definition file.
- **Base Class Resolution**: Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class). Never invent a parent interceptor. Look for any specialized subclasses of it in the type files. If any subclass contains the JSDoc comment `"You MUST extend this instead."`, you **must** use that specific class as your base class.

### Step 0.2 — Save the analysis summary

After completing the Step 0.1 analysis, **immediately write the findings to `{{TEMP_DIR}}/<CartName>_analysis.md`** using {{WRITE_TOOL}}. Include:

1. The target section `runtimeClass` and `key`.
2. The full navigation path to each target node (dot-path string).
3. The match strategy at each level (by `key`, `columnName`, `runtimeClass`, etc.).
4. The exact visibility formula and interop syntax to use.
5. The exact modification to apply.

Only after saving the analysis file, present the summary to the user and wait for explicit or implicit confirmation before writing code.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Cart Name** (e.g., `ShoppingCart`): The name of the Cart view class being intercepted.
2. **Target Route Class** (e.g., `ShoppingCartRoute`): The route class name of the target cart route.
3. **Target Base Interceptor Class** (e.g., `ShoppingCartListener`): The abstract base class of the interceptor defined by the target cart route.
   - **Precedence Rule**: You must search the `.d.ts` files for classes bound to the target route. If a specialized abstract class has the JSDoc comment `"You MUST extend this instead."`, you **must** select that class as the base class to extend. Do NOT guess or invent the parent class.
4. **Target State Class** (e.g., `ShoppingCartState`): The state interface of the target cart.
5. **Listener Unique ID** (e.g., `custom_shopping_cart_interceptor`): A unique identifier for the registered listener.
6. **Modifications Required**:
   - **Cart Design Modifications**: Customize titles, icons, sections layout, or action options dynamically.
   - **Item Interception**: Validate, block, or trigger background reactions when items are added to or removed from the cart.
   - **Status Interception**: Override or augment item status resolution inside the cart.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ActionButtonDesign(...)`, NOT `import { ActionButtonDesign } ...`
2. **Route and Class Imports**: Import or reference the target cart, route, state, and base interceptor classes from the plugin where the cart is defined.
3. **Unique Listener ID**: `getListenerId()` must return a globally unique string in the system.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors.
5. **Specific Design Hook Selection**: When applying design changes requested by the user, search the abstract base interceptor class (e.g., `<TargetBaseInterceptorClass>`) in the plugin's type definition files to check if there are more specific methods for designing elements (e.g., `getProductCell`, `getItemCell`, `getDesignForCell`, etc.). If a more suitable specific method is found, override that method. Otherwise, fallback to the standard `getDesign` method.
6. **Determine Parent Class**:
   - Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class).
   - If a class contains the JSDoc comment `"You MUST extend this instead."`, you **must** extend this class instead of the standard parent class. Never invent a parent interceptor.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Interceptor File

Create a new file `src/interceptors/views/<listener_id_snake_case>.ts` inside the intercepting plugin's codebase.

### Step 2: Register the Interceptor

Add the interceptor class to the application's interceptor registration (typically inside `src/index.ts` where other interceptors are loaded):

```typescript
glyvio_core.appInterceptorService.registerInterceptors([
  {
    interceptor: YourCustomCartInterceptor,
    order: 10,
  },
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Import target page classes from their plugin module if needed, e.g.:
// import { <TargetBaseInterceptorClass>, <TargetStateClass>, <TargetRouteClass> } from 'plugin-name';

/**
 * Custom Interceptor to dynamically augment the behavior of <TargetCartName>.
 */
export class <InterceptorClassName> extends <TargetBaseInterceptorClass> {
  /**
   * Unique identifier of this interceptor/listener.
   */
  override getListenerId(): string {
    return '<ListenerUniqueId>';
  }

  /**
   * Identifies the route constructor this listener is bound to.
   */
  override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRouteClass>;
  }

  /**
   * Intercepts the SimpleCartDesign configuration to customize visual layouts, icons, or headers.
   * NOTE: Before implementing this, check if <TargetBaseInterceptorClass> defines more specific
   * design methods (e.g., `getProductCell`, `getItemCell`, `getDesignForCell`). If found, override
   * those methods instead of or in addition to `getDesign`.
   */
  override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleCartDesign): void {
    const sections = design.sectionsDesign;
    if (!sections) {
      return;
    }

    // Use findWidgetByKey to search and modify a target widget by its key
    const targetWidget = design.findWidgetByKey('your_target_key');
    if (targetWidget) {
      // Apply mutations here, e.g.:
      // targetWidget.visible = false;
    }
  }

  /**
   * Intercepts and alters item additions.
   */
  override async onAddItemToCart(
    state: <TargetStateClass>,
    entityName: string,
    entityId: string,
    data: unknown,
    addedEntity: unknown | undefined,
  ): Promise<unknown | undefined> {
    return addedEntity;
  }

  /**
   * Intercepts and alters item removals.
   */
  override async onRemoveItemFromCart(
    state: <TargetStateClass>,
    entityName: string,
    entityId: string,
    data: unknown,
    removedEntity: unknown | undefined,
  ): Promise<unknown | undefined> {
    return removedEntity;
  }

  /**
   * Intercepts item status resolution logic inside the cart.
   */
  override getStatusItemOfCart(
    state: <TargetStateClass>,
    entityName: string,
    entityId: string,
    data: unknown,
  ): glyvio_core.CartItemStatus | undefined {
    return undefined;
  }
}
```

---

## ⚠️ Known Limitations

- **`SimpleCartListener<S>` has no generic `events()`/custom-action hook.** The available hooks are exactly `getDesign`, `onAddItemToCart`, `onRemoveItemFromCart`, `getStatusItemOfCart`, and `populateJeannieContext` — there is no `onEvent(state, key, data)` equivalent to intercept an arbitrary new `action.key` from outside the cart's own file. This is different from some other interceptor families in this codebase (e.g. richer cart-like interceptors that do expose a generic `onEvent` hook) — don't assume every cart family has one just because a similar one does.
  - **Practical effect**: if the task is "add a brand-new button/action to an existing `SimpleCart` from another plugin" (not just react to items being added/removed, or tweak the design), a `SimpleCartListener` subclass **cannot** do it — there is no hook that receives a new `action.key` and lets you handle it. `getDesign` can add a button to the UI, but nothing in this interceptor can wire up what happens when it's tapped, since the cart's own `events()` method is what actually resolves an `action.key`, and interceptors don't get a say in it.
  - **What actually works**: either (a) own the cart's file directly and add the handler in its own `events()`, or (b) if the goal is bulk-adding items from elsewhere, use the existing `onAddItemToCart`/`getStatusItemOfCart`/cart-button protocol (`CartButtonDesign`) instead of inventing a new action key — most "trigger something from an interceptor" needs can be reshaped into one of these instead of requiring a new hook.
  - Before promising a new custom action on an existing cart purely via an interceptor, check whether the target cart's base interceptor class genuinely exposes a generic event hook (search its `.d.ts` for `onEvent`) — if it's `SimpleCartListener`, it doesn't, and the task needs to be redirected to the cart's own file or reshaped as above.
