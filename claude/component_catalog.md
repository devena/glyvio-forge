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
| **Assistente em passos** | `SimpleWizardModal` + `StepperDesign` | Modal com stepper, Voltar/Avançar e validação por passo (cadastro guiado, importação) | `create-wizard-modal` (genérico) / `create-import-wizard` (importação de planilha) |
| **Master-Detail** | `SimpleMasterDetailPageDesign` | Lista/árvore à esquerda + painel de detalhe à direita, cada lado com refresh próprio | `create-master-detail-page` (+ `create-side-panel`) |
| **Dashboard (no app)** | `SimpleDashboardPageDesign` | Seções de células (KPI, gráfico, tabela) carregadas por chave | `create-dashboard-page` |
| **Mapa** | `SimpleMapPageDesign` | Pins por latitude/longitude, carregados pela área visível | `create-map-page` |
| **Formulário em tela cheia** | `SimpleEditPageDesign` | Formulário longo/configurações, seções ou abas | `create-edit-page` |
| **Fluxo / Processo** | `SimpleWorkflowPageDesign` | Grafo de etapas com links rotulados e "+ etapa" | `create-workflow-page` |
| **Sidebar com tabela** | `SimpleTableSidebarDesign` | Registros relacionados com busca, filtros rápidos e grupos | `create-table-sidebar` |
| **Painel embutido** | `SimpleSidePanelDesign` + `SidePanelReferenceDesign` | Painel independente dentro de cart, modal ou master-detail | `create-side-panel` |
| **Diálogos prontos** | `SimpleChoiceModalRoute`, `*TextfieldModalRoute`, `showConfirmation*` | Escolher opção, digitar um valor, confirmar, progresso | `use-builtin-dialogs` |
| **Ação rápida (menu)** | `menuRegistryService.addAction` | Item `ACTION` do menu/favoritos/Ctrl+K/Jeannie que executa código | `create-quick-action` |

---

## 🧱 Padrão Visual Moderno (use em telas novas)

- **Blocos prontos**: `glyvio_core.ui` — `page`, `card`, `grid`, `row`/`column`/`grow`, `stat` (KPI), `listRow`/`list`, `badge`, `iconTile`, `banner`, `option`, `field`/`fields`, `button`.
- **Layouts modernos**: `SurfaceDesign` (card/painel/tile, `surface: 'card'|'muted'|'inverse'|'<COR>'`), `StackLayoutDesign` + `StackItemDesign` (gap constante, `flex`), `GridLayoutDesign` + `GridItemDesign` (12 colunas, responsivo pela largura do próprio grid).
- **Filtro lateral / linha de filtros**: `FilterSidebar.section(...)` em `filterSectionsDesign` + `getActiveFilterChips`/`clearFilter`; filtros rápidos em `SimpleTableSidebar.getQuickFilters`.
- **Abas / passos / escolhas**: `SegmentedControlDesign` (`variant: 'underline'|'pill'`, `actionKeyOnSelect`).
- Guias: [modern_layout.md](./references/modern_layout.md), [filters_and_headers.md](./references/filters_and_headers.md), [i18n.md](./references/i18n.md).

## 🎨 Principais Widgets Atômicos & Containeres

- **Status / Pills**: `BadgeCellDesign` (`ui.badge`, `variant: 'subtle'`, `dot`, `icon`) para status de leitura; `ChipDesign` (badge colorido com texto, `onTap`/`onTapDelete`) para chips interativos — *Atenção: evite condicionais Handlebars aninhadas dentro do texto; resolva a cor/label no TypeScript*.
- **Totalizadores / Métricas**: `HorizontalTotalizerBoxDesign` ou `TwoLinesTotalizerBoxDesign`
- **Pessoas / Usuários**: `AvatarDesign` ou `UserGroupDesign`
- **Layouts**: `RowLayoutDesign` (horizontal), `ColumnLayoutDesign` (vertical), `TableLayoutDesign` (grade), `TreeLayoutDesign` (árvore hierárquica retrátil)
- **Vínculos**: `EntityLinksDesign` (seção de links polimórficos, ver `create-entity-links-section`)
- **Gráficos**: `CartesianChartDesign`, `CircularChartDesign`, `FunnelChartDesign`, `PyramidChartDesign`, `RadialChartDesign`, `GaugeChartDesign`, `HeatmapChartDesign`, `RadarChartDesign` (delegar a `glyvio-app-chart`)

> 📖 **Consulte a documentação completa**: Para props específicas, hierarquia de componentes e código de exemplo, consulte [references/component_catalog_full.md](./references/component_catalog_full.md).
