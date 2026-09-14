---
name: create-table-modal
description: 'Generates a standard data table search and selection modal, with layout column definitions, filters sidebar, row tap actions, routing, and user config persistence.'
---

# Agent Skill: Create Custom SimpleTableModal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional table search and selection modal (extending `SimpleTableModal`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_table_modal`
- **Description**: Generates a standard data table search and selection modal, with layout column definitions, filters sidebar, row tap actions, routing, and user config persistence.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Product`, `Order`): The name of the model in `glyvio_entity.*` to list in the table modal.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/products-table`): The URL path for the modal (must start with `/` and be a single word/slug).
4. **Table Columns**:
   - **Column key** (e.g., `code`, `name`, `price`).
   - **Column title** (e.g., `Code`, `Name`, `Price`).
   - **Column size** (e.g., `120`, `250`, `100`).
5. **Search/Filters**:
   - Database fields matched in main keyword searches (e.g. `code`, `name`).
   - Sidebar filter fields (e.g. `active`).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.TableLayoutRowDesign(...)`, NOT `import { TableLayoutRowDesign } ...`
2. **Strict Routing rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<EntityName>`.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.
6. **Interpolation syntax — use the correct prefix for each type**:
   - `$S{...}` → String/text values.
   - `$D{...}` → **DateTime only**. NEVER use for Decimal or numeric fields.
   - `$N{...}` → Decimal/Number (counts, amounts, any `Decimal` type).
   - `$T{...}` → Translation/i18n key.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Table Modal File

Create a new file `src/views/modals/<entity_snake_case>_table_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityTableModalRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define custom options/filters for the sidebar
export interface <EntityName>TableModalFilter extends glyvio_core.SimpleTableModalStateFilter {
  showInactive?: boolean;
}

// Define route params
export interface <EntityName>TableModalRouteParams extends glyvio_core.SimpleTableModalRouteQueryParams<<EntityName>TableModalFilter> {}

// Define sidebar states if needed
export interface <EntityName>TableModalRightState extends glyvio_core.SimpleTableModalRightState {}
export interface <EntityName>TableModalLeftState extends glyvio_core.SimpleTableModalLeftState {}

// Define page state
export interface <EntityName>TableModalState extends glyvio_core.SimpleTableModalState<
  <EntityName>TableModalRouteParams,
  <EntityName>TableModalFilter,
  <EntityName>TableModalRightState,
  <EntityName>TableModalLeftState
> {}

/**
 * Route definition for invoking the <EntityName> Table Modal.
 */
export class <EntityName>TableModalRoute extends glyvio_core.SimpleTableModalRoute<<EntityName>TableModalFilter> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/product-table-modal'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<EntityName>TableModal';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_table_modal;
  }
}

/**
 * Custom Table Modal view for listing and searching <EntityName> records.
 */
export class <EntityName>TableModal extends glyvio_core.SimpleTableModal<
  <EntityName>TableModalState,
  glyvio_entity.<EntityName>
> {
  constructor() {
    super(<EntityName>TableModalRoute);
  }

  async initState(state: <EntityName>TableModalState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_TABLE_MODAL';
    await this.loadUserConfig(state);
  }

  /**
   * Configures design details like column headers, title, and filters sidebar.
   */
  getDesign(state: <EntityName>TableModalState, design: glyvio_core.SimpleTableModalDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.title = 'Select <EntityName>';

    design.mainColumns = [
      new glyvio_core.TableLayoutHeaderDesign({
        key: 'code',
        title: 'Code',
        width: 120,
      }),
      new glyvio_core.TableLayoutHeaderDesign({
        key: 'name',
        title: 'Name',
        width: 250,
      }),
    ];

    // Configure sidebar filter layout
    design.filterSectionsDesign?.push(
      new glyvio_core.FormSectionDesign({
        key: 'filters.section',
        childDesign: new glyvio_core.FormLayoutDesign({
          key: 'filter.layout',
          columnSize: 280,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: 'showInactive.formField',
              child: new glyvio_core.BooleanTextfieldDesign({
                key: 'showInactive.textfield',
                name: 'state.filtersSidebar.showInactive',
                label: 'Show Inactive',
              }),
            }),
          ],
        }),
      }),
    );
  }

  /**
   * Defines layout designs for rendering cells inside each table row.
   */
  getDesignForRow(state: <EntityName>TableModalState, item: glyvio_entity.<EntityName>): glyvio_core.TableLayoutRowDesign {
    return new glyvio_core.TableLayoutRowDesign({
      cells: [
        new glyvio_core.TableLayoutCellDesign({
          key: 'code',
          child: new glyvio_core.StringTextDesign({
            value: `$S{item.code}`,
          }),
        }),
        new glyvio_core.TableLayoutCellDesign({
          key: 'name',
          child: new glyvio_core.StringTextDesign({
            value: `$S{item.name}`,
          }),
        }),
      ],
    });
  }

  /**
   * Configures base queries for fetching table data.
   */
  populateQueryBuilder(state: <EntityName>TableModalState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>)
      .addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.name);

    if (!(state.filtersSidebar?.showInactive ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Filters matching text from the main keyword search box.
   */
  populateMainFilter(state: <EntityName>TableModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterILike({
      field: glyvio_structure.AllEntities.<entityNameCamelCase>.name,
      value: text,
      ors: [
        new glyvio_core.QueryBuilderFilterILike({
          field: glyvio_structure.AllEntities.<entityNameCamelCase>.code,
          value: text,
        }),
      ],
    });
  }

  /**
   * Callback fired when a table row is tapped.
   */
  async onRowTap(state: <EntityName>TableModalState, item: glyvio_entity.<EntityName>): Promise<void> {
    if (state.routeParams.popActionKey) {
      await this.popModal({
        key: state.routeParams.popActionKey,
        data: item,
      });
    } else {
      await this.popModal();
    }
  }

  /**
   * Defines tracking references for refreshing this database entity.
   */
  getEntityToTracking(item: glyvio_entity.<EntityName>): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
      objectId: item.id!,
    };
  }

  async events(state: <EntityName>TableModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }
    return undefined;
  }
}

/**
 * Custom Interceptor class for SimpleTableModal.
 */
export abstract class <EntityName>TableModalInterceptor extends glyvio_core.SimpleTableModalInterceptor<
  <EntityName>TableModalState,
  glyvio_entity.<EntityName>
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>TableModalRoute;
  }
}
```
