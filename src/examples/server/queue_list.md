# Example: QueueList — Deferred & Deduplicated Task Execution

This example demonstrates how to use `QueueList` via the global `getCurrentQueue()` helper to schedule operations that execute deferred (later in the process, always within the current database transaction). It also details how to use **deterministic IDs** to avoid duplicate operations during complex operations.

---

## Indications of Use

Use `QueueList` when:

1. **Deferred Execution is Required**: You need to schedule side-effects (e.g., creating notifications, preparing data for external APIs, or processing logs) to execute later, but still within the current database transaction context.
2. **Deduplication of Redundant Actions**: A single transaction modifies the database multiple times (e.g., updating product stock during order item savings), but you only want to perform the associated side-effect **once** at the very end of the process.
3. **Deduplication via Deterministic IDs**: By generating a unique, deterministic ID based on the entity (e.g., `stock_notify_product_<productId>`), you can easily check if the task is already queued, ensuring subsequent save events do not schedule duplicate side-effects.

---

## What `QueueList` Does

The `getCurrentQueue()` helper resolves a transaction-scoped list where you can add `QueuedOperation` objects.

Key characteristics:

- **Executes within the current transaction** — tasks are run at the end of the request/operation flow, always within the current database transaction context.
- **Deduplication / Unique ID lookup** — you can look up scheduled tasks in the queue using `.getById(id)` to skip duplicate scheduling.
- **State options** — you can pass parameterized payload arguments in the queue, or let the deferred handler query the database to retrieve the latest state.
- **Add or Replace** — using `addOrReplace(operation)` allows updating the payload arguments to the latest state if a task is already queued.

---

## deduplication Pattern: Stock Notification Example

### Scenario

Saving an order modifies the stock of a Product multiple times (e.g., as items are added or quantities updated). We want to send a stock notification, but only **once** per Product at the end of the entire saving process.

To achieve this:

1. We generate a deterministic ID: `stock_notification_product_<productId>`.
2. Before adding the task to the queue, we check `getCurrentQueue().getById(id)`.
3. If it is already in the queue, we ignore the subsequent request (or update the payload if needed).
4. The task is executed once at the end using either the parameterized payload or the final database state within the current transaction.

### Code Implementation

Create a new interceptor, e.g., `src/interceptors/product_stock_sync_interceptor.ts`:

```typescript
export interface StockNotifyEvent {
  productId: string;
  initialStock: number;
  currentStock: number;
  testCount: number;
}

/**
 * Interceptor that schedules a single, deduplicated notification when a product's stock is modified.
 */
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.Product,
  id: 'product_stock_notify_queue',
  priority: 100,
})
export class ProductStockNotifyQueueInterceptor extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.Product> {
  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.Product>,
    context: Readonly<glyvio_core.SyncInterceptorContext<glyvio_entity.Product>>,
  ): void {
    const stockField = glyvio_structure.AllEntities.product.stock;

    // Check if the stock was modified
    if (value.isModified(stockField)) {
      const deterministicId = `stock_notify_product_${value.id}`;
      const queue = glyvio_core.getCurrentQueue();

      // Check if this notification is already scheduled in the queue
      const existingOp = queue.getById<StockNotifyEvent>(deterministicId);

      if (existingOp) {
        // Option A: If already queued, update the argument details (e.g. increment counter or update stock)
        existingOp.arguments.currentStock = value.stock;
        existingOp.arguments.testCount += 1;

        // Re-insert or update in the queue
        queue.addOrReplace(existingOp);
        console.log(`[Queue] Updated existing stock operation for product: ${value.id}`);
      } else {
        // Option B: Schedule the operation for the first time
        queue.add({
          id: deterministicId,
          type: 'interceptor',
          eventName: 'process_stock_notification',
          arguments: <StockNotifyEvent>{
            productId: value.id,
            initialStock: value.getOriginalValue(stockField),
            currentStock: value.stock,
            testCount: 1,
          },
        });
        console.log(`[Queue] Scheduled new stock operation for product: ${value.id}`);
      }
    }
  }
}
```

---

## Key Architectural Points

| Method / Property               | Detail                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `glyvio_core.getCurrentQueue()` | Returns the transaction-scoped `QueueList` instance.                                          |
| `.add(operation)`               | Appends a `QueuedOperation` to the queue.                                                     |
| `.getById(id)`                  | Resolves a scheduled `QueuedOperation` by its ID; returns `undefined` if not present.         |
| `.addOrReplace(operation)`      | Adds the task, or updates its payload in-place if the ID matches a previously scheduled task. |
| `.remove(id)`                   | Removes the task with the matching ID from the queue.                                         |
| `.size()`                       | Returns the current count of scheduled operations.                                            |
| Queue Iteration                 | `QueueList` is iterable: `for (const op of getCurrentQueue()) { ... }`.                       |
