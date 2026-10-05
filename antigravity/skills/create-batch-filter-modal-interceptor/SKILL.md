---
name: create-batch-filter-modal-interceptor
description: "Generates a custom class extending SimpleBatchFilterEditModalInterceptor to change an existing batch filter modal you do not own (e.g. the Glyvio task filter) — add filter fields to its form and apply them to the query that selects the records — and registers it."
---
<!-- Generated from src/skills/create-batch-filter-modal-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Batch Filter Modal Interceptor

A batch filter modal (`SimpleBatchFilterEditModal`, see `create-batch-filter-modal`) lets the user
fill a filter form and returns the ids of the matching records. Its interceptor
(`glyvio_core.SimpleBatchFilterEditModalInterceptor<S, E>`) extends the edit-modal interceptor:

| Hook | Use |
| --- | --- |
| `getDesign(state, design: SimpleEditModalDesign)` | add filter fields to the form (find the form layout with `design.findWidgetByKey`) |
| `populateQueryBuilder(state, queryBuilder)` | apply your fields to the query that selects the records |
| `onEntityUpdate(state, structureName, objectId)` | react to listened record changes |
| `populateJeannieContext(state, context)` | assistant context |

Plus the common hooks (`antigravity/rules/references/views_and_interceptors.md` §3). Prefer the target's own
interceptor base when it exists (e.g. `glyvio_core.TaskFilterModalInterceptor`).

---

## 🚫 Rules

1. Globals only; no `any`; generics `<State, Entity>`.
2. Your filter values live in an extended state interface with namespaced fields
   (`state.<plugin>_onlyUrgent`); bind the new fields to them.
3. Every field you add **must** be applied in `populateQueryBuilder` — otherwise the user filters
   and nothing changes.
4. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
interface <Target>StateWithFilter extends <TargetState> {
  <plugin>_text?: string;
}

export class <Name>Interceptor extends glyvio_core.SimpleBatchFilterEditModalInterceptor<<Target>StateWithFilter, glyvio_entity.<Entity>> {
  getListenerId(): string {
    return '<plugin>.<name>_batch_filter_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesign(state: <Target>StateWithFilter, design: glyvio_core.SimpleEditModalDesign): void {
    design.sectionsDesign ??= [];
    design.sectionsDesign.push(
      new glyvio_core.FormSectionDesign({
        key: '<plugin>.filter_section',
        childDesign: new glyvio_core.FormLayoutDesign({
          columnSize: 280,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: '<plugin>.text.formField',
              columns: 1,
              child: new glyvio_core.StringTextfieldDesign({ name: 'state.<plugin>_text', label: '$T{<plugin>_filter_text}' }),
            }),
          ],
        }),
      }),
    );
  }

  populateQueryBuilder(state: <Target>StateWithFilter, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>): void {
    if (state.<plugin>_text) {
      queryBuilder.addFilterILike(glyvio_structure.AllEntities.<entityCamel>.<textField>, state.<plugin>_text);
    }
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Every added field is applied in `populateQueryBuilder`.
- [ ] Namespaced state fields; specialized base used when available.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; filter checked with `test-plugin-browser`.
