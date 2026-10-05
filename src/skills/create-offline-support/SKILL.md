---
name: create-offline-support
description: "Makes plugin screens usable without connection: declares which entities (and which rows, with indexes) are synced to the device (SimpleOfflineEntityInterceptor + OfflineEntityConfig), marks the routes that work offline (routerService.addOfflineAvailableRoutes) and saves changes into the local sync queue (localDatabaseService.saveListToSync)."
---
# Agent Skill: Offline Support

Three independent pieces; a screen is truly offline only with all three.

| Piece | API | Effect |
| --- | --- | --- |
| Data on the device | a class extending `glyvio_core.SimpleOfflineEntityInterceptor` returning `glyvio_core.OfflineEntityConfig[]` | the app downloads those entities (rows filtered by `predicate`) to the local database |
| Screens allowed offline | `glyvio_core.routerService.addOfflineAvailableRoutes([<Route>, ...])` at load time | these routes can be opened while offline; others are blocked |
| Writes while offline | `await glyvio_core.localDatabaseService.saveListToSync(entities, label?, routeToCheck?)` | changes go to the local queue and are synced when the connection comes back |

Every plugin contributes its own slice: the app concatenates the lists of all registered offline
interceptors. An entity no interceptor mentions is not available offline. Glyvio itself already
lists its base entities (users, groups, tags, tasks, attachments, notifications, ...).

---

## 📥 Required Input Parameters

1. Screens that must work offline (routes) and what they read/write.
2. For each entity read offline: which rows are needed (`predicate`) and which fields are filtered (indexes).
3. Writes made offline and the label to show while syncing.

---

## 🚫 Rules

1. `entityName` and every field in `predicate`/`indexes` use the entity's **friendly name** (as in
   `manifest.json`), never physical table/column names.
2. Always restrict big tables with a `predicate` (e.g. only the logged user's open orders) and add
   `indexes` for the predicate fields (equality columns first, range last). A predicate referencing
   an unknown field makes the app skip that entity entirely (fail closed).
3. Mark a route offline only if **everything** it does works offline: no controller calls
   (`restService`), no environment actions, no data outside the declared entities.
4. Offline writes need `id` on every entity (`await glyvio_entity.X.new()` already sets one) and
   `userGroupId` on new records.
5. Register the interceptor once in `index.ts` with `appInterceptorService.registerInterceptors`.

---

## 📄 Code Blueprint

```typescript
export class <Plugin>OfflineEntities extends glyvio_core.SimpleOfflineEntityInterceptor {
  getListenerId(): string {
    return '<plugin>.offline_entities';
  }

  getOfflineEntities(): glyvio_core.OfflineEntityConfig[] {
    return [
      new glyvio_core.OfflineEntityConfig({ entityName: '<small_entity>' }), // whole table
      new glyvio_core.OfflineEntityConfig({
        entityName: '<big_entity>',
        predicate: "deleted = false AND <status_field> != 'CANCELED'",
        indexes: [['deleted', '<status_field>']],
      }),
    ];
  }
}

// plugin index.ts
glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Plugin>OfflineEntities }]);
glyvio_core.routerService.addOfflineAvailableRoutes([<Entity>ListPageRoute, <Entity>EditModalRoute]);

// saving from an offline-capable screen
async function saveOffline(entity: glyvio_entity.<EntityName>): Promise<void> {
  await glyvio_core.localDatabaseService.saveListToSync([entity], '$T{<plugin>_saving}', undefined);
}
```

---

## ✅ Completion Checklist

- [ ] Every entity read offline is declared, with predicate + indexes for big tables (friendly names only).
- [ ] Only routes that fully work offline are marked.
- [ ] Offline writes go through `saveListToSync` with ids and `userGroupId`.
- [ ] Tested by switching the app to offline mode (or disconnecting) in `test-plugin-browser`.
