<!-- Generated from src/references/modern_layout.md by tools/generate.py. Edit the source, not this file. -->
# Padrão visual moderno do Glyvio (Surface, Stack, Grid e `glyvio_core.ui`)

> Requer `glyvio_core` v0.9.174+ (`SurfaceDesign`, `StackLayoutDesign`, `GridLayoutDesign` e
> `glyvio_core.ui`). Telas de referência já no padrão, abertas no próprio app: `ProfileSidebar` (lembretes),
> `AppUserSidebar`, `TaskSidebar`, `SimpleSendModal`, `ReportWizardModal` e as galerias em
> `/examples` (`/examples/patterns/settings`, `/examples/patterns/record`,
> `/examples/patterns/dashboard`, galerias de layout, blocos, botões, dados e formulários).

Use este padrão em **toda tela nova** e ao **redesenhar** uma tela existente. Ele substitui a
montagem manual com `RowLayoutDesign`/`ColumnLayoutDesign` + paddings por campo: os blocos já
trazem espaçamento, raio, borda e cor do design system e funcionam em claro e escuro.

---

## 1. Os quatro designs de layout

| Design | Para quê | Props principais |
| --- | --- | --- |
| `SurfaceDesign` | Caixa: card, painel, tile, banner | `child`, `surface`, `padding`, `radius`, `border`, `borderColorTheme`, `shadow`, `selected`, `onTap`, `width`/`height`/`minHeight`, `visible` |
| `StackLayoutDesign` | Filhos um após o outro com `gap` constante | `children`, `direction` (`vertical` padrão / `horizontal`), `gap`, `padding`, `mainAlignment`, `crossAlignment`, `wrap` |
| `StackItemDesign` | Filho de um stack que cresce ou some | `child`, `flex`, `visible` |
| `GridLayoutDesign` + `GridItemDesign` | Grade responsiva de 12 colunas | grid: `columns`, `gap`, `rowGap`, `padding`, `equalHeight`; item: `span`, `spanMd`, `spanSm`, `visible` |

### Tokens

- Espaço (`GvSpace`): `none` 0 · `xxs` 4 · `xs` 8 · `sm` 12 · `md` 16 · `lg` 20 · `xl` 24 · `xxl` 32.
- Raio (`GvRadius`): `none` 0 · `sm` 8 · `md` 10 · `lg` 14 · `xl` 20 · `pill`.
- `surface` (`GvSurface`): `card` (padrão, com borda fina) · `page` (card dentro de card) · `muted`
  (painel cinza) · `brand` (verde sólido) · `transparent` · `inverse` (card do tema oposto, para
  destaque; o conteúdo se adapta sozinho) · **ou qualquer tema de cor** (`GREEN`, `BLUE`, `AMBER`,
  `RED`...), que vira o tom suave (subtle) daquela cor.

### ⚠️ Ordem do `padding` — dois padrões convivem

| Designs | Formato |
| --- | --- |
| **Modernos** (`SurfaceDesign`, `StackLayoutDesign`, `GridLayoutDesign`) | **CSS**: `'md'` (todos), `'sm lg'` (vertical horizontal), `'0 md md md'` (top right bottom left). Aceita tokens ou números. |
| **Antigos** (`RowLayoutFieldDesign`, `ColumnLayoutFieldDesign`, `FormLayoutFieldDesign`, `AvatarDesign`, `StringTextDesign`...) | **LTRB**: `'8'`, `'16 8'` (horizontal vertical), `'8 12 8 0'` (left top right bottom). Só números. |

Trocar a ordem gera linhas gigantes ou espaçamentos invertidos. Na dúvida, confira o JSDoc do
campo no `@types`.

### Grid responsivo

O grid mede **a própria largura** (não a da tela): `sm` < 520px ≤ `md` < 900px ≤ `lg`. Por isso
uma sidebar estreita ou um celular empilha tudo sem código extra. Padrões úteis:

- 2 colunas que viram 1: `span: 6, spanMd: 12, spanSm: 12`.
- 3 cards de resumo: `span: 4, spanMd: 12, spanSm: 12` (ou `spanMd: 6` para 2 por linha).
- KPIs: `span: 3, spanMd: 6, spanSm: 12`.
- Cards lado a lado com a mesma altura: `equalHeight: true` no grid.

---

## 2. `glyvio_core.ui` — blocos prontos (preferir a montar à mão)

`glyvio_core.ui` é uma instância de `UiBlocks` exportada pelo core. Todos os métodos retornam
designs públicos comuns (podem ser misturados com qualquer outro design).

