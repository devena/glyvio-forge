---
name: register-menu-and-admin
description: "Registers how users reach a plugin's screens: groups and items of the Glyvio full menu (menuRegistryService.addGroup/addItem), items of the admin screen (adminRegistryService.addSection/addItem) for settings and auxiliary registrations, items that open a Custom Page, and routes available offline. Replaces the deprecated FullMenuPage.fullMenuGroupAdd."
---
<!-- Generated from src/skills/register-menu-and-admin/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Register Menu and Admin Entries

A plugin screen is reachable only after (1) its route is loaded, (2) its class is exported and
(3) an entry points at it. This skill covers (3).

| Where the user finds it | API |
| --- | --- |
| Full menu (and side menu / command palette / favorites) | `glyvio_core.menuRegistryService.addGroup(group)` and `addItem(groupKey, item)` |
| Admin screen (`/admin`) — settings, users/permissions-like registrations, integrations | `glyvio_core.adminRegistryService.addSection(section)` and `addItem(sectionKey, item)` |
| A shortcut that **runs code** (create order, find client) | `menuRegistryService.addAction` → skill `create-quick-action` |
| A button inside another screen | an interceptor of that screen (`create-*-interceptor`) |

`glyvio_core.FullMenuPage.fullMenuGroupAdd(...)` is **deprecated** (it just calls
`menuRegistryService.addGroup`). Registering admin items under the old group key `'main-cruds'`
is deprecated too — use `adminRegistryService`.

---

## 📥 Required Input Parameters

1. The **route(s)** to expose and their **permissions** (an item whose route needs a permission the user lacks is hidden automatically).
2. **Menu vs. admin** for each one (operational screens → menu; configuration/auxiliary registrations → admin).
3. **Group/section**: key, name (`$T{}`), position, color; optional subtitle (`$T{}`), icon and
   `flow` (its place in the company's flow, for the full menu's "Fluxo" view).
4. **Item**: key (stable, unique), title/subtitle (`$T{}` — the subtitle says what the user does
   there; the full menu and the command palette show it), icon (`fa_*`/`ma_*`/`sax_*`), color;
   whether it is one of the section's 3–4 `primary` options; its sidebar version (`sideRoute`), if any.

---

## 🚫 Rules

1. Register everything once, at load time, in the plugin `index.ts` — after `routerService.loadRoutes`.
2. **Keys are stable identities**: users' favorites and pinned items reference them. Namespace them
   (`'<plugin>.orders'`, `'push-<plugin>-orders'`) and never rename a published key.
3. `addItem(groupKey, item)` ignores the item if the group does not exist — call `addGroup` first
   (or include the items in the `addGroup` call). Calling `addGroup` again with an existing key
   merges: name/color are updated and the new items are appended.
4. Admin sections: prefer the built-in ones — `glyvio_core.AdminRegistryService.SECTION_ACCESS`,
   `SECTION_DATA`, `SECTION_AUTOMATION`, `SECTION_SYSTEM`, `SECTION_GENERAL`, `SECTION_DEVELOPER`; create
   your own section (`addSection`) only for a coherent group of several items (e.g. an integration).
5. Icon names: type the literal as `glyvio_core.GlyvioIconName` for autocomplete and run
   `node ~/.claude/scripts/check_icons.mjs .` — unknown names render as a triangle.
6. Texts are `$T{}` keys in every `.arb`.
7. Offline: only for screens whose data/actions work without a connection,
   `glyvio_core.routerService.addOfflineAvailableRoutes([<Route>])`.
8. `sideRoute` (optional, a `CoreSidebarRoute`): give it to a screen that has a sidebar version with the
   same records (e.g. a table sidebar, skill create-table-sidebar). The hosts then offer "abrir ao lado"
   (Ctrl/⌘ ↵ in the command palette, Ctrl/⌘+click in the full menu), opening that sidebar beside the
   current page. Never a page or modal route there. It is offered only to users with the sidebar
   route's own permission.
