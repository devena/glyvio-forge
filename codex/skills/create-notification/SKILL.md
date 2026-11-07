---
name: create-notification
description: "Generates code that delivers an in-app notification (title, description, optional click-through routing to a sidebar or modal) to a user group or an explicit list of users via crm.GenerateNotificationStrategy, normally embedded inside an existing AfterInterceptor or Strategy. Also registers the notification's type (colored tag and filter tab on the notification list) with notificationTypeRegistryService.register."
---
<!-- Generated from src/skills/create-notification/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create Notification in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to deliver an in-app notification to users via the `crm` plugin's `GenerateNotificationStrategy`.

This is **not** a standalone file-creation skill like `create-after-interceptor`. A notification is a side-effect you add *inside* a hook you are already writing (usually an `@AfterInterceptor`, sometimes a `Strategy` or queued interceptor). Use [[create-after-interceptor]] first to scaffold the hook itself if one doesn't already exist for this entity/event. If you also need to record this event as an activity-feed entry (not just alert someone), see [[create-timeline-entry]] — the two are frequently used together but are independent calls with independent inputs.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_notification",
  "description": "Generates code that delivers an in-app notification to a user group or explicit user list via crm.GenerateNotificationStrategy.pushToQueue / pushToQueueForUsers.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase that depends on the crm plugin.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "The notification title."
      },
      "description": {
        "type": "string",
        "description": "Optional longer body text, interpolating live field values."
      },
      "targetMode": {
        "type": "string",
        "enum": ["userGroup", "explicitUsers"],
        "description": "Whether to broadcast to every member of a UserGroup holding a given permission, or to an explicit list of user ids."
      },
      "userGroupId": {
        "type": "string",
        "description": "Required when targetMode is 'userGroup' — the id of an EXISTING UserGroup record."
      },
      "permissionId": {
        "type": "string",
        "description": "Required when targetMode is 'userGroup' — the id of an EXISTING permission from manifest.json filtering which group members receive it."
      },
      "forceUsersId": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Required when targetMode is 'explicitUsers' — the explicit list of user ids to notify."
      },
      "routeType": {
        "type": "string",
        "enum": ["none", "sidebar", "modal"],
        "description": "Optional click-through action when the user opens the notification."
      }
    },
    "required": ["title", "targetMode"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Title** (e.g., `Novo pedido aguardando aprovação`): short notification headline.
2. **Description** (optional): longer body, interpolating live field values from the triggering entity.
3. **Recipient Strategy**: either
   - a **UserGroup** (`userGroupId`) + **Permission** (`permissionId`) — broadcasts to every member of that group holding that permission, or
   - an **explicit user id list** (`forceUsersId`) — e.g. the sale's `salesPerson`, resolved via `findById` (see constraint #5).
4. **Click-Through Routing** (optional): whether opening the notification should navigate to a sidebar (`routeSidebar`) or a modal (`routeModal`), and which path/params it needs.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No Import — Global Namespace**: `crm` is injected globally at runtime. Never `import` it. Use `crm.GenerateNotificationStrategy.pushToQueue(...)` / `.pushToQueueForUsers(...)` directly.
2. **`crm` Must Be a Declared Dependency**: Confirm `manifest.json`'s root `"dependencies"` array contains `{"pluginName": "crm", "version": "latest"}`. If missing, add it first (see [[modify-manifest]]).
3. **Two Distinct Entry Points — Do Not Mix Their Signatures**:
   - `GenerateNotificationStrategy.pushToQueue(args, permissionId, userGroupId)` — broadcasts to every member of `userGroupId` who also holds `permissionId`. Both are separate positional arguments, **not** part of `args`.
   - `GenerateNotificationStrategy.pushToQueueForUsers(args, forceUsersId?)` — targets explicit user ids. Always pass `forceUsersId` explicitly for this entry point; omitting it relies on undocumented default targeting in `DefaultGenerateNotificationStrategy` and should not be assumed safe.
4. **`userGroupId` / `permissionId` Are Real Foreign Keys**: Both must reference existing records — a real `UserGroup` row and a real permission id already declared in this plugin's (or a dependency's) `manifest.json` `"permissions"` array. Do not invent a new permission id here; if the notification needs a brand-new permission gate, add it via [[modify-manifest]] first.
5. **Related Entities Are NOT Pre-Loaded Inside Interceptors**: If recipients or message content depend on a related entity (e.g. notifying the sale's `salesPerson`, or interpolating the `client`'s name into the description), fetch it explicitly — it is not populated on `value`:
   ```typescript
   const salesPerson = glyvio_entity.AppUser.findById(value.salesPersonId);
   ```
   Never read `value.<relationGetter>` directly and assume it's non-null just because the type says so.
6. **Routing Is Mutually Exclusive**: Set at most one of `routeSidebar` / `routeModal` per notification — they represent alternative click-through destinations, not a combined action. `sidebarParams`/`modalParams` are untyped key maps (`{[key: string]: unknown}`) — populate them with exactly the parameter names the target sidebar/modal route actually expects; verify against that route's definition rather than guessing key names.
7. **Don't Wrap in Try-Catch**: Same as `create-after-interceptor` — let errors bubble up unless the user explicitly asks for suppression.

