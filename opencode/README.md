<!-- Generated from src/adapters/opencode/files/README.md by tools/generate.py. Edit the source, not this file. -->
# Glyvio for OpenCode

This generated distribution package contains native OpenCode V2 agents, skills,
references, and helper scripts for Glyvio development.

## Install in a Glyvio project

1. Copy this `opencode/` directory to the root of the target project.
2. Copy `opencode/.opencode/` to the target project's `.opencode/` directory. Merge
   it with existing content; do not overwrite agents or skills without comparing them.
3. Merge the contents of `opencode/AGENTS.md` into the target project's root
   `AGENTS.md`. OpenCode V2 loads `AGENTS.md`; it does not use `CLAUDE.md` as a
   fallback.
4. Start a new OpenCode session in the project so the agents, skills, and instructions
   are discovered.

The package deliberately does not set a model, global permissions, or active MCP
servers. Those are project/user decisions. `opencode/.opencode/mcp.example.jsonc` is
an optional local-server example: review and merge only the server you need into the
project's `.opencode/opencode.jsonc`.

OpenCode discovers directory-based agents and skills automatically. The generated
`opencode.jsonc` contains only the official schema reference, so it is safe to merge
with an existing project configuration.
