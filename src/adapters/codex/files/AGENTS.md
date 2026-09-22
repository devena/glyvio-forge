# Glyvio development with Codex

These instructions apply when developing a Glyvio plugin or documenting Glyvio Core.
When maintaining this instruction package, edit its sources; do not run plugin builds
or access live Glyvio services merely to validate documentation changes.

## Select the relevant role

Read only the matching `developer_instructions` in the TOML file below. Paths are
relative to the host project root, where this package is kept as `codex/`.

| Work | Role file |
| --- | --- |
| App views, routes, UI interceptors | `codex/agents/glyvio-app-coordinator.toml` |
| Charts inside app views | `codex/agents/glyvio-app-chart.toml` |
| Server rules, controllers, interceptors, queues | `codex/agents/glyvio-server-coordinator.toml` |
| Environment actions, system/custom tools | `codex/agents/glyvio-environment-agent.toml` |
| HTML reports served by controllers | `codex/agents/glyvio-report-agent.toml` |
| Glyvio Core source documentation and API examples | `codex/agents/glyvio-doc-agent.toml` |

For a multi-layer task, apply the relevant roles to their respective layers.
Use an installed custom agent only when delegation is available and authorized by
the session. Otherwise apply its instructions locally; delegation is not a
prerequisite for completing the task.

## Apply skills

Read `codex/skills/<name>/SKILL.md` for the requested operation. Skill descriptions
identify their scope. Installed skills can also be selected with `$skill-name`.
Use the session's real tools for search, file editing, shell execution, and image
inspection; do not invent a `Skill`, `Read`, or `Task` tool.

## Shared Glyvio constraints

- For plugin implementation, verify APIs in the target layer's `@types` or
  `dist/bundle.d.ts`; never invent members or edit generated declarations as a fix.
  The documentation role may inspect Core source when that is the target project.
- Use injected `glyvio_core`, `glyvio_entity`, and `glyvio_structure` globals rather
  than importing framework internals. Follow the selected role's layer-specific
  typing, registration, entity creation, error and transaction rules.
- After manifest changes, run the host project's `run_helper.sh` and relevant checks.
- For visual mapping, consult `codex/component_catalog.md` and load the full
  reference only as needed. Browser validation follows `test-plugin-browser`.
- Work within the user's scope and session permissions; preserve unrelated changes.
  A workflow does not authorize a release, external message, or production mutation
  beyond the user's request. State missing runtime dependencies and checks not run.
