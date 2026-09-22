# Maintaining Glyvio Forge

This repository distributes instructions and examples; it is not a Glyvio plugin.

- Edit shared content in `src/`. Assistant-specific metadata and entrypoint docs
  belong in `src/adapters/`. Do not manually edit generated packages or examples.
- Read `README.md` for the source/output mapping. Run `python3 tools/generate.py`,
  `python3 tools/generate.py --check`, and the tests under `tools/tests` after edits.
- Preserve unrelated local changes. The generator refuses to overwrite modified
  outputs; reconcile their changes into the source before regenerating.
- `.agents/`, `claude/skills/synced/`, and `tools/test-runner/` contain local
  installations or runtime material and are outside the generation pipeline.
- Do not run plugin builds, releases, live browser scenarios, or production calls
  merely to verify changes to this instruction package.
