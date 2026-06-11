---
name: create-sidebar
description: 'Generates a standard details or configuration sidebar view, with layout structures, file drop support, dynamic uploads, event handling, and route configurations.'
---

# Agent Skill: Create Custom SimpleSidebar View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional side-drawer panel / sidebar (extending `SimpleSidebar`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_sidebar`
- **Description**: Generates a standard details or configuration sidebar view, with layout structures, file drop support, dynamic uploads, event handling, and route configurations.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Sidebar Name** (e.g., `TaskType`, `ProductDetail`): The name of the sidebar class and logical context.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/task-type-sidebar`): The URL path (must start with `/` and be a single word/slug).
4. **Layout Components**:
   - **Sections** (e.g., `GridSectionDesign`, `FormSectionDesign`): Sections structure for rendering the sidebar body.
   - **Upload Support**: Whether the sidebar should allow dragging/dropping files (e.g. `allowDropFile = true`).
5. **Route Parameters**: Parameters passed when loading the sidebar (e.g. `entityId`, `entityName`).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.SimpleSidebarDesign(...)`, NOT `import { SimpleSidebarDesign } ...`
2. **Strict Routing rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
4. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Sidebar File

Create a new file `src/views/sidebars/<sidebar_name_snake_case>_sidebar.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourSidebarRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define route params
export interface <SidebarName>SidebarRouteParams extends glyvio_core.SimpleSidebarRouteParams {
  entityId?: string;
  entityName?: string;
}

// Define page state
export interface <SidebarName>SidebarState extends glyvio_core.SimpleSidebarState<<SidebarName>SidebarRouteParams> {
  // Add state properties here
}

/**
 * Route definition for invoking the <SidebarName> Sidebar.
 */
export class <SidebarName>SidebarRoute extends glyvio_core.SimpleSidebarRoute<<SidebarName>SidebarRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/task-type-sidebar'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<SidebarName>Sidebar';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<sidebarNameSnakeCase>_sidebar;
  }
}

/**
 * Custom Sidebar drawer view.
 */
export class <SidebarName>Sidebar extends glyvio_core.SimpleSidebar<<SidebarName>SidebarState> {
  constructor() {
    super(<SidebarName>SidebarRoute);
  }

  async initState(state: <SidebarName>SidebarState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<SidebarName><SnakeCase>_SIDEBAR';
    await this.loadUserConfig(state);
  }

  async refreshState(state: <SidebarName>SidebarState): Promise<void> {
    // Fetch details or attachments here
  }

  /**
   * Configures design details like titles, action buttons, drop zones, and sections.
   */
  getDesign(state: <SidebarName>SidebarState, design: glyvio_core.SimpleSidebarDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      title: '<SidebarName> Details',
      buttons: [
        new glyvio_core.ActionButtonDesign({
          type: 'SECONDARY',
          iconName: 'sax_linear_add',
          key: 'add.button',
          action: new glyvio_core.Action({
            key: 'addNewItem',
          }),
        }),
      ],
    });

    // Enable dragging and dropping files onto the sidebar drawer
    design.allowDropFile = true;

    design.sectionsDesign = [
      // e.g. GridSectionDesign, FormSectionDesign, ListSectionDesign
    ];
  }

  /**
   * Callback fired when files are dropped or uploaded via the sidebar drawer.
   */
  async onFileUploaded(state: <SidebarName>SidebarState, attachment: glyvio_entity.Attachment, extras?: unknown): Promise<void> {
    // 💡 Example: Save attachment entity linkage
    // await attachmentService.saveAttachment(attachment, [
    //   { entityId: state.routeParams.entityId!, entityName: state.routeParams.entityName! }
    // ]);
    // this.callRefreshState();
  }

  /**
   * Processes custom click events and user interactions.
   */
  async events(state: <SidebarName>SidebarState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'addNewItem') {
      // Handle addition logic
      return 'STATE_UPDATE';
    }
    return undefined;
  }
}

/**
 * Custom Interceptor class for SimpleSidebar.
 */
export abstract class <SidebarName>SidebarInterceptor extends glyvio_core.SimpleSidebarInterceptor<<SidebarName>SidebarState> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <SidebarName>SidebarRoute;
  }
}
```
