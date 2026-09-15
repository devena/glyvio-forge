<!-- GERADO POR build.js — NÃO EDITE À MÃO. Edite o frontmatter em src/skills/ e rode `node build.js`. -->

# Catálogo de skills e agentes

57 skills e 6 agentes. Invoque uma skill no chat com `/nome-da-skill`.

## App (frontend)

| Skill | O que faz |
| --- | --- |
| `/create-app-strategy` | Registers a new app-layer strategy (CoreAppStrategyAsync/CoreAppStrategySync), or overrides the default implementation of an existing core one (e.g. EntityHasAttachmentTypesStrategy), via appStrategyService.registerStrategies. |
| `/create-batch-filter-modal` | Generates a batch entity filter modal extending SimpleBatchFilterEditModal, with a filter form, results table, query builder, routing, and interceptor hooks. |
| `/create-batch-page` | Generates a spreadsheet-style bulk/batch editor page with spreadsheet uploads, row validation, database persistence matching custom layouts, routing, and menu registration for a Glyvio plugin. |
| `/create-batch-page-interceptor` | Generates a custom class extending an abstract `SimpleBatchPageInterceptor` to dynamically modify batch page designs, spreadsheet mapping layouts, validation, row attributes, and database query inputs, and registers it. |
| `/create-calendar-page` | Generates a standard entity calendar page showing scheduled events, appointments, or tasks with routing, sidebar filtering, and menu registration for a Glyvio plugin. |
| `/create-calendar-page-interceptor` | Generates a custom class extending an abstract `SimpleCalendarPageInterceptor` to dynamically modify calendar designs, cell layouts, and database query filters, and registers it. |
| `/create-custom-page` | Generates a Custom Page: a single-file HTML page (dashboard, relatório, painel, printable document) rendered server-side by a SimpleController in plugin/server and opened by a direct URL at /custom/{private\|public\|external}/page/{companyId}/{path}. |
| `/create-edit-modal` | Generates a standard entity creation/modification form inside a modal, with input validation, saving routines, routing, and custom interceptor hooks. |
| `/create-edit-modal-interceptor` | Generates a custom class extending an abstract `SimpleEditModalInterceptor` to dynamically modify form layout fields, query logic, and saving/cancellation procedures, and registers it. |
| `/create-entity-links-section` | Adds a "Links" section to an existing sidebar (or tab-sidebar), letting the user attach/remove polymorphic links to other entities via a generic pick-a-type-then-pick-a-record flow (EntityLinksDesign), backed by a dedicated `<owner>_entity` join table. |
| `/create-entity-modal` | Generates a standard entity selection and search modal, with autocomplete lookups, query filter configurations, list cells, selection chips, routing, and textfield wrappers. |
| `/create-entity-modal-interceptor` | Generates a custom class extending an abstract `SimpleEntityModalInterceptor` to dynamically modify entity modal search list cell layouts, selected chip formats, app bar designs, and lookup query filter constraints, and registers it. |
| `/create-gantt-page` | Generates a standard entity Gantt timeline page with date-window loading, drag-to-reschedule persistence, bar dependencies, search, sidebar filtering, routing, and menu registration for a Glyvio plugin. |
| `/create-gantt-page-interceptor` | Generates a custom class extending an abstract `SimpleGanttPageInterceptor` to dynamically modify Gantt page design, group headers, bar cell layouts, drag-to-reschedule actions, and database/date-window query filters, and registers it. |
| `/create-grid-page` | Generates a standard entity grid/gallery page with responsive grid cells, search, sidebar filtering, routing, and menu registration for a Glyvio plugin. |
| `/create-grid-page-interceptor` | Generates a custom class extending an abstract `SimpleGridPageInterceptor` to dynamically modify grid/gallery page designs, cell card layouts, and database query filters, and registers it. |
| `/create-kanban-page` | Generates a standard entity Kanban board page with status columns, drag-and-drop column changes, search, sidebar filtering, routing, and menu registration for a Glyvio plugin. |
| `/create-kanban-page-interceptor` | Generates a custom class extending an abstract `SimpleKanbanPageInterceptor` to dynamically modify Kanban board design, column headers, card cell layouts, drag-and-drop actions, and database query filters, and registers it. |
| `/create-list-modal` | Generates a standard entity search and selection modal, with cell layouts, filters sidebar, tap actions, routing, and user config persistence. |
| `/create-list-modal-interceptor` | Generates a custom class extending an abstract `SimpleListModalInterceptor` to dynamically modify list modal layouts, cell style rendering, database query filters, sidebar layouts, and sidebar load actions, and registers it. |
| `/create-list-page` | Generates a standard entity list page with search, sidebar filtering, routing, and menu registration for a Glyvio plugin. |
| `/create-list-page-interceptor` | Generates a custom class extending an abstract `SimpleListPageInterceptor` to dynamically modify list page design, cell layouts, and database query filters, and registers it. |
| `/create-screen-from-image` | Reproduces a UI screenshot (print) as faithfully as possible using Glyvio framework components. |
| `/create-send-modal` | Generates a standard message sending modal (supporting email and WhatsApp templates, attachments, and dynamic reports) with recipient list populating, state handling, and menu/route registration. |
| `/create-send-modal-interceptor` | Generates a custom class extending an abstract `SimpleSendModalInterceptor` to dynamically modify message send modal layouts, recipient contact persons, compiled files/attachments, or lifecycle triggers prior to sending. |
| `/create-sidebar` | Generates a standard details or configuration sidebar view, with layout structures, file drop support, dynamic uploads, event handling, and route configurations. |
| `/create-sidebar-interceptor` | Generates a custom class extending an abstract `SimpleSidebarInterceptor` to dynamically modify sidebar layouts, custom buttons, lifecycle hooks (init/refresh/event side-effects), or details views, and registers it. |
| `/create-simple-batch-cart` | Generates a spreadsheet-style batch/bulk-editing cart drawer (extending SimpleBatchCart) for editing many entity items at once inside a single table — with spreadsheet import/export, inline column editing, "change all" bulk edits, and a single-transaction batch save. |
| `/create-simple-cart` | Generates a standard cart drawer view for managing temporary item selections (such as shopping carts, booking lists, or item checkout bins), configuring item statuses, handles file attachments, and handles adding/removing actions. |
| `/create-simple-cart-interceptor` | Generates a custom class extending an abstract `SimpleCartListener` to dynamically modify cart layouts, customize buttons, intercept item additions/removals, or override item status resolution logic, and registers it. |
| `/create-tab-sidebar` | Generates a standard tabbed details sidebar panel container, managing tab selections, embedding sub-routes (such as attachment list panels or history timeline views), and configuring headers/app bars. |
| `/create-tab-sidebar-interceptor` | Generates a custom class extending an abstract `TabSidebarInterceptor` to dynamically modify sidebar designs, custom buttons, tab structures, and sub-routing tab paths, and registers it. |
| `/create-table-entity-modal` | Generates a table-rendered entity selection and search modal (SimpleEntityModal concept, table results instead of list cells), with autocomplete lookups (inline dropdown + full-screen modal), query filter configurations, table column/row definitions, selection chips, routing, and textfield wrappers. |
| `/create-table-modal` | Generates a standard data table search and selection modal, with layout column definitions, filters sidebar, row tap actions, routing, and user config persistence. |
| `/create-table-modal-interceptor` | Generates a custom class extending an abstract `SimpleTableModalInterceptor` to dynamically modify table modal layout headers, row styles, database query filters, sidebar layouts, and sidebar load actions, and registers it. |
| `/create-table-page` | Generates a standard entity table page with spreadsheet-like columns, search, sidebar filtering, routing, and menu registration for a Glyvio plugin. |
| `/create-table-page-interceptor` | Generates a custom class extending an abstract `SimpleTablePageInterceptor` to dynamically modify table page design, row layouts, and database query filters, and registers it. |

