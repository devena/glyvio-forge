---
name: use-user-preferences
description: "Persists per-user settings of a plugin across sessions and devices with glyvio_core.configService — a plugin preference object (getPluginPreference/setPluginPreference, merged patches) or keyed values (loadConfig/saveConfig/removeConfig) — and per-screen preferences with userConfigKey + fromUserConfig/toUserConfig."
---
<!-- Generated from src/skills/use-user-preferences/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Per-User Preferences

| Need | API |
| --- | --- |
| Preferences of the screen itself (columns, sort, last filter) | `state.userConfigKey = '<KEY>'` + `await this.loadUserConfig(state)` in `initState`; override `fromUserConfig(state, data)` / `toUserConfig(state)`; call `await this.saveUserConfig(state)` after changes |
| A plugin-wide preference object (default warehouse, view mode...) | `await glyvio_core.configService.getPluginPreference<T>('<pluginKey>')` / `await glyvio_core.configService.setPluginPreference('<pluginKey>', patch)` — the patch is **merged** (shallow) into what was saved |
| Free key/value | `loadConfig(key)`, `saveConfig(key, data)`, `removeConfig(key)` |

All of it is stored per user (server-side), so it follows the user across devices. Entity instances
inside the saved data come back as entity instances.

---

## 🚫 Rules

1. Keys are namespaced by plugin (`'<plugin>.<feature>'`); never reuse a core key.
2. Preferences are **not** security: never store something that decides what a user may see or do.
3. Read with a default: `(await getPluginPreference<T>(key)) ?? defaults` — the first time it is `undefined`.
4. Do not store large lists (save ids, not whole records).
5. Settings shared by the whole company belong in an entity of your plugin (and an admin screen), not here.

---

## 📄 Code Blueprint

```typescript
type <Plugin>Prefs = { defaultView?: 'LIST' | 'KANBAN'; lastGroupId?: string };

async function loadPrefs(): Promise<<Plugin>Prefs> {
  return (await glyvio_core.configService.getPluginPreference<<Plugin>Prefs>('<plugin>')) ?? {};
}

async function rememberView(view: 'LIST' | 'KANBAN'): Promise<void> {
  await glyvio_core.configService.setPluginPreference('<plugin>', { defaultView: view });
}
```

Per-screen example (inside a view):

```typescript
// initState:   state.userConfigKey = '<PLUGIN>_ORDERS_PAGE'; await this.loadUserConfig(state);
// toUserConfig(state)  → return { compact: state.compact };
// fromUserConfig(state, data) → state.compact = data?.compact ?? false;
// after toggling: await this.saveUserConfig(state);
```

Some base pages (list, table, dashboard, map) already persist saved filters through `toUserConfig`:
when overriding, call `super` and merge, or you lose them.

---

## ✅ Completion Checklist

- [ ] Namespaced keys; defaults when nothing was saved.
- [ ] No authorization decision based on preferences.
- [ ] Overrides of `toUserConfig`/`fromUserConfig` keep the base page's data.
