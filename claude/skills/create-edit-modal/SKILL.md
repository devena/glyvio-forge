---
name: create-edit-modal
description: 'Generates a standard entity creation/modification form inside a modal, with input validation, saving routines, routing, and custom interceptor hooks.'
---

# Agent Skill: Create Custom Edit Modal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional edit modal view (extending `SimpleEditModal`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_edit_modal`
- **Description**: Generates a standard entity creation/modification form inside a modal, with input validation, saving routines, routing, and custom interceptor hooks.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Entity Name** (e.g., `Product`, `Customer`): The name of the model in `glyvio_entity.*` to create or update.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/custom-product-edit`): The URL path for the modal (must start with `/` and be a single word/slug).
4. **Form Fields**:
   - **Field name** (e.g., `name`, `price`, `active`).
   - **Field type** (e.g., `string` -> `StringTextfieldDesign`, `boolean` -> `BooleanTextfieldDesign`, `decimal` -> `DecimalTextfieldDesign`).
   - **Label** (e.g., `Product Name`, `Active Status`).
   - **Is Required?** (e.g., `true` or `false`).
5. **Route Permission** (e.g., `glyvio_permissions.view_product_edit_modal`): The permission constant required to access the modal.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.FormSectionDesign(...)`, NOT `import { FormSectionDesign } ...`
2. **Entity Path and Naming**: All database schema properties should refer to the global structure mapping `glyvio_structure.AllEntities.<entityCamelCase>.<field>`.
3. **Modal Closing**: Always close the modal using `this.popModal(...)` after completing the saving/cancel workflow.
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

### Step 1: Create the Edit Modal File

