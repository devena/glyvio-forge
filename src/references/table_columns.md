# Colunas das tabelas: personalizar e ordenar

> Vale para `SimpleTablePage`, `SimpleTableModal` (tabela principal) e `SimpleTableSidebar`.
> Requer um `glyvio_core` com `glyvio_core.TableColumnsController` e `glyvio_core.TableColumnSort` —
> confira no seu `@types/glyvio_core.d.ts`. Telas prontas do Glyvio que já usam tudo isso: a tabela,
> o modal e a tabela lateral de tarefas.

O usuário pode, sem nenhum código no host:

- **esconder** colunas e **mostrar** colunas opcionais;
- **reordenar** as colunas (além de arrastar o cabeçalho, que já existia);
- **ordenar** os dados clicando no cabeçalho (↑ → ↓ → sem ordenação).

Tudo fica salvo por usuário quando a tela tem `state.userConfigKey`; sem ela, vale enquanto a tela
está aberta.

## 1. Personalizar colunas (esconder, mostrar, reordenar)

A base acrescenta o item **"Personalizar colunas"** ao menu ⋮ da app bar e abre o seletor. Quem
escreve a tela só declara as colunas — os campos novos de `TableLayoutColumnDesign` são opcionais:

| Campo           | Efeito                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `label`         | nome no seletor. Sem ele, usa o `value` do `child` quando é um `StringTextDesign`.              |
| `hideable`      | `false` = sempre visível e fora do seletor.                                                     |
| `defaultHidden` | coluna **opcional**: começa escondida e o usuário pode mostrar. É assim que se "adiciona" coluna. |

```typescript
design.columns = [
  new glyvio_core.TableLayoutColumnDesign({
    key: 'code.column',
    columnName: 'code',
    width: 90,
    hideable: false,
    child: new glyvio_core.StringTextDesign({ value: '$T{myplugin_task_code}' }),
  }),
  new glyvio_core.TableLayoutColumnDesign({
    key: 'createdAt.column',
    columnName: 'createdAt',
    width: 130,
    defaultHidden: true,
    child: new glyvio_core.StringTextDesign({ value: '$T{myplugin_task_createdAt}' }),
  }),
];
```

Regras:

- Uma coluna opcional precisa da **célula** em `getDesignForRow` como qualquer outra (mesmo
  `columnName`). A base tira das linhas as células das colunas escondidas.
- Colunas sem rótulo (ex.: a do carrinho e a de opções) ficam fora do seletor e sempre visíveis.
- O item do ⋮ só aparece quando há alguma coluna escondível. No modal e no sidebar ele é acrescentado
  à app bar que **você** monta em `getDesign`; sem `design.appBarDesign`, não há item.
- A ordem escolhida vai para as preferências de coluna (`columnsPreferences`; no modal,
  `mainColumnsPreferences`), as mesmas do arrastar.
- O estado fica em `state.hiddenColumns` / `state.shownColumns` (modal: `mainHiddenColumns` /
  `mainShownColumns`). Não escreva neles: são do usuário.

## 2. Ordenar pelo cabeçalho

A ordenação roda **no servidor**, sobre todo o resultado filtrado (a tabela é paginada). A tela marca
as colunas ordenáveis e traduz cada uma para um ORDER BY:

```typescript
// em getDesign: marque as colunas
new glyvio_core.TableLayoutColumnDesign({
  key: 'name.column',
  columnName: 'name',
  sortable: true,
  child: new glyvio_core.StringTextDesign({ value: '$T{myplugin_task_name}' }),
}),

// na tela: coluna -> ORDER BY
applyColumnSort(
  state: MyTaskTablePageState,
  queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.Task>,
  sort: glyvio_core.TableColumnSort,
): boolean {
  const fields: { [column: string]: glyvio_structure.EntityField } = {
    name: glyvio_structure.AllEntities.task.name,
    createdAt: glyvio_structure.AllEntities.task.createdAt,
    user: glyvio_structure.AllEntities.appUser.name, // campo de join: o join vem do populateQueryBuilder
  };
  const field = fields[sort.column];
  if (!field) {
    return false;
  }
  queryBuilder.addOrderByEntity(field, sort.direction);
  return true;
}
```

A query é montada nesta ordem (o SQL segue a ordem das chamadas de `addOrderBy*`):

1. `populateGroupOrderBy(state, qb)` — a ordem que o agrupamento/árvore precisa;
2. `applyColumnSort(state, qb, sort)` — a coluna do usuário (só quando há ordenação);
3. `populateQueryBuilder(state, qb)` — filtros, joins e a **ordem padrão**, que vira desempate;
4. o `id` do registro, para a paginação não repetir nem pular linhas.

Regras:

- `sort.column` é o `columnName`; `sort.direction` é `'ASC'` ou `'DESC'`. Devolva `false` para uma
  coluna que você não mapeia — os interceptors são consultados em seguida.
- **Agrupamento ou árvore:** coloque a ordem do grupo em `populateGroupOrderBy`, **não** no
  `populateQueryBuilder`. Uma tela agrupada (ou em árvore) que não sobrescreve `populateGroupOrderBy`
  tem a ordenação por coluna **desligada** (os cabeçalhos não ficam clicáveis), porque ordenar antes do
  grupo espalharia as linhas de um grupo entre as páginas.
- Uma ordenação cuja coluna foi escondida, ou deixou de ser `sortable`, é ignorada.
- O estado fica em `state.sort` (modal: `state.mainSort`). Não escreva nele: é do usuário.

```typescript
populateGroupOrderBy(state: MyTaskTablePageState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.Task>): void {
  if (state.filtersSidebar?.groupByStatus) {
    queryBuilder.addOrderByEntity(glyvio_structure.AllEntities.taskTypeStatus.sort, 'ASC');
  }
}
```

## 3. Interceptors

Os interceptors das três telas têm os mesmos dois ganchos, chamados depois dos da tela:

| Gancho                                    | Use                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `populateGroupOrderBy(state, qb)`         | ordem de um agrupamento que o interceptor criou                                 |
| `applyColumnSort(state, qb, sort): boolean` | ORDER BY de uma coluna `sortable` que o interceptor acrescentou; `true` = aplicou |

Para uma coluna nova de interceptor: declare `sortable`/`defaultHidden` no `getDesign` do
interceptor e trate a coluna no `applyColumnSort` dele. A tela é consultada primeiro; o primeiro
`true` encerra.
