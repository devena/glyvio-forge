---
name: create-gantt-page
description: 'Generates a standard entity Gantt timeline page with date-window loading, drag-to-reschedule persistence, bar dependencies, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.'
---

# Agent Skill: Create Custom Gantt Page View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional Gantt timeline page view (extending `SimpleGanttPage`) within a Glyvio plugin project.

`SimpleGanttPage` combines two existing page patterns rather than being fully novel:
- The **date-window loading model** of `SimpleCalendarPage` (bars are fetched by visible date range via `populateIntervalFilter`, refetched as the user pans/zooms).
- The **drag-and-drop persistence model** of `SimpleKanbanPage` (dragging/resizing a bar reschedules it through a save queue shared with registered interceptors).

Rows/lanes in a Gantt are called **groups** and modeled *exactly* like Kanban columns — not as a separate concept. If you already know `create-kanban-page`, this maps 1:1:

| Kanban | Gantt |
|---|---|
| `SimpleKanbanPageColumnState` (`SC`) | `SimpleGanttPageGroupState` (`GS`) |
| `refreshColumnsState(state)` | `refreshGroupsState(state)` |
| `getDesignForColumn(state, columnState)` — called once per column | `getDesignForGroup(state, groupState)` — called once per group |
| `getColumnKeyForItem(state, item)` | `getGroupKeyForItem(state, item)` |
| `getDesignForCell(state, columnState, item)` | `getDesignForBar(state, groupState, item)` |
| `onColumnChange(state, columnState, queue, item)` | `onBarChange(state, change, queue, item)` — `change.groupKey` |
| `SimpleKanbanPageColumnDesign` | `SimpleGanttGroupDesign` |
| `columnsDesign: SimpleKanbanPageColumnDesign[]` | `groupsDesign: SimpleGanttGroupDesign[]` |

There is **no separate "row" abstraction** — each bar belongs directly to one group/lane. Do not invent a `rowState`/`getDesignForRow` on top of this; that was tried and reverted for being confusing (two overlapping bucket concepts where Kanban only needs one).

---

## 🎯 Skill Metadata

```json
{
  "name": "create_gantt_page",
  "description": "Generates a standard entity Gantt timeline page with date-window loading, drag-to-reschedule persistence, bar dependencies, search, sidebar filtering, routing, and menu registration for a Glyvio plugin.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName":       { "type": "string", "description": "Entity model name in glyvio_entity.* to render as bars (e.g., Task, ProjectTask)" },
      "pluginNamespace":  { "type": "string", "description": "Plugin namespace string (e.g., my_plugin)" },
      "routePath":        { "type": "string", "description": "URL path starting with / (e.g., /tasks-gantt)" },
      "groupEntityName":  { "type": "string", "description": "Entity defining the groups/lanes (e.g., TaskTypeStatus, Sprint) — usually a status or a scheduling bucket entity" },
      "groupField":       { "type": "string", "description": "FK field on the target entity linking to the group entity (e.g., statusId, sprintId)" },
      "startDateField":   { "type": "string", "description": "DateTime field on the target entity for the bar's start (e.g., startTime, plannedStart)" },
      "endDateField":     { "type": "string", "description": "DateTime field on the target entity for the bar's end (e.g., endTime, plannedEnd)" },
      "titleField":       { "type": "string", "description": "Field displayed as the bar title (e.g., name, code)" },
      "menuGroup":        { "type": "string", "description": "Menu group key and display name where the page item will appear" }
    },
    "required": ["entityName", "pluginNamespace", "routePath", "groupEntityName", "groupField", "startDateField", "endDateField", "titleField", "menuGroup"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Task`, `ProjectTask`): The model in `glyvio_entity.*` whose records become Gantt bars.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/tasks-gantt`): The URL path (must start with `/`, single slug).
4. **Group Entity Name** (e.g., `TaskTypeStatus`, `Sprint`): The entity defining the lanes.
5. **Group Field on Target Entity** (e.g., `statusId`, `sprintId`): FK linking the bar entity to its group.
6. **Start/End Date Fields** (e.g., `startTime`/`endTime`): Real `DateTime` columns on the target entity. **Confirm these actually exist and are populated before generating this page** — see rule 7 below.
7. **Title Field** (e.g., `name`, `code`): What text renders on the bar.
8. **Menu Group** (e.g., `Administration` group key: `main-admin`): Where to place the menu item.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.SimpleGanttGroupDesign(...)`, NOT `import { SimpleGanttGroupDesign } ...`
2. **Routing Rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<EntityName>`.
4. **No `any` or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` rule**: `SimpleGanttPage` inherits an *abstract* `events()` from `CorePage` — it is easy to forget when authoring a page from this blueprint alone. Every concrete Gantt page **must** implement it (return `undefined` if there are no custom `action.key` handlers). Omitting it is a compile error (`TS2515`), not a silent bug, but it has bitten every first-time implementer of this page type so far — implement it even if empty.
6. **Interpolation syntax — use the correct prefix for each type**:
   - `$S{...}` → String/text values.
   - `$D{...}` → **DateTime only**. NEVER use for Decimal or numeric fields.
   - `$N{...}` → Decimal/Number (counts, amounts, any `Decimal` type).
   - `$T{...}` → Translation/i18n key.
