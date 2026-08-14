---
name: create-notification
description: 'Generates code that delivers an in-app notification (title, description, optional click-through routing to a sidebar or modal) to a user group or an explicit list of users via crm.GenerateNotificationStrategy, normally embedded inside an existing AfterInterceptor or Strategy.'
---

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
- [ ] Build passes.
