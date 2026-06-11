# Custom Selection Modal using SimpleEntityModal

This example demonstrates how to implement a custom selection modal by extending `glyvio_core.SimpleEntityModal`. A selection modal is used to display, filter, search, and select records of a specific database entity model (such as `AppUser`) from a list.

---

## 🛠️ Complete Implementation

Create a new file in your plugin views directory (e.g., `src/views/custom_user_modal.ts`) and paste the following content:

```typescript
/**
 * Options for configuring the Custom User Modal.
 */
export interface CustomUserModalOptions {
  // Optional configuration parameters can be added here
}

/**
 * State representation for the Custom User Modal.
 */
export interface CustomUserModalState extends glyvio_core.SimpleEntityModalState<CustomUserModalOptions> {
  // Additional state parameters can be defined here
}

/**
 * Custom User selection modal that extends SimpleEntityModal.
 * Binds to the AppUser entity structure for selection and display.
 */
export class CustomUserModal extends glyvio_core.SimpleEntityModal<CustomUserModalState, glyvio_entity.AppUser> {
  constructor() {
    super(CustomUserModalRoute);
  }

  /**
   * Restricts search queries to non-deleted records and orders by name.
   */
  populateQueryBuilder(
    state: CustomUserModalState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
  ): void {
    queryBuilder
      .setFromEntity(glyvio_structure.AllEntities.appUser)
      .addFilterOperator(glyvio_structure.AllEntities.appUser.deleted, false)
      .addOrderByEntity(glyvio_structure.AllEntities.appUser.name);
  }

  /**
   * Filters the list when autocomplete is triggered. Searches by user code or name.
   */
  populateAutocompleteFilter(state: CustomUserModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterILike({
      field: glyvio_structure.AllEntities.appUser.name,
      value: text,
      ors: [
        new glyvio_core.QueryBuilderFilterILike({
          field: glyvio_structure.AllEntities.appUser.code,
          value: text,
        }),
      ],
    });
  }

  /**
   * Filters the database search for specific selection using exact matching.
   */
  populateSelectFilter(state: CustomUserModalState, text: string): glyvio_core.QueryBuilderFilter {
    return new glyvio_core.QueryBuilderFilterOperator({
      field: glyvio_structure.AllEntities.appUser.code,
      value: text,
    });
  }

  /**
   * Renders the layout of each item cell inside the selection list.
   */
  getDesignForCell(state: CustomUserModalState, item: glyvio_entity.AppUser): glyvio_core.WidgetDesign {
    return new glyvio_core.RowLayoutDesign({
      crossAlignment: 'CENTER',
      children: [
        new glyvio_core.RowLayoutFieldDesign({
          isExpanded: true,
          child: new glyvio_core.StringTextDesign({ value: `$S{item.code} - $S{item.name}` }),
        }),
      ],
    });
  }

  /**
   * Renders the small badge/chip representing the chosen user.
   */
  getDesignForChip(child: glyvio_entity.AppUser): glyvio_core.ChipDesign {
    return new glyvio_core.ChipDesign({
      label: '$S{item.code} - $S{item.name}',
    });
  }

  /**
   * Configures the title and buttons shown in the modal's AppBar header.
   */
  getDesignForAppBar(state: CustomUserModalState): glyvio_core.AppBarDesign {
    return new glyvio_core.SimpleAppBarDesign({
      title: 'Select User',
      buttons: [],
    });
  }

  /**
   * The text representation of the selected entity.
   */
  getDesignForSelectText(state: CustomUserModalState, item: glyvio_entity.AppUser): string | undefined {
    return item.code ?? '';
  }

  /**
   * The design widget shown inside select field components when an item is selected.
   */
  getDesignForSelectChild(state: CustomUserModalState, item: glyvio_entity.AppUser): glyvio_core.WidgetDesign {
    return new glyvio_core.RowLayoutDesign({
      crossAlignment: 'CENTER',
      children: [
        new glyvio_core.RowLayoutFieldDesign({
          isExpanded: true,
          child: new glyvio_core.StringTextDesign({ value: `$S{item.code} - $S{item.name}` }),
        }),
      ],
    });
  }

  /**
   * Return tracking metadata to enable real-time UI updates when the record changes.
   */
  getEntityToTracking(item: glyvio_entity.AppUser): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.appUser.getStructureName(),
      objectId: item.id!,
    };
  }

  /**
   * Handles user input and other interaction events in this modal.
   */
  async events(state: CustomUserModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }
}

/**
 * Route registry definition for the custom selection modal.
 */
export class CustomUserModalRoute extends glyvio_core.SimpleEntityModalRoute<CustomUserModalOptions> {
  getRoutePath(): string {
    return `/custom-user-entity`;
  }

  getRouteNameSpace(): string {
    return 'custom_plugin_namespace';
  }

  getRouteNameObject(): string {
    return 'CustomUserModal';
  }
}

/**
 * Interceptor class allowing custom plugins to listen to and adjust modal configuration.
 */
export abstract class CustomUserModalInterceptor extends glyvio_core.SimpleEntityModalInterceptor<
  CustomUserModalState,
  glyvio_entity.AppUser
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return CustomUserModalRoute;
  }
}

/**
 * A custom autocomplete search textfield design targeting this modal.
 */
export class CustomUserSingleTextfield extends glyvio_core.EntityAutocompleteSingleTextfieldDesign {
  constructor(args?: Partial<CustomUserSingleTextfield>) {
    super(args);
    this.label = this.label ?? 'User';
    this.pathEntityModal = `/custom-user-entity`;
    this.nameSpace = 'custom_plugin_namespace';
    this.nameObject = 'CustomUserModal';
  }
}

/**
 * A custom autocomplete search textfield design to multiple objects targeting this modal.
 */
export class CustomUserListTextfield extends glyvio_core.EntityAutocompleteMultipleTextfieldDesign {
  constructor(args?: Partial<CustomUserListTextfield>) {
    super(args);
    this.label = this.label ?? 'User';
    this.pathEntityModal = `/custom-user-entity`;
    this.nameSpace = 'custom_plugin_namespace';
    this.nameObject = 'CustomUserModal';
  }
}

/**
 * A custom select (normally code) search textfield design targeting this modal.
 */
export class CustomUserSelectTextfield extends glyvio_core.EntitySelectTextfieldDesign {
  constructor(args?: Partial<CustomUserSelectTextfield>) {
    super(args);
    this.label = this.label ?? 'User';
    this.pathEntityModal = `/custom-user-entity`;
    this.nameSpace = 'custom_plugin_namespace';
    this.nameObject = 'CustomUserModal';
  }
}
```

---

## 🔍 Key Architectural Points

1. **`glyvio_core.SimpleEntityModal`**:

   - The core base view class used to construct modal windows for database models.
   - Automatically handles fetching records asynchronously with pagination.
   - Connects selection events directly with calling forms and auto-closes on selection.

2. **`populateQueryBuilder`**:

   - Injects query filters (like setting deleted flags) and order specifications into database actions.
   - Runs both class-level logic and active plugin interceptors in sequence.

3. **`populateAutocompleteFilter` & `populateSelectFilter`**:

   - Provides granular control over the SQL `WHERE` clauses triggered during user input autocomplete suggestions or exact selections.

4. **`CustomUserSingleTextfield`**:
   - A reusable input component wrapper.
   - Binds directly to the custom modal route configuration by name and namespace.
   - Displays as a standard dropdown textfield that pops open the search modal on tap.
