---
name: create-chat-channel-integration
description: "Builds a plugin that connects a messaging/voice channel (WhatsApp provider, e-mail provider, Telegram, Instagram, Facebook, LinkedIn, a PBX/phone system) to Glyvio's chat features end to end: chat agent records, the provider service (PluginServiceInterfaceChatAgent*), the conversation view, the chat list extension (open/create sessions), the send modal extension, outbound delivery through the environment layer and inbound messages saved as ChatSession/ChatMessage."
---
<!-- Generated from src/skills/create-chat-channel-integration/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Chat Channel Integration

Glyvio has one conversation model for every channel:

| Entity | Key fields |
| --- | --- |
| `ChatAgent` — a connected account/line | `type` (`glyvio_core.constants.chatAgentTypes.*`: `whatsapp`, `mail`, `telegram`, `instagram`, `facebook`, `linkedin`, `phone`), **`pluginId` (your plugin)**, `environmentId`, `secretId`, `name`, `color`, `isPrivate`, `userGroupId` |
| `ChatSession` — a conversation | `chatAgent`, `sessionIdentifier` (convention: `` `${agentId}|${remoteId}` ``), `chatChannel`, `subject`, `start`/`finish`/`isFinished`, `assignedAppUser`, `viewed`/`unviewedCount`, `lastMessageTimestamp`, `isArchived` |
| `ChatMessage` — one message | `chatSession`, `messageText`, `messageType`, `messageDirection` (`'inbound'`/`'outbound'`), `messageTimestamp`, `status`, `appUser` (outbound author), `senderName`, `replyToMessageId` |

The core screens (chat list `/chat-list`, send modal, dial modal, conversation views) find your code
by the agent's **`pluginId`** and **`type`**. A channel plugin provides:

| # | Piece (layer) | API |
| --- | --- | --- |
| 1 | Agent setup screen that creates `ChatAgent` rows (app) | your own edit page/modal (`create-edit-page`), saving `type`, `pluginId: PLUGIN_ID`, `environmentId`, `secretId`, `userGroupId` |
| 2 | Provider service (app) | class implementing `glyvio_core.PluginServiceInterfaceChatAgent<Mail\|Whatsapp\|Telegram\|Instagram\|Facebook\|Linkedin\|Phone>`, registered with `glyvio_core.pluginService.registerService(<Interface>.type, instance)` |
| 3 | Conversation view (app) | extend `glyvio_core.WhatsappChatView` / `MessagingChatView` (Telegram, Instagram, Facebook, LinkedIn) / `MailChatView` / `PhoneChatView`; override `sendMessage` |
| 4 | Chat list extension (app) | `glyvio_core.ChatListPage.addExtension(type, PLUGIN_ID, <X>ChatListInterceptor)` — a `ChatListPageAgentTypeInterceptor` with `getChatViewRouteForSession` (+ `newSession`) |
| 5 | Send modal extension (app, optional) | `glyvio_core.SimpleSendModal.addExtension(PLUGIN_ID, <X>SendModalInterceptor)` extending `SimpleSendModal<Mail\|Whatsapp\|Telegram\|Phone>AgentTypeInterceptor` |
| 6 | Outbound transport (environment) | `@Action`s that call the provider API (`create-environment-action`) |
| 7 | Inbound messages (environment/server) | webhook controller or environment listener that saves `ChatSession` + `ChatMessage` (`direction: 'inbound'`) |

The chat-related services are looked up **in the app layer** (send modal, chat views, dial modal):
register the provider service in `plugin/app`.

---

## 📥 Required Input Parameters

1. Channel `type` and provider (API, webhook or socket for inbound, credentials).
2. How a remote contact is identified (phone, e-mail, chat id) → `sessionIdentifier` format.
3. Features: send text, attachments, schedule, templates, start new conversations, call (phone).
4. Plugin namespace and `PLUGIN_ID`; the `crm` plugin as a dependency if you reuse its contact pickers.

---

## 🚫 Rules

