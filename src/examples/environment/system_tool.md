# Example: Custom Environment System Tools for AI Agent Conversations

This guide explains how to design and build custom **System Tools** in the **Environment Layer** (`plugin/environment`) of Glyvio.

Unlike standard backend utility scripts, System Tools in Glyvio are specifically designed to **interface directly with AI Agents**. They serve as the eyes, ears, and hands of the AI, allowing the agent to read local system status (e.g., fetch daily briefings, query offline sync inventory) or write/update resources (e.g., register a visit, log a delivery) during natural language chats.

---

## ⚠️ Critical Rule: Parameter Self-Documentation

Because the AI Agent dynamically inspects tool definitions at runtime to understand when and how to call them, **every request field in the request interface must be explicitly documented with JSDoc comments**.

The Glyvio compilation engine parses these comments and exposes them to the LLM. If you do not write detailed JSDoc comments on the request parameters, the AI Agent will not understand which fields are optional, which are required, or what formats are expected.

---

## 🏗️ Core Architecture & Database Sync Queries

Because the environment layer runs inside the customer's local context, database queries are run offline against the local synced PostgreSQL database.

To execute queries against the sync client, you must declare a dependency on the sync plugin in your `manifest.json`. The following pattern abstracts the local database client query execution:

### 1. The Local Query Service Base (`src/services/base_service.ts`)

```typescript
/**
 * Base service providing local database query capability via the local sync engine client.
 * For these queries to execute, the manifest must declare a dependency on the sync plugin.
 */
export class BaseService {
  protected constructor() {}

  /**
   * Executes a query returning a list of records from the local offline sync DB.
   */
  protected async executeQueryList<T>(query: string, appUserId?: string, zoneInfo?: string): Promise<T[]> {
    const finalAppUserId = appUserId || glyvio_core.getContext().loggedUserId || '';
    const finalZoneInfo = zoneInfo || glyvio_core.getContext().zoneInfo;

    const syncClient = new sync.SyncClient();
    const response = await syncClient
      .jeannieQueryList<T>({
        query,
        appUserId: finalAppUserId,
        zoneInfo: finalZoneInfo,
      })
      .call({ environmentId: '' });
    return response?.result || [];
  }

  /**
   * Executes a query returning a single record from the local offline sync DB.
   */
  protected async executeQueryFirst<T>(query: string, appUserId?: string, zoneInfo?: string): Promise<T | null> {
    const finalAppUserId = appUserId || glyvio_core.getContext().loggedUserId || '';
    const finalZoneInfo = zoneInfo || glyvio_core.getContext().zoneInfo;

    const syncClient = new sync.SyncClient();
    const response = await syncClient
      .jeannieQueryFirst<T>({
        query,
        appUserId: finalAppUserId,
        zoneInfo: finalZoneInfo,
      })
      .call({ environmentId: '' });
    return response?.result || null;
  }
}
```

---

## 🔍 Database Similarity & Fuzzy Matching for Voice Inputs

AI Agents often receive spoken audio inputs (voice messages) transcribed into text. To ensure high accuracy when matching entities (e.g., finding the correct client or person whose name might be slightly misspelled or accented in transcription), queries should perform fuzzy search utilizing PostgreSQL's **similarity** and **unaccent** extensions.

### 2. Entity Matching Service (`src/services/entity_service.ts`)

```typescript
import { BaseService } from './base_service';

export interface EntityMatchResult {
  id: string;
  name: string;
  type: 'client' | 'person';
}

export interface CrossMatchResult {
  clientId: string;
  clientName: string;
  personId: string;
  personName: string;
}

export class EntityService extends BaseService {
  private static instance: EntityService;

  private constructor() {
    super();
  }

  public static getInstance(): EntityService {
    if (!EntityService.instance) {
      EntityService.instance = new EntityService();
    }
    return EntityService.instance;
  }

  /**
   * Resolves entity references using postgres unaccented similarity matching.
   * Useful when AI transcribes audio with slight spelling variations.
   */
  async findCrossMatches(personName: string, clientName: string): Promise<CrossMatchResult[]> {
    const query = `
      SELECT c.id as "clientId", c.name as "clientName", p.id as "personId", p.name as "personName"
      FROM person p
      JOIN client_person cp ON cp.person_id = p.id AND cp.deleted = false
      JOIN client c ON c.id = cp.client_id AND c.deleted = false
      WHERE public.similarity(p.name, public.unaccent('${personName}')) > public.show_limit()
        AND public.similarity(c.name, public.unaccent('${clientName}')) > public.show_limit()
        AND p.deleted = false AND c.deleted = false
    `;
    return this.executeQueryList<CrossMatchResult>(query);
  }
}
```

---

## 🛠️ Complete Implementation: The Daily Briefing Tool

The daily briefing tool aggregates schedule tasks, attention-flagged chats, and stalled sales orders in a single concurrent query, and returns a detailed report structured for both the user and the LLM.

Create `src/system_tools/daily_briefing_tool.ts`:

