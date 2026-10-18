---
name: create-workflow-step
description: "Generates a server-side workflow step (@glyvio_core.WorkflowStep) that a plugin adds to the core's workflow engine, so company workflows (including scheduled ones) can call plugin logic; optionally makes the plugin create and publish its own schedule workflow (blueprint `schedule`) through the core entities, with a status/repair path."
---
<!-- Generated from src/skills/create-workflow-step/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create Workflow Step in Glyvio

This skill adds a **workflow step** from a plugin: a class decorated with `@glyvio_core.WorkflowStep` that the
core's workflow engine runs like its own steps (`notify`, `save`, `query`…). It shows up in the workflow
screen, in the company's `glyvio_workflow.d.ts` and in dry runs.

Optional part (**B**): the plugin **creates and publishes its own `schedule` workflow** that calls the step
every N minutes/hours/days, so nobody has to set it up by hand. Validated live (call center sweep in a
production company, 2026-10): publication, scheduling and the resume chain.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_workflow_step",
  "description": "Generates a @glyvio_core.WorkflowStep class (and optionally a self-published schedule workflow that runs it).",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "stepName": { "type": "string", "description": "Step name, snake_case, prefixed by the plugin (e.g. crm_timeline_entry)" },
      "className": { "type": "string", "description": "Class name (e.g. CrmTimelineEntryStep)" },
      "params": { "type": "object", "description": "Author-facing params: name → { type, required?, doc }" },
      "effect": { "type": "string", "enum": ["write", "message", "task", "external"], "description": "Side effect; omit only for a pure (read-only) step" },
      "selfSchedule": { "type": "boolean", "description": "Also have the plugin create/publish a schedule workflow calling the step (part B)" }
    },
    "required": ["stepName", "className"]
  }
}
```

---

## 📥 Required Input Parameters

1. **Step name** (`<plugin>_<verb>`): unique among global steps. The name is what saved workflows reference — never rename it after release.
2. **Params**: for each one, `type` (`text`, `number`, `boolean`, `json`, `expression`, `entity`, `entityFields`, `step`), `required`, and a one-line `doc` in prose.
3. **Effect**: `write`, `message`, `task` or `external`. A step that only reads and decides declares none.
4. **Business logic**: preferably an existing `@Strategy`, called by id.
5. **Self-schedule?** If yes: recurrence (`every`: `minute` + `intervalMinutes`, or `hour`/`day`/`week`/`month`/`date` + `at`…) and the environment rule subtype that picks the environment.

---

## 🚫 Environment Constraints & Rules

1. **Check the `@types` first** (`~/.claude/references/architecture_rules.md` §0): `WorkflowStep`, `Step`, `StepResult`, `WorkflowStepMetadata`, `ParamSpec`, `resolveMaybeExpression` and `evalExpression` are all in `plugin/server/@types/glyvio_core.d.ts`; `custom_workflow`, `workflow_version` and `workflow_state` are in `entity.d.ts`. No core change is needed to add a step or to publish a workflow.
2. **Folder = webpack entry dir**: put the class in `plugin/server/src/workflow/` and make sure `./src/workflow` is in the server `webpack.config.mjs` entry dirs (like `strategies`/`controllers`). No export in `index.ts` is needed for it to register; do not put type-only modules in that folder.
3. **Class shape**: `implements glyvio_core.Step<Params>` with `execute(params, ctx): glyvio_core.StepResult`. It is synchronous (server layer). Return `{}` to continue to the next step; `contextUpdates` publishes variables for the following steps (declare them in `contributes`).
4. **Params arrive unresolved**: a value the author wrote as a function (`(ctx) => ctx.task.name`) arrives as an `{ __expr }` marker. Resolve each param with `glyvio_core.resolveMaybeExpression(value, ctx)` before using it (`type: 'expression'` params with `glyvio_core.evalExpression`).
5. **Metadata is documentation**: `doc` (prose) and `example` (no backticks) become the JSDoc in the company's `glyvio_workflow.d.ts`; each param's `doc` is literal text, not `$T{}`.
6. **Declare `effect`**: an undeclared step is treated as having one (it is skipped in dry runs). Declare it honestly.
7. **Thin step**: put the logic in a `@Strategy` and call it by id (`create-strategy`), so another plugin can replace it and other entry points (controller, interceptor) reuse it.
8. **Errors**: throwing marks the run as failed. For a scheduled workflow, see B.4 (`onError`).

---

## 📋 Execution Steps — A. The step

1. Create `plugin/server/src/workflow/<step_name>_step.ts` (blueprint A).
2. Confirm `./src/workflow` is in `plugin/server/webpack.config.mjs` entry dirs.
3. `pnpm build`; after installing, the step appears in the workflow screen's "add step" list.

### Blueprint A

```typescript
export interface <ClassName>Params {
  <param>?: unknown; // raw: a value or an { __expr } marker
}

