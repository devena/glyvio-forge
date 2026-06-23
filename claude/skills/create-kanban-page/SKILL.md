---
name: create-kanban-page
description: 'Generates a standard entity Kanban board page with status columns, drag-and-drop column changes, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.'
---

# Agent Skill: Create Custom Kanban Page View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional Kanban board page view (extending `SimpleKanbanPage`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_kanban_page",
  "description": "Generates a standard entity Kanban board page with status columns, drag-and-drop column changes, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName":      { "type": "string", "description": "Entity model name in glyvio_entity.* (e.g., Sale, Task)" },
      "pluginNamespace": { "type": "string", "description": "Plugin namespace string (e.g., my_plugin)" },
      "routePath":       { "type": "string", "description": "URL path starting with / (e.g., /sales-kanban)" },
      "statusField":     { "type": "string", "description": "Field used to group cards into columns (usually a FK status entity, e.g., saleStatus)" },
      "titleField":      { "type": "string", "description": "Field displayed as the card title in each column (e.g., name, code)" },
      "sidebarFilters":  { "type": "array", "items": { "type": "string" }, "description": "Field names to expose as sidebar filter controls" },
      "menuGroup":       { "type": "string", "description": "Menu group key and display name where the page item will appear" }
    },
    "required": ["entityName", "pluginNamespace", "routePath", "statusField", "titleField", "menuGroup"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Task`, `Project`): The name of the model in `glyvio_entity.*` to list in the Kanban board.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/tasks-kanban`): The URL path (must start with `/` and be a single word/slug).
4. **Status Entity Name** (e.g., `TaskTypeStatus`, `ProjectStatus`): The entity defining the columns/statuses.
5. **Status Field in Target Entity** (e.g., `statusId`, `status`): The field on the target entity linking it to the status entity.
6. **Menu Group** (e.g., `Administration` group key: `main-admin`): Where to place the menu item.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.SimpleKanbanPageColumnDesign(...)`, NOT `import { SimpleKanbanPageColumnDesign } ...`
2. **Routing Rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores (no trailing slashes, no multiple segments unless URL-encoded).
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<EntityName>`.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Kanban Page View and Route File

