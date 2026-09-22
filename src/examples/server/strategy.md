# Example: Strategy — Dynamically Resolvable Algorithms

This example demonstrates how to create and execute a **strategy** in Glyvio. The Strategy pattern is ideal for defining a family of algorithms or execution routines, encapsulating each one, and making them interchangeable at runtime based on an identifier.

Common use cases include custom tax calculators, payment integration adapters, shipping rate calculators, and specific business formatting routines.

---

## What `@Strategy` Does

The `@glyvio_core.Strategy` decorator registers a class in the engine's central strategy registry under a unique string identifier.

Key characteristics:

- **Dynamically Resolvable** — code can look up and execute a strategy by its ID at runtime without knowing the concrete class.
- **Strictly Typed** — strategies define exact input (`T`) and output (`R`) types, ensuring compile-time type safety.
- **Encapsulated execution** — each strategy executes its logic inside an isolated class handler.
- **Global runner** — strategies are invoked via `glyvio_core.strategyService.executeStrategy(id, args)`.

---

## Implementing `SimpleStrategy`

Extend `glyvio_core.SimpleStrategy<T, R>` and implement the `execute` method. Decorate the class with `@glyvio_core.Strategy`.

```typescript
@glyvio_core.Strategy({
  id: 'hello_strategy', // Unique ID within the plugin
})
export class HelloStrategy extends glyvio_core.SimpleStrategy<string, string> {
  execute(name: string): string {
    return `Hello, ${name}!`;
  }
}
```

To invoke this strategy:

```typescript
const greeting = glyvio_core.strategyService.executeStrategy<string, string>('hello_strategy', 'Alice');
console.log(greeting); // "Hello, Alice!"
```

---

## Real-World Use Case: Dynamic Shipping Rate Calculator

### Scenario

A business needs to calculate shipping rates based on the target country. Instead of writing a complex switch-case or if-else block, we define individual strategies for different countries and call them dynamically.

### File

Create a new file in your plugin, e.g. `src/strategies/shipping_strategies.ts`.

```typescript
export interface ShippingInput {
  weightInGrams: number;
  baseCost: number;
}

/**
 * Standard shipping strategy for domestic (US) deliveries.
 */
@glyvio_core.Strategy({
  id: 'shipping_rate_US',
})
export class USShippingStrategy extends glyvio_core.SimpleStrategy<ShippingInput, number> {
  execute(args: ShippingInput): number {
    // US Domestic rates: Base cost + $0.05 per gram
    return args.baseCost + args.weightInGrams * 0.05;
  }
}

/**
 * Express shipping strategy for international deliveries.
 */
@glyvio_core.Strategy({
  id: 'shipping_rate_INTL',
})
export class IntlShippingStrategy extends glyvio_core.SimpleStrategy<ShippingInput, number> {
  execute(args: ShippingInput): number {
    // International rates: Base cost + 20% international fee + $0.15 per gram
    return args.baseCost * 1.2 + args.weightInGrams * 0.15;
  }
}
```

### Execution Service Example

You can look up the correct strategy ID dynamically based on user metadata or configuration, then call it:

```typescript
export function computeShipping(countryCode: string, weight: number, base: number): number {
  const strategyId = countryCode === 'US' ? 'shipping_rate_US' : 'shipping_rate_INTL';

  // Resolve and run the strategy
  return glyvio_core.strategyService.executeStrategy<ShippingInput, number>(strategyId, {
    weightInGrams: weight,
    baseCost: base,
  });
}
```

---

## Key Architectural Points

| Concept                            | Detail                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `@glyvio_core.Strategy`            | Registers the class in the strategy registry under a unique `id`.                                                     |
| `glyvio_core.SimpleStrategy<T, R>` | Base class to extend. `T` is the input parameter type; `R` is the return value type. Implement `execute(args: T): R`. |
| `glyvio_core.strategyService`      | The global service wrapper used to execute strategies via `.executeStrategy<T, R>(id, args)`.                         |
| Error behavior                     | Executing a non-existent strategy ID throws a `GlyvioError` exception.                                                |
| No imports                         | All symbols (`glyvio_core`, `glyvio_entity`, etc.) are globally injected by the engine and must not be imported.      |