## Server (backend)

| Skill | O que faz |
| --- | --- |
| `/audit-sync-task-query` | Audits a glyvio-plugin-sync task's baseQuery (raw SQL against an external dataSource, e.g. an ERP) against the target glyvio_entity structure it binds to — reports structure fields the SQL leaves unfilled, wrong/missing rounding on Decimal columns, incorrect boolean/date/relation parsing, and other column-level mismatches. |
| `/create-after-commit-interceptor` | Generates a custom class extending SimpleAfterCommitInterceptor to run post-commit side effects (e.g., sending e-mails, pushing webhooks, invalidating external caches, enqueuing background jobs) after a database entity transaction has been fully and durably committed. |
| `/create-after-interceptor` | Generates a custom class extending SimpleAfterInterceptor to run post-save side effects (e.g., saving notifications, recording audit logs, notifying external services) after a database entity is successfully committed. |
| `/create-before-interceptor` | Generates a custom class extending SimpleBeforeInterceptor to perform pre-save modifications, field injection, or validation constraints on a database entity. |
| `/create-controller` | Generates a typed class extending SimpleController, registers it via the @Controller decorator, and wires it into the server entrypoint. |
| `/create-custom-interceptor` | Generates a custom class extending SimpleInterceptor to run business logic in response to a custom eventName (often triggered from the QueueList). |
| `/create-notification` | Generates code that delivers an in-app notification (title, description, optional click-through routing to a sidebar or modal) to a user group or an explicit list of users via crm.GenerateNotificationStrategy, normally embedded inside an existing AfterInterceptor or Strategy. |
| `/create-strategy` | Generates a custom class extending SimpleStrategy to run a dynamically resolvable custom algorithm or execution routine. |
| `/create-sync-interceptor` | Generates a custom class extending SimpleSyncInterceptor to normalize, denormalize, or validate fields exclusively on data arriving via the Glyvio sync engine (third-party integrations such as ERPs). |
| `/create-timeline-entry` | Generates code that records a Timeline entry (activity feed / audit event, e.g. "Sale created", "Status changed from X to Y") via crm.GenerateTimelineStrategy.pushToQueue, normally embedded inside an existing AfterInterceptor. |
| `/external-user-api` | Reference pattern for a Glyvio plugin that exposes an API consumed by a fully separate, non-Glyvio-authenticated application — an Angular/React/Flutter/mobile portal, a public-facing site, anything outside the internal Glyvio app shell. |
| `/fork-company-script` | Verifies an unpublished, freshly-built plugin/server code change against a live Glyvio backend without deploying — by forking a temporary company script (PUT /plugin/{companyId}/fork-company-script) and running verification requests with the custom-script-id header. |
| `/query-external-datasource` | Writes code (server, app, or environment layer) that reads or triggers third-party data (ERPs, marketplaces, external systems) on demand through glyvio-plugin-sync's `sync.SyncClient` — ad-hoc queries against an already-registered dataSource, forcing a sync task to run now, or excluding a record from future sync. |
| `/schedule-queued-operation` | Guides the agent to schedule a deferred, deduplicated operation using the transaction-scoped QueueList. |