7. **The target entity needs real, populated start/end `DateTime` columns.** Unlike Kanban (which only needs a status FK), a Gantt bar is meaningless without a date range. If the entity doesn't have them yet, **stop and ask the user** whether to add a schema migration (`modify-manifest` skill) before generating this page — do not invent synthetic dates as a permanent solution; that's only acceptable for a throwaway validation page, never for a shipped feature.
8. **Nullable entity getters vs. non-null design fields**: entity getters (e.g. `item.status?.color`) are frequently typed `string | null`, while some design fields you'll plug them into (e.g. `AvatarDesign.colorTheme?: string`, no `null`) are not. Coerce with `?? undefined` at the assignment site — a raw `null` there is a real, confirmed TypeScript compile error (`TS2322`), not just a lint nit.
9. **`SimpleGanttBarChange`/`_ON_BAR_CHANGE` wire contract is flat**: the bridge action's `data` object carries `groupKey`/`start`/`end` as top-level keys (not nested under a `change` object). If you ever touch the underlying `SimpleGanttPage`/Dart cubit code (framework-level, not plugin-level), keep both sides byte-for-byte in sync — a mismatched key here fails silently as a bad/undefined date on the Dart side rather than a compile error.
10. **Don't forget the barrel export.** After creating the file, if the plugin's `src/index.ts` (or a routines/views barrel it re-exports) uses `export * from './path/to/file'` for sibling pages, add the same line for your new file. A page whose **route** is registered (`routerService.loadRoutes([...])`) but whose **class** was never re-exported through the barrel reaches the global runtime object incompletely — navigating to it throws `Class (<PageName>) of namespace <namespace> not found` at runtime, even though everything compiled cleanly. This is a real bug this exact pattern produced once already; always double-check the export, not just the route registration.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Gantt Page View and Route File

Create a new file `src/views/pages/<entity_snake_case>_gantt_page.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts`, or a barrel it re-exports):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityGanttPageRoute,
]);
```

If routes for this plugin are declared via `export *` barrels (see rule 10 above), also add `export * from './views/pages/<entity_snake_case>_gantt_page';` to that barrel.

### Step 3: Register the Main Navigation Menu Item

```typescript
glyvio_core.FullMenuPage.fullMenuGroupAdd({
  key: 'group_key',
  name: 'Group Name',
  position: 100, // Customize positioning
  items: [
    {
      key: 'menu-item-your-entity-gantt',
      title: 'Your Entity Gantt',
      iconName: 'sax_linear_calendar_1', // FontAwesome/Sax icon
      colorTheme: 'BLUE',
      route: new YourEntityGanttPageRoute(),
    },
  ],
});
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define state filters for the sidebar
export interface <EntityName>GanttPageFilter extends glyvio_core.SimpleGanttPageStateFilter {
  showDeleted?: boolean;
}

// Define route params
export interface <EntityName>GanttPageRouteParams extends glyvio_core.SimpleGanttPageRouteParams<<EntityName>GanttPageFilter> {
  // e.g., typeId?: string;
}

// Define group state — analogous to Kanban's column state: the group/lane
// entity reference, fetched once via refreshGroupsState.
export interface <EntityName>GanttPageGroupState extends glyvio_core.SimpleGanttPageGroupState {
  group?: glyvio_entity.<GroupEntityName>;
}

// Define page state
export interface <EntityName>GanttPageState
  extends glyvio_core.SimpleGanttPageState<<EntityName>GanttPageRouteParams, <EntityName>GanttPageFilter, <EntityName>GanttPageGroupState> {
  // Add page state variables here
}

/**
 * Route definition for the <EntityName> Gantt Page.
 */
export class <EntityName>GanttPageRoute extends glyvio_core.SimpleGanttPageRoute<<EntityName>GanttPageRouteParams> {
  getRoutePath() {
    return '<RoutePath>'; // e.g. '/tasks-gantt'
  }

