---
name: use-view-extensions
description: "Adds device/file capabilities to any view through its extensions manager: pick and upload files and link them to a record (attachment), download attachments, read spreadsheets/text/binary files picked by the user and save generated spreadsheets/text files (file), show a full-screen paginated media gallery (gallery), and run the Report Records registered for the screen (report)."
---
<!-- Generated from src/skills/use-view-extensions/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Use View Extensions

Every view has `this.extensionsManager`. Register an extension **in the constructor**, implement
its delegate callbacks on the view, then call it from `events()`.

| Extension | Register | Call | You implement (delegate) |
| --- | --- | --- | --- |
| Attachment | `this.extensionsManager.registerAttachment(this)` | `this.extensionsManager.attachment!.callFilePicker(allowMultiple, allowedExtensions?, extras?)`, `.downloadFile({ id } \| { dto })`, `.uploadTempFile({ url } \| { path })` | `attachmentOnFilesUploaded(state, files, extras?)` |
| File | `this.extensionsManager.registerFile(this)` | `.file!.readSpreadsheet(keyLoading?)`, `.readTextFile({ extensions, extras?, keyLoadingComponent? })`, `.readFiles({ extensions?, as?: 'text' \| 'base64', multiple?, maxSizeBytes?, extras? })`, `.saveSpreadsheet({ outputFormat, outputName, header, content }, keyLoading?)`, `.saveTextFile({ name, extension, content }, keyLoading?)` | only the callbacks of the reads you use: `fileOnSpreadsheetLoaded(state, rows)`, `fileOnTextLoaded(state, file, extras?)`, `fileOnFilesLoaded(state, { files, rejected, extras })` |
| Gallery | `this.extensionsManager.registerGallery(this)` | `.gallery!.callModal(type, initialIndex)` | `galleryGetItemCount(state, type)`, `galleryGetPage(state, type, index): Promise<GalleryItemDesign>` |
| Report | `this.extensionsManager.registerReport(this)` | put `this.extensionsManager.report!.getButton()` in the app bar | nothing (views already have `openExternalUrl`) |

Already registered by the base class: attachment on `SimpleEditPage`, `SimpleCart`,
`SimpleBatchCart`, `SimpleBatchPage`, chats and `RuleSection` (override `onFileUploaded` /
`attachmentOnFilesUploaded` there); file on `SimpleBatchCart`/`SimpleBatchPage`. Calling a
`register*` twice replaces the previous one (and logs a warning).

> Contract: `.claude/references/views_and_interceptors.md`.

---

## 🚫 Rules

1. Register in the constructor, never in `initState`/`events`.
2. All callbacks are **asynchronous**: picking a file returns immediately; the content arrives
   later in the delegate callback, which runs like an event (mutate the state; the view re-renders).
3. **Uploaded files are temporary.** In `attachmentOnFilesUploaded` either persist them right away
   with `glyvio_core.attachmentService.saveAttachment(file, [{ entityId, entityName }], isPublic)`
   (the attachment needs `userGroupId` — copy the owner record's group) or keep them in the state
   and persist on save. Use `extras` to know which field/record the files belong to.
4. File reads travel through the app: keep `maxSizeBytes` reasonable (default 20 MB per file) and
   send big binaries to a server controller instead of processing them in the view.
5. `readSpreadsheet` gives typed cells (numbers stay numbers, dates come as ISO strings).
6. Report button: the picker lists only Report Records whose `screenPaths` contain this route's
   path/type — linking a report to a screen is configuration, not code (`configure-report-record`).
   For a Custom Page use a normal button + `this.openCustomPage(...)` (`create-custom-page`).
7. Texts as `$T{}` keys in every `.arb`.

---

## 📄 Code Blueprint

```typescript
export interface <View>State extends glyvio_core.SimpleSidebarState<glyvio_core.SimpleSidebarRouteParams> {
  <entityCamel>?: glyvio_entity.<EntityName>;
  importedRows?: number;
  photos?: glyvio_entity.Attachment[];
}

export abstract class <View>WithExtensions extends glyvio_core.SimpleSidebar<<View>State> {
  constructor(route: new () => glyvio_core.SimpleSidebarRoute<glyvio_core.SimpleSidebarRouteParams>) {
    super(route);
    this.extensionsManager.registerAttachment(this);
    this.extensionsManager.registerFile(this);
    this.extensionsManager.registerGallery(this);
  }

  async events(state: <View>State, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    if (action.key == 'pickPhotos') {
      await this.extensionsManager.attachment!.callFilePicker(true, ['jpg', 'jpeg', 'png'], { target: 'photos' });
      return 'STATE_UPDATE';
    }
    if (action.key == 'importSheet') {
      await this.extensionsManager.file!.readSpreadsheet(this.callBackId);
      return 'STATE_UPDATE';
    }
    if (action.key == 'exportSheet') {
      await this.extensionsManager.file!.saveSpreadsheet({
        outputFormat: 'xlsx',
        outputName: 'export',
        header: ['Nome'],
        content: [[state.<entityCamel>?.<field1> ?? '']],
      });
      return 'STATE_UPDATE';
    }
    if (action.key == 'openGallery') {
      await this.extensionsManager.gallery!.callModal('photos', action.data.index as number);
      return 'STATE_UPDATE';
    }
    return undefined;
  }

  // Attachment: files are temporary until saved and linked
  async attachmentOnFilesUploaded(state: <View>State, files: glyvio_entity.Attachment[], _extras?: unknown): Promise<void> {
    const owner = state.<entityCamel>;
    if (!owner?.id) {
      return;
    }
    for (const f of files) {
      f.userGroupId = owner.userGroupId;
      await glyvio_core.attachmentService.saveAttachment(f, [{ entityId: owner.id, entityName: glyvio_structure.AllEntities.<entityCamel>.getStructureName() }], false);
    }
    state.photos = [...(state.photos ?? []), ...files];
  }

  // File: spreadsheet rows (array of objects keyed by header)
  async fileOnSpreadsheetLoaded(state: <View>State, rows: any[]): Promise<void> {
    state.importedRows = rows.length;
  }

  // Gallery
  async galleryGetItemCount(state: <View>State, _type: string): Promise<number> {
    return state.photos?.length ?? 0;
  }

  async galleryGetPage(state: <View>State, _type: string, index: number): Promise<glyvio_core.GalleryItemDesign> {
    return new glyvio_core.GalleryItemDesign({ attachmentId: state.photos?.[index]?.id });
  }
}
```

Check the exact `outputFormat` values accepted by `saveSpreadsheet` and the `GalleryItemDesign`
fields (`attachmentId`, `attachmentDTO`, `labelDesign`, ...) in the target `.d.ts`.

---

## ✅ Completion Checklist

- [ ] Extensions registered in the constructor; only the needed delegate callbacks implemented.
- [ ] Uploaded files persisted with `saveAttachment` (with `userGroupId`) or kept for the save.
- [ ] File sizes bounded; heavy processing on the server.
- [ ] Texts in every `.arb`; `pnpm build` clean; picking/reading/saving checked with `test-plugin-browser`.
