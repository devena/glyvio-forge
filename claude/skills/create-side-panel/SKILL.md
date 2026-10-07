---
name: create-side-panel
description: "Generates an independent side panel (SimpleSidePanel) and embeds it in a host — a cart (SimpleCart/SimpleBatchCart left/right), a table or list modal (left/right), a master-detail page (MASTER/DETAIL) or a tab of a TabSidePanelDesign — including two-way messaging between host and panel (sendActionToSidePanel / sendActionToParent)."
---
<!-- Generated from src/skills/create-side-panel/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Side Panel

A side panel (`glyvio_core.SimpleSidePanel`) is a real view with its own state and lifecycle
(`initState`, `refreshState`, `getDesign`, `events`) that is **embedded** in another view instead
of being pushed. It has a route (for permission and lookup) but no URL of its own and is never
opened with `push*`.

Use it when a part of a screen has its own data and behavior: the "summary" panel next to a cart,
filters/preview next to a table modal, MASTER/DETAIL of a master-detail page, or a tab with a
timeline/attachments beside a cart.

> Contract: `~/.claude/references/views_and_interceptors.md`. For a full master-detail screen use
> `create-master-detail-page`.

---

## 🗺️ Hosts and slot identifiers

| Host (design) | Slot field(s) | Identifier used by `sendActionToSidePanel` |
| --- | --- | --- |
| `SimpleCartDesign`, `SimpleBatchCartDesign` | `leftSidebarDesign`, `rightSidebarDesign` | `'LEFT'`, `'RIGHT'` |
| `SimpleTableModalDesign`, `SimpleListModalDesign` | `leftSidebarDesign`, `rightSidebarDesign` | `'LEFT'`, `'RIGHT'` |
| `SimpleMasterDetailPageDesign` | `masterPanelDesign`, `detailPanelDesign` | `'MASTER'`, `'DETAIL'` |
| `TabSidePanelDesign` (placed in any slot above) | `tabs: TabSidePanelItemDesign[]` (`label`, `icon`, `panel`) | the tab's `key` |

A slot receives either a `glyvio_core.SidePanelReferenceDesign` (an independent panel — this skill)
or, in carts/modals, an inline `SimpleSidePanelDesign` bound to the host's own state (no extra view;
use it only for static content).

Ready-made panels from Glyvio you can reference instead of writing one: `glyvio_core.TimelineSidePanelRoute`
(params `{ entityName, entityId }`) and the attachments panel (`AttachmentSidePanel`).

---

## 📥 Required Input Parameters

1. **Host view** and **slot** (table above).
2. **Panel purpose and content** (what it shows, what it does).
3. **Data the panel needs from the host** → becomes the panel's route params (e.g. `{ cartId }`).
4. **Messages**: does the host need to tell the panel something (refresh, select)? Does the panel need to tell the host (item chosen, totals changed)?
5. **Plugin namespace**, **route path** (e.g. `/order-cart/summary`) and **permission** (or `undefined`).
6. **Width** of the slot (px or `%`), if the host does not fix it.

---

## 🚫 Rules

1. Globals only (`glyvio_core.*`, `glyvio_entity.*`, ...); no `any`.
2. **Reference by route**: `glyvio_core.SidePanelReferenceDesign.fromJson({ route: new <Panel>Route({ ...params }), width? })`.
   The panel is recreated only when the referenced `path` changes, not when only `routeParams`
   change — to make an already-mounted panel react to new data, **send it an action**.
3. **Host → panel**: `await this.sendActionToSidePanel<T>(state, '<IDENTIFIER>', new glyvio_core.Action({ key: '<yourKey>', data }))`
   (available on carts, modals and the master-detail page). The panel receives `<yourKey>` in its own `events()`.
4. **Panel → host**: `await this.sendActionToParent<T>(new glyvio_core.Action({ key: '<yourKey>', data }))`.
   The host receives `<yourKey>` in its own `events()`.
5. **Panel → sibling panel**: through the host — `sendActionToParent` with
   `key: '_SEND_ACTION_TO_SIDE_PANEL', data: { panelIdentifier: '<SIBLING>', action }` (the only
   reserved key you send yourself). Your own keys never start with `_`.
6. A side panel has its **own route**: register it in `routerService.loadRoutes`, export the class
   from `index.ts`, and make `getRouteNameObject()` equal the class name. Do **not** add it to the menu.
