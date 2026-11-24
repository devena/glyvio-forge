---
name: survey-workflow-candidates
description: "Surveys a Glyvio plugin project and reports what it should add to the workflow engine's catalog: candidate steps (@glyvio_core.WorkflowStep), domain blueprints and gaps that only the core can fill — each with the code it comes from, why a generic save/query does not cover it, and a ready sketch. Read-only: it proposes and ranks, it does not write code."
---
<!-- Generated from src/skills/survey-workflow-candidates/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Survey Workflow Candidates in a Glyvio Plugin

This skill walks a plugin project and answers one question: **what does this plugin know how to do that a
workflow author (a person, or the AI that writes workflows) cannot do today without knowing the plugin's
internals?** The answer is a ranked report of candidate **steps** and **blueprints**, each traced to the
code it comes from.

> ⚠️ **Read-only.** It never creates or edits files in the plugin. Each accepted candidate is implemented
> afterwards with `create-workflow-step` (one at a time), reviewed by a person.
>
> **Why not generate everything?** Every step is one more line in the catalog the workflow AI reads on each
> request, and what makes the AI pick the right step is its `doc` and `example`. Ten sharp steps beat forty
> thin ones. A candidate that only wraps a `save` is noise — say so and drop it.

---

## 🎯 Skill Metadata

```json
{
  "name": "survey_workflow_candidates",
  "description": "Read-only survey of a plugin: ranked candidate workflow steps and blueprints, each with source, justification and sketch.",
  "Audience": "AI agents or developers with read access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "pluginRoot": { "type": "string", "description": "Root of the plugin project (where manifest.json and plugin/ are)" },
      "focus": { "type": "string", "description": "Optional: an entity or area to restrict the survey to (e.g. \"sale\", \"stock\")" },
      "maxCandidates": { "type": "number", "description": "How many candidates to keep in the report (default 12)" }
    },
    "required": ["pluginRoot"]
  }
}
```

---

## 📥 Required Input Parameters

1. **Plugin root** — the folder with `manifest.json` and `plugin/server`, `plugin/app` (and maybe `plugin/environment`).
2. **Focus** (optional) — an entity or an area. Without it, survey the whole plugin.
3. **How many** (optional) — default 12. More than that is a sign the bar is too low.

---

## 🚫 Rules

1. **Check the `@types` first** (`antigravity/rules/architecture_rules.md` §0). `WorkflowStep`, `WorkflowBlueprint`, `ParamSpec` and
   `StepResult` are in `plugin/server/@types/glyvio_core.d.ts`. If `WorkflowStep` is not there, stop: this
   plugin's core types are too old to add steps — say so and ask for the types to be regenerated.
2. **Read what already exists.** List the plugin's own steps (`plugin/server/src/workflow/`, or any
   `@glyvio_core.WorkflowStep`) and never propose one again. Do not propose what the core already has
   under a new name. The plugin's `@types` do **not** carry the core's step catalog, so the snapshot below
   is the reference. When a candidate may overlap a core step and the snapshot is not enough to tell, keep
   it at the bottom of the ranking marked `conditional` (Clarity at most 1) and say what to check — do not
   drop it silently and do not present it as certain.
3. **A plugin can add steps and blueprints, not triggers.** A new *moment* (something that should start a
   workflow and no existing blueprint covers) goes to the section **"Needs the core"** of the report — do not
   sketch code for it.
