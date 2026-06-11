# Example: Defining Custom Pages, Routes, and Menu Items

This example demonstrates how to create a custom page, declare a route for it, register the route in the app routing system, and add it to the application's navigation menu.

## Scenario

We want to add a custom Admin Statistics page. We will build the page route class, register it using `routerService`, and place a link to it under the "Admin" menu group.

---

## 🛠️ Complete Implementation

Create a new file (e.g., `src/views/admin_stats_page.ts`) in your plugin workspace and paste the following content:

```typescript
/**
 * Custom Route definition for the Admin Statistics page.
 *
 * Routes in the app layer extend `glyvio_core.CorePageRoute` or `glyvio_core.Route`.
 * All references are imported from the globally injected namespaces.
 */
export class AdminStatsPageRoute extends glyvio_core.CorePageRoute<glyvio_core.CorePageRouteParams> {
  /**
   * Defines the subtype of the route (e.g., NATIVE, LIST, EDIT, etc.).
   */
  getRouteSubtype(): string {
    return 'NATIVE';
  }

  /**
   * Defines the route path path.
   * The route must have only 1 word
   */
  getRoutePath(): string {
    return '/admin_statistics';
  }

  /**
   * The namespace for resolving this route's components.
   */
  getRouteNameSpace(): string {
    return 'my_plugin_namespace';
  }

  /**
   * The specific view/object name resolved in the namespace.
   */
  getRouteNameObject(): string {
    return 'AdminStatsPage';
  }

  /**
   * Permissions required to view this route.
   */
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    // Use permissions generated from the manifest file
    return glyvio_permissions.Permission.admin_view;
  }
}

// -------------------------------------------------------------
// Registration & Menu Integration
// -------------------------------------------------------------

// 1. Register the route with the app routing service so the system knows how to navigate to it
glyvio_core.routerService.loadRoutes([AdminStatsPageRoute]);

// 2. Add a navigation link to this page in the main sidebar under the "Admin" section
glyvio_core.FullMenuPage.fullMenuGroupAdd({
  key: 'main-admin-group', // Key of the menu group to append to or create
  name: 'Administration',
  position: 10, // Order of the menu group
  items: [
    {
      key: 'menu-item-admin-stats',
      title: 'System Stats',
      iconName: 'fa_chart_line', // FontAwesome icon identifier
      colorTheme: 'BLUE', // Primary highlight color
      route: new AdminStatsPageRoute(), // The route instance created above
    },
  ],
});
```

---

## 🔍 Key Architectural Points

1. **`CorePageRoute<T>`**:
   - The base class for defining navigateable endpoints in Glyvio.
   - `getRoutePath()` returns the URL segment.
   - `getRouteSubtype()` returns UI presentation modes (e.g., `'NATIVE'`).
2. **`glyvio_core.routerService.loadRoutes`**:
   - Informs Glyvio's internal router about the route definition so that it compiles and links navigation actions.
3. **`glyvio_core.FullMenuPage.fullMenuGroupAdd`**:
   - Dynamically registers menu sections or individual buttons/items.
   - Groups are created if they do not exist; otherwise, items are appended.
   - Uses standard properties like `iconName`, `title`, and binds them directly to a `route` object.
