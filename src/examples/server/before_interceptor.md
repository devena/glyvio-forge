# Example: Before Interceptor — Pre-Save Validation & Mutation

This example demonstrates how to create a **before interceptor** that executes synchronously before an entity is saved to the database. Before interceptors are the correct tool for validating fields, enforcing constraints, injecting default values, or auto-calculating fields prior to persistence.

---

## What `@BeforeInterceptor` Does

The `@glyvio_core.BeforeInterceptor` decorator registers a class so the engine calls its `handleBefore` method before committing the target entity.

Key characteristics:

- **Runs before the database save/commit** — you can modify the entity values, and they will be saved to the database.
- **Runs after SyncInterceptors** — executes in the pre-save pipeline **after** SyncInterceptors have finished modifying/preparing the synchronization values.
- **Execution Pipeline Order** — The full execution sequence is `SyncInterceptor` > `BeforeInterceptor` > `AfterInterceptor`.
- **Mutable value proxy** — `value` is typed as `BeforeInterceptorValue<T>`. You can read, write, and restore fields.
- **Transaction Rollback** — throwing any error inside `handleBefore` will abort the save transaction and bubble up the error to the server.
- **Change detection** — `value.isModified(field)` tells you whether a field has been changed in the current save attempt relative to the previous database snapshot.
- **Original snapshot** — `context.savedValue` contains the entity state as it currently exists in the database. It is `undefined` on first insert.
- **Ordered execution** — multiple before interceptors for the same entity execute in ascending `priority` order. The default priority is `50`.

---

## Implementing `SimpleBeforeInterceptor`

Extend `glyvio_core.SimpleBeforeInterceptor<T>` and implement the `handleBefore` method. Decorate the class with `@glyvio_core.BeforeInterceptor`.

```typescript
@glyvio_core.BeforeInterceptor({
  entity: glyvio_entity.Tag, // Which entity to listen to
  id: 'tag_default_name', // Unique ID within the plugin
  priority: 10, // Execution priority (lower runs first)
})
export class TagDefaultNameInterceptor extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.Tag> {
  handleBefore(
    value: glyvio_core.BeforeInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.BeforeInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    if (!value.name || value.name.trim() === '') {
      value.name = 'Unnamed Tag';
    }
  }
}
```

---

## Real-World Use Case: Validate & Inject Field Defaults

### Scenario

When creating or modifying a `Tag`, check if `color` is provided. If not, automatically assign a default color. Also, normalize the `name` field to lowercase.

### File

Create a new file in your plugin, e.g. `src/interceptors/tag_defaults_before_interceptor.ts`.

```typescript
/**
 * Before interceptor that automatically enforces default colors and lowecases tag names.
 */
@glyvio_core.BeforeInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_defaults',
  priority: 30,
})
export class TagDefaultsBeforeInterceptor extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.Tag> {
  handleBefore(
    value: glyvio_core.BeforeInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.BeforeInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    // 1. Enforce default color if empty
    if (!value.color) {
      value.color = '#cccccc';
    }

    // 2. Normalise name to lowercase if present
    if (value.name) {
      value.name = value.name.toLowerCase().trim();
    }
  }
}
```

---

## Real-World Use Case: Pre-Save Business Rule Validation with Rollback

### Scenario

Prevent users from changing a Tag's name if the tag is locked. If they attempt to change it, throw an error, which aborts the database transaction.

```typescript
/**
 * Before interceptor that validates business logic and throws to roll back database saves.
 */
@glyvio_core.BeforeInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_lock_validation',
  priority: 10,
})
export class TagLockValidationInterceptor extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.Tag> {
  handleBefore(
    value: glyvio_core.BeforeInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.BeforeInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    // We only validate changes if the tag already exists in the database.
    if (!context.savedValue) {
      return; // New record, lock constraint doesn't apply yet
    }

    const nameField = glyvio_structure.AllEntities.tag.name;

    // Check if the user is trying to change the name
    if (value.isModified(nameField)) {
      const isLocked = context.savedValue.isLocked === true; // or value.isLocked

      if (isLocked) {
        // Throwing an error will cause the server to abort the transaction and roll back changes.
        throw new Error(`Cannot rename tag "${context.savedValue.name}" because it is locked.`);
      }
    }
  }
}
```

---

## Key Architectural Points

| Concept                                  | Detail                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@glyvio_core.BeforeInterceptor`         | Registers the class. `entity` must use `glyvio_entity.*`. `id` must be unique per plugin.                                                             |
| `glyvio_core.SimpleBeforeInterceptor<T>` | Base class to extend. Provides the `handleBefore` abstract method contract.                                                                           |
| `value` type                             | `glyvio_core.BeforeInterceptorValue<T>` = `T & ModelModification`. Fields are readable and writable.                                                  |
| `value.isModified(field)`                | Returns `true` if the field differs from the previous database snapshot. Field descriptors come from `glyvio_structure.AllEntities.<entity>.<field>`. |
| `value.getOriginalValue(field)`          | Returns the field's value from **before** the save.                                                                                                   |
| `value.getCurrentValue(field)`           | Returns the field's value from **after** any interceptor modifications (same as reading `value.<field>`).                                             |
| `value.restoreValue(field)`              | Reverts a field's modified value back to its original database value.                                                                                 |
| `context.savedValue`                     | Previous entity snapshot. `undefined` on first insert (creation).                                                                                     |
| `context.valueId`                        | The database ID of the entity that is being saved.                                                                                                    |
| `context.extras`                         | Arbitrary data forwarded from `glyvio_core.entityService.saveInput(...)`.                                                                             |
| `priority`                               | Ascending order — `10` runs before `50`. Default is `50`.                                                                                             |
| Error throwing / Rollback                | Any exception thrown during execution will halt saving and roll back the database transaction.                                                        |
| No imports                               | All symbols (`glyvio_core`, `glyvio_entity`, `glyvio_structure`) are globally injected.                                                               |
