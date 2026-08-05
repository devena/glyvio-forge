---
name: external-user-api
description: Reference pattern for a Glyvio plugin that exposes an API consumed by a fully separate, non-Glyvio-authenticated application — an Angular/React/Flutter/mobile portal, a public-facing site, anything outside the internal Glyvio app shell. Covers the ExternalUser auth model, the read/write/report routing convention, multi-tenant scoping, security patterns for external-facing controllers, the framework-agnostic frontend integration contract, and the workspace docs structure (shared REQUIREMENTS.md + per-project CLAUDE.md). Does NOT prescribe how ExternalUser maps to a business identity (person, supplier, employee, ...) — that's project-specific and must be asked, never assumed. Does NOT cover report/dashboard *content* design (Plotly, KPI layout) — see the report-building skill/agent for that.
---

# Skill: External User API (plugin + separate app)

Reference pattern for the shape "a Glyvio plugin exposes an API; a fully separate application — any frontend framework, even mobile — consumes it as the only client that matters." Built and validated across a real project (Angular portal + Glyvio plugin), covering auth, multi-tenant scoping, controller security, the frontend contract, and the docs structure that kept a two-repo project coherent across many sessions.

This is a **pattern reference**, not a code generator — apply the parts that fit, adapt the parts that are project-specific (flagged explicitly below), and always prefer an existing narrower skill (`create-controller`, `modify-manifest`, `glyvio-report-agent`, etc.) for the actual artifact once the pattern below has told you what to build.

---

## ⚠️ Ask first, never assume: how does `ExternalUser` map to a business identity?

`glyvio_entity.ExternalUser` is just an authenticated identity — it proves *someone outside Glyvio* is calling, nothing more. How that identity resolves to an actual business record (a person, a company/client, a supplier, an employee, an account) is **entirely project-specific** and must be **asked**, not assumed or copied from a prior project:

- In the reference project this was `external_user.person_id → person → client_person → client` (many-to-many — one person could reach more than one client).
- A different project might link `ExternalUser` directly to a `Supplier`, to an `Employee`, 1:1 instead of N:N, or through an entirely different chain.

**Before writing any resolution service, ask the operator**: what does this external user represent, and what's the exact chain (if any) from `ExternalUser` to the record(s) they're allowed to see? Only once that's answered does the rest of this pattern (multi-scope support, `{scope}Id?` params, the `external_{scope}_list` controller) apply — see "Multi-tenant / multi-scope resolution" below, which is written generically in terms of "scope" precisely so it doesn't presume person/client.

---

## 🔑 Auth model (platform-native, don't reimplement)

