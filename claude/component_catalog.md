# Glyvio — Catálogo Visual de Componentes (Design Library)

> **Propósito**: dar ao agente de criação de tela o conhecimento de **como cada
> componente aparece** e **quando usá-lo**, para mapear elementos visuais de um
> print (screenshot) para as classes de design corretas do framework
> (`glyvio_core.*`).
>
> Este catálogo é o complemento visual do JSDoc — o JSDoc descreve a **API**
> (props, tipos); aqui está o **significado visual** ("parece com" / "use
> quando").

---

## Como usar este catálogo (matching print → componente)

1. **Decomponha o print top-down**: tipo de página → app bar → regiões de layout
   → unidades repetidas (células/cards) → widgets atômicos (texto, chip, avatar,
   ícone).
2. Para cada elemento visual recortado, encontre na tabela a linha cujo
   **"Parece com"** bate com o que você vê. Use o **"Use quando"** para
   desambiguar entre opções parecidas.
3. Prefira sempre o componente **mais específico** que existe (ex.: `ChipDesign`
   em vez de um `BoxDesign` colorido feito à mão; `HorizontalTotalizerBoxDesign`
   em vez de montar um totalizador com `RowLayoutDesign` + textos).
4. **Layouts** organizam o espaço; **boxes/texts/cells** preenchem. Toda tela é
   uma árvore:
   `Page → Section → Layout → (Layout | Box | Text | Cell | Textfield)`.
5. Use **apenas** componentes que existam em `@types` / `dist/bundle.d.ts`. Este
   catálogo lista o que está exportado em `plugin/app/src/designs/designs.ts`,
   mas **confirme no `@types`** antes de instanciar — nunca invente uma classe.

> ⚠️ **Imagens de referência**: cada seção tem um marcador `![ref](...)`
> apontando para uma thumbnail do componente. Essas imagens **ainda precisam ser
> geradas/capturadas** (ver "Pendência: imagens de referência" no fim). Enquanto
> não existirem, use as descrições textuais.

### Convenções comuns de props (valem para quase todos)

- **`colorTheme`**: tema de cor semântico —
  `'BLUE' | 'BROWN' | 'CORAL' | 'CYAN' | 'EMERALD' | 'GREEN' | 'GREY' | 'INDIGO' | 'LIGHT_GREY' | 'LIME' | 'MAGENTA' | 'ORANGE' | 'PINK' | 'PURPLE' | 'RED' | 'REGULAR' | 'ROSE' | 'SKY' | 'TEAL' | 'VIOLET' | 'WHITE' | 'YELLOW'`.
  Use para mapear a cor dominante do elemento no print. **Lista completa,
  variantes (`_ONLY_BORDER`, `_PRIMARY`) e temas especiais**: ver
  [§ Temas de cor (`colorTheme`)](#temas-de-cor-colortheme) no fim.
- **`padding`**: `'8'` (tudo), `'8 8'` (horizontal vertical), `'8 8 8 8'` (left
  top right bottom).
- **`width` / `height`**: número (px) ou string (ex. `'100%'`).
- **`visible`**: `boolean` ou expressão string (visibilidade condicional).
- **`style`** (textos/labels): escala tipográfica Material — `DISPLAY_*`,
  `HEADLINE_*`, `TITLE_*`, `BODY_*`, `LABEL_*` (LARGE/MEDIUM/SMALL). Mapeie pelo
  **tamanho/peso** do texto no print.

---

## 1. Páginas (telas inteiras) — `pages/`

A escolha da página define o esqueleto da tela. Identifique o **padrão
dominante** do print.

| Componente                                         | Parece com                                                                   | Use quando                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `SimpleListPageDesign`                             | Lista vertical de linhas/cards, busca no topo, sidebar de filtros à esquerda | Listagem de registros em linhas (1 item por linha). **Skill: `create-list-page`** |
| `SimpleTablePageDesign`                            | Planilha: colunas com cabeçalho, linhas densas, scroll horizontal            | Dados tabulares com muitas colunas comparáveis. **Skill: `create-table-page`**    |
| `SimpleGridPageDesign`                             | Grade/galeria de cards retangulares lado a lado                              | Cards visuais em grade responsiva. **Skill: `create-grid-page`**                  |
| `SimpleKanbanPageDesign` (+ `...ColumnDesign`)     | Colunas verticais por status, cards arrastáveis                              | Fluxo por etapas/status com drag-and-drop. **Skill: `create-kanban-page`**        |
| `SimpleCalendarPageDesign`                         | Calendário (mês/semana) com eventos                                          | Agendamentos/eventos por data. **Skill: `create-calendar-page`**                  |
| `SimpleBatchPageDesign`                            | Planilha editável em massa, com upload e validação por linha                 | Edição em lote tipo spreadsheet. **Skill: `create-batch-page`**                   |
| `SimpleDashboardPageDesign` (+ `...SectionDesign`) | Painel com KPIs, gráficos e blocos em grade                                  | Dashboard / visão analítica.                                                      |

> ⚠️ **Regra obrigatória para dashboards — um key por unidade visual.** Cada
> card, KPI, gráfico ou grupo lógico independente **deve ser um key separado**
> em `childrenKeys`. O grid do `SimpleDashboardPageSectionDesign` gerencia o
> layout via `rows`/`columns` de cada `DashboardLayoutFieldDesign` retornado em
> `getDesignForCell`. **Nunca** agrupe múltiplos itens dentro de um único cell
> usando `RowLayoutDesign` ou `ColumnLayoutDesign` — isso bypassa o sistema de
> grid e impede reordenação, configuração por usuário e responsividade.
>
> **Exemplo correto:**
>
> ```typescript
> // getDesign
> childrenKeys: ['kpiA', 'kpiB', 'kpiC', 'chartVendas', 'chartNivel']
>
> // getDesignForCell
> if (key === 'kpiA') return new DashboardLayoutFieldDesign({ rows: 2, columns: 3, child: ... });
> if (key === 'kpiB') return new DashboardLayoutFieldDesign({ rows: 2, columns: 3, child: ... });
> ```
>
> **Exemplo errado** (não fazer):
>
> ```typescript
> childrenKeys: ['todosOsKpis']; // ← ERRADO: agrupa tudo num único cell
> // getDesignForCell
> if (key === 'todosOsKpis') {
>   return new DashboardLayoutFieldDesign({
>     child: new RowLayoutDesign({ children: [kpiA, kpiB, kpiC] }), // ← ERRADO
>   });
> }
> ```

> 📐 **Referência de `rows` e `columns` por tipo de célula** — use estes valores
> como ponto de partida. Prefira o menor valor que ainda acomoda o conteúdo;
> nunca use valores maiores que o necessário. `columns` é relativo ao
> `columnSize` da seção — ajuste para que a soma dos `columns` da linha totalize
> ~12 cada coluna com o tamanho de 60.
>
> | Tipo de célula                                 | `rows` | `columns` | Notas                                                                                     |
> | ---------------------------------------------- | ------ | --------- | ----------------------------------------------------------------------------------------- |
> | KPI simples (label + valor + tendência)        | **2**  | **6**     | 4 KPIs por linha com `columnSize:75`; 5 KPIs com `columnSize:60`. Nunca mais de `rows:2`. |
> | Card com 2 KPIs inline + progress bars (≤ 4)   | **2**  | **6**     | Meia largura. Sobe para `rows:4` só com 5+ itens empilhados.                              |
> | Gráfico cartesiano (`CartesianChartDesign`)    | **3**  | **6–8**   | `rows:4` apenas se o card tem header + rodapé com métricas extras.                        |
> | Gráfico circular/donut (`CircularChartDesign`) | **3**  | **4–6**   | `rows:4` só com legenda vertical longa (5+ itens). Emparelha bem com `cols:7` cartesiano. |
> | Progress bars + legenda (≤ 4 itens)            | **3**  | **4–6**   | Complemento de donut na mesma linha.                                                      |
> | Tabela com ≤ 5 linhas de dados                 | **3**  | **6**     | Meia largura. Use `cols:12` apenas se a tabela tem 7+ colunas.                            |
> | Tabela com 6–10 linhas / 7+ colunas            | **4**  | **12**    | Largura total. `rows:5` somente para tabelas muito densas (10+ linhas).                   |
>
> **Espaçamento interno (`padding`) entre filhos de um cell:**
> Use `padding: '8 0 0 0'` (top=8) em cada `ColumnLayoutFieldDesign` filho para
> separar os elementos dentro do card. Não use valores maiores — isso evita células
> com muito espaço vazio. Exemplo:
>
> ```typescript
> new glyvio_core.ColumnLayoutFieldDesign({ padding: '8 0 0 0', child: ... }),
> new glyvio_core.ColumnLayoutFieldDesign({ padding: '8 0 0 0', child: ... }),
> ```

| `SimpleEditPageDesign` | Formulário de página inteira (não modal) | Edição de
entidade em tela cheia. | | `SimpleMapPageDesign` | Mapa com pins | Dados
geolocalizados. | | `TimelinePageDesign` | Linha do tempo vertical de
eventos/mensagens | Histórico/feed cronológico. | | `ChatListPageDesign` | Lista
de conversas estilo mensageiro | Tela de chat/inbox. |

---

## 2. App Bars (barra de topo) — `app_bars/`

| Componente            | Parece com                                               | Use quando                                                                                    |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `SimpleAppBarDesign`  | Barra de topo com título + botões de ação à direita      | Caso padrão de cabeçalho de página. Use `appBar.title` e `appBar.putButtonOn(button, index)`. |
| `LeadingAppBarDesign` | App bar com elemento "leading" (voltar/ícone) à esquerda | Quando há navegação de retorno ou ícone líder.                                                |
| `AppBarDesign`        | Base genérica de app bar                                 | Base — prefira as concretas acima.                                                            |

---

## 3. Layouts (organização do espaço) — `layouts/`

Layouts não têm aparência própria; eles **arranjam** filhos. Escolha pela
**direção e quebra**.

| Componente                                                                  | Parece com                                                        | Use quando                                                                                                                             | Props-chave                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RowLayoutDesign` (+ `RowLayoutFieldDesign`)                                | Itens lado a lado (horizontal)                                    | Elementos em linha. Use `RowLayoutFieldDesign({ isExpanded: true })` para o item que estica.                                           | `children`, `mainAlignment`, `crossAlignment`, `padding`                                                                                                                                                                                                                                                                                                                     |
| `ColumnLayoutDesign` (+ `ColumnLayoutFieldDesign`)                          | Itens empilhados (vertical)                                       | Elementos em coluna.                                                                                                                   | `children`, `mainAlignment`, `crossAlignment`                                                                                                                                                                                                                                                                                                                                |
| `WrapLayoutDesign` (+ `WrapLayoutFieldDesign`)                              | Itens que quebram para a próxima linha (como tags/chips fluindo)  | Conjunto de chips/cards que devem quebrar conforme a largura.                                                                          | `children`, `columnSpace`, `rowSpace`                                                                                                                                                                                                                                                                                                                                        |
| `ResponsiveLayoutDesign`                                                    | Layout diferente em tela pequena vs. grande                       | Conteúdo que muda entre mobile/desktop.                                                                                                | `childSmall`, `childLarge`, `minimumLargeWidth`                                                                                                                                                                                                                                                                                                                              |
| `TableLayoutDesign` (`...ColumnDesign`, `...RowDesign`, `...CellDesign`)    | Grade tipo tabela (linhas × colunas) dentro de um card/seção      | Dados tabulares **dentro** de outro container (não a página-tabela inteira). Contraparte _layout_ (aninhável) do `TableSectionDesign`. | `columns` (`TableLayoutColumnDesign`: `columnName`, `width` `SMALL`/`MEDIUM`/`LARGE`/px/%, `child`), `rows` (`TableLayoutRowDesign`: `cells` `TableLayoutCellDesign`, `height`, `onTapAction`, `visible`), `rowHeight`, `frozenColumnsCount` (máx. 1 recomendado), `colorTheme`, `interopDesign` (`rowDesign`+`stateName` para gerar linhas a partir de uma lista de estado) |
| `FormLayoutDesign` (+ `FormLayoutFieldDesign`, `FormLayoutEndOfLineDesign`) | Formulário em grade de campos que se ajusta por largura de coluna | Conjunto de campos de formulário.                                                                                                      | `columnSize`, `children`                                                                                                                                                                                                                                                                                                                                                     |
| `FormEntityLayoutDesign`                                                    | Formulário focado nos campos de uma entidade                      | Form gerado a partir de uma entidade.                                                                                                  | —                                                                                                                                                                                                                                                                                                                                                                            |
| `DashboardLayoutDesign` (+ `...FieldDesign`)                                | Grade de blocos de dashboard                                      | Arranjo de KPIs/gráficos num dashboard.                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                            |

> **Alinhamento**: `mainAlignment` = eixo principal
> (START/CENTER/END/SPACE_BETWEEN…), `crossAlignment` = eixo cruzado
> (START/CENTER/END/STRETCH). Mapeie pela posição/espaçamento no print.

---

## 4. Seções (blocos de uma página/sidebar) — `sections/`

| Componente                     | Parece com                                                     | Use quando                                                              |
| ------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `FormSectionDesign`            | Bloco de formulário (geralmente com `FormLayoutDesign` dentro) | Agrupar campos de filtro/edição. Muito usado em `filterSectionsDesign`. |
| `AccordionSectionDesign`       | Seção colapsável com cabeçalho clicável (expand/collapse)      | Conteúdo agrupado que abre/fecha.                                       |
| `AlertSectionDesign`           | Faixa de aviso/alerta colorida                                 | Mensagem destacada (sucesso/erro/info) em largura de seção.             |
| `AppBarSectionDesign`          | App bar embutida como seção                                    | Cabeçalho dentro de uma composição.                                     |
| `AttachmentsViewSectionDesign` | Galeria/lista de anexos                                        | Exibir arquivos anexados.                                               |
| `FillRemainingSectionDesign`   | Bloco que ocupa todo o espaço vertical restante                | Empurrar conteúdo / preencher sobra.                                    |
| `GridSectionDesign`            | Seção que renderiza itens em grade                             | Grade de cards dentro de uma página composta.                           |
| `ListSectionDesign`            | Seção que renderiza itens em lista                             | Lista dentro de uma página composta.                                    |
| `TableSectionDesign`           | Seção que renderiza uma tabela                                 | Tabela dentro de uma página composta.                                   |
| `RuleSectionDesign`            | Bloco condicional por regra                                    | Conteúdo que aparece conforme regra.                                    |
| `SectionDesign`                | Base genérica de seção                                         | Base — prefira concretas.                                               |

---

## 5. Boxes (blocos atômicos com fundo/forma) — `boxes/`

| Componente                     | Parece com                                              | Use quando                                            | Props-chave                                               |
| ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| `BoxDesign`                    | Retângulo/container com cor, padding, borda, clicável   | Container genérico estilizado. Base de muitos outros. | `colorTheme`, `padding`, `borderRadius`, `child`, `onTap` |
| `SizedBoxDesign`               | Box com largura/altura fixas (ou espaçador vazio)       | Forçar dimensão ou criar espaço.                      | `width`, `height`, `child`                                |
| `ChipDesign`                   | Etiqueta pequena arredondada com fundo colorido + texto | Status, tag, badge curto.                             | `label`, `colorTheme`, `style`, `onTap`                   |
| `TagsDesign`                   | Conjunto de tags editáveis de uma entidade              | Campo de tags ligado a entidade.                      | `name`, `entityId`, `actionKeyChangeTags`                 |
| `DotDesign`                    | Pequeno círculo colorido (bolinha de status)            | Indicador de status compacto.                         | `colorTheme`, `size`                                      |
| `AvatarDesign`                 | Círculo com iniciais ou foto de pessoa                  | Avatar de usuário/contato.                            | `text`, `size`, `colorTheme`                              |
| `UserGroupDesign`              | Pilha de avatares sobrepostos                           | Grupo de usuários/responsáveis.                       | `name`, `entityId`                                        |
| `DividerDesign`                | Linha fina separadora                                   | Separar seções/itens.                                 | `colorTheme`                                              |
| `AlertBoxDesign`               | Caixa de alerta com título e subtítulo, colorida        | Aviso destacado compacto.                             | `title`, `subtitle`, `colorTheme`, `width`                |
| `ImageBoxDesign`               | Imagem (por URL) com ajuste contain/cover               | Mostrar imagem de URL.                                | `url`, `width`, `height`, `fit`, `onTap`                  |
| `AttachmentBoxDesign`          | Imagem/preview de um anexo                              | Mostrar anexo por id.                                 | `attachmentId`, `fit`, `width`, `height`                  |
| `GalleryItemDesign`            | Item de galeria (thumbnail + label sobreposto)          | Grade de fotos/anexos.                                | `attachmentId`, `labelDesign`, `align`                    |
| `QRCodeDesign`                 | QR code quadrado                                        | Exibir um QR code.                                    | `width`, `height`, `colorTheme`                           |
| `HorizontalTotalizerBoxDesign` | Linha "Label: Valor" lado a lado (totalizador)          | Totalizador compacto inline.                          | `label`, `value`, `colorTheme`                            |
| `TwoLinesTotalizerBoxDesign`   | Cartão com label em cima e valor grande embaixo         | KPI/totalizador em duas linhas.                       | `label`, `value`, `colorTheme`, `width`                   |
| `EntityLinksDesign`            | Lista de links/chips para entidades relacionadas        | Mostrar/remover vínculos a entidades.                 | `links`, `actionKeyRemoveLink`                            |
| `ObserversDesign`              | Avatares de observadores/seguidores                     | Lista de observadores de um registro.                 | `name`, `entityId`                                        |
| `NotFoundBoxDesign`            | Estado vazio ("nada encontrado") com ícone/texto        | Empty state.                                          | —                                                         |

---

## 6. Cells (unidades repetidas de lista/grade) — `cells/`

São o "molde" de **cada item** numa lista/grade/tabela. O `getDesignForCell`
retorna uma destas.

| Componente                                            | Parece com                                               | Use quando                                                               |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CardCellDesign`                                      | Card retangular com sombra/fundo, conteúdo livre dentro  | Item de grade/lista em formato de cartão. (Usado no `create-grid-page`.) |
| `TitleCardCellDesign`                                 | Card com título proeminente                              | Card cujo foco é um título.                                              |
| `LineCellDesign`                                      | Linha de lista (uma linha por item, conteúdo horizontal) | Item de `SimpleListPage` em linha.                                       |
| `BarCellDesign`                                       | Barra horizontal compacta                                | Item denso tipo barra.                                                   |
| `EntityCardCellDesign` / `EntityCardCellIconDesign`   | Card padrão de uma entidade (com ícone)                  | Card pré-montado a partir de entidade.                                   |
| `EntityBarCellDesign` / `EntityBarGridCellIconDesign` | Barra/linha padrão de entidade (com ícone)               | Linha pré-montada a partir de entidade.                                  |
| `DashboardCellDesign`                                 | Bloco de dashboard (KPI/indicador)                       | Célula dentro de dashboard.                                              |
| `SimpleCalendarCellDesign`                            | Evento no calendário                                     | Render de evento numa página de calendário.                              |
| `SimpleMapCellDesign`                                 | Pin/card no mapa                                         | Item geolocalizado.                                                      |
| `TimelineCellDesign` / `TimelineMessageCellDesign`    | Item de linha do tempo / mensagem                        | Evento ou mensagem num feed cronológico.                                 |
| `ChatWhatsappCellDesign` / `ChatJeannieCellDesign`    | Balão de mensagem de chat                                | Mensagem em tela de chat.                                                |
| `CellDesign`                                          | Base genérica de célula                                  | Base — prefira concretas.                                                |

---

## 7. Textos e Labels — `texts/`, `textlabels/`

**Diferença**: `texts/*` = texto puro exibido; `textlabels/*` = par "rótulo +
valor" (label à esquerda/acima, valor formatado), geralmente em telas de
detalhe/leitura.

| Componente                | Parece com                     | Use quando                         | Props-chave                                           |
| ------------------------- | ------------------------------ | ---------------------------------- | ----------------------------------------------------- |
| `StringTextDesign`        | Texto simples                  | Exibir uma string.                 | `value`, `style`, `colorTheme`, `maxLines`, `padding` |
| `LabelTextDesign`         | Texto com aparência de rótulo  | Rótulo curto.                      | `value`, `style`, `maxLines`                          |
| `MarkdownTextDesign`      | Texto com formatação markdown  | Conteúdo rico (negrito, listas).   | `value`, `padding`                                    |
| `TimeRelativeTextDesign`  | "há 3 horas", "ontem"          | Datas relativas que se atualizam.  | `name`, `padding`                                     |
| `TextDesign`              | Base de texto (estilo/cor)     | Base — prefira `StringTextDesign`. | `style`, `colorTheme`                                 |
| `StringTextLabelDesign`   | "Rótulo: valor" (valor string) | Campo de leitura rótulo+valor.     | `label`, `value`, `suffixAction`                      |
| `MarkdownTextLabelDesign` | Rótulo + valor em markdown     | Valor rico em leitura.             | `label`, `value`, `suffixAction`                      |
| `TextLabelDesign`         | Base rótulo+valor (cor/estilo) | Base — prefira concretas.          | `label`, `colorTheme`, `style`                        |

---

## 8. Textfields (campos de entrada/edição) — `textfields/`

Para **formulários/filtros**. Mapeie pelo **tipo do dado** e pela aparência do
controle.

> 🔴 **Regra inegociável (FK/entidade)**: qualquer campo que referencia outra
> entidade (`ENTITY`, ou FK terminando em `_id` / `_ic`) **deve** usar a
> **subclasse específica** de `EntityAutocompleteSingleTextfieldDesign` (nunca a
> base, nunca `StringTextfieldDesign`). Ver regra no coordinator agent.

| Componente                                                              | Parece com                                        | Use quando                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `StringTextfieldDesign`                                                 | Campo de texto de 1 linha                         | String primitiva (sem ser FK).                          |
| `IntegerTextfieldDesign`                                                | Campo numérico inteiro                            | Inteiro.                                                |
| `DecimalTextfieldDesign`                                                | Campo numérico decimal                            | Valor com casas decimais/moeda.                         |
| `BooleanTextfieldDesign`                                                | Checkbox / switch                                 | Sim/Não, ativar/desativar.                              |
| `DateTextfieldDesign`                                                   | Seletor de data                                   | Data.                                                   |
| `DateTimeTextfieldDesign`                                               | Seletor de data + hora                            | Data e hora.                                            |
| `RangeDateTextfieldDesign`                                              | Intervalo de datas (de–até)                       | Filtro por período.                                     |
| `RangeDateTimeTextfieldDesign`                                          | Intervalo de data/hora                            | Filtro por período com hora.                            |
| `RangeNumberTextfieldDesign`                                            | Intervalo numérico (min–max)                      | Filtro por faixa de valor.                              |
| `ChoiceSingleTextfieldDesign` (+ `ChoiceSingleTextfieldOption`)         | Dropdown/seletor de uma opção fixa                | Escolha única entre opções fixas (não-entidade).        |
| `ChoiceMultipleTextfieldDesign`                                         | Multi-seleção de opções fixas                     | Várias opções fixas.                                    |
| `EntitySelectTextfieldDesign`                                           | Seletor (dropdown) de entidade                    | Selecionar entidade de lista curta.                     |
| `EntityAutocompleteSingleTextfieldDesign`                               | Autocomplete de 1 entidade (com chip)             | **FK/entidade única** — use a **subclasse específica**. |
| `EntityAutocompleteMultipleTextfieldDesign`                             | Autocomplete de várias entidades (chips)          | Várias entidades relacionadas.                          |
| `AttachmentSingleTextfieldDesign` / `AttachmentMultipleTextfieldDesign` | Área de upload de arquivo(s)                      | Upload de anexos.                                       |
| `MarkdownTextfieldDesign`                                               | Editor markdown                                   | Texto rico editável.                                    |
| `HtmlTextfieldDesign`                                                   | Editor HTML/rich text                             | Conteúdo HTML editável.                                 |
| `MentionsTextfieldDesign` (+ `MentionsTextfieldOption`)                 | Campo com @menções                                | Comentários com menção a usuários.                      |
| `TextFieldDesign`                                                       | Base de campo (helpers `isRequired`, `errorText`) | Base — prefira concretas.                               |

---

## 9. Botões — `buttons/`

| Componente                                     | Parece com                                                     | Use quando                                                       |
| ---------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `ActionButtonDesign`                           | Botão de ícone/ação (primário/secundário) na app bar ou inline | Disparar uma `Action`. Tipos: `PRIMARY`/`SECONDARY`; `iconName`. |
| `ButtonDesign`                                 | Botão padrão com texto                                         | Ação rotulada.                                                   |
| `OptionsButtonDesign` (+ `OptionActionDesign`) | Botão "⋮"/menu com lista de opções                             | Menu de ações (kebab/overflow).                                  |
| `CartButtonDesign`                             | Botão de carrinho com contador                                 | Abrir/atualizar carrinho.                                        |
| `AudioRecorderButtonDesign`                    | Botão de gravar áudio (microfone)                              | Gravação de áudio.                                               |
| `PresenceButtonDesign`                         | Botão de presença/check-in                                     | Marcar presença.                                                 |

---

## 10. Ícones — `icons/`

| Componente         | Parece com    | Use quando                                                  |
| ------------------ | ------------- | ----------------------------------------------------------- |
| `SimpleIconDesign` | Um ícone      | Exibir ícone (`iconName`, ex. `sax_linear_add`, `fa_grip`). |
| `IconDesign`       | Base de ícone | Base — prefira `SimpleIconDesign`.                          |

> **Nomes de ícone**: famílias `sax_*` (Iconsax) e `fa_*` (FontAwesome). Mapeie
> pelo desenho no print.

---

## 11. KPIs — `kpis/`

| Componente        | Parece com                             | Use quando                     |
| ----------------- | -------------------------------------- | ------------------------------ |
| `TextKpiDesign`   | Número grande + rótulo (indicador)     | KPI textual (total, contagem). |
| `GaugueKpiDesign` | Medidor/gauge circular ou semicircular | KPI de proporção/meta.         |
| `KpiDesign`       | Base de KPI                            | Base — prefira concretas.      |

---

## 12. Gráficos (charts) — `charts/`

| Componente                                                                                | Parece com                                 | Use quando                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `CartesianChartDesign` (+ `...SectionDesign`, `CartesianChartDataType`, `...SectionType`) | Gráfico de eixos X/Y: barras, linhas, área | Séries temporais/comparações em eixos. |
| `CircularChartDesign` (+ `...SectionDesign`, `CircularChartDataType`, `...SectionType`)   | Pizza / rosca (donut)                      | Composição percentual.                 |
| `FunnelChartDesign` (+ `...SectionDesign`, `FunnelChartDataType`)                         | Funil (etapas decrescentes)                | Conversão por etapa.                   |
| `PyramidChartDesign` (+ `...SectionDesign`, `PyramidChartDataType`)                       | Pirâmide                                   | Hierarquia/proporção em camadas.       |
| `ChartDesign`                                                                             | Base de gráfico                            | Base — prefira concretas.              |

---

## 13. Modais — `modals/`

| Componente                                                   | Parece com                                                  | Use quando                 | Skill                 |
| ------------------------------------------------------------ | ----------------------------------------------------------- | -------------------------- | --------------------- |
| `SimpleEditModalDesign`                                      | Overlay com formulário de criar/editar                      | Form de entidade em modal. | `create-edit-modal`   |
| `SimpleEntityModalDesign`                                    | Overlay de busca/seleção de entidade (autocomplete + chips) | Selecionar entidade.       | `create-entity-modal` |
| `SimpleListModalDesign` (+ `SimpleListSidebarModalDesign`)   | Overlay de lista com filtros                                | Selecionar de uma lista.   | `create-list-modal`   |
| `SimpleTableModalDesign` (+ `SimpleTableSidebarModalDesign`) | Overlay de tabela com ações de linha                        | Selecionar de uma tabela.  | `create-table-modal`  |
| `SimpleSendModalDesign`                                      | Overlay de envio (email/WhatsApp, anexos)                   | Enviar mensagem/relatório. | `create-send-modal`   |
| `ModalDesign` / `NativeModalDesign`                          | Base de modal                                               | Base — prefira concretas.  | —                     |

---

## 14. Sidebars & Carts — `sidebars/`, `carts/`

| Componente                        | Parece com                                              | Use quando                     | Skill                |
| --------------------------------- | ------------------------------------------------------- | ------------------------------ | -------------------- |
| `SimpleSidebarDesign`             | Painel lateral de detalhes/config (com drop de arquivo) | Detalhe/edição lateral.        | `create-sidebar`     |
| `TabSidebarDesign`                | Painel lateral com abas                                 | Sidebar com sub-rotas em abas. | `create-tab-sidebar` |
| `SimpleTableSidebarDesign`        | Sidebar de filtros de tabela                            | Filtros laterais de tabela.    | —                    |
| `TimelineSidebarDesign`           | Sidebar de linha do tempo                               | Histórico lateral.             | —                    |
| `SidebarDesign`                   | Base de sidebar                                         | Base — prefira concretas.      | —                    |
| `SimpleCartDesign`                | Drawer de carrinho de itens                             | Seleção temporária de itens.   | `create-simple-cart` |
| `SimpleBatchCartDesign`           | Carrinho de operação em lote                            | Itens para ação em lote.       | —                    |
| `CartDesign` / `NativeCartDesign` | Base de carrinho                                        | Base — prefira concretas.      | —                    |

---

## Temas de cor (`colorTheme`)

Os temas usados em `colorTheme` (e em props equivalentes de cor) são
**registrados em runtime** pelo `FormatterInterceptor` em
[formatter_interceptor.ts](../../plugin/app/src/interceptors/formatter_interceptor.ts).
Cada tema é um `ColorTheme` com até 5 canais: `backgroundColor`, `borderColor`,
`iconColor`, `textColor`, `labelColor` (cores em hex sem `#`). Há um conjunto
completo para **modo claro** (`colorThemeLight`) e um espelho para **modo
escuro** (`colorThemeDark`) — sempre passe o **nome semântico**, o app resolve
claro/escuro automaticamente.

> ⚠️ Esta é a **fonte de verdade** dos nomes aceitos. Só use temas listados
> aqui; qualquer outro nome cai no fallback. Ao mapear um print, escolha pelo
> **matiz dominante** e pela **variante** (preenchido vs. só-contorno vs.
> saturado).

### Paleta base (22 cores)

Cada cor tem 3 variantes (sufixos). Os hex abaixo são do **modo claro**; no
escuro fundo e texto se invertem (fundo vira a cor saturada, texto/ícone vira o
tom claro).

| Tema (base)  | Hex de destaque | Variante base (fundo claro)                    | `_ONLY_BORDER` (sem fundo)                        | `_PRIMARY` (fundo saturado)    |
| ------------ | --------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------ |
| `BLUE`       | `2299EA`        | fundo claro `E1F3FF`, texto/ícone `2299EA`     | só contorno/texto `2299EA`, sem `backgroundColor` | fundo `2299EA`, texto `FFFFFF` |
| `RED`        | `E8605B`        | fundo `FFEAE8`, texto `E8605B`                 | contorno/texto `E8605B`                           | fundo `E8605B`, texto `FFFFFF` |
| `YELLOW`     | `DCBC33`        | fundo `FBF4DA`, texto `DCBC33`                 | contorno/texto `DCBC33`                           | fundo `DCBC33`, texto `0E1311` |
| `ORANGE`     | `EB933B`        | fundo `FFECDC`, texto `EB933B`                 | contorno/texto `EB933B`                           | fundo `EB933B`, texto `FFFFFF` |
| `GREEN`      | `07D79C`        | fundo `DFF8EC`, texto `07D79C`                 | contorno/texto `07D79C`                           | fundo `07D79C`, texto `0E1311` |
| `EMERALD`    | `3EC87D`        | fundo `E1F7E8`, texto `3EC87D`                 | contorno/texto `3EC87D`                           | fundo `3EC87D`, texto `0E1311` |
| `TEAL`       | `37C2BB`        | fundo `DAF8F5`, texto `37C2BB`                 | contorno/texto `37C2BB`                           | fundo `37C2BB`, texto `0E1311` |
| `CYAN`       | `26B7D3`        | fundo `DAF7FE`, texto `26B7D3`                 | contorno/texto `26B7D3`                           | fundo `26B7D3`, texto `FFFFFF` |
| `SKY`        | `23ACE3`        | fundo `DDF5FF`, texto `23ACE3`                 | contorno/texto `23ACE3`                           | fundo `23ACE3`, texto `FFFFFF` |
| `INDIGO`     | `6076DE`        | fundo `E9F0FF`, texto `6076DE`                 | contorno/texto `6076DE`                           | fundo `6076DE`, texto `FFFFFF` |
| `VIOLET`     | `9769DC`        | fundo `F4EDFF`, texto `9769DC`                 | contorno/texto `9769DC`                           | fundo `9769DC`, texto `FFFFFF` |
| `MAGENTA`    | `C85AC0`        | fundo `FEEAFB`, texto `C85AC0`                 | contorno/texto `C85AC0`                           | fundo `C85AC0`, texto `FFFFFF` |
| `PINK`       | `E373A8`        | fundo `FFE9F3`, texto `E373A8`                 | contorno/texto `E373A8`                           | fundo `E373A8`, texto `FFFFFF` |
| `ROSE`       | `E1627F`        | fundo `FFE9ED`, texto `E1627F`                 | contorno/texto `E1627F`                           | fundo `E1627F`, texto `FFFFFF` |
| `CORAL`      | `E97B58`        | fundo `FFEAE2`, texto `E97B58`                 | contorno/texto `E97B58`                           | fundo `E97B58`, texto `FFFFFF` |
| `LIME`       | `A5D859`        | fundo `ECF7DF`, texto `A5D859`                 | contorno/texto `A5D859`                           | fundo `A5D859`, texto `0E1311` |
| `PURPLE`     | `9E66D7`        | fundo `F4ECFF`, texto `9E66D7`                 | contorno/texto `9E66D7`                           | fundo `9E66D7`, texto `FFFFFF` |
| `BROWN`      | `836140`        | fundo `FFEDDC`, texto `836140`                 | contorno/texto `836140`                           | fundo `836140`, texto `FFFFFF` |
| `GREY`       | `5B6663`        | fundo `EDF0EF`, texto `5B6663`                 | contorno/texto `5B6663`                           | fundo `5B6663`, texto `FFFFFF` |
| `LIGHT_GREY` | `9AA4A1`        | fundo `F4F6F5`, texto `9AA4A1`                 | contorno/texto `9AA4A1`                           | fundo `9AA4A1`, texto `FFFFFF` |
| `REGULAR`    | `5B6663`        | fundo `FFFFFF`, borda `E8ECEA`, texto `5B6663` | contorno/texto `5B6663`                           | fundo `5B6663`, texto `FFFFFF` |
| `WHITE`      | `9AA4A1`        | fundo `FFFFFF`, borda `E8ECEA`, texto `9AA4A1` | contorno/texto `9AA4A1`                           | fundo `9AA4A1`, texto `FFFFFF` |

**Variantes — quando usar cada uma:**

- **Base** (ex. `GREEN`): chip/box com **fundo claro** (pastel) e texto/ícone na
  cor saturada. Padrão para chips de status, tags e boxes coloridos suaves.
- **`_ONLY_BORDER`** (ex. `GREEN_ONLY_BORDER`): **sem `backgroundColor`** — só
  `borderColor`, `iconColor`, `textColor`, `labelColor` na cor saturada. Use em
  **células de grade/tabela** onde o fundo é herdado do container e só o
  conteúdo deve receber cor.
- **`_PRIMARY`** (ex. `GREEN_PRIMARY`): **fundo saturado** (cor cheia) com
  texto/ícone branco (`FFFFFF`) — ou escuro `0E1311` nos tons claros (`YELLOW`,
  `GREEN`, `EMERALD`, `TEAL`, `LIME`) para contraste. Use em **botões
  primários** e destaques de cor forte.

> `REGULAR` e `WHITE` na variante base têm **fundo branco com borda** (são os
> neutros “de papel”); no modo escuro viram fundo `141817` com borda `242A28`.
> Use-os para containers neutros.

### Temas especiais (não-paleta)

| Tema             | Para que serve                       | Claro                                | Escuro                               |
| ---------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `FULL_MENU_CELL` | Célula de item de menu lateral       | fundo `FCFCFC`, ícone/texto `07D79C` | fundo `5C6764`, ícone/texto `07D79C` |
| `PRIMARY_APP`    | Bloco de total na sidebar (escuro)   | fundo `000000`, ícone/texto `07D79C` | fundo `000000`, ícone/texto `07D79C` |
| `BUTTON_APP`     | Botão principal do app (verde-marca) | fundo `DFF8EC`, texto `07D79C`       | fundo `07D79C`, texto `DFF8EC`       |

> Verde-marca Glyvio = `07D79C`. Esses três temas são fixos de chrome do app —
> não use para conteúdo comum; prefira a paleta semântica acima.

---

## Pendência: imagens de referência

Para o matching ficar **confiável** (comparar recorte do print com a thumbnail),
cada componente deveria ter uma imagem. Sugestão de fluxo para gerá-las:

1. Renderizar cada design isolado num storybook/página de exemplo do app.
2. Capturar screenshot por componente em
   `docs/claude/component_images/<classe>.png`.
3. Substituir os marcadores textuais deste catálogo por
   `![ClassName](component_images/ClassName.png)`.

Enquanto as imagens não existirem, o agente deve usar as colunas **"Parece com"
/ "Use quando"** como descrição visual textual.
