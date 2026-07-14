---
name: create-tab-sidebar
description: 'Generates a standard tabbed details sidebar panel container, managing tab selections, embedding sub-routes (such as attachment list panels or history timeline views), and configuring headers/app bars.'
---

# Agent Skill: Create Custom TabSidebar View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional tabbed sidebar panel drawer (extending `TabSidebar`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_tab_sidebar`
- **Description**: Generates a standard tabbed details sidebar panel container, managing tab selections, embedding sub-routes (such as attachment list panels or history timeline views), and configuring headers/app bars.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Sidebar Name** (e.g., `Task`, `Invoice`): The name of the sidebar class and logical context.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/task-view`): The URL path (must start with `/` and be a single word/slug).
4. **Main Tab Section Designs**: Form or list sections displayed in the primary/default tab view.
5. **Sub-Tab Navigation Options**: Additional sidebar routes linked as tabs (e.g. `AttachmentSidebarRoute`).
6. **Route Parameters**: Parameters passed when loading the sidebar container (e.g. `id`).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.TabSidebarDesign(...)`, NOT `import { TabSidebarDesign } ...`
2. **Strict Routing rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
4. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the TabSidebar File

Create a new file `src/views/sidebars/<sidebar_name_snake_case>_sidebar.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourTabSidebarRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define route params
export interface <SidebarName>SidebarRouteParams extends glyvio_core.TabSidebarRouteParams {
  id?: string;
}

// Define page state
export interface <SidebarName>SidebarState extends glyvio_core.TabSidebarState<<SidebarName>SidebarRouteParams> {
  <sidebarNameCamelCase>?: glyvio_entity.<SidebarName> | null;
}

/**
 * Route definition for invoking the <SidebarName> Tabbed Sidebar.
 */
export class <SidebarName>SidebarRoute extends glyvio_core.TabSidebarRoute<<SidebarName>SidebarRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/task-view'
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
 * Custom Tabbed Sidebar container view.
 */
export class <SidebarName>Sidebar extends glyvio_core.TabSidebar<<SidebarName>SidebarState> {
  constructor() {
    super(<SidebarName>SidebarRoute);
  }

  async initState(state: <SidebarName>SidebarState): Promise<void> {
    await super.initState(state);
  }

  async refreshState(state: <SidebarName>SidebarState): Promise<void> {
    await super.refreshState(state);
    if (state.routeParams.id) {
      state.<sidebarNameCamelCase> = await glyvio_entity.<SidebarName>.findById(state.routeParams.id);
    }
  }

  /**
   * Configures design details like titles, action buttons, and sections of the main/active tab.
   */
  getDesign(state: <SidebarName>SidebarState, design: glyvio_core.TabSidebarDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      title: '<SidebarName> Info',
      buttons: [
        new glyvio_core.ActionButtonDesign({
          type: 'SECONDARY',
          iconName: 'sax_linear_edit',
          key: 'edit.button',
          action: new glyvio_core.Action({
            key: 'edit',
          }),
        }),
      ],
    });

    design.sectionsContentDesign = [
      // Sections representing main tab details:
      // new glyvio_core.FormSectionDesign({ ... })
    ];
  }

  /**
   * Defines navigation routing targets for tab selections.
   */
  getContentsRoutes(state: <SidebarName>SidebarState): glyvio_core.TabPreviewContentResponse {
    return {
      main: {
        iconName: 'fa_infoCircle',
        title: 'Details',
      },
      others: [
        // 💡 Example: Link additional sub-tab routes
        // {
        //   iconName: 'fa_folderOpen',
        //   title: 'Attachments',
        //   route: new AttachmentSidebarRoute({
        //     entityId: state.routeParams.id,
        //     entityName: glyvio_structure.AllEntities.<sidebarNameCamelCase>.getStructureName(),
        //   }),
        // }
      ],
    };
  }

  /**
   * Processes custom click events and user interactions.
   */
  async events(state: <SidebarName>SidebarState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key === 'edit') {
      // Navigation action → STATE_FREEZED
      return 'STATE_FREEZED';
    }

    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }

    return undefined;
  }
}

/**
 * Custom Interceptor class for TabSidebar.
 */
export abstract class <SidebarName>SidebarInterceptor extends glyvio_core.TabSidebarInterceptor<<SidebarName>SidebarState> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <SidebarName>SidebarRoute;
  }
}
```
