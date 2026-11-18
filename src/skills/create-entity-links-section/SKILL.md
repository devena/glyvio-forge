---
name: create-entity-links-section
description: "Adds a \"Links\" (Vínculos) card to an existing sidebar or tab-sidebar with the core's ready-made EntityLinksSection: links to records of any type through the core link picker (one search over every type, several at once), shown as cards grouped by type, removed with Undo, backed by a dedicated `<owner>_entity` join table."
---
# Agent Skill: Add an Entity Links Card in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to add a "Links" (Vínculos) card to an existing `SimpleSidebar`/`TabSidebar` — a generic way to link a record to records of any other type (a complaint linked to a sale and a client, a meeting linked to a person).

The core ships the whole flow as one class, `glyvio_core.EntityLinksSection`: the card, the picker, saving, removing with Undo and the user group of each link. A screen only configures it and wires three calls. **Do not hand-write the old "pick a type, then pick a record" flow** (`SimpleChoiceModalRoute` over `AllEntities.allEntities()` + an entity modal): it listed technical structure names and is replaced by the core picker.

The core's own task sidebar uses it (`taskLinks`), as do the complaint sidebar of the CRM plugin (`complaintLinks`) and the meeting sidebar of the travel plugin (`meetingLinks`).

---

## 🎯 Skill Metadata

- **Name**: `create_entity_links_section`
- **Description**: Adds a "Links" card to an existing sidebar with `glyvio_core.EntityLinksSection`, backed by a polymorphic `<owner>_entity` join table.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

1. **Owner Entity** (e.g., `Complaint`, `Meeting`): the entity whose sidebar gets the card.
2. **Join Entity** (e.g., `ComplaintEntity`, `MeetingEntity`): the polymorphic join table — `{ <owner>_id, entity_name, entity_id, user_group_id, deleted }`. Confirm it exists in `@types` (`glyvio_entity.<JoinEntityName>`, `glyvio_structure.AllEntities.<joinEntityCamelCase>`). If it doesn't, this is a schema change (`modify-manifest`) that must be published first.
3. **Target Sidebar File**: the existing `SimpleSidebar`/`TabSidebar` subclass.
4. **Add-link Permission** (e.g., `glyvio_permissions.core_complaint_entity_insert`): the join entity's insert permission, checked in the owner's group.
5. **Card Placement**: where in the sidebar's sections the card goes (follow the sidebar's own layout; usually after the main details).
6. **Allowed types** (optional): restrict the picker to some types (e.g. a complaint links only `client` and `sale`). Default: every linkable type the user may open.

---

## 🚫 Environment Constraints & Rules

1. **No imports for Glyvio globals**: `new glyvio_core.EntityLinksSection(...)`, `glyvio_core.entityLinkService`, never imported.
2. **Requires a core that has `EntityLinksSection`**: check `plugin/app/@types/glyvio_core.d.ts` for `class EntityLinksSection`. If it is missing, the core this plugin compiles against is older; update the types before writing the code. A plugin using it must not be released before that core is published.
3. **Never hardcode entity types in the flow**: the picker searches every registered type through each type's own entity modal (its query, filters and interceptors). To offer a type the core does not know, **register it** (Step 5) — never add `if (structureName === 'sale')` branches.
4. **One instance per render, built from the state**: create the section in a method (`linksSection(state)`) and call it from `refreshState`, `events` and the design — it holds no state of its own; its data lives in `state[key]`.
5. **`events()` return**: when `handle` returns `true`, return `'STATE_UPDATE'` (it changed the state). Keep any old action keys other code may send (`addLink`) by forwarding them to `<key>.add`.
6. **Removing a link soft-deletes the join row only** — the section does this; never delete the linked record.
7. **A link has the group of the record it points to** (the section saves it that way). Declare the join table with `@glyvio_core.EntityLink` on the server (Step 4) so links follow when that record changes group.

---

## 📋 Execution Steps

### Step 1: The section

Add to the sidebar class:

```typescript
/** The "Links" card: the <owner>'s `<owner>_entity` links (core picker, cards, undo). */
linksSection(state: <OwnerName>SidebarState): glyvio_core.EntityLinksSection {
  const owner = state.<ownerNameCamelCase>;
  return new glyvio_core.EntityLinksSection({
    key: '<ownerNameCamelCase>Links',
    linkStructure: glyvio_structure.AllEntities.<joinEntityCamelCase>,
    ownerField: '<ownerNameSnakeCase>_id',
    ownerId: owner?.id,
    ownerEntityName: glyvio_structure.AllEntities.<ownerNameCamelCase>.getStructureName(),
    ownerUserGroupId: owner?.userGroupId,
    ownerLabel: owner?.name ?? undefined,
    title: '$T{<pluginNamespace>_sidebar_<ownerNameSnakeCase>_links}',
    // allowedTypes: ['client', 'sale'],
    canEdit:
      !!owner &&
      owner.deleted == false &&
      glyvio_core.permissionService.hasPermissionInGroup(
        glyvio_permissions.<ownerNameSnakeCase>_entity_insert,
        owner.userGroup?.id ?? owner.userGroupId,
      ),
  });
}
```

