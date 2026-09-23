<!-- Generated from src/component_catalog.md by tools/generate.py. Edit the source, not this file. -->
# Glyvio — Catálogo Visual de Componentes (Resumo de Referência)

> **Propósito**: Guia rápido para mapeamento visual de componentes (`glyvio_core.*`).
> Para especificações detalhadas de propriedades, exemplos e classes de cada componente, consulte o catálogo completo em [references/component_catalog_full.md](./references/component_catalog_full.md).

---

## 🗺️ Mapa de Tipos de Telas & Views

| Categoria | Classe Principal | Finalidade | Skill Correspondente |
| :--- | :--- | :--- | :--- |
| **Lista** | `SimpleListPageDesign` | Lista vertical de linhas/cards com busca e filtros | `create-list-page` |
| **Planilha** | `SimpleTablePageDesign` | Tabela tabular densa com scroll horizontal | `create-table-page` |
| **Galeria / Grade** | `SimpleGridPageDesign` | Grade de cards retangulares responsivos | `create-grid-page` |
| **Kanban** | `SimpleKanbanPageDesign` | Colunas de status com drag-and-drop | `create-kanban-page` |
| **Calendário** | `SimpleCalendarPageDesign` | Eventos/agendamentos em visão de calendário | `create-calendar-page` |
| **Gantt** | `SimpleGanttPageDesign` | Cronograma temporal com dependências | `create-gantt-page` |
| **Edição em Massa** | `SimpleBatchPageDesign` | Planilha editável em lote com validação de linha | `create-batch-page` |
| **Formulário Modal** | `FormEntityLayoutDesign` | Modal de criação/edição com campos e validação | `create-edit-modal` |
| **Sidebar de Detalhes**| `SimpleSidebarDesign` | Painel lateral de detalhes e uploads | `create-sidebar` |
| **Sidebar com Abas**| `TabSidebarDesign` | Container lateral de abas | `create-tab-sidebar` |
| **Carrinho Simples**| `SimpleCartDesign` | Drawer de carrinho / seleção temporária | `create-simple-cart` |
| **Carrinho em Lote**| `SimpleBatchCartDesign` | Drawer de carrinho estilo planilha em lote | `create-simple-batch-cart` |
| **Master-Detail** | `SimpleMasterDetailPageDesign` | Lista/árvore à esquerda + painel de detalhe à direita, cada lado com refresh próprio | Sem skill dedicada ainda — ver `component_catalog_full.md §16` |

---

## 🎨 Principais Widgets Atômicos & Containeres

- **Status / Pills**: `ChipDesign` (badge colorido com texto) — *Atenção: evite condicionais Handlebars aninhadas dentro do texto; resolva a cor/label no TypeScript*.
- **Totalizadores / Métricas**: `HorizontalTotalizerBoxDesign` ou `TwoLinesTotalizerBoxDesign`
- **Pessoas / Usuários**: `AvatarDesign` ou `UserGroupDesign`
- **Layouts**: `RowLayoutDesign` (horizontal), `ColumnLayoutDesign` (vertical), `TableLayoutDesign` (grade), `TreeLayoutDesign` (árvore hierárquica retrátil)
- **Vínculos**: `EntityLinksDesign` (seção de links polimórficos, ver `create-entity-links-section`)
- **Gráficos**: `CartesianChartDesign`, `CircularChartDesign`, `FunnelChartDesign`, `PyramidChartDesign`, `RadialChartDesign`, `GaugeChartDesign`, `HeatmapChartDesign`, `RadarChartDesign` (delegar a `glyvio-app-chart`)

> 📖 **Consulte a documentação completa**: Para props específicas, hierarquia de componentes e código de exemplo, consulte [references/component_catalog_full.md](./references/component_catalog_full.md).
