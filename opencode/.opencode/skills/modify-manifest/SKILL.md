---
name: modify-manifest
description: "Guides developers and AI agents on adding/editing permissions under the root `\"permissions\"` array, structuring schema migrations (new entities, fields, or sequences) under the `\"dbVersions\"` array, and publishing Jeannie skills, agents and business terms through the root `\"skills\"`, `\"agents\"` and `\"terms\"` blocks."
---
<!-- Generated from src/skills/modify-manifest/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Modify Manifest Configuration in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to include or edit entities, fields, sequences, and permissions within a Glyvio plugin's `manifest.json` file.

---

## 🎯 Skill Metadata

- **Name**: `modify_manifest`
- **Description**: Guides developers and AI agents on adding/editing permissions under the root `"permissions"` array, structuring schema migrations (new entities, fields, or sequences) under the `"dbVersions"` array, and publishing Jeannie skills, agents and business terms through the root `"skills"`, `"agents"` and `"terms"` blocks.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target modification type**:
   - **Permissions**: Add new view or page access permissions.
   - **New Entity**: Add a completely new database table.
   - **New/Modified Fields**: Add or change fields on existing entities.
   - **Sequences**: Add an auto-increment sequence and bind it to a field.
   - **Dependencies**: Declare another plugin this one builds on (its entities, classes or services).
   - **AI blocks**: Publish Jeannie skills (`"skills"`), agents (`"agents"`) or business terms (`"terms"`) at the root of the manifest.
2. **Parameters for Permissions**:
   - `key` (e.g., `invoice_list_page`): Unique key for the permission.
   - `subtype` (e.g., `invoice`): Context/Entity classification.
   - `label` (optional, e.g., `Lista de Faturas`): User-friendly display label.
3. **Parameters for Entities & Fields**:
   - `friendlyName` (e.g., `invoice`): Snake-case entity or field name.
   - `dataType` (e.g., `TEXT`, `BOOLEAN`, `INTEGER`, `DECIMAL`, `TIMESTAMP`, `JSON`): Data type of the field.
   - `config` details (e.g., `notNull: true`, foreign key references, sequences).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **Incremental Database Versions — and `data[]` is NOT re-applied**: Never modify a past migration block inside `"dbVersions"`. To add or edit entities/fields/sequences, append a new version object at the end of `"dbVersions"` with an incremented `versionNumber` (e.g. if the last version was 45, add version 46). The seed `data[]` of a version follows the same rule: the server processes a `dbVersion` (schema **and** its `data[]`) only once per company, when its `versionNumber` is greater than the last processed one (`processUpdateOnDB`). Editing a `data[]` row inside an already-published version has **no effect** on companies that already processed it; to change seed data, repeat the row in a **new** version. `data[]` rows are saved **with** permission checks (they fail on an entity with `access.write: "server"`), are never removed by omission, and the target table must already exist. For content that must follow the active plugin version (Jeannie skills, agents and business terms), use the root `"skills"`, `"agents"` and `"terms"` blocks (Steps 4–6), which are reconciled on every activation.
