---
name: create-master-detail-page
description: "Generates a master-detail page (SimpleMasterDetailPage): a page split into two independent side panels — MASTER (a list/table of records) and DETAIL (the record selected in MASTER) — where selecting in MASTER updates DETAIL without reloading the page. Creates the page, both SimpleSidePanel classes, their routes, registration and menu entry."
---
<!-- Generated from src/skills/create-master-detail-page/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Master-Detail Page

Generates a `glyvio_core.SimpleMasterDetailPage` with two `glyvio_core.SimpleSidePanel`s: MASTER
lists records, DETAIL shows the selected one. Each panel is an independent view (its own state,
`initState`/`refreshState`/`getDesign`/`events`), so selecting a row only re-renders DETAIL.

Use it for "list on the left, details on the right" screens (inbox, catalog browser, settings by
category). For a list that opens a separate sidebar/modal per record, prefer `create-list-page` or
`create-table-page` + `create-sidebar`.

> Shared contract (routes, export, lifecycle, navigation): `antigravity/rules/references/views_and_interceptors.md`.
> Layout pattern: `antigravity/rules/references/modern_layout.md`.

---

## 📥 Required Input Parameters

Ask for whatever is missing:

1. **Entity** (`glyvio_entity.<EntityName>`) listed in MASTER, and its `glyvio_structure.AllEntities.<entityCamel>`.
2. **Plugin namespace** (the plugin's global name, e.g. `my_plugin`).
3. **Route paths**: page (e.g. `/product-browser`) and the two panels (e.g. `/product-browser/master`, `/product-browser/detail`).
4. **MASTER fields**: title/subtitle of each row, search fields, ordering.
5. **DETAIL content**: which fields/sections to show for the selected record, and actions (edit, delete, open sidebar...).
6. **Permissions**: the `glyvio_permissions.*` for each route (or `undefined`), declared in `manifest.json` (skill `modify-manifest`).
7. **Menu group** where the page appears (skill `register-menu-and-admin`).
8. **Widths** (optional): MASTER width (px or `%`), DETAIL width.

---

## 🚫 Rules

1. **Globals, no imports**: use `glyvio_core.*`, `glyvio_entity.*`, `glyvio_structure.*`, `glyvio_permissions.*` directly.
2. **No `any`, no casts to `any`.**
3. **The page owns no data.** `SimpleMasterDetailPage` only declares the slots
   (`masterPanelDesign`, `detailPanelDesign`, optional `headerDesign`, `bottomSectionsDesign`,
   `emptyDetailPlaceholder`, `masterPanelWidth`, `detailPanelWidth`). Queries live in the panels.
4. **Panels reference routes, not content**: fill the slots with
   `glyvio_core.SidePanelReferenceDesign.fromJson({ route: new <PanelRoute>(params?), width? })`.
5. **MASTER → DETAIL goes through the page.** Panels have no link to each other. From MASTER call
   `this.sendActionToParent(new glyvio_core.Action({ key: '_SEND_ACTION_TO_SIDE_PANEL', data: { panelIdentifier: 'DETAIL', action: new glyvio_core.Action({ key: '<yourKey>', data }) } }))`.
   The page forwards it to DETAIL, whose `events()` receives `<yourKey>`. `'MASTER'`/`'DETAIL'` are
   the only panel identifiers of this page. `_SEND_ACTION_TO_SIDE_PANEL` is the one reserved key you
   are allowed to send; your own keys must not start with `_`.
6. **Mount DETAIL from the start** and let it render its own "nothing selected" state. The page's
   design does not change on selection, and DETAIL is not recreated when only its data changes.
7. **Each panel has its own route, permission and export.** All three routes go to
   `routerService.loadRoutes`, and all three classes must be exported from the plugin `index.ts`.
8. Use `$T{...}` keys for every visible text and add them to every `.arb` (`antigravity/rules/references/i18n.md`).
9. New entities saved from DETAIL need `userGroupId` (architecture rule 1.5).

---

## 📋 Execution Steps

1. Create `src/views/pages/<feature>_master_detail_page.ts` with the page, both panels and the three routes (blueprint below).
2. `export * from './views/pages/<feature>_master_detail_page';` in the plugin `index.ts`.
3. Register the routes: `glyvio_core.routerService.loadRoutes([<Feature>PageRoute, <Feature>MasterPanelRoute, <Feature>DetailPanelRoute]);`
4. Register the menu item for the page route only (skill `register-menu-and-admin`).
5. Build (`pnpm build`), then validate visually with `test-plugin-browser`: select two rows in a row and confirm DETAIL follows without the page reloading.

---

## 📄 Code Blueprint

```typescript
//================================================================================
// Page
//================================================================================

export interface <Feature>PageRouteParams extends glyvio_core.CorePageRouteParams {}

export interface <Feature>PageState extends glyvio_core.CorePageState<<Feature>PageRouteParams> {}

export class <Feature>PageRoute extends glyvio_core.SimpleMasterDetailPageRoute {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PagePermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<page-path>';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Feature>Page';
  }
}

export class <Feature>Page extends glyvio_core.SimpleMasterDetailPage<<Feature>PageState> {
  constructor() {
    super(<Feature>PageRoute);
  }

  // The page has no actions of its own: each panel handles its own events.
  async events(_state: <Feature>PageState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }

  getDesign(_state: <Feature>PageState, design: glyvio_core.SimpleMasterDetailPageDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({ title: '$T{<plugin>_<feature>_title}' });
    design.masterPanelWidth = 360; // or '35%'
    design.masterPanelDesign = glyvio_core.SidePanelReferenceDesign.fromJson({
      route: new <Feature>MasterPanelRoute(),
    });
    design.detailPanelDesign = glyvio_core.SidePanelReferenceDesign.fromJson({
      route: new <Feature>DetailPanelRoute(),
    });
  }
}

//================================================================================
// MASTER panel — the record list
//================================================================================

export interface <Feature>MasterPanelRouteParams extends glyvio_core.SimpleSidePanelRouteParams {}

export interface <Feature>MasterPanelState extends glyvio_core.SimpleSidePanelState<<Feature>MasterPanelRouteParams> {
  text?: string;
  items?: glyvio_entity.<EntityName>[];
  selectedId?: string;
}

export class <Feature>MasterPanelRoute extends glyvio_core.SimpleSidePanelRoute<<Feature>MasterPanelRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PagePermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<page-path>/master';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Feature>MasterPanel';
  }
}

export class <Feature>MasterPanel extends glyvio_core.SimpleSidePanel<<Feature>MasterPanelState> {
  constructor() {
    super(<Feature>MasterPanelRoute);
  }

  async initState(state: <Feature>MasterPanelState): Promise<void> {
    await super.initState(state);
    state.items = [];
  }

  async refreshState(state: <Feature>MasterPanelState): Promise<void> {
    const qb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(
      glyvio_structure.AllEntities.<entityCamel>,
    ).addOrderByEntity(glyvio_structure.AllEntities.<entityCamel>.<titleField>, 'ASC');
    if (state.text) {
      qb.addFilter(
        new glyvio_core.QueryBuilderFilter({
          ors: [
            new glyvio_core.QueryBuilderFilterILike({
              field: glyvio_structure.AllEntities.<entityCamel>.<titleField>,
              value: state.text,
            }),
          ],
        }),
      );
    }
    state.items = await qb.limit(100).find(); // find() paginates; findAll() ignores limit/offset
  }

  getEntitiesListenning(_state: <Feature>MasterPanelState): glyvio_core.EntityListenning[] {
    return [
      new glyvio_core.EntityListenning({
        objectId: '*',
        structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(),
      }),
    ];
  }

  async events(state: <Feature>MasterPanelState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key == 'search') {
      this.callRefreshState();
      return 'STATE_UPDATE';
    }
    if (action.key == 'select') {
      const id = action.data.id as string;
      state.selectedId = id;
      await this.sendActionToParent(
        new glyvio_core.Action({
          key: '_SEND_ACTION_TO_SIDE_PANEL',
          data: {
            panelIdentifier: 'DETAIL',
            action: new glyvio_core.Action({ key: 'select', data: { id } }),
          },
        }),
      );
      return 'STATE_UPDATE';
    }
    return undefined;
  }

  getDesign(state: <Feature>MasterPanelState, design: glyvio_core.SimpleSidePanelDesign): void {
    design.headerDesign = new glyvio_core.ColumnLayoutDesign({
      padding: '16 16 8 16',
      children: [
        new glyvio_core.StringTextfieldDesign({
          key: 'master.search',
          name: 'state.text',
          label: '$T{<plugin>_<feature>_search}',
          // trigger the search from a button or on submit, depending on the textfield options in @types
        }),
      ],
    });
    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: 'master.list',
        childDesign: new glyvio_core.ColumnLayoutDesign({
          padding: '8',
          children: (state.items ?? []).map(
            (item) =>
              new glyvio_core.LineCellDesign({
                key: `master.item.${item.id}`,
                padding: '12',
                colorTheme: state.selectedId == item.id ? 'PRIMARY' : undefined,
                variant: state.selectedId == item.id ? 'solid' : 'subtle',
                onTapAction: new glyvio_core.Action({ key: 'select', data: { id: item.id } }),
                child: new glyvio_core.ColumnLayoutDesign({
                  children: [
                    new glyvio_core.StringTextDesign({ value: item.<titleField> ?? '', style: 'LABEL_MEDIUM' }),
                    new glyvio_core.StringTextDesign({ value: item.<subtitleField> ?? '', style: 'BODY_SMALL' }),
                  ],
                }),
              }),
          ),
        }),
      }),
    ];
  }
}

//================================================================================
// DETAIL panel — the selected record
//================================================================================

export interface <Feature>DetailPanelRouteParams extends glyvio_core.SimpleSidePanelRouteParams {}

export interface <Feature>DetailPanelState extends glyvio_core.SimpleSidePanelState<<Feature>DetailPanelRouteParams> {
  selectedId?: string;
  item?: glyvio_entity.<EntityName>;
}

export class <Feature>DetailPanelRoute extends glyvio_core.SimpleSidePanelRoute<<Feature>DetailPanelRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PagePermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<page-path>/detail';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Feature>DetailPanel';
  }
}

export class <Feature>DetailPanel extends glyvio_core.SimpleSidePanel<<Feature>DetailPanelState> {
  constructor() {
    super(<Feature>DetailPanelRoute);
  }

  async refreshState(state: <Feature>DetailPanelState): Promise<void> {
    state.item = state.selectedId
      ? await glyvio_core.QueryBuilder.getById<glyvio_entity.<EntityName>>(
          glyvio_structure.AllEntities.<entityCamel>,
          state.selectedId,
        )
      : undefined;
  }

  // 'select' arrives here from MASTER through the page (a plain, non-reserved key).
  async events(state: <Feature>DetailPanelState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key == 'select') {
      state.selectedId = action.data.id as string;
      this.callRefreshState();
      return 'STATE_UPDATE';
    }
    return undefined;
  }

  getDesign(state: <Feature>DetailPanelState, design: glyvio_core.SimpleSidePanelDesign): void {
    const item = state.item;
    if (!item) {
      design.sectionsDesign = [
        new glyvio_core.FormSectionDesign({
          key: 'detail.empty',
          childDesign: new glyvio_core.ColumnLayoutDesign({
            padding: '16',
            children: [
              new glyvio_core.StringTextDesign({ value: '$T{<plugin>_<feature>_nothingSelected}', style: 'BODY_MEDIUM' }),
            ],
          }),
        }),
      ];
      return;
    }
    design.headerDesign = new glyvio_core.ColumnLayoutDesign({
      padding: '16 16 8 16',
      children: [new glyvio_core.StringTextDesign({ value: item.<titleField> ?? '', style: 'HEADLINE_SMALL' })],
    });
    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: 'detail.main',
        childDesign: new glyvio_core.ColumnLayoutDesign({
          padding: '16',
          children: [
            // fields of the selected record (prefer glyvio_core.ui / SurfaceDesign blocks, see modern_layout.md)
          ],
        }),
      }),
    ];
  }
}
```

Adjust to the target `.d.ts`: confirm `SimpleSidePanelRouteParams`, `SimpleSidePanelState`,
`SimpleMasterDetailPageDesign` fields and the textfield options before compiling.

---

## ✅ Completion Checklist

- [ ] Three routes, three classes, all exported from `index.ts` and passed to `routerService.loadRoutes`.
- [ ] `getRouteNameObject()` of each route equals its class name.
- [ ] MASTER sends `_SEND_ACTION_TO_SIDE_PANEL` with `panelIdentifier: 'DETAIL'`; DETAIL handles the inner key in `events()`.
- [ ] DETAIL renders its own empty state; the page's design never depends on the selection.
- [ ] No `callRefreshState()` misuse: it is only used to reload data after a selection/search.
- [ ] All texts are `$T{}` keys present in every `.arb`; `node antigravity/scripts/i18n_check.mjs .` passes.
- [ ] `pnpm build` is clean; visual check done with `test-plugin-browser`.
