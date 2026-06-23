---
name: create-table-modal-interceptor
description: 'Generates a custom class extending an abstract `SimpleTableModalInterceptor` to dynamically modify table modal layout headers, row styles, database query filters, sidebar layouts, and sidebar load actions, and registers it.'
---

# Agent Skill: Create SimpleTableModal Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register an interceptor/listener to customize the behavior of an existing `SimpleTableModal` view in another project.

---

## 🎯 Skill Metadata

- **Name**: `create_table_modal_interceptor`
- **Description**: Generates a custom class extending an abstract `SimpleTableModalInterceptor` to dynamically modify table modal layout headers, row styles, database query filters, sidebar layouts, and sidebar load actions, and registers it.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## ⚙️ Pre-Execution

### Step 0 — Collect the current design JSON using SpyInterceptor

1. Determine the temp file path: `.claude/temp<ModalName>_design.json` (e.g., `ProductTableModal_design.json`).
2. Check if that file already exists. If it does, remove/delete the file from disk and proceed with the collection flow normally to capture a fresh design.
3. Create and register a temporary **SpyInterceptor** in the plugin:
   - Create a file `src/interceptors/views/spy_interceptor.ts`.
   - Implement `SpyInterceptor` extending `<TargetBaseInterceptorClass>` to capture the `design` in `getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleTableModalDesign)`:
     ```typescript
     export class SpyInterceptor extends <TargetBaseInterceptorClass> {
       override getListenerId(): string {
         return 'gramil_SpyInterceptor';
       }
       override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
         return <TargetRouteClass>;
       }
       override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleTableModalDesign): void {
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
   - Ask the user to make sure Chrome is running with remote debugging enabled (`--remote-debugging-port=9222`) and that the target modal is open/active.
   - Run the script `.claude/scripts/chrome_inspector.js` via `run_command` to connect to Chrome, automatically wait for `window.__finalDesign` to be populated, and save the retrieved JSON to `.claude/temp<ModalName>_design.json`.
     _Command:_ `node .claude/scripts/chrome_inspector.js <ModalName>` (e.g., `node .claude/scripts/chrome_inspector.js ProductTableModal`).
     _(Note: This script automatically starts an `httpster` server on port 9998 with CORS enabled serving `plugin/app/dist` beforehand, injects the localStorage rules for `app_rule_plugins` and `USER_PREFERENCE`, reloads the page to apply them, and automatically reconnects to continue polling.)_
5. Once the design JSON is collected and saved to `.claude/temp<ModalName>_design.json`, remove the temporary `SpyInterceptor` and its registration from the codebase, and run `pnpm build` again to clean up the compiled distribution.
6. If Chrome debugging is not available or fails, fallback to asking the user to send the **current design JSON** of the modal (obtained from `modal.getDesignRaw(state)` or the console) in the next message, or to save it manually to `.claude/temp<ModalName>_design.json`.
7. Do NOT proceed to Step 0.1 until the JSON is saved to disk.

### Step 0.1 — Interpret the design JSON (read-only)

**THE JSON IS THE GROUND TRUTH.** Do NOT use prior knowledge about modal structure. Every navigation decision in the generated code must be derived exclusively from what the JSON contains.
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

After completing the Step 0.1 analysis, **immediately write the findings to `.claude/temp<ModalName>_analysis.md`** using the `Write` tool. Include:

1. The target section/widget `runtimeClass` and `key`.
2. The full navigation path to each target node (dot-path string).
3. The match strategy at each level (by `key`, `columnName`, `runtimeClass`, etc.).
4. The exact visibility formula and interop syntax to use.
5. The exact modification to apply.

Only after saving the analysis file, present the summary to the user and wait for explicit or implicit confirmation before writing code.

### Step 0.3 — Collect the current row design (only if row modifications are required)

If the task requires modifications to the row layout (i.e., implementing or changing `getDesignForRow`), **before writing any code**, ask the user for the current **row design JSON**.

Prompt the user with a message like:

> "This task requires modifying the table modal row design. Please provide the current `TableLayoutRowDesign` JSON for a sample row. You can obtain it by temporarily adding a `console.log(JSON.stringify(design))` inside a `getDesignForRow` override, then copying the output from the browser console."

- Save the received JSON to `.claude/temp<ModalName>_rowDesign.json`.
- **Do NOT proceed to Step 1 (code generation) until this JSON is received and saved.**
- Use this JSON as the ground truth for the row structure, applying the same rules from Step 0.1: use `runtimeClass` for type matching, use `findWidgetByKey` for targeting nodes, and derive all navigation paths exclusively from the JSON content.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Table Modal Name** (e.g., `ProductTableModal`): The name of the Table Modal view class being intercepted.
2. **Target Route Class** (e.g., `ProductTableModalRoute`): The route class name of the target modal.
3. **Target Base Interceptor Class** (e.g., `ProductTableModalInterceptor`): The abstract base class of the interceptor defined by the target modal.
   - **Precedence Rule**: You must search the `.d.ts` files for classes bound to the target route. If a specialized abstract class has the JSDoc comment `"You MUST extend this instead."`, you **must** select that class as the base class to extend. Do NOT guess or invent the parent class.
4. **Target State Class** (e.g., `ProductTableModalState`): The state interface of the target modal.
5. **Target Entity Name** (e.g., `Product`): The name of the model in `glyvio_entity.*` associated with the modal.
6. **Listener Unique ID** (e.g., `custom_product_table_modal_interceptor`): A unique identifier for the registered listener.
7. **Modifications Required**:
   - **Modal Design Modifications**: Customize headers, change widths, or inject new column configurations.
   - **Row Layout Modifications**: Customize rendering styles or color themes for specific row items.
   - **Query Modifications**: Enforce additional query restrictions (e.g., workspace-specific filters) or ordering.
   - **Sidebar Configurations**: Return or modify left/right sidebars or intercept dynamic sidebar load events.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.TableLayoutCellDesign(...)`, NOT `import { TableLayoutCellDesign } ...`
