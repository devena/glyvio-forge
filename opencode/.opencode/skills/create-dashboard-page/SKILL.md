---
name: create-dashboard-page
description: "Generates an in-app dashboard page (SimpleDashboardPage): responsive sections of KPI cards, charts, tables and lists, each cell loaded lazily by key (fetchItem → getDesignForCell), with optional filter sidebar, saved filters, MAIN/SIDE panels, routing and menu registration. For a standalone HTML dashboard opened by URL use create-custom-page instead."
---
<!-- Generated from src/skills/create-dashboard-page/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Dashboard Page

`glyvio_core.SimpleDashboardPage` renders **sections** (`SimpleDashboardPageSectionDesign`), each a
responsive grid of **cells** identified by string keys (`childrenKeys`). The app asks for each cell
independently: the framework calls `fetchItem(state, key)` (async, load data) and then
`getDesignForCell(state, key, data)` (build a `DashboardLayoutFieldDesign`). Slow cells do not block
fast ones.

| Need | Use |
| --- | --- |
| Dashboard inside the app, with app filters and navigation | **this skill** |
| HTML page (Plotly etc.) opened in a new tab / shared by link | `create-custom-page` |
| Report configured by the user in the app (no deploy) | `configure-report-record` |
| Chart widgets themselves (cartesian, pie, gauge...) | delegate to the `glyvio-app-chart` agent |

> Contract: `.opencode/references/views_and_interceptors.md`. Filters: `.opencode/references/filters_and_headers.md`.
> Visual pattern: `.opencode/references/modern_layout.md` (KPI cards with `glyvio_core.ui` / `SurfaceDesign`).

---

## 📥 Required Input Parameters

1. **Cells**: for each one — key, what it shows (KPI, chart, table, list), the query/data behind it, and what a tap does.
2. **Sections**: grouping of cell keys, `columnSize` (minimum cell width in px), and whether a section goes to the right `SIDE` panel on wide screens.
3. **Filters** (optional): fields of `state.filtersSidebar` and how each one affects the queries.
4. **Plugin namespace**, **route path**, **permission**, **menu group**.

---

## 🚫 Rules

