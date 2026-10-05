---
name: create-workflow-page-interceptor
description: "Generates a custom class extending SimpleWorkflowPageInterceptor to change an existing workflow/graph page you do not own — node cards, edges (labels, colors, extra or hidden edges), the app bar, and side effects when a step is added — and registers it."
---
<!-- Generated from src/skills/create-workflow-page-interceptor/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Agent Skill: Create a Workflow Page Interceptor

Hooks of `glyvio_core.SimpleWorkflowPageInterceptor<S, N>`:

| Hook | Use |
| --- | --- |
| `getDesign(state, design: SimpleWorkflowPageDesign)` | app bar, page options |
| `getDesignForNode(state, node, design: SimpleWorkflowPageNodeDesign)` | mutate a node card (`contentDesign`, `colorTheme`, `width`, `height`, `visible`) |
| `getEdges(state, edges: SimpleWorkflowPageEdgeDesign[]): SimpleWorkflowPageEdgeDesign[]` | **return** the edge list — filter, recolor (`colorTheme`), relabel (`label`) or add edges (`fromKey`, `toKey`, `linkKey`) |
| `onAddNode(state, fromKey, linkKey)` | side effect after the page created a step |
| `populateJeannieContext(state, context)` | assistant context |

Plus the common hooks (`antigravity/rules/references/views_and_interceptors.md` §3). `onNodeTap` is not interceptable.

---

## 📥 Required Input Parameters

1. Target page route + state + node state types (from `@types`).
2. The change.
3. Plugin namespace.

---

## 🚫 Rules

1. Globals only; no `any`; correct generics `<State, NodeState>`.
2. `getEdges` must return the array (mutating and returning the same one is fine).
3. Hiding a node: set `design.visible = false` in `getDesignForNode`; edges pointing to it should be
   removed in `getEdges` too.
4. Register in `index.ts`.

---

## 📄 Code Blueprint

```typescript
export class <Name>Interceptor extends glyvio_core.SimpleWorkflowPageInterceptor<<TargetState>, <TargetNodeState>> {
  getListenerId(): string {
    return '<plugin>.<name>_workflow_interceptor';
  }

  getListenerRoute(): new () => glyvio_core.CoreRoute<any> {
    return <TargetRoute>;
  }

  getDesignForNode(state: <TargetState>, node: <TargetNodeState>, design: glyvio_core.SimpleWorkflowPageNodeDesign): void {
    if (node.key == '<someKey>') {
      design.colorTheme = 'WARNING';
    }
  }

  getEdges(state: <TargetState>, edges: glyvio_core.SimpleWorkflowPageEdgeDesign[]): glyvio_core.SimpleWorkflowPageEdgeDesign[] {
    for (const e of edges) {
      if (e.linkKey == 'rejected') {
        e.colorTheme = 'RED';
      }
    }
    return edges;
  }
}

glyvio_core.appInterceptorService.registerInterceptors([{ interceptor: <Name>Interceptor, order: 10 }]);
```

---

## ✅ Completion Checklist

- [ ] Correct generics; `getListenerRoute()` returns the workflow page route.
- [ ] `getEdges` returns the list; hidden nodes have their edges removed.
- [ ] Registered; `pnpm build` clean; graph checked with `test-plugin-browser`.
