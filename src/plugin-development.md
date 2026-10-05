# glyvio-plugin-{pluginName}

Plugin Glyvio para {pluginName} — monorepo TypeScript com arquitetura em três
camadas: frontend (`app`), backend (`server`) e integração com IA
(`environment`).

---

## Estrutura do Projeto

```
glyvio-plugin-{pluginName}/
├── plugin/
│   ├── app/          # Frontend — telas, modais, menus
│   ├── server/       # Backend — interceptors, controllers, strategies
│   └── environment/  # IA — system tools, custom tools, services
├── shared/
│   └── commons/      # Constantes compartilhadas (PLUGIN_ID, VERSION…)
└── manifest.json     # Entidades, permissões e migrações do banco
```

Cada pacote tem seu próprio ciclo de build via Webpack e gera um
`dist/bundle.js` independente.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) LTS
- [pnpm](https://pnpm.io/) instalado globalmente:

```sh
npm install -g pnpm
```

---

## Setup

```sh
# instalar todas as dependências do monorepo
pnpm install

# build de todas as camadas
pnpm build

# verificar tipos e lint
pnpm lint
```

**Primeira vez numa máquina ou num projeto:** siga a skill `glyvio-onboarding` — baixa o
`glyvio-dev-helper`, cria o `.env` (`G_APP_URL`, `G_AUTH_URL`, `G_COMPANY_ID`, `G_USERNAME`,
`G_PASSWORD`), instala o `run_helper.sh`/`run_helper.ps1` e gera os `@types`.

Após editar `manifest.json`, rode `./run_helper.sh` (Windows: `.\run_helper.ps1`) na raiz para
regenerar os `@types` (`glyvio_core.d.ts`, `entity.d.ts`, `permissions.d.ts` e um `.d.ts` por
dependência, em cada camada).

> **`@types`/`dist/bundle.d.ts` são sempre gerados e ficam fora do git**
> (`.gitignore` os exclui em todos os plugins). Isso significa que, se em algum
> ponto for necessário editar esses arquivos manualmente como stopgap — por
> exemplo, para desbloquear um build enquanto uma alteração de manifesto de
> outro plugin ainda não foi publicada — **esse patch manual não deixa
> nenhum rastro no git**: some no próximo `run_helper.sh`/checkout limpo, e o
> próximo agente que ler o repositório não tem como saber que ele existiu. A
> regra padrão continua sendo **nunca editar esses arquivos manualmente**; se
> um stopgap desse tipo for genuinamente necessário, documente-o explicitamente
> para o usuário na conversa (não apenas no arquivo gerado) e trate como
> temporário até a publicação real do dependency resolver o gap.

---

## Jornada de Desenvolvimento de uma Feature

```
[1] Manifesto  →  [2] App  →  [3] Server  →  [4] Environment  →  [5] Release
```

### 1. Manifesto

Se a feature precisa de uma nova entidade, adicione uma versão em
`manifest.json → dbVersions`. Defina campos, tipos, chaves estrangeiras e
permissões. Rode `./run_helper.sh` para regenerar os tipos.

### 2. Camada App — Frontend

Crie views em `plugin/app/src/views/`. Registre rotas e interceptors em
`plugin/app/src/index.ts`:

```ts
glyvio_core.routerService.loadRoutes([MinhaPageRoute, MeuModalRoute]);
glyvio_core.appInterceptorService.registerInterceptors([{
  interceptor: MeuInterceptor,
}]);
```

**Tipos de view disponíveis:** `SimpleListPage`, `SimpleTablePage`,
`SimpleDashboardPage`, `SimpleEditModal`, `SimpleEntityModal`,
`SimpleSendModal`, `SimpleCart`, `SimpleSidebar`, `SimpleKanbanPage`,
`SimpleCalendarPage`.

> **Atenção:** Sempre use `await glyvio_entity.Erp.new()` para instanciar
> entidades — nunca `new glyvio_entity.Erp()`. **Única exceção confirmada**: um
> fluxo de upload de anexo pode legitimamente pré-gerar uma instância via
> construtor bruto só para obter um `id` antes de repassá-la a um método de
> persistência especializado (ex.: `attachFromTemp`) que já ignora
> `entityService` por completo — fora desse caso específico, a regra continua
> absoluta.
>
> Em interpolações de design, use o caminho joined: `item.client.name`, nunca
> `item.clientId`.

### 3. Camada Server — Backend

Exporte os módulos de interceptors, controllers e strategies em
`plugin/server/src/index.ts` para que os decorators sejam executados na inicialização.
A descoberta pelo decorator depende de o módulo fazer parte do bundle; não substitui
sua inclusão no entrypoint.

**BeforeInterceptor** valida ou modifica antes do save e pode cancelar a operação.
Veja o [exemplo completo](examples/server/before_interceptor.md).

**AfterInterceptor** executa efeitos dentro da transação, após o save e antes do
commit. Veja o [exemplo completo](examples/server/after_interceptor.md).

**AfterCommitInterceptor** — executa após commit durável (use para webhooks,
filas externas, emails).

**Controller** — endpoint HTTP decorado com
`@glyvio_core.Controller({ path, allowPrivateAccess })`.

UUIDs de status e grupos ficam centralizados em `plugin/server/src/constants.ts`
— nunca hardcode inline.

### 4. Camada Environment — IA

Os decorators identificam as tools em runtime, mas o modo de inclusão depende do
tipo. `SystemTool` precisa ser importada pelo entrypoint da camada para entrar no
bundle; `CustomTool` é descoberta automaticamente e não deve receber registro em
`index.ts`. Siga a skill correspondente.

```ts
@glyvio_core.SystemTool({
  id: 'company-daily-briefing',
  permission: glyvio_permissions.tool_company_daily_briefing, // declarada no manifest.json
  description: 'Retorna o briefing diário do usuário',
})
export class DailyBriefingTool implements glyvio_core.CoreSystemTool<Record<string, never>> {
  async handle(): Promise<string> {
    const userId = glyvio_core.getContext().loggedUserId;
    const tasks = await glyvio_core.queryService.find<{ name: string }>(
      'SELECT name FROM task WHERE user_id = ? AND done = false AND deleted = false',
      [{ dataType: 'TEXT', value: userId }],
    );
    return `Tarefas abertas: ${tasks.map((t) => t.name).join(', ')}`;
  }
}
```

Services usam o padrão singleton e acessam o banco via `SyncClient` (arquivo
`service.ts` — **nunca edite manualmente**, é auto-gerado).

### 5. Release

```sh
pnpm lint    # checar TypeScript antes
pnpm build   # compilar todas as camadas
```

Use a skill `/release-project` para automatizar: bump de versão patch → commit
descritivo → push. O CI no GitHub Actions valida o build antes do deploy.

---

## Registro de Views e Interceptors

| Camada      | Tipo                                      | Como é registrado                                                          |
| ----------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| App         | Pages / Modals / Sidebars / Carts / Side panels | `routerService.loadRoutes()` **e** `export *` da classe em `index.ts` (o nome da classe = `getRouteNameObject()`) |
| App         | Interceptors de app                       | Explícito em `index.ts` via `appInterceptorService.registerInterceptors()` |
| App         | Menu items / Admin                        | `menuRegistryService.addGroup()`/`addItem()`; telas de configuração em `adminRegistryService.addItem()` |
| Server      | Before / After / AfterCommit Interceptors | Decorador + `export *` em `plugin/server/src/index.ts`                      |
| Server      | Controllers / Strategies                  | Decorador + `export *` em `plugin/server/src/index.ts`                      |
| Environment | SystemTool / Action                       | Decorador + import no entrypoint da camada                                  |
| Environment | CustomTool                                | Descoberta automática via decorador; sem registro em `index.ts`             |

---

## Gotchas Confirmados do QueryBuilder

Nenhum destes aparece no `.d.ts` — todos foram confirmados por falha real em
tempo de execução, não inferidos dos tipos. Leia antes de tratar um
comportamento estranho do `QueryBuilder` como bug do plugin.

- **`findAll()` ignora `.limit()`/`.offset()` silenciosamente** — só `.find()`
  de fato pagina. Um bug real que passou despercebido até a tabela ter mais de
  ~15 registros de teste; não há sinal do compilador.
- **Self-join sem alias explícito falha, às vezes silenciosamente na UI**: um
  join de uma entidade contra ela mesma (ex.: `parentTask`, `parentCategory`)
  sem alias lança `table name specified more than once` no servidor — mas o
  erro pode nunca chegar ao usuário; a tela (lista ou edição) simplesmente
  renderiza vazia, sem nenhum aviso visível.
- **`.findAll()`/select padrão em entidade cross-plugin pode quebrar em
  relações não registradas**: chamar `.findAll()` numa entidade como `Client`
  a partir de um plugin consumidor pode lançar
  `Cannot read property 'structureName' of undefined`, porque o select padrão
  percorre toda relação declarada e nem toda relação está registrada no
  runtime desse plugin. Corrija restringindo os campos:
  `setFromEntity(AllEntities.x, { fields: [...] })` só com os campos
  escalares necessários.
- **`addLeftJoinEntity(fieldFrom, { fieldsForeign })` derruba o getter
  `<relation>Id` do lado "from" se `id` não estiver em `fieldsForeign`** —
  inclua `id` explicitamente sempre que precisar do FK id depois do join.
- **`'user'` como `aliasTableForeign` quebra a query** — `USER` é palavra
  reservada no Postgres; escolha outro alias.
- **Relação "array de ids" guardado como campo `JSON`/`jsonb` não tem um
  helper típado no QueryBuilder** — a única forma confirmada de filtrar por
  contenção é `addFilterRaw` com o operador `@>` do Postgres, ex.:
  ```typescript
  qb.addFilterRaw('client.mailing_lists @> to_jsonb(?::text)', [mailingListId]);
  ```
  Trate isso como o idiom sancionado para esse formato de relação (array de
  ids num campo JSON, sem entidade de junção própria) até que exista um
  helper de primeira classe equivalente.

---

## Skills de IA Disponíveis

As skills geram código seguindo os padrões do projeto. Invoque no chat com
`/nome-da-skill`.

### App (Frontend)

| Skill                         | Quando usar                             |
| ----------------------------- | --------------------------------------- |
| `/create-list-page`           | Página de listagem com busca e filtros  |
| `/create-table-page`          | Tabela spreadsheet com colunas inline   |
| `/create-edit-modal`          | Formulário de criação/edição em modal   |
| `/create-entity-modal`        | Picker/autocomplete de entidades        |
| `/create-sidebar`             | Painel lateral de detalhes              |
| `/create-kanban-page`         | Página kanban por status                |
| `/create-calendar-page`       | Página de calendário com eventos        |
| `/create-send-modal`          | Modal de envio de mensagem/email        |
| `/create-simple-cart`         | Drawer de carrinho/seleção temporária   |
| `/create-simple-batch-cart`   | Drawer de carrinho em lote (spreadsheet-like) |
| `/create-import-wizard`       | Importação guiada de planilha em passos (`SimpleWizardModal`) |
| `/create-entity-links-section`| Seção "Vínculos" polimórfica num sidebar existente |
| `/create-screen-from-image`   | Reproduz um screenshot como tela Glyvio |
| `/create-grid-page`           | Galeria/grade de cards                  |
| `/create-gantt-page`          | Linha do tempo (Gantt) com arrastar     |
| `/create-batch-page`          | Edição em lote estilo planilha          |
| `/create-dashboard-page`      | Dashboard dentro do app (KPIs, gráficos) |
| `/create-map-page`            | Mapa com pins por latitude/longitude    |
| `/create-edit-page`           | Formulário em tela cheia / configurações |
| `/create-master-detail-page`  | Lista à esquerda, detalhe à direita     |
| `/create-workflow-page`       | Grafo de processo/etapas                |
| `/create-list-modal`          | Seleção em lista dentro de modal        |
| `/create-table-modal`         | Seleção em tabela dentro de modal       |
| `/create-table-entity-modal`  | Picker de entidade em tabela            |
| `/create-batch-filter-modal`  | Filtro que devolve ids para lote        |
| `/create-wizard-modal`        | Modal em passos genérico                |
| `/create-tab-sidebar`         | Sidebar com abas                        |
| `/create-table-sidebar`       | Sidebar com tabela de registros relacionados |
| `/create-side-panel`          | Painel embutido em cart/modal/master-detail |
| `/use-builtin-dialogs`        | Toasts, confirmações, progresso, escolha e inputs prontos |
| `/use-view-extensions`        | Arquivos, uploads, planilhas, galeria, relatórios |
| `/register-menu-and-admin`    | Menu, tela de administração, itens de Custom Page, rotas offline |
| `/intercept-core-screen`      | Catálogo das telas prontas do Glyvio e seus interceptors |
| `/create-offline-support`     | Entidades e telas offline               |
| `/use-device-location`        | GPS do aparelho                         |
| `/use-audio-recorder`         | Gravar e tocar áudio                    |
| `/use-user-preferences`       | Preferências por usuário                |
| `/create-chat-channel-integration` | Canal de chat/voz (WhatsApp, e-mail, PABX...) |
| `/create-*-interceptor` (app) | Customiza uma tela existente (de outro plugin ou do Glyvio) |

### Extensibilidade (App)

| Skill                  | Quando usar                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `/create-app-strategy`  | Cria ou sobrescreve uma app-layer strategy (`CoreAppStrategyAsync`/`Sync`, ex: `EntityHasAttachmentTypesStrategy`) — diferente do `/create-strategy` (server) |

### Server (Backend)

| Skill                              | Quando usar                     |
| ---------------------------------- | ------------------------------- |
| `/create-before-interceptor`       | Validação pré-save              |
| `/create-after-interceptor`        | Side effect pós-save            |
| `/create-after-commit-interceptor` | Side effect após commit durável |
| `/create-sync-interceptor`         | Interceptor de operação sync    |
| `/create-controller`               | Endpoint HTTP                   |
| `/create-strategy`                 | Lógica de negócio encapsulada   |
| `/schedule-queued-operation`       | Operação deferred/enfileirada   |
| `/create-custom-interceptor`       | Interceptor por evento nomeado  |
| `/create-custom-page`              | Página HTML por URL (dashboard/relatório) |
| `/use-execution-flags`             | Coordenar regras dentro da requisição |
| `/use-lock-service`                | Lock distribuído (fail-fast)    |
| `/use-cache-service`               | Cache manual entre requisições  |
| `/create-plugin-service`           | Contratos de serviço entre plugins |
| `/generate-sequence-number`        | Numeração sequencial            |
| `/create-notification`             | Notificação para usuários       |
| `/create-timeline-entry`           | Registro na timeline            |
| `/external-user-api`               | API para app externo (portal)   |

### Environment (IA)

| Skill                  | Quando usar                              |
| ---------------------- | ---------------------------------------- |
| `/create-system-tool`  | Ferramenta invocável pelo agente Jeannie |
| `/create-custom-agent` | Agente com suas `CustomTool`s             |
| `/create-environment-action` | `@Action` chamada pelo server/app (APIs externas, rede local) |
| `/create-sync-extraction-action` | Extração para o Sync agendado   |
| `/query-external-datasource` | Consulta sob demanda a datasource do Sync |
| `/format-llm-markdown-output` | Restringe texto markdown gerado por LLM às tags que o app Glyvio renderiza |

### Configuração

| Skill              | Quando usar                                    |
| ------------------ | ---------------------------------------------- |
| `/glyvio-onboarding` | Primeiro acesso: helper, `.env`, `run_helper` e geração dos `@types` |
| `/modify-manifest` | Adicionar permissões ou migrações no manifesto |
| `/release-project` | Build → bump de versão → commit → push         |
| `/configure-report-record` | Relatório configurado no app (sem deploy) |
| `/test-plugin-browser` | Testar o plugin no app publicado via AI bridge |
| `/fork-company-script` | Verificar código do server sem publicar |

---

## Agentes Especializados

| Agente                      | Camada      | Quando usar                                          |
| --------------------------- | ----------- | ---------------------------------------------------- |
| `glyvio-app-coordinator`    | App         | Trabalho completo de UI/UX com múltiplos arquivos    |
| `glyvio-app-chart`          | App         | Criação e customização de gráficos                   |
| `glyvio-server-coordinator` | Server      | Lógica de negócio com múltiplos interceptors         |
| `glyvio-environment-agent`  | Environment | Tools de IA, queries com SyncClient                  |
| `glyvio-report-agent`       | Server      | Dashboards HTML interativos com Plotly.js            |
| `Plan`                      | Qualquer    | Planejar implementações que afetam múltiplas camadas |

> **Skill vs. Agente:** Use uma _skill_ quando sabe exatamente o que criar. Use
> um _agente_ quando precisa de análise ou a tarefa afeta múltiplos arquivos ao
> mesmo tempo.

---

## Scripts

```sh
pnpm build        # instalar deps + build de todas as camadas
pnpm build:fast   # build sem install (deps já instaladas)
pnpm lint         # ESLint + TypeScript check
pnpm pretty       # Prettier — formatar todos os arquivos TS
node <scripts-do-pacote>/i18n_check.mjs .   # ex.: .claude/scripts — chaves/parâmetros de tradução (.arb)
node <scripts-do-pacote>/check_icons.mjs .  # nomes de ícone que o app não desenha
```