`ownerField` and the optional `entityNameField` / `entityIdField` are **column names** of the join table (snake_case). `ownerEntityName` keeps the record itself out of the picker. `suggestions` (optional) offers records before anything is typed, each with a short reason (`{ entityName, entityId, reason }`).

### Step 2: Load, handle, draw

```typescript
// refreshState, after the owner is loaded:
await this.linksSection(state).load(state);

// events(state, action), before the screen's other keys:
if (action.key == 'addLink') {
  // Kept for callers of the old key.
  await this.linksSection(state).handle(this, state, new glyvio_core.Action({ key: '<ownerNameCamelCase>Links.add', data: {} }));
  return 'STATE_FREEZED';
}
if (await this.linksSection(state).handle(this, state, action)) {
  return 'STATE_UPDATE';
}

// design, where the card goes:
new glyvio_core.FormSectionDesign({
  key: 'links.section',
  cleanDesign: true,
  childDesign: this.linksSection(state).design(state),
}),
```

The card has its own title and "Link" button; do not wrap it in an app bar with another title.

### Step 3: Remove the old flow (when migrating)

Delete the hand-written `addLink` → `SimpleChoiceModalRoute` → `addLinkStructureBack` → entity modal → `addLinkEntityBack` chain, any helper that built the type list, and the `EntityLinksDesign` section. Keep public methods other plugins may override (`addLink`/`removeLink`) and the `<owner>Entities` state if interceptors or the Jeannie context read it.

### Step 4: Server — links follow the linked record's group

```typescript
// plugin/server/src/... — no imports needed, all symbols are global.
@glyvio_core.EntityLink({ entity: glyvio_entity.<JoinEntityName> })
export class <JoinEntityName>Link {}
```

Pass `entityNameField` / `entityIdField` when the columns are not `entity_name` / `entity_id`. When whoever sees the link must also see the owner, give the owner `views.customPermissions` through the join table (see `modify-manifest`).

Links created elsewhere use the same contract: in the app, `glyvio_core.entityLinkService.linkInput(target, input, fallbackUserGroupId)` (async); in the server layer, the same call is synchronous.

### Step 5 (optional): make your plugin's types linkable

The picker offers the types the core registers (client, person, sale, product, supplier, purchase, campaign, complaint, task, conversation, meeting, project…) that exist in the company and whose entity modal the user may open. Register your own records once, in the plugin's app entry:

```typescript
glyvio_core.entityLinkService.registerType({
  entityName: 'inspection',
  label: '$T{<pluginNamespace>_entityLink_inspection}',
  icon: 'sax_linear_clipboard_text',
  color: 'INDIGO',
  order: 45,
});
```

The entity needs an entity modal (`/<entity>-entity` route): the picker searches and labels records through it (`_fetchItems` and its chip). The same call changes the label or icon of a type the core already registers.

### Step 6: i18n

Only the card title is the plugin's (`<pluginNamespace>_sidebar_<ownerNameSnakeCase>_links`, e.g. "Vínculos"/"Links") plus the labels of any type registered in Step 5. The picker, the buttons, Undo and the core's type names come translated from the core. Add the keys to every `.arb` of the plugin.

---

## ✅ Self-Correction Checklist

- [ ] Does `@types/glyvio_core.d.ts` have `EntityLinksSection`? → Update the types (and wait for that core to be published before releasing).
- [ ] Is the section built in one method and used in `refreshState` (`load`), `events` (`handle`) and the design (`design`)? → Fix.
- [ ] Are `ownerField` / `entityNameField` / `entityIdField` column names (snake_case)? → Fix.
- [ ] Is `canEdit` the join entity's insert permission in the owner's group, false for a deleted owner? → Fix.
- [ ] Was the old type-list flow removed, with no hardcoded entity switch left? → Fix.
- [ ] Is the join table declared with `@glyvio_core.EntityLink` on the server? → Add it.
- [ ] Do the plugin's own linkable records appear in the picker (Step 5) and have translated labels? → Register them.