```typescript
import { ChatService } from '../services/chat_service';
import { TaskService } from '../services/task_service';
import { SaleService } from '../services/sale_service';

/**
 * Request payload schema for the daily briefing system tool.
 * All properties are documented explicitly so the AI Agent understands their purpose at runtime.
 */
export interface DailyBriefingRequest {
  /**
   * Optional specific date for the briefing in ISO 8601 format (e.g., '2026-05-14').
   * If not provided, the system will default to the current day.
   */
  targetDate?: string;

  /**
   * Optional specific user ID to fetch the briefing for.
   * If not provided, the system will default to the currently logged-in user.
   */
  targetUserId?: string;
}

@glyvio_core.SystemTool({
  id: 'daily_briefing',
  permission: glyvio_permissions.tool_daily_briefing,
  description:
    'Creates a briefing of tasks, meetings, events, and pending chat attentions for a specific date. Can be used for the logged-in user or a specific target user.',
})
export class DailyBriefingTool implements glyvio_core.CoreSystemTool<DailyBriefingRequest> {
  /**
   * Retrieves the current logged-in user ID from the system context.
   */
  private getLoggedUserId(): string | null {
    const context = glyvio_core.getContext();
    return context.loggedUserId || null;
  }

  /**
   * Main entrypoint triggered by the AI Agent.
   */
  async handle(request?: DailyBriefingRequest): Promise<string> {
    const userId = request?.targetUserId || this.getLoggedUserId();

    if (!userId) {
      return 'Error: Unable to generate briefing. No user ID provided and no user is currently logged in.';
    }

    // Safely extract target date
    const dateStr = request?.targetDate ? request.targetDate.split('T')[0] : new Date().toISOString().split('T')[0];

    // Fetch information concurrently to maximize performance
    const [tasks, attentionChats, stalledSales] = await Promise.all([
      TaskService.getInstance().fetchUserSchedule(userId, dateStr),
      ChatService.getInstance().fetchChatsNeedingAttention(dateStr),
      SaleService.getInstance().fetchStalledSales(dateStr, 30), // Orders stalled for over 30 days
    ]);

    return this.buildBriefingReport(dateStr, tasks, attentionChats, stalledSales, userId);
  }

  /**
   * Builds the formatted text block report.
   * Note: The report ends with explicit formatting instructions directly to the LLM.
   */
  private buildBriefingReport(
    dateStr: string,
    tasks: BriefingTask[],
    attentionChats: AttentionChat[],
    stalledSales: StalledSale[],
    userId: string,
  ): string {
    const isLoggedUser = userId === this.getLoggedUserId();
    const userContextStr = isLoggedUser ? 'your' : `user ID ${userId}'s`;

    let report = `Daily Briefing for ${dateStr}:\n\n`;

    // --- SECTION 1: Schedule & Tasks ---
    report += `=== SCHEDULE & MEETINGS ===\n`;
    if (!tasks || tasks.length === 0) {
      report += `There are no tasks or meetings scheduled on ${userContextStr} calendar for this date.\n`;
    } else {
      report += `There are ${tasks.length} items scheduled on ${userContextStr} calendar.\n`;
      tasks.forEach((task, index) => {
        const start = new Date(task.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(task.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const meetingType = task.isOnline ? '[Online]' : '[In-Person/Task]';
        report += `${index + 1}. ${start} - ${end} | ${task.title} ${meetingType}\n`;
      });
    }

    // --- SECTION 2: Attention Chats ---
    report += `\n=== CONVERSATIONS NEEDING ATTENTION (From Previous Day) ===\n`;
    if (!attentionChats || attentionChats.length === 0) {
      report += `Great news! There are no chats from the previous day that require immediate attention.\n`;
    } else {
      report += `There are ${attentionChats.length} conversations from yesterday flagged for attention:\n`;
      attentionChats.forEach((chat, index) => {
        report += `\nAlert ${index + 1}: ${chat.subject} [Status: ${chat.fo_status}]\n`;
        report += `Description: ${chat.cm_description || 'N/A'}\n`;
      });
    }

    // --- SECTION 3: Stalled Orders ---
    report += `\n=== STALLED ORDERS (> 30 Days) ===\n`;
    if (!stalledSales || stalledSales.length === 0) {
      report += `Excellent! There are no stalled orders requiring attention.\n`;
    } else {
      report += `Warning: There are ${stalledSales.length} orders that have been stuck in the same status for over 30 days:\n`;
      stalledSales.forEach((sale, index) => {
        report += `\nOrder ${index + 1}: Code ${sale.code} | Client: ${sale.name}\n`;
        report += `Notes: ${sale.notes || 'No notes provided'}\n`;
      });
    }

    // --- SYSTEM INSTRUCTIONS FOR THE AI ---
    report += `\nInstructions for the LLM: Present this briefing to the user in a natural, conversational, and encouraging tone. Go over the schedule first, then summarize any conversations needing attention, and finally mention any stalled orders to keep the sales pipeline moving.`;

    return report;
  }
}
```

---

## 🔍 Key Architectural Guidelines for System Tools

1. **AI Agent Interface**: A system tool's final client is the AI. Design the output strings or JSON structures to be highly readable for an LLM.
2. **Parameters JSDoc**: Document every request parameter field. Complying with this rule ensures the tool's schemas are successfully generated and understood by the AI.
3. **Similarity queries**: Use `public.similarity(column, public.unaccent('query_str')) > public.show_limit()` for high precision, error-tolerant queries in voice-driven environments.
4. **Offline Sync Client Execution**: Run raw local database queries using the `sync.SyncClient().jeannieQueryList()` structure.
5. **Instruction Injecting**: At the end of tool outputs, insert formatting rules/instructions for the LLM to guide how it should present the gathered data back to the user.
