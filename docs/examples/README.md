# Glyvio Core Extension Examples

Welcome! This directory contains highly structured, self-contained examples demonstrating how to extend and customize the Glyvio engine using the components from the Glyvio Core Plugin.

These examples are designed for both human developers and **AI Coding Agents**. They demonstrate how to build visual layouts, actions, tools, controllers, and database interceptors.

---

## ⚠️ Important: Environment Rules

When developing custom plugins that extend Glyvio Core, keep the following environment rules in mind:

1. **Global Injection**: All types, decorators, services, and schemas are injected globally by the engine. **Do NOT import them from the core packages.**
2. **Global Namespaces**:
   - `glyvio_core`: Main namespace for services, decorators, base classes, and utilities.
   - `glyvio_entity`: Subclasses of `Model` representing the database tables.
   - `glyvio_structure`: Entity structure/field schemas.
   - `glyvio_permissions`: Core permission constants.

---

## 📂 Example Index

Below are the examples grouped by subproject:

### 📱 Visual / App Layer (`/app`)

Examples of building user interfaces, menus, routes, and custom screens.

- [Custom Menu and Pages](app/custom_menu_route.md) — How to define pages, routes, and link them to menus.
- [List Page Example](app/simple_list_page_example.md) — How to build and search entity lists with SimpleListPage.
- [Edit Page Example](app/simple_edit_page_example.md) — How to construct form-based edit views using SimpleEditPage.
- [Table Page Example](app/simple_table_page_example.md) — How to implement custom spreadsheet grid layout views using SimpleTablePage.
- [Kanban Page Example](app/simple_kanban_page_example.md) — How to set up status column boards and drag-and-drop cards using SimpleKanbanPage.
- [Dashboard Page Example](app/simple_dashboard_page_example.md) — How to aggregate stats and configure responsive widget grids using SimpleDashboardPage.
- [Map Page Example](app/simple_map_page_example.md) — How to implement interactive map layouts and coordinate tracking using SimpleMapPage.
- [Simple Choice Modal Example](app/simple_choice_modal_example.md) — How to implement and trigger simple choice/confirm dialogs using SimpleChoiceModalRoute.
- [Simple Edit Modal Example](app/simple_edit_modal_example.md) — How to implement a custom edit modal using SimpleEditModal.
- [Simple Cart Example](app/simple_cart_example.md) — How to subclass and configure custom shopping carts using SimpleCart.
- [Simple Batch Cart Example](app/simple_batch_cart_example.md) — How to subclass and configure custom batch carts using SimpleBatchCart.
- [Simple Entity Modal Example](app/simple_entity_modal_example.md) — How to implement and trigger modals for selecting/editing specific database entities.
- [Simple Textfield Modal Example](app/simple_textfield_modal_example.md) — How to implement and trigger field-specific entry dialogs (string, date, decimal, etc.).
- [Query Builder Example](app/query_builder_example.md) — How to construct, filter, order, and execute database queries using QueryBuilder.

### 🔄 Environment Layer (`/environment`)

Examples of bridging actions and integrations with external services.

- [Custom Action Sync](environment/slack_sync_action.md) — How to define custom actions with the `@Action` decorator.
- [System Tool Integration](environment/system_tool.md) — How to define local AI-agent interface tools with the `@SystemTool` decorator.

### 🖥️ Server Layer (`/server`)

Examples of API controllers, interceptors, and database query/persistence.

- [Controller HTTP Request Handlers](server/controller.md) — How to create typed HTTP endpoints using `@Controller` and `SimpleController`.
- [Before Interceptor Pre-Save Validation & Mutation](server/before_interceptor.md) — How to implement `SimpleBeforeInterceptor` for validation, defaults, and transaction rollbacks.
- [Sync Interceptor Field Synchronization](server/sync_interceptor.md) — How to implement `SimpleSyncInterceptor` for field calculations and denormalization.
- [Sync Interceptor Audit Log](server/sync_interceptor_audit.md) — How to write a sync interceptor that tracks modified fields and saves audit entities.
- [After Interceptor Post-Save Side Effects](server/after_interceptor.md) — How to implement `SimpleAfterInterceptor` for post-save notifications, audit logs, and external service calls.
- [Request Service Request-Scoped Modifications](server/request_service.md) — How to retrieve and audit all modified database entities in the current request using `glyvio_core.requestService`.
- [Strategy Dynamically Resolvable Algorithms](server/strategy.md) — How to implement custom dynamic strategies using `SimpleStrategy` and `strategyService`.
- [QueueList Deferred & Deduplicated Task Execution](server/queue_list.md) — How to queue deferred actions and deduplicate them using deterministic IDs.
- [Custom Interceptor Event-Based Deferred Tasks](server/custom_interceptor.md) — How to implement custom simple interceptors and trigger them via queued operations.