2. **Naming Conventions**: Use `snake_case` for all entity friendlyNames, field friendlyNames, sequence names, and permission keys.
3. **Unique Permission Keys**: The permission `key` must be globally unique inside the manifest file.
4. **Valid Data Types**: Ensure `dataType` matches one of the supported database types: `TEXT`, `BOOLEAN`, `INTEGER`, `DECIMAL`, `TIMESTAMP`, `JSON`, etc.
5. **Foreign Keys**: When creating a foreign key, the `entity` name must match the friendlyName of the referenced entity and the friendlyName of the field must end with `_id`.
6. **Name length limits (confirmed, not documented anywhere else)**: The type generator (run via `run_helper.sh`) rejects an entity `friendlyName` longer than roughly **20 characters** and a field `friendlyName` longer than roughly **30 characters**, throwing `Entity name X is too big (N)` (or the field equivalent) at generation time. Confirmed independently in two unrelated plugins — `purchase_invoice_stats` had to be shortened to `prchse_invoice_stats`, and `financial_cost_center` to `financial_costcenter`/`financial_entry_split` to `financial_split`. **Check the length of every new entity/field `friendlyName` against these limits before writing the manifest change** — going over is a hard generator failure, not a lint warning.
   - **The generator still enforces this on a `"deleted": true` entity/field in a later version** — soft-deleting an over-length entity and recreating it under a new version does **not** work around the limit; the old name is still validated. If an existing entity/field is already over the limit, the only fix is renaming it in place (a schema change to that field's own definition, following rule #1), which then requires manually updating every `.ts` file referencing the old class/property name (imports, `AllEntities.<name>`, entity class name) — there is no automated rename tool.
7. **Verify a column actually exists before building on it, for *existing* entities**: `manifest.json` can drift from the actually-deployed schema for a given company/environment (a field declared in the manifest but never actually migrated/applied there). Confirmed multiple times in one project (`story.acceptance_criteria`, `story.story_points`, `project_task.parent_task_id` all declared but absent from a live schema, failing with `column "..." does not exist` on raw SQL). Before writing code against a field of an **existing** entity that you didn't just add yourself in this same task, do a low-cost sanity check (a scalar-only `SELECT` or a quick raw query) rather than trusting the manifest file alone.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Open `manifest.json`

Locate the `manifest.json` file in the root of the plugin project.

### Step 2: Apply Permissions Modification (If Required)

To register a new permission (for example, to restrict access to a new view page or modal), append a new object to the root-level `"permissions"` array.

### Step 2b: Declare Plugin Dependencies (If Required)

The root-level `"dependencies"` array lists the plugins this plugin builds on. `glyvio_core` is always
there. Add another plugin when your code uses its entities (`glyvio_entity.*` it creates), its exported
classes/screens (`crm.ClientSingleTextfield`, `financial.FinancialBillingProvider`), its services
(`sync.SyncClient`) or intercepts its screens:

```json
"dependencies": [
  { "pluginName": "glyvio_core", "version": "latest" },
  { "pluginName": "crm", "version": "latest" },
  { "pluginName": "sync", "version": "latest" }
]
```

- `pluginName` is the plugin's namespace (the global name its classes live under).
- After changing dependencies, run `./run_helper.sh` to regenerate `@types`: each dependency becomes
  `plugin/<layer>/@types/<pluginName>.d.ts`, and its entities join `entity.d.ts`.
- The dependency must be installed in the company where your plugin is installed; code that
  references a plugin not listed here fails to compile (missing types) or at runtime (missing global).
- Do not add dependencies "just in case": each one forces its installation.

### Step 3: Apply Database Schema Migration (If Required)

To add/modify/remove entities, fields, or sequences, find the last version entry in `"dbVersions"`. Append a new version block:

1. Increment the `"versionNumber"` by 1.
2. Define the new/modified/removed `"entities"` and/or `"sequences"` within this version block.

### Step 4: Publish AI skills (root `"skills"` block, optional)

A plugin can publish Jeannie skills that describe its own data or services, without depending on the Jeannie plugin (the company does not even need the Jeannie installed). The server reconciles this block on **every** activation of the plugin and stores the rows in the Core table `ai_skill_plugin` (Core v83+):

- each entry: `slug` (`[a-z0-9-]`, 1–64, no hyphen at the ends), `language` (`pt`, `en`, `pt-BR`… or `*`), `name` (≤ 120), `description` (≤ 400), `body` (≤ 64 KiB, starts with the ```` ```jeannie-skill ```` fence holding a JSON object ≤ 16 KiB, followed by the prose); optional `version` (integer, informative) and `group` (`core_public`, the default, or `core_admin`);
- at most 50 skills and 1 MiB of `body` per plugin; a malformed block **refuses the activation** (`skill_manifest_invalid`);
- **additive rule**: an entry missing from a new manifest is kept as it is; to retire one, declare `{"slug": ..., "language": ..., "retire": true, "reason": "..."}`; changing `group` needs `"$groupChange": {"reason": "..."}` in the entry (otherwise `skill_group_change_required` refuses the activation). A changed text creates a new revision (`ai_skill_rev`); raise `version` when the body changes (otherwise the activation only warns `skill_version_not_increased`);
- a slug already published by **another** plugin: **the last plugin that publishes wins** (publishing = inserting, changing the text or reactivating on reinstall; re-activating with the same text does not take the slug back). The previous plugin's row is kept (not effective) and comes back if the current owner is uninstalled or retires the skill. A company skill with the same slug always wins over any plugin. Prefix the slug with the plugin short name (`crm-`, `fin-`) to avoid collisions; the preview shows `takeoverFrom`;
- uninstalling the plugin turns its skills inactive (never deleted); reinstalling turns the declared ones back on;
- preview before publishing: `GET /plugin/{companyId}/{pluginId}/{version}/skills-dry-run` (admin).

The full skill format (formats `write`/`report`/`prose`/`service`, `web`, extensions) is validated by the Jeannie when it loads the skill; an invalid one is left out of the turn and shown as invalid on the Jeannie skills screen (the server and `skills-dry-run` accept any body, so check the skills screen after activating). Writing the body itself (`write`, `prose` with `apply.when`, `report`) is covered by the `create-jeannie-skill` skill.

### Step 5: Publish AI agents (root `"agents"` block, optional)

A plugin can also publish Jeannie agents (and, if it wants, turn them on for a set of users) without depending on the Jeannie plugin. Same rules as the `"skills"` block, reconciled on **every** activation into the Core table `ai_agent_plugin` (Core v83+):

- each entry: `slug` (`[a-z0-9-]`, 2–64), `name` (≤ 120), `description` (≤ 500), `objective` (≤ 1000); optional `i18n` (`{"en": {"name", "description", "objective"}}`), `skills` (≤ 8 slugs), `tools` (≤ 12 names; empty = the default catalog without internet), `subjectEntity`, `eventFilter`, `inputs`, `limits` (`maxRunsPerDay`, `maxTokensPerDay`, `maxRounds`, `maxToolCalls`; the Jeannie uses the smaller of these and the company default), `writes` (`entities`, `operations` = `create`/`update` — never `delete`, `maxPerRun` ≤ 10; `extensions` is ignored for plugins), `version` and `group` (`core_public` or `core_admin`);
- at most 30 agents and 256 KiB per plugin; a malformed block refuses the activation (`agent_manifest_invalid`); retiring needs a reason (`agent_retire_reason_required`); changing `group` needs `$groupChange` (`agent_group_change_required`);
- same additive rule, same conflict rule as skills (**the last plugin that publishes a slug wins**, the previous one comes back when the current owner leaves; a company agent with the same slug always wins). Unlike skills, the activations of that slug keep running, now with the new definition, and their owners and the admin are warned;
- the agent can only write into entities the company allowed for the Jeannie (`writes.scope`), always with the permissions of the person it runs for; after reading the internet, direct writes become proposals;
- **`autoActivation`** (optional) creates one activation per user of an audience: `{"audience": {"capability": "cap_<key>"} | {"role": "supervisor"} | {"admins": true} | {"allUsers": true}, "kind": "schedule"|"manual"|"event", "schedule": {"times": ["09:00"], "weekdays": [1,2,3,4,5]}, "notify": true, "writesMode": "off"|"approve"|"direct"}`. `schedule.times` are 1–12 `HH:MM` times in the company time zone; `weekdays` are 1 = Monday … 7 = Sunday. The capability must be declared in the plugin's own `"permissions"` (`{"type": "cap", "subtype": "<namespace>", "key": "<key>"}`) and only counts when **explicitly** granted in a permission template (admins and Full templates do not enter, unless `"includeAdmins": true`). Users who never logged into the Jeannie 3.1 wait (`pending_login`) and get a card on the first login; owners can turn the activation off and the plugin never turns it back on. `direct` with `kind: "event"` is refused (`agent_auto_event_direct`), as is `autoActivation` for an agent with required `inputs` (`agent_auto_needs_input`). The Jeannie runs at most 50 automatic activations per agent;
- preview before publishing: `GET /plugin/{companyId}/{pluginId}/{version}/agents-dry-run` (admin) shows insert/update/retire, `takeover`/`resume` and how many people enter the audience.

### Step 6: Publish business terms (root `"terms"` block, optional)

A plugin can publish Jeannie business terms (what a concept means in its data and how to compute it) without depending on the Jeannie plugin. Same mechanism as `"skills"`: reconciled on **every** activation into the Core table `ai_term_plugin`, with one revision per change in `ai_term_rev` (Core v83+; on an older Core the block is ignored). Writing and testing the term itself is covered by the `create-jeannie-term` skill.

- each entry: `key` (`[a-z0-9][a-z0-9_-]`, 1–64; keep it stable, it is the row identity `<pluginId>.<key>.<language>`), `language`, `term` (the name as users say it), `meaning`; optional `aliases`, `entities` (snake_case table names), `metric`, `dateField`, `statusFilter`, `sqlExample`, `paramTypes` (one type per `?` of `sqlExample`, in order), `version` (integer, informative) and `group` (`core_public`, the default, or `core_admin`). Unknown fields are ignored with a warning (`term_unknown_field`);
- the server only checks shape and generous ceilings (at most 100 terms and 512 KiB per manifest; `term` ≤ 128, `meaning` ≤ 2000, `sqlExample` ≤ 8000 characters). **The Jeannie applies stricter limits when it loads the terms** (`term` ≤ 64, `meaning` ≤ 500, ≤ 10 aliases of ≤ 64 characters, `entities` present — the Jeannie requires the field — with ≤ 10 tables, `metric`/`dateField`/`statusFilter` ≤ 200, `sqlExample` ≤ 2000 characters, read-only SQL with no literal values, `paramTypes` matching the `?` count) and loads at most 60 plugin terms per company and language, summed over all plugins. A term that fails there does **not** refuse the activation: it is silently left out of the vocabulary and counted as invalid in the Jeannie status. Write to the Jeannie limits;
- `language`: the server accepts `pt`, `en`, `pt-BR`… or `*`, but the Jeannie only reads terms in `pt`, `en` or `*` (exact match, with fallback turn language → company language → `*`). Use one of those three;
- a malformed block **refuses the activation** (`term_manifest_invalid`); a retire without reason refuses it too (`term_retire_reason_required`), as does a `group` change without `"$groupChange": {"reason": "..."}` (`term_group_change_required`);
- **additive rule**, same as skills: a missing entry is kept; retire with `{"key": ..., "language": ..., "retire": true, "reason": "..."}`; a changed definition creates a new revision (the declared `version`, or the previous + 1; a declared `version` that does not grow only warns);
- conflicts between plugins are decided by the **normalized term name** (lower case, no accents, collapsed spaces) plus `language`, not by `key`: **the last plugin that publishes wins**, the previous row is kept and comes back when the current owner is uninstalled or retires the term. Renaming `term` keeps the same row and moves it to the new name. Company, group and personal terms with the same name always win over any plugin term (precedence: personal > group > company > plugin);
- terms published the old way, as `data[]` rows of the Jeannie table `jeannie3_plugin_term`, are still read as **legacy**, below the `"terms"` block (a block term with the same name wins). Do not add new ones; move them to this block;
- uninstalling the plugin turns its terms inactive (never deleted); reinstalling turns the declared ones back on;
- preview before publishing: `GET /plugin/{companyId}/{pluginId}/{version}/terms-dry-run` (admin) shows insert/update/unchanged/retire/refused per term, the computed name key, `takeover`, `renamedFrom` and `resumeFrom`.

---

## 📄 JSON Blueprint (Examples)

### 1. Adding a Permission

Add this template object inside the root-level `"permissions"` array:

```json
{
  "type": "view",
  "subtype": "<entity_snake_case>",
  "key": "<permission_key_snake_case>",
  "label": "<Optional Display Label>"
}
```

### 2. Creating a New Entity & Fields

Add a new database version entry at the end of the `"dbVersions"` array:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<entity_snake_case>",
      "fields": [
        {
          "friendlyName": "code",
          "dataType": "TEXT",
          "config": {
            "notNull": true,
            "unique": true
          }
        },
        {
          "friendlyName": "name",
          "dataType": "TEXT"
        },
        {
          "friendlyName": "price",
          "dataType": "DECIMAL",
          "config": {
            "notNull": true,
            "defaultValue": "0.0",
            "decimalPrecision": 10,
            "decimalScale": 2
          }
        },
        {
          "friendlyName": "user_id",
          "dataType": "TEXT",
          "config": {
            "notNull": true,
            "foreignKey": {
              "entity": "app_user",
              "physical": true
            }
          }
        }
      ]
    }
  ]
}
```

### 3. Adding a Field to an Existing Entity

Create a new database version specifying the target existing entity name and the new fields list:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<existing_entity_name>",
      "fields": [
        {
          "friendlyName": "<new_field_name>",
          "dataType": "<DataType>",
          "config": {
            "notNull": false,
            "foreignKey": {
              "entity": "<referenced_entity_name>",
              "physical": true
            }
          }
        }
      ]
    }
  ]
}
```

### 3. Removing a Entity

Create a new database version specifying the target existing entity name and the new fields list:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<existing_entity_name>",
      "deleted": true
    }
  ]
}
```

