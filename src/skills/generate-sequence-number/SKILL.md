---
name: generate-sequence-number
description: "Generates human-readable sequential numbers (order 0001, invoice numbers, protocol codes) with database sequences: declares the sequence in manifest.json and reads the next value with glyvio_core.sequenceService.nextval on the server (synchronous) or the app (async) — never in the environment layer, where it is not implemented."
---
# Agent Skill: Sequential Numbers

| Layer | Call | Note |
| --- | --- | --- |
| Server (`plugin/server`) | `glyvio_core.sequenceService.nextval('<sequence>')` → `number` (synchronous) | preferred: runs inside the save transaction (e.g. in a `create-before-interceptor`) |
| App (`plugin/app`) | `await glyvio_core.sequenceService.nextval('<sequence>')` → `Promise<number>` | only for previews; numbers taken and not saved leave gaps |
| Environment | — | **not implemented: always returns `0`**. Never use it there; ask the server. |

---

## 📋 Steps

1. Declare the sequence (and, if wanted, bind it to the field) in `manifest.json` → `dbVersions`
   (skill `modify-manifest`), then run `run_helper.sh`.
2. Prefer filling the number on the server, in a `BeforeInterceptor` of the entity, only when the
   record is new and the field is empty — so every creation path (app, API, sync, import) gets a number.
3. Format for display separately (`String(n).padStart(6, '0')`, prefixes) — keep the raw number in an integer column when you need to sort by it.

---

## 🚫 Rules

1. Sequences never roll back: a failed save leaves a gap. If the business requires no gaps, tell the user — a sequence cannot guarantee it.
2. Do not compute "max + 1" with a query: it duplicates under concurrency.
3. Never call `nextval` in the environment layer.

---

## 📄 Code Blueprint (server, before-save)

```typescript
@glyvio_core.BeforeInterceptor({ entity: glyvio_entity.<EntityName>, id: '<plugin>.<entity>.number' })
export class <EntityName>NumberInterceptor extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.<EntityName>> {
  handleBefore(
    value: glyvio_core.BeforeInterceptorValue<glyvio_entity.<EntityName>>,
    context: glyvio_core.BeforeInterceptorContext<glyvio_entity.<EntityName>>,
  ): void {
    if (!value.<numberField>) {
      value.<numberField> = `${glyvio_core.sequenceService.nextval('<sequence_name>')}`;
    }
  }
}
```

Adapt "is new" detection to what `BeforeInterceptorContext` exposes in your `.d.ts` (see
`create-before-interceptor`), and assign a number type if the column is numeric.

---

## ✅ Completion Checklist

- [ ] Sequence declared in the manifest; `run_helper.sh` run.
- [ ] Number assigned on the server, only for new records with an empty field.
- [ ] No environment-layer `nextval`; gaps explained when relevant.
