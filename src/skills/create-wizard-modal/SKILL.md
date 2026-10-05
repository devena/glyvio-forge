---
name: create-wizard-modal
description: "Generates a step-by-step wizard modal (SimpleWizardModal) for any guided flow — onboarding, guided creation of a record and its children, configuration assistants — with a stepper, per-step sections, validation before advancing, back navigation, custom button labels and a finish action. For spreadsheet imports use create-import-wizard."
---
# Agent Skill: Create a Wizard Modal

`glyvio_core.SimpleWizardModal<S>` is a modal with a stepper on top, the current step's sections in
the body and *Cancelar/Voltar · Avançar/Concluir* in the footer. The base keeps the current step in
`state.wizardStep`, validates before moving forward (never backward), lets the user go back by
tapping a done step and keeps everything typed in the state across steps.

| You implement | Role |
| --- | --- |
| `getSteps(state): glyvio_core.WizardStep[]` | `{ key, title, subtitle?, status?: 'ERROR' }` — may depend on the state (optional steps) |
| `getStepSections(state, step): SectionDesign[]` | the body of each step |
| `finish(state): Promise<EventReturn>` | the last button (save) — usually `popModal` + `'STATE_FREEZED'` |
| `validateStep(state, step)` (optional) | throw `glyvio_core.GlyvioError` to stay on the step (or use `validateForm`) |
| `onEnterStep(state, step, previous)` (optional) | load what a step shows (preview, totals) |
| `getWizardDesign(state, design: SimpleEditModalDesign)` (optional) | app bar, `maxWidth`, extra footer buttons |
| `getLabels(state, step): WizardLabels` (optional) | `{ cancel?, back?, next?, finish? }` per step |
| `events(state, action)` | only **your own** keys (buttons inside sections) |

Helpers: `this.currentStep(state)`, `this.isLastStep(state, step?)`, `await this.goToStep(state, key)`.

> For a spreadsheet import (file → mapping → review → import) use `create-import-wizard`, which is
> built on this class. Contract: `@@REFERENCES@@/views_and_interceptors.md`.

---

## 📥 Required Input Parameters

1. **Steps**: key, title, what each one asks, which fields are required, conditional steps.
2. **Finish**: what is saved (entities, relations) and where the user goes afterwards (`popActionKey` to the opener?).
3. **Plugin namespace**, **route path**, **permission**, and who opens it (button, quick action).

---

## 🚫 Rules

1. Globals only; no `any`.
2. **Do not override `getDesign`** — the base assembles the stepper and footer. Use `getWizardDesign`.
3. The first step is prepared in `initState` (it has no `onEnterStep`).
4. Validation: put `required: true` on fields and call `validateForm` inside `validateStep` for the
   current step (`if (!(await this.validateForm(state))) throw new glyvio_core.GlyvioError({ message: '...' })`), or throw your own `GlyvioError`.
5. `finish` saves everything in **one** `entityService.saveList([...])` call, with `userGroupId` on
   every new entity (architecture rule 1.5), then `popModal(...)` and returns `'STATE_FREEZED'`.
6. Never reuse the wizard's internal keys; your buttons use your own keys (not starting with `_`).
7. Texts as `$T{}` keys in every `.arb`.

---

## 📋 Execution Steps

1. Create `src/views/modals/<feature>_wizard_modal.ts` (blueprint).
2. Export it; `routerService.loadRoutes([<Feature>WizardModalRoute])`.
3. Open it: `await this.pushModal(new <Feature>WizardModalRoute({ popActionKey: '<feature>Created' }))` and handle that key in the opener's `events()`.
4. `pnpm build`; walk through all steps (including validation errors and Back) with `test-plugin-browser`.

---

## 📄 Code Blueprint

