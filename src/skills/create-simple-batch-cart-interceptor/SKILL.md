---
name: create-simple-batch-cart-interceptor
description: "Generates a custom class extending SimpleBatchCartInterceptor to change an existing spreadsheet-style batch cart you do not own (e.g. the Glyvio task batch cart) — extra columns and cells, spreadsheet import columns, values copied from a spreadsheet line, extra entities saved with each row, item add/remove/update side effects and row status — and registers it."
---
# Agent Skill: Create a Batch Cart Interceptor

`glyvio_core.SimpleBatchCartInterceptor<S, I>` targets a `SimpleBatchCart` (see
`create-simple-batch-cart`). Always pass **both** generics (state and DTO item) and never use
`SimpleCartListener` for a batch cart — it compiles but has none of the batch hooks.

| Hook | Use |
| --- | --- |
| `getDesign(state, design: SimpleBatchCartDesign)` | app bar, buttons, cart-level options |
| `getDtoLayout(state, dto): SimpleBatchCartDtoLayoutItem[]` | **return** the columns (`{ columnName, columnLabel, columnDesign }`) — add yours |
| `getDesignForRow(state, item, design: TableLayoutRowDesign)` | restyle a row |
| `getSpreadsheetLayout(state, layout): { spreadsheetName, dtoName }[]` | **return** the spreadsheet header ↔ DTO field map — add yours |
| `getDtoSpreadsheetFromLine(state, cache, item, columns, line)` | copy values of an imported line into the DTO (`cache` = `CacheController` for lookups) |
| `getEntitiesFromDto(state, item, queue)` | push extra entities to save with the row (`queue: EntityServiceQueue`) |
| `onAddItemToCart(state, entityName, entityId, data, addedEntity): Promise<I>` | adjust and **return** the added DTO |
| `onRemoveItemFromCart(...)`, `onUpdateItem(key, state, old, new)` | side effects |
| `getStatusItemOfCart(state, entityName, entityId, data)` | return a `CartItemStatus` to override the status shown for an item (or `undefined`) |
| `populateJeannieContext(state, context)` | assistant context |

Prefer the target's own interceptor base when it exists (e.g. `glyvio_core.TaskBatchCartInterceptor`).

---

## 🚫 Rules

1. Globals only; no `any` beyond the framework's own `data: any` parameters.
2. DTO fields you add: declare an extended DTO interface (`I & { <plugin>_x?: string }`) and use
   namespaced names. A column's `columnDesign` binds to the DTO field.
3. `getDtoLayout` and `getSpreadsheetLayout` must **return** the list (mutate + return).
4. Entities pushed in `getEntitiesFromDto` need `userGroupId` (inherit the row's owner group).
5. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
type <Name>Dto = <TargetDto> & { <plugin>_note?: string };

export class <Name>Interceptor extends glyvio_core.SimpleBatchCartInterceptor<<TargetState>, <Name>Dto> {
  getListenerId(): string {
    return '<plugin>.<name>_batch_cart_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDtoLayout(state: <TargetState>, dto: glyvio_core.SimpleBatchCartDtoLayoutItem[]): glyvio_core.SimpleBatchCartDtoLayoutItem[] {
    dto.push({
      columnName: '<plugin>_note',
      columnLabel: '$T{<plugin>_note}',
      columnDesign: new glyvio_core.StringTextfieldDesign({ name: 'item.<plugin>_note' }),
    });
    return dto;
  }

  getSpreadsheetLayout(
    state: <TargetState>,
    layout: { spreadsheetName: string; dtoName: string }[],
  ): { spreadsheetName: string; dtoName: string }[] {
    layout.push({ spreadsheetName: 'Observação', dtoName: '<plugin>_note' });
    return layout;
  }

  async getDtoSpreadsheetFromLine(
    state: <TargetState>,
    cache: glyvio_core.CacheController,
    item: <Name>Dto,
    columns: string[],
    line: { [key: string]: unknown },
  ): Promise<void> {
    if (columns.includes('Observação')) {
      item.<plugin>_note = `${line['Observação'] ?? ''}`;
    }
  }

  async getEntitiesFromDto(state: <TargetState>, item: <Name>Dto, queue: glyvio_core.EntityServiceQueue): Promise<void> {
    // push extra rows to save with this item, each with its userGroupId
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

Check in the target `.d.ts` how a `columnDesign` binds to the DTO (the target cart's own
`getDtoLayout`, or the `generateSimple*DtoLayout` helpers of `SimpleBatchCart`, show the exact `name` path).

---

## ✅ Completion Checklist

- [ ] Both generics passed; batch interceptor (not `SimpleCartListener`).
- [ ] Layout hooks return the list; new DTO fields namespaced.
- [ ] Extra entities scoped with `userGroupId`.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; import + save checked with `test-plugin-browser`.
