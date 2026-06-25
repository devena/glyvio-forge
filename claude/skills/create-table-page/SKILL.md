---
name: create-table-page
description: 'Generates a standard entity table page with spreadsheet-like columns, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.'
---

# Agent Skill: Create Custom Table Page View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional table page view (extending `SimpleTablePage`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_table_page",
  "description": "Generates a standard entity table page with spreadsheet-like columns, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName":       { "type": "string", "description": "Entity model name in glyvio_entity.* (e.g., Product, Customer)" },
      "pluginNamespace":  { "type": "string", "description": "Plugin namespace string (e.g., my_plugin)" },
      "routePath":        { "type": "string", "description": "URL path starting with / (e.g., /products)" },
      "columns":          { "type": "array", "items": { "type": "object", "properties": { "field": { "type": "string" }, "label": { "type": "string" } } }, "description": "Table columns — each entry is { field, label }" },
      "sidebarFilters":   { "type": "array", "items": { "type": "string" }, "description": "Field names to expose as sidebar filter controls" },
      "mainSearchFields": { "type": "array", "items": { "type": "string" }, "description": "Fields matched when typing in the top search bar" },
      "menuGroup":        { "type": "string", "description": "Menu group key and display name where the page item will appear" }
    },
    "required": ["entityName", "pluginNamespace", "routePath", "columns", "mainSearchFields", "menuGroup"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Product`, `Customer`): The name of the model in `glyvio_entity.*` to display in the table.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/products-table`): The URL path (must start with `/` and be a single word/slug).
4. **Display Columns**:
   - For each column: **FieldName** (e.g., `code`, `name`), **Label** (e.g., `Code`, `Name`), **Width** (e.g., `100`, `150`, `'LARGE'`), and **Child Design Type** (e.g., `StringTextDesign`, `ChipDesign`).
5. **Sidebar Filters** (e.g., `category`, `status`): Fields to build filter controls for.
6. **Main Search Fields** (e.g., `name`, `code`): Fields matched when typing in the top search bar.
7. **Menu Group** (e.g., `Administration` group key: `main-admin`): Where to place the menu item.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.TableLayoutRowDesign(...)`, NOT `import { TableLayoutRowDesign } ...`
2. **Routing Rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores (no trailing slashes, no multiple segments unless URL-encoded).
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

### Step 1: Create the Table Page View and Route File

Create a new file `src/views/pages/<entity_snake_case>_table_page.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityTablePageRoute,
]);
```

### Step 3: Register the Main Navigation Menu Item

Register the view in the main app menu sidebar:

```typescript
glyvio_core.FullMenuPage.fullMenuGroupAdd({
  key: 'group_key',
  name: 'Group Name',
  position: 100, // Customize positioning
  items: [
    {
      key: 'menu-item-your-entity-table',
      title: 'Your Entity Table',
      iconName: 'fa_table', // FontAwesome icon
      colorTheme: 'BLUE', // Theme color
      route: new YourEntityTablePageRoute(),
    },
  ],
});
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define state filters for the sidebar
export interface <EntityName>TableFilter extends glyvio_core.SimpleTablePageStateFilter {
  // Add sidebar filters here (e.g., category?: string;)
  <filterField1>?: string;
  showDeleted?: boolean;
}

// Define route params
export interface <EntityName>TableRouteParams extends glyvio_core.SimpleTablePageRouteParams<<EntityName>TableFilter> {}

// Define page state
export interface <EntityName>TablePageState
  extends glyvio_core.SimpleTablePageState<<EntityName>TableRouteParams, <EntityName>TableFilter> {}

/**
 * Route definition for the <EntityName> Table Page.
 */
export class <EntityName>TablePageRoute extends glyvio_core.SimpleTablePageRoute<<EntityName>TableRouteParams> {
  getRoutePath() {
    return '<RoutePath>'; // e.g., '/products-table'
  }

  getRouteNameSpace() {
    return '<PluginNamespace>';
  }

  getRouteNameObject() {
    return '<EntityName>TablePage';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_table_page;
  }
}

/**
 * Custom Table Page component for displaying <EntityName> entities.
 */
export class <EntityName>TablePage extends glyvio_core.SimpleTablePage<<EntityName>TablePageState, glyvio_entity.<EntityName>> {
  constructor() {
    super(<EntityName>TablePageRoute);
    this.extensionsManager.registerReport(this);
  }

  async initState(state: <EntityName>TablePageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_TABLE_PAGE';
    await this.loadUserConfig(state);
  }

