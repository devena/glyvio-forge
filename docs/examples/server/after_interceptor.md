# Example: After Interceptor — Post-Save Side Effects

This example demonstrates how to create an **after interceptor** that reacts to a successfully saved entity. After interceptors are the correct tool for side-effects that must happen only once the database commit has succeeded: sending notifications, writing audit/activity logs, calling external services, and creating derived records.

---

## What `@AfterInterceptor` Does

The `@glyvio_core.AfterInterceptor` decorator registers a class so the engine calls its `handleAfter` method every time the targeted entity is saved to the database.

Key characteristics:

- **Runs after the commit** — the entity is already persisted when `handleAfter` is called.
- **Runs after SyncInterceptors and BeforeInterceptors** — executes in the post-save pipeline **after** both SyncInterceptors and BeforeInterceptors have executed, and the transaction has been committed.
- **Execution Pipeline Order** — The full execution sequence is `SyncInterceptor` > `BeforeInterceptor` > `AfterInterceptor`.
- **Read-only value** — `value` is `Readonly<T & ModelModification>`. You can read fields and call change-detection helpers, but you cannot assign to entity fields.
- **Change detection** — `value.isModified(field)` tells you whether a field changed relative to the previous database snapshot.
- **Previous snapshot** — `context.savedValue` holds the entity state before the current save. It is `undefined` when the entity was just created (first insert).
- **No rollback on throw** — throwing inside `handleAfter` does not undo the save.
- **Ordered execution** — multiple after interceptors for the same entity run in ascending `priority` order. The default priority is `50`.

---

## Implementing `SimpleAfterInterceptor`

Extend `glyvio_core.SimpleAfterInterceptor<T>` and implement the single abstract method `handleAfter`. Decorate the class with `@glyvio_core.AfterInterceptor`.

```typescript
@glyvio_core.AfterInterceptor({
  entity: glyvio_entity.Tag, // Which entity to listen to
  id: 'tag_save_logger', // Unique id within your plugin
  priority: 10, // Lower numbers run before higher numbers
})
export class TagSaveLoggerInterceptor extends glyvio_core.SimpleAfterInterceptor<glyvio_entity.Tag> {
  handleAfter(
    value: glyvio_core.AfterInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.AfterInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    const isNew = context.savedValue === undefined;
    const action = isNew ? 'created' : 'updated';
    console.log(`[TagSaveLogger] Tag "${value.name}" was ${action} (id: ${context.valueId}).`);
  }
}
```

---

## Real-World Use Case: Create System Notification on Field Change

### Scenario

Whenever the `color` field of a `Tag` is changed, create and save a new `Notification` entity to notify the user.

### File

Create a new file in your plugin, e.g. `src/interceptors/tag_color_notification_interceptor.ts`.

```typescript
/**
 * After interceptor that generates a system notification whenever the `color` field
 * of a Tag entity is modified.
 *
 * Execution rules:
 * - Runs AFTER the Tag has been committed to the database.
 * - Does NOT mutate the Tag — it only reads it.
 * - Creates a new Notification entity using saveEntityWithoutPermission so the notification
 *   is successfully written regardless of user-level entity permissions.
 */
@glyvio_core.AfterInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_color_notification',
  priority: 50,
})
export class TagColorNotificationInterceptor extends glyvio_core.SimpleAfterInterceptor<glyvio_entity.Tag> {
  handleAfter(
    value: glyvio_core.AfterInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.AfterInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    // Access the entity field descriptor from the global structure schema.
    const colorField = glyvio_structure.AllEntities.tag.color;

    // isModified tells us whether the color changed relative to the previous snapshot.
    if (!value.isModified(colorField)) {
      return; // Color was not touched in this save — nothing to log or notify.
    }

    // getOriginalValue returns the field value from the database BEFORE this save.
    const previousColor = value.getOriginalValue(colorField) as string | undefined;
    const currentColor = value.color;

    console.log(
      `[TagColorNotification] Tag "${value.name}" color changed: ` +
        `"${previousColor ?? 'none'}" -> "${currentColor ?? 'none'}" (id: ${context.valueId})`,
    );

    // Build the system notification entity.
    const notification = new glyvio_entity.Notification();
    notification.title = 'Tag Color Changed';
    notification.description = `Tag "${value.name}" color was changed from "${previousColor ?? 'none'}" to "${currentColor ?? 'none'}".`;
    notification.viewed = false;

    // Assign the notification to the user who triggered the save (if passed in context extras)
    // otherwise default to the system.
    notification.userId =
      context.extras && typeof context.extras === 'object' && 'userId' in context.extras
        ? String((context.extras as any).userId)
        : 'system';

    // Save without permission check — notification writes are internal system reactions.
    glyvio_core.entityService.saveEntityWithoutPermission(notification);
  }
}
```

---

## Real-World Use Case: Calling an External Service After Save

### Scenario

After a `Tag` is saved (create or update), notify an external system via the environment service.

```typescript
/**
 * After interceptor that notifies an external integration environment every time
 * a Tag entity is saved.
 */
@glyvio_core.AfterInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_external_notify',
  priority: 100,
})
export class TagExternalNotifyInterceptor extends glyvio_core.SimpleAfterInterceptor<glyvio_entity.Tag> {
  handleAfter(
    value: glyvio_core.AfterInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.AfterInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    // Determine whether this was an insert or an update.
    const isNew = context.savedValue === undefined;

    // Call the action registered on the external environment.
    const result = glyvio_core.environmentService.callEnvironmentActionRaw(
      'env-integrations', // ID of the target environment
      'tag.saved', // Action name registered in that environment
      {
        tagId: context.valueId,
        tagName: value.name,
        tagColor: value.color,
        isNew,
      },
    );

    if (result.status !== 'success') {
      // Log the error but do NOT throw — throwing here will not undo the tag save.
      console.error('[TagExternalNotify] Failed to notify external system:', result.result);
    }
  }
}
```

---

## Key Architectural Points

| Concept                                 | Detail                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@glyvio_core.AfterInterceptor`         | Registers the class. `entity` must use `glyvio_entity.*`. `id` must be unique per plugin.                                                             |
| `glyvio_core.SimpleAfterInterceptor<T>` | Base class to extend. Provides the `handleAfter` abstract method contract.                                                                            |
| `value` type                            | `glyvio_core.AfterInterceptorValue<T>` = `Readonly<T & ModelModification>`. Fields are read-only.                                                     |
| `value.isModified(field)`               | Returns `true` if the field differs from the previous database snapshot. Field descriptors come from `glyvio_structure.AllEntities.<entity>.<field>`. |
| `value.getOriginalValue(field)`         | Returns the field's value from **before** the save.                                                                                                   |
| `value.getCurrentValue(field)`          | Returns the field's value from **after** the save (same as `value.<field>`).                                                                          |
| `context.savedValue`                    | Previous entity snapshot. `undefined` on first insert.                                                                                                |
| `context.valueId`                       | The database ID of the entity that was saved.                                                                                                         |
| `context.extras`                        | Arbitrary data forwarded from `glyvio_core.entityService.saveInput(...)`.                                                                             |
| `priority`                              | Ascending order — `10` runs before `50`. Default is `50`.                                                                                             |
| No imports                              | All symbols (`glyvio_core`, `glyvio_entity`, `glyvio_structure`) are globally injected.                                                               |
