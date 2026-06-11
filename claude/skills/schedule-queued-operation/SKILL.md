---
name: schedule-queued-operation
description: 'Guides the agent to schedule a deferred, deduplicated operation using the transaction-scoped QueueList.'
---

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
3. **Deduplication Validation**: Use `.getById(id)` to check if a task is already scheduled.
   - To ignore subsequent duplicate attempts: only call `.add()` if `.getById(id)` returns `undefined`.
   - To keep the latest state: call `.addOrReplace()`.
4. **Type Safety**: Cast or declare arguments strictly according to the payload interface definition.

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
