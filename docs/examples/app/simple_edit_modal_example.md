# Custom Edit Modal using SimpleEditModal

This example demonstrates how to implement a custom edit modal by extending `glyvio_core.SimpleEditModal`. An edit modal is used to display form fields, validate user inputs, and save changes to a specific database entity model (such as `AppUser`).

---

## 🛠️ Complete Implementation

Create a new file in your plugin views directory (e.g., `src/views/custom_user_edit_modal.ts`) and paste the following content:

```typescript
/**
 * State representation for the Custom User Edit Modal.
 */
export interface CustomUserEditModalState extends glyvio_core.SimpleEditModalState<CustomUserEditModalRouteParams> {
  /**
   * The AppUser record currently being created or edited.
   */
  appUser?: glyvio_entity.AppUser | null;
}

/**
 * Route parameters for navigating to the Custom User Edit Modal.
 */
export interface CustomUserEditModalRouteParams extends glyvio_core.SimpleEditModalRouteParams {
  /**
   * The unique identifier of the AppUser record to edit. If omitted, a new record is created.
   */
  id?: string;
}

/**
 * Custom Edit Modal extending SimpleEditModal.
 * Used to create or update an AppUser record with form controls.
 */
export class CustomUserEditModal extends glyvio_core.SimpleEditModal<CustomUserEditModalState> {
  constructor() {
    super(CustomUserEditModalRoute);
  }

  /**
   * Initializes the state of the modal. Loads the entity if ID is provided, otherwise creates a new record.
   */
  async initState(state: CustomUserEditModalState): Promise<void> {
    await super.initState(state);

    if (state.routeParams?.id) {
      const qb = this.getMainQuery(state).addFilterOperator(
        glyvio_structure.AllEntities.appUser.id,
        state.routeParams.id,
      );
      const user = await qb.findFirst();
      if (!user) {
        throw new glyvio_core.GlyvioError({
          message: 'User not found.',
        });
      }
      state.appUser = user;
    } else {
      state.appUser = await glyvio_entity.AppUser.new();
    }
  }

  /**
   * Constructs the main QueryBuilder query used to retrieve the AppUser entity.
   */
  getMainQuery(state: CustomUserEditModalState): glyvio_core.QueryBuilder<glyvio_entity.AppUser> {
    const qb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.AppUser>(glyvio_structure.AllEntities.appUser);
    this.runInterceptorsSync<CustomUserEditModalInterceptor>((l) => l.populateMainQuery(state, qb));
    return qb;
  }

  /**
   * Processes events received from UI actions (like saving or canceling).
   */
  async events(state: CustomUserEditModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'save') {
      await this.actionSave(state);
      return 'STATE_FREEZED';
    }

    if (action.key === 'cancel') {
      await this.actionCancel(state);
      return 'STATE_FREEZED';
    }

    return undefined;
  }

  /**
   * Closes the modal without saving changes.
   */
  async actionCancel(state: CustomUserEditModalState): Promise<void> {
    await this.runInterceptorsAsync<CustomUserEditModalInterceptor>(async (l) => {
      await l.onCancel(state);
    });
    await this.popModal(undefined);
  }

  /**
   * Saves the user entity using entityService and triggers success toast.
   */
  async actionSave(state: CustomUserEditModalState): Promise<void> {
    if (!state.appUser) {
      return;
    }

    // Assign default fallback values if not specified
    state.appUser.admin = state.appUser.admin ?? false;

    const queue: glyvio_entity.AppUser[] = [state.appUser];

    await this.runInterceptorsAsync<CustomUserEditModalInterceptor>(async (l) => {
      await l.onSave(state, queue);
    });

    await glyvio_core.entityService.saveList(queue);

    await this.popModal(
      state.routeParams?.popActionKey
        ? new glyvio_core.Action({
            key: state.routeParams.popActionKey,
            data: state.appUser,
          })
        : undefined,
    );
    await this.showToastSuccess(state, 'User saved successfully');
  }

  /**
   * Mutates the SimpleEditModalDesign object to define the form and action layouts.
   */
  getDesign(state: CustomUserEditModalState, design: glyvio_core.SimpleEditModalDesign): void {
    design.maxWidth = 800;
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      title: state.routeParams?.id ? 'Update User' : 'Create User',
    });

    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: 'main.section',
        childDesign: new glyvio_core.FormLayoutDesign({
          columnSize: 280,
          key: 'main.layout',
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              columns: 1,
              key: 'name.formField',
              child: new glyvio_core.StringTextfieldDesign({
                errorText: glyvio_core.TextFieldDesign.isRequired(state, 'state.appUser.name'),
                name: 'state.appUser.name',
                label: 'Full Name',
                autofocus: true,
              }),
            }),
            new glyvio_core.FormLayoutFieldDesign({
              columns: 1,
              key: 'email.formField',
              child: new glyvio_core.StringTextfieldDesign({
                errorText: glyvio_core.TextFieldDesign.isRequired(state, 'state.appUser.email'),
                name: 'state.appUser.email',
                label: 'Email Address',
              }),
            }),
            new glyvio_core.FormLayoutFieldDesign({
              columns: 1,
              key: 'admin.formField',
              child: new glyvio_core.BooleanTextfieldDesign({
                name: 'state.appUser.admin',
                label: 'Administrator Access',
              }),
            }),
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
 * Route definition for registering CustomUserEditModal.
 */
export class CustomUserEditModalRoute extends glyvio_core.SimpleEditModalRoute<CustomUserEditModalRouteParams> {
  /**
   * Permissions checking for accessing the route.
   */
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_app_user_edit_modal;
  }

  /**
   * The relative URL path for navigating to this edit modal.
   */
  getRoutePath(): string {
    return '/custom-user-edit';
  }

  /**
   * Namespace identifying the custom plugin.
   */
  getRouteNameSpace(): string {
    return 'custom_user_plugin';
  }

  /**
   * Object/class name of the modal.
   */
  getRouteNameObject(): string {
    return 'CustomUserEditModal';
  }
}

/**
 * Interceptor class allowing other plugins to hook into CustomUserEditModal.
 */
export abstract class CustomUserEditModalInterceptor extends glyvio_core.SimpleEditModalInterceptor<CustomUserEditModalState> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return CustomUserEditModalRoute;
  }

  /**
   * Hook to modify or add criteria to the main entity query.
   */
  populateMainQuery(
    state: CustomUserEditModalState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
  ): void {}

  /**
   * Hook called when modal cancellation is triggered.
   */
  async onCancel(state: CustomUserEditModalState): Promise<void> {}

  /**
   * Hook called prior to database save operations.
   */
  async onSave(state: CustomUserEditModalState, queue: glyvio_entity.AppUser[]): Promise<void> {}
}
```

---

## 🔍 Key Architectural Points

1. **`glyvio_core.SimpleEditModal`**:

   - The base view class used to construct forms for creating or modifying database entities.
   - Automatically handles updating entity records on update notifications.

2. **`initState`**:

   - Executes asynchronously when loading the edit modal.
   - Loads a record from the database using the unique entity ID passed through `routeParams`. If no ID is passed, it initializes a new entity instance.

3. **`getDesign`**:

   - Generates and modifies `SimpleEditModalDesign` to determine the form fields, layouts, headers, and primary buttons.
   - Supports form validation using functions such as `glyvio_core.TextFieldDesign.isRequired`.

4. **`CustomUserEditModalInterceptor`**:
   - Provides hooks allowing other plugins to intercept queries, design layouts, and cancellation/save events.
