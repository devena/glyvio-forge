---
name: create-kanban-page-interceptor
description: 'Generates a custom class extending an abstract `SimpleKanbanPageInterceptor` to dynamically modify Kanban board design, column headers, card cell layouts, drag-and-drop actions, and database query filters, and registers it.'
---

# Agent Skill: Create Kanban Page Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register an interceptor/listener to customize the behavior of an existing `SimpleKanbanPage` view in another project.

---

## 🎯 Skill Metadata

- **Name**: `create_kanban_page_interceptor`
- **Description**: Generates a custom class extending an abstract `SimpleKanbanPageInterceptor` to dynamically modify Kanban board design, column headers, card cell layouts, drag-and-drop actions, and database query filters, and registers it.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## ⚙️ Pre-Execution

### Step 0 — Collect the current design JSON using SpyInterceptor

1. Determine the temp file path: `.claude/temp<KanbanPageName>_design.json` (e.g., `TaskKanbanPage_design.json`).
2. Check if that file already exists. If it does, remove/delete the file from disk and proceed with the collection flow normally to capture a fresh design.
3. Create and register a temporary **SpyInterceptor** in the plugin:
   - Create a file `src/interceptors/views/spy_interceptor.ts`.
   - Implement `SpyInterceptor` extending `<TargetBaseInterceptorClass>` to capture the `design` in `getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleKanbanPageDesign)`:
     ```typescript
     export class SpyInterceptor extends <TargetBaseInterceptorClass> {
       override getListenerId(): string {
         return 'gramil_SpyInterceptor';
       }
       override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
         return <TargetRouteClass>;
       }
       override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleKanbanPageDesign): void {
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
   - Run the script `.claude/scripts/chrome_inspector.js` via `run_command` to connect to Chrome, automatically wait for `window.__finalDesign` to be populated, and save the retrieved JSON to `.claude/temp<KanbanPageName>_design.json`.
     _Command:_ `node .claude/scripts/chrome_inspector.js <KanbanPageName>` (e.g., `node .claude/scripts/chrome_inspector.js TaskKanbanPage`).
     _(Note: This script automatically starts an `httpster` server on port 9998 with CORS enabled serving `plugin/app/dist` beforehand, injects the localStorage rules for `app_rule_plugins` and `USER_PREFERENCE`, reloads the page to apply them, and automatically reconnects to continue polling.)_
5. Once the design JSON is collected and saved to `.claude/temp<KanbanPageName>_design.json`, remove the temporary `SpyInterceptor` and its registration from the codebase, and run `pnpm build` again to clean up the compiled distribution.
6. If Chrome debugging is not available or fails, fallback to asking the user to send the **current design JSON** of the page (obtained from `page.getDesignRaw(state)` or the console) in the next message, or to save it manually to `.claude/temp<KanbanPageName>_design.json`.
7. Do NOT proceed to Step 0.1 until the JSON is saved to disk.

### Step 0.1 — Interpret the design JSON (read-only)

**THE JSON IS THE GROUND TRUTH.** Do NOT use prior knowledge about page structure. Every navigation decision in the generated code must be derived exclusively from what the JSON contains.
Rules:

- The `runtimeClass` value of a JSON node is the exact TypeScript class name to instantiate or match with `instanceof`.
- Match target nodes depending on the section type or layout elements:
  - **`SimpleAppBarDesign`**: Modify the App Bar titles or buttons list.
  - **`FormSectionDesign`**: Find child fields and layout designs.
  - **`ListSectionDesign`**: Cells are layout templates where you must search recursively within the cell's `child` layout tree for a widget with a matching `key`.
- In the generated interceptor code, always use the built-in `findWidgetByKey(key)` method on the design tree to find and modify components. Never write custom recursive search helpers or traverse using hardcoded indices.
- Before writing code, confirm that the referenced types/properties exist by inspecting `@types/glyvio_core.d.ts` and the target plugin's type definition file.
- **Base Class Resolution**: Search the `.d.ts` declaration files for the abstract interceptor class associated with the target route (where `getListenerRoute()` returns the target route class). Never invent a parent interceptor. Look for any specialized subclasses of it in the type files. If any subclass contains the JSDoc comment `"You MUST extend this instead."`, you **must** use that specific class as your base class.

### Step 0.2 — Save the analysis summary

After completing the Step 0.1 analysis, **immediately write the findings to `.claude/temp<KanbanPageName>_analysis.md`** using the `Write` tool. Include:

1. The target section/widget `runtimeClass` and `key`.
2. The full navigation path to each target node (dot-path string).
3. The match strategy at each level (by `key`, `columnName`, `runtimeClass`, etc.).
4. The exact visibility formula and interop syntax to use.
5. The exact modification to apply.

Only after saving the analysis file, present the summary to the user and wait for explicit or implicit confirmation before writing code.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Kanban Page Name** (e.g., `TaskKanbanPage`): The name of the Kanban Page view class being intercepted.
2. **Target Route Class** (e.g., `TaskKanbanPageRoute`): The route class name of the target page.
3. **Target Base Interceptor Class** (e.g., `TaskKanbanPageInterceptor`): The abstract base class of the interceptor defined by the target page.
   - **Precedence Rule**: You must search the `.d.ts` files for classes bound to the target route. If a specialized abstract class has the JSDoc comment `"You MUST extend this instead."`, you **must** select that class as the base class to extend. Do NOT guess or invent the parent class.
4. **Target State Class** (e.g., `TaskKanbanPageState`): The state interface of the target page.
5. **Target Column State Class** (e.g., `TaskKanbanPageColumnState`): The column state interface of the target page.
6. **Target Entity Name** (e.g., `Task`): The name of the model in `glyvio_entity.*` associated with the page.
7. **Listener Unique ID** (e.g., `custom_task_kanban_page_interceptor`): A unique identifier for the registered listener.
8. **Modifications Required**:
   - **Page Design Modifications**: New filters in sidebar, custom buttons, or layout overrides.
   - **Column Design Modifications**: Width changes, color/theme adjustments, or custom header labels.
   - **Card Cell Modifications**: Custom badges, layout decorators, or conditional item colors.
   - **Query Modifications**: Additional database filters or custom ordering.
   - **Column Change Actions**: Custom triggers or side effects when drag-and-dropping cards.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ChipDesign(...)`, NOT `import { ChipDesign } ...`