| Método | Resultado |
| --- | --- |
| `ui.page(children, { key?, width?, gap? })` | **Seção** (`FormSectionDesign` limpa) com os blocos empilhados, centralizada com largura máxima (padrão 1180). É o que vai em `sectionsDesign`/`sectionsContentDesign`. |
| `ui.card({ key?, title?, subtitle?, icon?, color?, actions?, children?, surface?, padding?, gap?, onTap?, selected?, shadow?, minHeight? })` | Card com cabeçalho opcional (ícone tingido + título + subtítulo + ações à direita). |
| `ui.header({ title, subtitle?, icon?, color?, actions?, style? })` | Linha de título com ações. |
| `ui.sectionTitle(title, { subtitle?, action? })` | Título de grupo dentro da página. |
| `ui.row(children, { gap?, align?, wrap?, justify?, padding? })` / `ui.column(children, { gap?, align? })` | Stack horizontal / vertical. |
| `ui.grow(child, flex = 1)` | Faz o filho ocupar o espaço que sobra no `row`. |
| `ui.grid(items, { gap?, equalHeight? })` | Grid de 12 colunas; cada item é `bloco` ou `[bloco, span]` com `span = n` ou `[lg, md, sm]`. |
| `ui.text(value, style?, { color?, maxLines? })` / `ui.muted(value, style?, maxLines?)` | Texto com estilo tipográfico / texto secundário cinza. |
| `ui.badge(label, color?, { icon?, dot? })` | Pílula de status (`BadgeCellDesign` subtle). |
| `ui.iconTile(icon, color?, size?)` | Ícone em quadrado tingido. |
| `ui.stat({ label, value, icon?, color?, delta?, trend?, hint?, progress?, progressMax?, onTap? })` | Card de KPI. Sem `progressMax`, `progress` adivinha a escala (`<= 1` fração, `> 1` porcentagem — `1` é barra cheia); passe `progressMax` para deixar explícito. |
| `ui.progress(value, { max?, label?, valueText?, color?, height? })` | Barra de progresso com escala explícita: `value / max` (`max` padrão 100). Ex.: `ui.progress(3, { max: 10, label: 'Etapas', valueText: '3/10' })`. |
| `ui.option({ key?, title, subtitle?, icon?, color?, selected?, action, extra? })` | Card selecionável (planos, escolhas, configurações). |
| `ui.listRow({ title, subtitle?, avatar?, icon?, color?, trailing?, onTap? })` + `ui.list(rows)` | Linhas de lista separadas por divisores. |
| `ui.field(label, value)` / `ui.fields(pairs, columns = 3)` | Rótulo sobre valor (telas de detalhe). |
| `ui.banner({ title, text?, icon?, color?, actions? })` | Aviso tingido (info, sucesso, alerta, erro). |
| `ui.button(title, action, { icon?, kind?, key? })` | Botão; `kind`: `primary`, `secondary`, `ghost`, `danger`. |

Estilos de texto (`UiTextStyle`): `DISPLAY_SMALL`, `HEADLINE_LARGE|MEDIUM|SMALL`,
`TITLE_LARGE|MEDIUM|SMALL`, `BODY_LARGE|MEDIUM|SMALL`, `LABEL_LARGE|MEDIUM|SMALL`, `OVERLINE`.

```typescript
const ui = glyvio_core.ui;

design.sectionsDesign = [
  ui.page(
    [
      ui.grid([
        [ui.stat({ label: 'Receita', value: 'R$ 48,2 mil', delta: '+12%', icon: 'sax_linear_wallet_money', color: 'GREEN' }), [3, 6, 12]],
        [ui.stat({ label: 'Pedidos', value: '128', icon: 'sax_linear_bag_2', color: 'BLUE' }), [3, 6, 12]],
      ]),
      ui.card({
        title: 'Últimos pedidos',
        icon: 'sax_linear_receipt_2',
        color: 'BLUE',
        actions: [ui.button('Ver todos', new glyvio_core.Action({ key: 'openAll', data: {} }), { kind: 'ghost' })],
        children: [ui.list(rows)],
      }),
    ],
    { key: 'main.section', width: 1100, gap: 'md' },
  ),
];
```

---

## 3. Cor e variante

- Passe sempre o **nome** do tema em `colorTheme`/`color`; o app resolve claro e escuro.
- Paleta: `BLUE`, `RED`, `YELLOW`, `ORANGE`, `GREEN`, `EMERALD`, `TEAL`, `CYAN`, `SKY`, `INDIGO`,
  `VIOLET`, `MAGENTA`, `PINK`, `ROSE`, `CORAL`, `LIME`, `PURPLE`, `BROWN`, `GREY`, `LIGHT_GREY`,
  `REGULAR`, `WHITE`, mais `AMBER` e `NEUTRAL`.
- Nomes semânticos (preferir em status): `SUCCESS`/`PRIMARY` (verde), `INFO` (azul),
  `WARNING` (âmbar), `DANGER`/`ERROR` (vermelho), `NEUTRAL` (cinza).
- **Variante em vez de sufixo**: `ActionButtonDesign`, `SimpleIconDesign`, `ChipDesign`,
  `AvatarDesign`, `BadgeCellDesign`, `CardCellDesign`, `LineCellDesign`, `AlertBoxDesign` e
  `SizedBoxDesign` aceitam `variant` (`solid` | `subtle` | `outline` | `ghost`, conforme o design).
  Em código novo use `colorTheme: 'GREEN', variant: 'subtle'` em vez de `GREEN_ONLY_BORDER`/`GREEN_PRIMARY`.
