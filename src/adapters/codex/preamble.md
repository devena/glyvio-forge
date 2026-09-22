## Codex execution

Use the tools actually exposed in this Codex session for file reads, `rg` searches,
patches, shell commands, and image inspection. Apply a skill by reading its
`codex/skills/<name>/SKILL.md` and following it; a skill is instructions, not a
callable tool or a separate agent. Users can select an installed skill with `$name`.
Use the session's planning facility when available, otherwise keep a concise plan.

Delegation below applies only when subagents are available and authorized by the
current session. Use the matching installed Glyvio role for a bounded task; if
unavailable, read `codex/agents/<name>.toml` and apply its `developer_instructions`
yourself. A handoff never expands permissions. Without delegation, perform the same
implementation and validation locally. Inherit the session model and permissions.
Resolve `codex/` paths from the host project root, not the `.codex/agents` folder.