## Environment (IA)

| Skill | O que faz |
| --- | --- |
| `/create-custom-agent` | Generates a custom AI Agent (custom_chat_agent) registered in manifest.json, equips it with Custom Tools, and orchestrates its execution via JeannieV2Client. |
| `/create-system-tool` | Generates and registers a custom @SystemTool in the Environment layer (plugin/environment) to expose a local action, query, or computation to the AI Agent (Jeannie). |
| `/format-llm-markdown-output` | Constrains any LLM-facing prompt (System Tool / Custom Tool response, "Instructions for the LLM" block, or a JSON field the LLM fills with markdown) to the exact markdown syntax the glyvio_app renderer supports, preventing the AI Agent from producing HTML or unsupported markdown that renders as broken literal text. |

## Configuração e processo

| Skill | O que faz |
| --- | --- |
| `/modify-manifest` | Guides developers and AI agents on adding/editing permissions under the root `"permissions"` array, and structuring schema migrations (new entities, fields, or sequences) under the `"dbVersions"` array. |
| `/release-project` | Releases the current project end-to-end: builds, bumps the patch version in package.json, updates CHANGELOG.md, commits every pending change with an auto-generated message, and pushes to origin. |
| `/test-plugin-browser` | Instruções para o AGY / Claude conectar a aplicação Glyvio App publicada ao bundle local do plugin e testar via Browser usando a AI bridge (window.__GLYVIO_AI__), sem depender da árvore de semântica/acessibilidade. |

## Agentes

| Agente | Quando usar |
| --- | --- |
| `glyvio-app-chart` | Use for creating or editing charts (data visualizations) in the app layer. |
| `glyvio-app-coordinator` | Use for frontend (plugin/app) UI/UX work. |
| `glyvio-custom-page-agent` | Use for Custom Pages: interactive, single-file HTML pages (dashboards, reports, printable documents) rendered server-side by a SimpleController in plugin/server and opened by a direct URL. |
| `glyvio-doc-agent` | Use for documenting the glyvio-plugin-core repository so external plugin developers and other AI agents can build against the public declaration files. |
| `glyvio-environment-agent` | Use for environment-layer (plugin/environment) work. |
| `glyvio-server-coordinator` | Use for server-layer (plugin/server) business logic. |
