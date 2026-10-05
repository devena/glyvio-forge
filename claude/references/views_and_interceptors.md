<!-- Generated from src/references/views_and_interceptors.md by tools/generate.py. Edit the source, not this file. -->
# Views, Routes and Interceptors — the public contract

Everything here is declared in `plugin/app/@types/glyvio_core.d.ts` of a plugin project. When this
page and the `.d.ts` disagree, **the `.d.ts` of the target project wins** (it matches the Glyvio
version the plugin is built against).

---

## 1. Route ↔ view ↔ export (the rule that breaks screens silently)

A screen is three things that must agree:

| Piece | Where | Must |
| --- | --- | --- |
| Route class (`extends glyvio_core.*Route`) | your plugin | return a unique `getRoutePath()` (per route type), your plugin namespace in `getRouteNameSpace()`, and **the exact class name of the view** in `getRouteNameObject()` |
| View class (`extends glyvio_core.Simple*`) | your plugin | call `super(<RouteClass>)` in its constructor |
| Export | plugin `index.ts` (or a barrel it re-exports) | `export * from './path/to/view_file'` so the class is reachable as `<namespace>.<ClassName>` at runtime |

Then register the route once, at load time:

```typescript
glyvio_core.routerService.loadRoutes([MyListPageRoute, MyEditModalRoute /* ... */]);
```

- The app resolves a route to `globalThis[<nameSpace>][<nameObject>]`. If the class is not
  exported, or `getRouteNameObject()` has a typo, the screen **does not open** and the console logs
  `[glyvio] A rota ... aponta para ns.Name, mas o plugin não exporta essa classe` (or `... não é uma
  tela`). The build is still green — always check the export, not just `loadRoutes`.
- `getRoutePermission()` returns a `glyvio_permissions.*` value declared in your `manifest.json`
  (skill `modify-manifest`), or `undefined` for routes any logged user may open.
- Routes that must work offline: `glyvio_core.routerService.addOfflineAvailableRoutes([...])`, only
  for screens whose data/actions are guaranteed to work offline.

---

## 2. View lifecycle (every page, modal, sidebar, cart, side panel)

1. `initState(state)` — once, when the view is mounted. Read `state.routeParams`, set defaults,
   `state.userConfigKey = '...'` + `await this.loadUserConfig(state)` when the view persists
   per-user preferences (`fromUserConfig`/`toUserConfig`).
2. `refreshState(state)` — whenever data must be (re)loaded. Trigger it yourself with
   `this.callRefreshState()` (never inside `events`: the framework already refreshes after events).
3. `getDesign(state, design)` — builds the layout. Called after every state change. Pure: no I/O.
4. `events(state, action)` — every user action whose `key` does not start with `_`. Return:
   - `'STATE_UPDATE'` — re-render with the current state;
   - `'STATE_FREEZED'` — you navigated (push/pop) and the framework must not re-render;
   - `undefined` — not handled (the framework reports an error to the client).

Keys starting with `_` are **reserved for the framework**: never use them for your own actions.

### Navigation and feedback (methods available on every view)

| Need | Call |
| --- | --- |
| Open a page / modal / sidebar / cart | `await this.pushPage(route)`, `pushModal(route)`, `pushSidebar(route)`, `pushCart(state, route)` → return `'STATE_FREEZED'` |
| Close the current modal (optionally returning data to the opener) | `await this.popModal(new glyvio_core.Action({ key, data }))` → return `'STATE_FREEZED'` |
| Close the cart | `await this.popCart()` |
| Deep link | `await this.pushFromUrl(path)` |
| Toast | `showToastSuccess / Warning / Info / Error(state, title, subtitle?)` |
| Blocking dialog (one button) | `showDialogSuccess / Warning / Info / Error(state, title, subtitle?, buttonText?)` |
| Confirmation (OK / Cancel → fires your action keys) | `showConfirmationSuccess / Warning / Info / Error(state, title, subtitle, keyActionOk, dataActionOk, keyActionCancel?, dataActionCancel?, labelOk?, labelCancel?)` |
| Progress dialog | `showProgress(state, { title?, subtitle?, progress? }, id?)` … `hideProgress(state, id?)` |
| Validate the form before saving | `if (!(await this.validateForm(state))) return 'STATE_UPDATE';` (+ `getFieldErrors` for custom rules, `markFormClean` after saving) |
| Focus a field | `this.requestFocus(fieldKey)` |
| Open a Custom Page (server HTML) | `await this.openCustomPage(name, isPublic?, parameters?)` (skill `create-custom-page`) |
| Open an external URL | `await this.openExternalUrl(url)` |
| Copy to clipboard | `await this.copyToClipboard(text)` |
| Play / stop an audio attachment | `audioPlay(attachmentId)` / `audioStop()` |
| Default user group of the logged user | `this.getDefaultUserGroupId()` |
| Who else is on this screen | `getScreenPresenceToTrack` + `getPresenceList(state, id)` / `amIAloneOnScreen(state, id)` |
| Real-time refresh when records change | `getEntitiesListenning(state)` returning `glyvio_core.EntityListenning[]` |
| Server push on a channel | `getRpcId(state)` + `onRpcReceived(state, action)` |

