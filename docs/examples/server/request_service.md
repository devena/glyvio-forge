# Example: Request Service — Retrieve Request-Scoped Modifications

This example demonstrates how to use the **Request Service** (`glyvio_core.requestService`) to inspect all database entity modifications that occurred within the current request execution context.

This service is especially useful inside database interceptors (like `BeforeInterceptor` or `AfterInterceptor`) or custom business logic where you need a global view of all operations performed during the transaction, rather than just the single entity currently passed to the interceptor handler.

---

## What `requestService` Does

The `glyvio_core.requestService` is a global service that provides metadata about the operations occurring inside the boundaries of the active execution request.

Key characteristics:

- **Transaction-wide visibility** — Returns a list of all entities that have been created, updated, or deleted during the request.
- **Request scope** — Data is scoped to the current HTTP/task execution thread and does not leak between parallel requests.
- **Bridge to Native Engine** — Under the hood, it calls `_requestUtils.getRequestModifications()` to fetch modifications tracked by the core runtime engine.

### The `ModificationInfo` Structure

The service returns an array of `glyvio_core.ModificationInfo` objects. Each entry contains:

- `entity`: Metadata about the entity structure/type (its `id`, `friendlyName`, and `internalName`).
- `objectId`: The primary key of the modified instance.
- `originalState`: The state of the model before modifications began (`undefined` if the entity was newly created).
- `lastState`: The latest state of the model in the current request.

---

## 🛠️ Complete Implementation Example

### Scenario

We want to implement a validation interceptor that prevents modifications to `Tag` entities if the current request is also modifying certain sensitive settings or modifying a user group, or we want to log all changed entities within a `BeforeInterceptor` for audit purposes.

Create a new file (e.g., `src/interceptors/tag_request_audit_interceptor.ts`) in your plugin workspace and paste the following content:

```typescript
/**
 * Interceptor that uses requestService to audit/validate multiple modifications.
 *
 * Remember: avoid imports from core libraries; use global namespaces.
 */
@glyvio_core.BeforeInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_request_audit_interceptor',
  priority: 100,
})
export class TagRequestAuditInterceptor extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.Tag> {
  /**
   * Called before a Tag entity is saved to the database.
   *
   * @param value - The Tag entity instance being saved.
   * @param context - Additional contextual information about the save operation.
   */
  handleBefore(
    value: glyvio_entity.Tag,
    context: glyvio_core.BeforeInterceptorContext<glyvio_entity.Tag>,
  ): Promise<void> | void {
    // Retrieve all entity modifications made during the current request.
    const allModifications = glyvio_core.requestService.getCurrentModifications();

    console.log(`[RequestAudit] Total entities modified in this request: ${allModifications.length}`);

    // Check if an AppUser is also being modified in the same request.
    const hasUserModification = allModifications.some((mod) => mod.entity.id === 'app_user');

    if (hasUserModification) {
      console.warn(`[RequestAudit] Warning: Tag "${value.name}" is being modified in the same request as an AppUser.`);
    }

    // Inspect other modified Tags in the same request to enforce batch-size limits or check states
    const modifiedTags = allModifications.filter((mod) => mod.entity.id === 'tag');

    if (modifiedTags.length > 5) {
      throw new Error(
        `Bulk modification limit exceeded: Cannot modify more than 5 Tags in a single request. (Attempted: ${modifiedTags.length})`,
      );
    }

    // You can also inspect the old and new states of any modified entity:
    for (const mod of allModifications) {
      const entityName = mod.entity.friendlyName;
      const objectId = mod.objectId;
      const wasCreated = mod.originalState === undefined;

      if (wasCreated) {
        console.log(`[RequestAudit] ${entityName} with ID ${objectId} is being CREATED in this request.`);
      } else {
        console.log(`[RequestAudit] ${entityName} with ID ${objectId} is being UPDATED in this request.`);
      }
    }
  }
}
```

---

## 🔍 Key Architectural Points

1. **`glyvio_core.requestService.getCurrentModifications()`**:
   - Accesses the list of all active modifications within the boundary of the current transaction.
   - Returns typed `ModificationInfo` objects.
2. **`originalState` and `lastState`**:
   - `originalState` represents the pre-save database state. If `undefined`, it indicates the record is new (e.g. an INSERT).
   - `lastState` is the current, up-to-date state.
3. **Usage Contexts**:
   - **`BeforeInterceptor`**: Validates cross-entity rules within a request before write operations are committed.
   - **`AfterInterceptor`**: Inspects a batch of changes to send consolidated notification emails, sync data to external systems (like search indexes), or create audit log records.
