---
name: create-system-tool
description: 'Generates and registers a custom @SystemTool in the Environment layer (plugin/environment) to expose a local action, query, or computation to the AI Agent (Jeannie).'
---

# Agent Skill: Create System Tool in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register an **Environment-layer System Tool** (`@glyvio_core.SystemTool`). System Tools are utilities designed to interface directly with the AI Agent, acting as its eyes, ears, and hands: they read local system status (briefings, offline inventory, schedules) or write/update resources (register a visit, log a delivery) during natural-language chats.

> Use this skill when the requested behavior must be **callable by the AI Agent**. If the behavior is a public RPC method or heavy local processing not exposed to the AI, use an `@Action` instead.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_system_tool",
  "description": "Generates a class decorated with @glyvio_core.SystemTool implementing CoreSystemTool to expose a local routine to the AI Agent.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "toolId": {
        "type": "string",
        "description": "Unique snake_case identifier for the tool (e.g., daily_briefing, register_visit)."
      },
      "className": {
        "type": "string",
        "description": "PascalCase class name for the tool (e.g., DailyBriefingTool)."
      },
      "description": {
        "type": "string",
        "description": "Natural-language description telling the AI Agent WHEN and HOW to use the tool. This is critical: it is the agent's only instruction for tool selection."
      },
      "requestTypeName": {
        "type": "string",
        "description": "The TypeScript interface name for the request payload (e.g., DailyBriefingRequest). Omit if the tool takes no parameters."
      }
    },
    "required": ["toolId", "className", "description"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, obtain or ask for the following:

1. **Tool ID** (e.g., `daily_briefing`): Unique snake_case string registered in the system tool registry.
2. **Class Name** (e.g., `DailyBriefingTool`): PascalCase class name.
3. **Description**: The instruction the AI Agent reads to decide when/how to call the tool. Be explicit and behavioral.
4. **Request Type** (optional): Interface for the input payload. If the tool needs no inputs, the `handle` method takes no request.
5. **Business Logic**: What the tool does — query, compute, or persist.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No external imports for Glyvio globals**: Decorators, types, services, and entities are injected globally at runtime. Reference `glyvio_core.*`, `glyvio_entity.*`, `glyvio_structure.*`, `glyvio_permissions.*` directly. Do **NOT** `import` them.
2. **Self-documenting request interface (CRITICAL)**: The Glyvio compiler parses JSDoc on every request property and exposes it to the LLM. **Every** request field MUST have a descriptive JSDoc comment stating its purpose, whether it is optional/required, and the expected format. Without this, the AI Agent cannot construct valid calls.
3. **Decorator + interface contract**: Decorate the class with `@glyvio_core.SystemTool({ id, description, permission })` and implement `glyvio_core.CoreSystemTool<T>` with `async handle(request?: T): Promise<string>`. Do not manually touch the registry — the decorator registers the tool at init.
4. **Return a string for the LLM**: `handle` returns a `string`. Design it to be highly readable by an LLM, and append explicit `Instructions for the LLM: ...` at the end telling it how to present the data to the user.
5. **No default try/catch**: Let exceptions propagate so transactions roll back. Throw business failures with `throw new glyvio_core.GlyvioError({ message: '...' })`. Use `console.log`/`console.error` only for debugging.
6. **Permission is mandatory**: Every system tool requires a dedicated `tool` permission in `manifest.json` (see Step 2). Reference it as `glyvio_permissions.tool_<toolId>` after regenerating types.

---

## 📋 Execution Steps

### Step 1: Create the Tool File

Create `plugin/environment/src/system_tools/<tool_id>.ts` using the blueprint below. Put any DB/query helpers in `plugin/environment/src/services/`.

### Step 2: Register the Permission in `manifest.json`

Add a permission entry under the permissions block so the tool can be authorized:

```json
{
  "type": "tool",
  "subtype": "jeannie",
  "key": "<tool_id>",
  "label": "Human-readable label for the tool"
}
```

Then run `run_helper.sh` at the workspace root. This compiles metadata and generates the typed constant `glyvio_permissions.tool_<tool_id>`, which you reference in the decorator.

### Step 3: Load the Tool File (Register the Decorator)

Ensure the file is imported so the decorator executes during initialization. Add an import in the environment entrypoint (`plugin/environment/src/index.ts`) or a dedicated `system_tools/index.ts` barrel that the entrypoint imports:

```typescript
import './system_tools/<tool_id>';
```

### Step 4: Build & Validate

Compile the environment subproject (`pnpm run build:fast` or `pnpm tsc --noEmit`) and confirm types resolve and the tool registers without errors.

---

## 📄 Code Blueprint (Template)

Replace all placeholders wrapped in `<...>`:

```typescript
/**
 * Request payload for the `<tool_id>` system tool.
 * CRITICAL: every property below must carry a JSDoc comment — the compiler
 * exposes these to the AI Agent so it knows how to build the request.
 */
export interface <RequestTypeName> {
  /**
   * <Describe this field, whether it is required/optional, and its expected format.>
   */
  exampleField?: string;

  /**
   * Optional: A list of attachment IDs to be linked to the record.
   * @HINT: ALWAYS check the <system_metadata> in the prompt. If an Attachment ID is present there, you MUST include it here.
   */
  attachmentIds?: string[];
}

@glyvio_core.SystemTool({
  id: '<tool_id>',
  permission: glyvio_permissions.tool_<tool_id>,
  description:
    '<Behavioral description telling the AI Agent WHEN and HOW to use this tool.>',
})
export class <ClassName> implements glyvio_core.CoreSystemTool<<RequestTypeName>> {
  /**
   * Main entrypoint triggered by the AI Agent.
   */
  async handle(request?: <RequestTypeName>): Promise<string> {
    // Resolve the acting user. AI Agent calls default to 'system'.
    const loggedUserId = glyvio_core.getContext().loggedUserId;
    const userGroupId = loggedUserId === 'system' ? 'core_admin' : loggedUserId;

    // 💡 IMPLEMENT BUSINESS LOGIC HERE (query / compute / persist)

    // Build an LLM-friendly response.
    let report = `Result for <tool_id>:\n\n`;
    // ... append gathered data ...

    report += `\nInstructions for the LLM: Present this result to the user in a natural, conversational tone.`;
    return report;
  }
}
```

### Optional: Offline Local Database Access

The environment layer runs against the customer's local synced PostgreSQL replica. To query it, declare a dependency on the sync plugin in `manifest.json` and use the sync client:

```typescript
const syncClient = new sync.SyncClient();
const response = await syncClient
  .jeannieQueryList<T>({
    query,
    appUserId: glyvio_core.getContext().loggedUserId || '',
    zoneInfo: glyvio_core.getContext().zoneInfo,
  })
  .call({ environmentId: '' });
const rows = response?.result || [];
```

For **voice/audio-transcribed inputs**, match names resiliently with PostgreSQL unaccented similarity:

```sql
SELECT id, name FROM client
WHERE public.similarity(name, public.unaccent('${name}')) > public.show_limit()
  AND deleted = false
```

When resolving a foreign key from a descriptive name supplied by the user, you MUST run a similarity query to convert the name into the record ID before persisting.

---

## ✅ Completion Checklist

- [ ] Tool file created at `plugin/environment/src/system_tools/<tool_id>.ts`.
- [ ] Every request property documented with JSDoc.
- [ ] `description` clearly instructs the AI Agent when/how to use the tool.
- [ ] Permission entry added to `manifest.json` and `run_helper.sh` executed.
- [ ] `permission: glyvio_permissions.tool_<tool_id>` referenced in the decorator.
- [ ] File imported in the entrypoint so the decorator registers at init.
- [ ] `handle` returns an LLM-friendly string ending with `Instructions for the LLM: ...`.
- [ ] Build passes (`pnpm run build:fast` / `pnpm tsc --noEmit`).
