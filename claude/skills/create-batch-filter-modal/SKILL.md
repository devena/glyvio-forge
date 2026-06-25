---
name: create-batch-filter-modal
description: 'Generates a batch entity filter modal extending SimpleBatchFilterEditModal, with a filter form, results table, query builder, routing, and interceptor hooks.'
---

# Agent Skill: Create Batch Filter Modal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional batch filter modal (extending `SimpleBatchFilterEditModal`) within a Glyvio plugin project.

The modal allows users to apply filters, preview a count and a list of matching records, and confirm the selection — returning the matched IDs to the caller via `popActionKey`.

---

## 🎯 Skill Metadata

- **Name**: `create_batch_filter_modal`
- **Description**: Generates a batch entity filter modal extending `SimpleBatchFilterEditModal`, with a filter form, results table, query builder, routing, and interceptor hooks.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Client`, `Product`): The name of the model in `glyvio_entity.*` to filter.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/client-batch-filter`): The URL path for the modal (must start with `/`).
4. **Filter Fields**: Fields the user can fill in to narrow the search.
   - **Field name** (e.g., `name`, `code`).
   - **Field type** → design class (e.g., `string` → `StringTextfieldDesign`, `boolean` → `BooleanTextfieldDesign`, `decimal` → `DecimalTextfieldDesign`).
   - **Label** (e.g., `Name`, `Code`).
5. **Result Columns**: Fields to show in the results table after searching.
   - **Column label** (e.g., `Name`, `Code`).
   - **Entity field path** (e.g., `item.name`, `item.code`).
6. **Query Logic**: How to translate filter state fields into `QueryBuilder` filters (e.g., `ILike` on `name`, exact match on `active`).
7. **Route Permission** (e.g., `glyvio_permissions.view_client_batch_filter_modal`): The permission constant required to access the modal.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.FormSectionDesign(...)`, NOT `import { FormSectionDesign } ...`
2. **Always call `super.getDesign(state, design)` first**: The base class sets up the action bar and resets `sectionsDesign`. Skipping this breaks the Cancel/Search/Select buttons.
3. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
4. **State filter fields live directly on the state interface**: Add filter fields directly to `<EntityName>BatchFilterModalState` (not in a nested object), since the state itself acts as the filter container.
5. **`generateQueryBuilder()` must NOT call interceptors**: The base class calls them automatically via `buildFinalQueryBuilder()`. Only build and return the base query here.
6. **`events()` — EventReturn rule**: Do NOT override `events()` unless you need to handle additional action keys. The base class already handles `search`, `select`, and `cancel`. If you add a new key, return `'STATE_UPDATE'` for state mutations and `'STATE_FREEZED'` for navigation actions.
7. **Results are populated automatically by the base class**: `state.results` and `state.count` are set when the user clicks "Search". Use them read-only in `getDesign()`.
8. **Interpolation syntax — use the correct prefix for each type**:
   - `$S{...}` → String/text values.
   - `$D{...}` → **DateTime only**. NEVER use for Decimal or numeric fields.
   - `$N{...}` → Decimal/Number (counts, amounts, any `Decimal` type).
   - `$T{...}` → Translation/i18n key.
9. **`interopDesign.stateName` must always be prefixed with `state.`**: Use `stateName: 'state.results'`, never `stateName: 'results'`. The interop engine evaluates `data.<stateName>` where `data` is the full state object, so the prefix is required.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Batch Filter Modal File

Create a new file `src/views/modals/<entity_snake_case>_batch_filter_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  <EntityName>BatchFilterModalRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters.

