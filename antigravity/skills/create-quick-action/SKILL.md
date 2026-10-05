---
name: create-quick-action
description: "Registers a plugin quick action with glyvio_core.menuRegistryService.addAction (e.g. \"Criar pedido\", \"Buscar cliente\"): an ACTION menu item that runs code from whatever screen the user is on, can be favorited/pinned, and shows up in the full menu, side menu, command palette (Ctrl/⌘+K) and the Jeannie home. Use when the user asks for an atalho/ação rápida/comando/shortcut that does something (open a cart, pick a record and open it, start a flow) instead of just opening a route."
---
<!-- Generated from src/skills/create-quick-action/SKILL.md by tools/generate.py. Edit the source, not this file. -->

# Skill: Create a Quick Action (menu action)

Uma **quick action** é um item do menu do tipo `ACTION`. Diferente de um item de rota (que só
abre uma tela), ela executa um `run(view, state)` no contexto da tela onde o usuário está.
Requer `glyvio_core` com `MenuRegistryService.addAction` (setembro/2026 em diante).

## Quando usar

| Pedido | Use |
| --- | --- |
| "Atalho para a lista de clientes" | Item de rota comum (`fullMenuGroupAdd` / `menuRegistryService.addItem`) |
| "Botão rápido para criar pedido" | Quick action que abre o cart |
| "Buscar cliente e abrir a ficha" | Quick action com modal de escolha + `onPop` |

## Passo 1 — Registrar no `plugin/app/src/index.ts`

Registre **depois** do grupo do menu onde ela deve aparecer (se o grupo não existir, é criado com
`name = key`, sem tradução — prefira registrar o grupo antes).

```typescript
glyvio_core.menuRegistryService.addAction('sales', {
  key: 'crm.newSale', // <plugin>.<ação>: também é a chave do favorito — nunca renomeie depois
  title: '$T{crm_menu_actionNewSale_title}',
  subtitle: '$T{crm_menu_actionNewSale_subtitle}',
  iconName: 'sax_linear_bag_2',
  permission: glyvio_permissions.view_sale_edit_cart, // sem permissão: some e não roda
  run: (view, state) => view.pushCart(state, new SaleEditCartRoute({})),
});
```

`run` recebe a view atual (página, modal, sidebar ou cart) e o estado dela. Dali abra o que
precisar: `view.pushModal(...)`, `view.pushSidebar(route, true)`, `view.pushCart(state, route)`,
`view.pushPage(...)`.

## Passo 2 — Ação com escolha (modal → `onPop`)

```typescript
glyvio_core.menuRegistryService.addAction('sales', {
  key: 'crm.findClient',
  title: '$T{crm_menu_actionFindClient_title}',
  subtitle: '$T{crm_menu_actionFindClient_subtitle}',
  iconName: 'sax_linear_search_normal_1',
  permission: glyvio_permissions.view_client_sidebar,
  run: (view) =>
    view.pushModal(
      new ClientEntityModalRoute({
        popActionKey: glyvio_core.MenuRegistryService.popActionKey('crm.findClient'),
      }),
    ),
  onPop: async (view, _state, data) => {
    const id = data?.entity?.id ?? glyvio_entity.Client.fromJson(data?.entity)?.id;
    if (id) await view.pushSidebar(new ClientSidebarRoute({ id }), true);
  },
});
```

- O `popActionKey` **tem** de vir de `MenuRegistryService.popActionKey(key)`; a base
  (`CoreView.events`) roteia `_MENU_ACTION_POP|<key>` para o `onPop` certo em qualquer tela.
- A base já desserializa `data.entity` dos entity modals; mesmo assim leia o id de forma
  tolerante (`data.entity.id ?? Entity.fromJson(data.entity)?.id`).
- Não trate `_RUN_MENU_ACTION`/`_MENU_ACTION_POP|…` nos seus `events`: o core cuida.

## Passo 3 — Traduções

Adicione `title`/`subtitle` em **todos** os `.arb` do plugin (pt_BR e en_US) e rode o
`node antigravity/scripts/i18n_check.mjs .` (ver `antigravity/rules/references/i18n.md`).

## Passo 4 — Validar

1. `pnpm pretty && pnpm lint && pnpm build`.
2. No navegador (skill `test-plugin-browser`): abra o menu completo, confira o item no grupo,
   dispare-o, e para ações com `onPop` escolha um registro e confirme que a tela certa abriu.
   Pelo AI bridge: `dispatchAction(cb, '_RUN_MENU_ACTION', { key: 'crm.newSale' })` na tela atual.
3. Teste com um usuário sem a permissão: o item não deve aparecer.
