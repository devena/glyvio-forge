---
name: use-ai-service
description: "Asks the platform AI (Jeannie 3.1 `ask`) from a screen or the server with glyvio_core.aiService — one model call that returns text or JSON, with the instructions and answer shape kept in a `prose` skill published in the plugin manifest, errors as codes with translated messages, and the AI button hidden when the company has no AI. Also covers the AI button of an HTML field (HtmlTextfieldDesign.contextAi). Use for summaries, suggestions, rewrites, classification or extraction of a record's text; NOT for a conversational agent with tools (create-custom-agent) or a Jeannie tool (create-system-tool)."
---
# Agent Skill: Platform AI (`aiService`)

`glyvio_core.aiService` sends **one** question to the Jeannie 3.1 `ask` action — no tools, no memory, no stored
history — in the environment of its rule (the plugin's `environment_rule`, or the global one). Never call the
Jeannie plugin by id with `pluginService.call`, and never depend on the old `jeannie_v2` package.

| Layer | Call | Result |
| --- | --- | --- |
| app | `await glyvio_core.aiService.ask(request)` | `AiResult` — never throws |
| app | `await glyvio_core.aiService.askText(request)` / `askJson<T>(request)` | the text / the parsed JSON; throws `GlyvioError` with the translated message |
| app | `glyvio_core.aiService.availableNow()` | sync: whether the AI answers `ask` (status read at startup) |
| server | `glyvio_core.aiService.ask(request)` / `askText` / `askJson<T>` / `isAvailable()` | same, synchronous |

`AiResult` is `{ ok: true, text, response }` or `{ ok: false, code, message }`. Turn a code into the message a user
reads with `glyvio_core.aiErrorMessage(code)` (`$T{core_ai_error_<code>}`, generic `$T{core_ai_error}` otherwise).

The request (`glyvio_core.AiAskRequest`):

| Field | |
| --- | --- |
| `question` | the text sent as the user message — **only the facts** when a skill holds the instructions |
| `skill`, `skillLanguage` | slug of a `prose` skill (see below) and `'pt'`/`'en'` |
| `responseFormat` | `'json'` to get a JSON value as text (validated against the skill's `output`) |
| `level` | `'low'` (default, light model) or `'high'` |
| `messageHistory` | `[{ origin: 'system' \| 'user', text }]` — extra instructions or earlier turns |
| `asUserId` | server only, without a logged-in user: run as this user (limits, permissions) |

---

## 🧩 Pattern — skill in the manifest, facts in the question

Keep the instructions and the answer shape in a **`prose` skill** in the root `skills` block of `manifest.json`;
the Jeannie loads it with the plugin and the prompt can be changed without touching code.

```json
"skills": [
  {
    "slug": "<plugin>-<purpose>",
    "language": "pt",
    "name": "<Nome curto>",
    "description": "<O que a skill responde, numa frase.>",
    "version": 1,
    "body": "```jeannie-skill\n{\"schemaVersion\": 1, \"format\": \"prose\", \"apply\": {\"when\": \"mention\"}, \"output\": {\"schema\": {\"summary\": {\"type\": \"string\", \"maxChars\": 600, \"required\": true}, \"priority\": {\"type\": \"enum\", \"values\": [\"baixa\", \"media\", \"alta\"]}}}}\n```\n# <Título>\n\n<As instruções, em prosa: o que a mensagem traz e o que cada campo da resposta deve conter.>"
  }
]
```

- One entry per language (`pt` and `en`), same slug. Bump `version` when the text changes.
- `"apply": { "when": "mention" }` keeps the skill out of the Jeannie's chat turns: it only runs when asked by slug.
- `output.schema` field types: `string` (`maxChars` 1–2000, default 500), `enum` (`values`, 2–30), `boolean`,
  `integer`, `number` (`min`/`max`). Keys: `type`, `required`, `description` (≤ 200 chars) plus the type's own.
  **No arrays or nested objects** — use `item1`, `item2`, `item3`. Up to 30 fields; unknown keys make the skill
  invalid. Optional fields come back as `null`.

```typescript
type <Name>Answer = { summary: string; priority: 'baixa' | 'media' | 'alta' | null };

const r = await glyvio_core.aiService.ask({
  question: [`Assunto: ${record.subject ?? ''}`, `Texto: ${record.description ?? ''}`].join('\n'),
  skill: '<plugin>-<purpose>',
  skillLanguage: glyvio_core.translaterService.locale.startsWith('en') ? 'en' : 'pt',
  responseFormat: 'json',
});
if (!r.ok) {
  // show glyvio_core.aiErrorMessage(r.code) in the screen (toast, muted text)
  return;
}
const answer = glyvio_core.parseAiJson<<Name>Answer>(r.text);
```

**Fallback for an older Jeannie** (the skill not published yet): on a `skill_*` code, ask again with the
instructions inline in the question.

```typescript
let r = await glyvio_core.aiService.ask({ question: facts, skill: SLUG, responseFormat: 'json' });
if (!r.ok && r.code.startsWith('skill_')) {
  r = await glyvio_core.aiService.ask({ question: `${INLINE_INSTRUCTIONS}\n\n${facts}` });
}
```

Keep the parser tolerant to both shapes (the core's Compor tab reads `suggestions: []` from the inline prompt and
`suggestion1..3` from its skill `glyvio-compor-email`).

---

## 🧩 Pattern — hide the AI when the company has none

The core reads `jeannie_status` once at startup. In a design built synchronously:

```typescript
...(glyvio_core.aiService.availableNow() ? [aiButton] : []),
```

and guard the state (a tab or panel saved as open while the AI went away falls back to another one). In async
code, `await glyvio_core.aiService.isAvailable()`.

---

## 🧩 Pattern — AI button of an HTML field

`HtmlTextfieldDesign.contextAi` — what the text is for — turns on the editor's AI panel in both hosts: ready-made
requests (fix, more formal, shorter, friendlier; "write with AI" when the field is empty), free text, and the AI's
**proposal** with Apply · Try again · Discard, then Undo. The core handles it (action `_AI_FIELD`, skill
`glyvio-campo-html`): name marks (`@PERSON_NAME@`), template marks and image/link addresses are protected, the answer
is cleaned to the field's body, and nothing reaches the field before Apply. Nothing to code; the button disappears
when the AI is unavailable. The pending proposal lives in `state.aiProposals` — do not save that key.

```typescript
new glyvio_core.HtmlTextfieldDesign({
  name: 'state.body',
  label: '$T{<plugin>_mail_body}',
  contextAi: 'um e-mail comercial para o cliente',
});
```

---

## Errors (`code`)

| Code | Meaning |
| --- | --- |
| `unavailable` | no environment for the Jeannie 3.1 in the company |
| `ask_unavailable` | `askApi` disabled in the Jeannie's settings (Experimental card), or a call without a user while `askApi.serviceCalls` is off |
| `daily_limit`, `too_large` | usage limit reached / question too large |
| `skill_unavailable`, `skill_not_allowed`, `skill_check_failed` | skill missing, not `prose`, or its check failed — use the fallback |
| `permissionDenied`, `as_user_unavailable` | the user cannot use the AI / `asUserId` not allowed |
| `ask_failed` | the model failed, or the answer was empty or not valid JSON |

## Server notes

- In a queued interceptor, workflow step or controller without a logged-in user, the Jeannie needs
  `askApi.serviceCalls` on; pass `asUserId` so the user's limits and permissions apply.
- The server call is synchronous and slow (seconds): run it in an after-commit interceptor or a queued operation
  (`schedule-queued-operation`), never inside a save transaction.

## Checklist

- [ ] instructions in a `prose` skill (pt + en) with `apply.when: mention`; only facts in `question`
- [ ] `output.schema` without arrays; parser tolerant to `null`
- [ ] `skill_*` fallback with inline instructions while older Jeannies are in the field
- [ ] errors shown with `aiErrorMessage(code)`; nothing thrown at the user from `ask`
- [ ] AI entry points hidden with `availableNow()` / `isAvailable()`