---

### 🤖 AI Agent Skills

- [List Page Creation Skill](../skills/create_list_page.md) — Executable markdown guide for AI coding assistants to build and register `SimpleListPage` views in another project.
- [List Page Interceptor Creation Skill](../skills/create_list_page_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleListPageInterceptor` listeners in another project.
- [Table Page Creation Skill](../skills/create_table_page.md) — Executable markdown guide for AI coding assistants to build and register `SimpleTablePage` views in another project.
- [Table Page Interceptor Creation Skill](../skills/create_table_page_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleTablePageInterceptor` listeners in another project.
- [Edit Modal Creation Skill](../skills/create_edit_modal.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleEditModal` views in another project.
- [Edit Modal Interceptor Creation Skill](../skills/create_edit_modal_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleEditModalInterceptor` listeners in another project.
- [Entity Modal Creation Skill](../skills/create_entity_modal.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleEntityModal` selection modals in another project.
- [Entity Modal Interceptor Creation Skill](../skills/create_entity_modal_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleEntityModalInterceptor` listeners in another project.
- [Batch Page Creation Skill](../skills/create_batch_page.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleBatchPage` views in another project.
- [Batch Page Interceptor Creation Skill](../skills/create_batch_page_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleBatchPageInterceptor` listeners in another project.
- [Kanban Page Creation Skill](../skills/create_kanban_page.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleKanbanPage` views in another project.
- [Kanban Page Interceptor Creation Skill](../skills/create_kanban_page_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleKanbanPageInterceptor` listeners in another project.
- [Grid Page Creation Skill](../skills/create_grid_page.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleGridPage` views in another project.
- [Grid Page Interceptor Creation Skill](../skills/create_grid_page_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleGridPageInterceptor` listeners in another project.
- [Calendar Page Creation Skill](../skills/create_calendar_page.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleCalendarPage` views in another project.
- [Calendar Page Interceptor Creation Skill](../skills/create_calendar_page_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleCalendarPageInterceptor` listeners in another project.
- [Send Modal Creation Skill](../skills/create_send_modal.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleSendModal` views in another project.
- [Send Modal Interceptor Creation Skill](../skills/create_send_modal_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleSendModalInterceptor` listeners in another project.
- [Table Modal Creation Skill](../skills/create_table_modal.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleTableModal` search/selection modals in another project.
- [Table Modal Interceptor Creation Skill](../skills/create_table_modal_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleTableModalInterceptor` listeners in another project.
- [List Modal Creation Skill](../skills/create_list_modal.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleListModal` search/selection modals in another project.
- [List Modal Interceptor Creation Skill](../skills/create_list_modal_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleListModalInterceptor` listeners in another project.
- [Sidebar Creation Skill](../skills/create_sidebar.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleSidebar` side drawers in another project.
- [Sidebar Interceptor Creation Skill](../skills/create_sidebar_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleSidebarInterceptor` listeners in another project.
- [Tabbed Sidebar Creation Skill](../skills/create_tab_sidebar.md) — Executable markdown guide for AI coding assistants to build and register custom `TabSidebar` tabbed side drawers in another project.
- [Tabbed Sidebar Interceptor Creation Skill](../skills/create_tab_sidebar_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `TabSidebarInterceptor` listeners in another project.
- [Cart Creation Skill](../skills/create_simple_cart.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleCart` drawer views in another project.
- [Cart Interceptor Creation Skill](../skills/create_simple_cart_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom `SimpleCartListener` listeners in another project.
- [Before Interceptor Creation Skill](../skills/create_before_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom server-side `SimpleBeforeInterceptor` listeners in another project.
- [Sync Interceptor Creation Skill](../skills/create_sync_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom server-side `SimpleSyncInterceptor` listeners in another project.
- [After Interceptor Creation Skill](../skills/create_after_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom server-side `SimpleAfterInterceptor` listeners in another project.
- [Strategy Creation Skill](../skills/create_strategy.md) — Executable markdown guide for AI coding assistants to build and register custom server-side `SimpleStrategy` implementations in another project.
- [Queued Operation Scheduling Skill](../skills/schedule_queued_operation.md) — Executable markdown guide for AI coding assistants to schedule and deduplicate deferred operations in server-side interceptors.
- [Custom Interceptor Creation Skill](../skills/create_custom_interceptor.md) — Executable markdown guide for AI coding assistants to build and register custom server-side `SimpleInterceptor` event listeners in another project.
- [Manifest Modification Skill](../skills/modify_manifest.md) — Executable markdown guide for AI coding assistants to include/edit entities, fields, sequences, and permissions in the plugin's `manifest.json`.
- [Controller Creation Skill](../skills/create_controller.md) — Executable markdown guide for AI coding assistants to build and register typed `SimpleController` HTTP endpoints in another project.