---

## 📋 Execution Steps

### Step 1: Locate or Create the Surrounding Hook

Confirm an `@AfterInterceptor` (or equivalent) already exists for the triggering entity/event. If not, run [[create-after-interceptor]] first.

### Step 2: Resolve Recipients / Related Entities Explicitly

Fetch anything `value` doesn't already carry — recipient ids, names used in the message, etc.

### Step 3: Push the Notification

Insert the `pushToQueue`/`pushToQueueForUsers` call inside `handleAfter`, after the trigger-condition guard.

### Step 4: Build & Validate

Compile the server workspace (`pnpm run build` / project's webpack build) to confirm types resolve.

### Step 5 (Optional): Register the Type

If this is a new kind of notification, register its type on the app side (see **Notification Types**) and compile the app workspace too.

---

## 🏷️ Notification Types (Tag and Filter Tab)

The notification list (`/notification-list`) groups rows by day and can show a colored tag per type, plus one filter tab per type. A plugin declares its types **once, on the app side**, with `glyvio_core.notificationTypeRegistryService.register`. It is optional: without it the notification still works, with no tag.

`GenerateNotificationStrategy` has **no type argument** and the `notification` entity has no type column. The type comes from the screen the notification opens, so a registered type also applies to notifications saved before the registration.

```typescript
// plugin/app/src/index.ts, at load time (same place as menuRegistryService)
glyvio_core.notificationTypeRegistryService.register({
  key: '<plugin>.sale',
  label: '$T{<plugin>_notification_type_sale}',
  colorTheme: 'GREEN',
  paths: ['/sale-view'],
});
```

```typescript
// plugin/server: the path above is the one the notification routes to
crm.GenerateNotificationStrategy.pushToQueueForUsers(
  {
    title: `<Notification title>`,
    routeSidebar: { sidebarPath: '/sale-view', sidebarParams: { id: value.id! } },
  },
  [userId],
);
```

| Field | Meaning |
| --- | --- |
| `key` | Unique and stable; namespace it with the plugin. Registering the same key again replaces the type. |
| `label` | Text of the tag and of the tab. Use a `$T{}` key present in every `.arb`. |
| `colorTheme` | Theme name of the tag (`GREEN`, `VIOLET`, `ORANGE`...). Read rows show the tag in grey. |
| `paths` | Every screen this type opens: the exact `sidebarPath` / `modalPath` / `cartPath` of the notification, or the path of a plain route. |

Rules:

1. **Match the path exactly**: `paths: ['/sale-view']` does not match `sidebarPath: 'sale-view'` or `'/sale-view-edit'`. Search the plugin's `routeSidebar` / `routeModal` calls and list each path used.
2. **One path, one type**: if two types claim a path, the tag shows the first one registered and the "Outras" counter goes wrong, because it is the total minus the sum of the types.
3. **What the user sees**: tabs appear only when a registered type has notifications. A type with no rows has no tab. A notification with no route, or whose screen no plugin registered, shows no tag and falls under "Outras".
4. **Core version**: `notificationTypeRegistryService` exists from core 0.10.19 on. On an older core the call throws while the plugin loads, so release the plugin only after that version is published.

---

## 📄 Code Blueprint (Template)

```typescript
// Inside handleAfter, after the trigger-condition guard:

// 💡 OPTION A: Broadcast to a UserGroup filtered by permission
crm.GenerateNotificationStrategy.pushToQueue(
  {
    title: `<Notification title, interpolating value.<field>>`,
    description: `<Optional longer body>`,
    // 💡 At most one of the two routing blocks below:
    // routeSidebar: { sidebarPath: '<sidebar-path>', sidebarParams: { id: value.id! } },
    // routeModal: { modalPath: '<modal-path>', modalParams: { id: value.id! } },
  },
  '<existing_permission_id>',
  '<existing_user_group_id>',
);

// 💡 OPTION B: Notify explicit users (e.g. the sale's own salesperson)
// const salesPerson = glyvio_entity.AppUser.findById(value.salesPersonId);
// if (salesPerson) {
//   crm.GenerateNotificationStrategy.pushToQueueForUsers(
//     {
//       title: `<Notification title>`,
//       description: `<Optional longer body>`,
//     },
//     [salesPerson.id!],
//   );
// }
```

---

## ✅ Completion Checklist

- [ ] `crm` confirmed present in `manifest.json` dependencies.
- [ ] Correct entry point used for the intended targeting (`pushToQueue` for group+permission, `pushToQueueForUsers` for explicit ids).
- [ ] `userGroupId` / `permissionId` verified to already exist (not invented).
- [ ] `forceUsersId` passed explicitly when using `pushToQueueForUsers`.
- [ ] Any related entities needed for recipients or message content fetched via `.findById(...)`, never read directly off `value.<relation>`.
- [ ] At most one of `routeSidebar` / `routeModal` set, with param keys matching the real target route.
- [ ] No try-catch unless explicitly requested.
- [ ] If the notification has a type: `register` called once on the app side, every routed path listed exactly, and the label key in every `.arb`.
- [ ] Build passes.
