# Custom Batch Cart using SimpleBatchCart

This example demonstrates how to implement a custom batch cart view by subclassing `glyvio_core.SimpleBatchCart`. It covers setting up custom routing, state management, bulk spreadsheet imports, inline editing, batch database persistence, and listening to batch events via `glyvio_core.SimpleBatchCartInterceptor`.

---

## 🛠️ Complete Implementation

Create a new file in your plugin views directory (e.g., `src/views/user_batch_cart.ts`) and paste the following content:

```typescript
/**
 * Route parameters for navigating to the User Batch Cart.
 */
export interface UserBatchCartRouteParams extends glyvio_core.SimpleBatchCartRouteParams {
  /**
   * Optional department filter parameter.
   */
  department?: string;
}

/**
 * State representation for the User Batch Cart.
 */
export interface UserBatchCartState extends glyvio_core.SimpleBatchCartState<UserBatchCartRouteParams> {
  /**
   * Tracks when the last batch save action succeeded.
   */
  lastBatchRun?: string;
}

/**
 * Item DTO representing user records inside the batch cart.
 */
export interface UserBatchCartDto extends glyvio_core.SimpleBatchCartDto {
  /**
   * The name of the user.
   */
  name?: string;
  /**
   * The email address of the user.
   */
  email?: string;
  /**
   * Associated user group ID for inline selection.
   */
  userGroupId?: string;
  /**
   * List of tags associated with this user.
   */
  tags?: string[];
  /**
   * User IDs observing modifications on this user.
   */
  observers?: string[];
}

/**
 * Route definition for registering UserBatchCart.
 */
export class UserBatchCartRoute extends glyvio_core.SimpleBatchCartRoute<UserBatchCartRouteParams> {
  /**
   * Permissions checking for accessing this route.
   */
  override getRoutePermission(): glyvio_permissions.Permission | undefined {
    return undefined; // Set authorization permission if necessary
  }

  /**
   * The relative URL path for navigating to this cart view.
   */
  override getRoutePath(): string {
    return '/user-batch-cart';
  }

  /**
   * Namespace identifying the custom plugin.
   */
  override getRouteNameSpace(): string {
    return 'custom_batch_plugin';
  }

  /**
   * Object/class name of the cart view.
   */
  override getRouteNameObject(): string {
    return 'UserBatchCart';
  }
}

/**
 * Custom batch cart view subclassing SimpleBatchCart for bulk user updates and spreadsheet imports.
 */
export class UserBatchCart extends glyvio_core.SimpleBatchCart<UserBatchCartState, UserBatchCartDto> {
  constructor() {
    super(UserBatchCartRoute);
  }

  /**
   * Configures the layout and general parameters of the batch cart design.
   */
  override getDesign(state: UserBatchCartState, design: glyvio_core.SimpleBatchCartDesign): void {
    design.appBarDesign!.title = 'Bulk User Imports & Updates';
    design.allowUpload = true;
    design.allowDownload = true;
  }

  /**
   * Defines whether an entity type can be added or updated in the context of this cart.
   */
  override getStatusItemOfCart(
    state: UserBatchCartState,
    entityName: string,
    entityId: string,
    data: any,
  ): glyvio_core.CartItemStatus {
    if (entityName !== 'AppUser') {
      return 'NOT_ALLOWED';
    }
    return 'ALLOW_ADD';
  }

  /**
   * Populates a DTO from a cart button action payload.
   */
  override async populateDtoFromCartButton(
    state: UserBatchCartState,
    item: UserBatchCartDto,
    entityName: string,
    entityId: string,
    data: any,
  ): Promise<void> {
    item.id = entityId;
    item.entityName = entityName;
    item.name = data?.name ?? 'New Import';
    item.email = data?.email ?? '';
    item.userGroupId = data?.userGroupId ?? undefined;
    item.tags = data?.tags ?? [];
    item.observers = data?.observers ?? [];
  }

  /**
   * Customizes row design configurations for cart items.
   */
  override getDesignForRow(state: UserBatchCartState, item: UserBatchCartDto): glyvio_core.TableLayoutRowDesign {
    const row = super.getDesignForRow(state, item);
    return row;
  }

  /**
   * A helper method to retrieve the columns configuration representation.
   */
  getColumns(state: UserBatchCartState): glyvio_core.SimpleBatchCartDtoLayoutItem[] {
    return this.getDtoLayout(state);
  }

  /**
   * Maps a raw spreadsheet row into the target DTO item structure.
   */
  override async getDtoSpreadsheetFromLine(
    state: UserBatchCartState,
    cache: glyvio_core.CacheController,
    item: UserBatchCartDto,
    columns: string[],
    line: { [key: string]: any },
  ): Promise<void> {
    item.id = line['id'] || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    item.entityName = 'AppUser';
    item.name = line['name'] || '';
    item.email = line['email'] || '';
  }

  /**
   * Converts the DTO item into a queue of database entities ready for persistence.
   */
  override async getEntitiesFromDto(
    state: UserBatchCartState,
    item: UserBatchCartDto,
    queue: glyvio_core.EntityServiceQueue,
  ): Promise<glyvio_core.EntityServiceQueue> {
    const user = new glyvio_entity.AppUser();
    user.id = item.id;
    user.name = item.name;
    user.email = item.email;
    user.userGroupId = item.userGroupId;
    user.tags = item.tags;
    user.observers = item.observers;

    queue.push(user);
    return queue;
  }

  /**
   * Defines columns and inline layout editing configurations using SimpleBatchCartDtoLayoutItem.
   */
  override getDtoLayout(state: UserBatchCartState): glyvio_core.SimpleBatchCartDtoLayoutItem[] {
    return [
      this.generateSimpleStringDtoLayout('name', 'User Name', 'item.name'),
      this.generateSimpleStringDtoLayout('email', 'Email Address', 'item.email'),
      this.generateSimpleUserGroupDtoLayout('userGroup', 'User Group', 'item'),
      this.generateSimpleTagsDtoLayout('tags', 'Tags', 'item', 'AppUser'),
      this.generateSimpleObserversDtoLayout('observers', 'Observers', 'item'),
    ];
  }

  /**
   * Maps spreadsheet headers to the corresponding DTO properties.
   */
  override getSpreadsheetLayout(state: UserBatchCartState): { spreadsheetName: string; dtoName: string }[] {
    return [
      { spreadsheetName: 'id', dtoName: 'item.id' },
      { spreadsheetName: 'name', dtoName: 'item.name' },
      { spreadsheetName: 'email', dtoName: 'item.email' },
    ];
  }

  /**
   * Executed when a DTO item property is updated in line.
   */
  override async onUpdateItem(
    key: string,
    state: UserBatchCartState,
    oldItemState: UserBatchCartDto,
    newItemState: UserBatchCartDto,
  ): Promise<void> {
    if (key === 'email' && newItemState.email) {
      if (!newItemState.email.includes('@')) {
        newItemState.__status = 'ERROR_DTO';
        newItemState.__statusDesc = 'Invalid email address';
      } else {
        newItemState.__status = 'AWAITING';
        newItemState.__statusDesc = '';
      }
    }
  }
}

/**
 * Custom interceptor subclassing SimpleBatchCartInterceptor to hook into batch events.
 */
export class UserBatchCartInterceptor extends glyvio_core.SimpleBatchCartInterceptor<
  UserBatchCartState,
  UserBatchCartDto
> {
  override getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return UserBatchCartRoute;
  }

  override getListenerId(): string {
    return 'user_batch_cart_interceptor';
  }

  /**
   * Intercepts DTO updates to perform additional validation or audits.
   */
  override async onUpdateItem(
    key: string,
    state: UserBatchCartState,
    oldItemState: UserBatchCartDto,
    newItemState: UserBatchCartDto,
  ): Promise<void> {
    // Interceptor logic when an item changes
  }

  /**
   * Intercepts when a DTO is being mapped to database entities.
   */
  override async getEntitiesFromDto(
    state: UserBatchCartState,
    item: UserBatchCartDto,
    queue: glyvio_core.EntityServiceQueue,
  ): Promise<void> {
    // Interceptor logic to append extra entities to the transaction
  }
}

// -------------------------------------------------------------
// Route & Interceptor Registration
// -------------------------------------------------------------

// 1. Register the route class with Glyvio's routing service
glyvio_core.routerService.loadRoutes([UserBatchCartRoute]);

// 2. Register the interceptor class with Glyvio's interceptor service
glyvio_core.appInterceptorService.registerInterceptors([
  {
    interceptor: UserBatchCartInterceptor,
    order: 10,
  },
]);
```

---

## 🔍 Key Architectural Points

1. **`glyvio_core.SimpleBatchCart`**:

   - The base view class that provides a spreadsheet-like batch operation table, enabling spreadsheet imports/exports, column-based inline changes, and unified transactions.

2. **Spreadsheet Handling**:

   - `getSpreadsheetLayout`: Sets the layout mappings.
   - `getDtoSpreadsheetFromLine`: Receives raw parsed spreadsheet data and translates it into the appropriate DTO fields.

3. **Inline Column Editing (`SimpleBatchCartDtoLayoutItem`)**:

   - By calling helper methods like `generateSimpleStringDtoLayout`, you define how fields render and enable options like "Change All" on the header menu automatically.

4. **Transactional Saving**:
   - `getEntitiesFromDto`: Groups the mapped database models into a single transaction. Under the hood, `onSaveItem` invokes this mapping and calls `entityService.saveList(queue)`.
