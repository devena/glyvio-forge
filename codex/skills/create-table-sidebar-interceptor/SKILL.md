---
name: create-table-sidebar-interceptor
description: "Generates a custom class extending SimpleTableSidebarInterceptor to change an existing table sidebar you do not own (e.g. the Glyvio tasks table sidebar) — add or hide columns and cells, restyle rows and group headers, restrict or extend its query — and registers it."
---
<!-- Generated from src/skills/create-table-sidebar-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Table Sidebar Interceptor

Hooks of `glyvio_core.SimpleTableSidebarInterceptor<S, E, GS>`:

| Hook | Use |
| --- | --- |
| `getDesign(state, design: SimpleTableSidebarDesign)` | add/remove/reorder `design.columns`, app-bar buttons |
| `getDesignForRow(state, item, design: TableLayoutRowDesign)` | add the cells of your new columns (`design.cells.push(...)`), restyle cells |
| `getDesignForGroup(state, group, design: TableLayoutGroupDesign)` | restyle a group header |
| `populateQueryBuilder(state, queryBuilder)` | extra restrictions, joins your cells need |
| `populateJeannieContext(state, context)` | assistant context |

Plus the common hooks (`codex/references/views_and_interceptors.md` §3). Quick filters are not
interceptable; add your own filter as an app-bar toggle handled in `onEvent`.

When the target ships its own interceptor base (e.g. `glyvio_core.TaskTableSidebarInterceptor`, which
already fixes the generics and `getListenerRoute()`), **extend that one**.

---

## 🚫 Rules

1. Globals only; no `any`; correct generics `<State, Entity, GroupState>`.
2. A new column needs both: a `TableLayoutColumnDesign` in `getDesign` and a matching
   `TableLayoutCellDesign` (same `columnName`) in `getDesignForRow`. Namespace the column name (`'<plugin>_score'`).
3. Data your cell shows must be in the row: add the join in `populateQueryBuilder`
   (`addLeftJoinEntity(...)`) and read it with `$S{item.<relation>.<field>}`.
4. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
export class <Name>Interceptor extends glyvio_core.SimpleTableSidebarInterceptor<<TargetState>, glyvio_entity.<Entity>, <TargetGroupState>> {
  getListenerId(): string {
    return '<plugin>.<name>_table_sidebar_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesign(state: <TargetState>, design: glyvio_core.SimpleTableSidebarDesign): void {
    design.columns ??= [];
    design.columns.push(
      new glyvio_core.TableLayoutColumnDesign({
        key: '<plugin>_extra.column',
        columnName: '<plugin>_extra',
        width: 140,
        padding: '4',
        child: new glyvio_core.StringTextDesign({ value: '$T{<plugin>_extra_column}' }),
      }),
    );
  }

  getDesignForRow(state: <TargetState>, item: glyvio_entity.<Entity>, design: glyvio_core.TableLayoutRowDesign): void {
    design.cells ??= [];
    design.cells.push(
      new glyvio_core.TableLayoutCellDesign({
        key: '<plugin>_extra.cell',
        columnName: '<plugin>_extra',
        child: new glyvio_core.StringTextDesign({ value: '$S{item.<extraField>}' }),
      }),
    );
  }

  populateQueryBuilder(state: <TargetState>, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>): void {
    // e.g. queryBuilder.addLeftJoinEntity(glyvio_structure.AllEntities.<entityCamel>.<relation>);
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Specialized base used when the target provides one; generics correct.
- [ ] Each new column has a matching cell; data joined in the query.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; checked with `test-plugin-browser`.
