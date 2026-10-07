---
name: create-table-sidebar
description: "Generates a table sidebar (SimpleTableSidebar): a side panel with a searchable table of records of one entity, quick-filter chips, optional row groups with counts, user column preferences, a 'new' button and row tap — typically opened from another screen to show the records related to it (e.g. the tasks of a client). Includes route registration."
---
<!-- Generated from src/skills/create-table-sidebar/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Table Sidebar

`glyvio_core.SimpleTableSidebar<S, E, GS>` is a **sidebar** (opened with `pushSidebar`) that shows a
table: search box, optional quick filters (chips with counts), optional groups (`GS`), paginated
rows. The Glyvio "tasks of this record" panel is one. Use it for "related records" panels; for a
full-page table use `create-table-page`, for a picker use `create-table-modal`.

| Method | Required | Role |
| --- | --- | --- |
| `getDesign(state, design: SimpleTableSidebarDesign)` | yes | app bar (title, buttons) and `design.columns` (`TableLayoutColumnDesign[]`) |
| `getDesignForRow(state, item): TableLayoutRowDesign` | yes | one row: `cells` (`TableLayoutCellDesign` with matching `columnName`), `groupName` when grouping |
| `populateQueryBuilder(state, qb)` | yes | base query, **search text** (`state.text`), **quick filter** (`state.quickFilter`), route params |
| `onRowTap(state, item)` | yes | open the record |
| `getEntityToTracking(item)` | yes | `{ structureName, objectId }` for live row refresh |
| `getQuickFilters(state)` | no | `{ key, label }[]` chips; selected key goes to `state.quickFilter` |
| `refreshGroupsState(state)` / `getDesignForGroup(state, group)` | no | group headers (use `qb.findGrouped(...)` for counts) |

> Contract: `~/.claude/references/views_and_interceptors.md`. Filters: `~/.claude/references/filters_and_headers.md` §3.

---

## 📥 Required Input Parameters

1. **Entity** and the **context** it is filtered by (route params, e.g. `clientId`).
2. **Columns** (name, header, width: number, `'LARGE'`, or default) and the cell content of each.
3. **Search fields**, **quick filters** (keys, labels, rule), **grouping** (optional).
4. **Row tap** target and **"new"** button behavior (what it opens, which params it passes).
5. **Plugin namespace**, **route path**, **permission**.

---

## 🚫 Rules

1. Globals only; no `any`.
2. **Search and quick filters are yours to apply** in `populateQueryBuilder` (`state.text`,
   `state.quickFilter`) — the base only collects them.
3. Every `TableLayoutCellDesign.columnName` matches a `TableLayoutColumnDesign.columnName`; keep
   `key`s on columns/cells (`'<col>.column'`, `'<col>.cell'`) so interceptors can find them.
4. Cell values may use interpolation against the row: `'$S{item.name}'`, `'$D{item.createdAt}'`,
   `'$N{item.total}'` (`item` is the serialized row).
5. Joins needed by cells: `addLeftJoinEntity(glyvio_structure.AllEntities.<entity>.<relation>)`.
6. Extra actions (like `new`): handle them in `events()` and **fall back to `super.events(state, action)`**
   — the base handles search, quick filters and paging there.
7. Column preferences persist when `state.userConfigKey` is set and `loadUserConfig` is called in `initState`.
8. The sidebar route is registered and exported, but not added to the menu; open it with
   `await this.pushSidebar(new <Entity>TableSidebarRoute({ ... }))` from the host screen.
9. Texts as `$T{}` keys in every `.arb`.

---

## 📄 Code Blueprint

