---
name: create-entity-links-section
description: "Adds a \"Links\" section to an existing sidebar (or tab-sidebar), letting the user attach/remove polymorphic links to other entities via a generic pick-a-type-then-pick-a-record flow (EntityLinksDesign), backed by a dedicated `owner_entity` join table."
---
<!-- Generated from src/skills/create-entity-links-section/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Add a Polymorphic Entity Links Section in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to add a "Links" (Vínculos) section to an existing `SimpleSidebar`/`TabSidebar` — a generic, entity-type-agnostic way to attach/detach references to other records (e.g. a Complaint linked to a Sale and a Client, a Task linked to a Meeting).

This exact ~110-line workflow has already been hand-copied at least three times across independent plugins (`glyvio-plugin-core`'s `TaskSidebar`/`TimelinePage` as the original reference, then re-implemented for `ComplaintSidebar` in `glyvio-plugin-crm` and for `MeetingSidebar` in `glyvio-plugin-travel`, each citing "same pattern as TaskSidebar/core" in its commit message). This skill exists so the next occurrence is a skill invocation instead of a fourth from-scratch copy.

---

## 🎯 Skill Metadata

- **Name**: `create_entity_links_section`
- **Description**: Adds a "Links" section to an existing sidebar, backed by a polymorphic `<owner>_entity` join table and the generic `EntityLinksDesign` widget, letting the user attach/detach links to any other linkable entity type.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Owner Entity Name** (e.g., `Complaint`, `Meeting`): The entity whose sidebar gets the new "Links" section.
2. **Join Entity Name** (e.g., `ComplaintEntity`, `MeetingEntity`): The polymorphic join entity — `{ <owner>Id, entityId, entityName, deleted }`. Confirm it already exists in `@types` (`glyvio_entity.<JoinEntityName>`, `glyvio_structure.AllEntities.<joinEntityCamelCase>`) before starting; if it doesn't, this is a schema change (`modify-manifest`) that must land and publish first — this skill only wires the app-layer UI against an already-existing join table.
3. **Target Sidebar File**: The existing sidebar (`SimpleSidebar` or `TabSidebar` subclass) to add the section to.
4. **Add-link Permission** (e.g., `glyvio_permissions.core_complaint_entity_insert`): The permission gating the "add link" button and the join entity's own insert permission — usually already exists if the join entity itself has permission scaffolding; otherwise add it via `modify-manifest` following the `<owner>_entity_insert` naming convention.
5. **Section Placement**: Where in the sidebar's existing `sectionsDesign`/`sectionsContentDesign` array the new section goes (this skill doesn't dictate position — follow the target sidebar's own convention, typically right after the main details section).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Use `new glyvio_core.EntityLinksDesign(...)`, `glyvio_core.SimpleChoiceModalRoute`, etc. — never import them.
2. **This is app-layer only — never invent a new hook on the sidebar's interceptor for this**: adding a section to an existing sidebar's own `getDesign` is already possible via the base `TabSidebarInterceptor`/`SimpleSidebarInterceptor` `getDesign` hook if you're extending from another plugin; if you own the sidebar's file directly, just edit `getDesign` in place. Either way, no new base-class capability is required.
3. **The "type picker → record picker" flow must stay entity-agnostic — never hardcode a switch over specific entity types**: the whole point of `EntityLinksDesign` is that it works for *any* linkable entity without the plugin author enumerating them. Build the type list by filtering `glyvio_structure.AllEntities.allEntities()` down to those with a registered `ENTITY_MODAL` route (see Step 3 below) — do not write `if (structureName === 'sale') ... else if (structureName === 'client') ...` anywhere in this flow.
4. **`events()` — EventReturn rule**: state-mutating handlers (`addLink`, `removeLink` triggering a refresh) return `'STATE_UPDATE'`; navigation handlers (opening the type-picker or record-picker modal) return `'STATE_FREEZED'`.
5. **Removing a link is a soft-delete of the join row, never of the linked entity itself**: `removeLink` sets `deleted: true` on the `<owner>_entity` row (via `entityService.saveInput`), and must never touch the linked entity (`Sale`, `Client`, etc.) itself.
6. **Cross-client leak check (when relevant)**: if the linkable entities carry a client/company-scoping concept and a record could plausibly already be linked to a different owner's records inappropriately, confirm with the user whether a link should be blocked when the target is already linked elsewhere — this isn't automatic, and most owner/target pairs don't need it, but ask rather than silently allow or silently block.
7. **Batch-load links without N+1**: when the sidebar (or a related list view) needs link counts/previews for *many* owner records at once (not just the single open sidebar), query the join entity once with `addFilterOperator(joinEntity.<ownerField>, ownerIds)` and group client-side — never loop one query per owner record.

---

## 📋 Execution Steps

### Step 1: State

Add the links array to the sidebar's state interface:

```typescript
export interface <OwnerName>SidebarState extends glyvio_core.TabSidebarState<<OwnerName>SidebarRouteParams> {
  // ...existing fields...
  <ownerNameCamelCase>Entities?: glyvio_entity.<JoinEntityName>[] | null;
}
```

### Step 2: Query and load the links

Add a query method and call it from `refreshState`, right after the owner entity itself is loaded:

```typescript
getLinksQuery(state: <OwnerName>SidebarState): glyvio_core.QueryBuilder<glyvio_entity.<JoinEntityName>> {
  return glyvio_core.QueryBuilder.fromEntity<glyvio_entity.<JoinEntityName>>(
    glyvio_structure.AllEntities.<joinEntityCamelCase>,
  ).addFilterOperator(glyvio_structure.AllEntities.<joinEntityCamelCase>.deleted, false);
}

// inside refreshState, after state.<ownerNameCamelCase> is loaded:
state.<ownerNameCamelCase>Entities = await this.getLinksQuery(state)
  .addFilterOperator(glyvio_structure.AllEntities.<joinEntityCamelCase>.<ownerFieldCamelCase>, state.routeParams.id)
  .findAll();
```

### Step 3: Events — add/remove link (entity-agnostic type picker)

```typescript
// in events(state, action):
if (action.key === 'addLink') {
  await this.pushModal(
    new glyvio_core.SimpleChoiceModalRoute({
      title: '$T{<pluginNamespace>_sidebar_<ownerNameSnakeCase>_entities}',
      // Entity-agnostic: only entities with a registered ENTITY_MODAL route are pickable.
      options: glyvio_structure.AllEntities.allEntities()
        .filter((e) => glyvio_core.routerService.getRouteForEntity(e.getStructureName(), 'ENTITY_MODAL') != undefined)
        .map((e) => ({ key: e.getStructureName(), label: e.getStructureName() })),
      popActionKey: 'addLinkStructureBack',
    }),
  );
  return 'STATE_FREEZED';
}

if (action.key === 'addLinkStructureBack') {
  const structureName = action.data.key as string;
  const route = glyvio_core.routerService.getRouteForEntity(structureName, 'ENTITY_MODAL');
  if (!route) {
    return undefined;
  }
  await this.pushModal(
    new route({
      popActionKey: 'addLinkEntityBack',
      popActionData: { structureName },
    }),
  );
  return 'STATE_FREEZED';
}

if (action.key === 'addLinkEntityBack') {
  await this.addLink(state, action.data.structureName, action.data.id);
  return 'STATE_UPDATE';
}

if (action.key === 'removeLink') {
  await this.removeLink(state, action.data.id, action.data.entityName, action.data.entityId);
  return 'STATE_UPDATE';
}
```

### Step 4: `addLink`/`removeLink` methods

```typescript
async addLink(state: <OwnerName>SidebarState, structureName: string, id: string): Promise<void> {
  await glyvio_core.entityService.saveEntity(
    await glyvio_entity.<JoinEntityName>.new({
      userGroupId: state.<ownerNameCamelCase>!.userGroupId,
      <ownerFieldCamelCase>: state.<ownerNameCamelCase>!.id,
      entityId: id,
      entityName: structureName,
    }),
  );
  this.callRefreshState();
}

async removeLink(state: <OwnerName>SidebarState, id: string, _entityName: string, _entityId: string): Promise<void> {
  await glyvio_core.entityService.saveInput(
    { deleted: true },
    glyvio_structure.AllEntities.<joinEntityCamelCase>.getStructureName(),
    id,
  );
  this.callRefreshState();
}
```

### Step 5: Design — the section

Insert into `sectionsDesign`/`sectionsContentDesign` (position per input #5 above):

```typescript
new glyvio_core.FormSectionDesign({
  key: 'links.section',
  appBarDesign: new glyvio_core.SimpleAppBarDesign({
    title: '$T{<pluginNamespace>_sidebar_<ownerNameSnakeCase>_links}',
    buttons: [
      new glyvio_core.ActionButtonDesign({
        key: 'addLink.button',
        type: 'SECONDARY',
        iconName: 'fa_link',
        tooltip: '$T{<pluginNamespace>_sidebar_<ownerNameSnakeCase>_addLinkTooltip}',
        visible: glyvio_core.permissionService.hasPermissionInGroup(
          glyvio_permissions.<ownerNameSnakeCase>_entity_insert,
          state.<ownerNameCamelCase>?.userGroupId,
        ) && !state.<ownerNameCamelCase>?.deleted,
        action: new glyvio_core.Action({ key: 'addLink', data: {} }),
      }),
    ],
  }),
  padding: '16',
  childDesign: new glyvio_core.ColumnLayoutDesign({
    children: [
      new glyvio_core.ColumnLayoutFieldDesign({
        child: new glyvio_core.EntityLinksDesign({
          links: glyvio_core.EntityLinksDesign.generateLinkItems(
            state.<ownerNameCamelCase>Entities?.map((e) => ({
              id: e.id!,
              entityName: e.entityName!,
              entityId: e.entityId!,
            })) ?? [],
          ),
          actionKeyRemoveLink: 'removeLink',
        }),
      }),
    ],
  }),
}),
```

### Step 6: i18n

Add to both `.arb` files, following the plugin's own key prefix convention:

- `<pluginNamespace>_sidebar_<ownerNameSnakeCase>_links` — section title (e.g. "Vínculos"/"Links").
- `<pluginNamespace>_sidebar_<ownerNameSnakeCase>_addLinkTooltip` — add-button tooltip (e.g. "Vincular entidade"/"Link entity").
- `<pluginNamespace>_sidebar_<ownerNameSnakeCase>_entities` — type-picker modal title (e.g. "Vincular a"/"Link to") — write plugin-specific copy, don't copy another plugin's wording verbatim.

---

## ✅ Self-Correction Checklist

- [ ] Does the type-picker list come from filtering `AllEntities.allEntities()` by a registered `ENTITY_MODAL` route — no hardcoded per-entity `if`/`switch`? → Fix if hardcoded.
- [ ] Does `removeLink` soft-delete the **join row** (`<owner>_entity`), never the linked entity itself? → Fix if wrong.
- [ ] Is the links query batch-loaded (one query, not N+1) anywhere it's needed for multiple owners at once (e.g. a list page preview)? → Fix if looping per-record.
- [ ] Are both `.arb` files updated with plugin-specific (not copy-pasted) wording? → Fix.
- [ ] Does the add-link button's `visible` gate on the join entity's own insert permission, scoped to the owner's `userGroupId`? → Fix if ungated or wrongly scoped.
