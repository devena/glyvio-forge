---
name: release-project
description: Builds the project, bumps the patch version, commits all changes with an auto-generated message describing what changed, and pushes to the remote branch.
---

# Skill: Release Project

Execute this skill whenever the user asks to release, publish, versionar, or deploy the current project.

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

### Step 4 — Stage all changes

```bash
git add -A
```

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

### Step 6 — Commit

```bash
git commit -m "<generated message>"
```

Pass the message via `$()` heredoc form to preserve newlines:

```bash
git commit -m "$(cat <<'EOF'
v<version>: <summary>

- <bullet 1>
- <bullet 2>
EOF
)"
```

---

### Step 7 — Push

Determine the current branch:

```bash
git rev-parse --abbrev-ref HEAD
```

Then push:

```bash
git push origin <current-branch>
```

---

### Step 8 — Report to the user

Print a short summary:

```
✔ Build ok
✔ Version bumped to <version>
✔ Committed: "<first line of commit message>"
✔ Pushed to origin/<branch>
```

---

## ⚠️ Error handling

| Situation | Action |
|-----------|--------|
| Build fails | Print full error, abort, do not stage/commit/push |
| Nothing to commit (`git status` clean after add) | Skip Steps 5-7, inform user there are no changes |
| Push rejected (non-fast-forward) | Print the rejection, do not force-push, ask the user how to proceed |
| Any other git error | Print the error, stop, ask the user |
