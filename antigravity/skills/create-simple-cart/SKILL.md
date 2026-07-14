---
name: create-simple-cart
description: 'Generates a standard cart drawer view for managing temporary item selections (such as shopping carts, booking lists, or item checkout bins), configuring item statuses, handles file attachments, and handles adding/removing actions.'
---

# Agent Skill: Create Custom SimpleCart View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional cart drawer panel (extending `SimpleCart`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_simple_cart`
- **Description**: Generates a standard cart drawer view for managing temporary item selections (such as shopping carts, booking lists, or item checkout bins), configuring item statuses, handles file attachments, and handles adding/removing actions.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Cart Name** (e.g., `Shopping`, `ResourceSelection`): The name of the cart class and logical context.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/shopping-cart`): The URL path (must start with `/` and be a single word/slug).
4. **Target Entity Names**: The model entity names (under `glyvio_entity.*`) whose items can be added/removed.
5. **Add/Remove Logic**: Database modifications or state updates executed when adding or removing item entries.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.SimpleCartDesign(...)`, NOT `import { SimpleCartDesign } ...`
2. **Strict Routing rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
4. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the SimpleCart File

Create a new file `src/views/carts/<cart_name_snake_case>_cart.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourCartRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define route params
export interface <CartName>CartRouteParams extends glyvio_core.SimpleCartRouteParams {}

// Define page state
export interface <CartName>CartState extends glyvio_core.SimpleCartState<<CartName>CartRouteParams> {
  // Add state properties here
}

/**
 * Route definition for invoking the <CartName> Cart.
 */
export class <CartName>CartRoute extends glyvio_core.SimpleCartRoute<<CartName>CartRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/shopping-cart'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<CartName>Cart';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<cartNameSnakeCase>_cart;
  }
}

/**
 * Custom Cart view class.
 */
export class <CartName>Cart extends glyvio_core.SimpleCart<<CartName>CartState> {
  constructor() {
    super(<CartName>CartRoute);
  }

  async initState(state: <CartName>CartState): Promise<void> {
    await super.initState(state);
  }

  /**
   * Configures design details like titles, icons, and action buttons.
   */
  getDesign(state: <CartName>CartState, design: glyvio_core.SimpleCartDesign): void {
    design.titleOpened = '<CartName> Cart';
    design.icon = 'fa_shoppingCart';
    design.sectionsDesign = [
      // Sections for rendering cart items
    ];
  }

  /**
   * Resolves the current status of an item relative to the cart.
   * Return 'ADDED', 'ALLOW_ADD', 'NOT_ALLOWED', or 'PROCESSING'.
   */
  getStatusItemOfCart(state: <CartName>CartState, entityName: string, entityId: string, data: unknown): glyvio_core.CartItemStatus {
    // 💡 Example: Determine if item is already inside state selection list
    return 'ALLOW_ADD';
  }

  /**
   * Processes adding an item into the cart.
   */
  async addItemToCart(state: <CartName>CartState, entityName: string, entityId: string, data: unknown): Promise<unknown | undefined> {
    // 💡 Example: Append item to database or cart state
    return data;
  }

  /**
   * Processes removing an item from the cart.
   */
  async removeItemFromCart(state: <CartName>CartState, entityName: string, entityId: string, data: unknown): Promise<unknown | undefined> {
    // 💡 Example: Remove item from database or cart state
    return data;
  }

  /**
   * Event handlers for custom interactions.
   */
  async events(state: <CartName>CartState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }
    return undefined;
  }
}

/**
 * Custom Interceptor class for SimpleCart.
 */
export abstract class <CartName>CartListener extends glyvio_core.SimpleCartListener<<CartName>CartState> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <CartName>CartRoute;
  }
}
```
