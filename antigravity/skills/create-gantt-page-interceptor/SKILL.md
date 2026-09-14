---
name: create-gantt-page-interceptor
description: 'Generates a custom class extending an abstract `SimpleGanttPageInterceptor` to dynamically modify Gantt page design, group headers, bar cell layouts, drag-to-reschedule actions, and database/date-window query filters, and registers it.'
---

# Agent Skill: Create Gantt Page Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register an interceptor/listener to customize the behavior of an existing `SimpleGanttPage` view in another project.

Recall from `create-gantt-page`: `SimpleGanttPage` has no separate "row" concept — groups/lanes are fetched and rendered exactly like `SimpleKanbanPage` columns. The interceptor hooks below mirror `SimpleKanbanPageInterceptor` one-for-one, plus one extra hook (`populateIntervalFilter`) borrowed from `SimpleCalendarPageInterceptor` for the date-window query — there is no Kanban equivalent for that one.

| Kanban interceptor hook | Gantt interceptor hook |
|---|---|
| `getDesignForColumn(state, columnState, design)` | `getDesignForGroup(state, groupState, design)` |
| `getDesignForCell(state, columnState, item, design)` | `getDesignForBar(state, groupState, item, design)` |
| `onColumnChange(state, columnState, queue, item)` | `onBarChange(state, change, queue, item)` |
| — (no equivalent) | `populateIntervalFilter(state, queryBuilder, initialDate, finalDate)` |

---

## 🎯 Skill Metadata

- **Name**: `create_gantt_page_interceptor`
- **Description**: Generates a custom class extending an abstract `SimpleGanttPageInterceptor` to dynamically modify Gantt page design, group headers, bar cell layouts, drag-to-reschedule actions, and database/date-window query filters, and registers it.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## ⚙️ Pre-Execution

### Step 0 — Collect the current design JSON using SpyInterceptor

1. Determine the temp file path: `.agents/temp/<GanttPageName>_design.json` (e.g., `TaskGanttPage_design.json`).
2. Check if that file already exists. If it does, remove/delete the file from disk and proceed with the collection flow normally to capture a fresh design.
3. Create and register a temporary **SpyInterceptor** in the plugin:
   - Create a file `src/interceptors/views/spy_interceptor.ts`.
   - Implement `SpyInterceptor` extending `<TargetBaseInterceptorClass>` to capture the `design` in `getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleGanttPageDesign)`:
     ```typescript
     export class SpyInterceptor extends <TargetBaseInterceptorClass> {
       override getListenerId(): string {
         return 'gramil_SpyInterceptor';
       }
       override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
         return <TargetRouteClass>;
       }
       override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleGanttPageDesign): void {
         if (typeof window !== 'undefined') {
           (window as any).__finalDesign = JSON.parse(JSON.stringify(design));
           console.log("SPY_INTERCEPTOR: Design captured successfully!", JSON.stringify(design));
         }
       }
     }
     ```
   - Register it temporarily in `src/index.ts`.
   - Run `pnpm build` via `run_command` to compile the codebase with the temporary `SpyInterceptor`.
4. Retrieve the design JSON using the browser inspection script:
   - Ask the user to make sure Chrome is running with remote debugging enabled (`--remote-debugging-port=9222`) and that the target page is open/active.
   - Run the script `antigravity/scripts/chrome_inspector.js` via `run_command` to connect to Chrome, automatically wait for `window.__finalDesign` to be populated, and save the retrieved JSON to `.agents/temp/<GanttPageName>_design.json`.
     _Command:_ `node antigravity/scripts/chrome_inspector.js <GanttPageName>` (e.g., `node antigravity/scripts/chrome_inspector.js TaskGanttPage`).
     _(Note: This script automatically starts an `httpster` server on port 9998 with CORS enabled serving `plugin/app/dist` beforehand, injects the localStorage rules for `app_rule_plugins` and `USER_PREFERENCE`, reloads the page to apply them, and automatically reconnects to continue polling.)_
5. Once the design JSON is collected and saved to `.agents/temp/<GanttPageName>_design.json`, remove the temporary `SpyInterceptor` and its registration from the codebase, and run `pnpm build` again to clean up the compiled distribution.
6. If Chrome debugging is not available or fails, fallback to asking the user to send the **current design JSON** of the page (obtained from `page.getDesignRaw(state)` or the console) in the next message, or to save it manually to `.agents/temp/<GanttPageName>_design.json`.
7. Do NOT proceed to Step 0.1 until the JSON is saved to disk.

### Step 0.1 — Interpret the design JSON (read-only)

**THE JSON IS THE GROUND TRUTH.** Do NOT use prior knowledge about page structure. Every navigation decision in the generated code must be derived exclusively from what the JSON contains.
Rules:

- The `runtimeClass` value of a JSON node is the exact TypeScript class name to instantiate or match with `instanceof`.
- Match target nodes depending on the section type or layout elements:
  - **`SimpleAppBarDesign`**: Modify the App Bar titles or buttons list.
  - **`FormSectionDesign`**: Find child fields and layout designs.
  - **`groupsDesign` entries (`SimpleGanttGroupDesign`)**: One per distinct group/lane — a change here applies once per group, not once per bar.
- In the generated interceptor code, always use the built-in `findWidgetByKey(key)` method on the design tree to find and modify components. Never write custom recursive search helpers or traverse using hardcoded indices.
- Before writing code, confirm that the referenced types/properties exist by inspecting `@types/glyvio_core.d.ts` and the target plugin's type definition file.
- **Base Class Resolution**: Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class). Never invent a parent interceptor. Look for any specialized subclasses of it in the type files. If any subclass contains the JSDoc comment `"You MUST extend this instead."`, you **must** use that specific class as your base class.

### Step 0.2 — Save the analysis summary

After completing the Step 0.1 analysis, **immediately write the findings to `.agents/temp/<GanttPageName>_analysis.md`** using `write_to_file`. Include:

1. The target section/widget `runtimeClass` and `key`.
2. The full navigation path to each target node (dot-path string).
3. The match strategy at each level (by `key`, `groupKey`, `runtimeClass`, etc.).
4. The exact visibility formula and interop syntax to use.
5. The exact modification to apply.

Only after saving the analysis file, present the summary to the user and wait for explicit or implicit confirmation before writing code.

### Step 0.3 — Collect the current group and/or bar design (only if those modifications are required)

**Step 0.3a — Group design** (only if `getDesignForGroup` modifications are needed):

Ask the user for the current **group design JSON** (`SimpleGanttGroupDesign`) for a sample group. Prompt:

> "This task requires modifying the Gantt group design. Please provide the current `SimpleGanttGroupDesign` JSON for a sample group. You can obtain it by temporarily adding a `console.log(JSON.stringify(design))` inside a `getDesignForGroup` override, then copying the output from the browser console."

- Save the received JSON to `.agents/temp/<GanttPageName>_groupDesign.json`.
- **Do NOT proceed to Step 1 until this JSON is received and saved.**

**Step 0.3b — Bar cell design** (only if `getDesignForBar` modifications are needed):

Ask the user for the current **bar cell design JSON** (`SimpleGanttBarCellDesign`) for a sample bar. Prompt:

> "This task requires modifying the Gantt bar design. Please provide the current `SimpleGanttBarCellDesign` JSON for a sample bar. You can obtain it by temporarily adding a `console.log(JSON.stringify(design))` inside a `getDesignForBar` override, then copying the output from the browser console."

- Save the received JSON to `.agents/temp/<GanttPageName>_barDesign.json`.
- **Do NOT proceed to Step 1 until this JSON is received and saved.**

Use these JSONs as ground truth for the group/bar structure, applying the same rules from Step 0.1: use `runtimeClass` for type matching, use `findWidgetByKey` for targeting nodes, and derive all navigation paths exclusively from the JSON content.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Gantt Page Name** (e.g., `TaskGanttPage`): The name of the Gantt Page view class being intercepted.
2. **Target Route Class** (e.g., `TaskGanttPageRoute`): The route class name of the target page.
3. **Target Base Interceptor Class** (e.g., `TaskGanttPageInterceptor`): The abstract base class of the interceptor defined by the target page.
   - **Precedence Rule**: You must search the `.d.ts` files for classes bound to the target route. If a specialized abstract class has the JSDoc comment `"You MUST extend this instead."`, you **must** select that class as the base class to extend. Do NOT guess or invent the parent class.
