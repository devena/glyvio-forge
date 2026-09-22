---
name: create-sidebar-interceptor
description: "Generates a custom class extending an abstract `SimpleSidebarInterceptor` to dynamically modify sidebar layouts, custom buttons, lifecycle hooks (init/refresh/event side-effects), or details views, and registers it. Does NOT expose a file-upload hook — see Known Limitations."
---
<!-- Generated from src/skills/create-sidebar-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create SimpleSidebar Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register an interceptor/listener to customize the behavior of an existing `SimpleSidebar` view in another project.

---

## 🎯 Skill Metadata

- **Name**: `create_sidebar_interceptor`
- **Description**: Generates a custom class extending an abstract `SimpleSidebarInterceptor` to dynamically modify sidebar layouts, custom buttons, lifecycle hooks, or details views, and registers it.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 🔌 Available Interceptor Hooks (`SimpleSidebarInterceptor<S>`)

`SimpleSidebarInterceptor<S>` extends `CoreAppInterceptorView<S, SimpleSidebar<S>>`. Between the two classes, these are **all** the overridable members (verified against `CoreAppInterceptorView`/`SimpleSidebarInterceptor` in `plugin/app/dist/bundle.d.ts`) — do not assume any hook exists beyond this list without re-checking the `.d.ts`:

- `getListenerRoute(): new () => CoreRoute<any>` — **abstract, required.** Binds the interceptor to the target sidebar's route class.
- `getDesign(state, design: SimpleSidebarDesign): void` — customizes the sidebar's visual layout (app bar, sections, buttons) after the concrete view's own `getDesign` has run.
- `populateJeannieContext(state, context?: CoreJeannieContext): CoreJeannieContext | undefined` — augments the context sent to the Jeannie AI assistant for this sidebar.
- `onInitState(state): Promise<void>` — runs once, right after the concrete view's `initState` completes.
- `onRefreshState(state): Promise<void>` — runs right after the concrete view's `refreshState` completes.
- `onUpdateState(key, oldState, newState): Promise<void>` — runs when a specific state key is patched from the client.
- `onRunStrategy(key, oldState, newState): Promise<void>` — runs after a named strategy executes on the view.
- `onEvent(state, key, data): Promise<void>` — **post-hoc observer only, cannot prevent or alter the action.** See the limitation note below before promising anything based on this hook.
- `getEntitiesListenning(state, entitiesToTrack): void` — appends extra entities for the view to subscribe to for real-time updates.
- `onRpcReceived(state, action: ActionReceivedRpc): Promise<void>` — runs when an RPC message is received on the view.
- `getScreenPresenceToTrack(state, screenPresenceToTrack): string | undefined` — overrides which screen-presence key is tracked.
- `getRpcId(state, rpcId): string | undefined` — overrides the RPC subscription id for the view.

### `onEvent` — precise semantics (do not oversell this hook)

Verified in `plugin/app/src/views/core_view.ts`, `_internalBridge()`:

```typescript
} else {
  action.data = serializeService.bridgeDeserialize(action.data ?? {});
  let re = await this.events(state, action);           // 1. the concrete view's own handler runs FIRST, to completion
  await this.runInterceptorsAsync<CoreAppInterceptorView<S, CoreView<S>>>(async (l) => {
    await l.onEvent(state, action.key!, action.data);   // 2. interceptors only run AFTER, as pure side-effects
    re ??= 'STATE_UPDATE';
  });
  ...
```

Consequences:
- `onEvent` fires **after** `events()` has already fully executed for that action key. It **cannot prevent, cancel, or alter** what the concrete view already did — it is not a "before" hook and has no way to short-circuit the response.
- Its only influence on control flow is: if the view's `events()` returned `undefined` for a key it didn't recognize, the interceptor firing forces the response to `'STATE_UPDATE'`. That lets an interceptor react to a **brand-new custom key it made up itself** (e.g. one added via its own extra button in `getDesign`) — it does not let it hijack a key the concrete view already handles.
- This also applies to `AttachmentSidebar`/`AttachmentSidePanel`: `onEvent` does receive the `newFile`, `onAttachmentVisibilityChosen`, `onSelectAttachmentType` keys (they are regular, non-underscore actions), but only after `AttachmentSidebar.events()` (`plugin/app/src/views/routines/attachment/attachment_sidebar.ts`) has already called `callFilePicker`/`finishFileUpload`/`saveAttachmentType`. There is nothing left to prevent by the time the interceptor sees it — at most it can chain an additional side-effect (log, notify, refresh something else).
- The actual byte-delivery of an uploaded file never reaches `onEvent` at all: it arrives as the **internal** action `_ON_FILE_UPLOADED`, handled in `SimpleSidebar._internalEvents()` (`plugin/app/src/views/core/sidebars/simple_sidebar.ts`, lines ~56-60), a completely separate branch of `_internalBridge` that never calls `runInterceptorsAsync(... onEvent ...)`. Contrast this with `_GET_JEANNIE_CONTEXT` a few lines below in the same method, which *does* explicitly call `runInterceptorsAsync<SimpleSidebarInterceptor<S>>(... populateJeannieContext ...)` — i.e. the framework author deliberately wired an interceptor hook for Jeannie context but deliberately did not wire one for file upload.

