---
name: create-grid-page
description: 'Generates a standard entity grid/gallery page with responsive grid cells, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.'
---

# Agent Skill: Create Custom Grid Page View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional grid page view (extending `SimpleGridPage`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_grid_page`
- **Description**: Generates a standard entity grid/gallery page with responsive grid cells, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Product`, `Customer`): The name of the model in `glyvio_entity.*` to display in the grid.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/products-grid`): The URL path (must start with `/` and be a single word/slug).
4. **Display Fields**:
   - **Title field** (e.g., `name`): The field to display as the primary text of each card cell.
   - **Subtitle field** (e.g., `code`, `description`): The field to display as secondary text.
5. **Grid Size Config**:
   - **Cell Height** (e.g., `100`): Vertical height of each card in pixels.
   - **Cell Width** (e.g., `400`): Horizontal width of each card in pixels.
6. **Sidebar Filters** (e.g., `status`, `category`): Fields to build filter controls for.
7. **Main Search Fields** (e.g., `name`, `code`): Fields matched when typing in the top search bar.
8. **Menu Group** (e.g., `Administration` group key: `main-admin`): Where to place the menu item.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.CardCellDesign(...)`, NOT `import { CardCellDesign } ...`
2. **Routing Rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores (no trailing slashes, no multiple segments unless URL-encoded).
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<EntityName>`.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Grid Page View and Route File

Create a new file `src/views/pages/<entity_snake_case>_grid_page.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityGridPageRoute,
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
      key: 'menu-item-your-entity-grid',
      title: 'Your Entity Grid',
      iconName: 'fa_grip', // FontAwesome icon
      colorTheme: 'BLUE', // Theme color
      route: new YourEntityGridPageRoute(),
    },
  ],
});
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define state filters for the sidebar
export interface <EntityName>GridPageRouteFilter extends glyvio_core.SimpleGridPageStateFilter {
  showDeleted?: boolean;
  <filterField1>?: string;
}

// Define route params
export interface <EntityName>GridPageRouteParams extends glyvio_core.SimpleGridPageRouteParams<<EntityName>GridPageRouteFilter> {}

// Define page state
export interface <EntityName>GridPageState
  extends glyvio_core.SimpleGridPageState<<EntityName>GridPageRouteParams, <EntityName>GridPageRouteFilter> {}

/**
 * Route definition for the <EntityName> Grid Page.
 */
export class <EntityName>GridPageRoute<Q extends <EntityName>GridPageRouteParams> extends glyvio_core.SimpleGridPageRoute<Q> {
  getRoutePath() {
    return '<RoutePath>'; // e.g. '/products-grid'
  }

  getRouteNameSpace() {
    return '<PluginNamespace>';
  }

  getRouteNameObject() {
    return '<EntityName>GridPage';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_grid_page;
  }
}

/**
 * Custom Grid Page component for displaying <EntityName> entities.
 */
export class <EntityName>GridPage extends glyvio_core.SimpleGridPage<<EntityName>GridPageState, glyvio_entity.<EntityName>> {
  constructor() {
    super(<EntityName>GridPageRoute);
    this.extensionsManager.registerReport(this);
  }

  async initState(state: <EntityName>GridPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_GRID_PAGE';
    await this.loadUserConfig(state);
  }

  /**
   * Configures visual components of the parent grid design view.
   */
  getDesign(state: <EntityName>GridPageState, design: glyvio_core.SimpleGridPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.key = 'appBar';
    appBar.title = '<EntityName> Grid';

    // Add Create New item button in AppBar
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

    // Grid item cell size overrides
    design.cellHeight = <CellHeight>; // e.g., 100
    design.cellWidth = <CellWidth>; // e.g., 400

    // Build sidebar filter components
    design.filterSectionsDesign?.push(
      new glyvio_core.FormSectionDesign({
        key: 'filters.section',
        childDesign: new glyvio_core.FormLayoutDesign({
          key: 'filter.layout',
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
   * Customizes card designs representing single entity grid items.
   */
  getDesignForCell(state: <EntityName>GridPageState, item: glyvio_entity.<EntityName>): glyvio_core.CardCellDesign {
    return new glyvio_core.CardCellDesign({
      colorTheme: item.deleted ? 'RED' : null,
      padding: '16',
      child: new glyvio_core.RowLayoutDesign({
        crossAlignment: 'CENTER',
        children: [
          new glyvio_core.RowLayoutFieldDesign({
            isExpanded: true,
            key: 'name.cell',
            child: new glyvio_core.StringTextDesign({
              key: 'name.text',
              value: item.<TitleField> ?? 'Unnamed Item',
            }),
          }),
          new glyvio_core.RowLayoutFieldDesign({
            visible: item.deleted === true,
            key: 'deleted.cell',
            child: new glyvio_core.ChipDesign({
              label: 'Deleted',
              colorTheme: 'RED',
            }),
          }),
        ],
      }),
    });
  }

  /**
   * Applies database query constraints when loading grid elements.
   */
  populateQueryBuilder(state: <EntityName>GridPageState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>): void {
    queryBuilder.setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>);
    queryBuilder.addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>, 'ASC');

    if (!(state.filtersSidebar?.showDeleted ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Maps general text-based search queries to database filters.
   */
  populateMainFilter(state: <EntityName>GridPageState, text: string): glyvio_core.QueryBuilderFilter {
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
   * Callback invoked when tapping/clicking a specific grid cell card.
   */
  async onCellTap(state: <EntityName>GridPageState, item: glyvio_entity.<EntityName>): Promise<void> {
    // Navigate to detail page/modal:
    // await this.pushPage(new YourEntityEditPageRoute({ id: item.id }));
  }

  /**
   * Event handlers for visual triggers (like create new item).
   */
  async events(state: <EntityName>GridPageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'new') {
      // await this.pushModal(new YourEntityEditModalRoute());
      return 'STATE_FREEZED';
    }

    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }

    return undefined;
  }

  /**
   * Database entity subscription listening.
   */
  getEntitiesListenning(state: <EntityName>GridPageState): glyvio_core.EntityListenning[] {
    return [
      new glyvio_core.EntityListenning({
        objectId: '*',
        structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
      }),
    ];
  }

  /**
   * Entity tracking parameters definition.
   */
  getEntityToTracking(item: glyvio_entity.<EntityName>): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
      objectId: item.id!,
    };
  }
}
```