```typescript
/**
 * Route parameters for navigating to the <EntityName> Batch Filter Modal.
 * `popActionKey` is the action key sent back to the caller with the selected IDs.
 */
export interface <EntityName>BatchFilterModalRouteParams extends glyvio_core.SimpleBatchFilterEditModalRouteParams {}

/**
 * State for the <EntityName> Batch Filter Modal.
 * Add filter fields here — they are bound directly to the filter form.
 */
export interface <EntityName>BatchFilterModalState
  extends glyvio_core.SimpleBatchFilterEditModalState<
    <EntityName>BatchFilterModalRouteParams,
    glyvio_entity.<EntityName>
  > {
  // Filter fields (bound to form inputs):
  <filterField1>?: string | null;   // e.g. name filter
  // <filterField2>?: boolean | null; // e.g. active filter
}

/**
 * Route definition for registering <EntityName>BatchFilterModal.
 */
export class <EntityName>BatchFilterModalRoute extends glyvio_core.SimpleBatchFilterEditModalRoute<<EntityName>BatchFilterModalRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/client-batch-filter'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<EntityName>BatchFilterModal';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.<PermissionName>;
  }
}

/**
 * Batch Filter Modal for selecting multiple <EntityName> records by filter criteria.
 *
 * Flow:
 *  1. User fills in filter fields and clicks "Search".
 *  2. The modal shows the count and up to 20 matching records.
 *  3. User clicks "Select" to confirm — the caller receives all matching IDs via `popActionKey`.
 */
export class <EntityName>BatchFilterModal extends glyvio_core.SimpleBatchFilterEditModal<
  <EntityName>BatchFilterModalState,
  glyvio_entity.<EntityName>
> {
  constructor() {
    super(<EntityName>BatchFilterModalRoute);
  }

  /**
   * Builds the base QueryBuilder applying the current filter state.
   * Do NOT call interceptors here — the base class applies them automatically.
   */
  generateQueryBuilder(state: <EntityName>BatchFilterModalState): glyvio_core.QueryBuilder<glyvio_entity.<EntityName>> {
    const qb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(
      glyvio_structure.AllEntities.<entityNameCamelCase>,
    );

    // Apply filter fields from state:
    if (state.<filterField1>) {
      qb.addFilterOperator(
        glyvio_structure.AllEntities.<entityNameCamelCase>.<filterField1>,
        new glyvio_core.QueryBuilderFilterILike({
          field: glyvio_structure.AllEntities.<entityNameCamelCase>.<filterField1>,
          value: state.<filterField1>,
        }),
      );
    }

    // Add ordering:
    qb.addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<filterField1>);

    return qb;
  }

  /**
   * Defines the modal design: filter form fields and the results preview table.
   * Always call super.getDesign() first to set up action bar and reset sectionsDesign.
   */
  getDesign(state: <EntityName>BatchFilterModalState, design: glyvio_core.SimpleEditModalDesign): void {
    super.getDesign(state, design);

    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      title: 'Filter <EntityName>',
    });

    // --- Filter form section ---
    design.sectionsDesign!.push(
      new glyvio_core.FormSectionDesign({
        key: 'filter.section',
        childDesign: new glyvio_core.FormLayoutDesign({
          key: 'filter.layout',
          columnSize: 280,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: '<filterField1>.formField',
              child: new glyvio_core.StringTextfieldDesign({
                name: 'state.<filterField1>',
                label: '<FilterField1Label>',
              }),
            }),
            // Add more filter fields here (BooleanTextfieldDesign, DecimalTextfieldDesign, etc.)
          ],
        }),
      }),
    );

    // --- Results preview section (only shown after Search) ---
    if (state.results != null) {
      design.sectionsDesign!.push(
        new glyvio_core.ListSectionDesign({
          key: 'results.section',
          appBarDesign: new glyvio_core.SimpleAppBarDesign({
            key: 'results.appBar',
            title: `$T{glyvio_simpleBatchFilter_select} ($N{state.count})`,
          }),
          interopDesign: {
            stateName: 'state.results',
            variableName: 'item',
            childDesign: new glyvio_core.LineCellDesign({
              padding: '12 16',
              child: new glyvio_core.RowLayoutDesign({
                children: [
                  new glyvio_core.RowLayoutFieldDesign({
                    isExpanded: true,
                    child: new glyvio_core.ColumnLayoutDesign({
                      children: [
                        new glyvio_core.ColumnLayoutFieldDesign({
                          child: new glyvio_core.StringTextDesign({
                            value: `$S{item.<resultField1>}`,
                            style: 'TITLE_SMALL',
                          }),
                        }),
                        // Add more fields here, e.g.:
                        // new glyvio_core.ColumnLayoutFieldDesign({
                        //   child: new glyvio_core.StringTextDesign({
                        //     value: `$S{item.<resultField2>}`,
                        //     style: 'BODY_SMALL',
                        //   }),
                        // }),
                      ],
                    }),
                  }),
                ],
              }),
            }),
          },
        }),
      );
    }
  }
}

/**
 * Interceptor allowing other plugins to add extra filters to the <EntityName> batch filter query.
 *
 * Extend this class in another plugin to hook into the query pipeline.
 *
 * @example
 * ```typescript
 * export class MyCustom<EntityName>BatchFilterInterceptor extends <EntityName>BatchFilterModalInterceptor {
 *   override getListenerId() { return 'my_plugin_<entityNameSnakeCase>_batch_filter'; }
 *   override populateQueryBuilder(state, qb) {
 *     qb.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.active, true);
 *   }
 * }
 * ```
 */
export abstract class <EntityName>BatchFilterModalInterceptor extends glyvio_core.SimpleBatchFilterEditModalInterceptor<
  <EntityName>BatchFilterModalState,
  glyvio_entity.<EntityName>
> {
  override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>BatchFilterModalRoute;
  }

  /**
   * Called after the base query is built.
   * Override to add extra joins, filters, or ordering to the QueryBuilder.
   */
  override populateQueryBuilder(
    state: <EntityName>BatchFilterModalState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
  ): void {}
}
```

---

## 📌 Usage Notes

- **Caller side**: Open the modal by pushing a route with `popActionKey` set. The modal returns `{ ids: string[] }` in `action.data` via `popActionKey`.
- **Interceptor skill**: To add extra query filters from another plugin, use the `create-batch-filter-modal-interceptor` skill (extends `<EntityName>BatchFilterModalInterceptor`).
- **Result limit**: The "Search" action always fetches a maximum of 20 records for preview. The "Select" action runs a separate unlimited query and returns all matching IDs — not just the 20 previewed.
