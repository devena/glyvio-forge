---
name: create-map-page-interceptor
description: "Generates a custom class extending SimpleMapPageInterceptor to change an existing map page you do not own — pin color/title/description, extra query restrictions or filters, search behavior, app bar and filter sidebar — and registers it."
---
# Agent Skill: Create a Map Page Interceptor

Hooks of `glyvio_core.SimpleMapPageInterceptor<S, E>` (each runs after the page's own step):

| Hook | Use |
| --- | --- |
| `getDesign(state, design: SimpleMapPageDesign)` | app bar, push filter fields to `design.filterSectionsDesign` |
| `getDesignForCell(state, item, design: SimpleMapCellDesign)` | mutate a pin: `title`, `description`, `colorTheme`, `latitude`, `longitude` |
| `populateQueryBuilder(state, queryBuilder)` | add restrictions/filters to every load (area filter still applies) |
| `populateMainFilter(state, filter: QueryBuilderFilter, text)` | extend the search filter (e.g. push to `filter.ors`) |
| `populateJeannieContext(state, context)` | extend the assistant context |

Plus the common view-interceptor hooks (`@@REFERENCES@@/views_and_interceptors.md` §3). The pin tap
(`onCellTap`) is not interceptable.

---

## 📥 Required Input Parameters

1. Target map route + state + entity type (from `@types`).
2. The change (table above).
3. Plugin namespace.

---

## 🚫 Rules

1. Globals only; no `any`; real state/entity types.
2. Query changes use the real `QueryBuilder` API (`addFilterOperator`, `addFilterILike`, `addFilterIN`,
   `addFilterBetween`, `addFilter(new glyvio_core.QueryBuilderFilter(...))`) — no `addSelect`/`filter()`.
3. Filters you add live in your own namespaced state fields (e.g. `state.filtersSidebar` is typed by
   the page; add a separate optional field to an extended state interface for yours).
4. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
interface <Target>StateWithFilter extends <TargetState> {
  <plugin>_onlyMine?: boolean;
}

export class <Name>Interceptor extends glyvio_core.SimpleMapPageInterceptor<<Target>StateWithFilter, glyvio_entity.<Entity>> {
  getListenerId(): string {
    return '<plugin>.<name>_map_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesign(state: <Target>StateWithFilter, design: glyvio_core.SimpleMapPageDesign): void {
    design.filterSectionsDesign?.push(
      glyvio_core.FilterSidebar.section('<plugin>.map_filters', '$T{<plugin>_map_filters}', [
        new glyvio_core.BooleanTextfieldDesign({ name: 'state.<plugin>_onlyMine', label: '$T{<plugin>_map_onlyMine}' }),
      ]),
    );
  }

  getDesignForCell(state: <Target>StateWithFilter, item: glyvio_entity.<Entity>, design: glyvio_core.SimpleMapCellDesign): void {
    design.colorTheme = item.deleted ? 'RED' : 'GREEN';
  }

  populateQueryBuilder(state: <Target>StateWithFilter, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>): void {
    if (state.<plugin>_onlyMine) {
      queryBuilder.addFilterOperator(glyvio_structure.AllEntities.<entityCamel>.createdBy, glyvio_core.session.user?.id);
    }
  }

  populateMainFilter(state: <Target>StateWithFilter, filter: glyvio_core.QueryBuilderFilter, text: string): void {
    filter.ors ??= [];
    filter.ors.push(
      new glyvio_core.QueryBuilderFilterILike({ field: glyvio_structure.AllEntities.<entityCamel>.<extraSearchField>, value: text }),
    );
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Correct generics `<State, Entity>`; `getListenerRoute()` returns the map route.
- [ ] Query additions use real `QueryBuilder` methods; search extended through `filter.ors`.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; pins checked with `test-plugin-browser`.