4. **Target State Class** (e.g., `TaskGanttPageState`): The state interface of the target page.
5. **Target Group State Class** (e.g., `TaskGanttPageGroupState`): The group state interface of the target page (analogous to a Kanban page's column state class).
6. **Target Entity Name** (e.g., `Task`): The name of the model in `glyvio_entity.*` associated with the page's bars.
7. **Listener Unique ID** (e.g., `custom_task_gantt_page_interceptor`): A unique identifier for the registered listener.
8. **Modifications Required**:
   - **Page Design Modifications**: New filters in sidebar, custom buttons, or layout overrides.
   - **Group Design Modifications**: Header widget changes, color/theme adjustments, or custom labels — applied once per group, never once per bar.
   - **Bar Cell Modifications**: Custom colors, progress overrides, dependency injection, or conditional styling.
   - **Query Modifications**: Additional database filters or custom ordering (`populateQueryBuilder`), or additional date-window constraints (`populateIntervalFilter`).
   - **Bar Change Actions**: Custom side effects when a bar is dragged/resized/rescheduled.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ChipDesign(...)`, NOT `import { ChipDesign } ...`
2. **Route and Class Imports**: Import or reference the target page, route, state, and base interceptor classes from the plugin where the page is defined.
3. **Unique Listener ID**: `getListenerId()` must return a globally unique string in the system.
4. **No `any` or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **Specific Design Hook Selection**: When applying design changes requested by the user, search the abstract base interceptor class (e.g., `<TargetBaseInterceptorClass>`) in the plugin's type definition files to check if there are more specific methods for designing elements (e.g., `getDesignForGroup`, `getDesignForBar`). If a more suitable specific method is found, override that method. Otherwise, fallback to the standard `getDesign` method.
6. **Determine Parent Class**:
   - Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class).
   - If a class contains the JSDoc comment `"You MUST extend this instead."`, you **must** extend this class instead of the standard parent class. Never invent a parent interceptor.
7. **`onBarChange`'s shared queue**: `queue` is the SAME `EntityServiceQueue` instance the page's own `onBarChange` already pushed entries into — push additional entries onto it rather than creating/saving a separate queue; a second `entityService.saveList(...)` call here would double-save or race against the page's own persistence.
8. **`change.groupKey` is optional**: only set when the bar was moved to a different group/lane; a pure resize/reschedule within the same lane leaves it `undefined`. Guard accordingly before using it.

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
    interceptor: YourCustomGanttPageInterceptor,
    order: 10, // Adjust execution order if necessary (lower numbers run first)
  },
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Import target page classes from their plugin module if needed, e.g.:
// import { <TargetBaseInterceptorClass>, <TargetStateClass>, <TargetGroupStateClass>, <TargetRouteClass> } from 'plugin-name';

/**
 * Custom Interceptor to dynamically augment the behavior of <TargetGanttPageName>.
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
   * Intercepts the SimpleGanttPageDesign configuration to inject new filters or buttons.
   * NOTE: Before implementing this, check if <TargetBaseInterceptorClass> defines more specific
   * design methods. If found, override those methods instead of or in addition to `getDesign`.
   */
  override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleGanttPageDesign): void {
    // Use findWidgetByKey to search and modify a target widget by its key
    const targetWidget = design.findWidgetByKey('your_target_key');
    if (targetWidget) {
      // Apply mutations here, e.g.:
      // targetWidget.visible = false;
    }

    // Example:
    // if (design.appBarDesign) {
    //   design.appBarDesign.title = `${design.appBarDesign.title} (Augmented)`;
    // }
  }

  /**
   * Intercepts visual details of a group/lane header — called once per
   * distinct group, never once per bar.
   */
  override getDesignForGroup(
    state: <TargetStateClass>,
    groupState: <TargetGroupStateClass>,
    design: glyvio_core.SimpleGanttGroupDesign,
  ): void {
    // 💡 Example: Append a count badge to the group's headerDesign
  }

  /**
   * Intercepts visual bar design before rendering each Gantt bar cell.
   */
  override getDesignForBar(
    state: <TargetStateClass>,
    groupState: <TargetGroupStateClass>,
    item: glyvio_entity.<TargetEntityName>,
    design: glyvio_core.SimpleGanttBarCellDesign,
  ): void {
    // 💡 Example: Highlight the bar in red if overdue (item's end date < now)
  }

  /**
   * Hook to modify or add criteria to the bars query builder.
   */
  override populateQueryBuilder(
    state: <TargetStateClass>,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<TargetEntityName>>,
  ): void {
    // 💡 Example: Force filter only items assigned to active workspace
  }

  /**
   * Hook to intercept main top search bar input filter constraints.
   */
  override populateMainFilter(
    state: <TargetStateClass>,
    filter: glyvio_core.QueryBuilderFilter,
    text: string,
  ): void {
    // 💡 Example: Add custom OR filters for keyword matching
  }

  /**
   * Hook to intercept the visible date-window boundaries applied to the bars
   * query — there is no Kanban equivalent for this one (borrowed from
   * SimpleCalendarPageInterceptor).
   */
  override populateIntervalFilter(
    state: <TargetStateClass>,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<TargetEntityName>>,
    initialDate: DateTime,
    finalDate: DateTime,
  ): void {
    // 💡 Example: Widen or clamp the fetched range for a specific filter combination
  }

  /**
   * Intercepts bar drag/resize (reschedule) operations to apply custom side
   * effects. `queue` is shared with the page's own `onBarChange` — push
   * additional entries onto it, never create/save a separate queue.
   */
  override async onBarChange(
    state: <TargetStateClass>,
    change: glyvio_core.SimpleGanttBarChange,
    queue: glyvio_entity.EntityServiceQueue,
    item: glyvio_entity.<TargetEntityName>,
  ): Promise<void> {
    // 💡 Example: Log an audit trail entry when a bar's dates change
    // 💡 Example: if (change.groupKey) { /* bar moved to a different lane */ }
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
   * Intercepts page actions/events.
   */
  override async onEvent(state: <TargetStateClass>, key: string, data: unknown): Promise<void> {
    // Handle specific button taps or other custom events
  }
}
```