- Botões: `type: 'PRIMARY', colorTheme: 'PRIMARY'` = ação principal verde; `type: 'SECONDARY'` com
  `variant: 'ghost'` = ação discreta de linha ("Trocar", "Editar", "+ Vincular");
  `variant: 'outline'` = opção não selecionada de um grupo.
- Não use `LIGHT_GREY` como fundo sólido em modo escuro (fica escuro demais); use `GREY` subtle.
- Cores de texto secundário: `ui.muted(...)` (usa `LIGHT_GREY`), não cinza fixo.

---

## 4. Receitas de tela

### Detalhe de registro (sidebar)

1. App bar: `leading` com ícone tingido (`SimpleIconDesign({ variant: 'subtle', showBackground: true })`),
   título = nome, subtítulo = `"<Entidade> #<código> · <tipo> · criada em <data>"`, ação principal
   como `PRIMARY`, o resto como `OTHER` (vai para o menu ⋮).
2. Card de destaque (`SurfaceDesign({ surface: 'GREEN', radius: 'xl' })` ou `surface: 'inverse'`)
   com avatar, nome, subtítulo e badges de estado.
3. Linha de cards de resumo (`ui.grid` com 2–3 cards `equalHeight`), cada um com rótulo curto,
   valor e **uma** ação ghost ("Trocar", "Agendar", "+ Adicionar"). Estado vazio vira texto
   `ui.muted('Sem data')` + a ação que resolve.
4. Cards de conteúdo (notas, vínculos, tabelas) com título em `OVERLINE` e ação à direita.
5. Tudo dentro de **um** `ui.page(..., { key: 'main.section' })`.

### Lista estruturada dentro de um card (grupos × template, itens × valor)

Cabeçalho com `ui.muted(label, 'OVERLINE')` em `ui.grow(..., n)` e linhas `ui.row` com os mesmos
`flex`, separadas por `ui.list(rows)`. Coluna de ações: reserve a largura no cabeçalho
(`SizedBoxDesign({ width: 40, height: 1 })`) só quando os botões estiverem visíveis.

### Etapas / status clicáveis

Uma `ui.row(..., { wrap: true, gap: 'xs' })` de `ActionButtonDesign`: a etapa atual `PRIMARY`
com `colorTheme` do status e ícone de check, as outras `SECONDARY` + `variant: 'outline'`, cada uma
com uma `Action` que recebe o id da etapa.

### Formulário/modal em passos (wizard)

`SegmentedControlDesign` (`variant: 'underline'` para abas, `'pill'` para escolhas) com
`actionKeyOnSelect`, uma seção por passo com `visible` e rodapé com Voltar/Continuar. Leia a
escolha com `SegmentedControlDesign.getSelectedKey(action)`.

---

## 5. Regras de compatibilidade (NÃO-NEGOCIÁVEL ao redesenhar)

- **Preserve as `key`s que interceptors usam.** Antes de reescrever um `getDesign`, procure em
  todos os plugins (`nossos/`, `clientes/`, `services/ts/`) por `findWidgetByKey('...')` da tela.
  Ex.: `AppUserSidebar` manteve `main.layout` como `FormLayoutDesign` dentro de um card porque
  crm, crm-full e senior fazem `push` de campos nele; `TaskSidebar` manteve `main.layout`
  (`FormEntityLayoutDesign`), `main.description.*` e `main.links.*`.
- `findWidgetByKey` atravessa `SurfaceDesign`, `StackLayoutDesign`, `GridLayoutDesign` e os
  itens, então é seguro mover um widget com key para dentro de um card.
- Designs antigos (`FormLayoutDesign`, `FormEntityLayoutDesign`, `EntityLinksDesign`,
  `MarkdownTextDesign`, `TableLayoutDesign`) funcionam **dentro** de `SurfaceDesign`/stacks.
- **Seções continuam só no topo** (`sectionsDesign`), nunca dentro de um card. `ui.page` já é
  uma seção.
- Mantenha os nomes das ações (`action.key`) existentes; ao criar uma ação nova (ex.:
  `changeStatusTo`), trate-a em `events` e reaproveite os métodos já existentes.
- `getDesign` roda com o estado pronto: calcule rótulos, cores e contagens em TypeScript
  (`state.user?.admin ? ... : ...`) em vez de condicionais Handlebars aninhadas.
- `visible` numa expressão `a && b` pode virar `undefined` (= visível). Force booleano: `!!a && b`.
- Frases com números ou nomes vêm de chave ICU (ver `i18n.md`), não de concatenação.

---

## 6. Validação visual

Depois do build, abra a tela no navegador (skill `test-plugin-browser`), tire print em
**1440×900 e 390×844**, com e sem dados (estado vazio), e em modo escuro quando mexer em cor.
Confira alinhamento de colunas, cards de mesma altura, quebra de linha dos chips e se nenhuma
ação some por `visible` indevido.
