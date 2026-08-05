---
name: fork-company-script
description: Verifies an unpublished, freshly-built plugin/server code change against a live Glyvio backend without deploying — by forking a temporary company script (PUT /plugin/{companyId}/fork-company-script) and running verification requests with the custom-script-id header. Only activates when the operator explicitly opts into live testing and supplies the server URL, a private/internal JWT, and the companyId — never invents or reuses these from an unrelated prior task.
---

# Skill: Fork Company Script (live server-code verification)

Runs a curl-based verification against **the real running backend**, executing a just-built `plugin/server/dist/bundle.js` instead of the company's normally-deployed code, for one or more specific requests — no deploy, no restart. Validated end-to-end (creation, normal execution, custom-code execution, invalid-id rejection, expiration) against a live backend.

This is a testing aid layered on top of whatever the operator already asked for (a controller, an interceptor, a business rule fix, etc.) — it never replaces `pnpm build` failing fast on compile errors, and it never substitutes for the operator's own review.

---

## 🚧 Precondition: this only publishes JavaScript — never the schema

`fork-company-script` forks **compiled JS logic only** (`bundle.js`). It does **not** touch the database schema. If `manifest.json` was changed (new entity, new field, changed type, new permission, etc.) as part of the work being verified, that schema change must already be applied to the target company through the **normal plugin update flow** *before* this skill runs — forking will not apply it, and code referencing a not-yet-existing entity/field will fail against the live (unchanged) schema, in a way that looks like a code bug but is actually a stale-schema mismatch.

**Check first:** if the change being verified touched `manifest.json`, confirm with the operator that the corresponding schema update has already been deployed/applied to the target `companyId`. If it hasn't, stop and say so instead of forking against a schema that doesn't match yet.

---

## ⚠️ Decision Policy — never automatic

This skill is **operator-driven**. Before doing anything:

1. **Operator explicitly asked for live testing AND supplied all three of**: server base URL, a private/internal JWT, and the `companyId` → proceed with the Execution Steps below.
2. **Operator said nothing about testing** → ask whether they'd like the change verified this way. If yes, ask for whichever of the three (server URL, private JWT, `companyId`) is still missing.
3. **Operator was explicit that they just want the code written** (e.g. "just do it", "no need to test", "skip testing") → do not invoke this skill at all.

**Never invent, guess, or reuse from memory** a server URL, JWT, or `companyId` from an earlier unrelated task or conversation — these must come from the operator, fresh, every time this skill runs. A stale `companyId` or JWT silently points the test at the wrong environment/user.

---

## 📥 Required Input

| Input | Source | Notes |
|---|---|---|
| Server base URL | Operator | e.g. `http://localhost:8080` |
| Private/internal JWT | Operator | `Authorization: Bearer <jwt>` for the fork call itself — must resolve to a real `AppUser` (private/internal session), not an external or public token. The "one script per caller" tracking (see Gotchas) keys off this identity. |
| `companyId` | Operator | UUID of the target company |
| `pluginId` | Read from the plugin's own root `package.json` (`pluginId` field) | Never ask the operator for this — it's already in the repo |
| Verification request(s) | Operator or inferred from the task | Whatever request(s) exercise the just-changed code — read/write/report routes all work identically once `custom-script-id` is set |

---

## ⚙️ Execution Steps

### Step 1 — Build

Run the project's build so `plugin/server/dist/bundle.js` reflects the current code:

```bash
pnpm run build:fast
```

Stop and report the error if the build fails — do not proceed to fork broken code.

### Step 2 — Read `pluginId`

Read the `pluginId` field from the plugin's root `package.json`.

### Step 3 — Fork

Build the request payload with a proper JSON encoder — **never** hand-escape the bundle text into a shell string; it's large and contains quotes/backslashes/newlines that break naive interpolation:

```bash
python3 -c "
import json
with open('plugin/server/dist/bundle.js', 'r', encoding='utf-8') as f:
    server_code = f.read()
payload = {'pluginId': '<pluginId from package.json>', 'serverCode': server_code}
with open('/tmp/fork_payload.json', 'w', encoding='utf-8') as f:
    json.dump(payload, f)
"
```

