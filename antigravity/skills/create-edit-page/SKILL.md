---
name: create-edit-page
description: "Generates a full-screen form page (SimpleEditPage) to create or edit one entity record — or a settings/configuration screen — with sections (optionally as tabs), validation, save/cancel action bar, attachment uploads, real-time refresh, routing and menu registration. Use instead of an edit modal when the form is long or is a destination of its own."
---
<!-- Generated from src/skills/create-edit-page/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create an Edit Page

`glyvio_core.SimpleEditPage<S>` is a page whose body is a list of sections (`sectionsDesign`) plus
an action bar (`actionBarDesign`). It is the full-screen counterpart of `create-edit-modal`:

| Prefer | When |
| --- | --- |
| `create-edit-modal` | short forms opened from a list/sidebar, returning to it on save |
| **this skill** | long forms, settings screens, forms reached from the menu or a link, forms with tabs |

The base already registers the attachment extension: override `onFileUploaded` to receive files the
user uploads (see `use-view-extensions`). Pages ignore `allowDropFile`; put a `FileDropAreaDesign`
in a section or a button that calls `this.extensionsManager.attachment!.callFilePicker(...)`.

> Contract: `antigravity/rules/references/views_and_interceptors.md`. Visual pattern: `antigravity/rules/references/modern_layout.md`.

---

## 📥 Required Input Parameters

1. **Entity** (`glyvio_entity.<EntityName>`) or "settings" (what is being edited).
2. **Fields per section** (name, type, required, helper text) and whether sections show as tabs.
3. **Create vs. edit**: route param carrying the id (e.g. `id?: string`).
4. **After save**: stay (toast + `markFormClean`) or navigate somewhere.
5. **Plugin namespace**, **route path**, **permission**, **menu group** (settings pages often go to the admin screen — skill `register-menu-and-admin`).

---

## 🚫 Rules

1. Globals only (`glyvio_core.FormEntityLayoutDesign`, never a bare `FormEntityLayoutDesign`); no `any`.
2. New records: `await glyvio_entity.<EntityName>.new()` — never `new glyvio_entity.<EntityName>()`.
3. **`userGroupId` on new records** (architecture rule 1.5): keep `actionKeyChangeUserGroup` on the
   `FormEntityLayoutDesign`, assign the chosen group in `events()`, refuse to save without it.
4. FK fields use the entity's autocomplete textfield subclass bound to the **relation property**
   (`state.<entity>.client`, not `clientId`) — architecture rule 1.2.
5. Required fields: `required: true` on the field; in the save handler
   `if (!(await this.validateForm(state))) return 'STATE_UPDATE';`. After saving and staying on the
   page call `this.markFormClean(state)`.
6. `events()` returns `'STATE_UPDATE'` for state changes and `'STATE_FREEZED'` only after navigating.
7. Load the record in `refreshState` (it also runs when the record changes elsewhere, via
   `getEntitiesListenning`); keep unsaved edits by not reloading over a dirty form (`state.formDirty`).
8. Tabs: `design.showSectionsInTabs = true` renders each section as a tab titled by the section's own `appBarDesign`; group several sections in one tab with `tabsDesign`, and keep summary/total sections visible on every tab with `pinnedSectionKeysTop`/`pinnedSectionKeysBottom`.
9. Texts as `$T{}` keys in every `.arb`.

---

## 📋 Execution Steps

1. Create `src/views/pages/<entity_snake>_edit_page.ts` (blueprint).
2. Export it; `routerService.loadRoutes([<EntityName>EditPageRoute])`; menu/admin entry.
3. Open it from other screens with `await this.pushPage(new <EntityName>EditPageRoute({ id }))` (return `'STATE_FREEZED'`).
4. `pnpm build`; validate required fields, save and reload with `test-plugin-browser`.

---

## 📄 Code Blueprint