9. Full menu (native in the apps since 30/10/2026): each section shows 3–4 **primary** options, the
   rest behind "Exibir mais". Mark them with `primary: true` (a quick action with `primary: true` is
   the section's main button). A section that flags none falls back to the user's favourites and
   recents. Give the group a `subtitle`, an `iconName` and a `flow` number.
10. Live numbers (optional): `menuRegistryService.addMetric(itemKey, { watch, ttlSeconds, load })`
    shows a number on the item's card, and `addGroupSummary(groupKey, …)` a live line under the
    section's name. Only actionable numbers (due today, overdue, waiting…), already formatted, at most
    one value and one badge; `tone: 'urgent'` only for something overdue or at risk. `load` runs as the
    user (respects user groups), is cut after 2 s and cached for `ttlSeconds` (60); list in `watch` the
    entities whose changes make it stale. Keep each `load` to one cheap query (≤ ~300 ms): the
    Flutter app asks the numbers one at a time.

---

## 📄 Code Blueprint (plugin `index.ts`)

```typescript
glyvio_core.routerService.loadRoutes([<Entity>ListPageRoute, <Plugin>SettingsPageRoute]);

// Full menu: a group with its items
glyvio_core.menuRegistryService.addGroup({
  key: '<plugin>.main',
  name: '$T{<plugin>_menu_group}',
  subtitle: '$T{<plugin>_menu_groupSubtitle}',
  iconName: 'sax_linear_document_text',
  position: 100,
  flow: 30,
  colorTheme: 'BLUE',
  items: [
    {
      key: 'push-<plugin>-<entity>-list',
      iconName: 'sax_linear_document_text',
      title: '$T{<plugin>_menu_<entity>List}',
      subtitle: '$T{<plugin>_menu_<entity>ListSubtitle}',
      colorTheme: 'BLUE',
      route: new <Entity>ListPageRoute(),
      primary: true, // one of the section's 3–4 main options in the full menu
      // Optional: a sidebar version of the screen. The command palette (Ctrl/⌘ K) offers it as
      // "abrir ao lado" (Ctrl/⌘ ↵): it opens over whatever page is on screen, which stays.
      sideRoute: new <Entity>TableSidebarRoute(),
    },
  ],
});

// Optional live number on the item's card in the full menu (rule 10)
glyvio_core.menuRegistryService.addMetric('push-<plugin>-<entity>-list', {
  watch: ['<entity>'],
  load: async () => ({ value: '3', label: '$T{<plugin>_menu_<entity>Overdue}', tone: 'urgent' }),
});

// An item that opens a server-rendered Custom Page (skill create-custom-page)
glyvio_core.menuRegistryService.addItem('<plugin>.main', {
  key: 'page-<plugin>-dashboard',
  iconName: 'sax_linear_chart_2',
  title: '$T{<plugin>_menu_dashboard}',
  type: 'OPEN_CUSTOM_PAGE',
  data: { name: '<controller-path>', isPublic: false, parameters: {} },
});

// Admin screen: a settings page in the built-in "System" section
glyvio_core.adminRegistryService.addItem(glyvio_core.AdminRegistryService.SECTION_SYSTEM, {
  key: 'push-<plugin>-settings',
  iconName: 'fa_sliders',
  title: '$T{<plugin>_admin_settings}',
  subtitle: '$T{<plugin>_admin_settingsSubtitle}',
  route: new <Plugin>SettingsPageRoute(),
});

// Or a dedicated admin section for an integration
glyvio_core.adminRegistryService.addSection({ key: '<plugin>.integration', name: '$T{<plugin>_admin_integration}', position: 45 });
```

---

## ✅ Completion Checklist

- [ ] Routes loaded and view classes exported before the entries are registered.
- [ ] Menu vs. admin chosen per screen; no `FullMenuPage.fullMenuGroupAdd`, no `'main-cruds'`.
- [ ] Stable, namespaced keys; group created before `addItem`.
- [ ] Icons checked; texts in every `.arb`; entries visible (and hidden without permission) in `test-plugin-browser`.
