---
name: create-custom-interceptor
description: 'Generates a custom class extending SimpleInterceptor to run business logic in response to a custom eventName (often triggered from the QueueList).'
---

# Agent Skill: Create Custom Interceptor in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side custom simple interceptor (`SimpleInterceptor`) that listens to custom event names, typically triggered deferred via queued operations.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_custom_interceptor",
  "description": "Generates a custom class extending SimpleInterceptor to run business logic in response to a custom eventName (often triggered from the QueueList).",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "eventName": {
        "type": "string",
        "description": "The custom event identifier this interceptor listens to (e.g., product_color_reset)"
      },
      "listenerId": {
        "type": "string",
        "description": "Unique identifier for this interceptor instance (e.g., notify_color_reset)"
      },
      "argumentsTypeName": {
        "type": "string",
        "description": "TypeScript interface or type for the event arguments"
      },
      "priority": {
        "type": "integer",
        "description": "Execution priority order (lower runs first, defaults to 50)"
      }
    },
    "required": ["eventName", "listenerId", "argumentsTypeName"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Event Name** (e.g., `when_color_is_reset`): Custom string identifier identifying the event to listen to.
2. **Listener Unique ID** (e.g., `tag_color_reset_logger`): Unique identifier for this decorated class.
3. **Execution Priority** (e.g., `10`): Priority order weight (lower runs first, default `50`).
4. **Arguments Payload Structure**: TypeScript interface/type defining the event data payload properties.
5. **Business Logic / Action**: The logic to execute when the event fires (e.g., "log details", "send a notification").

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `glyvio_core.SimpleInterceptor`, NOT `import { SimpleInterceptor } ...`
2. **Registry Mapping**: Do NOT manually register custom interceptors. Decorate the class with `@glyvio_core.Interceptor({ id: '<listenerId>', eventName: '<eventName>' })` to automatically register it during initialization.
3. **Inheritance**: Always extend `glyvio_core.SimpleInterceptor<T>` where `T` is the arguments payload type.
4. **Execution Scope**: Understand that when scheduled via the `QueueList` (`getCurrentQueue()`), custom interceptors execute deferred but **always within the current database transaction**.
5. **Type Safety**: Implement exact typing on arguments in `execute(args: T)`.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Interceptor File

Create a new file `src/interceptors/<listener_id_snake_case>.ts` in the server project of the plugin, writing the implementation based on the blueprint below.

### Step 2: Register/Load the Interceptor

Ensure the interceptor file is imported in the plugin's server entrypoint (typically `src/index.ts` or `src/behavior_listeners/index.ts`) so that the decorator executes during initialization:

```typescript
import './interceptors/<listener_id_snake_case>';
```

### Step 3: Build & Validate

Compile the codebase using standard workspace scripts (such as `pnpm run build` or `pnpm tsc --noEmit`) to verify that the types resolve correctly.

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
/**
 * Event arguments payload for `<EventName>`.
 */
export interface <ArgumentsTypeName> {
  // Define custom arguments properties
}

/**
 * Custom interceptor listening to `<EventName>` events.
 */
@glyvio_core.Interceptor({
  id: '<ListenerId>',
  eventName: '<EventName>',
  priority: <PriorityValue_or_50>,
})
export class <InterceptorClassName> extends glyvio_core.SimpleInterceptor<<ArgumentsTypeName>> {

  execute(args: <ArgumentsTypeName>): void {
    // 💡 IMPLEMENT BUSINESS LOGIC HERE
  }
}
```
