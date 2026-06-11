---
name: create-screen-from-image
description: 'Reproduces a UI screenshot (print) as faithfully as possible using Glyvio framework components. Performs structured visual decomposition of the image, maps each visual element to a concrete design class via the component catalog, produces an approved visual spec, then delegates to the matching create-* page/modal skills.'
---

# Agent Skill: Create Screen From Image (print → Glyvio screen)

This skill turns a **screenshot provided by the user** into a Glyvio screen that is as visually
faithful as possible, using **only** components exposed in `@types` (`glyvio_core.*`). It does not
guess from a feature description — it reads the actual image and reconstructs its structure.

It is **vision-driven**: the agent must actually look at the image (via the Read tool on the image
path) and reason about layout, components, colors, spacing, and text.

---

## 📥 Required Input Parameters

Before running, the agent MUST have:

1. **Image path** — an absolute or project-relative path to the screenshot file (PNG/JPG). If the
   user pasted/described the screen but gave no file, **stop and ask for the image file** — this
   skill requires the actual pixels.
2. **Target entity** (e.g. `Product`, `Sale`) — the `glyvio_entity.*` model the screen is built on.
   If unclear from the image, ask.
3. **Plugin namespace**, **route path**, and **menu group** — as required by the underlying
   `create-*` page skill (collect per that skill's metadata; ask if missing).

If any required parameter is missing, **stop and ask** — never guess.

---

## 📚 Required Reading (do this first)

1. **`docs/claude/component_catalog.md`** — the visual catalog. This is the ground truth for
   mapping "what it looks like" → "which `glyvio_core` class". Keep it open the whole time.
2. **`@types` / `dist/bundle.d.ts`** — confirm every class you intend to use is actually exported.
   Never instantiate a class that is not in `@types`.
3. The matching page skill(s) under `docs/claude/skills/create-*-page/` for the final code blueprint.

---

## 🧭 Execution Workflow

### Phase 1 — Read the image

- Open the image with the Read tool so the pixels are actually analyzed.
- Note global facts: overall layout (single column? sidebar + content? grid?), dominant colors,
  density, and whether it is a **page**, a **modal**, or a **sidebar**.

### Phase 2 — Visual decomposition (top-down)

Decompose the screen into a tree, from outside in. For **every** node record:
`role`, approximate **bounding box / region**, dominant **color**, **spacing/padding** impression,
any **text** you can read, and whether it is a **repeated unit** (list/grid item).

Decomposition order:

1. **Page type** — match the dominant pattern against catalog §1 (list / table / grid / kanban /
   calendar / batch / dashboard / map / timeline / chat). This picks the base page + `create-*` skill.
2. **App bar** — title text, action buttons/icons on the right (catalog §2, §9, §10).
3. **Layout regions** — sidebar filters, main content, footer; map containers to layouts (catalog §3).
4. **Repeated unit** (the cell/card) — for list/grid/table, isolate **one** item and decompose it
   fully into atomic widgets (catalog §6 for the cell shell, §5/§7/§9/§10 for the contents).
5. **Atomic widgets** — texts, chips, dots, avatars, icons, totalizers, images (catalog §5, §7).
6. **Form/filter fields** — map by data type to textfields (catalog §8), honoring the FK rule.

### Phase 3 — Produce the visual spec (gate — must be approved)

Write the decomposition to `.claude/temp<ScreenName>_visual_spec.json` as a component tree. Each node:

```jsonc
{
  "role": "app_bar | layout | section | cell | text | chip | textfield | ...",
  "component": "glyvio_core.SimpleAppBarDesign", // chosen class from the catalog
  "rationale": "why this class matches the pixels",
  "props": { "title": "Pedidos", "colorTheme": "BLUE", "padding": "16" },
  "observedText": "Pedidos",
  "region": "top, full width",
  "children": [
    /* ... */
  ],
}
```

Rules for the spec:

- **Every `component` value must exist in `@types`** — verify before writing it.
- Prefer the **most specific** component (catalog tip #3): `ChipDesign` over a colored `BoxDesign`,
  `HorizontalTotalizerBoxDesign` over a hand-built `RowLayout` + texts, etc.
- For **entity/FK fields** (`ENTITY`, `_id`, `_ic`): the component MUST be the **entity-specific
  subclass** of `EntityAutocompleteSingleTextfieldDesign` — never the base, never `StringTextfieldDesign`.
- Map colors to `colorTheme`, text sizes to `style` (Material scale), spacing to `padding`,
  alignment to `mainAlignment`/`crossAlignment`.

Then write a short human summary to `.claude/temp<ScreenName>_visual_analysis.md`:

- chosen page type + skill,
- the per-element mapping table (visual element → component → rationale),
- anything in the print that has **no faithful component** (flag it explicitly; do not fake it).

**STOP and present the analysis to the user for confirmation before writing any code.** The spec is
the contract; code is generated from it, not from re-interpreting the image.

### Phase 4 — Generate code via the matching skill

- Run the appropriate `create-*` skill (e.g. `create-grid-page`) using the entity/namespace/route
  params, then **fill its `getDesign` / `getDesignForCell` / filter sections from the approved spec**,
  node by node. Do not deviate from the spec without telling the user.
- Apply all coordinator rules: `@types`-only, zero `any`, no external libs, snake*case files /
  PascalCase classes, FK subclass rule, route + menu registration, and the mandatory `view`
  permission in `manifest.json` (`{ "type": "view", "subtype": "<entity>", "key": "<entity>*<view type>" }`).

### Phase 5 — Fidelity check & cleanup

- Build clean: `pnpm pretty && pnpm lint && pnpm build`.
- **Compare against the print**: if the app can be rendered, capture a screenshot and diff it
  side-by-side with the original. List discrepancies (missing elements, wrong order, spacing, color,
  text) and iterate on `getDesign`/cells until close. (Use the project `run` / `verify` skills.)
- Remove the temp `*_visual_spec.json` / `*_visual_analysis.md` once the screen is accepted, unless
  the user wants them kept.

---

## 🚫 Rules

1. **Vision required**: actually read the image; never fabricate structure from a text description alone.
2. **Catalog-driven**: every component choice traces to a row in `component_catalog.md` and exists in `@types`.
3. **Most-specific component wins**; never hand-roll what a dedicated design already does.
4. **FK/entity fields** use the entity-specific `EntityAutocompleteSingleTextfieldDesign` subclass.
5. **No `any`, no external libs, no non-`@types` components.**
6. **Spec before code**: Phase 3 must be approved before Phase 4.
7. **Flag the un-mappable**: if part of the print has no faithful component, say so — do not invent one.
