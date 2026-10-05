---
name: use-cache-service
description: "Caches values computed on the server across requests with glyvio_core.cacheService (put/get/evict) — a fully manual cache keyed by namespace + identifier — and keeps it correct by evicting from interceptors when the source records change."
---
# Agent Skill: Server Cache

`glyvio_core.cacheService` (server layer) is a **manual** cache shared across requests:

| Method | |
| --- | --- |
| `put(key, identifier, value)` | stores any JSON-serializable value (serialized with the platform rules) |
| `get<T>(key, identifier): T \| undefined` | returns what was put, or `undefined` |
| `evict(key, identifier)` | removes one entry |

Nothing is loaded automatically and nothing reloads after `evict`: `get` returns `undefined` until
your code `put`s again. Convention: `key` = the domain/entity (`'tag'`), `identifier` = `'<entity>:<id>'`.

---

## 🧩 Pattern — read-through + evict on change

```typescript
type <Name>Snapshot = { id: string; name: string | null };

function get<Name>(id: string): <Name>Snapshot | undefined {
  const cached = glyvio_core.cacheService.get<<Name>Snapshot>('<plugin>.<entity>', `<entity>:${id}`);
  if (cached) {
    return cached;
  }
  // load from the database (server QueryBuilder), build the snapshot, then:
  const snapshot: <Name>Snapshot = { id, name: null };
  glyvio_core.cacheService.put('<plugin>.<entity>', `<entity>:${id}`, snapshot);
  return snapshot;
}

@glyvio_core.AfterInterceptor({ entity: glyvio_entity.<EntityName>, id: '<plugin>.<entity>.evict_cache' })
export class <EntityName>EvictCacheInterceptor extends glyvio_core.SimpleAfterInterceptor<glyvio_entity.<EntityName>> {
  handleAfter(
    value: glyvio_core.AfterInterceptorValue<glyvio_entity.<EntityName>>,
    _context: glyvio_core.AfterInterceptorContext<glyvio_entity.<EntityName>>,
  ): void {
    glyvio_core.cacheService.evict('<plugin>.<entity>', `<entity>:${value.id}`);
  }
}
```

Check the exact after-interceptor method name and value/context types in the server `.d.ts`
(skill `create-after-interceptor`).

---

## 🚫 Rules

1. Cache **derived, read-heavy** data (lookups, configuration snapshots, expensive aggregates) —
   never the source of truth, and never data whose staleness could cause a wrong business decision.
2. Every cached value needs an **eviction path**: an interceptor on each entity it depends on.
3. Namespace keys with the plugin name; include the record id in the identifier.
4. Store small, plain snapshots (ids, names, numbers) — not whole entity graphs.
5. Never cache per-user permission results under a key that is not user-scoped.

---

## ✅ Completion Checklist

- [ ] Namespaced key/identifier; small snapshots.
- [ ] Eviction interceptor for every source entity.
- [ ] Behavior verified after editing the source record (value refreshed).
