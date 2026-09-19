# Glyvio — Catálogo Visual de Componentes (Resumo de Referência)

> **Propósito**: Guia rápido para mapeamento visual de componentes (`glyvio_core.*`).
> Para especificações detalhadas de propriedades, exemplos e classes de cada componente, leia o catálogo completo em [`references/component_catalog_full.md`](./references/component_catalog_full.md).

---

## 🗺️ Mapa de Tipos de Telas & Views

| Categoria | Classe Principal | Finalidade | Skill Correspondente |
| :--- | :--- | :--- | :--- |
| **Lista** | `SimpleListPageDesign` | Lista vertical de linhas/cards com busca e filtros | `create-list-page` |
| **Planilha** | `SimpleTablePageDesign` | Tabela tabular densa com scroll horizontal | `create-table-page` |
| **Galeria / Grade** | `SimpleGridPageDesign` | Grade de cards retangulares responsivos | `create-grid-page` |
| **Kanban** | `SimpleKanbanPageDesign` | Colunas de status com drag-and-drop | `create-kanban-page` |
| **Calendário** | `SimpleCalendarPageDesign` | Eventos/agendamentos em visão de calendário | `create-calendar-page` |
| **Edição em Massa** | `SimpleBatchPageDesign` | Planilha editável em lote com validação de linha | `create-batch-page` |
| **Formulário Modal** | `FormEntityLayoutDesign` | Modal de criação/edição com campos e validação | `create-edit-modal` |
| **Sidebar de Detalhes**| `SimpleSidebarDesign` | Painel lateral de detalhes e uploads | `create-sidebar` |
| **Master-Detail** | `SimpleMasterDetailPageDesign` | Lista/árvore à esquerda + painel de detalhe à direita, cada lado com refresh próprio | Sem skill dedicada ainda — ver `component_catalog_full.md §16` |

---

## 🎨 Principais Widgets Atômicos & Containeres

- **Status / Pills**: `ChipDesign` (badge colorido com texto)
- **Totalizadores / Métricas**: `HorizontalTotalizerBoxDesign` ou `TwoLinesTotalizerBoxDesign`
- **Pessoas / Usuários**: `AvatarDesign` ou `UserGroupDesign`
- **Layouts**: `RowLayoutDesign` (horizontal), `ColumnLayoutDesign` (vertical), `TableLayoutDesign` (grade)
- **Gráficos**: `CartesianChartDesign`, `CircularChartDesign`, `FunnelChartDesign`, `PyramidChartDesign`, `RadialChartDesign`, `GaugeChartDesign`, `HeatmapChartDesign`, `RadarChartDesign` (delegar a `glyvio-app-chart`)

> 📖 **Consulte a documentação completa**: Para props específicas, hierarquia de componentes e código de exemplo, leia [`references/component_catalog_full.md`](./references/component_catalog_full.md).
