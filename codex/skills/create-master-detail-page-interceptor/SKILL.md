---
name: create-master-detail-page-interceptor
description: "Generates a custom class extending SimpleMasterDetailPageInterceptor to change an existing master-detail page you do not own — app bar, header/bottom sections, panel widths, the empty-detail placeholder, or which side panels fill the MASTER/DETAIL slots — and registers it."
---
<!-- Generated from src/skills/create-master-detail-page-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Master-Detail Page Interceptor

A `SimpleMasterDetailPage` (see `create-master-detail-page`) only declares slots, so its interceptor
has a single page-specific hook:

```text
getDesign(state, design: glyvio_core.SimpleMasterDetailPageDesign): void
```

`SimpleMasterDetailPageDesign` fields you may change: `appBarDesign`, `headerDesign`,
`bottomSectionsDesign`, `masterPanelDesign`, `masterPanelWidth`, `detailPanelDesign`,
`detailPanelWidth`, `emptyDetailPlaceholder`. Plus the hooks every view interceptor inherits
(`codex/references/views_and_interceptors.md` §3).

**Decide what to intercept:**

| Change wanted | Intercept |
| --- | --- |
| Page chrome (title, buttons, header/bottom sections, widths) | the page → this skill |
| Rows of the list, its query, the detail fields | the MASTER or DETAIL **panel** → `create-side-panel-interceptor` |
| A completely different list or detail | replace the slot here with a `SidePanelReferenceDesign` pointing at your own panel (`create-side-panel`) |

---

## 📥 Required Input Parameters

1. Target page route class and state interface (from `@types`).
2. The change (table above).
3. Plugin namespace (listener id, action keys, `.arb` keys).

---

## 🚫 Rules

1. Globals only; no `any`; real state type from `@types`.
2. Replacing a slot: the new panel must keep talking the same protocol if the other panel depends on
   it (e.g. a new MASTER must still send `_SEND_ACTION_TO_SIDE_PANEL` → `DETAIL` with the key the
   existing DETAIL handles). Check the existing panel's behavior at runtime before replacing.
3. New app-bar buttons use your own action keys, handled in `onEvent` (runs after the page's
   `events()`); to reach a panel from there use `this.getView().sendActionToSidePanel(state, 'DETAIL', action)`.
4. Register in the plugin `index.ts`.

---

## 📄 Code Blueprint

```typescript
export class <Name>Interceptor extends glyvio_core.SimpleMasterDetailPageInterceptor<<TargetState>> {
  getListenerId(): string {
    return '<plugin>.<name>_master_detail_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesign(state: <TargetState>, design: glyvio_core.SimpleMasterDetailPageDesign): void {
    design.masterPanelWidth = '30%';
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign | undefined;
    appBar?.buttons?.push(
      new glyvio_core.ActionButtonDesign({
        key: '<plugin>.refresh_detail',
        iconName: 'sax_linear_refresh',
        type: 'SECONDARY',
        action: new glyvio_core.Action({ key: '<plugin>_refreshDetail' }),
      }),
    );
  }

  async onEvent(state: <TargetState>, key: string, _data: unknown): Promise<void> {
    if (key == '<plugin>_refreshDetail') {
      await this.getView().sendActionToSidePanel(state, 'DETAIL', new glyvio_core.Action({ key: 'refresh' }));
    }
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

`'refresh'` must be a key the target DETAIL panel actually handles — confirm it first.

---

## ✅ Completion Checklist

- [ ] Right target (page vs panel) chosen per the table.
- [ ] `getListenerRoute()` returns the page route; unique `getListenerId()`.
- [ ] Replaced panels keep the MASTER↔DETAIL protocol.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; checked with `test-plugin-browser`.
