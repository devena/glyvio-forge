---
name: create-workflow-page
description: "Generates a process/flow graph page (SimpleWorkflowPage): nodes and labeled links laid out automatically as a directed graph, with node cards, node tap, and 'add a step here' on open links — for approval flows, pipelines, status machines or any step-by-step process editor. Includes route and menu registration."
---
<!-- Generated from src/skills/create-workflow-page/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Workflow (Graph) Page

`glyvio_core.SimpleWorkflowPage<S, N>` draws a directed graph. You provide **node states**
(`N extends SimpleWorkflowPageNodeState`: `key`, `visible?`, `possibleLinks?`); each link
(`{ key, label?, colorTheme?, toKey? }`) becomes an edge when it has a `toKey`, or an open "+"
slot when it does not. The app lays the graph out automatically.

| Method | Role |
| --- | --- |
| `refreshNodesState(state): Promise<N[]>` | load the nodes (called on every refresh; result goes to `state.nodesState`) |
| `getDesignForNode(state, node)` | the node card: `SimpleWorkflowPageNodeDesign({ contentDesign, width?, height?, colorTheme? })` |
| `onNodeTap(state, node)` | user tapped a node (open a sidebar/modal to edit the step) |
| `onAddNode(state, fromKey, linkKey)` | user tapped "+" on link `linkKey` of node `fromKey`: create the step and point the link to it; nodes are reloaded afterwards |
| `getDesign(state, design)` | app bar and page-level options |

This page is only the editor/visualizer. Where the flow is stored (an entity with steps, a JSON
column) and what executes it are your plugin's decisions.

> Contract: `.claude/references/views_and_interceptors.md`.

---

## 📥 Required Input Parameters

1. **What the nodes are** and where they are stored (entity/fields, or JSON in a record).
2. **Links per node type** (labels such as "Aprovado"/"Reprovado", colors).
3. **Node card content** and **tap behavior**.
4. **Adding steps**: allowed? what is created?
5. **Plugin namespace**, **route path**, **permission**, **menu group**.

---

## 🚫 Rules

1. Globals only; no `any`.
2. `key` of each node is unique and stable (use the record id); link keys are unique per node.
3. `refreshNodesState` reads from storage; `onAddNode` **persists** the new step (and the updated
   link) before returning — the framework reloads nodes right after it.
4. Actions inside node cards use normal action keys handled in `events()`; never invent keys starting with `_`.
5. Keep `contentDesign` small (title + 1–2 lines + optional chip): the graph is laid out by node size.
6. Texts as `$T{}` keys in every `.arb`.

---

## 📋 Execution Steps

1. Create `src/views/pages/<feature>_workflow_page.ts` (blueprint).
2. Export it; `routerService.loadRoutes([<Feature>WorkflowPageRoute])`; menu item.
3. Implement storage reads/writes in `refreshNodesState`/`onAddNode`, and the editor opened by `onNodeTap`.
4. `pnpm build`; check the graph and the "+" flow with `test-plugin-browser`.

---

## 📄 Code Blueprint

```typescript
export interface <Feature>NodeState extends glyvio_core.SimpleWorkflowPageNodeState {
  key: string;
  label: string;
  possibleLinks?: glyvio_core.SimpleWorkflowPageNodeLinkState[];
}

export interface <Feature>WorkflowRouteParams extends glyvio_core.SimpleWorkflowPageRouteParams {
  <ownerId>?: string; // e.g. the record that owns the flow
}

export interface <Feature>WorkflowState
  extends glyvio_core.SimpleWorkflowPageState<<Feature>WorkflowRouteParams, <Feature>NodeState> {
  selectedKey?: string;
}

export class <Feature>WorkflowPageRoute extends glyvio_core.SimpleWorkflowPageRoute<<Feature>WorkflowRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return <PermissionOrUndefined>;
  }
  getRoutePath(): string {
    return '<route-path>';
  }
  getRouteNameSpace(): string {
    return '<plugin_namespace>';
  }
  getRouteNameObject(): string {
    return '<Feature>WorkflowPage';
  }
}

export class <Feature>WorkflowPage extends glyvio_core.SimpleWorkflowPage<<Feature>WorkflowState, <Feature>NodeState> {
  constructor() {
    super(<Feature>WorkflowPageRoute);
  }

  async refreshNodesState(state: <Feature>WorkflowState): Promise<<Feature>NodeState[]> {
    // Load the steps from storage. Example of the expected shape:
    return [
      { key: 'start', label: '$T{<plugin>_<feature>_start}', possibleLinks: [{ key: 'next', toKey: 'review' }] },
      {
        key: 'review',
        label: '$T{<plugin>_<feature>_review}',
        possibleLinks: [
          { key: 'approved', label: '$T{<plugin>_<feature>_approved}', colorTheme: 'GREEN', toKey: 'end' },
          { key: 'rejected', label: '$T{<plugin>_<feature>_rejected}', colorTheme: 'RED' }, // open: shows "+"
        ],
      },
      { key: 'end', label: '$T{<plugin>_<feature>_end}', possibleLinks: [] },
    ];
  }

  getDesignForNode(state: <Feature>WorkflowState, node: <Feature>NodeState): glyvio_core.SimpleWorkflowPageNodeDesign {
    return new glyvio_core.SimpleWorkflowPageNodeDesign({
      width: 200,
      colorTheme: state.selectedKey == node.key ? 'PRIMARY' : undefined,
      contentDesign: new glyvio_core.CardCellDesign({
        padding: '8',
        child: new glyvio_core.ColumnLayoutDesign({
          children: [new glyvio_core.StringTextDesign({ value: node.label, style: 'LABEL_MEDIUM' })],
        }),
      }),
    });
  }

  async onNodeTap(state: <Feature>WorkflowState, node: <Feature>NodeState): Promise<void> {
    state.selectedKey = node.key;
    // e.g. await this.pushSidebar(new <Step>SidebarRoute({ id: node.key }));
  }

  async onAddNode(state: <Feature>WorkflowState, fromKey: string, linkKey: string): Promise<void> {
    const newKey = await glyvio_core.uuidService.v4();
    // 1. persist the new step (key = newKey) in storage
    // 2. persist the link `linkKey` of step `fromKey` now pointing to newKey (toKey = newKey)
    // refreshNodesState runs right after this method
  }

  async events(_state: <Feature>WorkflowState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }

  getDesign(state: <Feature>WorkflowState, design: glyvio_core.SimpleWorkflowPageDesign): void {
    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({ title: '$T{<plugin>_<feature>_title}' });
  }
}
```

---

## ✅ Completion Checklist

- [ ] Node keys stable and unique; link keys unique per node; open links have no `toKey`.
- [ ] `onAddNode` persists both the new step and the re-pointed link.
- [ ] No custom `_` action keys; node actions handled in `events()`.
- [ ] Route registered, class exported, menu item; texts in every `.arb`.
- [ ] `pnpm build` clean; graph + "+" checked with `test-plugin-browser`.
