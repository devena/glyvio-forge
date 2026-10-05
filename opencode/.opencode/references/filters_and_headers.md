<!-- Generated from src/references/filters_and_headers.md by tools/generate.py. Edit the source, not this file. -->
# Filtro lateral, linha de filtros e filtros rápidos

> Requer `glyvio_core` v0.9.175+ (`glyvio_core.FilterSidebar`, `Simple*Page`, `SimpleEditPage`,
> `SimpleTableSidebar`). Telas prontas do Glyvio que já seguem o padrão: o kanban de tarefas
> (`/task-kanban`) e a tabela lateral de tarefas (filtros rápidos).

## 1. Filtro lateral das `Simple*Page`

Vale para `SimpleListPage`, `SimpleTablePage`, `SimpleGridPage`, `SimpleKanbanPage`,
`SimpleCalendarPage`, `SimpleDashboardPage` e `SimpleEditPage` (também gantt e mapa usam o
`finalize`).

A base já monta o painel: cabeçalho (`FilterSidebar.header`), busca (`FilterSidebar.search`),
filtros salvos (`FilterSidebar.savedFilters`) e rodapé fixo "Limpar tudo / Salvar filtro /
Aplicar" (`FilterSidebar.footer`). A página só **adiciona os campos**:

```typescript
getDesign(state: MyState, design: glyvio_core.SimpleTablePageDesign): void {
  design.filterSectionsDesign?.push(
    glyvio_core.FilterSidebar.section('filters.dates', '$T{crm_filters_sectionDates}', [
      new glyvio_core.RangeDateTextfieldDesign({
        key: 'filters.startTimeRange.textfield',
        name: 'state.filtersSidebar.startTimeRange',
        label: '$T{crm_filters_startTime}',
      }),
    ]),
    glyvio_core.FilterSidebar.section('filters.display', '$T{crm_filters_sectionDisplay}', [
      new glyvio_core.BooleanTextfieldDesign({
        key: 'filters.showDone.textfield',
        name: 'state.filtersSidebar.showDone',
        label: '$T{crm_filters_showDone}',
      }),
    ]),
  );
}
```

- Campos ligados a `state.filtersSidebar.*`; aplique-os na query (`populateQueryBuilder` ou
  equivalente da página). "Aplicar" dispara o refresh; no `SimpleEditPage` recarregue em
  `refreshState`.
- Regra `FilterSidebar.finalize`: se nenhuma seção de filtro real foi adicionada (cabeçalho,
  rodapé `sticky.bottom*`, app bars e DeveloperSection não contam), o painel e o botão que o abre
  somem sozinhos. Não esconda o botão à mão.
- `FilterSidebar.section(key, title, children)` = grupo com título em OVERLINE, um campo por linha.

## 2. Linha de filtros ativos (`headerDesign`)

Entre a app bar e o conteúdo, a base mostra "Filtros · N", um chip removível por filtro ativo e
os filtros salvos — **quando a página descreve seus filtros**:

```typescript
// Tipo do chip: Simple<Tipo>PageFilterChip (ex.: SimpleKanbanPageFilterChip) = FilterSidebarChip.
getActiveFilterChips(state: MyState): glyvio_core.FilterSidebarChip[] {
  const f = state.filtersSidebar ?? {};
  const chips: glyvio_core.FilterSidebarChip[] = [];
  if (f.showDone) chips.push({ key: 'showDone', label: '$T{crm_filters_chipWithDone}', colorTheme: 'GREEN' });
  if (f.user) chips.push({ key: 'user', label: `$T{crm_filters_chipUser}: ${f.user.name}` });
  return chips;
}

async clearFilter(state: MyState, key: string): Promise<void> {
  if (state.filtersSidebar) delete state.filtersSidebar[key];
}
```

- O chip da busca (`state.text`) é automático. `removable: false` tira o "×".
- Interceptors têm os mesmos hooks: `getActiveFilterChips(state, chips)` (muta a lista) e
  `clearFilter(state, key)`.
- "Limpar tudo" limpa todos os chips removíveis; sem `getActiveFilterChips`, volta ao
  `initialFilter` da rota.
- `headerDesign` também pode ser definido pela página (qualquer widget); a base só preenche se
  estiver vazio.

## 3. Filtros rápidos e contagem em `SimpleTableSidebar`

```typescript
getQuickFilters(_state: MyState): glyvio_core.SimpleTableSidebarQuickFilter[] | undefined {
  return [
    { key: 'all', label: '$T{crm_quick_all}' },
    { key: 'open', label: '$T{crm_quick_open}' },
    { key: 'late', label: '$T{crm_quick_late}' },
  ];
}

populateQueryBuilder(state: MyState, qb: glyvio_core.QueryBuilder<glyvio_entity.Task>): void {
  if (state.quickFilter == 'open') qb.addFilterOperator(glyvio_structure.AllEntities.task.done, false);
}
```

- Vira um `SegmentedControlDesign` ao lado da busca (key `main.quickFilter.segmented`); o
  primeiro item é o padrão; a escolha fica em `state.quickFilter`.
- `state.totalCount` é calculado pela base e vira o subtítulo da app bar
  (`$T{core_tableSidebar_count count=state.totalCount}`) quando a página não definiu outro.