  /**
   * Configures the columns, search layout, and sidebar filters.
   */
  getDesign(state: <EntityName>TablePageState, design: glyvio_core.SimpleTablePageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.key = 'appBar';
    appBar.title = '<EntityName> Table';

    // Add Create New item button
    appBar.putButtonOn(
      new glyvio_core.ActionButtonDesign({
        key: 'new.button',
        type: 'SECONDARY',
        iconName: 'sax_linear_add',
        action: new glyvio_core.Action({
          key: 'new',
          data: {},
        }),
      }),
      0,
    );
    appBar.putButtonOn(this.extensionsManager.report!.getButton());

    // Define table columns
    design.columns = [
      new glyvio_core.TableLayoutColumnDesign({
        columnName: '<fieldName1>',
        width: 150,
        key: '<fieldName1>.column',
        child: new glyvio_core.StringTextDesign({ key: '<fieldName1>.text', value: '<ColumnLabel1>' }),
      }),
      // Add more columns as needed
      new glyvio_core.TableLayoutColumnDesign({
        width: 80,
        columnName: 'options',
        key: 'options.column',
        child: new glyvio_core.StringTextDesign({ value: '' }),
      }),
    ];

    // Build sidebar filter components
    design.filterSectionsDesign?.push(
      new glyvio_core.FormSectionDesign({
        key: 'filters.section',
        childDesign: new glyvio_core.FormLayoutDesign({
          key: 'filters.layout',
          columnSize: 280,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: 'showDeleted.formField',
              child: new glyvio_core.BooleanTextfieldDesign({
                key: 'showDeleted.textfield',
                name: 'state.filtersSidebar.showDeleted',
                label: 'Show Deleted',
              }),
            }),
          ],
        }),
      }),
    );
  }

  /**
   * Formats how each database record is mapped to the table row cells.
   */
  public getDesignForRow(state: <EntityName>TablePageState, item: glyvio_entity.<EntityName>): glyvio_core.TableLayoutRowDesign {
    return new glyvio_core.TableLayoutRowDesign({
      cells: [
        new glyvio_core.TableLayoutCellDesign({
          columnName: '<fieldName1>',
          key: '<fieldName1>.cell',
          child: new glyvio_core.StringTextDesign({
            key: '<fieldName1>.text',
            value: '$S{item.<fieldName1>}',
          }),
        }),
        // Option cell
        new glyvio_core.TableLayoutCellDesign({
          columnName: 'options',
          key: 'options.cell',
          child: new glyvio_core.OptionsButtonDesign({
            key: 'options.button',
            keyLoadingListener: `options_$S{item.id}`,
            actions: [
              new glyvio_core.OptionActionDesign({
                key: 'delete.option',
                title: 'Delete',
                visible: '{{#if item.deleted}}false{{else}}true{{/if}}',
                action: new glyvio_core.Action({
                  key: 'confirmDelete',
                  keyLoadingComponent: `options_$S{item.id}`,
                  data: { id: '$S{item.id}' },
                }),
              }),
            ],
          }),
        }),
      ],
    });
  }

  /**
   * Builds the database select query and applies filters.
   */
  populateQueryBuilder(
    state: <EntityName>TablePageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
  ): void {
    queryBuilder.setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>);
    queryBuilder.addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>, 'ASC');

    if (!(state.filtersSidebar?.showDeleted ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Formats query filter matching the main top search bar input.
   */
  populateMainFilter(state: <EntityName>TablePageState, text: string): glyvio_core.QueryBuilderFilter {
     return new glyvio_core.QueryBuilderFilter({
      ors: [
        new glyvio_core.QueryBuilderFilterILike({
          field: glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>,
          value: text,
        }),
      ],
     });
  }

  /**
   * Processes events received from UI actions (like delete confirmation).
   */
  async events(state: <EntityName>TablePageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'new') {
      await this.onTapNew(state);
      return 'STATE_FREEZED';
    }

    if (action.key === 'confirmDelete') {
      await this.showConfirmationError(
        state,
        'Delete <EntityName>',
        'Are you sure you want to delete this item?',
        'delete',
        action.data,
      );
      return 'STATE_FREEZED';
    }

    if (action.key === 'delete') {
      await this.onDelete(state, action.data.id);
      return 'STATE_FREEZED';
    }

    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }

    return undefined;
  }

  async onTapNew(state: <EntityName>TablePageState): Promise<void> {
    // Navigation to create new record
  }

  async onDelete(state: <EntityName>TablePageState, id: string): Promise<void> {
    await glyvio_core.entityService.saveInput({ deleted: true }, glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(), id);
    await this.showToastSuccess(state, '<EntityName> deleted successfully.');
  }

  /**
   * Defines navigation action when a row is clicked/tapped.
   */
  async onRowTap(state: <EntityName>TablePageState, item: glyvio_entity.<EntityName>): Promise<void> {
    // Implement navigation or callback here
  }

  /**
   * Hooks into activity/telemetry tracking.
   */
  getEntitiesListenning(_state: <EntityName>TablePageState): glyvio_core.EntityListenning[] {
    return [
      new glyvio_core.EntityListenning({
        objectId: '*',
        structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
      }),
    ];
  }

  /**
   * Hooks into activity/telemetry tracking.
   */
  getEntityToTracking(item: glyvio_entity.<EntityName>): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
      objectId: item.id!,
    };
  }
}
```