Create a new file `src/views/pages/<entity_snake_case>_kanban_page.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityKanbanPageRoute,
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
      key: 'menu-item-your-entity-kanban',
      title: 'Your Entity Kanban',
      iconName: 'fa_table_columns', // FontAwesome icon
      colorTheme: 'BLUE', // Theme color
      route: new YourEntityKanbanPageRoute(),
    },
  ],
});
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define state filters for the sidebar
export interface <EntityName>KanbanPageFilter extends glyvio_core.SimpleKanbanPageStateFilter {
  showDeleted?: boolean;
}

// Define route params
export interface <EntityName>KanbanPageRouteParams extends glyvio_core.SimpleKanbanPageRouteParams<<EntityName>KanbanPageFilter> {
  // e.g., typeId?: string;
}

// Define column state containing status entity reference and totals/counts
export interface <EntityName>KanbanPageColumnState extends glyvio_core.SimpleKanbanPageColumnState {
  status?: glyvio_entity.<StatusEntityName>;
  count?: Decimal;
}

// Define page state
export interface <EntityName>KanbanPageState
  extends glyvio_core.SimpleKanbanPageState<<EntityName>KanbanPageRouteParams, <EntityName>KanbanPageFilter, <EntityName>KanbanPageColumnState> {
  // Add page state variables here
}

/**
 * Route definition for the <EntityName> Kanban Page.
 */
export class <EntityName>KanbanPageRoute extends glyvio_core.SimpleKanbanPageRoute<<EntityName>KanbanPageRouteParams> {
  getRoutePath() {
    return '<RoutePath>'; // e.g. '/tasks-kanban'
  }

  getRouteNameSpace() {
    return '<PluginNamespace>';
  }

  getRouteNameObject() {
    return '<EntityName>KanbanPage';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_kanban_page;
  }
}

/**
 * Custom Kanban Page component for displaying and managing <EntityName> boards.
 */
export class <EntityName>KanbanPage extends glyvio_core.SimpleKanbanPage<
  <EntityName>KanbanPageState,
  glyvio_entity.<EntityName>,
  <EntityName>KanbanPageColumnState
> {
  constructor() {
    super(<EntityName>KanbanPageRoute);
  }

  async initState(state: <EntityName>KanbanPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_KANBAN_PAGE';
    await this.loadUserConfig(state);
  }

  /**
   * Loads and defines columns based on the Status Entity.
   */
  async refreshColumnsState(state: <EntityName>KanbanPageState): Promise<<EntityName>KanbanPageColumnState[]> {
    const statuses = await glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<StatusEntityName>>(
      glyvio_structure.AllEntities.<statusEntityCamelCase>,
    )
      .addFilterOperator(glyvio_structure.AllEntities.<statusEntityCamelCase>.deleted, false)
      .addOrderByEntity(glyvio_structure.AllEntities.<statusEntityCamelCase>.sort)
      .findAll();

    const columnsState: <EntityName>KanbanPageColumnState[] = [];
    for (const status of statuses) {
      columnsState.push({
        key: status.id!,
        status: status,
      });
    }

    // Optionally calculate counts per column
    const pqb = new glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>();
    this.populateQueryBuilderForColumnsStructure(state, pqb);
    if (state.text) {
      pqb.addFilter(this.populateMainFilterForColumnFilters(state, state.text));
    }
    const groupedCounts = await pqb.findGrouped<{ id: string; count: Decimal }>([
      {
        field: glyvio_structure.AllEntities.<entityNameCamelCase>.<statusFieldCamelCase>.id,
        aliasField: 'id',
        type: 'TEXT',
      },
      {
        field: glyvio_structure.AllEntities.<entityNameCamelCase>.<statusFieldCamelCase>.id,
        aliasField: 'count',
        type: 'COUNT',
      },
    ]);

    for (const cs of columnsState) {
      const g = groupedCounts.find((e) => e.id === cs.key);
      if (g) {
        cs.count = g.count;
      }
    }

    return columnsState;
  }

  /**
   * Configures the layout, appBar title, buttons, and filter sidebar.
   */
  getDesign(state: <EntityName>KanbanPageState, design: glyvio_core.SimpleKanbanPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.key = 'appBar';
    appBar.title = '<EntityName> Kanban';

    appBar.putButtonOn(
      new glyvio_core.ActionButtonDesign({
        key: 'new.button',
        type: 'SECONDARY',
        iconName: 'sax_linear_add',
        action: new glyvio_core.Action({
          key: 'new',
        }),
      }),
      0,
    );

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
   * Generates design styling and headers for each Kanban Column.
   */
  getDesignForColumn(
    state: <EntityName>KanbanPageState,
    columnState: <EntityName>KanbanPageColumnState,
  ): glyvio_core.SimpleKanbanPageColumnDesign {
    return new glyvio_core.SimpleKanbanPageColumnDesign({
      key: columnState.key,
      width: 320,
      cellPadding: '8',
      colorTheme: `$S{stateColumn.status.color}`,
      headerDesign: new glyvio_core.RowLayoutDesign({
        children: [
          new glyvio_core.RowLayoutFieldDesign({
            padding: '20',
            isExpanded: true,
            child: new glyvio_core.StringTextDesign({
              value: '$S{stateColumn.status.name}',
            }),
          }),
          new glyvio_core.RowLayoutFieldDesign({
            padding: '0 20',
            child: new glyvio_core.StringTextDesign({
              value: '($N{stateColumn.count Formatter="INTEGER"})',
              colorTheme: '$S{stateColumn.status.color}',
            }),
          }),
        ],
      }),
    });
  }

  /**
   * Formats the visual card design layout of each item inside a Kanban Column.
   */
  getDesignForCell(
    state: <EntityName>KanbanPageState,
    columnState: <EntityName>KanbanPageColumnState,
    item: glyvio_entity.<EntityName>,
  ): glyvio_core.CellDesign {
    return new glyvio_core.EntityBarCellDesign({
      colorTheme: item.deleted ? 'RED' : `${item.status?.color}_ONLY_BORDER`,
      header: new glyvio_core.StringTextDesign({
        key: 'code.text',
        value: '$S{item.code}',
        style: 'TITLE_SMALL',
      }),
      details: new glyvio_core.ColumnLayoutDesign({
        key: 'details.layout',
        children: [
          new glyvio_core.ColumnLayoutFieldDesign({
            padding: '8',
            key: 'name.cell',
            child: new glyvio_core.StringTextDesign({
              key: 'name.text',
              value: '$S{item.name}',
            }),
          }),
        ],
      }),
    });
  }

  /**
   * Builds the database select query base structure.
   */
  populateQueryBuilderForColumnsStructure(
    state: <EntityName>KanbanPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
  ): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>)
      .addLeftJoinEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<statusFieldCamelCase>);

    if (!(state.filtersSidebar?.showDeleted ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Applies filters specific to each Kanban column.
   */
  populateQueryBuilderForColumnFilters(
    state: <EntityName>KanbanPageState,
    columnState: <EntityName>KanbanPageColumnState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
  ): void {
    queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.<statusFieldCamelCase>, columnState.key);
    queryBuilder.addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.createdAt, 'DESC');
  }

  /**
   * Filters matching text from the main top search bar input.
   */
  populateMainFilterForColumnFilters(state: <EntityName>KanbanPageState, text?: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilter({
      ors: [
        new glyvio_core.QueryBuilderFilterILike({
          field: glyvio_structure.AllEntities.<entityNameCamelCase>.name,
          value: state.text,
        }),
      ],
    });
  }

  /**
   * Resolves which column key a given entity belongs to.
   */
  getColumnKeyForItem(state: <EntityName>KanbanPageState, item: glyvio_entity.<EntityName>): string | null {
    return item.<statusFieldCamelCase>Id;
  }

  /**
   * Defines interactive navigation action when card is clicked.
   */
  async onCellTap(
    state: <EntityName>KanbanPageState,
    columnState: <EntityName>KanbanPageColumnState,
    item: glyvio_entity.<EntityName>,
  ): Promise<void> {
    // Navigate to edit modal or side detail bar:
    // await this.pushModal(new YourEntityEditModalRoute({ id: item.id }));
  }

  /**
   * Handles saving entity updates when dragged/dropped between columns.
   */
  async onColumnChange(
    state: <EntityName>KanbanPageState,
    columnState: <EntityName>KanbanPageColumnState,
    queue: glyvio_entity.EntityServiceQueue,
    item: glyvio_entity.<EntityName>,
  ): Promise<void> {
    queue.push({
      input: {
        <statusFieldSnakeCase>_id: columnState.key,
      },
      structureName: item.getStructureName(),
      id: item.id!,
    });
    item.<statusFieldCamelCase>Id = columnState.key!;
  }

  /**
   * Event handlers for visual triggers (like create new item).
   */
  async events(state: <EntityName>KanbanPageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
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
   * Database entity subscription listenning.
   */
  getEntitiesListenning(state: <EntityName>KanbanPageState): glyvio_core.EntityListenning[] {
    return [
      new glyvio_core.EntityListenning({
        structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
        objectId: '*',
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
