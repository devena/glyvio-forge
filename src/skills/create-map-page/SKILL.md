---
name: create-map-page
description: "Generates a map page (SimpleMapPage) that plots entity records with latitude/longitude as pins, loading only the records inside the visible map area, with search, filter sidebar, saved filters, pin tap action, routing and menu registration."
---
# Agent Skill: Create a Map Page

`glyvio_core.SimpleMapPage<S, E>` shows records of one entity as pins. Whenever the user pans or
zooms, the framework builds a `QueryBuilder` and calls, in order: `populateQueryBuilder` (base
query + sidebar filters), `populateMainFilter` (search text, when typed) and `populateAreaFilter`
(the visible rectangle). Each returned record becomes a pin through `getDesignForCell`.

> Contract: `@@REFERENCES@@/views_and_interceptors.md`. Filters: `@@REFERENCES@@/filters_and_headers.md`.

---

## 📥 Required Input Parameters

1. **Entity** with real `latitude`/`longitude` columns (`Decimal`). If they do not exist, **stop and ask** whether to add them (skill `modify-manifest`) — never fake coordinates in a shipped page.
2. **Pin content**: title, description, color rule.
3. **Search fields** (top search box) and **sidebar filters**.
4. **Pin tap**: what opens (sidebar, modal, page).
5. **Plugin namespace**, **route path**, **permission**, **menu group**.

---

## 🚫 Rules

1. Globals only; **no `any`, no `as any`**. Entity getters are typed (`item.latitude` is `Decimal | null`).
2. `SimpleMapCellDesign` fields: `latitude`, `longitude` (`string | number | null`), `title`, `description`, `colorTheme`. Convert with `item.latitude?.toNumber() ?? null`; records without coordinates are already excluded by the area filter (`addFilterBetween`); to exclude them explicitly use `addFilterNull(e.latitude, { operator: 'IS_NOT_NULL' })`.
3. **Always restrict by area** in `populateAreaFilter` with `addFilterBetween` on latitude and
   longitude — without it every pan loads the whole table.
4. Query API: `setFromEntity`, `addFilterOperator(field, value, { operator })`, `addFilterILike`,
   `addFilterBetween`, `addFilterIN`, `addFilter(new glyvio_core.QueryBuilderFilter({ ors: [...] }))`.
   There is **no** `addSelect`, `filter()`, `.equals()` or `.like()` on `QueryBuilder` (some older
   examples show them — they do not compile).
5. `populateMainFilter` returns a `glyvio_core.QueryBuilderFilter` (usually `ors` of `QueryBuilderFilterILike`).
6. `getEntityToTracking(item)` returns `{ structureName, objectId }` with
   `glyvio_structure.AllEntities.<entityCamel>.getStructureName()` (not a hand-written name).
7. Saved filters: set `state.userConfigKey` and call `await this.loadUserConfig(state)` in `initState`.
8. Texts as `$T{}` keys in every `.arb`.

---

## 📋 Execution Steps

1. Create `src/views/pages/<entity_snake>_map_page.ts` (blueprint).
2. Export it from `index.ts`; `routerService.loadRoutes([<Entity>MapPageRoute])`; menu item (skill `register-menu-and-admin`).
3. `pnpm build`; open the page with `test-plugin-browser`, pan the map and confirm pins reload.

---

## 📄 Code Blueprint