1. Globals only; no `any` (except the framework's own `data: any` parameter of `getDesignForCell`, which you narrow immediately).
2. **`columnSize` is a minimum width in px (≥ 60)**: KPI cards 200–300, charts 400–450, full-width
   tables/banners `9999`. Never 4/5 — that collapses cells to a few pixels.
3. `fetchItem` does the I/O for **one key** and returns plain data; `getDesignForCell` is pure.
   Every key listed in any `childrenKeys` must be handled by both (return an empty design for unknown keys).
4. `DashboardLayoutFieldDesign` controls the cell: `columns`/`rows` (span in the grid),
   `span`/`spanSmall`/`spanMedium`/`spanLarge`, `autoHeight: true` for content-sized cells, `child`.
5. `panel: 'SIDE'` puts a section in the fixed 400 px right column on screens ≥ 900 px; on narrow
   screens SIDE sections are appended after MAIN ones.
6. No filters? set `design.allowFilters = false`. With filters, only push the filter fields
   (`design.filterSectionsDesign?.push(glyvio_core.FilterSidebar.section(...))`) and describe active
   filters in `getActiveFilterChips`/`clearFilter`; header, search, saved filters and footer come from the base.
7. Saved filters need `state.userConfigKey` + `await this.loadUserConfig(state)` in `initState`.
8. `Decimal`/`DateTime` for business values; format with `$N{}`/`$D{}` in designs.
9. Large aggregations belong on the server: call a controller (`restService.postController`,
   skill `create-controller`) from `fetchItem` instead of loading thousands of rows into the app.

---

## 📋 Execution Steps

1. Create `src/views/pages/<feature>_dashboard_page.ts` (blueprint).
2. Export it from `index.ts`; `routerService.loadRoutes([<Feature>DashboardPageRoute])`.
3. Menu item (skill `register-menu-and-admin`).
4. Charts: build them with the `glyvio-app-chart` agent and return them as the `child` of a cell.
5. `pnpm build`; screenshot at 1440×900 and 390×844 with `test-plugin-browser`.

---

## 📄 Code Blueprint

```typescript
export interface <Feature>DashboardFilter extends glyvio_core.SimpleDashboardPageStateFilter {
  <filterField>?: string;
}

export interface <Feature>DashboardRouteParams
  extends glyvio_core.SimpleDashboardPageRouteParams<<Feature>DashboardFilter> {}

export interface <Feature>DashboardState
  extends glyvio_core.SimpleDashboardPageState<<Feature>DashboardRouteParams, <Feature>DashboardFilter> {}

export class <Feature>DashboardPageRoute extends glyvio_core.SimpleDashboardPageRoute<<Feature>DashboardRouteParams> {
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
    return '<Feature>DashboardPage';
  }
}

type <Feature>Kpi = { total: number };

export class <Feature>DashboardPage extends glyvio_core.SimpleDashboardPage<<Feature>DashboardState> {
  constructor() {
    super(<Feature>DashboardPageRoute);
  }

  async initState(state: <Feature>DashboardState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = '<PLUGIN>_<FEATURE>_DASHBOARD'; // enables saved filters
    await this.loadUserConfig(state);
  }

  async events(_state: <Feature>DashboardState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }

  getDesign(state: <Feature>DashboardState, design: glyvio_core.SimpleDashboardPageDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({ title: '$T{<plugin>_<feature>_title}' });
    design.filterSectionsDesign?.push(
      glyvio_core.FilterSidebar.section('<feature>.filters', '$T{<plugin>_<feature>_filters}', [
        new glyvio_core.StringTextfieldDesign({
          name: 'state.filtersSidebar.<filterField>',
          label: '$T{<plugin>_<feature>_<filterField>}',
        }),
      ]),
    );
    design.sectionsDesign = [
      new glyvio_core.SimpleDashboardPageSectionDesign({
        key: '<feature>.kpis',
        columnSize: 240,
        childrenKeys: ['kpi_total'],
      }),
      new glyvio_core.SimpleDashboardPageSectionDesign({
        key: '<feature>.details',
        columnSize: 9999,
        childrenKeys: ['table_latest'],
      }),
    ];
  }

  getActiveFilterChips(state: <Feature>DashboardState): glyvio_core.SimpleDashboardPageFilterChip[] {
    const f = state.filtersSidebar;
    // a chip is { key, label, colorTheme?, removable? } — put the value in the label
    return f?.<filterField> ? [{ key: '<filterField>', label: `${f.<filterField>}` }] : [];
  }

  async clearFilter(state: <Feature>DashboardState, key: string): Promise<void> {
    if (key == '<filterField>' && state.filtersSidebar) {
      state.filtersSidebar.<filterField> = undefined;
    }
  }

  async fetchItem(state: <Feature>DashboardState, key: string): Promise<unknown> {
    switch (key) {
      case 'kpi_total': {
        const rows = await glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(
          glyvio_structure.AllEntities.<entityCamel>,
          { fields: [glyvio_structure.AllEntities.<entityCamel>.id] },
        ).findAll();
        const kpi: <Feature>Kpi = { total: rows.length }; // prefer a server-side count for big tables
        return kpi;
      }
      case 'table_latest':
        return glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(glyvio_structure.AllEntities.<entityCamel>)
          .addOrderByEntity(glyvio_structure.AllEntities.<entityCamel>.createdAt, 'DESC')
          .limit(10)
          .find();
      default:
        return undefined;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDesignForCell(state: <Feature>DashboardState, key: string, data: any): glyvio_core.DashboardLayoutFieldDesign {
    switch (key) {
      case 'kpi_total': {
        const kpi = data as <Feature>Kpi | undefined;
        return new glyvio_core.DashboardLayoutFieldDesign({
          columns: 1,
          autoHeight: true,
          child: new glyvio_core.SurfaceDesign({
            surface: 'card',
            padding: 'md',
            child: new glyvio_core.ColumnLayoutDesign({
              children: [
                new glyvio_core.StringTextDesign({ value: '$T{<plugin>_<feature>_kpiTotal}', style: 'LABEL_MEDIUM' }),
                new glyvio_core.StringTextDesign({ value: `${kpi?.total ?? 0}`, style: 'HEADLINE_MEDIUM' }),
              ],
            }),
          }),
        });
      }
      case 'table_latest': {
        const items = (data ?? []) as glyvio_entity.<EntityName>[];
        return new glyvio_core.DashboardLayoutFieldDesign({
          columns: 1,
          autoHeight: true,
          child: new glyvio_core.ColumnLayoutDesign({
            children: items.map((i) => new glyvio_core.StringTextDesign({ value: i.<titleField> ?? '' })),
          }),
        });
      }
      default:
        return new glyvio_core.DashboardLayoutFieldDesign({ columns: 1 });
    }
  }
}
```

Verify the `SurfaceDesign` fields, `FilterSidebar.section` signature and the
`SimpleDashboardPageFilterChip` shape against the target `.d.ts`.

---

## ✅ Completion Checklist

- [ ] Every key in `childrenKeys` is handled in `fetchItem` and `getDesignForCell`.
- [ ] `columnSize` values are ≥ 60 and match the content (KPI ~240, chart ~450, full width 9999).
- [ ] `fetchItem` does I/O only; `getDesignForCell` is pure and handles `undefined` data.
- [ ] Filters: `allowFilters = false` when there are none; chips + `clearFilter` when there are.
- [ ] Route registered, class exported, menu item added; texts in every `.arb`.
- [ ] `pnpm build` clean; screenshots in desktop and mobile widths.