/** <What the step does, for the code reader.> */
@glyvio_core.WorkflowStep({
  name: '<step_name>',
  doc: '<What the step does, for the workflow author, in prose.>',
  effect: 'write',
  example: "s.<step_name>({ <param>: (ctx) => ctx.record.id })",
  params: {
    <param>: { type: 'text', required: true, doc: '<What it is.>' },
  },
})
export class <ClassName> implements glyvio_core.Step<<ClassName>Params> {
  execute(params: <ClassName>Params, ctx: glyvio_core.StepContext): glyvio_core.StepResult {
    const value = glyvio_core.resolveMaybeExpression(params.<param>, ctx);
    if (value == null || value === '') throw new Error('<step_name>: "<param>" is required');
    glyvio_core.strategyService.executeStrategy<<InputType>, <OutputType>>('<strategy_id>', { value });
    return {};
  }
}
```

Call the strategy by id (`glyvio_core.strategyService.executeStrategy`, or the plugin's own wrapper around it),
never by instantiating the class: that is what lets another plugin replace it.

---

## 📋 Execution Steps — B. Self-published schedule workflow (optional)

Use when the step must run periodically in every company that installs the plugin (sweeps, reconciliations).

### B.1 How the core runs a schedule workflow (confirmed live)

- A `custom_workflow` row runs only when `published_version` points to a `workflow_version` whose `definition` is the workflow JSON **with `version` inside**.
- Saving a `custom_workflow` whose JSON has `blueprint: 'schedule'` triggers the core after-interceptor that schedules the next run: a `workflow_state` (pending, `resume_at`) plus an `env_scheduled_task` (`workflow-server-resume`) in `configuration.environmentId`. Each save replaces the pending run (no duplicates); a deleted workflow or one without environment cancels it.
- The environment executes the task at `next_execution` and calls the resume; after running, the core schedules the next one. If runs stop or lag, check the company's core/environment version first: an outdated one was the cause when this was validated.
- **Every save must include `workflow`** (the JSON text), or the company script is not regenerated and the published version never runs.
- These behaviors come from the core's code, not its types: name them in the class doc as a known risk.

### B.2 Workflow JSON

```typescript
{
  id: '<workflow_id>',            // fixed id: one per company, found again to repair
  blueprint: 'schedule',
  configuration: { every: 'minute', intervalMinutes: 5, environmentId },
  startStepId: 'run',
  onError: 'registrar',           // log a failed run instead of throwing: a throw stops the chain
  buildRefs: {},
  triggers: [],
  steps: [{ id: 'run', type: '<step_name>', label: '<Readable name>' }],
}
```

### B.3 Environment

Resolve it with the environment rules — never hard-code it, never read `environment_plugin`:

- app `index.ts`: `glyvio_core.environmentService.registerSubtype({ subtype: '<plugin>_<job>', label: '$T{...}', pluginId: PLUGIN_ID })` (guard with `typeof ... === 'function'` while older cores exist);
- server: `glyvio_core.environmentService.resolveEnvironmentId([{ subtype: '<plugin>_<job>' }], { pluginId: PLUGIN_ID })` — it walks the subtype rule, then the plugin's rule, then the global rule; `null` means no rule: write nothing and report "no environment".

### B.4 Write and publish — a `@Strategy` (`<plugin>_<job>_schedule`)

All writes with `glyvio_core.entityService.saveInputWithoutPermission`, by structure name
(`glyvio_structure.AllEntities.customWorkflow.getStructureName()`), the same writes as the core's own publish:

1. `custom_workflow` id `<workflow_id>`: `{ name, workflow: JSON.stringify(json), active: true, deleted: false, user_group_id: 'core_admin' }`;
2. `workflow_version` (new uuid): `{ workflow_id, version: last + 1, definition: JSON.stringify({ ...json, version }), published_at, note, user_group_id: 'core_admin' }`;
3. `custom_workflow` again: `{ published_version: version, workflow }` (with `workflow`, see B.1).

Read with `glyvio_core.QueryBuilderWithoutPermission` (include deleted rows, so a repair revives the same id).

### B.5 Status and repair (keep it observable)

- A pure function in `shared/commons` (with tests) computes the status from what the server read, first problem wins: `no_environment` → `missing` → `deleted` → `inactive` → `unpublished` → `environment_changed` → `stalled` (pending `workflow_state.resume_at` missing or late by more than ~3× the interval) → `ok`.
- Modes of the strategy: `status` (read only), `setup` (writes only when `missing`/`unpublished` — a deleted or inactive workflow was turned off on purpose), `repair` (writes whenever not `ok`).
- Triggers: an after-interceptor on the plugin's configuration entity queues `setup`; a controller exposes `status` (supervisor) and `repair` (admin); the plugin's screen shows the next run or the problem, plus a "repair" button for admins.

---

## ✅ Completion Checklist

- [ ] Step in `plugin/server/src/workflow/`, entry dir in webpack, `name` prefixed by the plugin.
- [ ] `doc`, `example`, params `doc`, honest `effect`; params resolved with `resolveMaybeExpression`.
- [ ] Logic in a `@Strategy` called by id.
- [ ] (B) Environment by rule subtype + `pluginId`; nothing written without an environment.
- [ ] (B) Three writes, `workflow` in every save, `version` inside `definition`, `onError: 'registrar'`.
- [ ] (B) Status function tested in `shared/commons`; status/repair controller; screen shows next run.
- [ ] (B) Live check: `custom_workflow.published_version` set, `env_scheduled_task` pending then `success`, `workflow_state.resume_at` advancing.