- `ExternalUser` authenticates via JWT, validated **natively by the platform** — no manual JWT parsing/verification in plugin code.
- Two equivalent ways to send it, both accepted identically by the platform:
  - Header: `Authorization: Bearer <jwt>` — used by any real HTTP client (the frontend's own API calls).
  - Query string: `?auth_token=<jwt>` — used when a link must open in a new tab with no way to attach a custom header (e.g. `<a href target="_blank">`). Confirmed: `?auth_token=malformed` fails the exact same way as a malformed `Authorization` header (`400 invalid_token`) — it's the same validation path, just a different transport.
- A controller receives the resolved `externalUser: glyvio_entity.ExternalUser` as the second argument to `handle(request, externalUser)` — never re-derive identity from the raw token yourself.

---

## 🛣️ Routing convention

```
POST {host}/custom/external/read/{companyId}/{path}    — queries, no side effects
POST {host}/custom/external/write/{companyId}/{path}   — mutations
GET  {host}/custom/external/report/{companyId}/{path}?...&auth_token=<jwt>  — opened as a plain link, not called via the app's HTTP client
```

- `read` vs `write` is a **semantic** split, not enforced by the platform — respect it consistently so the frontend's own read/write service methods stay meaningful, and so nothing that mutates data hides behind a `read` call.
- `report` is not exclusive to dashboards — it's the right prefix for **any** route meant to be opened as a direct link (new tab, no custom headers), using the `auth_token` query-string auth described above. If the "report" is an actual dashboard/visualization, this skill stops at the routing/auth wiring — hand off the content itself (KPIs, charts, layout) to the report-building skill/agent. If it's some other kind of "open this in a new tab" resource, the `report` prefix + `auth_token` pattern still applies even though there's no dashboard involved.
- Controller shape:
  ```typescript
  @glyvio_core.Controller({
    path: 'external_thing_get',
    allowPrivateAccess: false,
    allowPublicAccess: false,
    allowExternalUserAccess: true,
  })
  export class ExternalThingGetController extends glyvio_core.ExternalSimpleController<
    ExternalThingGetRequest,
    ExternalThingGetResponse
  > {
    handle(request: glyvio_core.WebRequest<ExternalThingGetRequest>, externalUser: glyvio_entity.ExternalUser): ExternalThingGetResponse {
      // ...
    }
  }
  ```

---

## 🏢 Multi-tenant / multi-scope resolution

Once the operator has answered the "ask first" question above and there's a concrete resolution chain, most external APIs need the same shape:

1. A small service module (e.g. `external_*_access_service.ts`) with `resolve*ForExternalUser(externalUser, scopeId?)`-style functions — one place that knows the resolution chain, reused by every controller instead of re-deriving it.
2. If the external user can reach **more than one** scope (client/account/whatever the operator defined): every controller request gets an optional `{scope}Id?: string` field, defaulting to the first/only resolved scope when omitted (backward-compatible for the common single-scope case).
3. A dedicated no-body list controller (`external_{scope}_list`) returning every scope the caller can reach, so the frontend can show a picker when there's more than one and pass the chosen id back on every subsequent call.
4. If the external identity has a real display name available through the resolution chain, surface it from the same list controller (e.g. `{ personName, items }`) — saves the frontend a separate "who am I" round trip.

---

## 🔒 Controller security patterns worth reusing

- **Revalidate every foreign key the caller sends — never trust a client-supplied id.** Look it up scoped to the resolved scope/identity; if it doesn't resolve inside that scope, treat it exactly like "doesn't exist."
- **Generic errors for scope violations.** Don't distinguish "this record doesn't exist" from "it exists but isn't yours" in the error message — that distinction is itself information leakage.
- **No `AppUser` session exists for an external user** — use `glyvio_core.entityService.saveEntityWithoutPermission(entity)` / `saveListWithoutPermission([...])` (not `saveEntity`/`saveList`, which check permissions against a session that doesn't exist here).
- **NOT NULL FK to `AppUser` on content the external user "creates"** (e.g. an audit/timeline entry with a mandatory `userId`): resolve a stable system/service `AppUser` once (by name, cached) to satisfy the FK, and — if the real external identity's name should be *displayed* — add a separate nullable `authorName`-style field alongside it, populated from the resolution chain. Reads should prefer the nullable display name when present, falling back to the system user's name for content that didn't originate externally.
- **Pre-generate ids with `glyvio_core.uuidService.v4()`** before a save whenever a just-created id is needed later in the same request (e.g. to link a second entity to it) — this pattern already exists elsewhere in Glyvio server code; it's not external-API-specific but comes up constantly here because external creates often need to link a freshly-created id to another freshly-created row in the same request. `glyvio_core.entityService.saveListWithoutPermission([entityA, entityB, ...])` saves a mixed batch in one call when both need to land together (verified: batch saves of unrelated entity types in one array do work).

---

## 📱 Frontend integration contract (framework-agnostic — Angular, React, Flutter, native mobile alike)

None of this is Angular-specific; adapt the mechanism (interceptor, middleware, whatever the framework calls it) but keep the contract:

1. **Capture the JWT once**, typically from `?auth_token=` on first load (a link the user was sent), then persist it (localStorage / secure device storage / whatever the platform's durable-storage primitive is) so the session survives a reload — an explicit product decision, not a default; confirm persistence duration/storage choice with the operator rather than assuming "never persist" or "always persist forever."
2. **Every call is a POST with a JSON body** — including "read" ones. This is not a REST GET/PUT/DELETE convention; don't build the client assuming it is.
3. **Resolve scope once, inject it everywhere.** Call the `external_{scope}_list` endpoint once per session (cache in memory, optionally persist the chosen id), show a picker UI only when there's more than one, and inject the chosen `{scope}Id` into every subsequent request body automatically (an interceptor/middleware layer, not per-call plumbing in every service method).
4. **Map specific error shapes to UX**, don't just show a generic failure for everything:
   - `401`/`403`, or a `400` whose body reports a token-related reason → treat as "access denied" / force re-auth.
   - A `428` with an empty body → the company/environment is still initializing; retry with backoff (a few attempts, capped), not an immediate hard failure.
   - A `400` with a specific business-error `reason` → surface that reason as a user-facing message, don't lump it in with access-denied handling.
   (The exact status/reason table is project-specific — this is the *shape* to build, not literal values to copy.)

---

## 📄 Workspace docs structure

The structure that kept a two-repo (plugin + app) project coherent across many sessions, worth reusing verbatim:

```
workspace-root/
  CLAUDE.md              — index only: what each project is, pointer to REQUIREMENTS.md, current phase/status
  REQUIREMENTS.md         — the ONE shared source of truth: data model, business rules, full API contract.
                            Used by BOTH sides. Any scope change lands here FIRST, before code.
                            Include a "Itens pendentes de confirmação" section for open questions that
                            must be confirmed with the project owner before implementing — never implement
                            around an open item in that section.
  <plugin-repo>/CLAUDE.md — backend-specific implementation notes, gotchas, validation history.
                            Cross-references REQUIREMENTS.md; does not duplicate it.
  <app-repo>/CLAUDE.md    — frontend-specific implementation notes, gotchas, validation history.
                            Cross-references REQUIREMENTS.md; does not duplicate it.
```

- **Update docs as you go, not at the end.** Every non-obvious gotcha found during implementation (a circular-DI bug, a CSS-encapsulation trap, an escaping bug, a platform quirk) belongs in the relevant `CLAUDE.md` the moment it's found — that's what makes it useful to a future session instead of silently rediscovered again.
- **Verify against the real running system, not just a passing build.** Backend changes: curl against a live dev backend (see the `fork-company-script` skill for verifying unpublished server code without deploying). Frontend changes: drive the actual running app (Playwright or equivalent) against real backend responses — a green build and a passing type-check are necessary, not sufficient.

---

## ✅ Checklist for a new plugin + external-app project

- [ ] Asked the operator how `ExternalUser` maps to their business identity — not assumed, not copied from a prior project.
- [ ] Confirmed whether the external identity can reach more than one "scope" — if yes, planned the `{scope}Id?` param + `external_{scope}_list` controller from the start.
- [ ] `read`/`write`/`report` used consistently per their semantic meaning, not just habit.
- [ ] Every external controller revalidates client-supplied ids against the resolved scope; no `saveEntity`/`saveList` (permission-checked) calls inside external-user code paths.
- [ ] If external-created content needs a real display name but its FK is a NOT NULL `AppUser` reference, planned the system-user-FK + nullable-display-name-field split up front.
- [ ] Frontend auth persistence choice (and duration) confirmed with the operator, not defaulted silently.
- [ ] Workspace has one shared `REQUIREMENTS.md` + one `CLAUDE.md` per repo, kept current as work lands — not just written once at the start.
