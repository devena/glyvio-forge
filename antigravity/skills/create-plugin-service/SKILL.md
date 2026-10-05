---
name: create-plugin-service
description: "Defines or implements a cross-plugin service contract with glyvio_core.pluginService and PluginServiceInterface — one plugin declares an abstract provider (e.g. billing/bank, invoicing, shipping, fiscal country) and other plugins register implementations that the first one discovers at runtime with getServicesByType — including contract versioning and the built-in contracts (report processor, chat channels)."
---
<!-- Generated from src/skills/create-plugin-service/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Cross-Plugin Service Contracts

`glyvio_core.pluginService` is a registry of implementations keyed by a **type** string:

| Call | |
| --- | --- |
| `registerService(type, instance)` | an implementing plugin registers itself (once, at load time) |
| `getServicesByType(type): PluginServiceInterface[]` | the consumer lists every installed implementation |
| `getServiceByPluginId<T>(pluginId)` | the implementation registered by a given plugin |
| `getAllServices()` | everything |

Every implementation extends `glyvio_core.PluginServiceInterface` (`getPluginId()`,
`getPluginName()`, `getVersion()`). The registry lives in each layer: register an implementation
in the **same layer where it is consumed** — your own contracts usually on the server; the built-in
Glyvio contracts below are consumed by app screens (report button, send modal, chat views), so
their implementations are registered in **`plugin/app`**.

Built-in contracts from Glyvio (implement them in the app layer, do not redefine):

| Contract | `type` | Skill |
| --- | --- | --- |
| `glyvio_core.PluginServiceInterfaceReportProcessor` | `'REPORT_PROCESSOR'` | `configure-report-record` |
| `glyvio_core.PluginServiceInterfaceChatAgentMail` / `Whatsapp` / `Telegram` / `Instagram` / `Facebook` / `Linkedin` / `Phone` | `'mail'`, `'whatsapp'`, ... `'phone'` | `create-chat-channel-integration` |

---

## 📥 Required Input Parameters

1. **Role**: are you *defining* a contract (plugin A) or *implementing* one (plugin B)?
2. Contract operations (inputs/outputs), the `type` string, and the version.
3. Layer: where the consumer runs (built-in contracts → app; your own contracts → usually server).
4. For an implementation: the contract's plugin namespace (it must be a `dependencies` entry in
   `manifest.json`, so its `.d.ts` shows up in `@types/` — skill `modify-manifest`).

---

## 🚫 Rules

1. **Contract plugin**: declare the contract as an `abstract class ... extends glyvio_core.PluginServiceInterface`
   with a `static type = '<plugin>_<capability>'`, export it from `index.ts` (so dependents see it as
   `<plugin>.<Contract>`), keep inputs/outputs as plain serializable types, and add a
   `contractVersion()` so you can refuse implementations built for a newer contract.
2. **Never trust a listed service blindly**: filter with a type guard (`typeof s.key === 'function'`)
   and handle "none installed" with a clear `GlyvioError`.
3. **Implementing plugin**: `extends <contractPlugin>.<Contract>`, return your `PLUGIN_ID`,
   `PLUGIN_NAME`, `VERSION` (exported by your plugin) in the identity methods, and register one
   instance at load time: `glyvio_core.pluginService.registerService(<contractPlugin>.<Contract>.type, new <Impl>())`.
   Make sure the file is imported by `index.ts` (a module never imported never registers).
4. External calls (bank APIs, carriers) belong in the environment layer: the server implementation
   calls them with `glyvio_core.environmentService.callEnvironmentActionRaw(environmentId, action, data)`
   (skill `create-environment-action`). Secrets via `secretService`, never hardcoded.
5. Asynchronous results coming back later (webhooks, status changes) go through a documented entry
   point of the contract plugin — a strategy (`create-strategy`) or controller — not by writing its tables directly.

---

## 📄 Code Blueprint

### Contract (plugin A, server)

```typescript
export const <CAPABILITY>_CONTRACT_VERSION = 1;

export interface <Capability>Request {
  referenceId: string;
  amountCents: number;
}

export interface <Capability>Result {
  externalId?: string;
  error?: string;
}

export abstract class <Contract> extends glyvio_core.PluginServiceInterface {
  static type = '<plugin>_<capability>';

  /** Stable key saved in your records, e.g. 'acme'. */
  abstract key(): string;
  abstract label(): string;
  abstract execute(request: <Capability>Request): <Capability>Result;

  contractVersion(): number {
    return <CAPABILITY>_CONTRACT_VERSION;
  }
}

export function find<Contract>(key: string): <Contract> {
  const provider = glyvio_core.pluginService
    .getServicesByType(<Contract>.type)
    .filter((s): s is <Contract> => typeof (s as <Contract>).key === 'function')
    .find((p) => p.key() === key);
  if (!provider) {
    throw new glyvio_core.GlyvioError({ message: `Provider "${key}" is not installed in this company.` });
  }
  if (provider.contractVersion() > <CAPABILITY>_CONTRACT_VERSION) {
    throw new glyvio_core.GlyvioError({ message: `Provider "${provider.label()}" requires a newer version of this plugin.` });
  }
  return provider;
}
```

### Implementation (plugin B, server)

```typescript
// in plugin B the contract is reached through its namespace: <contractPlugin>.<Contract>
export class <Impl> extends <ContractRef> {
  getPluginId(): string {
    return PLUGIN_ID;
  }
  getPluginName(): string {
    return PLUGIN_NAME;
  }
  getVersion(): string {
    return VERSION;
  }
  key(): string {
    return '<provider_key>';
  }
  label(): string {
    return '<Provider label>';
  }
  execute(request: <RequestRef>): <ResultRef> {
    // call the environment action that talks to the external system
    return { externalId: request.referenceId };
  }
}

glyvio_core.pluginService.registerService(<ContractRef>.type, new <Impl>());
```

`PLUGIN_ID`, `PLUGIN_NAME` and `VERSION` are exported by your own plugin's shared package (they
come from the build). Add plugin A to `dependencies` in plugin B's `manifest.json` and regenerate
`@types` so `<contractPlugin>.d.ts` appears.

---

## ✅ Completion Checklist

- [ ] Contract: abstract class with `static type`, exported, versioned, plain I/O types; lookup with type guard and clear errors.
- [ ] Implementation: identity methods, one `registerService` at load time, file imported by `index.ts`.
- [ ] Dependency declared in `manifest.json`; external I/O in the environment layer; secrets via `secretService`.
- [ ] Verified end to end (both plugins installed in a test company).
