---
name: create-timeline-entry
description: 'Generates code that records a Timeline entry (activity feed / audit event, e.g. "Sale created", "Status changed from X to Y") via crm.GenerateTimelineStrategy.pushToQueue, normally embedded inside an existing AfterInterceptor.'
---

# Agent Skill: Create Timeline Entry in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to record a Timeline entry — a human-readable activity/audit event, optionally linked to one or more entities so it surfaces in each of their activity feeds — via the `crm` plugin's `GenerateTimelineStrategy`.

This is **not** a standalone file-creation skill like `create-after-interceptor`. A timeline entry is a side-effect you add *inside* a hook you are already writing (usually an `@AfterInterceptor`, sometimes a `Strategy` or queued interceptor). Use [[create-after-interceptor]] first to scaffold the hook itself if one doesn't already exist for this entity/event.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_timeline_entry",
  "description": "Generates code that records a Timeline entry via crm.GenerateTimelineStrategy.pushToQueue, linked to the triggering entity and any related entities.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase that depends on the crm plugin.",
  "parameters": {
    "type": "object",
    "properties": {
      "targetEntityName": {
        "type": "string",
        "description": "The entity whose lifecycle/field change triggers the timeline entry (e.g., Sale, Client, Task)."
      },
      "timelineTypeId": {
        "type": "string",
        "description": "The id of an EXISTING crm.TimelineType record classifying this entry (e.g., sale_new, sale_change_status). Not a free label — see constraint below."
      },
      "contentTemplate": {
        "type": "string",
        "description": "Human-readable template describing the event, interpolating live field values (e.g., 'O Pedido {code} foi incluído na base')."
      },
      "linkedEntities": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Additional related entities (besides the target entity itself) to link, so the entry also shows in their timelines (e.g., ['client', 'salesPerson'])."
      }
    },
    "required": ["targetEntityName", "timelineTypeId", "contentTemplate"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target Entity** (e.g., `Sale`): the entity being created/updated/deleted that triggers the entry.
2. **Timeline Type ID** (e.g., `sale_new`, `sale_change_status`): identifies the category/icon/color of the entry. See constraint #2 below — this must already exist.
3. **Content Template**: the exact message to display, and which live field values it interpolates (e.g. code, previous/current status name).
4. **Entities to Link** beyond the main entity (e.g. the sale's `client`, `salesPerson`): each additional entity makes this entry also appear in that entity's own timeline.
5. **Trigger Condition**: creation-only, a specific field change, deletion, or restoration — determines which guard clause to use in the surrounding interceptor (see [[create-after-interceptor]]).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **No Import — Global Namespace**: `crm` is injected globally at runtime. Never `import` it. Use `crm.GenerateTimelineStrategy.pushToQueue(...)` directly.
2. **`crm` Must Be a Declared Dependency**: Confirm `manifest.json`'s root `"dependencies"` array contains `{"pluginName": "crm", "version": "latest"}` (check `plugin/server/@types/crm.d.ts` also exists as a sanity check). If missing, this will fail to compile/run — add the dependency first (see [[modify-manifest]]).
3. **`timelineTypeId` Is a Real Foreign Key, Not a Free String**: `crm.TimelineType` is a real `Model` (`glyvio_entity.TimelineType`, has `findById`/`findByIntegrationCode`). `GenerateTimelineStrategy` *resolves* this id — it does not create a `TimelineType` row on the fly. Before inventing a new id:
   - `grep -rn "timelineTypeId" plugin/server/src` to see if this entity/event combination already has an established id elsewhere in the codebase (the empirical convention across existing Glyvio plugins is `<entity>_<action>`, e.g. `sale_new`, `sale_change_status`, `sale_deleted`, `sale_restored`, `task_new`, `client_deleted` — but naming is **not** perfectly consistent, e.g. `cliente_change_status` vs `client_created` appear in the same codebase, so match exactly what you find rather than assuming a clean pattern).
   - If no matching id exists yet, do not guess — verify a `TimelineType` row with that id actually exists (query it, or ask the user/check the `crm` plugin's own seed data) before wiring the call, since an unresolvable `timelineTypeId` will fail silently or throw depending on the `DefaultGenerateTimelineStrategy` implementation.
4. **Related Entities Are NOT Pre-Loaded Inside Interceptors**: Even though a relation getter like `value.client` is typed as returning the full joined `Client` object, **only the main entity is loaded** in `handleAfter`/`handleBefore` — relation getters are not populated. Always fetch related entities explicitly:
   ```typescript
   const client = glyvio_entity.Client.findById(value.clientId);
   ```
   Never read `value.<relationGetter>` directly and assume it's non-null just because the type says so.
5. **Use `.getStructureName()` on Each Instance for `entityName`**: For both the main entity and every linked entity, call `.getStructureName()` on the actual fetched instance rather than hardcoding the structure name as a string literal — it stays correct if the underlying structure name changes.
6. **`userId` Requires an Active Session**: `glyvio_core.sessionService.getCurrentSession().user.id!` throws if there is no authenticated session in the current execution context. This is safe inside interceptors triggered by normal user-facing saves. If the same interceptor can also fire from a session-less context (e.g. a `SyncInterceptor`-driven batch import, a scheduled job), guard this call or resolve a fallback system user id instead of asserting non-null blindly.
7. **Guard the Trigger Condition Precisely**: Reuse the same guard idioms as `create-after-interceptor`:
   - Creation only: `if (context.savedValue || value.deleted) return;`
   - Field change only: `if (!context.savedValue || !value.isModified(glyvio_structure.AllEntities.<entity>.<field>)) return;`
   - Deletion: check `value.deleted && !context.savedValue?.deleted` (or the entity's existing soft-delete convention).
8. **Don't Wrap in Try-Catch**: Same as `create-after-interceptor` — let errors bubble up unless the user explicitly asks for suppression.

---

## 📋 Execution Steps

### Step 1: Locate or Create the Surrounding Hook

Confirm an `@AfterInterceptor` (or equivalent) already exists for `<TargetEntityName>` reacting to the trigger condition described. If not, run [[create-after-interceptor]] first.

### Step 2: Resolve Related Entities Explicitly

```typescript
const client = glyvio_entity.Client.findById(value.clientId);
const salesPerson = glyvio_entity.AppUser.findById(value.salesPersonId);
```

### Step 3: Push the Timeline Entry

Insert the `pushToQueue` call inside `handleAfter`, after the trigger-condition guard.

### Step 4: Build & Validate

Compile the server workspace (`pnpm run build` / project's webpack build) to confirm types resolve. See the false-positive note in [[create-after-interceptor]] about root `tsc --noEmit` mistyping server methods as `Promise<T>`.

---

## 📄 Code Blueprint (Template)

```typescript
// Inside handleAfter, after the trigger-condition guard:

// 💡 Resolve related entities explicitly — never trust value.<relation> to be populated.
const linkedA = glyvio_entity.<LinkedEntityA>.findById(value.<linkedEntityAId>);
const linkedB = glyvio_entity.<LinkedEntityB>.findById(value.<linkedEntityBId>);

crm.GenerateTimelineStrategy.pushToQueue({
  timelineTypeId: '<existing_timeline_type_id>',
  userId: glyvio_core.sessionService.getCurrentSession().user.id!,
  content: `<Human-readable message interpolating value.<field>, linkedA?.name, linkedB?.name>`,
  entitiesToLink: [
    {
      entityId: value.id!,
      entityName: value.getStructureName(),
    },
    ...(linkedA
      ? [
          {
            entityId: linkedA.id!,
            entityName: linkedA.getStructureName(),
          },
        ]
      : []),
    ...(linkedB
      ? [
          {
            entityId: linkedB.id!,
            entityName: linkedB.getStructureName(),
          },
        ]
      : []),
  ],
});
```

---

## ✅ Completion Checklist

- [ ] `crm` confirmed present in `manifest.json` dependencies.
- [ ] `timelineTypeId` verified against existing usages (`grep -rn "timelineTypeId" plugin/server/src`) or confirmed to exist as a real `TimelineType` row — not invented blindly.
- [ ] All linked entities (including the main one) fetched via `.findById(...)` — none read directly off `value.<relation>`.
- [ ] `entityName` values come from `.getStructureName()` on the fetched instance, not hardcoded strings.
- [ ] `userId` resolution accounts for whether this hook can fire outside an authenticated session.
- [ ] Trigger-condition guard matches the intended lifecycle event (create/update-field/delete) precisely.
- [ ] No try-catch unless explicitly requested.
- [ ] Build passes.