---

## ⚙️ Pre-Execution

### Step 0 — Collect the current design JSON using SpyInterceptor

1. Determine the temp file path: `.claude/temp/<SidebarName>_design.json` (e.g., `TaskTypeSidebar_design.json`).
2. Check if that file already exists. If it does, remove/delete the file from disk and proceed with the collection flow normally to capture a fresh design.
3. Create and register a temporary **SpyInterceptor** in the plugin:
   - Create a file `src/interceptors/views/spy_interceptor.ts`.
   - Implement `SpyInterceptor` extending `<TargetBaseInterceptorClass>` to capture the `design` in `getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleSidebarDesign)`:
     ```typescript
     export class SpyInterceptor extends <TargetBaseInterceptorClass> {
       override getListenerId(): string {
         return 'gramil_SpyInterceptor';
       }
       override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
         return <TargetRouteClass>;
       }
       override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleSidebarDesign): void {
         if (typeof window !== 'undefined') {
           (window as any).__finalDesign = JSON.parse(JSON.stringify(design));
           console.log("SPY_INTERCEPTOR: Design captured successfully!", JSON.stringify(design));
         }
       }
     }
     ```
   - Register it temporarily in `src/index.ts`.
   - Run `pnpm build` via the available shell tool to compile the codebase with the temporary `SpyInterceptor`.
4. Retrieve the design JSON using the browser inspection script:
   - Ask the user to make sure Chrome is running with remote debugging enabled (`--remote-debugging-port=9222`) and that the target sidebar is open/active.
   - Run the script `.claude/scripts/chrome_inspector.js` via the available shell tool to connect to Chrome, automatically wait for `window.__finalDesign` to be populated, and save the retrieved JSON to `.claude/temp/<SidebarName>_design.json`.
     _Command:_ `node .claude/scripts/chrome_inspector.js <SidebarName>` (e.g., `node .claude/scripts/chrome_inspector.js TaskTypeSidebar`).
     _(Note: This script automatically starts an `httpster` server on port 9998 with CORS enabled serving `plugin/app/dist` beforehand, injects the localStorage rules for `app_rule_plugins` and `USER_PREFERENCE`, reloads the page to apply them, and automatically reconnects to continue polling.)_
5. Once the design JSON is collected and saved to `.claude/temp/<SidebarName>_design.json`, remove the temporary `SpyInterceptor` and its registration from the codebase, and run `pnpm build` again to clean up the compiled distribution.
6. If Chrome debugging is not available or fails, fallback to asking the user to send the **current design JSON** of the sidebar (obtained from `sidebar.getDesignRaw(state)` or the console) in the next message, or to save it manually to `.claude/temp/<SidebarName>_design.json`.
7. Do NOT proceed to Step 0.1 until the JSON is saved to disk.

### Step 0.1 — Interpret the design JSON (read-only)

**THE JSON IS THE GROUND TRUTH.** Do NOT use prior knowledge about sidebar structure. Every navigation decision in the generated code must be derived exclusively from what the JSON contains.
Rules:

- The `runtimeClass` value of a JSON node is the exact TypeScript class name to instantiate or match with `instanceof`.
- Match target nodes depending on the section type or layout elements:
  - **`SimpleAppBarDesign`**: Modify the App Bar titles or buttons list.
  - **`FormSectionDesign` / `FormEntityLayoutDesign`**: Find child fields and layout designs.
  - **`ListSectionDesign`**: Cells are layout templates where you must search recursively within the cell's `child` layout tree for a widget with a matching `key`.
- In the generated interceptor code, always use the built-in `findWidgetByKey(key)` method on the design tree to find and modify components. Never write custom recursive search helpers or traverse using hardcoded indices.
- Before writing code, confirm that the referenced types/properties exist by inspecting `@types/glyvio_core.d.ts` and the target plugin's type definition file.
- **Base Class Resolution**: Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class). Never invent a parent interceptor. Look for any specialized subclasses of it in the type files. If any subclass contains the JSDoc comment `"You MUST extend this instead."`, you **must** use that specific class as your base class.

### Step 0.2 — Save the analysis summary

After completing the Step 0.1 analysis, **immediately write the findings to `.claude/temp/<SidebarName>_analysis.md`** using the available file-editing tool. Include:

