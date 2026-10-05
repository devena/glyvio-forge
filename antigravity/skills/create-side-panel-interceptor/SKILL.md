---
name: create-side-panel-interceptor
description: "Generates a custom class extending SimpleSidePanelInterceptor (or TimelineSidePanelInterceptor) to change the design of an existing side panel — one from another plugin or from Glyvio itself, e.g. the timeline or attachments panel embedded in a cart — and registers it."
---
<!-- Generated from src/skills/create-side-panel-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Side Panel Interceptor

Customizes a side panel you do not own (see `create-side-panel` for what a side panel is). Side
panels expose few hooks: the panel-specific `getDesign` plus the hooks every view interceptor
inherits (`onInitState`, `onRefreshState`, `onEvent`, `getEntitiesListenning`, ... — see
`antigravity/rules/references/views_and_interceptors.md` §3).

| Target panel base | Interceptor to extend | Panel hook |
| --- | --- | --- |
| `SimpleSidePanel<S>` (any plugin panel) | `glyvio_core.SimpleSidePanelInterceptor<S>` | `getDesign(state, design: SimpleSidePanelDesign)` |
| Glyvio timeline panel (`TimelineSidePanelRoute`) | `glyvio_core.TimelineSidePanelInterceptor` (check its generic in the `.d.ts`) | `getDesign(state, design: TimelineSidePanelDesign)` |

---

## 📥 Required Input Parameters

1. **Target panel**: its route class (`<Target>Route`) and state interface, as exported in `@types` (another plugin's `.d.ts` or `glyvio_core.d.ts`).
2. **What to change**: add/hide/reorder widgets, add a button and its handler, extra data to load.
3. **Plugin namespace** for the listener id.

---

## 🚫 Rules

1. Globals only; no `any`. Use the target's real state type from `@types`.
2. `getListenerRoute()` returns the **panel's** route class (not the host's).
3. Find widgets with `design.findWidgetByKey('<key>')`; never rename keys you do not own. To learn
   the keys, log `JSON.stringify(design)` in `getDesign` once, or read the design with the AI bridge
   (`test-plugin-browser`).
4. A button you add uses a **new** action key (not starting with `_`) handled in `onEvent` — it
   runs after the panel's own `events()` and can only add side effects.
5. Data your extra widgets need: load it in `onRefreshState` into a field you add to the state
   (use a namespaced field such as `state.myPlugin_extra`) and bind with `$S{state.myPlugin_extra}`.
6. Register once in the plugin `index.ts` with `appInterceptorService.registerInterceptors`.

---

## 📄 Code Blueprint

```typescript
interface <Target>StateWithExtras extends <TargetState> {
  <plugin>_extra?: string;
}

export class <Name>Interceptor extends glyvio_core.SimpleSidePanelInterceptor<<Target>StateWithExtras> {
  getListenerId(): string {
    return '<plugin>.<name>_side_panel_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  async onRefreshState(state: <Target>StateWithExtras): Promise<void> {
    state.<plugin>_extra = '...'; // load what your widgets need
  }

  getDesign(state: <Target>StateWithExtras, design: glyvio_core.SimpleSidePanelDesign): void {
    design.sectionsDesign ??= [];
    design.sectionsDesign.push(
      new glyvio_core.FormSectionDesign({
        key: '<plugin>.extra_section',
        childDesign: new glyvio_core.ColumnLayoutDesign({
          padding: '16',
          children: [
            new glyvio_core.StringTextDesign({ value: '$S{state.<plugin>_extra}' }),
            new glyvio_core.ActionButtonDesign({
              key: '<plugin>.extra_button',
              title: '$T{<plugin>_extra_button}',
              type: 'SECONDARY',
              action: new glyvio_core.Action({ key: '<plugin>_extraAction' }),
            }),
          ],
        }),
      }),
    );
  }

  async onEvent(state: <Target>StateWithExtras, key: string, data: unknown): Promise<void> {
    if (key == '<plugin>_extraAction') {
      await this.getView().showToastInfo(state, '$T{<plugin>_extra_done}');
    }
  }
}

// plugin index.ts
glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Extends the interceptor class matching the panel's base; uses the panel's real state type.
- [ ] `getListenerRoute()` returns the panel route; `getListenerId()` is unique.
- [ ] Existing keys untouched; new keys and action keys namespaced with the plugin name.
- [ ] Registered in `index.ts`; texts in every `.arb`; `pnpm build` clean; checked with `test-plugin-browser`.
