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
5. **Attachments section — all 4 pieces are required together, never just some (NON-NEGOTIABLE)**: If the cart embeds an `AttachmentsEditSectionRoute` (via `glyvio_core.RuleSectionDesign.fromRoute(...)`) in deferred mode (`saveOnlyOnAction: true`), the host cart itself — not just the section — must ALSO wire the file-picker callback and the save-time flush. Forgetting any one of these four leaves uploads silently broken or never persisted:
   1. `implements glyvio_core.AttachmentExtensionDelegate<<CartName>CartState>` on the class declaration.
   2. `this.extensionsManager.registerAttachment(this);` in the constructor.
   3. `async attachmentOnFilesUploaded(state, files, extras) { await glyvio_core.AttachmentsEditSection.setTempAttachments(this, '<sectionIdentifier>', state, files); }` — forwards uploads picked via the section's own "+" button into its temp state. The `'<sectionIdentifier>'` string must match the `sectionIdentifier` used when embedding the section in `getDesign`.
   4. In **every** save handler that persists the host entity (a cart may have more than one, e.g. `onSave` that stays open vs `onSaveAndLeave` that closes) — after `entityService.saveList(...)`, flush the section's pending changes:
      ```typescript
      const changes = await glyvio_core.AttachmentsEditSection.getChanges(this, '<sectionIdentifier>', state);
      if (changes) {
        changes.entityId = state.<entityNameCamelCase>!.id;
        await glyvio_core.AttachmentsEditSection.saveEntities(changes);
      }
      ```
      This must run in **every** code path that calls `entityService.saveList`/`saveEntity` for the host entity — not just one of several save actions.
   - See the full "Attachments Section (optional)" recipe below for the matching `initState` seed and `getDesign` embedding — all four pieces plus the seed/embed must be present together for attachments to work end-to-end.

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

### Step 3: (Optional) Attachments Section

Only when the user asks for file/attachment support on the cart's host entity. Deferred mode (`saveOnlyOnAction: true`) is required whenever the entity may not exist yet when the cart opens (new record — client-generated id, not yet persisted) — which is the common case for a create/edit cart. All five pieces below are required together; do not stop after adding the section to `getDesign` — the upload callback and save-time flush are just as essential and easy to forget:

1. **State**: add `attachmentsTemp?: glyvio_core.AttachmentsEditSectionGetChanges;` to `<CartName>CartState`.
2. **`initState`**: seed the pending-changes bucket, right after `await super.initState(state);`:
   ```typescript
   state.attachmentsTemp = { attachmentsTemp: [], attachmentsChanged: [] };
   ```
3. **Class declaration + constructor**: implement the delegate and register the extension:
   ```typescript
   export class <CartName>Cart
     extends glyvio_core.SimpleCart<<CartName>CartState>
     implements glyvio_core.AttachmentExtensionDelegate<<CartName>CartState>
   {
     constructor() {
       super(<CartName>CartRoute);
       this.extensionsManager.registerAttachment(this);
     }
   ```
4. **Upload callback** (a method on the cart, not just inside the section):
   ```typescript
   async attachmentOnFilesUploaded(
     state: <CartName>CartState,
     files: glyvio_entity.Attachment[],
     extras?: unknown,
   ): Promise<void> {
     await glyvio_core.AttachmentsEditSection.setTempAttachments(this, 'ATTACHMENT', state, files);
   }
   ```
5. **`getDesign`**: embed the section as the last entry in `design.sectionsDesign`:
   ```typescript
   glyvio_core.RuleSectionDesign.fromRoute(
     new glyvio_core.AttachmentsEditSectionRoute({
       entityName: glyvio_structure.AllEntities.<entityNameCamelCase>.getStructureName(),
       entityId: state.<entityNameCamelCase>?.id,
       saveOnlyOnAction: true,
       sectionIdentifier: 'ATTACHMENT',
       tempChanges: state.attachmentsTemp,
       // trackFieldOnEntity: glyvio_structure.AllEntities.<entityNameCamelCase>.mainAttachment.structureName, // only if the entity has a `mainAttachment` field
     }),
   ),
   ```
6. **Save control** (rule #5 above): in **every** save handler, after `entityService.saveList(...)`:
   ```typescript
   const changes = await glyvio_core.AttachmentsEditSection.getChanges(this, 'ATTACHMENT', state);
   if (changes) {
     changes.entityId = state.<entityNameCamelCase>!.id;
     await glyvio_core.AttachmentsEditSection.saveEntities(changes);
   }
   ```

**Final check before considering the attachments section done**: re-read the cart file and confirm all of — state field, `initState` seed, `implements AttachmentExtensionDelegate`, `registerAttachment` in constructor, `attachmentOnFilesUploaded` method, section embed in `getDesign`, and `getChanges`/`saveEntities` in **every** save path — are present. Missing any one is a silent bug (uploads don't attach, or attach but never persist), not a build error — `tsc`/`eslint`/`webpack build` all stay clean either way.

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