1. The target section/widget `runtimeClass` and `key`.
2. The full navigation path to each target node (dot-path string).
3. The match strategy at each level (by `key`, `columnName`, `runtimeClass`, etc.).
4. The exact visibility formula and interop syntax to use.
5. The exact modification to apply.

Only after saving the analysis file, present the summary to the user and wait for explicit or implicit confirmation before writing code.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Sidebar Name** (e.g., `TaskTypeSidebar`): The name of the Sidebar view class being intercepted.
2. **Target Route Class** (e.g., `TaskTypeSidebarRoute`): The route class name of the target sidebar route.
3. **Target Base Interceptor Class** (e.g., `TaskTypeSidebarInterceptor`): The abstract base class of the interceptor defined by the target sidebar.
   - **Precedence Rule**: You must search the `.d.ts` files for classes bound to the target route. If a specialized abstract class has the JSDoc comment `"You MUST extend this instead."`, you **must** select that class as the base class to extend. Do NOT guess or invent the parent class.
4. **Target State Class** (e.g., `TaskTypeSidebarState`): The state interface of the target sidebar.
5. **Listener Unique ID** (e.g., `custom_task_type_sidebar_interceptor`): A unique identifier for the registered listener.
6. **Modifications Required**:
   - **Sidebar Design Modifications**: Customize titles, App Bar options, section designs, or inject new layout structures dynamically.
   - **Lifecycle side-effects**: Run extra logic on `onInitState`/`onRefreshState`/`onUpdateState`/`onRunStrategy`, or react (observe-only, see hook list above) to an existing or self-added custom event key via `onEvent`.
   - Before promising anything involving file uploads, attachments, or any other behavior specific to the target sidebar's own logic, read **Known Limitations** below and confirm in the concrete view's source (not just the `.d.ts`) that the desired behavior actually flows through a method `SimpleSidebarInterceptor` exposes.

---

## ⚠️ Known Limitations

**An interceptor cannot add lifecycle hooks that the concrete core view did not deliberately expose.** `SimpleSidebarInterceptor<S>` only lets you override the members listed in "Available Interceptor Hooks" above — nothing else, no matter how plausible it sounds.

The concrete, confirmed example: **file upload behavior on `AttachmentSidebar`/`AttachmentSidePanel` (both in `glyvio-plugin-core`, `plugin/app/src/views/routines/attachment/`) is NOT customizable via `create-sidebar-interceptor`.** The method that actually controls that flow, `onFileUploaded(state, attachment, extras)`, is a plain method on `SimpleSidebar` itself (`plugin/app/src/views/core/sidebars/simple_sidebar.ts`), never invoked through `runInterceptorsAsync`, and therefore not part of `SimpleSidebarInterceptor`'s contract. The interceptor's `onEvent` does receive the surrounding button-tap keys (`newFile`, `onAttachmentVisibilityChosen`, `onSelectAttachmentType`) but only *after* the concrete view has already fully processed them (see the `onEvent` semantics above) — it cannot prevent, redirect, or validate an upload before it happens. The only way to change that behavior is to edit `AttachmentSidebar`/`AttachmentSidePanel` directly in `glyvio-plugin-core` (i.e. the same customization is possible when *creating* a brand-new sidebar from scratch with `create-sidebar`, by overriding `onFileUploaded` on your own `SimpleSidebar` subclass — just not when *intercepting* an existing, concrete one).

