---
name: create-whats-new
description: "Writes the end-user novelties of a plugin release ('o que há de novo'): picks from the CHANGELOG what the users actually perceive, rewrites it in friendly language (title + one or two sentences, icon, a 'Mostrar como' button to the screen), shows it for approval and registers it with glyvio_core.whatsNewRegistryService.add, with the texts in every .arb. Glyvio shows it once to each user on login (cards, one at a time) and keeps it in Meu perfil › Novidades. Use only when the developer asks ('gera as novidades desta versão para os usuários') — never on every release."
---
<!-- Generated from src/skills/create-whats-new/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create the Novelties of a Release

Two audiences read about a release:

| Who | What | Where it comes from |
| --- | --- | --- |
| Developers | `CHANGELOG.md` | skill `release-project` |
| The company's administrator | `assets/release-notes/<lang>.md` — technical but open | skill `release-project` (Step 6.2), shown in the plugin manager |
| **The end user** | **a few friendly cards: what they can do now** | **this skill**, only when the developer asks |

Glyvio shows the cards **once per user, on login**, one at a time ("1 / 3", "Mostrar como", "Próxima"), after the
welcome wizard (a new user does not get "novelties"). Releases older than 60 days are not shown on login; all of them
stay in **Meu perfil › Novidades**.

---

## 📥 Required Input Parameters

1. **Which versions** the novelties cover. Default: the CHANGELOG entries after the last release already registered
   in `plugin/app/src/whats_new.ts` (its keys are `<plugin>.<version>`); ask if there is none.
2. The **plugin's short name** for the tag on the cards ("CRM", "Agenda").
3. For each novelty that has a screen: **the route** that shows it, and the **permission** needed to open it.

---

## 🧭 Process

1. Read the CHANGELOG entries of those versions (and the diff, if needed to understand a change).
2. **Pick what the end user perceives**: a new screen, button, field, shortcut, a rule that now saves them work, a
   problem they felt that is gone. Leave out refactors, internal fixes, performance nobody notices, database and
   permission details (those belong to the administrator's notes).
3. Write **1 to 4 items** (more than 4 is a changelog, not novelties). Each item:
   - **title** — the benefit, starting with a verb or the thing, ≤ 60 characters: "Trabalhe com seus clientes sem internet";
   - **text** — one or two sentences, ≤ 200 characters, talking to the user ("você"), saying where it is:
     "No celular, escolha o perfil Vendedor e o Glyvio baixa seus clientes, pedidos e tarefas.";
   - **icon** (`sax_*` / `fa_*` / `ma_*`, checked with `node codex/scripts/check_icons.mjs .`) and **color**;
   - **action** — the route of the screen, when there is one ("Mostrar como" opens it);
   - **permission** — when not everyone can open that screen (they would not see a novelty they cannot use).
4. **Show the items to the developer and wait for approval** — titles and texts as the user will read them, in
   Portuguese. Adjust until approved.
5. Write them (blueprint below): the registration in `plugin/app/src/whats_new.ts`, called from the plugin's
   `index.ts`, and the texts in **every** `.arb` of the plugin, translated.
6. Build, and check in `test-plugin-browser`: Meu perfil › Novidades shows the cards; "Mostrar como" opens the screen.

---

## 🚫 Rules

1. Requires a `glyvio_core` with `whatsNewRegistryService` — check `plugin/app/@types/glyvio_core.d.ts`; if it is not
   there, stop and say so.
2. **Release key** `<plugin>.<version>` (e.g. `crm.0.3.133`), stable: the users' "seen" list keeps it. Never reuse or
   rename a published key — everyone would see it again.
3. **date** = the release date (`YYYY-MM-DD`). Keep the older releases in the file: they make the history in Meu perfil.
4. Plain language: no "bug", "refactor", "endpoint", "sync", "manifest", class or entity names. A fix becomes what the
   user feels ("Os e-mails agora chegam vinculados ao cliente certo").
5. Texts are `$T{}` keys, `<plugin>_whatsNew_<version with _>_<item>_title` / `_text`, in every `.arb`.
6. Pictures: `imageUrl` takes a full public URL only. Without one the card shows the icon on the item's color — that
   is the default; do not invent URLs.
7. One release per call. Never register novelties without the developer asking for them.

---

## 📄 Code Blueprint

`plugin/app/src/whats_new.ts`:

```typescript
import { <Entity>ListPageRoute } from './views/<entity>/<entity>_list_page';

/** End-user novelties of each release (skill create-whats-new). Newest first; keep the old ones. */
export function registerWhatsNew(): void {
  glyvio_core.whatsNewRegistryService.add({
    key: '<plugin>.0.3.133',
    pluginLabel: '<Plugin>',
    date: '2026-11-19',
    items: [
      {
        key: 'offline',
        title: '$T{<plugin>_whatsNew_0_3_133_offline_title}',
        text: '$T{<plugin>_whatsNew_0_3_133_offline_text}',
        icon: 'sax_linear_wifi_square',
        colorTheme: 'PURPLE',
        // A route of the plugin (or a core route from @types): the screen where the novelty is.
        action: { route: new <Entity>ListPageRoute() },
      },
      {
        key: 'links',
        title: '$T{<plugin>_whatsNew_0_3_133_links_title}',
        text: '$T{<plugin>_whatsNew_0_3_133_links_text}',
        icon: 'sax_linear_link',
        colorTheme: 'BLUE',
        permission: glyvio_permissions.<permission_key>,
      },
    ],
  });
}
```

`plugin/app/src/index.ts` (once, at load time, after the routes):

```typescript
import { registerWhatsNew } from './whats_new';

registerWhatsNew();
```

`.arb` (each language):

```json
"<plugin>_whatsNew_0_3_133_offline_title": "Trabalhe com seus clientes sem internet",
"<plugin>_whatsNew_0_3_133_offline_text": "No celular, escolha o perfil Vendedor e o Glyvio baixa seus clientes, pedidos e tarefas. Tudo sobe quando o sinal voltar."
```

---

## ✅ Completion Checklist

- [ ] `whatsNewRegistryService` exists in the plugin's `@types/glyvio_core.d.ts`.
- [ ] 1–4 items, picked for what the end user perceives, **approved by the developer**.
- [ ] Release key `<plugin>.<version>`, date of the release; older releases kept.
- [ ] Routes and permissions on the items that open a screen; icons checked; texts in every `.arb`.
- [ ] Seen in `test-plugin-browser` (Meu perfil › Novidades), "Mostrar como" opens the screen.
