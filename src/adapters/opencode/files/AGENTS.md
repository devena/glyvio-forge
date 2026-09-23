# Glyvio development with OpenCode

These instructions apply when developing a Glyvio plugin or documenting Glyvio Core.
When maintaining this instruction package, edit its sources; do not run plugin builds
or access live Glyvio services merely to validate documentation changes.

## Select the relevant role

Use the OpenCode agent matching the requested layer. For a multi-layer task, apply the
relevant roles to their respective layers. Use subagents only when delegation is useful
and authorized; otherwise apply the role's instructions in the active session.

| Work | Agent ID |
| --- | --- |
| App views, routes, UI interceptors | `glyvio-app-coordinator` |
| Charts inside app views | `glyvio-app-chart` |
| Server rules, controllers, interceptors, queues | `glyvio-server-coordinator` |
| Environment actions, system/custom tools | `glyvio-environment-agent` |
| HTML reports served by controllers | `glyvio-report-agent` |
| Glyvio Core source documentation and API examples | `glyvio-doc-agent` |

## Apply skills

Load the skill matching the requested operation with OpenCode's `skill` tool. Skill
descriptions identify their scope. Do not load every skill preemptively; load only the
one needed for the task and its explicitly referenced companion skills.

Use the session's actual tools for search, editing, shell execution, web research, and
image inspection. Do not invent tools or claim validation that was not run.

## Shared Glyvio constraints

- For plugin implementation, verify APIs in the target layer's `@types` or
  `dist/bundle.d.ts`; never invent members or edit generated declarations as a fix.
  The documentation role may inspect Core source when that is the target project.
- Use injected `glyvio_core`, `glyvio_entity`, and `glyvio_structure` globals rather
  than importing framework internals. Follow the selected role's layer-specific
  typing, registration, entity creation, error and transaction rules.
- After manifest changes, run the host project's `run_helper.sh` and relevant checks.
- For visual mapping, consult `.opencode/component_catalog.md` and load the full
  reference only as needed. Browser validation follows `test-plugin-browser`.
- Work within the user's scope and session permissions; preserve unrelated changes.
  A workflow does not authorize a release, external message, or production mutation
  beyond the user's request. State missing runtime dependencies and checks not run.
