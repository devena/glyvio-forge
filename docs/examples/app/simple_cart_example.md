# Custom Cart using SimpleCart

This example demonstrates how to implement a custom shopping/selection cart view by subclassing `glyvio_core.SimpleCart`. It covers setting up custom routing, managing state, configuring the cart UI design, defining cart item status rules, implementing addition/removal event hooks, handling file uploads, and creating a listener class to intercept cart actions.

---

## 🛠️ Complete Implementation

Create a new file in your plugin views directory (e.g., `src/views/user_selection_cart.ts`) and paste the following content:

```typescript
/**
 * Route parameters for navigating to the User Selection Cart.
 */
export interface UserSelectionCartRouteParams extends glyvio_core.SimpleCartRouteParams {
  /**
   * Optional filter to only display and allow users with a specific role in the cart.
   */
  role?: string;
}

/**
 * State representation for the User Selection Cart.
 */
export interface UserSelectionCartState extends glyvio_core.SimpleCartState<UserSelectionCartRouteParams> {
  /**
   * Track the date/time when selection started.
   */
  selectionStartedAt?: string;
}

/**
 * Route definition for registering UserSelectionCart.
 */
export class UserSelectionCartRoute extends glyvio_core.SimpleCartRoute<UserSelectionCartRouteParams> {
  /**
   * Permissions checking for accessing this route.
   */
  override getRoutePermission(): glyvio_permissions.Permission | undefined {
    return undefined; // Set to a specific permission constant if authorization is required
  }

  /**
   * The relative URL path for navigating to this cart view.
   */
  override getRoutePath(): string {
    return '/user-selection-cart';
  }

  /**
   * Namespace identifying the custom plugin.
   */
  override getRouteNameSpace(): string {
    return 'custom_user_plugin';
  }

  /**
   * Object/class name of the cart view.
   */
  override getRouteNameObject(): string {
    return 'UserSelectionCart';
  }
}

/**
 * Custom simple cart implementation for managing `AppUser` selections.
 */
export class UserSelectionCart extends glyvio_core.SimpleCart<UserSelectionCartState> {
  constructor() {
    super(UserSelectionCartRoute);
  }

  /**
   * Configures the layout and visual properties of the simple cart design.
   */
  override getDesign(state: UserSelectionCartState, design: glyvio_core.SimpleCartDesign): void {
    design.titleOpened = 'Selected Users';
    design.icon = 'fa_shopping_cart';
    design.allowDropFile = true;
    design.maxHeight = 600;
    design.maxWidth = 450;

    // Build the sections layout dynamically
    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: 'cart-info-section',
        childDesign: new glyvio_core.ColumnLayoutDesign({
          key: 'cart-info-layout',
          children: [
            new glyvio_core.StringTextDesign({
              key: 'cart-instructions',
              value: `Filter Applied: Role = ${state.routeParams?.role ?? 'All Eligible'}. Drag and drop csv lists or upload attachments to bulk-add.`,
            }),
          ],
        }),
      }),
    ];
  }

  /**
   * Evaluates the status of a specific item in the context of the cart.
   */
  override getStatusItemOfCart(
    state: UserSelectionCartState,
    entityName: string,
    entityId: string,
    data: any,
  ): glyvio_core.CartItemStatus {
    // Only support AppUser selections
    if (entityName !== 'AppUser') {
      return 'NOT_ALLOWED';
    }

    // Example constraint: filter users by role if requested in the route parameters
    if (state.routeParams?.role && data?.role !== state.routeParams.role) {
      return 'NOT_ALLOWED';
    }

    return 'ALLOW_ADD';
  }

  /**
   * Logic executed when a user confirms adding an item to the cart.
   */
  override async addItemToCart(
    state: UserSelectionCartState,
    entityName: string,
    entityId: string,
    data: any,
  ): Promise<glyvio_entity.AppUser | undefined> {
    if (entityName === 'AppUser') {
      const user = new glyvio_entity.AppUser();
      user.id = entityId;
      user.name = data?.name ?? 'Anonymous User';
      user.email = data?.email;

      // Perform database changes or trigger local notifications here
      await this.showToastSuccess(state, `User ${user.name} added to cart`);
      return user;
    }
    return undefined;
  }

  /**
   * Logic executed when removing an item from the cart.
   */
  override async removeItemFromCart(
    state: UserSelectionCartState,
    entityName: string,
    entityId: string,
    data: any,
  ): Promise<glyvio_entity.AppUser | undefined> {
    if (entityName === 'AppUser') {
      const user = new glyvio_entity.AppUser();
      user.id = entityId;
      user.name = data?.name ?? 'User';

      await this.showToastInfo(state, `User ${user.name} removed from cart`);
      return user;
    }
    return undefined;
  }

  /**
   * Post-processing logic when a file is uploaded inside the cart view.
   */
  override async onFileUploaded(
    state: UserSelectionCartState,
    attachment: glyvio_entity.Attachment,
    extras?: unknown,
  ): Promise<void> {
    // Process CSV uploads, user lists, or associated document logs
    await this.showToastSuccess(state, `Processed attachment: ${attachment.name}`);
  }
}

/**
 * Custom Listener class to intercept events and dynamically augment the behavior/design of UserSelectionCart.
 */
export class UserSelectionCartListener extends glyvio_core.SimpleCartListener<UserSelectionCartState> {
  /**
   * Identifies the route constructor this listener is bound to.
   */
  override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return UserSelectionCartRoute;
  }

  /**
   * Unique identifier of this interceptor/listener.
   */
  override getListenerId(): string {
    return 'user_selection_cart_listener';
  }

  /**
   * Intercepts the SimpleCartDesign configuration to apply dynamic modifications.
   */
  override getDesign(state: UserSelectionCartState, design: glyvio_core.SimpleCartDesign): void {
    // Interceptors can modify the title dynamically
    design.titleOpened = `${design.titleOpened} (Listener Enabled)`;
  }

  /**
   * Intercepts when an item is added to the cart.
   */
  override async onAddItemToCart(
    state: UserSelectionCartState,
    entityName: string,
    entityId: string,
    data: any,
    addedEntity: unknown | undefined,
  ): Promise<unknown | undefined> {
    // Interceptor can audit additions or mutate return values
    return addedEntity;
  }

  /**
   * Intercepts when an item is removed from the cart.
   */
  override async onRemoveItemFromCart(
    state: UserSelectionCartState,
    entityName: string,
    entityId: string,
    data: any,
    removedEntity: unknown | undefined,
  ): Promise<unknown | undefined> {
    return removedEntity;
  }

  /**
   * Intercepts and overrides item status resolution.
   */
  override getStatusItemOfCart(
    state: UserSelectionCartState,
    entityName: string,
    entityId: string,
    data: any,
  ): glyvio_core.CartItemStatus | undefined {
    // Returning undefined yields control back to the SimpleCart view implementation
    return undefined;
  }
}

// -------------------------------------------------------------
// Route & Listener Registration
// -------------------------------------------------------------

// 1. Register the route class with Glyvio's routing service
glyvio_core.routerService.loadRoutes([UserSelectionCartRoute]);

// 2. Register the listener class with Glyvio's interceptor service
glyvio_core.appInterceptorService.registerInterceptors([
  {
    interceptor: UserSelectionCartListener,
    order: 10,
  },
]);
```

---

## 🔍 Key Architectural Points

1. **`glyvio_core.SimpleCart`**:

   - The base view class that provides a collapsible sidebar cart overlay, facilitating item compilation, upload attachments, and transactional callbacks.

2. **`getStatusItemOfCart`**:

   - Governs whether interactive cart buttons display actions to add, remove, or show status indicators.
   - Returning `CartItemStatus` options like `'ALLOW_ADD'`, `'ADDED'`, `'NOT_ALLOWED'`, or `'PROCESSING'` determines button visibility and behaviors.

3. **`addItemToCart` and `removeItemFromCart`**:

   - Asynchronous lifecycle hooks invoked when add/remove actions are triggered on items. Use these hooks to modify states, persist relations, or communicate with background servers.

4. **`glyvio_core.SimpleCartListener`**:
   - Interceptor pattern enabling separate plugins or modular aspects to inspect or decorate cart designs and actions without modifying the core cart view code.
