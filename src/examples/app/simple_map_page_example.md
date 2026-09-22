# Simple Map Page Example

This example demonstrates how to implement a custom map page using `glyvio_core.SimpleMapPage` to display geolocation points of `AppUser` entities. It showcases custom routing, state definition, map viewport query filtering, cell/marker layout configuration, and interceptor support.

```typescript
// Define state filters for the sidebar
export interface AppUserMapFilter extends glyvio_core.SimpleMapPageStateFilter {
  role?: string;
  isActive?: boolean;
}

// Define route parameters
export interface AppUserMapRouteParams extends glyvio_core.SimpleMapPageRouteParams<AppUserMapFilter> {}

// Define the page state
export interface AppUserMapPageState extends glyvio_core.SimpleMapPageState<AppUserMapRouteParams, AppUserMapFilter> {}

// Define the route definition
export class AppUserMapPageRoute extends glyvio_core.SimpleMapPageRoute<AppUserMapRouteParams> {
  getRoutePath(): string {
    return '/app-users-map';
  }

  getRouteNameSpace(): string {
    return 'my_plugin';
  }

  getRouteNameObject(): string {
    return 'AppUserMapPage';
  }
}

// Implement the map page class
export class AppUserMapPage extends glyvio_core.SimpleMapPage<AppUserMapPageState, glyvio_entity.AppUser> {
  constructor() {
    super(AppUserMapPageRoute);
  }

  /**
   * Customizes the visual layout and configuration of the map page design.
   */
  getDesign(state: AppUserMapPageState, design: glyvio_core.SimpleMapPageDesign): void {
    design.appBarDesign!.title = 'User Location Map';

    // Add custom filter form components to the sidebar
    design.filterSectionsDesign?.push(
      new glyvio_core.FormSectionDesign({
        childDesign: new glyvio_core.ColumnLayoutDesign({
          children: [
            new glyvio_core.StringTextfieldDesign({
              name: 'state.filtersSidebar.role',
              label: 'Filter by Role',
            }),
          ],
        }),
      }),
    );
  }

  /**
   * Generates and returns a custom map cell/pin design mapping properties
   * of the user record to geographic coordinates.
   */
  getDesignForCell(state: AppUserMapPageState, item: glyvio_entity.AppUser): glyvio_core.SimpleMapCellDesign {
    // Assume latitude and longitude are stored as properties of AppUser, or mock them
    const latVal = (item as any).latitude ?? 0.0;
    const lngVal = (item as any).longitude ?? 0.0;

    return new glyvio_core.SimpleMapCellDesign({
      title: item.name ?? 'Unknown User',
      latitude: typeof latVal === 'object' && latVal !== null && 'toNumber' in latVal ? latVal.toNumber() : latVal,
      longitude: typeof lngVal === 'object' && lngVal !== null && 'toNumber' in lngVal ? lngVal.toNumber() : lngVal,
      description: item.email ?? 'No email',
    });
  }

  /**
   * Configures the query builder properties to select AppUser attributes.
   */
  populateQueryBuilder(
    state: AppUserMapPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
  ): void {
    queryBuilder.setFromEntity(glyvio_structure.AllEntities.appUser);
    queryBuilder.addSelect('id');
    queryBuilder.addSelect('name');
    queryBuilder.addSelect('email');

    // Apply role sidebar filter if specified
    if (state.filtersSidebar?.role) {
      queryBuilder.addFilter(queryBuilder.filter().equals('role', state.filtersSidebar.role));
    }
  }

  /**
   * Creates search filters based on search bar text query.
   */
  populateMainFilter(state: AppUserMapPageState, text: string): glyvio_core.QueryBuilderFilter {
    const qb = new glyvio_core.QueryBuilder<glyvio_entity.AppUser>();
    return qb.filter().or([qb.filter().like('name', `%${text}%`), qb.filter().like('email', `%${text}%`)]);
  }

  /**
   * Applies geographic boundaries to only load users within the visible map viewport.
   */
  populateAreaFilter(
    state: AppUserMapPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
    southWestLatitude: Decimal,
    southWestLongitude: Decimal,
    northEastLatitude: Decimal,
    northEastLongitude: Decimal,
  ): void {
    queryBuilder.addFilter(
      queryBuilder
        .filter()
        .greaterThanOrEqual('latitude', southWestLatitude)
        .lessThanOrEqual('latitude', northEastLatitude)
        .greaterThanOrEqual('longitude', southWestLongitude)
        .lessThanOrEqual('longitude', northEastLongitude),
    );
  }

  /**
   * Event handler triggered when a user marker pin is tapped on the map interface.
   */
  async onCellTap(state: AppUserMapPageState, item: glyvio_entity.AppUser): Promise<void> {
    console.log(`User marker tapped: ${item.name}`);
  }

  /**
   * Configures reactive tracking details for updates of this model.
   */
  getEntityToTracking(item: glyvio_entity.AppUser): { structureName: string; objectId: string } | undefined {
    return {
      structureName: 'AppUser',
      objectId: item.id!,
    };
  }
}

// Implement a corresponding Interceptor
export class AppUserMapPageInterceptor extends glyvio_core.SimpleMapPageInterceptor<
  AppUserMapPageState,
  glyvio_entity.AppUser
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return AppUserMapPageRoute;
  }

  getDesign(state: AppUserMapPageState, design: glyvio_core.SimpleMapPageDesign): void {
    if (design.appBarDesign) {
      design.appBarDesign.title = 'Intercepted User Map';
    }
  }

  getDesignForCell(
    state: AppUserMapPageState,
    item: glyvio_entity.AppUser,
    design: glyvio_core.SimpleMapCellDesign,
  ): void {
    design.colorTheme = 'GREEN';
  }

  populateQueryBuilder(
    state: AppUserMapPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
  ): void {
    queryBuilder.limit(100);
  }

  populateMainFilter(state: AppUserMapPageState, filter: glyvio_core.QueryBuilderFilter, text: string): void {
    // Customize or override filter behavior
  }
}
```