7. `getFavoriteButtonEnabled()` is already `false` for panels — do not override it.
8. Texts as `$T{}` keys in every `.arb`.

---

## 📋 Execution Steps

1. Create `src/views/side_panels/<panel_snake>_side_panel.ts` (blueprint below).
2. Export it from `index.ts` and add `<Panel>Route` to `routerService.loadRoutes`.
3. In the host's `getDesign`, fill the slot with a `SidePanelReferenceDesign` (or a `TabSidePanelDesign` tab).
4. Wire the messages (rules 3–5) on both sides.
5. `pnpm build`; validate with `test-plugin-browser` (the panel appears, messages update it without reloading the host).

---

## 📄 Code Blueprint

```typescript
export interface <Panel>RouteParams extends glyvio_core.SimpleSidePanelRouteParams {
  <paramName>?: string; // data handed over by the host
}

export interface <Panel>State extends glyvio_core.SimpleSidePanelState<<Panel>RouteParams> {
  loading?: boolean;
  // panel-owned data
}

export class <Panel>Route extends glyvio_core.SimpleSidePanelRoute<<Panel>RouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<panel-path>';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Panel>';
  }
}

export class <Panel> extends glyvio_core.SimpleSidePanel<<Panel>State> {
  constructor() {
    super(<Panel>Route);
  }

  async refreshState(state: <Panel>State): Promise<void> {
    // load data using state.routeParams?.<paramName>
  }

  async events(state: <Panel>State, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // message sent by the host with sendActionToSidePanel(state, '<IDENTIFIER>', ...)
    if (action.key == 'refresh') {
      this.callRefreshState();
      return 'STATE_UPDATE';
    }
    // a button inside the panel that must notify the host
    if (action.key == 'choose') {
      await this.sendActionToParent(new glyvio_core.Action({ key: '<hostKey>', data: { id: action.data.id } }));
      return 'STATE_UPDATE';
    }
    return undefined;
  }

  getDesign(state: <Panel>State, design: glyvio_core.SimpleSidePanelDesign): void {
    design.headerDesign = new glyvio_core.ColumnLayoutDesign({
      padding: '16 16 8 16',
      children: [new glyvio_core.StringTextDesign({ value: '$T{<plugin>_<panel>_title}', style: 'TITLE_MEDIUM' })],
    });
    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: '<panel>.main',
        childDesign: new glyvio_core.ColumnLayoutDesign({ padding: '16', children: [] }),
      }),
    ];
    // design.bottomDesign = ... (fixed footer), design.appBarDesign = ...
  }
}
```

### Embedding in the host

```typescript
// in the host's getDesign (cart example):
design.rightSidebarDesign = glyvio_core.SidePanelReferenceDesign.fromJson({
  route: new <Panel>Route({ <paramName>: state.<hostField> }),
  width: 360,
});

// or as tabs (several panels in one slot):
design.rightSidebarDesign = new glyvio_core.TabSidePanelDesign({
  width: 380,
  tabs: [
    new glyvio_core.TabSidePanelItemDesign({
      key: 'summary',
      label: '$T{<plugin>_<panel>_tab}',
      icon: 'sax_linear_document_text',
      panel: glyvio_core.SidePanelReferenceDesign.fromJson({ route: new <Panel>Route({ <paramName>: state.<hostField> }) }),
    }),
  ],
});

// in the host's events — tell the panel to reload after the host changed something:
await this.sendActionToSidePanel(state, 'RIGHT', new glyvio_core.Action({ key: 'refresh' }));
// (inside a TabSidePanelDesign, use the tab key instead of 'RIGHT': 'summary')
```

Confirm in the target `.d.ts` that the chosen host design declares the slot field you use.

---

## ✅ Completion Checklist

- [ ] Panel route registered and class exported; route not added to any menu.
- [ ] Slot filled with `SidePanelReferenceDesign.fromJson({ route })` (or a `TabSidePanelDesign` tab with a `key`).
- [ ] Host → panel uses the right identifier (`LEFT`/`RIGHT`/`MASTER`/`DETAIL`/tab key); panel handles the key in `events()`.
- [ ] Panel → host uses `sendActionToParent`; the host handles the key in `events()`.
- [ ] No custom action key starts with `_`.
- [ ] Texts in every `.arb`; `pnpm build` clean; visual check with `test-plugin-browser`.