Then:

```bash
curl -s -m 60 -X PUT "<serverUrl>/plugin/<companyId>/fork-company-script" \
  -H "Authorization: Bearer <private JWT>" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/fork_payload.json
```

Response: `{"codeId": "...", "expirationTime": "<ISO datetime>"}`. The backend can be slow (dev auto-reload mode) — a 200 taking 15-25s is normal, not a failure.

### Step 4 — Run the verification request(s)

Run whatever request(s) exercise the changed code, adding header `custom-script-id: <codeId>` — any auth type on *this* request (external/public/private) works, independent of the private JWT used in Step 3:

```bash
curl -s -X POST "<serverUrl>/custom/external/read/<companyId>/<path>" \
  -H "Authorization: Bearer <whatever token the endpoint normally needs>" \
  -H "Content-Type: application/json" \
  -H "custom-script-id: <codeId>" \
  -d '<body>'
```

### Step 5 — Report

Report the result plainly: what was verified, the actual response, and whether it matches the expected behavior. Clean up any temp payload file (`/tmp/fork_payload.json`).

---

## ⚠️ Known Behaviors / Gotchas (validated against a live backend — not assumptions)

- **`expirationTime` is a lower bound, not the exact cutoff.** The response's `expirationTime` is `now + 15min`, but the underlying cache entry can outlive it by up to ~1 minute. It never expires *earlier* than reported — never treat a request as unsafe before `expirationTime`, but don't be surprised if it still works a little past it.
- **One forked script per caller identity, ever.** Forking again with the *same* private JWT's resolved identity silently evicts the previous `codeId` — even for an unrelated verification. Don't assume a `codeId` from earlier in the session is still valid after a later fork with the same JWT.
- **Invalid/expired `codeId` fails loud, not silent**: a request with an unknown or evicted `custom-script-id` returns `400`:
  ```json
  {"type":"validation","errors":[{"args":{"custom_script_id":"..."},"reason":"invalid_custom_script"}]}
  ```
  If you see this immediately after a fresh fork (Step 3 succeeded), treat it as a real bug and investigate — don't just re-fork and move on. If it happens after some time has passed, it's expected expiration/eviction — re-fork (Step 3) and retry.
- **The fork call itself needs a private/internal JWT**, not external/public — the per-caller tracking above depends on resolving a real `AppUser`. Using an external/public token for the *fork* call (not the verification request, which can be anything) risks colliding with other external/public callers under the same empty identity.
- **The whole request runs on the forked script, not just the controller under test.** `custom-script-id` swaps the *entire* JS engine context for that request — every rule that JavaScript executes during it runs the forked code, not only the specific controller being verified. Concretely: if the request triggers an entity save (`entityService.saveEntityWithoutPermission`, `saveList`, etc.), that entity's `Before`/`After`/`AfterCommit` interceptors also execute from the **forked** code, even if you only meant to test one custom controller. This cuts both ways — it's wider verification than you may have intended (good: it also exercises interceptor changes bundled in the same build; bad: an unrelated bug in a forked interceptor can make an otherwise-correct controller test fail, or an unrelated forked interceptor bug could produce side effects you didn't mean to test). Keep this in mind when interpreting a failure — trace it to the actual rule that threw, not just the endpoint you called.

---

## ✅ Completion Checklist

- [ ] Operator explicitly opted into this (or was asked and agreed) — never triggered silently.
- [ ] Server URL, private JWT, and `companyId` all came from the operator this run — none reused from memory or an earlier task.
- [ ] If `manifest.json` changed as part of this work, confirmed the schema update was already applied to the target company through the normal flow — not just forked.
- [ ] Build succeeded before forking.
- [ ] Payload built via a JSON encoder, not shell string escaping.
- [ ] Verification request(s) actually exercise the changed code path.
- [ ] Result reported plainly — including if it failed, and including a fresh re-fork + retry if the failure was `invalid_custom_script` due to expiration (not re-forked silently if it happened right after Step 3).
- [ ] Temp payload file cleaned up.