### 4. Removing a Field from an Existing Entity

Create a new database version specifying the target existing entity name and the new fields list:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<existing_entity_name>",
      "fields": [
        {
          "friendlyName": "<existing_field_name>",
          "deleted": true
        }
      ]
    }
  ]
}
```

### 5. Declaring and Binding a Sequence

Add a sequence declaration in the version block, and bind it inside a field's config details:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<entity_name>",
      "fields": [
        {
          "friendlyName": "code",
          "dataType": "TEXT",
          "config": {
            "sequence": {
              "name": "<sequence_name_snake_case>"
            }
          }
        }
      ]
    }
  ],
  "sequences": [
    {
      "friendlyName": "<sequence_name_snake_case>"
    }
  ]
}
```

### 6. Publishing a skill (root block, next to `"permissions"`)

```json
"skills": [
  {
    "slug": "crm-sales",
    "language": "en",
    "name": "Sales",
    "description": "Create and look up sales and their items.",
    "version": 1,
    "body": "```jeannie-skill\n{ \"schemaVersion\": 1, \"format\": \"prose\", \"apply\": { \"when\": \"mention\" } }\n```\nProse with the instructions..."
  },
  { "slug": "crm-old-sales", "language": "en", "retire": true, "reason": "replaced by crm-sales" }
]
```

### 7. Publishing an agent with automatic activation

```json
"permissions": [
  { "type": "cap", "subtype": "crm", "key": "crm_followup_agent", "label": "Receives the follow-up agent" }
],
"agents": [
  {
    "slug": "crm-follow-up",
    "name": "Proposal follow-up",
    "description": "Points out proposals idle for more than 7 days.",
    "objective": "Each round, list the idle proposals and suggest the next step.",
    "skills": ["crm-sales", "jeannie-tarefas"],
    "tools": ["query_database", "load_skill", "save_records"],
    "writes": { "entities": ["task"], "operations": ["create"], "maxPerRun": 5 },
    "autoActivation": {
      "audience": { "capability": "cap_crm_followup_agent" },
      "kind": "schedule",
      "schedule": { "times": ["09:00"], "weekdays": [1, 2, 3, 4, 5] },
      "notify": true,
      "writesMode": "approve"
    },
    "version": 1
  },
  { "slug": "crm-old-agent", "retire": true, "reason": "replaced by crm-follow-up" }
]
```


### 8. Publishing a business term (root block)

```json
"terms": [
  {
    "key": "open_proposals",
    "language": "en",
    "term": "open sales proposals",
    "aliases": ["open proposals", "pending proposals"],
    "meaning": "Proposals with status sent or negotiating, created in the period (start included, end excluded). Cancelled and won proposals are out. Do not use the legacy table old_proposal.",
    "entities": ["proposal"],
    "metric": "number and total value of open proposals",
    "dateField": "proposal.created_at",
    "sqlExample": "SELECT count(*) AS proposals, sum(total_value) AS total FROM proposal WHERE deleted = false AND status IN (?, ?) AND created_at >= ?::timestamptz AND created_at < ?::timestamptz",
    "paramTypes": ["TEXT", "TEXT", "TIMESTAMP", "TIMESTAMP"],
    "version": 1
  },
  { "key": "old_open_proposals", "language": "en", "retire": true, "reason": "replaced by open_proposals" }
]
```
