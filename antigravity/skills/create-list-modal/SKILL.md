---
name: create-list-modal
description: 'Generates a standard entity search and selection modal, with cell layouts, filters sidebar, tap actions, routing, and user config persistence.'
---

# Agent Skill: Create Custom SimpleListModal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional list search and selection modal (extending `SimpleListModal`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_list_modal`
- **Description**: Generates a standard entity search and selection modal, with cell layouts, filters sidebar, tap actions, routing, and user config persistence.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Customer`, `User`): The name of the model in `glyvio_entity.*` to list in the list modal.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/customer-list-modal`): The URL path for the modal (must start with `/` and be a single word/slug).
4. **Cell Layout Details**:
   - Fields to display inside the list cells (e.g. `name`, `code`).
5. **Search/Filters**:
   - Database fields matched in keyword search actions.
   - Sidebar filter parameters (e.g. `active`).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.LineCellDesign(...)`, NOT `import { LineCellDesign } ...`
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

### Step 1: Create the List Modal File

Create a new file `src/views/modals/<entity_snake_case>_list_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityListModalRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define custom options/filters for the sidebar
export interface <EntityName>ListModalFilter extends glyvio_core.SimpleListModalStateFilter {
  showInactive?: boolean;
}

// Define route params
export interface <EntityName>ListModalRouteParams extends glyvio_core.SimpleListModalRouteQueryParams<<EntityName>ListModalFilter> {}

// Define sidebar states if needed
export interface <EntityName>ListModalRightState extends glyvio_core.SimpleListModalRightState {}
export interface <EntityName>ListModalLeftState extends glyvio_core.SimpleListModalLeftState {}

// Define page state
export interface <EntityName>ListModalState extends glyvio_core.SimpleListModalState<
  <EntityName>ListModalRouteParams,
  <EntityName>ListModalFilter,
  <EntityName>ListModalRightState,
  <EntityName>ListModalLeftState
> {}

/**
 * Route definition for invoking the <EntityName> List Modal.
 */
export class <EntityName>ListModalRoute extends glyvio_core.SimpleListModalRoute<<EntityName>ListModalFilter> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/customer-list-modal'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<EntityName>ListModal';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<entityNameSnakeCase>_list_modal;
  }
}

/**
 * Custom List Modal view for listing and searching <EntityName> records.
 */
export class <EntityName>ListModal extends glyvio_core.SimpleListModal<
  <EntityName>ListModalState,
  glyvio_entity.<EntityName>
> {
  constructor() {
    super(<EntityName>ListModalRoute);
  }

  async initState(state: <EntityName>ListModalState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<EntityName><SnakeCase>_LIST_MODAL';
    await this.loadUserConfig(state);
  }

  /**
   * Configures design details like titles and filters sidebar.
   */
  getDesign(state: <EntityName>ListModalState, design: glyvio_core.SimpleListModalDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.title = 'Select <EntityName>';

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
   * Defines layout designs for rendering cells inside the list modal.
   */
  getDesignForCell(state: <EntityName>ListModalState, item: glyvio_entity.<EntityName>): glyvio_core.LineCellDesign {
    return new glyvio_core.LineCellDesign({
      padding: '16',
      child: new glyvio_core.RowLayoutDesign({
        children: [
          new glyvio_core.RowLayoutFieldDesign({
            isExpanded: true,
            child: new glyvio_core.ColumnLayoutDesign({
              children: [
                new glyvio_core.ColumnLayoutFieldDesign({
                  child: new glyvio_core.StringTextDesign({
                    value: `$S{item.name}`,
                    style: 'TITLE_MEDIUM',
                  }),
                }),
                new glyvio_core.ColumnLayoutFieldDesign({
                  child: new glyvio_core.StringTextDesign({
                    value: `$S{item.code}`,
                    style: 'BODY_SMALL',
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    });
  }

  /**
   * Configures base queries for fetching list data.
   */
  populateQueryBuilder(state: <EntityName>ListModalState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>)
      .addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.name);

    if (!(state.filtersSidebar?.showInactive ?? false)) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
    }
  }

  /**
   * Filters matching text from the main search box.
   */
  populateMainFilter(state: <EntityName>ListModalState, text: string): glyvio_core.QueryBuilderFilter {
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
   * Callback fired when a list cell is tapped.
   */
  async onCellTap(state: <EntityName>ListModalState, item: glyvio_entity.<EntityName>): Promise<void> {
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

  async events(state: <EntityName>ListModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }
    return undefined;
  }
}

/**
 * Custom Interceptor class for SimpleListModal.
 */
export abstract class <EntityName>ListModalInterceptor extends glyvio_core.SimpleListModalInterceptor<
  <EntityName>ListModalState,
  glyvio_entity.<EntityName>
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>ListModalRoute;
  }
}
```
