---
name: generate-plugin-docs
description: "Generates the complete end-user documentation of a Glyvio plugin as an HTML manual in the Glyvio brandbook: the data model field by field (type, description, justification), every screen with a live screenshot, location, purpose, operation flow and cautions, and every routine (endpoint, interceptor, strategy) with trigger, input, output, justification and cautions. Use when the user asks for a manual, user documentation, documentação do plugin, documentação para o usuário final, or to update one after a release."
---
# Skill: Documentação do usuário de um plugin

Gera `docs/manual_usuario/index.html` no plugin: um manual único, navegável, com busca, temas claro e
escuro, nas cores e fontes do brandbook Glyvio, cobrindo **modelo de dados**, **telas com print** e
**rotinas**. O conteúdo é escrito por você a partir do código; os scripts desta skill fazem o
inventário, os prints e o HTML.

**Gatilhos:** "gera a documentação do plugin", "manual do usuário", "documentação completa com prints",
"documenta as telas/rotinas/modelo de dados", "atualiza o manual depois da versão X".

---

## Arquivos

```text
<plugin>/docs/manual_usuario/
├── index.html          # gerado — não editar à mão
├── prints/             # <img>.jpg capturados no app publicado
└── _fonte/             # o que você escreve (e o inventário gerado)
    ├── meta.json       # título, versão, índice da visão geral, ordem dos grupos, glossário, rodapé
    ├── overview.html   # visão geral (fragmento HTML)
    ├── model.json      # textos do modelo de dados
    ├── screens.json    # telas
    ├── routines.json   # rotinas
    ├── schema.json     # gerado por inventory.py
    ├── inventory.json  # gerado por inventory.py
    └── permissions.json# gerado por inventory.py
```

Scripts (copie nada para o plugin; rode do lugar):

| Script | O que faz |
| --- | --- |
| `@@SKILLS@@/generate-plugin-docs/assets/inventory.py <plugin> <_fonte>` | Junta as `dbVersions` do `manifest.json` em `schema.json` (entidades e campos finais), cria/completa o esqueleto `model.json` com os comentários do manifest, lista rotas, menus, interceptors de app, controllers, interceptors e strategies do servidor em `inventory.json` e as permissões em `permissions.json` |
| `@@SKILLS@@/generate-plugin-docs/assets/capture.js` | Login no app publicado, lista as rotas e tira os prints por um roteiro `steps.json` |
| `@@SKILLS@@/generate-plugin-docs/assets/contact_sheet.js <prints> [prefixo]` | Folhas de contato (9 prints por imagem) para revisar os prints rápido |
| `@@SKILLS@@/generate-plugin-docs/assets/build_docs.py <_fonte> <manual_usuario>` | Gera o `index.html`; **recusa** se faltar texto em alguma entidade ou campo |

Requisitos: Python 3.11+, Node e Playwright (`PLAYWRIGHT_MODULE=/caminho/node_modules/playwright` quando o
plugin não tem Playwright instalado; o Chromium do Playwright precisa existir).

---

## Passo 1 — Inventário

```bash
python3 @@SKILLS@@/generate-plugin-docs/assets/inventory.py . docs/manual_usuario/_fonte
```

Leia `inventory.json`, o `manifest.json` (permissões e comentários), o `CHANGELOG.md`, os `.arb` de
`assets/i18n/pt_BR.arb` (rótulos reais de menus, botões e mensagens), qualquer manual em `docs/` e os
`index.ts` do app e do server. Com `model.json` existente, o script só acrescenta o que falta.

## Passo 2 — Modelo de dados (`model.json`)

Para **cada entidade** de `schema.json`:

```json
"financial_account": {
  "label": "Conta bancária / caixa",
  "group": "Cadastros",
  "purpose": "Para que serve, em linguagem do usuário.",
  "why": "Por que a entidade existe / o que ela permite.",
  "care": "Regras que surpreendem: o que é calculado, o que não pode excluir, travas.",
  "fields": { "current_balance": ["Descrição do campo.", "Justificativa: por que existe e como é usado."] }
}
```