  getRouteNameSpace() {
    return '<PluginNamespace>';
  }

  getRouteNameObject() {
    return '<EntityName>GanttPage';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_gantt_page;
  }
}

/**
 * Custom Gantt Page component for scheduling and rescheduling <EntityName> bars.
 */
export class <EntityName>GanttPage extends glyvio_core.SimpleGanttPage<
  <EntityName>GanttPageState,
  glyvio_entity.<EntityName>,
  <EntityName>GanttPageGroupState
> {
  constructor() {
    super(<EntityName>GanttPageRoute);
  }

  // See rule 5 above — required even with no custom action handlers.
  async events(state: <EntityName>GanttPageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // if (action.key === 'new') {
    //   await this.pushModal(new YourEntityEditModalRoute());
    //   return 'STATE_FREEZED';
    // }
    return undefined;
  }

  async initState(state: <EntityName>GanttPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_GANTT_PAGE';
    await this.loadUserConfig(state);
  }

  /**
   * Loads and defines groups/lanes based on the Group Entity — exactly like
   * a Kanban page's refreshColumnsState, just renamed.
   */
  async refreshGroupsState(state: <EntityName>GanttPageState): Promise<<EntityName>GanttPageGroupState[]> {
    const groups = await glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<GroupEntityName>>(
      glyvio_structure.AllEntities.<groupEntityCamelCase>,
    )
      .addFilterOperator(glyvio_structure.AllEntities.<groupEntityCamelCase>.deleted, false)
      .addOrderByEntity(glyvio_structure.AllEntities.<groupEntityCamelCase>.sort)
      .findAll();

    return groups.map((g) => ({
      key: g.id!,
      group: glyvio_entity.<GroupEntityName>.fromJson(g)!,
    }));
  }

  /**
   * Configures the layout, appBar title, buttons, and filter sidebar.
   */
  getDesign(state: <EntityName>GanttPageState, design: glyvio_core.SimpleGanttPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.key = 'appBar';
    appBar.title = '<EntityName> Gantt';

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
   * Generates the visual widget for a distinct group — called once per
   * group, never once per bar. `headerDesign` (optional) lets you combine
   * rich content (e.g. an AvatarDesign) with the group name; if omitted,
   * the native widget falls back to plain `name` text.
   */
  getDesignForGroup(
    state: <EntityName>GanttPageState,
    groupState: <EntityName>GanttPageGroupState,
  ): glyvio_core.SimpleGanttGroupDesign {
    return new glyvio_core.SimpleGanttGroupDesign({
      key: groupState.key,
      name: groupState.group?.name,
      headerDesign: new glyvio_core.RowLayoutDesign({
        crossAlignment: 'CENTER',
        children: [
          new glyvio_core.RowLayoutFieldDesign({
            padding: '4',
            child: new glyvio_core.AvatarDesign({
              text: groupState.group?.name?.substring(0, 2)?.toUpperCase(),
              // Coerce nullable entity getters — see rule 8.
              colorTheme: groupState.group?.color ?? undefined,
              size: 28,
            }),
          }),
          new glyvio_core.RowLayoutFieldDesign({
            isExpanded: true,
            padding: '0 8',
            child: new glyvio_core.StringTextDesign({
              value: '$S{stateGroup.group.name}',
            }),
          }),
        ],
      }),
    });
  }

  /**
   * Formats the visual bar design for each item positioned on the timeline.
   */
  getDesignForBar(
    state: <EntityName>GanttPageState,
    groupState: <EntityName>GanttPageGroupState,
    item: glyvio_entity.<EntityName>,
  ): glyvio_core.SimpleGanttBarCellDesign {
    return new glyvio_core.SimpleGanttBarCellDesign({
      key: `bar.<entityNameSnakeCase>_${item.id}`,
      groupKey: item.<groupFieldCamelCase>Id,
      name: `${item.<titleFieldCamelCase>}`,
      start: item.<startDateFieldCamelCase>,
      end: item.<endDateFieldCamelCase>,
      progress: 0,
      colorTheme: item.deleted ? 'RED' : undefined,
      // Optional: bar-to-bar dependencies, e.g. finish-to-start scheduling
      // constraints. Omit entirely if the domain has no such relationships.
      // dependencies: [
      //   new glyvio_core.SimpleGanttBarDependencyDesign({
      //     toBarKey: `bar.<entityNameSnakeCase>_${otherItem.id}`,
      //     type: 'FINISH_TO_START',
      //   }),
      // ],
    });
  }

  /**
   * Applies global database structures/constraints when searching for bars.
   */
  populateQueryBuilder(
    state: <EntityName>GanttPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
  ): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>)
      .addLeftJoinEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<groupFieldCamelCase>);

    if (!(state.filtersSidebar?.showDeleted ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Filters matching text from the main top search bar input.
   */
  populateMainFilter(state: <EntityName>GanttPageState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterILike({
      field: glyvio_structure.AllEntities.<entityNameCamelCase>.<titleFieldCamelCase>,
      value: text,
    });
  }

  /**
   * Applies the currently visible date window to the bars query — this is
   * the piece Kanban has no equivalent for, borrowed from SimpleCalendarPage.
   * Bars outside [initialDate, finalDate] are not fetched.
   */
  populateIntervalFilter(
    state: <EntityName>GanttPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
    initialDate: DateTime,
    finalDate: DateTime,
  ): void {
    queryBuilder.addFilterBetween(glyvio_structure.AllEntities.<entityNameCamelCase>.<startDateFieldCamelCase>, initialDate, finalDate);
  }

  /**
   * Resolves which group key a given entity belongs to — analogous to
   * getColumnKeyForItem in SimpleKanbanPage.
   */
  getGroupKeyForItem(state: <EntityName>GanttPageState, item: glyvio_entity.<EntityName>): string | null {
    return item.<groupFieldCamelCase>Id;
  }

  /**
   * Defines interactive navigation action when a bar is tapped.
   */
  async onBarTap(
    state: <EntityName>GanttPageState,
    groupState: <EntityName>GanttPageGroupState,
    item: glyvio_entity.<EntityName>,
  ): Promise<void> {
    // Navigate to edit modal or side detail bar:
    // await this.pushSidebar(new YourEntitySidebarRoute({ id: item.id }), true);
  }

  /**
   * Handles persisting a bar drag/resize — mirrors SimpleKanbanPage's
   * onColumnChange. `change.groupKey` is only set when the bar was moved to
   * a different lane (not on a pure resize within the same one).
   */
  async onBarChange(
    state: <EntityName>GanttPageState,
    change: glyvio_core.SimpleGanttBarChange,
    queue: glyvio_entity.EntityServiceQueue,
    item: glyvio_entity.<EntityName>,
  ): Promise<void> {
    const input: Record<string, unknown> = {
      <startDateFieldSnakeCase>: change.start,
      <endDateFieldSnakeCase>: change.end,
    };
    if (change.groupKey) {
      input.<groupFieldSnakeCase>_id = change.groupKey;
    }
    queue.push({
      input,
      structureName: item.getStructureName(),
      id: item.id!,
    });
    item.<startDateFieldCamelCase> = change.start;
    item.<endDateFieldCamelCase> = change.end;
    if (change.groupKey) {
      item.<groupFieldCamelCase>Id = change.groupKey;
    }
  }

  /**
   * Database entity subscription listening.
   */
  getEntitiesListenning(state: <EntityName>GanttPageState): glyvio_core.EntityListenning[] {
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

---

## 🔗 Optional: Bar Dependencies

If the domain has real scheduling dependencies between bars (e.g. "task B can't start until task A finishes"), populate `SimpleGanttBarCellDesign.dependencies` in `getDesignForBar` with one `SimpleGanttBarDependencyDesign` per outgoing link:

```typescript
new glyvio_core.SimpleGanttBarDependencyDesign({
  toBarKey: '<key of the dependent bar>',
  type: 'FINISH_TO_START', // or START_TO_START | FINISH_TO_FINISH | START_TO_FINISH | CONTAINED
});
```

`toBarKey` must match the `key` of another `SimpleGanttBarCellDesign` returned for the *same* fetch window — a dependency pointing at a bar outside the currently loaded date range will not render a line (the native widget only draws dependencies between bars it currently has in memory).

---

## ⚠️ Known Gaps

- To customize an *existing* Gantt page from another plugin, use the `create-gantt-page-interceptor` skill (extends `glyvio_core.SimpleGanttPageInterceptor<S, E, GS>`; hooks: `getDesign`, `getDesignForGroup`, `getDesignForBar`, `populateQueryBuilder`, `populateMainFilter`, `populateIntervalFilter`, `onBarChange`, `populateJeannieContext`).
- No automatic critical-path/scheduling calculation — this page type only displays bars and persists manual drag/resize. Any "does rescheduling A also push back B" logic is on the consuming plugin.