1. `ChatAgent.pluginId` **must** equal your `PLUGIN_ID` — it is how the core finds your service and extensions.
2. One provider service per channel type per plugin, registered once at load time (constructor or `index.ts`).
3. Credentials live in a secret (`ChatAgent.secretId`); the environment action reads it with `secretService`.
4. Use the same `sessionIdentifier` format everywhere (send, inbound, `extractPhoneNumber`/`extractChatId`).
5. Inbound: find the open session by `sessionIdentifier` (+ `isFinished = false`) or create it; save
   the message with `messageDirection: 'inbound'`; update `lastMessageTimestamp`, `viewed = false`;
   every new row gets the agent's `userGroupId`. Deduplicate by the provider message id
   (`integrationCode`) — webhooks retry.
6. Text sent to channels that do not render markdown must be stripped (see the WhatsApp example
   below); the LLM-generated text rules are in `format-llm-markdown-output`.
7. Unsupported operations (e.g. `scheduleWhatsapp`) must throw a `GlyvioError` with a clear message, not `Error('not implemented')`.

---

## 📄 Code Blueprint (WhatsApp-type provider, app layer)

```typescript
// 2. Provider service
export class <Prov>WhatsappService extends glyvio_core.PluginServiceInterfaceChatAgentWhatsapp {
  constructor() {
    super();
    glyvio_core.pluginService.registerService(glyvio_core.PluginServiceInterfaceChatAgentWhatsapp.type, this);
  }
  getPluginId(): string {
    return PLUGIN_ID;
  }
  getPluginName(): string {
    return PLUGIN_NAME;
  }
  getVersion(): string {
    return VERSION;
  }
  async sendWhatsapp(args: {
    chatAgent: glyvio_entity.ChatAgent;
    appUserId: string;
    phone: string | undefined;
    text?: string;
    attachment?: glyvio_core.PluginServiceInterfaceChatAgentAttachment;
    entityIdToLinked?: string;
    entityNameToLinked?: string;
  }): Promise<void> {
    await glyvio_core.environmentService.callEnvironmentActionRaw(args.chatAgent.environmentId!, '<prov>_send_message', {
      chatAgentId: args.chatAgent.id,
      sessionIdentifier: `${args.chatAgent.id}|${args.phone}`,
      text: args.text,
      attachment: args.attachment,
      appUserId: args.appUserId,
    });
  }
  scheduleWhatsapp(): glyvio_entity.ScheduledSrvcItem {
    throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_scheduleNotSupported}' });
  }
  async getChatInfo(args: { chatAgent: glyvio_entity.ChatAgent; chatSession: glyvio_entity.ChatSession }): Promise<glyvio_core.PluginServiceInterfaceChatAgentChatInfo> {
    return { name: args.chatSession.subject ?? '', participants: [] };
  }
  extractPhoneNumber(sessionIdentifier: string): string {
    return sessionIdentifier.split('|')[1] ?? sessionIdentifier;
  }
}

// 3. Conversation view
export interface <Prov>ChatViewRouteParams extends glyvio_core.WhatsappChatViewRouteParams {}
export interface <Prov>ChatViewState extends glyvio_core.WhatsappChatViewState<<Prov>ChatViewRouteParams> {}

export class <Prov>ChatViewRoute extends glyvio_core.WhatsappChatViewRoute<<Prov>ChatViewRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return undefined;
  }
  getRoutePath(): string {
    return '/<prov>-chat';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Prov>ChatView';
  }
}

export class <Prov>ChatView extends glyvio_core.WhatsappChatView<<Prov>ChatViewState> {
  constructor() {
    super(<Prov>ChatViewRoute);
  }

  async sendMessage(state: <Prov>ChatViewState, text: string, replyToMessageId?: string, attachment?: glyvio_core.Attachment): Promise<void> {
    const agent = state.session?.chatAgent;
    if (!agent?.environmentId) {
      throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_agentNotConfigured}' });
    }
    await glyvio_core.environmentService.callEnvironmentActionRaw(agent.environmentId, '<prov>_send_message', {
      chatAgentId: agent.id,
      sessionIdentifier: state.session?.sessionIdentifier,
      text,
      replyToMessageId,
      attachment: attachment ? { url: attachment.fullViewUrl, name: attachment.name ?? '', contentType: attachment.contentType } : undefined,
      appUserId: glyvio_core.session.user.id,
    });
  }
}

// 4. Chat list extension
export class <Prov>ChatListInterceptor extends glyvio_core.ChatListPageAgentTypeInterceptor {
  getListenerId(): string {
    return '<plugin>.chat_list';
  }

  async getChatViewRouteForSession(
    _page: glyvio_core.ChatListPage,
    _state: glyvio_core.ChatListPageState,
    session: glyvio_entity.ChatSession,
  ): Promise<glyvio_core.CoreChatViewRoute<any>> {
    return new <Prov>ChatViewRoute({ chatSessionId: session.id! });
  }

  async newSession(page: glyvio_core.ChatListPage, _state: glyvio_core.ChatListPageState, agent: glyvio_entity.ChatAgent): Promise<void> {
    // open a contact picker with a popActionKey, then create/open the session in onEvent
  }
}

// 5. Send modal extension (optional): adapt the text for the channel
export class <Prov>SendModalInterceptor extends glyvio_core.SimpleSendModalWhatsappAgentTypeInterceptor {
  prepareWhatsappArgs(
    _state: glyvio_core.SimpleSendModalState<glyvio_core.SimpleSendModalRouteParams>,
    args: glyvio_core.SimpleSendModalWhatsappArgs,
  ): glyvio_core.SimpleSendModalWhatsappArgs {
    return { ...args, bodyMarkdown: args.bodyMarkdown.replace(/<[^>]+>/g, '').replace(/^#{1,6}\s*/gm, '') };
  }
}

// plugin app index.ts
// export * from each file above;
// glyvio_core.routerService.loadRoutes([<Prov>ChatViewRoute /*, setup screens */]);
// new <Prov>WhatsappService();
// glyvio_core.ChatListPage.addExtension(glyvio_core.constants.chatAgentTypes.whatsapp, PLUGIN_ID, <Prov>ChatListInterceptor);
// glyvio_core.SimpleSendModal.addExtension(PLUGIN_ID, <Prov>SendModalInterceptor);
```

