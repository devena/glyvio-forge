---
name: create-strategy
description: 'Generates a custom class extending SimpleStrategy to run a dynamically resolvable custom algorithm or execution routine.'
---

# Agent Skill: Create Strategy in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side dynamic strategy (`SimpleStrategy`) to encapsulate custom calculations or algorithms.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_strategy",
  "description": "Generates a custom class extending SimpleStrategy to run a dynamically resolvable custom algorithm or execution routine.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "strategyId": {
        "type": "string",
        "description": "Unique identifier for this strategy (e.g., tax_calculator_us)"
      },
      "className": {
        "type": "string",
        "description": "The class name of the strategy (e.g., USTaxCalculatorStrategy)"
      },
      "inputTypeName": {
        "type": "string",
        "description": "The TypeScript type or interface name for the input arguments"
      },
      "outputTypeName": {
        "type": "string",
        "description": "The TypeScript type name for the output results"
      }
    },
    "required": ["strategyId", "className", "inputTypeName", "outputTypeName"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Strategy ID** (e.g., `tax_calculator_us`): Unique string identifier registered in the strategy engine.
2. **Strategy Class Name** (e.g., `USTaxCalculatorStrategy`): Name of the class representing the strategy.
3. **Input Arguments Type** (e.g., `{ amount: number }`): Type/interface signature for the input parameter.
4. **Output Result Type** (e.g., `number`): Type signature of the returned value.
5. **Business Logic / Algorithm**: The actual computation to perform inside the strategy.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `glyvio_core.SimpleStrategy`, NOT `import { SimpleStrategy } ...`
2. **Strategy Registry**: Do NOT manually insert strategies into the registry; decorate the class with `@glyvio_core.Strategy({ id: '<strategyId>' })` to automatically register it during initialization.
3. **Inheritance**: Always extend `glyvio_core.SimpleStrategy<T, R>` where `T` is the input arguments type and `R` is the output return type.
4. **Type Safety**: Provide explicit, strict typings for inputs and outputs in both the class declaration and caller invocation.
5. **Strategy is only for queued/deferred operations with deduplication — not for simple synchronous logic**: Use `Strategy` + `pushToQueue` only when you need to debounce multiple rapid saves of the same entity (e.g., recalculating a total when many child rows are saved at once, using `executionFlagService` to prevent duplicate runs). For a simple synchronous side-effect that must run once per save — such as copying a field value, querying a related record, or calling `saveInput` on the same or another entity — execute the logic directly in `handleBefore` or `handleAfter` without creating a Strategy. Introducing a Strategy for simple synchronous operations adds unnecessary complexity with no benefit.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Strategy File

Create a new file `src/strategies/<strategy_id_snake_case>.ts` in the server project of the plugin, writing the implementation based on the blueprint below.

### Step 2: Register/Load the Strategy

Ensure the strategy file is imported in the plugin's server entrypoint (typically `src/index.ts` or `src/behavior_listeners/index.ts`) so that the decorator executes during initialization:

```typescript
import './strategies/<strategy_id_snake_case>';
```

### Step 3: Build & Validate

Compile the codebase using standard workspace scripts (such as `pnpm run build` or `pnpm tsc --noEmit`) to verify that the types resolve correctly.

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
/**
 * Input arguments for `<StrategyId>`.
 */
export interface <InputTypeName> {
  // Define custom input properties
}

/**
 * Custom strategy implementation for `<StrategyId>`.
 */
@glyvio_core.Strategy({
  id: '<StrategyId>',
})
export class <ClassName> extends glyvio_core.SimpleStrategy<<InputTypeName>, <OutputTypeName>> {

  execute(args: <InputTypeName>): <OutputTypeName> {
    // 💡 IMPLEMENT BUSINESS LOGIC HERE
    // Return computed value of type <OutputTypeName>
  }
}
```
