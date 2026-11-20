---
name: register-welcome-step
description: "Adds a plugin step to the Glyvio welcome wizard (the user's first access to a company, also reopened from Meu perfil › Configuração inicial) with glyvio_core.welcomeRegistryService.addStep: the step's title, plugin tag, order, permission, 'already set up?' check, initial data, body, own buttons, validation and save. Use when a plugin needs the user to set something up once (e-mail signature, working hours, notification channels, default warehouse) and would otherwise ask for it on a settings screen nobody finds."
---
# Agent Skill: Register a Welcome Step

The welcome wizard opens by itself on a user's **first access to a company**: Perfil (photo, name, phone),
Aparência, Idioma, then **"Módulos" — the steps the plugins register** — and Pronto. It reopens later only to
show steps registered after the user finished it (a plugin installed afterwards), and the user can always reopen
it from **Meu perfil › Configuração inicial**.

A step is a small form: what the plugin needs from each user once. It saves where the plugin always saves (its
own entity, `configService`, a plugin preference); the wizard only remembers that the step was seen.

| Need | Use |
| --- | --- |
| Ask each user for something once, on first access | **this skill** |
| A settings screen reachable any time | `create-edit-page` + `register-menu-and-admin` (keep it: the step is a shortcut, not a replacement) |
| Per-user values without a screen | `use-user-preferences` |
| A guided flow the user starts on purpose (import, creation) | `create-wizard-modal` |

---

## 📥 Required Input Parameters

1. **What** the step asks and **where it is saved** today (entity + field, `configService` key, plugin preference).
2. **Key** (`'<plugin>.<thing>'`, stable), **title** and **subtitle** (`$T{}`), **plugin tag** (`'CRM'`), icon and color.
3. **Who** sees it: a permission, or everyone.
4. **How to tell it is already set up** (`isDone`): a user who configured it before never sees the step.
5. **Order** among the plugins' steps (`position`, lower first).

---

## 🚫 Rules

1. Register once, at load time, in the plugin `index.ts`. Requires a `glyvio_core` that has
   `welcomeRegistryService` — check it is in `plugin/app/@types/glyvio_core.d.ts`; if not, stop and say so.
2. **Every step is optional.** The wizard always offers "Pular este passo" and "Configurar depois"; never make
   the rest of the plugin depend on the step having been done.
3. **`isDone` decides whether the step appears.** Return `true` when the user already has the thing configured
   (anywhere). It must be one cheap query; a failure counts as "not done".
4. **Fields bind to `welcomeRegistryService.dataPath(key, field)`** — the step's data lives in
   `state.steps.<dataKey>`, so steps of different plugins never collide. Never bind to `state.<something>` of
   your own: the wizard's state is not yours.
5. `initData(data)` fills the step with what is saved today; `getSections(data, view)` builds the body;
   `save(data)` writes it back when the user presses Continuar; `validate(data)` throws a `GlyvioError` (with a
   `$T{}` message) to keep the user on the step.
6. Your own buttons and taps go through `onEvent(data, action, view)` — it receives every action key the wizard
   does not handle. Return `'STATE_UPDATE'` after changing `data`. `view` is the wizard: use its dialogs
   (`view.showToastSuccess`, `view.pushModal`) as in any screen.
7. **Keep it to one screen of fields**, no tables, no long lists. Something bigger is a settings page; the step
   then explains it in one line and offers a button that opens that page (`view.pushPage`).
8. **Keys are stable identities**: the wizard remembers seen steps by key. Renaming a published key shows the
   step again to everyone.
9. Texts are `$T{}` keys in every `.arb` of the plugin.
10. Keep the plugin's normal settings screen: the step is the first-access shortcut, not the only place.

---

## 📄 Code Blueprint (plugin `index.ts`)

