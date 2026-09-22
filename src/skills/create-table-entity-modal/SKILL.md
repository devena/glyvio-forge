---
name: create-table-entity-modal
description: "Generates a table-rendered entity selection and search modal (SimpleEntityModal concept, table results instead of list cells), with autocomplete lookups (inline dropdown + full-screen modal), query filter configurations, table column/row definitions, selection chips, routing, and textfield wrappers."
---
# Agent Skill: Create Custom Table Entity Modal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional entity selector (extending `TableEntityModal`) within a Glyvio plugin project.

`TableEntityModal` is the table-rendered sibling of `SimpleEntityModal` (see the `create-entity-modal` skill): same role — pick a single database entity from a textfield, either via an inline typeahead dropdown or a full-screen search modal — but results are rendered as **table rows/columns** instead of list cells. Use it when a single text line per result isn't enough to tell entities apart (e.g. selecting a Product where SKU, name, and price all matter).

It is **not** the table equivalent of `SimpleListModal` — that is `SimpleTableModal` (see `create-table-modal`), a full-page searchable data grid with sidebars/filters, always pushed explicitly (never wired to a textfield's inline dropdown). `TableEntityModal` has no sidebars, no groups, and no column-preference persistence — it stays minimal, mirroring `SimpleEntityModal`'s scope.

---

## 🎯 Skill Metadata

- **Name**: `create_table_entity_modal`
- **Description**: Generates a table-rendered entity selection and search modal, with autocomplete lookups, query filter configurations, table column/row definitions, selection chips, routing, and textfield wrappers.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Product`, `Supplier`): The database model in `glyvio_entity.*` to select.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/product-entity-table`): The URL path for the modal (must start with `/` and be a single word/slug).
4. **Table Columns** (e.g. `code`/`Code`/120, `name`/`Name`/`SMALL`, `price`/`Price`/100): key (`columnName`), title, and width (a number in px, or `SMALL`/`MEDIUM`/`LARGE`) for each visible column.
5. **Chip text** (e.g., `item.name`): Label displayed in selection chips once an item is picked.
6. **Selection text** (e.g., `item.name`): Default text returned in "select" style textfields.
7. **Search Filters**: Fields matched in autocomplete lookups (e.g., `name`, `code`).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.TableLayoutRowDesign(...)`, NOT `import { TableLayoutRowDesign } ...`
2. **Column keys must match**: every `TableLayoutColumnDesign.columnName` pushed in `getDesign` must have a matching `TableLayoutCellDesign.columnName` in every row built by `getDesignForRow` — same count, same names, or the client throws a column/cell mismatch error.
3. **Modal Closing**: The modal automatically pops/closes returning the selection when tapping a row. Ensure `popActionKey` is respected.
4. **No sidebars/groups/column-preferences**: `TableEntityModalDesign` doesn't have `leftSidebarDesign`/`rightSidebarDesign`/`mainGroups`/`mainColumnsPreferences` — if the use case needs those, use `SimpleTableModal` (`create-table-modal`) instead, not this skill.
5. **No `any` or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
6. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.
7. **No favorite-star button by default**: `TableEntityModal` overrides `getFavoriteButtonEnabled()` to return `false`, so it does not get the automatic "favorite this screen" star button that `CoreView` injects into `appBarDesign.favoriteButton` for most views — an entity lookup/selection popup isn't a top-level screen worth favoriting. This is already handled by the base class; there is nothing to configure.
8. **Interpolation syntax — use the correct prefix for each type**:
   - `$S{...}` → String/text values.
   - `$D{...}` → **DateTime only**. NEVER use for Decimal or numeric fields.
   - `$N{...}` → Decimal/Number (counts, amounts, any `Decimal` type).
   - `$T{...}` → Translation/i18n key.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Table Entity Modal File

Create a new file `src/views/modals/<entity_snake_case>_table_entity_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourTableEntityModalRoute,
]);
```

### Step 3: Wire it to a form field

Use one of the generated textfield wrapper classes (`<EntityName>TableSingleTextfield` / `<EntityName>TableListTextfield`) inside an edit modal's form design, exactly like the plain `EntityAutocompleteSingleTextfieldDesign`/`Multiple` wrappers from `create-entity-modal` — the difference is purely visual (table vs list results).

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define custom options for configuring the modal route query
export interface <EntityName>TableEntityModalOptions {}

// Define route params
export interface <EntityName>TableEntityModalRouteParams extends glyvio_core.TableEntityModalRouteQueryParams<<EntityName>TableEntityModalOptions> {}

// Define page state
export interface <EntityName>TableEntityModalState extends glyvio_core.TableEntityModalState<<EntityName>TableEntityModalOptions> {}

/**
 * Route definition for invoking the <EntityName> Table Entity Modal.
 */
export class <EntityName>TableEntityModalRoute extends glyvio_core.TableEntityModalRoute<<EntityName>TableEntityModalOptions> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/product-entity-table'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<EntityName>TableEntityModal';
  }
}

/**
 * Custom Table Entity Modal component for searching and selecting <EntityName> models,
 * rendering matches as a results table instead of list cells.
 */
export class <EntityName>TableEntityModal extends glyvio_core.TableEntityModal<
  <EntityName>TableEntityModalState,
  glyvio_entity.<EntityName>
> {
  constructor() {
    super(<EntityName>TableEntityModalRoute);
  }

  /**
   * Configures base query builders for retrieve lists.
   */
  populateQueryBuilder(state: <EntityName>TableEntityModalState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>)
      .addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>)
      .addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
  }

  /**
   * Filters matching text during autocomplete search actions (inline dropdown + full-screen search).
   */
  populateAutocompleteFilter(state: <EntityName>TableEntityModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterILike({
      field: glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>,
      value: text,
      ors: [
        // Add additional match queries if needed
      ],
    });
  }

  /**
   * Filters matching text for specific key selection (EntitySelectTextfieldDesign-style fields).
   */
  populateSelectFilter(state: <EntityName>TableEntityModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterOperator({
      field: glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>,
      value: text,
    });
  }

  /**
   * Configures the results table's columns and the modal's app bar.
   */
  getDesign(state: <EntityName>TableEntityModalState, design: glyvio_core.TableEntityModalDesign): void {
    design.mainColumns = [
      new glyvio_core.TableLayoutColumnDesign({
        columnName: 'code',
        width: 120,
        child: new glyvio_core.StringTextDesign({ value: 'Code' }),
      }),
      new glyvio_core.TableLayoutColumnDesign({
        columnName: 'name',
        width: 'SMALL',
        child: new glyvio_core.StringTextDesign({ value: 'Name' }),
      }),
    ];
  }

  /**
   * Defines the table row cells for each fetched entity. `columnName` on every cell must match
   * one of the columns configured in `getDesign` (same count, same names).
   */
  getDesignForRow(state: <EntityName>TableEntityModalState, item: glyvio_entity.<EntityName>): glyvio_core.TableLayoutRowDesign {
    return new glyvio_core.TableLayoutRowDesign({
      cells: [
        new glyvio_core.TableLayoutCellDesign({
          columnName: 'code',
          child: new glyvio_core.StringTextDesign({ value: `$S{item.code}` }),
        }),
        new glyvio_core.TableLayoutCellDesign({
          columnName: 'name',
          child: new glyvio_core.StringTextDesign({ value: `$S{item.<TitleField>}` }),
        }),
      ],
    });
  }

  /**
   * Defines chip representation for selected item links (rendered in the textfield once picked).
   */
  getDesignForChip(child: glyvio_entity.<EntityName>): glyvio_core.ChipDesign {
    return new glyvio_core.ChipDesign({
      label: `$S{item.<TitleField>}`,
    });
  }

  /**
   * Configures the layout and title for modal App Bar.
   */
  getDesignForAppBar(state: <EntityName>TableEntityModalState): glyvio_core.AppBarDesign {
    return new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      title: 'Select <EntityName>',
      buttons: [],
    });
  }

  /**
   * Text returned inside "select" style textfield designs representing selection.
   */
  getDesignForSelectText(state: <EntityName>TableEntityModalState, item: glyvio_entity.<EntityName>): string | undefined {
    return item.<TitleField> ?? '';
  }

  /**
   * Visual component displayed inside "select" style textfields representing selection.
   */
  getDesignForSelectChild(state: <EntityName>TableEntityModalState, item: glyvio_entity.<EntityName>): glyvio_core.WidgetDesign {
    return new glyvio_core.RowLayoutDesign({
      crossAlignment: 'CENTER',
      children: [
        new glyvio_core.RowLayoutFieldDesign({
          isExpanded: true,
          child: new glyvio_core.StringTextDesign({
            value: `$S{item.<TitleField>}`,
          }),
        }),
      ],
    });
  }

  async events(state: <EntityName>TableEntityModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }
    return undefined;
  }

  getEntityToTracking(item: glyvio_entity.<EntityName>): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
      objectId: item.id!,
    };
  }
}

/**
 * Custom Interceptor class for TableEntityModal.
 */
export abstract class <EntityName>TableEntityModalInterceptor extends glyvio_core.TableEntityModalInterceptor<
  <EntityName>TableEntityModalState,
  glyvio_entity.<EntityName>
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>TableEntityModalRoute;
  }
}

/**
 * Custom autocomplete single textfield design wrapper targeting this table-rendered modal.
 */
export class <EntityName>TableSingleTextfield extends glyvio_core.EntityAutocompleteTableSingleTextfieldDesign {
  constructor(args?: Partial<<EntityName>TableSingleTextfield>) {
    super(args);
    this.label = this.label ?? '<EntityName>';
    this.pathEntityModal = '<RoutePath>';
    this.nameSpace = '<PluginNamespace>';
    this.nameObject = '<EntityName>TableEntityModal';
  }
}

/**
 * Custom autocomplete multiple textfield design wrapper targeting this table-rendered modal.
 */
export class <EntityName>TableListTextfield extends glyvio_core.EntityAutocompleteTableMultipleTextfieldDesign {
  constructor(args?: Partial<<EntityName>TableListTextfield>) {
    super(args);
    this.label = this.label ?? '<EntityName> List';
    this.pathEntityModal = '<RoutePath>';
    this.nameSpace = '<PluginNamespace>';
    this.nameObject = '<EntityName>TableEntityModal';
  }
}

/**
 * Custom select textfield design wrapper targeting this table-rendered modal (opens the
 * full-screen table picker on tap — no inline dropdown).
 */
export class <EntityName>TableSelectTextfield extends glyvio_core.EntitySelectTextfieldDesign {
  constructor(args?: Partial<<EntityName>TableSelectTextfield>) {
    super(args);
    this.label = this.label ?? '<EntityName> Select';
    this.pathEntityModal = '<RoutePath>';
    this.nameSpace = '<PluginNamespace>';
    this.nameObject = '<EntityName>TableEntityModal';
  }
}
```
