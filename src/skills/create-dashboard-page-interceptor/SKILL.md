---
name: create-dashboard-page-interceptor
description: "Generates a custom class extending SimpleDashboardPageInterceptor (or HomePageInterceptor for the Glyvio home screen) to add, replace or restyle cells and sections of an existing dashboard page, extend its filters, feed the home's Jeannie suggestions and alert counters, and registers it."
---
# Agent Skill: Create a Dashboard Page Interceptor

Customizes a `SimpleDashboardPage` you do not own — including the **Glyvio home screen**
(`/home`), which is a dashboard page with its own interceptor base, `glyvio_core.HomePageInterceptor`.

Dashboard cells are identified by string keys and loaded one by one (see `create-dashboard-page`).
The interceptor hooks run after the page's own implementation of each step:

| Hook | What you can do |
| --- | --- |
| `getDesign(state, design: SimpleDashboardPageDesign)` | add sections, add keys to a section's `childrenKeys`, remove/reorder sections, change the app bar, push filter fields to `design.filterSectionsDesign` |
| `fetchItem(state, key, data): Promise<unknown>` | return **new data** for a key (yours, or replace the page's); return `undefined` to keep `data` |
| `getDesignForCell(state, key, data, design: DashboardLayoutFieldDesign)` | **mutate** the cell the page built (for an unknown key the page builds an empty cell: set `design.child`, `columns`, `autoHeight`) |
| `getActiveFilterChips(state, chips)` / `clearFilter(state, key)` | describe and clear the filters you added |
| `populateJeannieContext(state, context)` | extend the assistant context |
| `HomePageInterceptor` only: `fetchJeannieSuggestions(state, suggestions)`, `fetchAlerts(state, alerts)` | push items to the home's "Jeannie suggestions" and "alerts" cards |

Plus the hooks every view interceptor inherits (`@@REFERENCES@@/views_and_interceptors.md` §3).

Home sections and cell keys (for positioning): `ask`, `stats`, `jeannie-alerts`, `my-tasks` (MAIN)
and `shortcuts`, `count-alerts` (SIDE). Confirm at runtime before relying on them.

---

## 📥 Required Input Parameters

1. **Target**: the dashboard's route and state from `@types` (for the home: `glyvio_core.HomePageRoute`, `glyvio_core.HomePageState`).
2. **Change**: new cell(s) (key, data, design, position), replaced cell, new filter, home suggestion/alert.
3. **Plugin namespace** (keys are namespaced: `<plugin>.<cell>`).

---

## 🚫 Rules

1. Globals only; no `any` beyond the framework's `data: any` parameter.
2. **Namespace your cell keys** (`'<plugin>.open_orders'`) so they never collide with the page's or another plugin's.
3. A new cell needs **all three**: its key in some section's `childrenKeys` (`getDesign`), data in
   `fetchItem` for that key, and `design.child` set in `getDesignForCell` for that key.
4. In `fetchItem`, return `undefined` for every key that is not yours — returning something
   replaces the page's data.
5. `getDesignForCell` mutates the received `design`; do not return a new object.
6. New sections: `columnSize` ≥ 60 (KPI ~240, full width 9999); `panel: 'SIDE'` for the right column.
7. Home alert DTO: `{ action, colorTheme, value, label }` (`glyvio_core.HomePageAlertDto`); suggestion
   DTO: `{ title?, colorTheme?, label, actionButtons }` (`glyvio_core.HomePageJeannieSuggestionDto`).
   Actions you put there are handled by your interceptor's `onEvent` (after the page's `events`).
8. Keep it fast: the home is the first screen of every user. Cheap queries, `limit`, or a server
   controller for aggregates.
9. Register once in `index.ts`.

---

## 📄 Code Blueprint — add a cell to the Glyvio home

```typescript
type <Name>Data = { count: number };

export class <Name>HomeInterceptor extends glyvio_core.HomePageInterceptor {
  getListenerId(): string {
    return '<plugin>.home_interceptor';
  }

  getDesign(state: glyvio_core.HomePageState, design: glyvio_core.SimpleDashboardPageDesign): void {
    design.sectionsDesign ??= [];
    design.sectionsDesign.push(
      new glyvio_core.SimpleDashboardPageSectionDesign({
        key: '<plugin>.section',
        columnSize: 9999,
        panel: 'SIDE',
        childrenKeys: ['<plugin>.cell'],
      }),
    );
  }

  async fetchItem(state: glyvio_core.HomePageState, key: string, _data: unknown): Promise<unknown> {
    if (key != '<plugin>.cell') {
      return undefined; // not ours: keep the page's data
    }
    const rows = await glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<EntityName>>(
      glyvio_structure.AllEntities.<entityCamel>,
      { fields: [glyvio_structure.AllEntities.<entityCamel>.id] },
    )
      .limit(100)
      .find();
    const result: <Name>Data = { count: rows.length };
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDesignForCell(state: glyvio_core.HomePageState, key: string, data: any, design: glyvio_core.DashboardLayoutFieldDesign): void {
    if (key != '<plugin>.cell') {
      return;
    }
    const d = data as <Name>Data | undefined;
    design.columns = 1;
    design.autoHeight = true;
    design.child = new glyvio_core.SurfaceDesign({
      surface: 'card',
      padding: 'md',
      onTap: new glyvio_core.Action({ key: '<plugin>_openList' }),
      child: new glyvio_core.ColumnLayoutDesign({
        children: [
          new glyvio_core.StringTextDesign({ value: '$T{<plugin>_home_title}', style: 'LABEL_MEDIUM' }),
          new glyvio_core.StringTextDesign({ value: `${d?.count ?? 0}`, style: 'HEADLINE_SMALL' }),
        ],
      }),
    });
  }

  async fetchAlerts(state: glyvio_core.HomePageState, alerts: glyvio_core.HomePageAlertDto[]): Promise<void> {
    alerts.push({
      label: '$T{<plugin>_home_alert}',
      value: '3',
      colorTheme: 'WARNING',
      action: new glyvio_core.Action({ key: '<plugin>_openList' }),
    });
  }

  async onEvent(state: glyvio_core.HomePageState, key: string, _data: unknown): Promise<void> {
    if (key == '<plugin>_openList') {
      await this.getView().pushPage(new <TargetListRoute>());
    }
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>HomeInterceptor, order: 10 }]);
```

For any other dashboard, extend `glyvio_core.SimpleDashboardPageInterceptor<<TargetState>>` and add
`getListenerRoute()` returning `<TargetRoute>` (the home interceptor already returns `HomePageRoute`).

---

## ✅ Completion Checklist

- [ ] Each new cell key is namespaced and present in `childrenKeys`, `fetchItem` and `getDesignForCell`.
- [ ] `fetchItem` returns `undefined` for keys that are not yours.
- [ ] `getDesignForCell` mutates `design` and ignores other keys.
- [ ] Actions used in cells/alerts handled in `onEvent`.
- [ ] Registered; texts in every `.arb`; `pnpm build` clean; home/dashboard screenshot checked.
