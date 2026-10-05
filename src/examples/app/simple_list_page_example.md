# Simple List Page Example

A list page (`glyvio_core.SimpleListPage`) of `AppUser` records with search, a filter sidebar, saved
filters, report button, live refresh and cell tap. Generated from the `create-list-page` skill and
compiled against `@types/glyvio_core.d.ts`; register the route and the menu as the skill describes
(`routerService.loadRoutes` + `menuRegistryService.addGroup`, and `export *` of this file).

Key points:

- The route implements `getRoutePermission()` and the page implements `events()` (both abstract).
- Queries use the real `QueryBuilder` API (`setFromEntity`, `addOrderByEntity`, `addFilterOperator`,
  `QueryBuilderFilter` / `QueryBuilderFilterILike`). There is no `addSelect`, `filter()`, `.equals()`
  or `.like()`.
- `getEntityToTracking` returns `objectId: item.id!` (entity ids are `string | undefined` in the types).

```typescript
// Define state filters for the sidebar
export interface AppUserListFilter extends glyvio_core.SimpleListPageStateFilter {
  // Add sidebar filters here (e.g., status?: string;)
  name?: string;
  email?: boolean;
}

// Define route params
export interface AppUserListRouteParams extends glyvio_core.SimpleListPageRouteParams<AppUserListFilter> {}

// Define page state
export interface AppUserListPageState
  extends glyvio_core.SimpleListPageState<AppUserListRouteParams, AppUserListFilter> {}

/**
 * Route definition for the AppUser List Page.
 */
export class AppUserListPageRoute extends glyvio_core.SimpleListPageRoute<AppUserListRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return undefined; // a glyvio_permissions.* declared in manifest.json, or undefined
  }

  getRoutePath() {
    return '/app-users'; // e.g., '/products'
  }

  getRouteNameSpace() {
    return 'my_plugin';
  }

  getRouteNameObject() {
    return 'AppUserListPage';
  }
}

/**
 * Custom List Page component for displaying AppUser entities.
 */
export class AppUserListPage extends glyvio_core.SimpleListPage<AppUserListPageState, glyvio_entity.AppUser> {
  constructor() {
    super(AppUserListPageRoute);
    this.extensionsManager.registerReport(this);
  }

  async events(_state: AppUserListPageState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined; // handle your own action keys here
  }

  async initState(state: AppUserListPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = 'APP_USER_LIST_PAGE';
    await this.loadUserConfig(state);
  }

  /**
   * Configures the title and sidebar filter UI elements.
   */
  getDesign(state: AppUserListPageState, design: glyvio_core.SimpleListPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.title = 'AppUser List';
    appBar.putButtonOn(this.extensionsManager.report!.getButton());

    // Build sidebar filter components
    design.filterSectionsDesign?.push(
      new glyvio_core.FormSectionDesign({
        childDesign: new glyvio_core.FormLayoutDesign({
          columnSize: 280,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: 'name.formField',
              child: new glyvio_core.StringTextfieldDesign({
                name: 'state.filtersSidebar.name',
                label: 'Filter Label 1',
              }),
            }),
          ],
        }),
      }),
    );
  }

  /**
   * Formats how each entity card is displayed in the list view.
   */
  getDesignForCell(state: AppUserListPageState, item: glyvio_entity.AppUser): glyvio_core.LineCellDesign {
     return new glyvio_core.LineCellDesign({
      colorTheme: item.deleted ? 'RED' : undefined,
      padding: '16',
      child: new glyvio_core.RowLayoutDesign({
        crossAlignment: 'CENTER',
        children: [
          new glyvio_core.RowLayoutFieldDesign({
            isExpanded: true,
            child: new glyvio_core.ColumnLayoutDesign({
              key: 'nameField',
              children: [
                new glyvio_core.StringTextDesign({
                  value: item.name ?? 'Unnamed Item',
                  padding: '0 4',
                }),
                new glyvio_core.StringTextDesign({
                  value: item.email ?? '',
                  style: 'BODY_SMALL',
                }),
              ],
            }),
          }),
          new glyvio_core.ChipDesign({
            key: 'statusField',
            label: item.email ?? '',
            colorTheme: `GREEN`,
          }),
        ],
      }),
    });
  }

  /**
   * Builds the database select query and applies sidebar filters.
   */
  populateQueryBuilder(
    state: AppUserListPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
  ): void {
    queryBuilder.setFromEntity(glyvio_structure.AllEntities.appUser);
    queryBuilder.addOrderByEntity(glyvio_structure.AllEntities.appUser.name, 'ASC');

    // Apply active sidebar filters to query
    // e.g.: if (state.filtersSidebar?.name) {
    //   queryBuilder.addFilterOperator(glyvio_structure.AllEntities.appUser.name, state.filtersSidebar.name);
    // }
  }

  /**
   * Formats query filter matching the main top search bar input.
   */
  populateMainFilter(_state: AppUserListPageState, text?: string): glyvio_core.QueryBuilderFilter {
     return new glyvio_core.QueryBuilderFilter({
      ors: [
        new glyvio_core.QueryBuilderFilterILike({
          field: glyvio_structure.AllEntities.appUser.name,
          value: text,
        }),
      ],
    });
  }

  /**
   * Defines navigation action when a cell is clicked/tapped.
   */
  async onCellTap(state: AppUserListPageState, item: glyvio_entity.AppUser): Promise<void> {
    // Implement navigation or callback here
    // e.g., await this.pushRoute(new AppUserEditPageRoute({ id: item.id }));
  }

  /**
   * Hooks into activity/telemetry tracking.
   * structureName must be glyvio_structure.AllEntities.appUser.getStructureName()
   * ex: glyvio_structure.AllEntities.appUser.getStructureName()
   */
  getEntitiesListenning(_state: AppUserListPageState): glyvio_core.EntityListenning[] {
    return [
      new glyvio_core.EntityListenning({
        objectId: '*',
        structureName: glyvio_structure.AllEntities.appUser.getStructureName(),
      }),
    ];
  }

  /**
   * Hooks into activity/telemetry tracking.
   */
  getEntityToTracking(item: glyvio_entity.AppUser): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.appUser.getStructureName(),
      objectId: item.id!,
    };
  }
}
```