Create a new file `src/views/modals/<entity_snake_case>_edit_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourEntityEditModalRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
/**
 * State representation for the <EntityName> Edit Modal.
 */
export interface <EntityName>EditModalState extends glyvio_core.SimpleEditModalState<<EntityName>EditModalRouteParams> {
  /**
   * The <EntityName> record currently being created or edited.
   */
  <entityNameCamelCase>?: glyvio_entity.<EntityName> | null;
}

/**
 * Route parameters for navigating to the <EntityName> Edit Modal.
 */
export interface <EntityName>EditModalRouteParams extends glyvio_core.SimpleEditModalRouteParams {
  /**
   * The unique identifier of the <EntityName> record to edit. If omitted, a new record is created.
   */
  id?: string;
}

/**
 * Custom Edit Modal extending SimpleEditModal.
 * Used to create or update a <EntityName> record with form controls.
 */
export class <EntityName>EditModal extends glyvio_core.SimpleEditModal<<EntityName>EditModalState> {
  constructor() {
    super(<EntityName>EditModalRoute);
  }

  /**
   * Initializes the state of the modal. Loads the entity if ID is provided, otherwise creates a new record.
   */
  async initState(state: <EntityName>EditModalState): Promise<void> {
    await super.initState(state);

    if (state.routeParams?.id) {
      const qb = this.getMainQuery(state).addFilterOperator(
        glyvio_structure.AllEntities.<entityNameCamelCase>.id,
        state.routeParams.id,
      );
      const record = await qb.findFirst();
      if (!record) {
        throw new glyvio_core.GlyvioError({
          message: '<EntityName> not found.',
        });
      }
      state.<entityNameCamelCase> = record;
    } else {
      state.<entityNameCamelCase> = await glyvio_entity.<EntityName>.new();
    }
  }

  /**
   * Constructs the main QueryBuilder query used to retrieve the <EntityName> entity.
   */
  getMainQuery(state: <EntityName>EditModalState): glyvio_core.QueryBuilder<glyvio_entity.<EntityName>> {
    const qb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(glyvio_structure.AllEntities.<entityNameCamelCase>);
    this.runInterceptorsSync<<EntityName>EditModalInterceptor>((l) => l.populateMainQuery(state, qb));
    return qb;
  }

  /**
   * Processes events received from UI actions (like saving or canceling).
   */
  async events(state: <EntityName>EditModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'save') {
      await this.actionSave(state);
      return 'STATE_FREEZED';
    }

    if (action.key === 'cancel') {
      await this.actionCancel(state);
      return 'STATE_FREEZED';
    }

    if (action.key == 'onChangeUserGroup') {
      state.<entityNameCamelCase>!.userGroupId = action.data.userGroupId;
      return 'STATE_UPDATE';
    }

    if (action.key == 'onChangeObservers') {
      state.<entityNameCamelCase>!.observers = action.data.observers;
      return 'STATE_UPDATE';
    }

    if (action.key == 'actionKeyChangeTags') {
      state.<entityNameCamelCase>!.tags = action.data.tags;
      return 'STATE_UPDATE';
    }

    return undefined;
  }

  /**
   * Closes the modal without saving changes.
   */
  async actionCancel(state: <EntityName>EditModalState): Promise<void> {
    await this.runInterceptorsAsync<<EntityName>EditModalInterceptor>(async (l) => {
      await l.onCancel(state);
    });
    await this.popModal(undefined);
  }

  /**
   * Saves the <EntityName> entity using entityService and triggers success toast.
   */
  async actionSave(state: <EntityName>EditModalState): Promise<void> {
    if (!state.<entityNameCamelCase>) {
      return;
    }

    // Assign default fallback values for booleans/fields here if not specified
    // e.g., state.<entityNameCamelCase>.active = state.<entityNameCamelCase>.active ?? true;

    const queue: glyvio_entity.<EntityName>[] = [state.<entityNameCamelCase>];

    await this.runInterceptorsAsync<<EntityName>EditModalInterceptor>(async (l) => {
      await l.onSave(state, queue);
    });

    await glyvio_core.entityService.saveList(queue);

    await this.popModal(
      state.routeParams?.popActionKey
        ? new glyvio_core.Action({
            key: state.routeParams.popActionKey,
            data: state.<entityNameCamelCase>,
          })
        : undefined,
    );
    await this.showToastSuccess(state, '<EntityName> saved successfully');
  }

  /**
   * Mutates the SimpleEditModalDesign object to define the form and action layouts.
   */
  getDesign(state: <EntityName>EditModalState, design: glyvio_core.SimpleEditModalDesign): void {
    design.maxWidth = 800;
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      title: state.routeParams?.id ? 'Update <EntityName>' : 'Create <EntityName>',
    });

    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: 'main.section',
        childDesign: new FormEntityLayoutDesign({
          columnSize: 280,
          key: 'main.layout',
          name: 'state.<entityNameCamelCase>',
          structureName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
          actionKeyChangeUserGroup: 'onChangeUserGroup',
          actionKeyChangeObservers: 'onChangeObservers',
          actionKeyChangeTags: 'actionKeyChangeTags',
          children: [
            // Example of a required String field
            new glyvio_core.FormLayoutFieldDesign({
              columns: 1,
              key: '<fieldName1>.formField',
              child: new glyvio_core.StringTextfieldDesign({
                errorText: glyvio_core.TextFieldDesign.isRequired(state, 'state.<entityNameCamelCase>.<fieldName1>'),
                name: 'state.<entityNameCamelCase>.<fieldName1>',
                label: '<FieldLabel1>',
                autofocus: true,
              }),
            }),
            // Add more form fields (e.g. BooleanTextfieldDesign, DecimalTextfieldDesign) here
          ],
        }),
      }),
    ];

    design.actionBarDesign = [
      new glyvio_core.ActionButtonDesign({
        key: 'cancel.button',
        title: 'Cancel',
        type: 'SECONDARY',
        action: new glyvio_core.Action({
          key: 'cancel',
        }),
      }),
      new glyvio_core.ActionButtonDesign({
        key: 'save.button',
        title: 'Save',
        type: 'PRIMARY',
        action: new glyvio_core.Action({
          keyLoadingComponent: this.callBackId!,
          key: 'save',
        }),
      }),
    ];
  }
}

/**
 * Route definition for registering <EntityName>EditModal.
 */
export class <EntityName>EditModalRoute extends glyvio_core.SimpleEditModalRoute<<EntityName>EditModalRouteParams> {
  /**
   * Permissions checking for accessing the route.
   */
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.<PermissionName>;
  }

  /**
   * The relative URL path for navigating to this edit modal.
   */
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/custom-product-edit'
  }

  /**
   * Namespace identifying the custom plugin.
   */
  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  /**
   * Object/class name of the modal.
   */
  getRouteNameObject(): string {
    return '<EntityName>EditModal';
  }
}

/**
 * Interceptor class allowing other plugins to hook into <EntityName>EditModal.
 */
export abstract class <EntityName>EditModalInterceptor extends glyvio_core.SimpleEditModalInterceptor<<EntityName>EditModalState> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <EntityName>EditModalRoute;
  }

  /**
   * Hook to modify or add criteria to the main entity query.
   */
  populateMainQuery(
    state: <EntityName>EditModalState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<EntityName>>,
  ): void {}

  /**
   * Hook called when modal cancellation is triggered.
   */
  async onCancel(state: <EntityName>EditModalState): Promise<void> {}

  /**
   * Hook called prior to database save operations.
   */
  async onSave(state: <EntityName>EditModalState, queue: glyvio_entity.<EntityName>[]): Promise<void> {}
}
```
