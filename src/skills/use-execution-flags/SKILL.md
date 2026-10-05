---
name: use-execution-flags
description: "Coordinates server rules inside one request with glyvio_core.executionFlagService (add/contains/remove): let a trusted flow pass a guard interceptor, stop an automatic interceptor from firing for saves your code already handles, and prevent re-entrant or duplicate queued work."
---
# Agent Skill: Execution Flags

`glyvio_core.executionFlagService` (server layer) holds string flags for the **current request /
transaction**. Every interceptor, strategy and save that runs inside that request sees them; they do
not leak to other requests.

| Method | |
| --- | --- |
| `add(flag): boolean` | set |
| `contains(flag): boolean` | check |
| `remove(flag): boolean` | clear (returns `false` if it was not set) |

---

## 🧩 Patterns

**1. Allow-flag — let a trusted flow pass a guard.** A `BeforeInterceptor` forbids users from
changing a field directly; your own server flow must change it.

```typescript
// the guard
@glyvio_core.BeforeInterceptor({ entity: glyvio_entity.<EntityName>, id: '<plugin>.<entity>.guard_status' })
export class <EntityName>GuardStatusInterceptor extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.<EntityName>> {
  static allowFlag(id: string): string {
    return `<plugin>:<entity>:allow_status:${id}`;
  }

  handleBefore(
    value: glyvio_core.BeforeInterceptorValue<glyvio_entity.<EntityName>>,
    _context: glyvio_core.BeforeInterceptorContext<glyvio_entity.<EntityName>>,
  ): void {
    if (value.isModified(glyvio_structure.AllEntities.<entityCamel>.<statusField>) && !glyvio_core.executionFlagService.contains(<EntityName>GuardStatusInterceptor.allowFlag(value.id!))) {
      throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_statusChangeNotAllowed}' });
    }
  }
}

// the trusted flow
function changeStatus(id: string, statusId: string): void {
  const flag = <EntityName>GuardStatusInterceptor.allowFlag(id);
  glyvio_core.executionFlagService.add(flag);
  try {
    glyvio_core.entityService.saveList([
      { structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(), id, input: { <status_column>: statusId } },
    ]);
  } finally {
    glyvio_core.executionFlagService.remove(flag);
  }
}
```

**2. Skip-flag — suppress an automatic reaction.** An `AfterInterceptor` creates a movement on
every save; a batch flow creates the movements itself and sets the skip flag around its `saveList`
(same `add` / `try` / `finally remove` shape; the interceptor returns early when the flag is set).

**3. Dedupe / re-entrancy — queue work once per record per request.**

```typescript
function enqueueOnce(recordId: string): void {
  const flag = `<plugin>:recalc:${recordId}`;
  if (glyvio_core.executionFlagService.contains(flag)) {
    return;
  }
  glyvio_core.executionFlagService.add(flag);
  // glyvio_core.getCurrentQueue().addOrReplace({ ... })  — see schedule-queued-operation
}
```

The queued job removes the flag when it finishes if the same request may legitimately enqueue again.

---

## 🚫 Rules

1. **Namespace and scope flags**: `<plugin>:<purpose>:<recordId>` — a flag without a record id
   opens the guard for every record in the request.
2. Always `remove` in `finally` for allow/skip flags; otherwise a later save in the same request
   silently bypasses the rule.
3. Flags are for coordinating **your own** rules. Never use them as authorization for user input:
   anything reachable from a controller must validate permissions itself.
4. Expose flag names through a static method on the interceptor that checks them, so callers
   cannot misspell them.

---

## ✅ Completion Checklist

- [ ] Flag names namespaced and record-scoped, built by a static helper.
- [ ] `add` → work → `remove` in `finally`.
- [ ] Guards still block normal user saves (tested with and without the flow).