```typescript
export interface <EntityName>EditPageRouteParams extends glyvio_core.SimpleEditPageRouteParams {
  id?: string;
}

export interface <EntityName>EditPageState extends glyvio_core.SimpleEditPageState<<EntityName>EditPageRouteParams> {
  <entityCamel>?: glyvio_entity.<EntityName>;
}

export class <EntityName>EditPageRoute extends glyvio_core.SimpleEditPageRoute<<EntityName>EditPageRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<route-path>';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<EntityName>EditPage';
  }
}

export class <EntityName>EditPage extends glyvio_core.SimpleEditPage<<EntityName>EditPageState> {
  constructor() {
    super(<EntityName>EditPageRoute);
  }

  async refreshState(state: <EntityName>EditPageState): Promise<void> {
    if (state.formDirty && state.<entityCamel>) {
      return; // do not overwrite what the user is typing
    }
    const id = state.routeParams?.id;
    if (id) {
      const record = await glyvio_core.QueryBuilder.getById<glyvio_entity.<EntityName>>(
        glyvio_structure.AllEntities.<entityCamel>,
        id,
      );
      if (!record) {
        throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_<entityCamel>_notFound}' });
      }
      state.<entityCamel> = record;
    } else {
      state.<entityCamel> ??= await glyvio_entity.<EntityName>.new();
      state.<entityCamel>.userGroupId ??= this.getDefaultUserGroupId();
    }
  }

  getEntitiesListenning(state: <EntityName>EditPageState): glyvio_core.EntityListenning[] {
    return state.routeParams?.id
      ? [
          new glyvio_core.EntityListenning({
            objectId: state.routeParams.id,
            structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(),
          }),
        ]
      : [];
  }

  async events(state: <EntityName>EditPageState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key == 'save') {
      if (!(await this.validateForm(state))) {
        return 'STATE_UPDATE';
      }
      await this.save(state);
      return 'STATE_UPDATE';
    }
    if (action.key == 'onChangeUserGroup') {
      state.<entityCamel>!.userGroupId = action.data.userGroupId;
      return 'STATE_UPDATE';
    }
    if (action.key == 'onChangeObservers') {
      state.<entityCamel>!.observers = action.data.observers;
      return 'STATE_UPDATE';
    }
    if (action.key == 'actionKeyChangeTags') {
      state.<entityCamel>!.tags = action.data.tags;
      return 'STATE_UPDATE';
    }
    return undefined;
  }

  async save(state: <EntityName>EditPageState): Promise<void> {
    const entity = state.<entityCamel>;
    if (!entity) {
      return;
    }
    if (!entity.userGroupId) {
      throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_userGroupRequired}' });
    }
    await glyvio_core.entityService.saveList([entity]);
    this.markFormClean(state);
    await this.showToastSuccess(state, '$T{<plugin>_<entityCamel>_saved}');
    if (!state.routeParams?.id) {
      // first save of a new record: reopen as "edit" so the URL carries the id
      await this.pushPage(new <EntityName>EditPageRoute({ id: entity.id! }), true);
    }
  }

  async onFileUploaded(state: <EntityName>EditPageState, attachment: glyvio_entity.Attachment): Promise<void> {
    // optional: link the uploaded file to the record (see use-view-extensions)
  }

  getDesign(state: <EntityName>EditPageState, design: glyvio_core.SimpleEditPageDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      title: state.routeParams?.id ? '$T{<plugin>_<entityCamel>_edit}' : '$T{<plugin>_<entityCamel>_new}',
    });
    design.sectionsDesign = [
      new glyvio_core.FormSectionDesign({
        key: 'main.section',
        // with showSectionsInTabs, the tab title comes from the section's appBarDesign
        appBarDesign: new glyvio_core.SimpleAppBarDesign({ title: '$T{<plugin>_<entityCamel>_sectionMain}' }),
        childDesign: new glyvio_core.FormEntityLayoutDesign({
          key: 'main.layout',
          columnSize: 280,
          name: 'state.<entityCamel>',
          structureName: glyvio_structure.AllEntities.<entityCamel>.getStructureName(),
          actionKeyChangeUserGroup: 'onChangeUserGroup',
          actionKeyChangeObservers: 'onChangeObservers',
          actionKeyChangeTags: 'actionKeyChangeTags',
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              key: '<field1>.formField',
              columns: 1,
              child: new glyvio_core.StringTextfieldDesign({
                name: 'state.<entityCamel>.<field1>',
                label: '$T{<plugin>_<entityCamel>_<field1>}',
                required: true,
              }),
            }),
          ],
        }),
      }),
    ];
    design.actionBarDesign = [
      new glyvio_core.ActionButtonDesign({
        key: 'save.button',
        title: '$T{<plugin>_save}',
        type: 'PRIMARY',
        action: new glyvio_core.Action({ key: 'save', keyLoadingComponent: this.callBackId }),
      }),
    ];
  }
}
```

Check in the target `.d.ts` that `observers`/`tags` exist on the entity before keeping those
handlers, and whether your `SimpleEditPageDesign` version has `filterSectionsDesign`/`headerDesign`
(newer versions add a filter sidebar to edit pages — `antigravity/rules/references/filters_and_headers.md`).

---

## ✅ Completion Checklist

- [ ] `await Entity.new()` for new records; `userGroupId` guaranteed before saving.
- [ ] `validateForm` before save; `markFormClean` after; dirty form not overwritten by refresh.
- [ ] FK fields use the entity autocomplete subclass bound to the relation property.
- [ ] Route registered, class exported, menu/admin entry; texts in every `.arb`.
- [ ] `pnpm build` clean; create + edit + validation checked with `test-plugin-browser`.
