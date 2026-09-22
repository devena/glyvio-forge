---
name: release-project
description: "Builds the project, bumps the patch version, commits the changes belonging to the requested release with an auto-generated message describing what changed, and pushes to the remote branch."
---
# Skill: Release Project

Execute this skill whenever the user asks to release, publish, version or deploy the current project.

**Trigger phrases** (não exaustivo — qualquer formulação equivalente conta):

| Português | English |
| --- | --- |
| "atualizar a versão" / "atualiza a versão" | "update the version" |
| "sobe a versão" / "subir a versão" | "bump the version" |
| "nova versão" / "incrementar a versão" | "new version" / "bump version" |
| "versionar" / "fazer um release" | "release" / "ship it" |
| "publicar o projeto" | "publish" / "deploy" |

Se o pedido significa **"comita o que está pendente, incrementa a versão e faz push"**, é esta skill — execute os passos abaixo em vez de fazer commit/bump/push à mão, para que build, CHANGELOG e mensagem de commit não sejam pulados.

---

## ⚙️ Execution Steps

Follow every step in order. Do **not** skip a step. Do **not** proceed to the next step if the current one fails — stop and report the error to the user.

---

### Step 1 — Confirm working directory

Verify you are inside the project root (the directory that contains `package.json` and `.git`). If you are not, stop and ask the user for the correct path.

---

### Step 2 — Build the project

Run the build in the project root:

```bash
pnpm pretty && pnpm lint && pnpm build
```

- If the build **fails**: print the error, stop, and do not proceed.
- If the build **succeeds**: continue to Step 3.

---

### Step 3 — Bump the patch version

```bash
npm version patch --no-git-tag-version
```

This increments the patch segment of `version` in `package.json` (e.g. `0.3.8` → `0.3.9`) without creating a git tag.

Read the new version from `package.json` and keep it for use in the commit message.

---

### Step 4 — Stage the release changes

Inspect `git status --short` and `git diff --cached` before staging. Select the
files belonging to this release, including the version files changed in Step 3.
Stage those paths explicitly with `git add -- <release-file> ...`; do not use
`git add -A`. Preserve unrelated working-tree changes. If unrelated changes are
already staged, do not commit or unstage them as part of this release: report the
conflict so the operator can separate the work before the commit.

---

### Step 5 — Analyze the diff and write the commit message

Run:

```bash
git diff --cached --stat
git diff --cached -- ":(exclude)*.lock" ":(exclude)pnpm-lock.yaml" ":(exclude)package-lock.json"
```

Read the diff output and write a **concise** commit message following these rules:

- **First line**: `v<new_version>: <summary of what changed>` — one sentence, 72 characters max.
- **Body (optional)**: bullet list of the main changes, one per area or file group. Only include if there are multiple independent changes worth distinguishing. Each bullet starts with a verb (Add, Fix, Update, Remove, Refactor).
- **Language**: write in the same language the recent git log messages use (check with `git log --oneline -5`).
- **Tone**: technical but concise. Do not reference file paths — describe the behavior.
- **Forbidden**: do not mention "Co-Authored-By", do not add emojis, do not include lock file changes, do not list every changed file individually.

---

### Step 6 — Update CHANGELOG.md

Prepend an entry to `CHANGELOG.md` at the project root using the **same version and bullet content** written for the commit message in Step 5. If the file does not exist yet, create it with a top-level `# Changelog` heading first.

Entry format (newest on top, right below the `# Changelog` heading):

```markdown
## v<version> — <YYYY-MM-DD from `date +%F`>

- <bullet 1>
- <bullet 2>
```

- If Step 5 produced no bullet list (single-sentence release), use the commit's first line (without the `v<version>: ` prefix) as the single bullet.
- Stage it: `git add CHANGELOG.md` (it must land in the **same commit** created in Step 7, not a separate one).

---

### Step 7 — Commit

Write the exact commit message to a temporary file outside the staged set,
then run `git commit --file <message-file>`. Preserve newlines and literal shell
characters; do not interpolate generated prose into a shell command. Remove only
the temporary file you created after the commit succeeds.

---

### Step 8 — Push

Determine the current branch:

```bash
git rev-parse --abbrev-ref HEAD
```

Then push:

```bash
git push origin <current-branch>
```

---

### Step 9 — Report to the user

Print a short summary:

```
✔ Build ok
✔ Version bumped to <version>
✔ CHANGELOG.md updated
✔ Committed: "<first line of commit message>"
✔ Pushed to origin/<branch>
```

---

## ⚠️ Error handling

| Situation | Action |
|-----------|--------|
| Build fails | Print full error, abort, do not stage/commit/push |
| Nothing to commit (`git status` clean after add) | Skip Steps 5-8, inform user there are no changes |
| Push rejected (non-fast-forward) | Print the rejection, do not force-push, ask the user how to proceed |
| Any other git error | Print the error, stop, ask the user |
