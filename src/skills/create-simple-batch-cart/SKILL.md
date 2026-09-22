---
name: create-simple-batch-cart
description: "Generates a spreadsheet-style batch/bulk-editing cart drawer (extending SimpleBatchCart) for editing many entity items at once inside a single table — with spreadsheet import/export, inline column editing, \"change all\" bulk edits, and a single-transaction batch save."
---
# Agent Skill: Create Custom SimpleBatchCart View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional batch (bulk-editing) cart drawer panel — extending `SimpleBatchCart` — within a Glyvio plugin project.

`SimpleBatchCart` is the **table/spreadsheet** sibling of `SimpleCart`: instead of a single item edited through form sections, it renders a spreadsheet-like table where many DTO rows are added (individually via a cart button, in bulk via a filter selection, or imported from a spreadsheet file), edited inline column-by-column, and persisted together in one batch save.

---

## 🎯 Skill Metadata

- **Name**: `create_simple_batch_cart`
- **Description**: Generates a spreadsheet-style batch-editing cart drawer for managing and persisting many entity items at once, with spreadsheet import/export, inline column editing, and unified batch saving.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Cart Name** (e.g., `BatchStockEdit`, `BatchClientEdit`): The name of the batch cart class and logical context.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/batch-stock-edit`): The URL path (must start with `/` and be a single word/slug).
4. **Target Entity Name** (under `glyvio_entity.*`): The model entity whose rows are edited/created in bulk. Unlike `SimpleCart`, a batch cart normally handles a **single** entity type per cart (`getStatusItemOfCart` still receives an `entityName`, but the DTO/columns/spreadsheet mapping are built around one target entity).
5. **Editable Columns**: Which DTO fields should be inline-editable, and their type (string, integer, decimal, boolean, date, dateTime, tags, observers, userGroup, entity lookup).
6. **Spreadsheet Mapping** (optional, only if import/export is needed): Which spreadsheet header names map to which DTO fields.
7. **Persistence Logic**: How a DTO row maps into one or more database entities on save.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.SimpleBatchCartDesign(...)`, NOT `import { SimpleBatchCartDesign } ...`
2. **Strict Routing rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
4. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.
5. **Interceptor base class — use `SimpleBatchCartInterceptor`, never `SimpleCartListener` (NON-NEGOTIABLE)**: `SimpleCartListener<S>` targets `SimpleCart`/`SimpleCartDesign` only — it has no `getDtoLayout`, `getEntitiesFromDto`, `getDtoSpreadsheetFromLine`, `getSpreadsheetLayout`, or `onUpdateItem` hooks. It compiles fine against a batch cart's state type (both extend `CoreCartState`), which is exactly what makes this mistake easy to miss — the resulting class silently has **no way** to intercept any batch-specific behavior. Always extend `glyvio_core.SimpleBatchCartInterceptor<S, I>` for a batch cart's interceptor, and pass **both** type parameters (state **and** DTO item).
6. **`allowUpload`/`allowDownload` live on `state`, not on `design` (NON-NEGOTIABLE)**: Spreadsheet import/export visibility is controlled by `state.allowUpload` / `state.allowDownload` (declared on `SimpleBatchCartState`), set inside `initState` — **not** properties of `SimpleBatchCartDesign`, which has no such fields. Setting them on `design` is a silent no-op (no compile error the way `any`-casts would produce one — the fields simply don't exist there, so TypeScript itself will already reject `design.allowUpload`).
   ```typescript
   async initState(state: <CartName>BatchCartState): Promise<void> {
     await super.initState(state);
     state.allowUpload = true; // shows the "import spreadsheet" button
     state.allowDownload = true; // shows the "export/download" button
   }
   ```
7. **Header title — use `titleOpened`/`subtitleOpened`; treat `appBarDesign` as buttons-only (NON-NEGOTIABLE)**: `design.titleOpened` (plus the optional `design.subtitleOpened`) is the header shown for **every** cart type and is always present on `SimpleBatchCartDesign`. `design.appBarDesign` is `AppBarDesign | undefined` — it may be absent, and real plugins in this codebase are inconsistent about whether they also set `appBarDesign.title`/`.subtitle` on it. To keep new carts consistent:
   - **Always** set `design.titleOpened` (and `design.subtitleOpened` when a secondary line is useful) — never rely on `appBarDesign.title` as the only place the title is set.
   - Only touch `design.appBarDesign` when you need to add **toolbar action buttons** (e.g. "add from filter", "add new row") — guard it for `undefined`, and cast to `glyvio_core.SimpleAppBarDesign` only if you need `.subtitle` or `.putButtonOn(...)` (the base `AppBarDesign` type only exposes `.title`/`.buttons`):
     ```typescript
     const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign | undefined;
     appBar?.putButtonOn(
       new glyvio_core.ActionButtonDesign({
         key: 'addFromFilter.button',
         type: 'SECONDARY',
         iconName: 'sax_linear_filter_search',
         tooltip: '$T{<pluginNamespace>_<cartNameSnakeCase>_addFromFilterTooltip}',
         keyLoadingListener: this.callBackId,
         action: new glyvio_core.Action({ key: 'addFromFilter', data: {} }),
       }),
       0,
     );
     ```
8. **All 8 abstract methods are required**: `SimpleBatchCart<S, I>` has no default row/column/persistence behavior — `getDesign`, `getStatusItemOfCart`, `populateDtoFromCartButton`, `getDtoLayout`, `getSpreadsheetLayout`, `getDtoSpreadsheetFromLine`, `getEntitiesFromDto`, and `onUpdateItem` must **all** be implemented, even if a given cart never uses spreadsheet import (in that case still return `[]` from `getSpreadsheetLayout` and leave `getDtoSpreadsheetFromLine` as an empty/defensive stub — omitting them is a compile error, not a runtime one, so this is rarely forgotten, but the two are easy to leave as dead stubs when only `populateDtoFromCartButton` is actually used).
9. **Prefer `generateSimple*DtoLayout` helpers over hand-built columns**: `SimpleBatchCart` ships helpers (`generateSimpleStringDtoLayout`, `generateSimpleIntegerDtoLayout`, `generateSimpleDecimalDtoLayout`, `generateSimpleBooleanDtoLayout`, `generateSimpleDateDtoLayout`, `generateSimpleDateTimeDtoLayout`, `generateSimpleUserGroupDtoLayout`, `generateSimpleTagsDtoLayout`, `generateSimpleObserversDtoLayout`, `generateSimpleEntityDtoLayout`) that build a correctly-typed `SimpleBatchCartDtoLayoutItem` — including the "change all" header option — from just a column name/label/field path. Only hand-build a `SimpleBatchCartDtoLayoutItem` when none of these fit (e.g. a fully custom cell widget).
10. **Attachments/spreadsheet plumbing is already built-in — do not re-wire it manually**: unlike `SimpleCart` (where the attachments section requires manually implementing `AttachmentExtensionDelegate` + registering the extension + flushing changes on save, see the `create-simple-cart` skill), `SimpleBatchCart` already `implements SpreadsheetExtensionDelegate<S>, AttachmentExtensionDelegate<S>` and ships concrete `import`, `spreadsheetOnFileContentLoaded`, `attachmentOnFilesUploaded`, and `onFileUploaded` methods. Only override these if you need to change the default behavior — do not copy the `SimpleCart` attachments recipe onto a batch cart.
11. **"Add from filter" — chunk the returned ids into the query, never one unbounded `IN` clause (NON-NEGOTIABLE when wiring a `create-batch-filter-modal` as a bulk-add source)**: a filter modal's `popActionKey` can return hundreds/thousands of ids (see `create-batch-filter-modal`'s Usage Notes — the "Select" action is unlimited, unlike the 20-row preview). Re-querying all of them in one `addFilterOperator(entity.id, ids)` risks an oversized SQL `IN` clause. The reference implementation (`glyvio-plugin-core`'s `TaskBatchCart`) uses a chunk-size constant and loops:
    ```typescript
    private static readonly QUERY_CHUNK_SIZE = 100;

    async addFromFilter(state: <CartName>BatchCartState, ids: string[]): Promise<void> {
      for (let i = 0; i < ids.length; i += <CartName>BatchCart.QUERY_CHUNK_SIZE) {
        const chunk = ids.slice(i, i + <CartName>BatchCart.QUERY_CHUNK_SIZE);
        const records = await glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(
          glyvio_structure.AllEntities.<entityNameCamelCase>,
        )
          .addFilterOperator(glyvio_structure.AllEntities.<entityNameCamelCase>.id, chunk)
          .findAll();
        for (const record of records) {
          await this.addItemToCart(state, '<EntityName>', record.id!, record);
        }
      }
    }
    ```
    A sequential per-id loop (one query per id) also avoids the oversized-`IN` risk but is far slower for large selections — prefer the chunked-`IN` shape above unless the entity's `getStatusItemOfCart`/`populateDtoFromCartButton` genuinely need one full record fetch per id anyway.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the SimpleBatchCart File

Create a new file `src/views/carts/<cart_name_snake_case>_batch_cart.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourBatchCartRoute,
]);
```

### Step 3: (Optional) Enable Spreadsheet Import/Export

Only when the user asks for bulk spreadsheet import or export/download of the cart's current rows:

1. In `initState`, set `state.allowUpload = true;` and/or `state.allowDownload = true;` (see rule #6 above — these are state fields, not design fields).
2. Implement `getSpreadsheetLayout` mapping every importable spreadsheet header to its DTO field path.
3. Implement `getDtoSpreadsheetFromLine` to translate one parsed spreadsheet row (`line`) into a populated DTO item — this is where a new/temporary `id` is normally generated for rows with no existing entity id yet.
4. Export uses the cart's own `generateFile(state, 'csv' | 'xls')` — no extra wiring needed once `allowDownload` is `true`.

### Step 4: (Optional) Interceptor

Only when the user needs to customize an existing batch cart from elsewhere (a different plugin/module) rather than the cart's own file — define and register a class extending `glyvio_core.SimpleBatchCartInterceptor<S, I>` (see rule #5 — never `SimpleCartListener`) pointed at the batch cart's route via `getListenerRoute()`, then register it:

```typescript
glyvio_core.appInterceptorService.registerInterceptors([
  {
    interceptor: YourBatchCartInterceptor,
    order: 10,
  },
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define route params
export interface <CartName>BatchCartRouteParams extends glyvio_core.SimpleBatchCartRouteParams {
  // Add optional filter/context params here, e.g.:
  // stockTypeId?: string;
}

// Define page state
export interface <CartName>BatchCartState extends glyvio_core.SimpleBatchCartState<<CartName>BatchCartRouteParams> {
  // Add state properties here
}

/**
 * Item DTO representing one editable row inside the batch cart table.
 */
export interface <CartName>BatchCartDto extends glyvio_core.SimpleBatchCartDto {
  // Add DTO fields rendered/edited as columns here, e.g.:
  // name?: string;
  // quantity?: glyvio_core.Decimal;
}

/**
 * Route definition for invoking the <CartName> Batch Cart.
 */
export class <CartName>BatchCartRoute extends glyvio_core.SimpleBatchCartRoute<<CartName>BatchCartRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/batch-stock-edit'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<CartName>BatchCart';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<cartNameSnakeCase>_batch_cart;
  }
}

/**
 * Custom Batch Cart view class — a spreadsheet-like table for bulk editing.
 */
export class <CartName>BatchCart extends glyvio_core.SimpleBatchCart<<CartName>BatchCartState, <CartName>BatchCartDto> {
  constructor() {
    super(<CartName>BatchCartRoute);
  }

  async initState(state: <CartName>BatchCartState): Promise<void> {
    await super.initState(state);
    // 💡 Only if spreadsheet import/export is required (rule #6 — these are STATE fields):
    // state.allowUpload = true;
    // state.allowDownload = true;
  }

  /**
   * Configures the layout and general parameters of the batch cart design.
   */
  getDesign(state: <CartName>BatchCartState, design: glyvio_core.SimpleBatchCartDesign): void {
    design.titleOpened = '<CartName> Batch Cart';
    // 💡 Optional: discreet line rendered below titleOpened in the cart's fixed top header.
    // design.subtitleOpened = 'Bulk edit and import <EntityName> records';
    design.icon = 'fa_table';
    design.line1Closed = '<CartName> Batch Cart';

    // 💡 appBarDesign is for TOOLBAR BUTTONS only (rule #7) — guard for undefined, cast only if
    // you also need `.subtitle` or `.putButtonOn(...)` from SimpleAppBarDesign:
    // const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign | undefined;
    // appBar?.putButtonOn(
    //   new glyvio_core.ActionButtonDesign({
    //     key: 'addFromFilter.button',
    //     type: 'SECONDARY',
    //     iconName: 'sax_linear_filter_search',
    //     tooltip: '$T{<pluginNamespace>_<cartNameSnakeCase>_addFromFilterTooltip}',
    //     keyLoadingListener: this.callBackId,
    //     action: new glyvio_core.Action({ key: 'addFromFilter', data: {} }),
    //   }),
    //   0,
    // );
  }

  /**
   * Defines whether an entity type can be added or updated in the context of this cart.
   * Return 'ADDED', 'ALLOW_ADD', 'NOT_ALLOWED', or 'PROCESSING'.
   */
  getStatusItemOfCart(
    state: <CartName>BatchCartState,
    entityName: string,
    entityId: string,
    data: any,
  ): glyvio_core.CartItemStatus {
    if (entityName !== '<EntityName>') {
      return 'NOT_ALLOWED';
    }
    return 'ALLOW_ADD';
  }

  /**
   * Populates a DTO item from a cart button action payload (item pushed in via a
   * `glyvio_core.CartButtonDesign` bound to the target entity/structure elsewhere in the UI).
   */
  async populateDtoFromCartButton(
    state: <CartName>BatchCartState,
    item: <CartName>BatchCartDto,
    entityName: string,
    entityId: string,
    data: any,
  ): Promise<void> {
    item.id = entityId;
    item.entityName = entityName;
    // 💡 Example: item.name = data?.name ?? '';
  }

  /**
   * Defines columns and inline layout editing configurations. Prefer the `generateSimple*DtoLayout`
   * helpers (rule #9) — they wire up "change all" automatically.
   */
  getDtoLayout(state: <CartName>BatchCartState): glyvio_core.SimpleBatchCartDtoLayoutItem[] {
    return [
      this.generateSimpleStringDtoLayout('name', 'Name', 'item.name'),
      // this.generateSimpleDecimalDtoLayout('quantity', 'Quantity', 'item.quantity'),
      // this.generateSimpleUserGroupDtoLayout('userGroup', 'User Group', 'item.userGroupId'),
      // this.generateSimpleTagsDtoLayout('tags', 'Tags', 'item.tags', '<EntityName>'),
      // this.generateSimpleObserversDtoLayout('observers', 'Observers', 'item.observers'),
    ];
  }

  /**
   * Maps spreadsheet headers to the corresponding DTO properties.
   * Return `[]` when spreadsheet import is not used for this cart (rule #8).
   */
  getSpreadsheetLayout(state: <CartName>BatchCartState): { spreadsheetName: string; dtoName: string }[] {
    return [
      { spreadsheetName: 'id', dtoName: 'item.id' },
      { spreadsheetName: 'name', dtoName: 'item.name' },
    ];
  }

  /**
   * Maps a raw spreadsheet row into the target DTO item structure.
   */
  async getDtoSpreadsheetFromLine(
    state: <CartName>BatchCartState,
    cache: glyvio_core.CacheController,
    item: <CartName>BatchCartDto,
    columns: string[],
    line: { [key: string]: any },
  ): Promise<void> {
    item.id = line['id'] || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    item.entityName = '<EntityName>';
    item.name = line['name'] || '';
  }

  /**
   * Converts the DTO item into a queue of database entities ready for a single-transaction save.
   */
  async getEntitiesFromDto(
    state: <CartName>BatchCartState,
    item: <CartName>BatchCartDto,
    queue: glyvio_core.EntityServiceQueue,
  ): Promise<glyvio_core.EntityServiceQueue> {
    const entity = new glyvio_entity.<EntityName>();
    entity.id = item.id;
    // 💡 Example: entity.name = item.name;

    queue.push(entity);
    return queue;
  }

  /**
   * Executed when a DTO item property is updated inline. Use `newItemState.__status`/
   * `__statusDesc` to surface row-level validation feedback.
   */
  async onUpdateItem(
    key: string,
    state: <CartName>BatchCartState,
    oldItemState: <CartName>BatchCartDto,
    newItemState: <CartName>BatchCartDto,
  ): Promise<void> {
    // 💡 Example:
    // if (key === 'name' && !newItemState.name) {
    //   newItemState.__status = 'ERROR_DTO';
    //   newItemState.__statusDesc = 'Name is required';
    // } else {
    //   newItemState.__status = 'AWAITING';
    //   newItemState.__statusDesc = '';
    // }
  }

  /**
   * Event handlers for custom interactions (e.g. toolbar buttons wired via `appBarDesign`).
   */
  async events(state: <CartName>BatchCartState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'addFromFilter') {
    //   await this.pushModal(new SomeFilterModalRoute({ popActionKey: 'onFilterSelected' }));
    //   return 'STATE_FREEZED';
    // }
    return undefined;
  }
}

/**
 * Custom Interceptor class for SimpleBatchCart. Always extend `SimpleBatchCartInterceptor<S, I>`
 * (rule #5) — never `SimpleCartListener`.
 */
export abstract class <CartName>BatchCartInterceptor extends glyvio_core.SimpleBatchCartInterceptor<
  <CartName>BatchCartState,
  <CartName>BatchCartDto
> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <CartName>BatchCartRoute;
  }
}
```
