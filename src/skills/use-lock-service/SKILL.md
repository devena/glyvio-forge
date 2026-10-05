---
name: use-lock-service
description: "Serializes concurrent server writes on the same resource with glyvio_core.lockService (acquireLock/releaseLock) — e.g. reserving stock units, claiming a slot, generating something unique — following the fail-fast semantics of the platform (cannot_acquire_lock) and lock ordering to avoid deadlocks."
---
# Agent Skill: Distributed Locks

`glyvio_core.lockService` (server layer): `acquireLock(key)` / `releaseLock(key)`.

**It fails fast — it does not wait.** Despite older docs saying it "blocks until acquired", when
another request holds the key the call fails and the request ends with
`400 {"errors":[{"reason":"cannot_acquire_lock"}]}` (confirmed: 4 simultaneous reservations of the
same item → 1 success, 3 × `cannot_acquire_lock`). Design the flow and the client for a retry.

---

## 🧩 Pattern — claim units safely

```typescript
function reserveUnits(unitIds: string[], orderId: string): void {
  const keys = [...unitIds].sort().map((id) => `<plugin>:unit:${id}`); // sorted → no deadlocks
  const acquired: string[] = [];
  try {
    for (const key of keys) {
      glyvio_core.lockService.acquireLock(key); // throws cannot_acquire_lock if busy
      acquired.push(key);
    }
    // re-validate AFTER acquiring: another request may have reserved before you got the lock
    const units = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<UnitEntity>>(glyvio_structure.AllEntities.<unitCamel>)
      .addFilterIN(glyvio_structure.AllEntities.<unitCamel>.id, unitIds)
      .findAll();
    // ... check availability, then save the reservation
  } finally {
    for (const key of acquired.reverse()) {
      glyvio_core.lockService.releaseLock(key);
    }
  }
}
```

On the server the `QueryBuilder` is synchronous (`find()`, `findAll()`, `findFirst()` return values,
not promises), and so are `entityService` saves.

---

## 🚫 Rules

1. One key per resource unit, namespaced (`<plugin>:<resource>:<id>`); acquire in sorted order.
2. Re-check the state after acquiring; release in `finally` (only what you acquired).
3. Do **not** catch `cannot_acquire_lock` and return success: inside a request the platform has
   already marked the transaction for rollback — swallowing it turns into
   `500 UnexpectedRollbackException` and hides the reason. Let it propagate and document
   `cannot_acquire_lock` as "retry" in your API (and show "tente novamente" in the app).
4. Keep the locked section short (no external HTTP calls inside it).
5. Known open point: the lock is released in `finally`, before the transaction commits; a request
   landing exactly in that window could still read pre-commit state. Add a unique constraint or a
   re-validation on save when double booking would be critical.

---

## ✅ Completion Checklist

- [ ] Sorted, namespaced, per-unit keys; release in `finally`.
- [ ] Re-validation after acquiring.
- [ ] `cannot_acquire_lock` propagated and handled as retry by the caller.
- [ ] Concurrency tested (parallel requests) with `fork-company-script` or a staging environment.