```typescript
export interface <Feature>WizardModalRouteParams extends glyvio_core.SimpleEditModalRouteParams {}

export interface <Feature>WizardModalState extends glyvio_core.SimpleWizardModalState<<Feature>WizardModalRouteParams> {
  <entityCamel>?: glyvio_entity.<EntityName>;
  confirm?: boolean;
}

export class <Feature>WizardModalRoute extends glyvio_core.SimpleEditModalRoute<<Feature>WizardModalRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<route-path>';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Feature>WizardModal';
  }
}

export class <Feature>WizardModal extends glyvio_core.SimpleWizardModal<<Feature>WizardModalState> {
  constructor() {
    super(<Feature>WizardModalRoute);
  }

  async initState(state: <Feature>WizardModalState): Promise<void> {
    await super.initState(state);
    state.<entityCamel> = await glyvio_entity.<EntityName>.new();
    state.<entityCamel>.userGroupId = this.getDefaultUserGroupId();
  }

  getSteps(state: <Feature>WizardModalState): glyvio_core.WizardStep[] {
    return [
      { key: 'data', title: '$T{<plugin>_<feature>_stepData}' },
      { key: 'review', title: '$T{<plugin>_<feature>_stepReview}' },
    ];
  }

  getStepSections(state: <Feature>WizardModalState, step: string): glyvio_core.SectionDesign[] {
    if (step == 'data') {
      return [
        new glyvio_core.FormSectionDesign({
          key: 'data.section',
          childDesign: new glyvio_core.FormLayoutDesign({
            columnSize: 280,
            children: [
              new glyvio_core.FormLayoutFieldDesign({
                key: '<field1>.formField',
                columns: 1,
                child: new glyvio_core.StringTextfieldDesign({
                  name: 'state.<entityCamel>.<field1>',
                  label: '$T{<plugin>_<feature>_<field1>}',
                  required: true,
                }),
              }),
            ],
          }),
        }),
      ];
    }
    return [
      new glyvio_core.FormSectionDesign({
        key: 'review.section',
        childDesign: new glyvio_core.ColumnLayoutDesign({
          padding: '16',
          children: [new glyvio_core.StringTextDesign({ value: '$S{state.<entityCamel>.<field1>}', style: 'TITLE_MEDIUM' })],
        }),
      }),
    ];
  }

  async validateStep(state: <Feature>WizardModalState, step: string): Promise<void> {
    if (step == 'data' && !(await this.validateForm(state))) {
      throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_<feature>_fixErrors}' });
    }
  }

  getLabels(_state: <Feature>WizardModalState, step: string): glyvio_core.WizardLabels {
    return step == 'review' ? { finish: '$T{<plugin>_<feature>_create}' } : {};
  }

  getWizardDesign(_state: <Feature>WizardModalState, design: glyvio_core.SimpleEditModalDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({ key: 'appBar', title: '$T{<plugin>_<feature>_title}' });
    design.maxWidth = 720;
  }

  async finish(state: <Feature>WizardModalState): Promise<glyvio_core.EventReturn> {
    const entity = state.<entityCamel>!;
    if (!entity.userGroupId) {
      throw new glyvio_core.GlyvioError({ message: '$T{<plugin>_userGroupRequired}' });
    }
    await glyvio_core.entityService.saveList([entity]);
    await this.popModal(
      state.routeParams?.popActionKey
        ? new glyvio_core.Action({ key: state.routeParams.popActionKey, data: { id: entity.id } })
        : undefined,
    );
    return 'STATE_FREEZED';
  }

  async events(_state: <Feature>WizardModalState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }
}
```

---

## ✅ Completion Checklist

- [ ] `getDesign` not overridden; app bar/size in `getWizardDesign`.
- [ ] First step prepared in `initState`; later steps in `onEnterStep` when they need data.
- [ ] Validation blocks advancing; Back keeps the data.
- [ ] `finish` saves in one call with `userGroupId`, pops with `popActionKey`, returns `'STATE_FREEZED'`.
- [ ] Route registered and exported; texts in every `.arb`; `pnpm build` clean; flow checked with `test-plugin-browser`.