- **Todo campo** precisa de descrição e justificativa (o build falha se faltar). Escreva a partir do
  comentário do manifest, do interceptor que valida/calcula o campo e da tela que o mostra.
- Diga quando um campo é **derivado pelo servidor** (ignorado se enviado), **só editável na criação**,
  ou **mantido só por uma operação**.
- Campos que o plugin acrescenta a entidades de outros plugins (ex.: `sale`, `product`) entram num
  grupo próprio ("Campos em entidades do CRM").
- Tipo, obrigatoriedade, padrão e referência saem do `schema.json` automaticamente; não repita.

## Passo 3 — Prints das telas

**Credenciais só pelo `.env` do plugin** (`G_APP_URL`, `G_USERNAME`, `G_PASSWORD`, opcional
`G_COMPANY_NAME`). Nunca peça a senha no chat nem a imprima. Sem `.env`, pare e peça ao usuário para
configurar. Use uma **empresa de teste** com o plugin publicado (a versão documentada) e dados
realistas; os prints mostram esses dados.

1. Rotas do plugin (namespace com `_`, igual ao manifest):
   ```bash
   node @@SKILLS@@/generate-plugin-docs/assets/capture.js --env .env --ns <namespace> --routes docs/manual_usuario/_fonte
   ```
2. Escreva `ids.js` (opcional) com consultas **só de leitura** que devolvem ids de exemplo para abrir
   painéis e modais com dados (um título com baixas, um contrato, um cliente…).
3. Monte `steps.json` cobrindo **todas** as telas do inventário: páginas pelo `nav`; painéis laterais e
   modais com um `base` (a página por baixo) e os `params` da rota (leia a interface `…RouteParams`);
   abas de painel com `click` nas coordenadas da aba (veja o print antes); extensões em telas de outros
   plugins com `"ns": "<outro namespace>"`. Ponha `{"f":"_reload","reload":true}` a cada ~12 passos e
   **antes de páginas pesadas** (dashboards, projeções): elas podem travar o renderizador e fazer os
   prints seguintes darem timeout.
4. Capture (em segundo plano: são ~20–40 s por tela):
   ```bash
   node @@SKILLS@@/generate-plugin-docs/assets/capture.js --env .env --ns <namespace> \
     --steps docs/manual_usuario/_fonte/steps.json --ids docs/manual_usuario/_fonte/ids.js \
     --out docs/manual_usuario/prints > capture.log 2>&1
   ```
5. Revise: `grep FAIL capture.log`, depois folhas de contato
   (`node …/contact_sheet.js docs/manual_usuario/prints m_`) e **leia** cada folha. Refaça num novo
   `steps.json` só o que falhou ou abriu errado (tela carregando, painel que não abriu, modal vazio).
   Um print errado é pior que nenhum: apague-o e a tela sai com "Print não disponível".

Convenção de nomes: `p_` página, `s_` painel lateral, `m_` modal, `x_` extensão em tela de outro plugin.

Gotchas:
- Não espere com `pgrep -f`/`pkill -f` usando um texto que aparece no próprio comando: ele casa consigo
  mesmo (e o `pkill` mata o próprio shell). Espere pelo fim do log (`until grep -q "^<último f>" capture.log`).
- `navigate()` pode não resolver a promise; o script já tolera. Painel lateral só abre sobre uma página.
- A tela de empresa aparece mesmo com uma empresa só; o script clica no card (ou em `G_COMPANY_NAME`).

## Passo 4 — Telas (`screens.json`)

Uma entrada por tela, na ordem de leitura:

```json
{ "group": "Títulos e movimentação", "img": "p_entries", "name": "Contas a pagar e a receber",
  "where": "Menu › Financeiro › Contas a Pagar / Receber", "kind": "Página (tabela)",
  "desc": "O que aparece na tela: colunas, cartões, filtros, botões.",
  "purpose": "Para que o usuário usa a tela.",
  "flow": ["Passo 1…", "Passo 2…"],
  "care": ["Regra ou trava que costuma surpreender."],
  "perm": "view_financial_entry_table_page" }
```

