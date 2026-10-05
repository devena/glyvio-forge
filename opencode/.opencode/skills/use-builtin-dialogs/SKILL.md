---
name: use-builtin-dialogs
description: "Uses the ready-made Glyvio dialogs from any view without creating a modal: toasts, blocking dialogs, OK/Cancel confirmations, progress dialogs, the option picker (SimpleChoiceModal) and the single-value input modals (text, multiline, number, decimal, date, date-time, boolean, code, markdown, entity) — and receives their result back in events()."
---
<!-- Generated from src/skills/use-builtin-dialogs/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Use the Built-in Dialogs

Every view (page, modal, sidebar, cart, side panel) can open these without writing a modal class.
They all follow one pattern: **you open it, return `'STATE_FREEZED'` (for modals) or
`'STATE_UPDATE'`, and the result comes back later as a new action, with the key you chose, in
your own `events()`**.

> Contract: `.opencode/references/views_and_interceptors.md`.

---

## 1. Toasts and blocking dialogs (no result)

```typescript
await this.showToastSuccess(state, '$T{<plugin>_saved}');                 // also Warning / Info / Error
await this.showDialogWarning(state, '$T{<plugin>_title}', '$T{<plugin>_body}', '$T{<plugin>_ok}'); // user must dismiss
```

## 2. Confirmation (OK / Cancel → your keys)

```typescript
// in events(), e.g. when the user taps "Delete":
await this.showConfirmationWarning(
  state,
  '$T{<plugin>_deleteTitle}',
  '$T{<plugin>_deleteBody}',
  '<plugin>_deleteConfirmed',          // fired on OK
  { id: state.<entityCamel>?.id },     // data of the OK action
  undefined,                           // key fired on Cancel (optional)
  undefined,
  '$T{<plugin>_delete}',               // custom OK label (optional)
);
return 'STATE_UPDATE';

// later, in events():
if (action.key == '<plugin>_deleteConfirmed') {
  // action.data.id
  return 'STATE_UPDATE';
}
```

Variants: `showConfirmationSuccess / Info / Error` (same parameters).

## 3. Progress dialog (long loops)

```typescript
for (let i = 0; i < items.length; i++) {
  await this.showProgress(state, { title: '$T{<plugin>_importing}', subtitle: `${i + 1}/${items.length}`, progress: (i + 1) / items.length });
  // ... work
}
await this.hideProgress(state);
```

Always call `hideProgress` in a `finally` when the loop can throw.

## 4. Option picker — `SimpleChoiceModal`

```typescript
await this.pushModal(
  new glyvio_core.SimpleChoiceModalRoute({
    title: '$T{<plugin>_chooseType}',
    options: [
      { key: 'A', label: '$T{<plugin>_typeA}' },
      { key: 'B', label: '$T{<plugin>_typeB}' },
    ],
    popActionKey: '<plugin>_typeChosen',  // key you receive back
    extras: { rowId: '123' },            // echoed back untouched
  }),
);
return 'STATE_FREEZED';

// later: action.key == '<plugin>_typeChosen' → action.data.key ('A' | 'B'), action.data.extras
```

Options are shown sorted by label.

## 5. Single-value input modals

| Route | `initialValue` type | Extra params |
| --- | --- | --- |
| `glyvio_core.StringTextfieldModalRoute` | `string` | `minLines`, `maxLines` (multiline) |
| `glyvio_core.IntegerTextfieldModalRoute` | `number` | |
| `glyvio_core.DecimalTextfieldModalRoute` | `Decimal` | `formatter` |
| `glyvio_core.DateTextfieldModalRoute` / `DateTimeTextfieldModalRoute` | `DateTime` | `formatter` |
| `glyvio_core.BooleanTextfieldModalRoute` | `boolean` | |
| `glyvio_core.CodeTextfieldModalRoute` | `string` | `language` |
| `glyvio_core.MarkdownTextfieldModalRoute` | `string` | |
| `glyvio_core.EntityTextfieldModalRoute` | entity / entities | `isMultiple`, `pathEntityModal`, `nameSpace`, `nameObject` (the entity modal used to search) |

Common params: `label`, `key` (**the action key you receive back** — note: `key`, not
`popActionKey`), `initialValue`, `extras`.

```typescript
await this.pushModal(
  new glyvio_core.StringTextfieldModalRoute({
    label: '$T{<plugin>_renameLabel}',
    key: '<plugin>_renamed',
    initialValue: state.<entityCamel>?.<field1> ?? '',
    extras: { id: state.<entityCamel>?.id },
  }),
);
return 'STATE_FREEZED';

// later: action.key == '<plugin>_renamed' → action.data.value, action.data.extras
```

Cancel closes the modal without sending anything.

---

## 🚫 Rules

1. Result keys are your own and never start with `_`; namespace them (`'<plugin>_...'`).
2. After `pushModal` return `'STATE_FREEZED'`; after a toast/confirmation return `'STATE_UPDATE'` (or whatever the handler needs).
3. Use `extras` to carry context (row id, mode) instead of keeping it in the state.
4. Dialog texts are `$T{}` keys in every `.arb`.
5. Need more than one field, validation or a custom layout? Write a real modal (`create-edit-modal`, `create-wizard-modal`).

---

## ✅ Completion Checklist

- [ ] Every opened dialog has a handler for its result key in `events()`.
- [ ] Correct return value after opening (`STATE_FREEZED` for modals).
- [ ] `hideProgress` guaranteed; texts in every `.arb`; flow checked with `test-plugin-browser`.
