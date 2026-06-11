# Skill: Creating a Custom Agent and Custom Tools

This skill describes how to create a new Custom Agent (`custom_chat_agent`) in Glyvio and how to build Custom Tools (`@glyvio_core.CustomTool`) to support it.

## 1. Creating the Custom Agent in `manifest.json`

To create a new agent, you must define it in the `manifest.json` file. **CRITICAL:** Do not hardcode a specific `versionNumber`. You must first read `manifest.json` to find the highest existing `versionNumber`. You can either append your new agent to the `data` array of that highest version block, or create a new block with `highestVersion + 1`.

**Example Implementation (Assuming highest existing version was 51):**

```json
{
  "versionNumber": 52, // (Replace with highest_version + 1 based on actual manifest)
  "data": [
    {
      "entityName": "custom_chat_agent",
      "id": "my_custom_agent_id",
      "data": {
        "name": "My New Agent",
        "prompt": "You are a helpful assistant. Use @baseInstructions@ to include base context. Your goal is to guide the user...",
        "user_group_id": "core_admin"
      }
    }
  ]
}
```

_Important:_ The `id` string (e.g., `"my_custom_agent_id"`) acts as the unique identifier for your agent.

## 2. Creating Custom Tools for the Agent

A Custom Tool is a piece of code that the custom agent can execute (e.g., retrieving online users, searching products, routing a conversation). These tools are stored in `plugin/environment/src/custom_tools/`.

> [!WARNING] > **Security & Scope Context:** `SystemTool`s are designed for logged-in users and are naturally protected by the UI/messaging session and manifest permissions. In contrast, `CustomAgent`s (and by extension their `CustomTool`s) are invoked via background rules or service calls. They can interact with logged-in users **OR** external clients/unauthenticated users.
> Because of this, the data access scope inside a Custom Tool must be **strictly controlled**. Never expose sensitive internal data without explicitly validating the context of the user invoking the agent.

**Rules for Custom Tools:**

1. File placement: `plugin/environment/src/custom_tools/<tool_name>.ts`
2. Decorator: Use `@glyvio_core.CustomTool({ id: '...', description: '...', agentsId: ['<id>'] })`
   - The `description` property is extremely important, as it tells the AI Agent when and how to use the tool.
   - The `agentsId` array restricts the tool so it is only available to the specific agents listed by their `id`.
3. Interface: The class must implement `glyvio_core.CoreCustomTool<T>` where `T` is an interface representing the arguments the AI will pass.

**Example Tool Implementation (`available_sales_rep.ts`):**

```typescript
import { UserService } from './services/user_service';

export interface AvailableSalesRepListRequest {}

@glyvio_core.CustomTool({
  id: 'available_sales_rep',
  description: 'Retrieves a list of available sales representatives. Call this tool when you need to present routing options to the user.',
  agentsId: ['my_custom_agent_id'], // Links this tool to the agent created in the manifest
})
export class AvailableSalesRepListTool implements glyvio_core.CoreCustomTool<AvailableSalesRepListRequest> {
  async handle(_request?: AvailableSalesRepListRequest): Promise<string> {
    try {
      const allUsers = await UserService.getInstance().availableUsers();
      if (!allUsers || allUsers.length === 0) {
        return 'No sales representatives are currently available. Please inform the user.';
      }
      return \`The following sales reps are available: ...\n\nINSTRUCTION: Present these options to the user...\`;
    } catch (error) {
      console.error('Error fetching sales reps:', error);
      return 'Error fetching sales reps.';
    }
  }
}
```

**Key Patterns:**

- Return strings that contain context **and instructions** (`INSTRUCTION: ...`) for the AI. This guides the LLM on what to do next based on the tool's result.
- Handle exceptions safely using try-catch blocks and log internally using `console.error`. Return user-friendly error messages as strings to the LLM.
- You do NOT need to register the custom tool in `index.ts`. The `@glyvio_core.CustomTool` decorator allows it to be discovered automatically by the core.
