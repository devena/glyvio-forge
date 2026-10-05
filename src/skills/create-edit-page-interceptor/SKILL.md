---
name: create-edit-page-interceptor
description: "Generates a custom class extending SimpleEditPageInterceptor to change an existing full-screen form page you do not own (a plugin's edit page or a Glyvio settings page such as the profile or plugin manager) — add fields, sections, tabs or action-bar buttons, react to record updates, extend its filters — and registers it."
---
# Agent Skill: Create an Edit Page Interceptor

Hooks of `glyvio_core.SimpleEditPageInterceptor<S>` (each runs after the page's own step):

| Hook | Use |
| --- | --- |
| `getDesign(state, design: SimpleEditPageDesign)` | add/hide sections and fields, add tabs (`tabsDesign`), add buttons to `actionBarDesign`/app bar |
| `onEntityUpdate(state, structureName, objectId)` | react when a listened record changed |
| `getActiveFilterChips(state, chips)` / `clearFilter(state, key)` | filters you added (newer versions with a filter sidebar) |
| `populateJeannieContext(state, context)` | assistant context |

Plus the common hooks (`onInitState`, `onRefreshState`, `onEvent`, `getEntitiesListenning`, …) —
`@@REFERENCES@@/views_and_interceptors.md` §3.

**Saving extra fields**: an edit page has no `onSave` hook. To persist a field you add:
- if it is a column of the same entity bound to `state.<entity>.<field>`, the page's own save
  already sends it (the entity object is saved as a whole) — just add the widget;
- otherwise add your own button/action key and save in `onEvent`, or react on the server with an
  interceptor (`create-before-interceptor` / `create-after-interceptor`).

---

## 📥 Required Input Parameters

1. Target page route + state (from `@types`), e.g. `glyvio_core.ProfileEditPageRoute`.
2. The change (table above) and, for new fields, where the value is stored.
3. Plugin namespace.

---

## 🚫 Rules

1. Globals only; no `any`; real state types.
2. Locate the target section/layout with `design.findWidgetByKey('<key>')` (discover keys by logging
   the design once or via the AI bridge) and keep existing keys.
3. New fields bound to `state.*` paths that exist; new state you need goes in an extended interface
   with namespaced field names, loaded in `onRefreshState`.
4. New action keys namespaced, handled in `onEvent` (runs after the page's `events()`).
5. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
interface <Target>StateWithExtras extends <TargetState> {
  <plugin>_note?: string;
}

export class <Name>Interceptor extends glyvio_core.SimpleEditPageInterceptor<<Target>StateWithExtras> {
  getListenerId(): string {
    return '<plugin>.<name>_edit_page_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesign(state: <Target>StateWithExtras, design: glyvio_core.SimpleEditPageDesign): void {
    design.sectionsDesign ??= [];
    design.sectionsDesign.push(
      new glyvio_core.FormSectionDesign({
        key: '<plugin>.extra_section',
        appBarDesign: new glyvio_core.SimpleAppBarDesign({ title: '$T{<plugin>_extra_section}' }),
        childDesign: new glyvio_core.FormLayoutDesign({
          columnSize: 280,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: '<plugin>.note.formField',
              columns: 1,
              child: new glyvio_core.StringTextfieldDesign({ name: 'state.<plugin>_note', label: '$T{<plugin>_note}' }),
            }),
          ],
        }),
      }),
    );
    design.actionBarDesign ??= [];
    design.actionBarDesign.unshift(
      new glyvio_core.ActionButtonDesign({
        key: '<plugin>.save_note',
        title: '$T{<plugin>_saveNote}',
        type: 'SECONDARY',
        action: new glyvio_core.Action({ key: '<plugin>_saveNote' }),
      }),
    );
  }

  async onEvent(state: <Target>StateWithExtras, key: string, _data: unknown): Promise<void> {
    if (key == '<plugin>_saveNote') {
      // persist state.<plugin>_note in your own entity here (entityService.saveList / a controller)
      await this.getView().showToastSuccess(state, '$T{<plugin>_noteSaved}');
    }
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Correct base and state type; `getListenerRoute()` returns the page route.
- [ ] Persistence path for every new field decided (same entity / own action / server interceptor).
- [ ] Existing keys preserved; new keys and actions namespaced.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; checked with `test-plugin-browser`.