2. **Route and Class Imports**: Import or reference the target page, route, state, and base interceptor classes from the plugin where the page is defined.
3. **Unique Listener ID**: `getListenerId()` must return a globally unique string in the system.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **Specific Design Hook Selection**: When applying design changes requested by the user, search the abstract base interceptor class (e.g., `<TargetBaseInterceptorClass>`) in the plugin's type definition files to check if there are more specific methods for designing elements (e.g., `getDesignForColumn`, `getDesignForCell`). If a more suitable specific method is found, override that method. Otherwise, fallback to the standard `getDesign` method.
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
    interceptor: YourCustomKanbanPageInterceptor,
    order: 10, // Adjust execution order if necessary (lower numbers run first)
  },
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Import target page classes from their plugin module if needed, e.g.:
// import { <TargetBaseInterceptorClass>, <TargetStateClass>, <TargetColumnStateClass>, <TargetRouteClass> } from 'plugin-name';

/**
 * Custom Interceptor to dynamically augment the behavior of <TargetKanbanPageName>.
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
   * Intercepts the SimpleKanbanPageDesign configuration to inject new filters or buttons.
   * NOTE: Before implementing this, check if <TargetBaseInterceptorClass> defines more specific
   * design methods. If found, override those methods instead of or in addition to `getDesign`.
   */
  override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleKanbanPageDesign): void {
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
   * Intercepts visual details of column structures (width, color, or header widgets).
   */
  override getDesignForColumn(
    state: <TargetStateClass>,
    columnState: <TargetColumnStateClass>,
    design: glyvio_core.SimpleKanbanPageColumnDesign,
  ): void {
    // 💡 Example: Change column width based on status key
  }

  /**
   * Intercepts visual card design layout before rendering each Kanban card cell.
   */
  override getDesignForCell(
    state: <TargetStateClass>,
    columnState: <TargetColumnStateClass>,
    item: glyvio_entity.<TargetEntityName>,
    design: glyvio_core.CardCellDesign,
  ): void {
    // 💡 Example: Highlight cell in red if deleted/overdue
  }

  /**
   * Hook to modify or add criteria to the column query builders.
   */
  override populateQueryBuilder(
    state: <TargetStateClass>,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<TargetEntityName>>,
    columnState?: <TargetColumnStateClass>,
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
   * Intercepts card column drag-and-drop operations to apply custom side effects.
   */
  override async onColumnChange(
    state: <TargetStateClass>,
    columnState: <TargetColumnStateClass>,
    queue: glyvio_entity.EntityServiceQueue,
    item: glyvio_entity.<TargetEntityName>,
  ): Promise<void> {
    // 💡 Example: Mark task done when moved to 'Done' column status key
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