For other channels swap the interface (`...Telegram` with `sendTelegram`/`extractChatId`, `...Mail`
with `sendMail`/`scheduleMail`, `...Phone` with `dial`/`canDial`), the view base
(`MessagingChatView`, `MailChatView`, `PhoneChatView` — a PBX plugin usually only implements the
phone service, the core `PhoneChatView` already dials through it) and the send-modal base.

### 7. Inbound (sketch, server or environment)

```typescript
// on each provider event: { agentId, remoteId, providerMessageId, text, timestamp, senderName }
// 1. agent  = ChatAgent by id (pluginId == PLUGIN_ID)
// 2. session = open ChatSession where sessionIdentifier == `${agentId}|${remoteId}` and isFinished == false,
//              or a new one (chatAgent, sessionIdentifier, start = now, subject = senderName, userGroupId = agent.userGroupId)
// 3. skip if a ChatMessage with integrationCode == providerMessageId already exists
// 4. save ChatMessage { chatSession, messageText: text, messageType: 'text', messageDirection: 'inbound',
//                       messageTimestamp, senderName, integrationCode: providerMessageId, userGroupId }
//    and update the session: lastMessageTimestamp, viewed = false — in one saveList
```

Webhook endpoints are controllers (`create-controller`, public/external access with signature
validation); long-lived sockets belong in the environment layer.

---

## ✅ Completion Checklist

- [ ] `ChatAgent` rows created with `type`, `pluginId = PLUGIN_ID`, `environmentId`, `secretId`, `userGroupId`.
- [ ] Provider service registered in the app layer; unsupported operations throw `GlyvioError`.
- [ ] Conversation view route registered/exported; `sendMessage` delivers through an environment action.
- [ ] Chat list (and send modal) extensions registered with your `PLUGIN_ID`.
- [ ] Inbound messages deduplicated, scoped with `userGroupId`, session counters updated.
- [ ] End-to-end test: new conversation, send, receive, attachments, from the chat list and from the send modal.
