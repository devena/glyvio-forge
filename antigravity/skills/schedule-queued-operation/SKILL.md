---
name: schedule-queued-operation
description: "Guides the agent to schedule a deferred, deduplicated operation using the transaction-scoped QueueList."
---
<!-- Generated from src/skills/schedule-queued-operation/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Schedule Queued Operation in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to schedule and deduplicate deferred operations (`QueuedOperation`) inside server-side interceptors.

---

## 🎯 Skill Metadata

```json
{
  "name": "schedule_queued_operation",
  "description": "Guides the agent to schedule a deferred, deduplicated operation using the transaction-scoped QueueList.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "eventName": {
        "type": "string",
        "description": "The identifier of the deferred runner/event to invoke (e.g., notify_stock_change)"
      },
      "operationType": {
        "type": "string",
        "enum": ["strategy", "interceptor"],
        "description": "The registry category of the target runner"
      },
      "argumentsType": {
        "type": "string",
        "description": "TypeScript interface or type for the payload arguments"
      }
    },
    "required": ["eventName", "operationType", "argumentsType"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Event Name** (e.g., `process_stock_notification`): Event name identifying the runner to execute deferred.
2. **Operation Category** (e.g., `interceptor`): Registry type (`strategy` or `interceptor`).
3. **Arguments Structure** (e.g., `{ productId: string, qty: number }`): Signature of payload arguments.
4. **Deduplication ID Formula**: The deterministic ID format (e.g., `` `stock_change_${value.id}` ``).
5. **Deduplication Logic**: Whether to ignore duplicates (first-in stays) or overwrite them (latest-in replaces).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Queue Helpers**: Resolve the queue list instance using the global `glyvio_core.getCurrentQueue()` helper. Do NOT import `getCurrentQueue` or `QueueList`.
2. **Deterministic ID Rule**: Always use a unique, deterministic ID based on the entity identifier to avoid duplicate operations in the queue.
3. **Deduplication Validation**: Build the id with a static helper (`${eventName}-${recordId}`) so the push and the strategy use the same string. The pattern used across the plugins is an `executionFlagService` guard plus `addOrReplace` (see the blueprint):
   - `executionFlagService.contains(id)` skips the push when this target is already queued in the request — the cheapest check for interceptors that fire once per child row.
   - `addOrReplace()` keeps a single queued operation per id.
   - Flags are cleared automatically at the end of the request. The strategy may `remove` its flag when it finishes, so that a later change in the same request can enqueue it again.
   - `.getById(id)` is still available when you need to read or merge the queued arguments.
4. **Type Safety**: Cast or declare arguments strictly according to the payload interface definition.

---

## 🧭 When to Use

The main case is a **child entity interceptor that recalculates its parent** (offer/sale items → summary, campaign clients → counters, invoice items → stock): enqueue one operation per parent id instead of querying siblings and saving the parent inside `handleAfter`, which costs N² reads for a `saveList` of N children. When a child can move to another parent, enqueue both `value.parentId` and `context.savedValue?.parentId`. Rationale and checklist: section 2.2 of `antigravity/rules/architecture_rules.md`.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Implement the Interceptor/Trigger

Within your server-side hook or interceptor (e.g., extending `SimpleSyncInterceptor` or `SimpleBeforeInterceptor`), retrieve the queue:

```typescript
const queue = glyvio_core.getCurrentQueue();
```

### Step 2: Define and Validate the Deterministic ID

Construct the unique ID and use the deduplication checks to queue the operation:

```typescript
const opId = `evt_name_entity_${value.id}`;
if (!queue.getById(opId)) {
  queue.add({
    id: opId,
    type: '<operationType>',
    eventName: '<eventName>',
    arguments: { ... },
  });
}
```

---

## 📄 Code Blueprint (Template)

Strategy-backed push used by the plugins (e.g. `GenerateSummaryForOfferStrategy` in `glyvio-plugin-mobgran-core`):

```typescript
export abstract class RecalculateParentStrategy extends glyvio_core.SimpleStrategy<{ parentId: string }, void> {
  static eventName = 'queue:recalculate_parent';

  static queueId(parentId: string): string {
    return `${RecalculateParentStrategy.eventName}-${parentId}`;
  }

  static pushToQueue(args: { parentId: string }) {
    const id = RecalculateParentStrategy.queueId(args.parentId);
    if (glyvio_core.executionFlagService.contains(id)) return;
    glyvio_core.executionFlagService.add(id);
    glyvio_core.getCurrentQueue().addOrReplace({
      type: 'strategy',
      id,
      eventName: RecalculateParentStrategy.eventName,
      arguments: args,
    });
  }
}

// In the child's AfterInterceptor:
const parentIds = new Set([value.parentId, context.savedValue?.parentId]);
for (const parentId of parentIds) {
  if (parentId) RecalculateParentStrategy.pushToQueue({ parentId });
}
```

Generic queue usage:

```typescript
// Retrieve transaction-scoped queue
const queue = glyvio_core.getCurrentQueue();

// Construct deterministic ID
const opId = `<EventName>_id_${value.id}`;

// 💡 OPTION A: Ignore subsequent updates (keep the first scheduled operation)
if (!queue.getById(opId)) {
  queue.add({
    id: opId,
    type: '<OperationType_strategy_or_interceptor>',
    eventName: '<EventName>',
    arguments: {
      // payload data
    },
  });
}

// 💡 OPTION B: Replace with the latest state
// const existing = queue.getById(opId);
// if (existing) {
//   existing.arguments.latestField = value.latestField;
//   queue.addOrReplace(existing);
// } else {
//   queue.add({ id: opId, type: '<OperationType>', eventName: '<EventName>', arguments: { ... } });
// }
```