```typescript
export interface <Entity>TableSidebarRouteParams extends glyvio_core.SimpleTableSidebarRouteParams {
  <contextId>?: string;
}

export interface <Entity>TableSidebarGroupState extends glyvio_core.SimpleTableSidebarGroupState {}

export interface <Entity>TableSidebarState
  extends glyvio_core.SimpleTableSidebarState<<Entity>TableSidebarRouteParams, <Entity>TableSidebarGroupState> {}

export class <Entity>TableSidebarRoute extends glyvio_core.SimpleTableSidebarRoute<<Entity>TableSidebarRouteParams> {
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
    return '<Entity>TableSidebar';
  }
}

export class <Entity>TableSidebar extends glyvio_core.SimpleTableSidebar<
  <Entity>TableSidebarState,
  glyvio_entity.<Entity>,
  <Entity>TableSidebarGroupState
> {
  constructor() {
    super(<Entity>TableSidebarRoute);
  }

  async initState(state: <Entity>TableSidebarState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<PLUGIN>_<ENTITY>_TABLE_SIDEBAR';
    await this.loadUserConfig(state);
  }

  getEntitiesListenning(_state: <Entity>TableSidebarState): glyvio_core.EntityListenning[] {
    return [
      new glyvio_core.EntityListenning({
        objectId: '*',
        structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(),
      }),
    ];
  }

  getDesign(state: <Entity>TableSidebarState, design: glyvio_core.SimpleTableSidebarDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.title = '$T{<plugin>_<entityCamel>Table_title}';
    appBar.putButtonOn(
      new glyvio_core.ActionButtonDesign({
        key: 'new.button',
        type: 'PRIMARY',
        iconName: 'sax_linear_add',
        title: '$T{<plugin>_<entityCamel>Table_new}',
        action: new glyvio_core.Action({ key: 'new' }),
      }),
      0,
    );
    design.columns = [
      new glyvio_core.TableLayoutColumnDesign({
        key: 'name.column',
        columnName: 'name',
        width: 'LARGE',
        padding: '4',
        child: new glyvio_core.StringTextDesign({ value: '$T{<plugin>_<entityCamel>Table_name}' }),
      }),
      new glyvio_core.TableLayoutColumnDesign({
        key: 'createdAt.column',
        columnName: 'createdAt',
        width: 120,
        padding: '4',
        child: new glyvio_core.StringTextDesign({ value: '$T{<plugin>_<entityCamel>Table_createdAt}' }),
      }),
    ];
  }

  getDesignForRow(_state: <Entity>TableSidebarState, _item: glyvio_entity.<Entity>): glyvio_core.TableLayoutRowDesign {
    return new glyvio_core.TableLayoutRowDesign({
      cells: [
        new glyvio_core.TableLayoutCellDesign({
          key: 'name.cell',
          columnName: 'name',
          child: new glyvio_core.StringTextDesign({ value: '$S{item.<titleField>}', style: 'LABEL_LARGE' }),
        }),
        new glyvio_core.TableLayoutCellDesign({
          key: 'createdAt.cell',
          columnName: 'createdAt',
          child: new glyvio_core.StringTextDesign({ value: '$D{item.createdAt}' }),
        }),
      ],
    });
  }

  getQuickFilters(_state: <Entity>TableSidebarState): glyvio_core.SimpleTableSidebarQuickFilter[] {
    return [
      { key: 'ALL', label: '$T{<plugin>_<entityCamel>Table_all}' },
      { key: 'RECENT', label: '$T{<plugin>_<entityCamel>Table_recent}' },
    ];
  }

  populateQueryBuilder(state: <Entity>TableSidebarState, qb: glyvio_core.QueryBuilder<glyvio_entity.<Entity>>): void {
    const e = glyvio_structure.AllEntities.<entityCamel>;
    qb.setFromEntity(e).addFilterOperator(e.deleted, false).addOrderByEntity(e.createdAt, 'DESC');
    // context from the host screen, e.g.:
    // if (state.routeParams?.<contextId>) qb.addFilterOperator(e.<contextField>, state.routeParams.<contextId>);
    const text = state.text?.trim();
    if (text) {
      qb.addFilter(new glyvio_core.QueryBuilderFilter({ ors: [new glyvio_core.QueryBuilderFilterILike({ field: e.<titleField>, value: text })] }));
    }
    if (state.quickFilter == 'RECENT') {
      qb.addFilterOperator(e.createdAt, glyvio_core.DateTime.now().plusDays(-7), { operator: 'GREATER_THAN_OR_EQUAL' });
    }
  }

  async onRowTap(_state: <Entity>TableSidebarState, item: glyvio_entity.<Entity>): Promise<void> {
    // await this.pushSidebar(new <Entity>SidebarRoute({ id: item.id! }), false);
  }

  async events(state: <Entity>TableSidebarState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key == 'new') {
      // await this.pushModal(new <Entity>EditModalRoute({ ... }));
      return 'STATE_FREEZED';
    }
    return super.events(state, action);
  }

  getEntityToTracking(item: glyvio_entity.<Entity>): { structureName: string; objectId: string } | undefined {
    return { structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(), objectId: item.id! };
  }
}
```

### Optional: groups with counts

Implement `refreshGroupsState` with `qb.findGrouped<T>([{ field, aliasField, type: 'TEXT' | 'COUNT' }, ...])`
over the same query (`this.populateQueryBuilder(state, qb)` first), map each result to a group state
with a `key`, return `getDesignForGroup` → `new glyvio_core.TableLayoutGroupDesign({ groupName: key, child })`,
and set `groupName` on each row to the key of its group. Group headers may use `$S{stateGroup.x}`.

---

## ✅ Completion Checklist

- [ ] Search (`state.text`) and quick filter (`state.quickFilter`) applied in `populateQueryBuilder`.
- [ ] Column and cell `columnName`s match; keys kept on columns and cells.
- [ ] Custom actions handled before `return super.events(state, action)`.
- [ ] Route registered and exported (no menu); opened from the host with `pushSidebar`.
- [ ] Texts in every `.arb`; `pnpm build` clean; checked with `test-plugin-browser`.