```typescript
type SignatureStep = { signature?: string };

glyvio_core.welcomeRegistryService.addStep<SignatureStep>({
  key: '<plugin>.mailSignature',
  title: '$T{<plugin>_welcome_signatureTitle}',
  subtitle: '$T{<plugin>_welcome_signatureSubtitle}',
  pluginLabel: '<Plugin>',
  icon: 'sax_linear_sms',
  colorTheme: 'PURPLE',
  position: 100,
  permission: glyvio_permissions.<permission_key>, // optional: only users who can send e-mail

  // Already set up? Then the step does not appear.
  isDone: async () => {
    const saved = await glyvio_core.configService.loadConfig('<plugin>.mailSignature');
    return !!saved?.signature;
  },

  // What is saved today, when the wizard opens.
  initData: async (data) => {
    const saved = await glyvio_core.configService.loadConfig('<plugin>.mailSignature');
    data.signature = saved?.signature ?? '';
  },

  getSections: () => [
    new glyvio_core.FormSectionDesign({
      key: '<plugin>.welcome.signature.section',
      childDesign: new glyvio_core.HtmlTextfieldDesign({
        key: '<plugin>.welcome.signature.textfield',
        name: glyvio_core.welcomeRegistryService.dataPath('<plugin>.mailSignature', 'signature'),
        label: '$T{<plugin>_welcome_signatureLabel}',
      }),
    }),
  ],

  validate: async (data) => {
    if ((data.signature ?? '').length > 5000) {
      throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_welcome_signatureTooLong}' });
    }
  },

  save: async (data) => {
    await glyvio_core.configService.saveConfig('<plugin>.mailSignature', { signature: data.signature ?? '' });
  },
});
```

A step with its own button (rule 6) — e.g. "Usar meu horário padrão":

```typescript
type HoursStep = { start?: string; end?: string };

glyvio_core.welcomeRegistryService.addStep<HoursStep>({
  key: '<plugin>.workingHours',
  title: '$T{<plugin>_welcome_hoursTitle}',
  pluginLabel: '<Plugin>',
  icon: 'sax_linear_clock',
  isDone: async () => !!(await glyvio_core.configService.loadConfig('<plugin>.workingHours'))?.start,
  getSections: (data) => [
    new glyvio_core.FormSectionDesign({
      key: '<plugin>.welcome.hours.section',
      childDesign: new glyvio_core.ColumnLayoutDesign({
        key: '<plugin>.welcome.hours.layout',
        children: [
          new glyvio_core.ColumnLayoutFieldDesign({
            child: new glyvio_core.StringTextDesign({
              value: data.start ? `${data.start} – ${data.end}` : '$T{<plugin>_welcome_hoursNone}',
            }),
          }),
          new glyvio_core.ColumnLayoutFieldDesign({
            child: new glyvio_core.ActionButtonDesign({
              key: '<plugin>.welcome.hours.default.button',
              type: 'SECONDARY',
              title: '$T{<plugin>_welcome_hoursDefault}',
              action: new glyvio_core.Action({ key: '<plugin>.useDefaultHours' }),
            }),
          }),
        ],
      }),
    }),
  ],
  onEvent: async (data, action) => {
    if (action.key == '<plugin>.useDefaultHours') {
      data.start = '08:00';
      data.end = '18:00';
      return 'STATE_UPDATE';
    }
    return undefined;
  },
  save: async (data) => {
    await glyvio_core.configService.saveConfig('<plugin>.workingHours', { start: data.start, end: data.end });
  },
});
```

A custom home page (one that replaces the Glyvio home) must open the wizard itself, at the end of its
`initState`:

```typescript
async initState(state: MyHomePageState): Promise<void> {
  await super.initState(state);
  void glyvio_core.welcomeRegistryService.openIfPending(this);
}
```

---

## ✅ Completion Checklist

- [ ] `welcomeRegistryService` exists in the plugin's `@types/glyvio_core.d.ts`.
- [ ] Stable namespaced key; `isDone` is one cheap query and returns `true` for users already set up.
- [ ] Fields bind to `welcomeRegistryService.dataPath(key, field)`; `save` writes where the plugin always reads.
- [ ] Nothing in the plugin requires the step to have been done; the normal settings screen still exists.
- [ ] Texts in every `.arb`. Checked in `test-plugin-browser`: Meu perfil › Configuração inicial shows the step under "Módulos", Continuar saves it, "Pular este passo" leaves it, and a user who already has it set up does not see it.