4. **Never invent an API.** Every candidate names the real symbol it would call (a `@Strategy` id, a service
   method, a controller) with `file:line`. If the logic exists only inside a controller or an interceptor,
   the candidate's first task is "extract to a `@Strategy`" — mark it `needs-extraction` and lower its score.
   Three cases that look alike and are not:
   - logic in an exported function of `utils/` (not a `@Strategy`): **ready** — the step can call it;
     wrapping it in a `@Strategy` is optional (Readiness 2);
   - logic only in the **app** layer (an app strategy, a cart, a modal's save): the server has no such
     rule today, so a workflow that writes the same data skips it. It is often the plugin's biggest gap.
     Mark it `needs-extraction (from app)`, Readiness 0, and name the risk of the two copies diverging;
   - logic only in the **environment** layer (inside a tool or an action): if it is a query or a simple
     rule, the candidate is "rewrite it as a server `@Strategy`" (`needs-extraction (from environment)`);
     if it really needs the environment (network, files), the step calls the action and declares
     `effect: 'external'`.
5. **Read only.** No file is created, changed or formatted. No build, no network, no credentials.
6. **One language for the report**: the one the user is writing in. Step names, param names and code stay
   in English.

### The core catalog (snapshot)

- **Global steps**: `if`, `switch`, `for_each`, `break`, `continue`, `query`, `query_list`, `save`,
  `save_without_permission`, `set_variable`, `format`, `translate`, `notify`, `ai_ask`, `call_service`,
  `call_workflow`, `pause`, `sleep`, `respond`, `refuse`.
- **Screen steps** (blueprint `screen`): `form`, `choose`, `review`, `assign_screen`, `done`.
- **Conversation steps** (blueprint `whatsapp_ivr`): `send_message`, `end_message`, `ask`, `ask_document`,
  `menu`, `collect_form`, `save_row`, `create_task`, `tag`, `transfer_to`, `finalize`.
- **Blueprints**: `before_save`, `after_save`, `after_commit`, `before_save_prefixer`, `schedule`, `endpoint`,
  `subflow`, `screen`, `ivr`, `whatsapp_ivr`.

The two that most often look like a gap and are not (or are, in a precise way):

- `notify(userId, title, description?, route?)` notifies **one user**. A plugin step that notifies a group
  by permission, or several users, is not a duplicate — say exactly that difference in its `doc`.
- `create_task(fields, …)` exists only inside `whatsapp_ivr`. "Create a task" from any other workflow is a
  gap of the core: report it under **Needs the core**, not as a plugin step, unless the plugin owns `Task`.

---

## 📋 Execution Steps

### 1. Map the plugin (10 minutes, no deep reading yet)

| read | to learn |
| --- | --- |
| `manifest.json` → `dbVersions[].entities` | the entities, their status/type foreign keys, the permissions |
| `plugin/server/src/strategies/` (`@Strategy`) | the business operations that already have a name and an id |
| `plugin/server/src/controllers/` (`@Controller`) | what the app asks the server to do — each is an operation a user triggers by hand |
| `plugin/server/src/interceptors/` (`@BeforeInterceptor`, `@AfterInterceptor`, `@AfterCommitInterceptor`, `@SyncInterceptor`, and the plain `@Interceptor({ eventName })` of a custom event) | the rules that run on every save — **read them before calling anything a "thin write"** — and the moments the plugin already reacts to (a custom event is often the only trace of one) |
| `plugin/environment/src/` (`@Action`, `@SystemTool`, `@CustomTool`) | what reaches outside: ERPs, gateways, files |
| `plugin/app/src/strategies/` and the calls the app makes to the server (`postController(`) | rules that live only in the app (totals, numbering, required fields) and what people trigger by hand |
| `plugin/app/src/views/` — only the buttons that are not new / edit / delete / restore | what people do by hand, in their own words (the button title is the step's `doc` waiting to be written). This folder is large and mostly CRUD: do not read it whole |
| `plugin/server/src/workflow/` | the steps the plugin already has |

Useful searches (adapt the paths to the project):

```bash
# decorators are usually written qualified (@glyvio_core.Strategy): match both forms
grep -rnE "@(glyvio_core\.)?Strategy\(" plugin/server/src plugin/app/src --include=*.ts
grep -rnE "@(glyvio_core\.)?Controller\(" plugin/server/src --include=*.ts
grep -rnE "^\s*@(glyvio_core\.)?(Before|After|AfterCommit|Sync)?Interceptor\(" plugin/server/src --include=*.ts
grep -rnE "@(glyvio_core\.)?(Action|SystemTool|CustomTool)\(" plugin/environment/src --include=*.ts
grep -rnE "Workflow(Step|Blueprint)\(" plugin/server/src --include=*.ts
grep -rn "postController(" plugin/app/src --include=*.ts
grep -nE '"friendlyName": "[a-z_]*(status|type)_id"' manifest.json | head -40
```

Counts are for the header of the report and may be approximate (entities repeat across `dbVersions`; say
"~"). A file does not need to be exported from `index.ts` to be registered — each file under
`strategies/`, `controllers/`, `interceptors/` and `workflow/` is usually its own build entry — so do not
conclude that something is dead code because `index.ts` does not mention it.

### 2. Collect raw candidates

For each thing found, ask: *would someone automating this business want to say this in one sentence?*

- **A named operation with rules inside** ("change the sale status", "reserve stock", "generate the
  installments", "send the proposal by e-mail") → candidate **step**.
- **Something that reaches outside** through an environment action → candidate **step** with
  `effect: 'external'` (or `message`).
- **A read that needs the plugin to answer** ("the client's open balance", "the stock available for this
  product") → candidate **pure step** (no `effect`) that publishes a variable.
- **A moment the business talks about** ("when a deal changes stage", "when a payment is overdue") that an
  existing blueprint already delivers with a condition → candidate **blueprint** (sugar: it fixes the entity
  and the condition and gives the moment a name). If no existing blueprint delivers it → **Needs the core**.
- **A screen people fill in today to do the same thing every time** → note it under **Screen flows worth
  shipping** (a ready `screen` workflow, not a step).

### 3. Filter — a candidate stays only if it passes ALL of these

1. **Not a thin write.** If the whole effect is "set column X of entity Y", `save` already does it — unless
   the plugin has rules a raw `save` would skip or break (a status machine, totals to recalculate, a
   queue). Name the rule and where it lives; if there is none, drop the candidate. **Check the
   interceptors first**: what an `@AfterInterceptor`/`@BeforeInterceptor` does (a status log, a timestamp,
   a timeline entry) already happens on *any* save, including the workflow's — that is not a reason for a
   step. "Change the status of X" is almost always a thin write.
2. **A real, callable entry point exists** (rule 4), or the extraction is small and named.
3. **Runs on the server, synchronously.** A step is `execute(params, ctx): StepResult`. If it needs a person
   it is a screen flow; if it needs minutes it is an environment action called through a queue — say which.
4. **Safe to repeat.** A workflow can run twice. Say what happens the second time (idempotent, or guarded
   by what).
5. **Has an author-facing sentence.** If you cannot write its `doc` in one line without the plugin's jargon,
   it is not ready.

### 4. Score and rank

Score each survivor 0–3 on each line and sum; sort descending; keep `maxCandidates`.

| criterion | 0 | 3 |
| --- | --- | --- |
| **Demand** — how often is this done by hand today? | rare, admin-only | a daily button, or a recurring request |
| **Guard** — what goes wrong with a raw `save`? | nothing | broken totals, skipped rules, invalid state |
| **Readiness** — how far is the code? | logic buried in a controller | a `@Strategy` with a clean input |
| **Clarity** — can the AI pick it from its `doc`? | overlaps another step | one obvious use |

For a **blueprint** read the same lines this way: *Guard* = how easy it is to write the condition wrong by
hand (comparing the new value with the saved one, the right entity); *Readiness* = the plugin already
reacts to that moment in an interceptor (3) or nobody does (0).

### 5. Sketch each kept candidate

Write the metadata only — never the implementation. Use the plugin prefix in the name (`<plugin>_<verb>`).
Declare **what each param points to**, so the publish gate and the workflow AI can check it:

| in the param | meaning |
| --- | --- |
| `type: 'entity'` | an entity; it must exist |
| `references: 'SaleStatus'` | the value is the id of a record of that entity (or `['AppUser', 'UserGroup']`) |
| `columnsOf: 'entity'` + `columnValues: true` | a map whose keys are columns of the entity named by that other param |
| `columnsOfEntity: 'Task'` | the same, for a step tied to one entity |
| `columnOf: 'entity'` | the value is the name of one column of that entity |

Only use the ones that exist in `ParamSpec` of this plugin's `glyvio_core.d.ts`. If any of these five is
not there yet, write the sketch without it and add one line under the sketch: "after the types are
updated: `references: '<Entity>'` on `<param>`" (same for the others).

A **pure step** publishes its result as a flow variable. The param that carries the variable name is
declared in `contributes`:

```ts
params: { variableName: { type: 'text', required: true, doc: 'Keeps the result in this variable.' } },
contributes: [{ fromParam: 'variableName', valueType: 'unknown' }],   // or 'string' | 'number' | 'boolean' | 'entity'
```

A **blueprint** candidate gets metadata only — name, `doc`, and the params that narrow the moment — plus
the blueprint it stands on (`after_save` on `<Entity>`, with which condition). Do not write its `build`:
if `glyvio_workflow` is not declared in this plugin's `@types`, say `needs-types` under "Before coding".

```ts
@glyvio_core.WorkflowBlueprint({
  name: '<plugin>_<entity>_<moment>',
  doc: '<When it starts, in prose.>',
  params: {
    toStatusId: { type: 'text', required: false, doc: 'Only when the new status is this one.' },
  },
})
// stands on: after_save(<Entity>) when newValue.<field> != savedValue.<field>
```

---

## 📄 Output — the report

Return exactly this structure (in the user's language):

````markdown
# Workflow candidates — <plugin name> (<date>)

**Surveyed**: <n> strategies · <n> controllers · <n> interceptors · <n> environment (`@Action` + `@SystemTool`) · ~<n> entities
**Already in the catalog (plugin)**: <its own steps, or "none">
**Kept**: <n> steps · <n> blueprints — **Dropped**: <n> (reasons at the end)

## Ranking

| # | candidate | kind | score | effect | ready? | one line |
|---|-----------|------|-------|--------|--------|----------|
| 1 | `stock_reserve` | step | 11 | write | ready | Reserves stock for an order line, refusing when there is not enough |

## 1. `<name>` — <kind>

- **What the author says**: "<one sentence, no jargon>"
- **Comes from**: `<file>:<line>` — `<symbol>` (<Strategy id / controller path / interceptor>)
- **Why not `save`/`query`**: <the rule a generic step would skip, and where it lives>
- **Second run**: <idempotent | guarded by … | NOT idempotent: what repeats — and it must be in the `doc`>
- **Before coding**: <"nothing" | "extract <what> to a @Strategy">
- **Sketch**:

  ```ts
  @glyvio_core.WorkflowStep({
    name: '<name>',
    doc: '<prose, for the workflow author>',
    effect: 'write',
    example: "s.<name>({ … })",
    params: {
      saleId: { type: 'text', required: true, doc: '…', references: 'Sale' },
    },
    contributes: [ … ],
  })
  ```
- **App side**: the label, the one-line summary shown on the step's card, and which params get a field
  (in prose — the app extension is written when the step is implemented).

## Screen flows worth shipping

- <a ready `screen` workflow the plugin could publish, in one line each — or "none">

## Needs the core

- <a moment or a capability no plugin can add: what, and the evidence in this plugin — or "nothing">

## Dropped, and why

- `<thing>` — <thin write | no entry point | needs a person | duplicate of <step>>
````

---

## ✅ Completion Checklist

- [ ] `WorkflowStep` confirmed in the plugin's `@types` (or the survey stopped and said why).
- [ ] The plugin's existing steps were listed and none is proposed again.
- [ ] Every candidate has a real `file:line` and symbol; nothing invented.
- [ ] Every candidate says why `save`/`query` is not enough; the ones that could not were dropped and listed.
- [ ] Triggers the plugin cannot add are under **Needs the core**, with no code sketch.
- [ ] Sketches use only `ParamSpec` fields that exist in this plugin's `@types`.
- [ ] No file was created or changed.

Next step, per accepted candidate: `create-workflow-step`.
