---
name: create-custom-agent
description: 'Generates a custom AI Agent (custom_chat_agent) registered in manifest.json, equips it with Custom Tools, and orchestrates its execution via JeannieV2Client.'
---

# Agent Skill: Create Custom Agent in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a **Custom Agent** (`custom_chat_agent`) in the Glyvio plugin system. Custom Agents are specialized LLM instances equipped with their own system prompts, permissions, and custom tools to perform complex orchestrations, background processing, or multi-step logic (e.g., web scraping, sql execution, calculations).

> Use this skill when you need an autonomous, specialized entity that executes multi-step workflows, runs local environment-level tools, or maintains conversational memory to complete a specific role.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_custom_agent",
  "description": "Registers a custom_chat_agent in manifest.json, implements any supporting Custom Tools, and orchestrates agent execution in server code.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "agentId": {
        "type": "string",
        "description": "Unique snake_case identifier for the custom agent (e.g., web_scraper_agent, sql_analyst_agent)."
      },
      "agentName": {
        "type": "string",
        "description": "Human-readable name for the agent (e.g., Extrator de Dados Web, Analista de Vendas)."
      },
      "prompt": {
        "type": "string",
        "description": "The system prompt defining the agent's identity, guidelines, tools it should use, and expected output format (e.g. JSON schema)."
      },
      "userGroupId": {
        "type": "string",
        "description": "The target security group for the agent. Defaults to 'core_admin'."
      }
    },
    "required": ["agentId", "agentName", "prompt"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, obtain or ask for the following:

1. **Agent ID** (e.g., `web_scraper_agent`): Unique snake_case string used to address this agent in chats.
2. **Agent Name** (e.g., `Extrator de Dados Web`): Human-readable name displayed in UI.
3. **System Prompt**: Detailed instruction specifying the agent's behavior, persona, tools it can call, and expected final response layout.
4. **Tools** (optional): List of environment-level tools (`CustomTool`) the agent can invoke.
5. **Trigger/Invocation Logic**: How/when this agent is triggered (e.g., on receiving a chat message, via a controller endpoint, or in a database interceptor).

---

## 🚫 Environment Constraints & Rules

1. **Manifest Registration**: Custom agents must be registered via the `"dbVersions"` migration array in `manifest.json`.
2. **Scope of Custom Tools**: Custom tools are decorated with `@glyvio_core.CustomTool` and must list the `agentId` in their `agentsId` array in order to be visible and callable by that agent.
3. **No Glyvio Global Imports in Tools**: Just like system tools, custom tools must reference `glyvio_core.*`, `glyvio_entity.*` directly without importing them.
4. **LLM Invocation Pattern**: Invoke custom agents from server-side code using `new jeannie_v2.JeannieV2Client().custom_chat(...)`. Always pass a unique `sessionId` to maintain memory context if needed.

---

## 📋 Execution Steps

### Step 1: Register the Custom Agent in `manifest.json`

Use the `modify-manifest` skill (or edit manually) to add the agent entry under the `"dbVersions"` block. **First read `manifest.json` to find the highest existing `versionNumber`**, then append a new block or add to the `data` array of the last version.

```json
{
  "versionNumber": "<highest_version + 1>",
  "data": [
    {
      "entityName": "custom_chat_agent",
      "id": "<agent_id>",
      "data": {
        "name": "<Agent Name>",
        "prompt": "<System instructions for the agent...>\n\n@baseInstructions@",
        "user_group_id": "core_admin"
      }
    }
  ]
}
```

> **`@baseInstructions@`** is a framework placeholder automatically replaced at runtime with Glyvio's standard context (date/time, logged user, company, available tools list). Always append it at the end of the prompt so the agent has access to the base context.

After saving `manifest.json`, **run `run_helper.sh`** at the workspace root to regenerate types. The generated agent `id` string (e.g. `"my_sales_agent"`) is what you use in the `agentsId` array of Custom Tools.

### Step 2: Implement Supporting Custom Tools

If your agent requires custom functions (like scraping websites, querying APIs, or heavy calculation):
1. Create a tool file under `plugin/environment/src/custom_tools/<tool_id>.ts`.
2. Decorate the tool with `@glyvio_core.CustomTool` and list the `<agent_id>` in the `agentsId` array:
   ```typescript
   @glyvio_core.CustomTool({
     id: '<tool_id>',
     description: '<When and how to call this tool.>',
     agentsId: ['<agent_id>'],
   })
   ```
3. Implement `CoreCustomTool` and write the handler logic.

> **No `index.ts` registration needed.** The `@glyvio_core.CustomTool` decorator auto-registers the tool at runtime — unlike `@SystemTool`, you do **not** add an import to any entrypoint.

### Step 3: Invoke the Agent in Server Code

Use the `JeannieV2Client` inside a server controller or interceptor to query the custom agent:

```typescript
import { jeannie_v2 } from '@plugin/commons';

const result = await new jeannie_v2.JeannieV2Client()
  .custom_chat({
    prompt: '<Input request for the agent>',
    agentId: '<agent_id>',
    sessionId: crypto.randomUUID(), // Maintain session context or isolate
    userContext: '<Additional system/user metadata for context>',
  })
  .call({
    environmentId: environmentId,
  });

// result.response contains the agent's textual/JSON output.
```

---

## 📄 Code Blueprints (Templates)

### Custom Tool Template

Create under `plugin/environment/src/custom_tools/<tool_name>.ts`:

```typescript
export interface <ToolName>Request {
  /**
   * Describe this field to the LLM.
   */
  paramName: string;
}

@glyvio_core.CustomTool({
  id: '<tool_name>_tool',
  description: 'Instruction for the agent explaining when to use this tool.',
  agentsId: ['<agent_id>'],
})
export class <ToolName>Tool implements glyvio_core.CoreCustomTool<<ToolName>Request> {
  async handle(request?: <ToolName>Request): Promise<string> {
    // ⚠️ SECURITY: scope every query to the minimum necessary data.
    // This tool may be invoked by external/unauthenticated users via the agent.

    if (!request?.paramName) {
      throw new glyvio_core.GlyvioError({ message: 'paramName is required.' });
    }

    // 💡 IMPLEMENT BUSINESS LOGIC HERE (query / compute / persist)
    const result = `Successfully processed: ${request.paramName}`;

    // End with an LLM instruction so the agent knows how to present the result.
    return `${result}\n\nInstructions for the LLM: Present this result naturally to the user.`;
  }
}
```

---

## ✅ Completion Checklist

- [ ] Custom agent entry added to `manifest.json` under `dbVersions`.
- [ ] `run_helper.sh` executed after modifying `manifest.json`.
- [ ] System prompt includes clear task directives, tool usage instructions, and desired output format (e.g. JSON schema).
- [ ] `@baseInstructions@` appended at the end of the prompt.
- [ ] Supporting Custom Tools created in `plugin/environment/src/custom_tools/`.
- [ ] Each Custom Tool lists the correct agent ID string in its `agentsId` decorator array.
- [ ] Each Custom Tool's `handle` uses `glyvio_core.GlyvioError` for failures (no default try-catch).
- [ ] Each Custom Tool's `handle` returns a string ending with `Instructions for the LLM: ...`.
- [ ] Data scope in each tool is restricted to only what the agent's use case requires.
- [ ] **No** `index.ts` import added for Custom Tools — auto-registered by decorator.
- [ ] Agent invocation integrated in server controllers or interceptors using `JeannieV2Client`.
- [ ] Build passes (`pnpm run build:fast`).
