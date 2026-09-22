# Simple List Page Example

This example demonstrates how to implement a custom list page using `glyvio_core.SimpleListPage` to display a list of `AppUser` entities. It showcases custom routing, state definition, querying, and UI components using the available design system.

```typescript
// Define state filters for the sidebar
export interface AppUserListFilter extends glyvio_core.SimpleListPageStateFilter {
  role?: string;
  isActive?: boolean;
}

// Define route params
export interface AppUserListRouteParams extends glyvio_core.SimpleListPageRouteParams<AppUserListFilter> {}

// Define page state
export interface AppUserListPageState
  extends glyvio_core.SimpleListPageState<AppUserListRouteParams, AppUserListFilter> {}

// Define the route
export class AppUserListPageRoute extends glyvio_core.SimpleListPageRoute<AppUserListRouteParams> {
  getRoutePath() {
    return '/app-users';
  }
  getRouteNameSpace() {
    return 'my_plugin';
  }
  getRouteNameObject() {
    return 'AppUserListPage';
  }
}

// Implement the page
export class AppUserListPage extends glyvio_core.SimpleListPage<AppUserListPageState, glyvio_entity.AppUser> {
  constructor() {
    super(AppUserListPageRoute);
  }

  getDesign(state: AppUserListPageState, design: glyvio_core.SimpleListPageDesign): void {
    design.appBarDesign!.title = 'User List';

    // Add custom filter form components to the sidebar
    design.filterSectionsDesign?.push(
      new glyvio_core.FormSectionDesign({
        childDesign: new glyvio_core.ColumnLayoutDesign({
          children: [
            new glyvio_core.StringTextfieldDesign({
              name: 'state.filtersSidebar.role',
              label: 'Role Filter',
            }),
          ],
        }),
      }),
    );
  }

  getDesignForCell(state: AppUserListPageState, item: glyvio_entity.AppUser): glyvio_core.CellDesign {
    return new glyvio_core.CellDesign({
      title: item.name ?? 'Unknown User',
      subtitle: item.email ?? 'No email',
      avatar: new glyvio_core.AvatarDesign({
        initials: item.name ? item.name.substring(0, 2).toUpperCase() : 'U',
      }),
      actionIconName: 'fa_chevronRight',
    });
  }

  populateQueryBuilder(
    state: AppUserListPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.AppUser>,
  ): void {
    // Select specific fields
    queryBuilder.addSelect('id');
    queryBuilder.addSelect('name');
    queryBuilder.addSelect('email');

    // Apply sidebar filters
    if (state.filtersSidebar?.role) {
      queryBuilder.addFilter(queryBuilder.filter().equals('role', state.filtersSidebar.role));
    }
  }

  populateMainFilter(state: AppUserListPageState, text: string): glyvio_core.QueryBuilderFilter {
    // Search both name and email for the text typed in the main search bar
    const qb = new glyvio_core.QueryBuilder<glyvio_entity.AppUser>();
    return qb.filter().or([qb.filter().like('name', `%${text}%`), qb.filter().like('email', `%${text}%`)]);
  }

  async onCellTap(state: AppUserListPageState, item: glyvio_entity.AppUser): Promise<void> {
    // Perform navigation or actions here when a cell is clicked
    // Example: await this.pushRoute(new AppUserFormRoute({ userId: item.id }));
  }

  getEntityToTracking(item: glyvio_entity.AppUser): { structureName: string; objectId: string } | undefined {
    return {
      structureName: 'AppUser',
      objectId: item.id,
    };
  }
}
```
