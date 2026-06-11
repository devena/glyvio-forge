---
name: create-send-modal
description: 'Generates a standard message sending modal (supporting email and WhatsApp templates, attachments, and dynamic reports) with recipient list populating, state handling, and menu/route registration.'
---

# Agent Skill: Create Custom SimpleSendModal View in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate a fully functional message/attachment sending modal (extending `SimpleSendModal`) within a Glyvio plugin project.

---

## 🎯 Skill Metadata

- **Name**: `create_send_modal`
- **Description**: Generates a standard message sending modal (supporting email and WhatsApp templates, attachments, and dynamic reports) with recipient list populating, state handling, and menu/route registration.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Context/Entity Name** (e.g., `Invoice`, `PurchaseOrder`): The logical context name or main entity type that is driving the send operation.
2. **Plugin Namespace** (e.g., `my_plugin`): The namespace registered for the plugin.
3. **Route Path** (e.g., `/invoice-send`): The URL path for the modal (must start with `/` and be a single word/slug).
4. **Recipient Retrieval Logic**: How the modal retrieves target recipient contact persons (`SimpleSendModalPersonDTO[]`) from the route parameters (e.g. loading contacts linked to the invoice's customer).
5. **Initial State Configuration & Route Parameters**: Any initial properties to load and bind (e.g. `invoiceId` parameter to load the invoice record).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No External Imports for Glyvio Globals**: Glyvio classes, decorators, services, and entities are injected globally at runtime. Do NOT import them from core packages.
   - _Example:_ Use `new glyvio_core.ActionButtonDesign(...)`, NOT `import { ActionButtonDesign } ...`
2. **Strict Routing rules**: `getRoutePath()` must return a path starting with `/` followed by alphanumeric characters or underscores.
3. **Data Types & Models**: All referenced model fields must exist under the namespace `glyvio_entity.<ContextName>`.
4. **No any or force cast**: Do not use `any` or force cast to `any` to resolve type errors. Find another way to solve the problem.
5. **`events()` — EventReturn rule**: Every new `action.key` handler added to `events()` **must** return `'STATE_UPDATE'` when it mutates state properties directly. Use `'STATE_FREEZED'` only for navigation actions (`pushPage`, `pushModal`, `popModal`). Never return `undefined` from a newly added key — that is a silent no-op.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Create the Send Modal File

Create a new file `src/views/modals/<context_name_snake_case>_send_modal.ts` inside the target plugin's codebase and write the implementation using the blueprint below.

### Step 2: Register the Route

Add the route class to the routing configuration array (typically inside `src/index.ts` where other routes are loaded):

```typescript
glyvio_core.routerService.loadRoutes([
  // ... other routes
  YourContextSendModalRoute,
]);
```

---

## 📄 Code Blueprint (Template)

Replace all placeholder values wrapped in `<...>` with the corresponding input parameters:

```typescript
// Define custom options for configuring the modal route query
export interface <ContextName>SendModalOptions {}

// Define route params
export interface <ContextName>SendModalRouteParams extends glyvio_core.SimpleSendModalRouteParams {
  id?: string; // The primary ID of the <ContextName> record
}

// Define page state
export interface <ContextName>SendModalState extends glyvio_core.SimpleSendModalState<<ContextName>SendModalRouteParams> {
  <contextNameCamelCase>?: glyvio_entity.<ContextName> | null;
}

/**
 * Route definition for invoking the <ContextName> Send Modal.
 */
export class <ContextName>SendModalRoute extends glyvio_core.SimpleSendModalRoute<<ContextName>SendModalRouteParams> {
  getRoutePath(): string {
    return '<RoutePath>'; // e.g. '/invoice-send'
  }

  getRouteNameSpace(): string {
    return '<PluginNamespace>';
  }

  getRouteNameObject(): string {
    return '<ContextName>SendModal';
  }

  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return glyvio_permissions.view_<contextNameSnakeCase>_send_modal;
  }
}

/**
 * Custom Send Modal component for configuring and sending emails or WhatsApp messages.
 */
export class <ContextName>SendModal extends glyvio_core.SimpleSendModal<<ContextName>SendModalState> {
  constructor() {
    super(<ContextName>SendModalRoute);
  }

  /**
   * Initializes the state of the modal by loading the main context entity.
   */
  async initState(state: <ContextName>SendModalState): Promise<void> {
    await super.initState(state);
    if (state.routeParams.id) {
      state.<contextNameCamelCase> = await glyvio_entity.<ContextName>.findById(state.routeParams.id);
    }
  }

  /**
   * Retrieves the target recipients and contact channels for sending.
   */
  async getPersonsDTO(state: <ContextName>SendModalState): Promise<glyvio_core.SimpleSendModalPersonDTO[]> {
    if (!state.<contextNameCamelCase>) {
      return [];
    }

    // 💡 Example: Load recipient person and their contact channels
    // const customer = await state.<contextNameCamelCase>.customer;
    // return [
    //   {
    //     key: customer.id!,
    //     name: customer.name || 'Recipient',
    //     contacts: [
    //       {
    //         key: 'customer_email',
    //         label: 'Email',
    //         value: customer.email || '',
    //         selected: true,
    //         isMain: true,
    //         data: {},
    //       },
    //     ],
    //     data: {},
    //   },
    // ];
    return [];
  }

  /**
   * Customizes layout designs or configures properties for the modal design.
   */
  getDesign(state: <ContextName>SendModalState, design: glyvio_core.SimpleSendModalDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign;
    appBar.title = 'Send <ContextName>';
  }

  /**
   * Intercepts custom events fired inside the send modal view.
   */
  async events(state: <ContextName>SendModalState, action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    // New state-mutating key → return 'STATE_UPDATE'
    // if (action.key === 'myKey') {
    //   state.myProperty = action.data;
    //   return 'STATE_UPDATE';
    // }
    return undefined;
  }
}

/**
 * Abstract Interceptor/Listener base class defined by this modal view.
 */
export abstract class <ContextName>SendModalInterceptor extends glyvio_core.SimpleSendModalInterceptor<<ContextName>SendModalState> {
  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <ContextName>SendModalRoute;
  }
}
```
