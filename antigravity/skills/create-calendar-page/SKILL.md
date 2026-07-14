---
name: create-calendar-page
description: 'Generates a standard entity calendar page showing scheduled events, appointments, or tasks with routing, sidebar filtering, and menu registration for a Glyvio plugin.'
---

# Agent Skill: Create Custom Calendar Page View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional calendar page view (extending `SimpleCalendarPage`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_calendar_page",
  "description": "Generates a standard entity calendar page showing scheduled events, appointments, or tasks with routing, sidebar filtering, and menu registration for a Glyvio plugin.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "entityName":      { "type": "string", "description": "Entity model name in glyvio_entity.* (e.g., Visit, Task, Appointment)" },
      "pluginNamespace": { "type": "string", "description": "Plugin namespace string (e.g., my_plugin)" },
      "routePath":       { "type": "string", "description": "URL path starting with / (e.g., /visits-calendar)" },
      "startDateField":  { "type": "string", "description": "DateTime field used as the event start (e.g., scheduledAt)" },
      "titleField":      { "type": "string", "description": "Field displayed as the event label on the calendar (e.g., name)" },
      "endDateField":    { "type": "string", "description": "Optional DateTime field for event end/duration (e.g., finishedAt)" },
      "sidebarFilters":  { "type": "array", "items": { "type": "string" }, "description": "Field names to expose as sidebar filter controls" },
      "menuGroup":       { "type": "string", "description": "Menu group key and display name where the page item will appear" }
    },
    "required": ["entityName", "pluginNamespace", "routePath", "startDateField", "titleField", "menuGroup"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Task`, `Event`): The name of the model in `glyvio_entity.*` to display in the calendar.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/events-calendar`): The URL path (must start with `/` and be a single word/slug).
4. **Time Fields**:
   - **Start Time field** (e.g., `startTime`): The field containing event start date/time.
   - **End Time field** (e.g., `endTime`): The field containing event end date/time.
   - **All Day field** (e.g., `isAllDay`): The boolean field identifying all-day events.
5. **Display Title field** (e.g., `name`): The field to display as the event summary/title.
6. **Sidebar Filters** (e.g., `status`, `showDeleted`): Fields to build filter controls for.
7. **Main Search Fields** (e.g., `name`, `code`): Fields matched when typing in the top search bar.
8. **Menu Group** (e.g., `Administration` group key: `main-admin`): Where to place the menu item.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.SimpleCalendarCellDesign(...)`, NOT `import { SimpleCalendarCellDesign } ...`
2. **Routing Rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores (no trailing slashes, no multiple segments unless URL-encoded).
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<EntityName>`.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Calendar Page View and Route File

Create a new file `src/views/pages/<entity_snake_case>_calendar_page.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityCalendarPageRoute,
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
      key: 'menu-item-your-entity-calendar',
      title: 'Your Entity Calendar',
      iconName: 'fa_calendar_days', // FontAwesome icon
      colorTheme: 'BLUE', // Theme color
      route: new YourEntityCalendarPageRoute(),
    },
  ],
});
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define state filters for the sidebar
export interface <EntityName>CalendarPageRouteFilter extends glyvio_core.SimpleCalendarPageStateFilter {
  showDeleted?: boolean;
  <filterField1>?: string;
}

// Define route params
export interface <EntityName>CalendarPageRouteParams extends glyvio_core.SimpleCalendarPageRouteParams<<EntityName>CalendarPageRouteFilter> {}

// Define page state
export interface <EntityName>CalendarPageState
  extends glyvio_core.SimpleCalendarPageState<<EntityName>CalendarPageRouteParams, <EntityName>CalendarPageRouteFilter> {}

/**
 * Route definition for the <EntityName> Calendar Page.
 */
export class <EntityName>CalendarPageRoute<Q extends <EntityName>CalendarPageRouteParams> extends glyvio_core.SimpleCalendarPageRoute<Q> {
  getRoutePath() {
    return '<RoutePath>'; // e.g. '/events-calendar'
  }

  getRouteNameSpace() {
    return '<PluginNamespace>';
  }

  getRouteNameObject() {
    return '<EntityName>CalendarPage';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_calendar_page;
  }
}

/**
 * Custom Calendar Page component for displaying <EntityName> entities on a scheduler grid.
 */
export class <EntityName>CalendarPage extends glyvio_core.SimpleCalendarPage<<EntityName>CalendarPageState, glyvio_entity.<EntityName>> {
  constructor() {
    super(<EntityName>CalendarPageRoute);
    this.extensionsManager.registerReport(this);
  }

  async initState(state: <EntityName>CalendarPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_CALENDAR_PAGE';
    await this.loadUserConfig(state);
  }

  /**
   * Configures visual components of the parent calendar design view.
   */
  getDesign(state: <EntityName>CalendarPageState, design: glyvio_core.SimpleCalendarPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.key = 'appBar';
    appBar.title = '<EntityName> Calendar';

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

    // Define allowed calendar layouts
    design.allowedViews = ['month', 'week', 'day', 'schedule'];

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
   * Formats how each calendar event cell design represents the entity record.
   */
  getDesignForCell(state: <EntityName>CalendarPageState, item: glyvio_entity.<EntityName>): glyvio_core.SimpleCalendarCellDesign {
    return new glyvio_core.SimpleCalendarCellDesign({
      key: `cell.<entityNameSnakeCase>_${item.id}`,
      date: item.<AllDayField> ? item.<StartTimeField>! : undefined,
      startTime: item.<AllDayField> ? undefined : item.<StartTimeField>!,
      endTime: item.<AllDayField> ? undefined : item.<EndTimeField>!,
      title: item.<TitleField> ?? 'Unnamed Event',
      description: item.description ?? '',
    });
  }

  /**
   * Applies database query constraints when loading calendar elements.
   */
  populateQueryBuilder(state: <EntityName>CalendarPageState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>): void {
    queryBuilder.setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>);

    if (!(state.filtersSidebar?.showDeleted ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Maps general text-based search keys to database filters.
   */
  populateMainFilter(state: <EntityName>CalendarPageState, text: string): glyvio_core.QueryBuilderFilter {
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
   * Bounds database selects within active date interval ranges.
   */
  populateIntervalFilter(
    state: <EntityName>CalendarPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
    initialDate: DateTime,
    finalDate: DateTime,
  ): void {
    queryBuilder.addFilterBetween(glyvio_structure.AllEntities.<entityNameCamelCase>.<StartTimeField>, initialDate, finalDate);
  }

  /**
   * Callback invoked when tapping/clicking a specific calendar cell card.
   */
  async onCellTap(state: <EntityName>CalendarPageState, item: glyvio_entity.<EntityName>): Promise<void> {
    // Navigate to edit page/modal:
    // await this.pushModal(new YourEntityEditModalRoute({ id: item.id }));
  }

  /**
   * Event handlers for visual triggers (like create new item).
   */
  async events(state: <EntityName>CalendarPageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
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
  getEntitiesListenning(state: <EntityName>CalendarPageState): glyvio_core.EntityListenning[] {
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