**Before telling a user a customization is possible via this skill, verify it against the target view's actual source file (not only `bundle.d.ts`).** The `.d.ts` only tells you a hook exists on the interceptor base class; it does not tell you whether the concrete view you're intercepting actually routes the behavior you care about through that hook, or handles it internally/via a separate native-bridge action the interceptor never sees (as is the case for file uploads).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ActionButtonDesign(...)`, NOT `import { ActionButtonDesign } ...`
2. **Route and Class Imports**: Import or reference the target sidebar, route, state, and base interceptor classes from the plugin where the sidebar is defined.
3. **Unique Listener ID**: `getListenerId()` must return a globally unique string in the system.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **Specific Design Hook Selection**: When applying design changes requested by the user, search the abstract base interceptor class (e.g., `<TargetBaseInterceptorClass>`) in the plugin's type definition files to check if there are more specific methods for designing elements. If a more suitable specific method is found, override that method. Otherwise, fallback to the standard `getDesign` method.
6. **Determine Parent Class**:
   - Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class).
   - If a class contains the JSDoc comment `"You MUST extend this instead."`, you **must** extend this class instead of the standard parent class. Never invent a parent interceptor.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Interceptor File

Create a new file `src/interceptors/views/<listener_id_snake_case>.ts` inside the intercepting plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Interceptor

Add the interceptor class to the application's interceptor registration (typically inside `src/index.ts` where other interceptors are loaded):

```typescript
glyvio_core.appInterceptorService.registerInterceptors([
  {
    interceptor: YourCustomSidebarInterceptor,
    order: 10, // Adjust execution order if necessary (lower numbers run first)
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
 * Custom Interceptor to dynamically augment the behavior of <TargetSidebarName>.
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
   * Intercepts the SimpleSidebarDesign configuration to customize visual layouts or App Bars.
   * NOTE: Before implementing this, check if <TargetBaseInterceptorClass> defines more specific
   * design methods. If found, override those methods instead of or in addition to `getDesign`.
   */
  override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleSidebarDesign): void {
    // Use findWidgetByKey to search and modify a target widget by its key
    const targetWidget = design.findWidgetByKey('your_target_key');
    if (targetWidget) {
      // Apply mutations here, e.g.:
      // targetWidget.visible = false;
    }

    // Example: Change the sidebar App Bar title dynamically
    // const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    // if (appBar) {
    //   appBar.title = `${appBar.title} (Customized)`;
    // }
  }

  /**
   * Runs when the state is initialized.
   */
  override async onInitState(state: <TargetStateClass>): Promise<void> {
    // Initialize custom state variables or perform initial setup
  }

  /**
   * Runs when the state is refreshed.
   */
  override async onRefreshState(state: <TargetStateClass>): Promise<void> {
    // Perform actions on state refresh
  }

  /**
   * Intercepts sidebar actions/events.
   *
   * IMPORTANT: This runs strictly AFTER the concrete sidebar's own `events()` has already
   * fully processed `key`/`data` — it is a post-hoc observer, not a "before" hook. It cannot
   * prevent, cancel, or alter the action the view already performed (e.g. it cannot stop or
   * validate a file upload on AttachmentSidebar — see the skill's "Known Limitations" section).
   * Use it only for side effects (logging, notifications, refreshing unrelated state) or to
   * react to a brand-new custom event key the concrete view does not itself handle.
   */
  override async onEvent(state: <TargetStateClass>, key: string, data: unknown): Promise<void> {
    // Handle side effects for specific button taps or custom events, e.g.:
    // if (key === 'your_custom_button_action') {
    //   // perform side effects — the original action, if any, already ran
    // }
  }

  /**
   * Runs when a specific state key is patched from the client (e.g. a `state.filtersSidebar.x`
   * two-way-bound field). Optional — override only if you need to react to a specific field change.
   */
  override async onUpdateState(key: string, oldState: <TargetStateClass>, newState: <TargetStateClass>): Promise<void> {
    // if (key === 'some.state.path') { ... }
  }

  /**
   * Runs after a named strategy executes on the view. Optional.
   */
  override async onRunStrategy(key: string, oldState: <TargetStateClass> | undefined, newState: <TargetStateClass>): Promise<void> {
    // if (key === 'SOME_STRATEGY_KEY') { ... }
  }

  /**
   * Appends extra entities for the sidebar to subscribe to for real-time updates. Optional.
   */
  override getEntitiesListenning(state: <TargetStateClass>, entitiesToTrack: glyvio_core.EntityListenning[]): void {
    // entitiesToTrack.push(new glyvio_core.EntityListenning({ structureName: '...', objectId: '...' }));
  }

  /**
   * Runs when an RPC message is received on the view. Optional, rarely needed.
   */
  override async onRpcReceived(state: <TargetStateClass>, action: glyvio_core.ActionReceivedRpc): Promise<void> {
    // Handle RPC payloads if this sidebar uses real-time RPC channels.
  }

  /**
   * Overrides which screen-presence key is tracked for this view. Optional, rarely needed.
   */
  override getScreenPresenceToTrack(state: <TargetStateClass>, screenPresenceToTrack: string | undefined): string | undefined {
    return undefined; // return a value to override, or undefined to keep the default
  }

  /**
   * Overrides the RPC subscription id for this view. Optional, rarely needed.
   */
  override getRpcId(state: <TargetStateClass>, rpcId: string | undefined): string | undefined {
    return undefined; // return a value to override, or undefined to keep the default
  }

  /**
   * Augments the context sent to the Jeannie AI assistant for this sidebar. Optional.
   */
  override populateJeannieContext(state: <TargetStateClass>, context?: glyvio_core.CoreJeannieContext): glyvio_core.CoreJeannieContext | undefined {
    return context;
  }
}
```

> Only implement the hooks you actually need — the stubs above are shown for completeness of what `SimpleSidebarInterceptor` exposes (see "Available Interceptor Hooks"), not as a mandatory checklist. An override with a no-op body is dead code; remove it.
