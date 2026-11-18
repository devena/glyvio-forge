---
name: create-offline-support
description: "Makes plugin screens usable without connection on the mobile app: registers an offline download profile (glyvio_core.offlineProfileService.register + OfflineProfile) with the data tasks the role needs (entity + server-side scope + indexes), the attachments that go to the device (OfflineAttachmentTask) and the screens allowed offline; the user picks the profile in the app's Sync Monitor. Also covers the legacy SimpleOfflineEntityInterceptor, routerService.addOfflineAvailableRoutes and offline writes."
---
<!-- Generated from src/skills/create-offline-support/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Offline Support (download profiles)

Offline works **only in the mobile app** (Android/iOS). The user turns offline mode on by hand in the
Sync Monitor and picks a **download profile** there. A profile is what one role needs to work in
the field (e.g. "Vendedor"): the data downloaded to the device, the attachments, and the screens that
open offline.

| Piece | API | Effect |
| --- | --- | --- |
| Profile | `glyvio_core.offlineProfileService.register(new glyvio_core.OfflineProfile({...}))` at load time | shows up in the Sync Monitor for users with `permission` |
| Data | `tasks: new glyvio_core.OfflineDataTask({ entityName, scope, indexes, label })[]` | rows of `scope` are downloaded, in task order; each task is a progress line |
| Attachments | `attachments: new glyvio_core.OfflineAttachmentTask({ entityName, mode, maxSizeMb, contentTypes, wifiOnly })[]` | files of the downloaded records go to the device |
| Screens | `routes: [<Route>, ...]` | open offline while the profile is selected (entity modals of the task entities are added automatically) |
| Writes | normal saves (`entityService.saveList`, `glyvio_entity.X.save()`) | in offline mode they go to the local queue and are sent when back online |

The core always downloads its base entities with any profile (users, groups, tags, attachment types,
permissions, task types). Tasks list only what the role adds — including `task`, scoped.

---

## 📥 Required Input Parameters

1. The role and the screens it uses in the field (routes).
2. For each entity those screens read: which rows the role needs (the `scope`).
3. Which attachments must open offline (thumbnail only, or the file; Wi-Fi only?).

---

## 🚫 Rules

1. **`scope` runs only on the server** (download and the daily reconciliation, through
   `query-for-user`, which applies the user's permissions). It may use subqueries over other
   entities. It is never applied on the device: rows that leave the scope are removed by the
   reconciliation. Use `friendlyName`s only, never physical names.
2. Macros in `scope`: `$me.id` (logged user), `$today` (`'YYYY-MM-DD'`), `$daysAgo(n)`. They become
   quoted literals. An unknown macro makes the app skip that task.
3. Order matters: a task's `scope` may reference earlier entities (clients before orders, orders
   before items). Repeat the parent scope in the child (`sale_id in (select id from sale where …)`).
4. Always bound big tables (open records, last N days, the user's own) and add `deleted = false`.
   Add `indexes` for the fields the screens filter by (equality first, range last).
5. Mark a route only if **everything** it does works offline: no `restService`, no environment
   action, no report, no send modal, no `sequenceService`; every entity it queries is in the profile
   (an entity outside it just comes back empty).
6. Screen SQL runs as-is on SQLite. The app rewrites `ILIKE`, `::casts`, `string_agg`,
   `convert_to(x,'UTF8')` and `now()`; anything else Postgres-only (`jsonb` operators, `DISTINCT ON`,
   `to_char`, `date_trunc`, `interval`, `~`) breaks offline — avoid it in offline screens.
7. Attachments: up to 20 MB per file (`maxSizeMb` is capped); `mode: 'FULL'` defaults to Wi-Fi only;
   `maxAttachmentsMb` on the profile caps the total (default 500). A file picked while offline (≤ 20
   MB) is kept on the device and sent by the queue before the record that links it.
8. Offline writes need `id` on every entity (`await glyvio_entity.X.new()` sets one) and `userGroupId`
   on new records. A write the server rejects (400/422) is undone on the device and the user is told.

---

## 📄 Code Blueprint

```typescript
const MINE = 'select client_id from client_salesperson where app_user_id = $me.id and deleted = false';
const ORDERS = `deleted = false and client_id in (${MINE}) and created_at >= $daysAgo(365)`;

export function register<Plugin>OfflineProfile(): void {
  glyvio_core.offlineProfileService.register(
    new glyvio_core.OfflineProfile({
      key: '<plugin>.<role>',
      label: '$T{<plugin>_offlineProfile_<role>}',
      description: '$T{<plugin>_offlineProfile_<role>Description}',
      permission: glyvio_permissions.view_<main>_table_page,
      tasks: [
        new glyvio_core.OfflineDataTask({ entityName: 'product', scope: 'deleted = false' }), // catalog
        new glyvio_core.OfflineDataTask({
          entityName: 'client',
          scope: `deleted = false and id in (${MINE})`,
          label: '$T{<plugin>_offlineTask_clients}',
        }),
        new glyvio_core.OfflineDataTask({ entityName: 'sale', scope: ORDERS, indexes: [['client_id']] }),
        new glyvio_core.OfflineDataTask({
          entityName: 'sale_item',
          scope: `deleted = false and sale_id in (select id from sale where ${ORDERS})`,
          indexes: [['sale_id']],
        }),
      ],
      attachments: [
        new glyvio_core.OfflineAttachmentTask({ entityName: 'sale', mode: 'THUMB' }),
        new glyvio_core.OfflineAttachmentTask({ entityName: 'sale', mode: 'FULL', wifiOnly: true }),
      ],
      routes: [ClientTablePageRoute, ClientSidebarRoute, SaleTablePageRoute, SaleSidebarRoute],
    }),
  );
}

// plugin index.ts
register<Plugin>OfflineProfile();
```

### Legacy (profile "Padrão")

Without a profile selected the app uses the entities of every `SimpleOfflineEntityInterceptor`
(`OfflineEntityConfig` with `predicate`, applied on the server **and** as the local view's `WHERE`,
so no subqueries) plus the routes of `glyvio_core.routerService.addOfflineAvailableRoutes([...])`.
Keep it only for existing plugins; new work uses profiles.

---

## ✅ Completion Checklist

- [ ] Profile registered once in `index.ts`, `key` prefixed by the plugin, label/description translated.
- [ ] Every entity the screens read is a task, big ones bounded, with `deleted = false` and indexes.
- [ ] Child tasks repeat the parent scope; tasks in dependency order.
- [ ] Only routes that fully work offline (no controller, report, send modal, Postgres-only SQL).
- [ ] Tested on the phone: pick the profile in the Sync Monitor, wait for the first load, turn offline
      mode on, open each screen, save, turn it off and check the queue was sent.
