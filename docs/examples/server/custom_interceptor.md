# Example: Custom Interceptor — Event-Based Deferred Tasks

This example demonstrates how to create and register a **custom interceptor** (also known as a simple interceptor) and trigger it deferred using `QueueList` (`getCurrentQueue()`) during a database transaction.

---

## What `@Interceptor` Does

The `@glyvio_core.Interceptor` decorator registers a class to handle a custom `eventName`.

Key characteristics:

- **Event-Driven** — unlike entity interceptors (Before/After/Sync) which target a specific model lifecycle hook, custom interceptors are generic listeners that react to any custom string `eventName`.
- **Deferred execution** — like strategies, they are commonly scheduled as queued operations via `getCurrentQueue().add(...)`. They run deferred later in the process, but **always within the current database transaction context**.
- **Priority-sorted** — if multiple custom interceptors listen to the same `eventName`, they run sequentially in ascending `priority` order (default `50`).

---

## Implementing `SimpleInterceptor`

Extend `glyvio_core.SimpleInterceptor<T>` and implement the `execute` method. Decorate the class with `@glyvio_core.Interceptor`.

```typescript
export interface ColorResetEvent {
  tagId: string;
  oldColor: string;
  newColor: string;
  testCount: number;
}

export const colorResetEventName = 'when_color_is_reset';

/**
 * Custom interceptor that listens to 'when_color_is_reset' events.
 */
@glyvio_core.Interceptor({
  id: 'tag_print_when_color_is_reset',
  eventName: colorResetEventName,
  priority: 10, // Lower executes first
})
export class PrintWhenColorIsReset extends glyvio_core.SimpleInterceptor<ColorResetEvent> {
  execute(args: ColorResetEvent): void {
    console.log('[Custom Interceptor] Tag color was reset. Details:', args);
  }
}
```

---

## Real-World Use Case: Queueing and Executing a Custom Interceptor

### Scenario

When modifying a `Tag`, if the tag's color is modified, we want to reset it back to its original value and schedule a custom log operation deferred within the transaction.

### Step 1: Schedule the Custom Interceptor in a `SyncInterceptor`

```typescript
@glyvio_core.SyncInterceptor({
  entity: glyvio_entity.Tag,
  id: 'tag_color_reset_detector',
  priority: 50,
})
export class TagColorResetSyncInterceptor extends glyvio_core.SimpleSyncInterceptor<glyvio_entity.Tag> {
  handleSync(
    value: glyvio_core.SyncInterceptorValue<glyvio_entity.Tag>,
    context: Readonly<glyvio_core.SyncInterceptorContext<glyvio_entity.Tag>>,
  ): void {
    const colorField = glyvio_structure.AllEntities.tag.color;

    if (context.savedValue && value.isModified(colorField)) {
      const deterministicId = `color_reset_tag_${value.id}`;
      const queue = glyvio_core.getCurrentQueue();

      // Check if already queued to prevent duplicate logs
      if (!queue.getById(deterministicId)) {
        queue.add({
          id: deterministicId,
          type: 'interceptor', // Catches @Interceptor registered classes
          eventName: colorResetEventName,
          arguments: <ColorResetEvent>{
            tagId: value.id,
            oldColor: value.getOriginalValue(colorField),
            newColor: value.color,
            testCount: 1,
          },
        });
      }

      // Revert the value mutation
      value.restoreValue(colorField);
    }
  }
}
```

### Step 2: Custom Interceptor Executes

Later in the current database transaction process, the engine reads the queue, looks up the custom interceptor registered for `when_color_is_reset`, and executes `PrintWhenColorIsReset.execute(args)`.

---

## Key Architectural Points

| Concept                            | Detail                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@glyvio_core.Interceptor`         | Decorator to register custom simple interceptors. `eventName` is the string key to listen to.                               |
| `glyvio_core.SimpleInterceptor<T>` | Base class to extend. Provides the JSDoc-compliant `execute(args: T): void` contract.                                       |
| Queue Integration                  | Schedule via `glyvio_core.getCurrentQueue().add({ type: 'interceptor', eventName: '...', id: '...', arguments: { ... } })`. |
| Execution Scope                    | Always executes **within the current database transaction** (later in the pipeline request flow).                           |
| No imports                         | All symbols are globally injected under `glyvio_core.*` and `glyvio_entity.*`.                                              |
