# Example: Sync Interceptor — Synchronous Pre-Save Operations

This example demonstrates how to create a **sync interceptor** that executes synchronously before an entity is saved to the database. Sync interceptors are a specialized form of before interceptors, optimized for synchronizing dependent fields, keeping track of modification state, and executing synchronous business calculations before committing to the database.

---

## What `@SyncInterceptor` Does

The `@glyvio_core.SyncInterceptor` decorator registers a class so the engine calls its `handleSync` method synchronously before saving the target entity.

Key characteristics:

- **Runs when a synchronization request arrives** — Sync interceptors execute synchronously when a synchronization request arrives from the integrator.
- **Runs before save and BeforeInterceptors** — executes in the pre-save pipeline, running **before** BeforeInterceptors.
- **Execution Pipeline Order** — The full execution sequence is `SyncInterceptor` > `BeforeInterceptor` > `AfterInterceptor`.
- **Mutable proxy** — `value` is typed as `SyncInterceptorValue<T>` (which is `T & ModelModification`). You can read, write, and restore fields.
- **No `extras` in Context** — `SyncInterceptorContext` contains `structureId`, `structureName`, `valueId`, and `savedValue` (read-only previous snapshot), but does not have the arbitrary `extras` object found in `BeforeInterceptorContext`.
- **Transaction Rollback** — throwing any error inside `handleSync` will abort the save operation and cause a transaction rollback.
- **Ordered execution** — executes in ascending `priority` order (default priority is `50`).

---

## Implementing `SimpleSyncInterceptor`

Extend `glyvio_core.SimpleSyncInterceptor<T>` and implement the `handleSync` method. Decorate the class with `@glyvio_core.SyncInterceptor`.

```typescript
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.Tag, // Target entity
  id: 'tag_sync_timestamps', // Unique ID within the plugin
  priority: 50, // Execution priority
})
export class TagSyncTimestampsInterceptor extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.Tag> {
  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.SyncInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    // Custom sync logic
  }
}
```

---

## Real-World Use Case: Denormalized Field Synchronization

### Scenario

When saving a `Tag`, check if the tag's `name` has been modified. If so, automatically update a denormalized `normalizedName` field to be uppercase and trim any whitespace.

### File

Create a new file in your plugin, e.g. `src/interceptors/tag_normalization_sync_interceptor.ts`.

```typescript
/**
 * Sync interceptor that synchronizes denormalized search fields on Tag saving.
 */
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_name_normalization',
  priority: 25,
})
export class TagNameNormalizationSyncInterceptor extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.Tag> {
  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.SyncInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    const nameField = glyvio_structure.AllEntities.tag.name;

    // Detect if the name field was modified during the save operation
    if (value.isModified(nameField)) {
      if (value.name) {
        value.normalizedName = value.name.toUpperCase().trim();
      } else {
        value.normalizedName = null;
      }
    }
  }
}
```

---

## Real-World Use Case: Synchronous Field Calculations

### Scenario

When a database entity containing price or quantity fields is saved, automatically calculate a total amount before persisting the data.

```typescript
/**
 * Sync interceptor that computes total product price before persistence.
 */
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.Product,
  id: 'product_total_price_sync',
  priority: 50,
})
export class ProductTotalPriceSyncInterceptor extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.Product> {
  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.Product>,
    context: Readonly<glyvio_core.SyncInterceptorContext<glyvio_entity.Product>>,
  ): void {
    const priceField = glyvio_structure.AllEntities.product.price;
    const qtyField = glyvio_structure.AllEntities.product.quantity;

    if (value.isModified(priceField) || value.isModified(qtyField)) {
      const price = value.price || 0;
      const quantity = value.quantity || 0;
      value.totalAmount = price * quantity;
    }
  }
}
```

---

## Key Architectural Points

| Concept                                | Detail                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@glyvio_core.SyncInterceptor`         | Registers the class. `entity` must use `glyvio_entity.*`. `id` must be unique per plugin.                                                             |
| `glyvio_core.SimpleSyncInterceptor<T>` | Base class to extend. Provides the `handleSync` abstract method contract.                                                                             |
| `value` type                           | `glyvio_core.SyncInterceptorValue<T>` = `T & ModelModification`. Fields are readable and writable.                                                    |
| `value.isModified(field)`              | Returns `true` if the field differs from the previous database snapshot. Field descriptors come from `glyvio_structure.AllEntities.<entity>.<field>`. |
| `value.getOriginalValue(field)`        | Returns the field's value from **before** the save.                                                                                                   |
| `value.getCurrentValue(field)`         | Returns the field's value from **after** interceptor modifications (same as reading `value.<field>`).                                                 |
| `value.restoreValue(field)`            | Reverts a field's modified value back to its original database value.                                                                                 |
| `context.savedValue`                   | Previous entity snapshot. `undefined` on first insert (creation).                                                                                     |
| `context.valueId`                      | The database ID of the entity that is being saved.                                                                                                    |
| `priority`                             | Ascending order — `10` runs before `50`. Default is `50`.                                                                                             |
| Error throwing / Rollback              | Any exception thrown during execution will halt saving and roll back the database transaction.                                                        |
| No imports                             | All symbols (`glyvio_core`, `glyvio_entity`, `glyvio_structure`) are globally injected.                                                               |
