---
name: create-table-entity-modal-interceptor
description: "Generates a custom class extending TableEntityModalInterceptor to change an existing table-based entity picker you do not own — table rows, selection chips, the text and widget shown for the selected record, and the search query — and registers it."
---
<!-- Generated from src/skills/create-table-entity-modal-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Table Entity Modal Interceptor

`glyvio_core.TableEntityModalInterceptor<S, E>` targets a `TableEntityModal` (the table-rendered
entity picker of `create-table-entity-modal`; for the list-rendered picker use
`create-entity-modal-interceptor`).

| Hook | Use |
| --- | --- |
| `getDesign(state, design: TableEntityModalDesign)` | columns, app bar |
| `getDesignForRow(state, item, design: TableLayoutRowDesign)` | add cells / restyle a row |
| `getDesignForChip(item, design: ChipDesign)` | the chip of a selected record |
| `getDesignForSelectText(state, item, text): string \| undefined` | **return** the text shown in the field for the selection |
| `getDesignForSelectChild(state, item, design: WidgetDesign): WidgetDesign` | **return** the widget shown for the selection |
| `populateQueryBuilder(state, queryBuilder)` | restrict which records can be picked |

Plus the common hooks (`~/.claude/references/views_and_interceptors.md` §3).

---

## 🚫 Rules

1. Globals only; no `any`; generics `<State, Entity>`.
2. `getDesignForSelectText` / `getDesignForSelectChild` must return a value (the received one when unchanged).
3. Restricting the query also restricts what the autocomplete finds — make sure the user can still
   find the records they legitimately need.
4. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
export class <Name>Interceptor extends glyvio_core.TableEntityModalInterceptor<<TargetState>, glyvio_entity.<Entity>> {
  getListenerId(): string {
    return '<plugin>.<name>_table_entity_modal_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesignForSelectText(state: <TargetState>, item: glyvio_entity.<Entity>, text: string | undefined): string | undefined {
    return item.<codeField> ? `${item.<codeField>} · ${text ?? ''}` : text;
  }

  populateQueryBuilder(state: <TargetState>, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>): void {
    queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityCamel>.deleted, false);
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Generics correct; returning hooks return a value.
- [ ] Registered; `pnpm build` clean; picker checked with `test-plugin-browser`.
