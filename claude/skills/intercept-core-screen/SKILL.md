---
name: intercept-core-screen
description: "Catalog of the ready-made Glyvio screens a plugin can customize without owning them — home, tasks (kanban, table, calendar, sidebar, edit, filter, batch), tags, users, user groups, permissions, attachments, reports, templates, timeline types, secrets, environments, plugin manager, profile, notifications, chat list, custom workflows — with each screen's route, path, base class and the specialized interceptor class to extend; then delegates to the matching create-*-interceptor skill."
---
<!-- Generated from src/skills/intercept-core-screen/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Intercept a Glyvio Core Screen

Glyvio ships screens of its own (namespace `glyvio_core`). A plugin customizes them with an
**interceptor** — it never edits them. For most of them the core already exports a **specialized
interceptor base** that fixes the generics and `getListenerRoute()` for you: extend it, implement
`getListenerId()` and only the hooks you need.

> How interceptors work (hooks, `onEvent` semantics, registration): `~/.claude/references/views_and_interceptors.md` §3.
> The hooks of each family are in the matching skill (last column).

---

## 📋 Procedure

1. Find the screen in the catalog (by what the user sees or by path). If it is not listed, look it
   up in `plugin/app/@types/glyvio_core.d.ts`: search for `<Something>Route` with the path and for an
   `abstract class <Something>Interceptor`.
2. Extend the **specialized interceptor** (`glyvio_core.<Name>Interceptor`). When the catalog shows
   none, extend the family base with the screen's state type and return its route in
   `getListenerRoute()`.
3. Discover the keys of the widgets you will touch at runtime: log `JSON.stringify(design)` once in
   your `getDesign`, or read the design with the AI bridge (`test-plugin-browser`). Keep existing keys.
4. Follow the family skill for hooks and rules; register with
   `glyvio_core.appInterceptorService.registerInterceptors([{ interceptor, order }])`.
5. Build and check the screen with `test-plugin-browser`.

Skeleton:

```typescript
export class <Name>Interceptor extends glyvio_core.TaskSidebarInterceptor {
  getListenerId(): string {
    return '<plugin>.task_sidebar';
  }

  getDesign(state: glyvio_core.TaskSidebarState, design: glyvio_core.TabSidebarDesign): void {
    // e.g. add a tab, a button, a section
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## 🗂️ Catalog

All classes below are `glyvio_core.*`. "Interceptor to extend" already returns the route.

### Home, navigation and conversations

| Screen | Path | View base | Interceptor to extend | Family skill |
| --- | --- | --- | --- | --- |
| Home (`HomePage`) | `/home` | `SimpleDashboardPage` | `HomePageInterceptor` (+ `fetchJeannieSuggestions`, `fetchAlerts`) | `create-dashboard-page-interceptor` |
| Chat list (`ChatListPage`) | `/chat-list` | own | `ChatListPageInterceptor` (observe session actions, restyle session cells) / `ChatListPageAgentTypeInterceptor` (a new channel) | `create-chat-channel-integration` |
| Notifications (`NotificationListPage`) | `/notification-list` | `SimpleListPage` | `NotificationListPageInterceptor` | `create-list-page-interceptor` |

### Tasks

| Screen | Path | View base | Interceptor to extend | Family skill |
| --- | --- | --- | --- | --- |
| Task kanban | `/task-kanban` | `SimpleKanbanPage` | `TaskKanbanPageInterceptor` — also implement `getListenerRoute()` returning `glyvio_core.TaskKanbanPageRoute` | `create-kanban-page-interceptor` |
| Task table | `/task-table` | `SimpleTablePage` | `TaskTablePageInterceptor` | `create-table-page-interceptor` |
| Task calendar | `/task-calendar` | `SimpleCalendarPage` | `TaskCalendarPageInterceptor` | `create-calendar-page-interceptor` |
| Task details (`TaskSidebar`) | `/task-view` | `TabSidebar` | `TaskSidebarInterceptor` | `create-tab-sidebar-interceptor` |
| Task table sidebar (related tasks) | `/task-sidebar-table` | `SimpleTableSidebar` | `TaskTableSidebarInterceptor` | `create-table-sidebar-interceptor` |
| Task edit | `/task-edit` | `SimpleEditModal` | `TaskEditModalInterceptor` | `create-edit-modal-interceptor` |
| Task picker | `/task-entity` | `SimpleEntityModal` | `TaskEntityModalInterceptor` | `create-entity-modal-interceptor` |
| Task table modal | `/task-table` (modal) | `SimpleTableModal` | `TaskTableModalInterceptor` | `create-table-modal-interceptor` |
| Task filter | `/task-filter` | `SimpleBatchFilterEditModal` | `TaskFilterModalInterceptor` | `create-batch-filter-modal-interceptor` |
| Task batch cart | `/task-batch-cart` | `SimpleBatchCart` | `TaskBatchCartInterceptor` | `create-simple-batch-cart-interceptor` |
| Task reminder | `/task-reminder-edit` | `SimpleEditModal` | `TaskReminderModalInterceptor` | `create-edit-modal-interceptor` |
| Task types grid / sidebar / edit / picker | `/task-type-grid`, `/task-type-view`, `/task-type-edit`, `/task-type-entity` | grid / sidebar / edit modal / entity modal | `TaskTypeGridPageInterceptor`, `TaskTypeSidebarInterceptor`, `TaskTypeEditModalInterceptor`, `TaskTypeEntityModalInterceptor` | matching family |
| Task type status edit / picker | `/task-type-status-edit`, `/task-type-status-entity` | edit modal / entity modal | `TaskTypeStatusEditModalInterceptor`, `TaskTypeStatusEntityModalInterceptor` | matching family |

### Registrations (cadastros)

| Screen | Paths | Interceptors to extend |
| --- | --- | --- |
| Tags | `/tag-list`, `/tag-edit`, `/tag-entity` | `TagListPageInterceptor`, `TagEditModalInterceptor`, `TagEntityModalInterceptor` |
| Users (`AppUser`) | `/app-user-list`, `/app-user-view`, `/app-user-edit`, `/app-user-entity` | `AppUserListPageInterceptor`, `AppUserSidebarInterceptor`, `AppUserEditModalInterceptor`, `AppUserEntityModalInterceptor` |
| User groups | `/user-group-list`, `/user-group-view`, `/user-group-edit`, `/user-group-entity` | `UserGroupListPageInterceptor`, `UserGroupSidebarInterceptor`, `UserGroupEditModalInterceptor`, `UserGroupEntityModalInterceptor` |
| Permission templates | `/permission-template-list`, `-edit`, `-entity` | `PermissionTemplateListPageInterceptor`, `PermissionTemplateEditModalInterceptor`, `PermissionTemplateEntityModalInterceptor` |
| Permission options | `/permission-options-list`, `-edit`, `-entity` | `PermissionOptionsListPageInterceptor`, `PermissionOptionsEditModalInterceptor`, `PermissionOptionsEntityModalInterceptor` |
| Attachment types | `/attachment-type-list`, `/attachment-type-edit`, `/attachment-type-entity` | `AttachmentTypeListPageInterceptor`, `AttachmentTypeEditModalInterceptor`, `AttachmentTypeEntityModalInterceptor` |
| Timeline types | `/timeline-type-list`, `-edit`, `-entity` | `TimelineTypeListPageInterceptor`, `TimelineTypeEditModalInterceptor`, `TimelineTypeEntityModalInterceptor` |
| Templates (message templates) | `/template-list`, `/template-edit`, `/template-entity` | `TemplateListPageInterceptor`, `TemplateEditModalInterceptor`, `TemplateEntityModalInterceptor` |
| Report records | `/report-list`, `/report-edit`, `/report-entity`, report filter modal | `ReportListPageInterceptor`, `ReportEditModalInterceptor`, `ReportEntityModalInterceptor`, `ReportFilterModalInterceptor` (see `configure-report-record`) |
| Chat agents (channels) | `/chat-agent-entity` | `ChatAgentEntityModalInterceptor` |
| Secrets | `/secret-table`, `/secret-edit` | `SecretTablePageInterceptor`, `SecretEditModalInterceptor` |

### Attachments and timeline (embedded in other screens)

| Screen | Path | View base | Interceptor to extend |
| --- | --- | --- | --- |
| Attachments sidebar | `/attachment-sidebar-grid` | `SimpleSidebar` | `AttachmentSidebarInterceptor` (upload flow itself is not interceptable — see `create-sidebar-interceptor`) |
| Attachments side panel | `/attachment-side-panel` | `SimpleSidePanel` | `AttachmentSidePanelInterceptor` |
| Attachments section (in edit modals) | `/attachment-section-edit` | `RuleSection` | `AttachmentsEditSectionInterceptor` (`getDesign(state, design: RuleSectionStateDesign)`) |
| Timeline page / sidebar / side panel | `/timeline`, `/timeline-view`, `/timeline-side-panel` | own | `TimelineSidebarInterceptor`, `TimelineSidePanelInterceptor` (`getDesign` only; return the route yourself) |

### Administration and system

| Screen | Paths | Interceptors to extend |
| --- | --- | --- |
| Profile | `/profile-edit`, `/profile-sidebar` | `ProfileEditPageInterceptor`, `ProfileSidebarInterceptor` |
| Plugin manager | `/plugin-edit`, `/plugin-manager-edit` | `PluginManagerEditPageInterceptor`, `PluginManagerInsertModalInterceptor` |
| Environments | `/environment-list`, `/environment-edit`, `/environment-entity`, environment plugins | `EnvironmentListPageInterceptor`, `EnvironmentInsertModalInterceptor`, `EnvironmentEntityModalInterceptor`, `EnvironmentPluginListPageInterceptor`, `EnvironmentPluginInsertModalInterceptor` |
| Entity manager (schema tools) | `/entity-manager-table-list`, `-table-edit`, `-sequence-list`, `/batch-entity-edit`, field modals | `EntityManagerTableListPageInterceptor`, `EntityManagerTableEditPageInterceptor`, `EntityManagerSequenceEditPageInterceptor`, `EntityManagerBatchPageInterceptor`, `EntityManager*ModalInterceptor` |
| Custom workflows | `/custom-workflow-list`, `/custom-workflow` | `CustomWorkflowListPageInterceptor`, `CustomWorkflowPageInterceptor` — also implement `getListenerRoute()` returning `glyvio_core.CustomWorkflowPageRoute` |

Admin entries themselves (adding your settings page to `/admin`) are not interceptors — use
`register-menu-and-admin`.

---

## 🚫 Rules

1. Never copy a core screen into your plugin to change it; intercept it.
2. Use the specialized interceptor when it exists; it carries the right state type.
3. Hooks only see what the screen routes through them; reserved actions (uploads, internal
   navigation) are not interceptable. When a need is not covered, tell the user instead of hacking.
4. Namespaced keys for everything you add; existing keys untouched.
5. Several plugins may intercept the same core screen: use `order` and do not assume you run last.

---

## ✅ Completion Checklist

- [ ] Screen identified; specialized interceptor (or family base + route) chosen.
- [ ] Keys discovered at runtime, not guessed.
- [ ] Family skill rules followed; registered once in `index.ts`.
- [ ] `pnpm build` clean; change verified on the real screen with `test-plugin-browser`.