- **Descreva o que o print mostra**, não o que um manual antigo dizia: telas mudam. Use os rótulos
  exatos do `pt_BR.arb` e do menu.
- `where` diz como chegar: menu, Administração, ou o botão/aba de origem.
- `flow` são os passos reais de operação; `care` as regras do servidor que o usuário encontra
  (permissões `option_*`, período fechado, campos travados, o que não se desfaz).

## Passo 5 — Rotinas (`routines.json`)

Uma entrada por controller+strategy, interceptor relevante, queue runner, strategy de app ou de
integração (agrupe as triviais, ex.: "Registros só pelas operações"):

```json
{ "group": "Operações financeiras", "kind": "Operação",
  "name": "Estorno de baixa",
  "where": "plugin/server/src/controllers/x_controller.ts · strategies/x_strategy.ts",
  "trigger": "Botão Estornar Movimentação. Endpoint financial_settlement_reversal.",
  "purpose": "…", "input": "Campos do corpo/registro que entram.", "output": "O que grava ou devolve.",
  "why": "Por que a rotina existe.", "care": "Permissão exigida, travas, o que não desfaz." }
```

`kind`: **Operação** (botão/endpoint), **Automação** (interceptor, fila, abertura de tela), **Consulta**
(só lê), **Integração** (evento de outro plugin). Leia o código de cada uma — doc comments das strategies
ajudam, mas confira validações (`GlyvioError`) e permissões no controller.

## Passo 6 — Visão geral, meta e build

- `overview.html`: fragmento HTML com seções `<h2 id="…">` (onde fica cada coisa, conceitos com
  fórmulas, situações/status, garantias, fluxos, rotina de uso). Classes disponíveis: `card concept`,
  `grid2`, `grid3`, `tbl` (envolve `<table>`), `formula`, `flow` (`<span>` passos, `<i>→</i>`),
  `warn`, `st b|r|o|g|n` (selos azul, vermelho, laranja, verde, cinza), `lead`.
- `meta.json`:
  ```json
  { "title": "Manual do Financeiro Glyvio", "plugin": "Financeiro", "version": "0.3.9",
    "heroTitle": "Manual completo do Financeiro Glyvio", "heroText": "…",
    "overviewNav": [["menus", "Onde fica cada coisa"], ["conceitos", "Conceitos"]],
    "groups": { "model": ["Cadastros", "…"], "screens": [], "routines": [] },
    "glossary": [["Aging", "Vencidos por faixa de atraso."]],
    "footer": "Glyvio · plugin Financeiro v0.3.9 · …" }
  ```
  `title` é o nome da página (sem explicação depois de travessão); a versão é a do `package.json`.
- Build:
  ```bash
  python3 @@SKILLS@@/generate-plugin-docs/assets/build_docs.py docs/manual_usuario/_fonte docs/manual_usuario
  ```
  O resultado lista telas sem print. Abra o `index.html` (com `prints/` ao lado) e confira desktop,
  celular (390 px, sem rolagem horizontal) e tema escuro.

## Brandbook (já aplicado no template)

Preto `#111111` (fundos de destaque, cabeçalhos de tabela), menta `#07D79C` (acentos, traço sob os
títulos, borda inferior do cabeçalho de tabela), menta escuro `#00936a` para texto sobre fundo claro;
títulos em **Visby CF** (fallback Montserrat), corpo em **Avenir LT Std** (fallback Inter); marca escrita
`Gly` + `v` menta + `io`. Não troque cores ou fontes no conteúdo; se o template mudar, mude-o aqui na skill.

## Entrega

- Não faça commit sem o usuário pedir; o manual fica em `docs/manual_usuario/`.
- Relate: quantas entidades/campos/telas/rotinas, telas sem print e por quê, e de qual empresa/ambiente
  vieram os prints.
- Para uma nova versão do plugin: rode o inventário de novo (completa o `model.json`), atualize os textos
  das telas e rotinas que mudaram, recapture só as telas alteradas e gere de novo.