Modals that return a value to their opener use `routeParams.popActionKey`: the opener receives an
action with that key in its own `events()` (see skill `use-builtin-dialogs`).

### Jeannie (AI assistant) context

A view may describe itself to the assistant with `getJeannieContext(state)` returning a
`glyvio_core.CoreJeannieContext`: `{ text, viewName, jsonData, actions: { key, description }[] }`.
Interceptors extend it in `populateJeannieContext(state, context)` — merge into the received object,
never replace it.

---

## 3. Interceptors (customize a screen you do not own)

An interceptor customizes an existing view — from the Glyvio core or from another plugin — without
touching its code.

```typescript
export class MyTaskSidebarInterceptor extends glyvio_core.TabSidebarInterceptor<glyvio_core.TaskSidebarState> {
  getListenerId(): string {
    return 'my_plugin.task_sidebar';           // unique, stable
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return glyvio_core.TaskSidebarRoute;        // the route of the screen being customized
  }

  getDesign(state: glyvio_core.TaskSidebarState, design: glyvio_core.TabSidebarDesign): void {
    // mutate the design the view already built
  }
}

// once, at load time (plugin index.ts):
glyvio_core.appInterceptorService.registerInterceptors([
  { interceptor: MyTaskSidebarInterceptor, order: 10 }, // lower order runs first (default 0)
]);
```

Base class to extend: the `<ViewBase>Interceptor` that matches the base of the target view
(`SimpleListPageInterceptor`, `TabSidebarInterceptor`, ...). When a class in the `.d.ts` carries the
JSDoc `"You MUST extend this instead."`, extend that one.

Hooks every view interceptor inherits (`CoreAppInterceptorView<S, V>`):

| Hook | Runs |
| --- | --- |
| `onInitState(state)` | after the view's `initState` |
| `onRefreshState(state)` | after the view's `refreshState` |
| `onUpdateState(key, oldState, newState)` | after each state transition |
| `onRunStrategy(key, oldState, newState)` | after each lifecycle transition (strategies) |
| `onEvent(state, key, data)` | **after** the view's own `events()` finished — a side effect, not a "before" hook; it cannot cancel what the view did, but it can handle a brand-new key you added yourself |
| `getEntitiesListenning(state, list)` | push extra `EntityListenning` entries |
| `getRpcId(state, rpcId)` / `onRpcReceived(state, action)` | server push |
| `getScreenPresenceToTrack(state, id)` | presence id |
| `getView()` | the view instance (to call its public methods, e.g. `getView().showToastInfo(...)`) |

Each view family adds its own hooks (`getDesign`, `getDesignForCell`, `getDesignForRow`,
`populateQueryBuilder`, `populateMainFilter`, `populateJeannieContext`, `onSave`, ...). The
`create-*-interceptor` skills list them per family; the `.d.ts` is the final word.

Rules:

- Find widgets to change with `design.findWidgetByKey('<key>')` and keep the existing `key`s you do
  not own intact — other interceptors may look for them.
- Discover the keys of a screen you do not own at runtime: log the design inside your interceptor's
  `getDesign` (`console.log(JSON.stringify(design))`) or read it with the AI bridge
  (`getDesign()`, skill `test-plugin-browser`).
- An interceptor only sees what the view routes through a declared hook. Reserved `_` actions
  (uploads, internal navigation) never reach `onEvent`.
- Several interceptors may target the same view; they run in `order`, each one receiving what the
  previous left.

### Service interceptors (no view)

`glyvio_core.CoreAppInterceptorService<R, T>` reacts to a named event instead of a route —
e.g. `InitInterceptorService` (runs once when the app boots) and
`ReloadUserPreferenceInterceptorService` (language/theme changed). Implement `getListenerId()` and
`handle(request)`, and register it the same way.
