---
name: create-environment-action
description: "Generates an Environment-layer @Action (SimpleAction, or typed GenericActionOnEnvironment) that runs code in the customer's environment — calling external HTTP APIs with secrets, reaching local-network systems, heavy processing — and the server/app code that invokes it with environmentService.callEnvironmentActionRaw, including how to pick the environment id and parse the result."
---
<!-- Generated from src/skills/create-environment-action/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create an Environment Action

The **environment** layer (`plugin/environment`, Node.js) runs in the customer's environment, not
in the Glyvio server. It is where a plugin talks to the outside world: external APIs (with
`fetch`), systems on the customer's network, files, long computations. An `@Action` exposes one
operation there; server or app code calls it by id.

| Need | Use |
| --- | --- |
| Operation called by your own server/app code | **this skill** |
| Rows pulled into Glyvio by the Sync plugin on a schedule | `create-sync-extraction-action` (`SimpleSyncAction`) |
| A tool the AI assistant (Jeannie) can call | `create-system-tool` / `create-custom-agent` |

---

## 📥 Required Input Parameters

1. Action **id** (`'<plugin>_<verb>_<object>'`), input and output shapes.
2. External system, credentials (stored as a Glyvio secret — never in code), timeouts.
3. Caller: server (synchronous) or app (async), and how the **environment id** is chosen.

---

## 🚫 Rules

1. Class decorated with `@glyvio_core.Action({ id })` and extending either:
   - `glyvio_core.GenericActionOnEnvironment<Request, Response>` — **preferred**: implement
     `execute(request)`; JSON parsing/serialization and error wrapping are done for you;
   - `glyvio_core.SimpleAction` — implement `handle(request?: string)`, parse/stringify yourself.
2. The file must be imported by the environment `index.ts`, otherwise the decorator never runs.
3. Throw `glyvio_core.GlyvioError({ message })` for business errors; other errors are wrapped.
4. Secrets: `await glyvio_core.secretService.getPopulatedSecretById<T>(secretId)` (the secret id
   comes from your plugin's configuration record) — never hardcode tokens or URLs with credentials.
5. **The environment id is never implicit.** Callers resolve it: query `glyvio_entity.Environment`
   (not deleted, excluding the built-in `core_app`/`core_server`), or read it from your plugin's
   configuration record. If several exist and the choice matters, make it a configuration field —
   do not guess.
6. Call from the server: `glyvio_core.environmentService.callEnvironmentActionRaw(envId, '<id>', data)`
   → `{ status, result }` (synchronous); from the app: same call with `await`. `result` may arrive as
   the JSON **string** your action returned: `typeof result === 'string' ? JSON.parse(result) : result`.
7. `sequenceService.nextval` is not implemented in this layer (returns 0) — get numbers from the server.
8. Keep inputs/outputs small and serializable; for large payloads store the data (attachment/entity)
   and pass ids.
9. **Dates in the company's time zone**: the environment layer does not set the company zone. Before any calendar logic call `glyvio_core.DateTime.setZoneinfo(glyvio_core.sessionService.getCurrentSession().company.zoneinfo ?? 'UTC')`, then use `DateTime` calendar methods (`toCalendarDay`, `format`, `startOfDay`…) — never `new Date()`, `toISOString().split('T')` or `toLocale*String`. Guide: `.claude/references/dates_and_timezones.md`.

---

## 📄 Code Blueprint

### Environment (`plugin/environment/src/actions/<action>.ts`)

```typescript
export interface <Name>Request {
  secretId: string;
  <param>: string;
}

export interface <Name>Response {
  ok: boolean;
  <resultField>?: string;
}

type <Name>Credentials = { token: string; baseUrl: string };

@glyvio_core.Action({ id: '<action_id>' })
export class <Name>Action extends glyvio_core.GenericActionOnEnvironment<<Name>Request, <Name>Response> {
  async execute(request: <Name>Request | undefined): Promise<<Name>Response | undefined> {
    if (!request?.<param>) {
      throw new glyvio_core.GlyvioError({ message: '<param> is required' });
    }
    const secret = await glyvio_core.secretService.getPopulatedSecretById<<Name>Credentials>(request.secretId);
    const credentials = secret?.secret; // Secret<T> keeps the payload in `secret`
    if (!credentials) {
      throw new glyvio_core.GlyvioError({ message: 'Credentials not configured' });
    }
    const response = await fetch(`${credentials.baseUrl}/resource/${encodeURIComponent(request.<param>)}`, {
      headers: { Authorization: `Bearer ${credentials.token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new glyvio_core.GlyvioError({ message: `External service answered ${response.status}` });
    }
    const body = (await response.json()) as { value?: string };
    return { ok: true, <resultField>: body.value };
  }
}
```

Import it in `plugin/environment/src/index.ts`: `import './actions/<action>';`.
`Secret<T>` keeps the decrypted payload in its `secret` field (`secret?.secret?.token`).

### Server caller

```typescript
function resolveEnvironmentId(): string {
  const env = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.Environment>(glyvio_structure.AllEntities.environment)
    .addFilterOperator(glyvio_structure.AllEntities.environment.deleted, false)
    .addFilterOperator(glyvio_structure.AllEntities.environment.id, 'core_app', { operator: 'NOT_EQUAL' })
    .addFilterOperator(glyvio_structure.AllEntities.environment.id, 'core_server', { operator: 'NOT_EQUAL' })
    .findFirst();
  if (!env?.id) {
    throw new glyvio_core.GlyvioError({ message: 'No environment configured for this company' });
  }
  return env.id;
}

function call<Name>(secretId: string, <param>: string): { ok: boolean; <resultField>?: string } {
  const response = glyvio_core.environmentService.callEnvironmentActionRaw(resolveEnvironmentId(), '<action_id>', {
    secretId,
    <param>,
  });
  const result = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
  return result as { ok: boolean; <resultField>?: string };
}
```

In the app the same call is `await glyvio_core.environmentService.callEnvironmentActionRaw(...)` and
the `QueryBuilder` is async (`await ...findFirst()`).

---

## ✅ Completion Checklist

- [ ] `@glyvio_core.Action({ id })` + `GenericActionOnEnvironment` (or `SimpleAction`); file imported by the environment `index.ts`.
- [ ] Credentials from `secretService`; timeouts on external calls; business errors as `GlyvioError`.
- [ ] Callers resolve the environment id explicitly and parse a string `result`.
- [ ] `DateTime.setZoneinfo(...)` called before any date logic; no `new Date()` for calendar days.
- [ ] Environment, server and app builds clean; action exercised end to end in a test company.
