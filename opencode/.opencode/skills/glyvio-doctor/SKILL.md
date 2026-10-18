---
name: glyvio-doctor
description: "Diagnoses and repairs a Glyvio plugin project when something does not work: checks the user profile, Node/pnpm/git, the project files, the .env (without reading secrets), the glyvio-dev-helper, the @types, the dependencies, the build and the git state; fixes what is safe to fix by itself and explains the rest in the language of the user's profile. Use when the user says something is broken or unclear (\"não está funcionando\", \"deu erro\", \"travou\", \"não aparece\", \"verifique meu ambiente\", \"doctor\", \"diagnóstico\", \"something is wrong\") or when a skill fails for an environment reason."
---
<!-- Generated from src/skills/glyvio-doctor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Glyvio Doctor

Finds out why the project does not work and repairs it, so the person never has to understand the
tooling. Run every check in order — **do not stop at the first problem**: collect the findings,
apply the safe fixes, then re-run the checks that failed.

Follow `.glyvio/user-profile.md` for every message. In the **simple** profile the person only sees
the final summary (step 3); never paste command output, code or logs.

---

## 🔐 Rules

1. **Never print or read back secrets.** Check `.env` keys only for presence (`grep -q`), never
   `cat` it. Never ask for a password in the chat.
2. **Safe fixes only, without asking:** creating missing folders, `chmod +x`, reinstalling
   dependencies, regenerating `@types`, restoring a missing `.gitignore` entry, re-downloading the
   helper. Everything else — installing software, deleting or reverting changes, touching git
   history, editing code to fix a build — is proposed first and done only after a "yes".
3. Never `git reset --hard`, `git clean`, force-push or delete the person's changes to "fix"
   something.
4. Stay inside the project root.

---

## 🩺 Step 1 — Checks

Run from the project root. For each check note **ok / fixed / problem**.

| # | Check | How | Safe fix / next action |
| --- | --- | --- | --- |
| 1 | Profile | `.glyvio/user-profile.md` exists | Missing → run `glyvio-onboarding` step 0 first. |
| 2 | Project root | `manifest.json` and `package.json` in the current folder | Look for them one level below (a cloned folder) and continue there; otherwise ask where the project is. |
| 3 | Tools | `node --version` (20+), `pnpm --version`, `git --version` | Missing/old → `glyvio-onboarding` step 1 (asks before installing). |
| 4 | Secrets protected | `.gitignore` has `.env`; `git ls-files .env` is empty | Add the entry. If `.env` is tracked: `git rm --cached .env`, and tell the person to change the Glyvio password. |
| 5 | `.env` filled | `for k in G_AUTH_URL G_COMPANY_ID G_USERNAME G_PASSWORD; do grep -q "^$k=..*" .env && echo "$k ok" \|\| echo "$k MISSING"; done` | Missing → `glyvio-onboarding` step 3 (opens the file for the password). |
| 6 | Helper | `tools/glyvio-dev-helper-<os>` (or `$GLYVIO_DEV_HELPER`) exists and is executable; `run_helper.sh` / `run_helper.ps1` at the root | Re-download / `chmod +x` / copy the scripts (`glyvio-onboarding` steps 2 and 4). |
| 7 | Types | `glyvio_core.d.ts`, `entity.d.ts`, `permissions.d.ts` in `plugin/app`, `plugin/server`, `plugin/environment` and `shared/commons` `@types`, each newer than `manifest.json` | Run `./run_helper.sh` (Windows `.\run_helper.ps1`). Errors → the troubleshooting table of `glyvio-onboarding`. |
| 8 | Dependencies | `node_modules` exists and is newer than `pnpm-lock.yaml` | `pnpm install`. |
| 9 | Build | `pnpm lint` and `pnpm build` | Environment error → fix per the rows above. Code error → read it, locate the file and propose the fix (rule 2); the matching `create-*` skill is the reference. |
| 10 | Git | `git status --short`, `git remote -v`, `git fetch` then `git status -sb` | No remote, behind the remote, or a merge/rebase in progress → explain (step 3); never resolve it destructively. |
| 11 | App access (only when the complaint is "não aparece no app") | The last release was pushed (`git log origin/<branch> -1`) and its CI passed (`gh run list -L 1` when `gh` is available); then `test-plugin-browser` | Not pushed → offer `release-project`. CI failed → read its log (`gh run view --log-failed`) and treat as check 9. Published but not visible → check the menu/route (`register-menu-and-admin`) and the user's permissions (`modify-manifest`). |

An HTTP **401/403** from the helper or the browser test means the password changed or the account
has no access to `G_COMPANY_ID`: reopen `.env` for the person (onboarding step 3) and, if it still
fails, the company administrator must grant access.

## 🔧 Step 2 — Fix and re-check

Apply the safe fixes, ask about the others (in the simple profile, describe the consequence, not the
command: "Vou reinstalar os componentes do projeto; leva uns minutos"), then run again every check
that was not **ok**. Repeat while something improves; stop after two rounds without progress.

## 🗒️ Step 3 — Report

**Simple profile** — at most four short lines, no commands or logs:

> Encontrei e resolvi 2 problemas: faltavam componentes do projeto e as definições do Glyvio
> estavam desatualizadas. Agora está tudo funcionando.

When something is still blocked, say what it is, who can solve it and offer a ready message:

> Ainda falta uma coisa que eu não consigo resolver daqui: sua conta não tem acesso à empresa de
> testes. Quem resolve é o administrador da empresa. Se quiser, envie para ele: "Preciso de acesso
> à empresa X no Glyvio para desenvolver o plugin Y."

**Developer profile** — a compact table of the checks (ok / fixed / problem) with the command or
file involved and the remaining action.

---

## ✅ Completion Checklist

- [ ] All checks run, not only the first failing one.
- [ ] Safe fixes applied; anything else confirmed before being done.
- [ ] Failed checks re-run after the fixes.
- [ ] No secret printed; nothing deleted or reverted without consent.
- [ ] Report written in the profile's language, with who to contact for what remains.