```typescript
export interface <Entity>MapFilter extends glyvio_core.SimpleMapPageStateFilter {
  <filterField>?: string;
}

export interface <Entity>MapRouteParams extends glyvio_core.SimpleMapPageRouteParams<<Entity>MapFilter> {}

export interface <Entity>MapPageState extends glyvio_core.SimpleMapPageState<<Entity>MapRouteParams, <Entity>MapFilter> {}

export class <Entity>MapPageRoute extends glyvio_core.SimpleMapPageRoute<<Entity>MapRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<route-path>';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Entity>MapPage';
  }
}

export class <Entity>MapPage extends glyvio_core.SimpleMapPage<<Entity>MapPageState, glyvio_entity.<Entity>> {
  constructor() {
    super(<Entity>MapPageRoute);
  }

  async initState(state: <Entity>MapPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<PLUGIN>_<ENTITY>_MAP_PAGE';
    await this.loadUserConfig(state);
  }

  async events(_state: <Entity>MapPageState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }

  getDesign(state: <Entity>MapPageState, design: glyvio_core.SimpleMapPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign | undefined;
    if (appBar) {
      appBar.title = '$T{<plugin>_<entity>Map_title}';
    }
    design.filterSectionsDesign?.push(
      glyvio_core.FilterSidebar.section('<entity>Map.filters', '$T{<plugin>_<entity>Map_filters}', [
        new glyvio_core.StringTextfieldDesign({
          name: 'state.filtersSidebar.<filterField>',
          label: '$T{<plugin>_<entity>Map_<filterField>}',
        }),
      ]),
    );
  }

  getDesignForCell(_state: <Entity>MapPageState, item: glyvio_entity.<Entity>): glyvio_core.SimpleMapCellDesign {
    return new glyvio_core.SimpleMapCellDesign({
      latitude: item.latitude?.toNumber() ?? null,
      longitude: item.longitude?.toNumber() ?? null,
      title: item.<titleField> ?? '',
      description: item.<descriptionField> ?? '',
      colorTheme: 'BLUE',
    });
  }

  populateQueryBuilder(state: <Entity>MapPageState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>): void {
    const e = glyvio_structure.AllEntities.<entityCamel>;
    queryBuilder.setFromEntity(e);
    queryBuilder.addFilterOperator(e.deleted, false);
    if (state.filtersSidebar?.<filterField>) {
      queryBuilder.addFilterILike(e.<filterField>, state.filtersSidebar.<filterField>);
    }
  }

  populateMainFilter(_state: <Entity>MapPageState, text: string): glyvio_core.QueryBuilderFilter {
    const e = glyvio_structure.AllEntities.<entityCamel>;
    return new glyvio_core.QueryBuilderFilter({
      ors: [
        new glyvio_core.QueryBuilderFilterILike({ field: e.<titleField>, value: text }),
        new glyvio_core.QueryBuilderFilterILike({ field: e.<descriptionField>, value: text }),
      ],
    });
  }

  populateAreaFilter(
    _state: <Entity>MapPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>,
    southWestLatitude: Decimal,
    southWestLongitude: Decimal,
    northEastLatitude: Decimal,
    northEastLongitude: Decimal,
  ): void {
    const e = glyvio_structure.AllEntities.<entityCamel>;
    queryBuilder.addFilterBetween(e.latitude, southWestLatitude, northEastLatitude);
    queryBuilder.addFilterBetween(e.longitude, southWestLongitude, northEastLongitude);
  }

  async onCellTap(_state: <Entity>MapPageState, item: glyvio_entity.<Entity>): Promise<void> {
    // e.g. await this.pushSidebar(new <Entity>SidebarRoute({ id: item.id! }));
  }

  getEntityToTracking(item: glyvio_entity.<Entity>): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(),
      objectId: item.id!,
    };
  }
}
```

The coordinates of `populateAreaFilter` are the **global** `Decimal` type (the same one entity
getters return), not `glyvio_core.Decimal` — using the latter fails to compile.

---

## ✅ Completion Checklist

- [ ] Entity has real `latitude`/`longitude` columns.
- [ ] `populateAreaFilter` restricts both coordinates with `addFilterBetween`.
- [ ] No `any`, no invented QueryBuilder methods; `getEntityToTracking` uses `getStructureName()`.
- [ ] Route registered, class exported, menu item added; texts in every `.arb`.
- [ ] `pnpm build` clean; pins reload on pan/zoom in `test-plugin-browser`.
