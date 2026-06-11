---
name: create-entity-modal
description: 'Generates a standard entity selection and search modal, with autocomplete lookups, query filter configurations, list cells, selection chips, routing, and textfield wrappers.'
---

# Agent Skill: Create Custom Entity Modal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional entity selector modal (extending `SimpleEntityModal`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_entity_modal`
- **Description**: Generates a standard entity selection and search modal, with autocomplete lookups, query filter configurations, list cells, selection chips, routing, and textfield wrappers.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Customer`, `ChatAgent`): The database model in `glyvio_entity.*` to select.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/customer-entity`): The URL path for the modal (must start with `/` and be a single word/slug).
4. **Display Layout**:
   - **Cell layout** (e.g., `item.name` and `item.code`): Visual components to represent each entity in the list.
   - **Chip text** (e.g., `item.name`): Label displayed in selection chips.
   - **Selection text** (e.g., `item.name`): Default text returned in search inputs.
5. **Search Filters**:
   - Fields matched in autocomplete lookups (e.g., `name`, `code`).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ChipDesign(...)`, NOT `import { ChipDesign } ...`
2. **Modal Closing**: The modal automatically pops/closes returning the selection when tapping a cell. Ensure `popActionKey` is respected.
3. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
4. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Entity Modal File

Create a new file `src/views/modals/<entity_snake_case>_entity_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityModalRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define custom options for configuring the modal route query
export interface <EntityName>EntityModalOptions {}

// Define route params
export interface <EntityName>EntityModalRouteParams extends glyvio_core.SimpleEntityModalRouteQueryParams<<EntityName>EntityModalOptions> {}

// Define page state
export interface <EntityName>EntityModalState extends glyvio_core.SimpleEntityModalState<<EntityName>EntityModalOptions> {}

/**
 * Route definition for invoking the <EntityName> Entity Modal.
 */
export class <EntityName>EntityModalRoute extends glyvio_core.SimpleEntityModalRoute<<EntityName>EntityModalOptions> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/customer-entity'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<EntityName>EntityModal';
  }
}

/**
 * Custom Entity Modal component for searching and selecting <EntityName> models.
 */
export class <EntityName>EntityModal extends glyvio_core.SimpleEntityModal<
  <EntityName>EntityModalState,
  glyvio_entity.<EntityName>
> {
  constructor() {
    super(<EntityName>EntityModalRoute);
  }

  /**
   * Configures base query builders for retrieve lists.
   */
  populateQueryBuilder(state: <EntityName>EntityModalState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.<entityNameCamelCase>)
      .addOrderByEntity(glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>)
      .addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.deleted, false);
  }

  /**
   * Filters matching text during autocomplete search actions.
   */
  populateAutocompleteFilter(state: <EntityName>EntityModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterILike({
      field: glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>,
      value: text,
      ors: [
        // Add additional match queries if needed
      ],
    });
  }

  /**
   * Filters matching text for specific key selection.
   */
  populateSelectFilter(state: <EntityName>EntityModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterOperator({
      field: glyvio_structure.AllEntities.<entityNameCamelCase>.<TitleField>,
      value: text,
    });
  }

  /**
   * Defines visual card design for rows inside search list.
   */
  getDesignForCell(state: <EntityName>EntityModalState, item: glyvio_entity.<EntityName>): glyvio_core.WidgetDesign {
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

  /**
   * Defines chip representation for selected item links.
   */
  getDesignForChip(child: glyvio_entity.<EntityName>): glyvio_core.ChipDesign {
    return new glyvio_core.ChipDesign({
      label: `$S{item.<TitleField>}`,
    });
  }

  /**
   * Configures the layout and title for modal App Bar.
   */
  getDesignForAppBar(state: <EntityName>EntityModalState): glyvio_core.AppBarDesign {
    return new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      title: 'Select <EntityName>',
      buttons: [],
    });
  }

  /**
   * Text returned inside textfield designs representing selection.
   */
  getDesignForSelectText(state: <EntityName>EntityModalState, item: glyvio_entity.<EntityName>): string | undefined {
    return item.<TitleField> ?? '';
  }

  /**
   * Visual component displayed inside select layouts representing selection.
   */
  getDesignForSelectChild(state: <EntityName>EntityModalState, item: glyvio_entity.<EntityName>): glyvio_core.WidgetDesign {
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

  async events(state: <EntityName>EntityModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
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
 * Custom Interceptor class for SimpleEntityModal.
 */
export abstract class <EntityName>EntityModalInterceptor extends glyvio_core.SimpleEntityModalInterceptor<
  <EntityName>EntityModalState,
  glyvio_entity.<EntityName>
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>EntityModalRoute;
  }
}

/**
 * Custom autocomplete single textfield design wrapper targeting this modal.
 */
export class <EntityName>SingleTextfield extends glyvio_core.EntityAutocompleteSingleTextfieldDesign {
  constructor(args?: Partial<<EntityName>SingleTextfield>) {
    super(args);
    this.label = this.label ?? '<EntityName>';
    this.pathEntityModal = '<RoutePath>';
    this.nameSpace = '<PluginNamespace>';
    this.nameObject = '<EntityName>EntityModal';
  }
}

/**
 * Custom autocomplete multiple textfield design wrapper targeting this modal.
 */
export class <EntityName>ListTextfield extends glyvio_core.EntityAutocompleteMultipleTextfieldDesign {
  constructor(args?: Partial<<EntityName>ListTextfield>) {
    super(args);
    this.label = this.label ?? '<EntityName> List';
    this.pathEntityModal = '<RoutePath>';
    this.nameSpace = '<PluginNamespace>';
    this.nameObject = '<EntityName>EntityModal';
  }
}

/**
 * Custom select textfield design wrapper targeting this modal.
 */
export class <EntityName>SelectTextfield extends glyvio_core.EntitySelectTextfieldDesign {
  constructor(args?: Partial<<EntityName>SelectTextfield>) {
    super(args);
    this.label = this.label ?? '<EntityName> Select';
    this.pathEntityModal = '<RoutePath>';
    this.nameSpace = '<PluginNamespace>';
    this.nameObject = '<EntityName>EntityModal';
  }
}
```
