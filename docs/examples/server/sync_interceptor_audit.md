# Example: Sync Interceptor with Change Tracking

This example demonstrates how to create a synchronous interceptor that listens to entity saves, checks if a specific field was modified, and performs business logic (such as logging an audit entry) before the transaction commits.

## Scenario

We want to track changes to the `color` field on the `Tag` entity. If the color is modified, we want to print a log and ensure the modification is allowed.

---

## 🛠️ Complete Implementation

Create a new file (e.g., `src/interceptors/sync_tag_interceptor.ts`) in your plugin workspace and paste the following content:

```typescript
/**
 * Sync Interceptor to monitor modifications to Tag entity fields.
 *
 * Interceptors are registered automatically if they use the `@glyvio_core.SyncInterceptor` decorator.
 * Remember to avoid imports from core libraries; use global namespaces.
 */
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.Tag,
  id: 'sync_tag_color_interceptor',
  priority: 100, // Higher numbers run later
})
export class SyncTagColorInterceptor extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.Tag> {
  /**
   * Called synchronously during the entity save process, before transaction commits.
   *
   * @param value - The entity instance being saved. Includes helpers like isModified.
   * @param context - Additional contextual information about the save operation.
   */
  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.Tag>,
    context: glyvio_core.SyncInterceptorContext<glyvio_entity.Tag>,
  ): Promise<void> | void {
    // Check if the Tag's color field was modified during this save operation
    const colorField = glyvio_structure.AllEntities.tag.color;

    if (value.isModified(colorField)) {
      const oldColor = value.getOriginalValue(colorField);
      const newColor = value.color;

      console.log(`[Audit] Tag ID ${value.id} changed color from '${oldColor}' to '${newColor}'`);

      // Example of validation or modification:
      // Prevent tags from being changed to black if the user is not an administrator
      if (newColor === 'black' && !glyvio_core.permissionService.isAdmin()) {
        throw new Error('Only administrators can set a tag color to black.');
      }
    }
  }
}
```

---

## 🔍 Key Architectural Points

1. **`@glyvio_core.SyncInterceptor`**:
   - Registers this class as a synchronous interceptor.
   - `entity` option must point to the entity model class: `glyvio_entity.Tag`.
   - `id` must be unique across the plugin environment.
2. **`isModified(field)`**:
   - Evaluates whether the specified field has changed from its database state.
   - Access fields using the schema mapping under `glyvio_structure.AllEntities.<entityName>.<fieldName>`.
3. **`getOriginalValue(field)`**:
   - Retrieves the previous value of the field before the current save operation began.
4. **No Import Statements**:
   - The decorators, base class, schemas, and services are fully resolved through the global namespaces (`glyvio_core`, `glyvio_entity`, `glyvio_structure`).
