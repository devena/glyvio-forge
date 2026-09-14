---
name: format-llm-markdown-output
description: 'Constrains any LLM-facing prompt (System Tool / Custom Tool response, "Instructions for the LLM" block, or a JSON field the LLM fills with markdown) to the exact markdown syntax the glyvio_app renderer supports, preventing the AI Agent from producing HTML or unsupported markdown that renders as broken literal text.'
---

# Agent Skill: Format LLM Markdown Output

This skill applies whenever a prompt instructs the AI Agent (Jeannie) to produce text that will ultimately be **rendered to the end user as markdown inside `glyvio_app`** — a chat reply, an `Instructions for the LLM: ...` block appended by a `@SystemTool`/`@CustomTool`, or a JSON field (e.g. an alert's `description`) that is itself markdown.

> Use this skill together with `create-system-tool` / `create-custom-agent` whenever the tool's returned string will be shown to the user as formatted text. Do **not** use it for tools that ask the LLM to respond with strict JSON and no markdown (e.g. a tool whose instructions say "responda exclusivamente com um objeto JSON válido, sem formatação markdown") — there is nothing to constrain there.

---

## 🎯 Why this exists

The end-user renderer, `TextMarkdown` (`glyvio_app/lib/widgets/text/text_markdown.dart`), uses the `gpt_markdown` package, which has **no HTML support at all**. If the LLM is told only "responda em markdown" with no further constraint, it is free to invent `<div>`, `<b>`, nested HTML, footnotes, or other syntax `gpt_markdown` doesn't recognize — none of that errors, it just prints as literal text on screen, silently breaking the UI. The fix is to always give the LLM a closed, enumerated list of what it may use.

---

## 📐 The Allowed Tag Map

This is the complete set `TextMarkdown` renders. Anything outside it is NOT safe to let the LLM produce:

| Category | Syntax | Effect |
|---|---|---|
| Standard (gpt_markdown) | `# `, `## `, `### ` | Headings |
| | `**text**` | Bold |
| | `*text*` / `_text_` | Italic |
| | `~~text~~` | Strikethrough |
| | `` `code` `` | Inline code |
| | ` ```lang ... ``` ` | Code block |
| | `[text](url)` | Link |
| | `![alt](url)` | Image |
| | `- ` / `1. ` | Lists |
| | `> ` | Blockquote |
| | `\| col \| col \|` | Table |
| | `---` | Horizontal rule |
| | `$...$` / `$$...$$` | LaTeX |
| Custom — color | `<COR>text</>` | Colors the run. `COR` ∈ `RED, ORANGE, YELLOW, GREEN, BLUE, VIOLET, GREY` (also `PURPLE`, accepted by the renderer but not offered in the editor toolbar). Closing tag is always the literal `</>` — never `</COR>`. |
| Custom — attachment | `<attachment id="<id>">` | Renders an attachment box. **Never ask the LLM to produce this** — it requires a real attachment id from an upload flow, not something an LLM can invent. |
| Custom — user tag | `@user:<id>` | Renders `@Name` in blue. **Never ask the LLM to produce this** — it requires a real user id; if the LLM needs to reference a person, have it use the plain name instead. |

Only the **standard markdown** row and the **color tag** row are safe to offer an LLM writing free-form text. The attachment and user-tag rows exist for editor-authored content, not generated text — do not include them in an LLM-facing instruction.

---

## 📥 Required Input

1. **The prompt/report string** being built (usually inside a `@SystemTool`'s `handle()`, right before or inside the `Instructions for the LLM: ...` sentence).
2. **The plugin's environment tools directory** — check whether it's `plugin/environment/src/tools/` or `plugin/environment/src/system_tools/` (both exist across Glyvio plugins; use whichever this plugin already has).

---

## 🚫 Rules

1. **One shared constant per plugin.** Plugins are independent codebases/builds — don't try to import across plugin repos. Each plugin that generates LLM-facing markdown gets its own local `markdown_instructions.ts` with the constant below, reused by every tool in that plugin.
2. **Never let a tool describe the allowlist in its own words.** Free-hand descriptions drift (some tools list all 7 colors, some forget the `</>` closing rule, some allow HTML implicitly by omission). Always import and interpolate the shared constant instead of writing new prose.
3. **Don't add attachment or user tags to this instruction.** Those are structural tags with real ids behind them — an LLM asked to "use" them will hallucinate ids that don't exist.
4. **If a new custom tag is needed**, it must be added as a `gpt_markdown` inline component in `glyvio_app/lib/widgets/text/text_markdown.dart` first, then reflected in the constant below — never invent a tag on the prompt side that the renderer doesn't know about.

---

## 📄 Code Blueprint

### Step 1 — Create (or reuse) `plugin/environment/src/tools/markdown_instructions.ts`

```typescript
/**
 * Instrução compartilhada para prompts de LLM que geram texto exibido no glyvio_app via
 * `TextMarkdown` (`glyvio_app/lib/widgets/text/text_markdown.dart`), renderizado pelo pacote
 * `gpt_markdown` - que não tem suporte a HTML. Qualquer tag fora desta lista vira texto cru
 * na tela em vez de ser renderizada.
 *
 * Mantenha esta lista sincronizada com `text_markdown.dart` caso novas tags customizadas
 * (attachment, user tag, cor) sejam adicionadas ou removidas por lá.
 */
export const MARKDOWN_ALLOWLIST_INSTRUCTION =
  'Formate o texto usando apenas: títulos (# , ##), **negrito**, *itálico*, listas (- , 1. ), tabelas (| col |), ' +
  'links [texto](url) e a tag <COR>texto</> para destacar palavras-chave (COR é uma de: RED, ORANGE, YELLOW, GREEN, ' +
  'BLUE, VIOLET, GREY - a tag de fechamento é sempre "</>", sem repetir o nome da cor). Não use nenhuma tag HTML ' +
  '(como <b>, <div>, <span>) nem qualquer outra sintaxe markdown além das listadas acima - elas não são renderizadas ' +
  'e aparecerão como texto cru para o usuário.';
```

If the plugin already has a file like this (check before creating a duplicate), reuse it instead.

### Step 2 — Wire it into the tool's prompt

```typescript
import { MARKDOWN_ALLOWLIST_INSTRUCTION } from './markdown_instructions';

// ...inside the string the tool builds for the LLM:
report += `\nInstructions for the LLM: Present this to the user in a natural tone. ${MARKDOWN_ALLOWLIST_INSTRUCTION}`;
```

Or, for a tool whose "Instructions for the LLM" block already describes markdown usage (e.g. "cada alerta deve ter uma description em markdown"), replace the free-hand color/format sentence with the interpolated constant rather than appending a second, possibly conflicting instruction.

### Step 3 — Build & Validate

Compile the environment subproject (`pnpm run build:fast` or `pnpm tsc --noEmit`) and confirm it resolves.

---

## ✅ Completion Checklist

- [ ] `markdown_instructions.ts` exists in this plugin's tools directory (created or reused).
- [ ] The tool's LLM-facing string interpolates `MARKDOWN_ALLOWLIST_INSTRUCTION` instead of hand-written formatting prose.
- [ ] No mention of `<attachment id="...">` or `@user:<id>` was added to any LLM-facing instruction.
- [ ] Build passes (`pnpm run build:fast` / `pnpm tsc --noEmit`).
