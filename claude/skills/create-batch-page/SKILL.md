---
name: create-batch-page
description: 'Generates a spreadsheet-style bulk/batch editor page with spreadsheet uploads, row validation, database persistence matching custom layouts, routing, and menu registration for a Glyvio plugin.'
---

# Agent Skill: Create Custom Batch Page View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional spreadsheet-like batch page view (extending `SimpleBatchPage`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_batch_page`
- **Description**: Generates a spreadsheet-style bulk/batch editor page with spreadsheet uploads, row validation, database persistence matching custom layouts, routing, and menu registration for a Glyvio plugin.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Product`, `Task`): The name of the model in `glyvio_entity.*` to bulk edit.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/products-batch`): The URL path (must start with `/` and be a single word/slug).
4. **Editable Columns**:
   - For each column: **FieldName** (e.g., `name`, `price`), **DataType** (e.g., `TEXT`, `DECIMAL`, `BOOLEAN`, `ENTITY`), **Label** (e.g., `Product Name`, `Price`).
5. **Menu Group** (e.g., `Administration` group key: `main-admin`): Where to place the menu item.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ActionButtonDesign(...)`, NOT `import { ActionButtonDesign } ...`
2. **Routing Rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores (no trailing slashes, no multiple segments unless URL-encoded).
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<EntityName>`.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Batch Page View and Route File

Create a new file `src/views/pages/<entity_snake_case>_batch_page.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityBatchPageRoute,
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
      key: 'menu-item-your-entity-batch',
      title: 'Your Entity Batch Editor',
      iconName: 'fa_table_cells', // FontAwesome icon
      colorTheme: 'BLUE', // Theme color
      route: new YourEntityBatchPageRoute(),
    },
  ],
});
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define route params
export interface <EntityName>BatchPageRouteParams extends glyvio_core.SimpleBatchPageRouteParams {}

// Define page state
export interface <EntityName>BatchPageState extends glyvio_core.SimpleBatchPageState<<EntityName>BatchPageRouteParams> {
  // Add page state variables here
}

// Define the spreadsheet Dto interface representing each row
export interface <EntityName>BatchPageDto extends glyvio_core.SimpleBatchPageDto {
  values?: { [key: string]: unknown };
}

/**
 * Route definition for the <EntityName> Batch Page.
 */
export class <EntityName>BatchPageRoute extends glyvio_core.SimpleBatchPageRoute<<EntityName>BatchPageRouteParams> {
  getRoutePath() {
    return '<RoutePath>'; // e.g. '/products-batch'
  }

  getRouteNameSpace() {
    return '<PluginNamespace>';
  }

  getRouteNameObject() {
    return '<EntityName>BatchPage';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_batch_page;
  }
}

/**
 * Custom Batch Page component for displaying and editing <EntityName> entities.
 */
export class <EntityName>BatchPage extends glyvio_core.SimpleBatchPage<
  <EntityName>BatchPageState,
  <EntityName>BatchPageDto
> {
  constructor() {
    super(<EntityName>BatchPageRoute);
  }

  async initState(state: <EntityName>BatchPageState): Promise<void> {
    // Initialize any state parameters here
  }

  /**
   * Configures the layout, appBar title, buttons, and visual sections.
   */
  getDesign(state: <EntityName>BatchPageState, design: glyvio_core.SimpleBatchPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.key = 'appBar';
    appBar.title = '<EntityName> Batch Editor';

    // Add Create New item button in spreadsheet
    appBar.buttons?.push(
      new glyvio_core.ActionButtonDesign({
        key: 'add.button',
        iconName: 'sax_linear_add',
        action: new glyvio_core.Action({
          key: 'add',
        }),
      }),
    );
  }

  /**
   * Processes spreadsheet rows parsed from file upload and maps them into the Dto values.
   */
  async getDtoSpreadsheetFromLine(
    state: <EntityName>BatchPageState,
    cache: glyvio_core.CacheController,
    item: <EntityName>BatchPageDto,
    columns: string[],
    line: { [key: string]: any },
  ): Promise<void> {
    item.values = {};
    item.id = line['id'] || (await glyvio_core.uuidService.v4());

    // Populate Dto properties
    item.values['id'] = item.id;

    // Example for mapping fields from line:
    // item.values['<fieldName1>'] = line['<fieldName1>'];
    <fieldName1_Mapping_Logic>
  }

  /**
   * Converts the Dto representation of a spreadsheet row into a save entity payload queue.
   */
  async getEntitiesFromDto(
    state: <EntityName>BatchPageState,
    item: <EntityName>BatchPageDto,
  ): Promise<glyvio_entity.EntityServiceQueue> {
    const inputPayload: { [key: string]: unknown } = {};

    // Map Dto values back to DB payload fields:
    // inputPayload['<fieldName1>'] = item.values?.['<fieldName1>'] ?? null;
    <fieldName1_DB_Mapping_Logic>

    return [
      {
        structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
        id: item.id!,
        input: inputPayload,
      },
    ];
  }

  /**
   * Maps Dto fields into spreadsheet column import configurations.
   */
  getSpreadsheetLayout(state: <EntityName>BatchPageState): { spreadsheetName: string; dtoName: string }[] {
    return [
      {
        spreadsheetName: 'id',
        dtoName: '$S{item.values.id}',
      },
      // Example for text/string:
      // {
      //   spreadsheetName: '<fieldName1>',
      //   dtoName: '$S{item.values.<fieldName1>}',
      // }
      <fieldName1_SpreadsheetLayout_Logic>
    ];
  }

  /**
   * Defines the editor/textfield controls displayed in the grid columns.
   */
  getDtoLayout(state: <EntityName>BatchPageState): {
    columnName: string;
    columnLabel: string;
    columnDesign: glyvio_core.WidgetDesign;
  }[] {
    return [
      // Example for textfield input:
      // this.generateSimpleStringDtoLayout(
      //   '<fieldName1>',
      //   '<ColumnLabel1>',
      //   'item.values.<fieldName1>',
      // ),
      <fieldName1_DtoLayout_Logic>
    ];
  }

  /**
   * Processes events received from UI actions.
   */
  async events(state: <EntityName>BatchPageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'add') {
      const dto = {} as <EntityName>BatchPageDto;
      dto.values = {};
      dto.__status = 'AWAITING';
      dto.__statusDesc = '';
      await this.addItems(state, [dto]);
      return 'STATE_UPDATE';
    }
    return super.events(state, action);
  }
}

/**
 * Custom Interceptor class for SimpleBatchPage.
 */
export abstract class <EntityName>BatchPageInterceptor extends glyvio_core.SimpleBatchPageInterceptor<
  <EntityName>BatchPageState,
  <EntityName>BatchPageDto
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>BatchPageRoute;
  }
}
```