2. **Route and Class Imports**: Import or reference the target modal, route, state, and base interceptor classes from the plugin where the modal is defined.
3. **Unique Listener ID**: `getListenerId()` must return a globally unique string in the system.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **Specific Design Hook Selection**: When applying design changes requested by the user, search the abstract base interceptor class (e.g., `<TargetBaseInterceptorClass>`) in the plugin's type definition files to check if there are more specific methods for designing elements (e.g., `getDesignForRow`). If a more suitable specific method is found, override that method. Otherwise, fallback to the standard `getDesign` method.
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
    interceptor: YourCustomTableModalInterceptor,
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
 * Custom Interceptor to dynamically augment the behavior of <TargetTableModalName>.
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
   * Intercepts the SimpleTableModalDesign configuration to customize visual layouts or App Bars.
   * NOTE: Before implementing this, check if <TargetBaseInterceptorClass> defines more specific
   * design methods. If found, override those methods instead of or in addition to `getDesign`.
   */
  override getDesign(state: <TargetStateClass>, design: glyvio_core.SimpleTableModalDesign): void {
    // Use findWidgetByKey to search and modify a target widget by its key
    const targetWidget = design.findWidgetByKey('your_target_key');
    if (targetWidget) {
      // Apply mutations here, e.g.:
      // targetWidget.visible = false;
    }

    // Example: Append a new column header dynamically
    // design.mainColumns?.push(
    //   new glyvio_core.TableLayoutHeaderDesign({
    //     key: 'custom_field',
    //     title: 'Custom Field',
    //     width: 150,
    //   })
    // );
  }

  /**
   * Intercepts and alters cell layout designs representing rows inside the table.
   */
  override getDesignForRow(
    state: <TargetStateClass>,
    item: glyvio_entity.<TargetEntityName>,
    design: glyvio_core.TableLayoutRowDesign,
  ): void {
    // 💡 Example: Inject cell content for the custom column added in getDesign
  }

  /**
   * Injects database query builder filters.
   */
  override populateQueryBuilder(
    state: <TargetStateClass>,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<TargetEntityName>>,
  ): void {
    // 💡 Example: Filter out soft-deleted items
  }

  /**
   * Injects query restrictions on the main top search filter.
   */
  override populateMainFilter(
    state: <TargetStateClass>,
    filter: glyvio_core.QueryBuilderFilter,
    text: string,
  ): void {
    // 💡 Example: Add more keyword match criteria to searches
  }

  /**
   * Intercepts and formats left sidebars.
   */
  override getLeftSidebar(
    state: <TargetStateClass>,
    design: glyvio_core.SimpleTableSidebarModalDesign | undefined,
  ): glyvio_core.SimpleTableSidebarModalDesign | undefined {
    return design;
  }

  /**
   * Intercepts and formats right sidebars.
   */
  override getRightSidebar(
    state: <TargetStateClass>,
    design: glyvio_core.SimpleTableSidebarModalDesign | undefined,
  ): glyvio_core.SimpleTableSidebarModalDesign | undefined {
    return design;
  }

  /**
   * Hook called when a left sidebar load action is triggered.
   */
  override async loadLeftSidebar(state: <TargetStateClass>, item: glyvio_entity.<TargetEntityName>): Promise<void> {
    // 💡 Example: Fetch extra information to populate leftState
  }

  /**
   * Hook called when a right sidebar load action is triggered.
   */
  override async loadRightSidebar(state: <TargetStateClass>, item: glyvio_entity.<TargetEntityName>): Promise<void> {
    // 💡 Example: Fetch extra information to populate rightState
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
   * Intercepts modal actions/events.
   */
  override async onEvent(state: <TargetStateClass>, key: string, data: unknown): Promise<void> {
    // Handle specific button taps or other custom events
  }
}
```
