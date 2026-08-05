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

Após editar `manifest.json`, rode `./run_helper.sh` na raiz para regenerar
`entity.d.ts`, `glyvio_structure.d.ts` e `service.ts`.

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
> entidades — nunca `new glyvio_entity.Erp()`.
>
> Em interpolações de design, use o caminho joined: `item.client.name`, nunca
> `item.clientId`.

### 3. Camada Server — Backend

Interceptors são **descobertos automaticamente** pelo Webpack — sem registro
manual em `index.ts`.

**BeforeInterceptor** — valida antes do save, pode cancelar:

```ts
@glyvio_core.BeforeInterceptor({ entity: "sale", id: "sale-minimum-value" })
export class SaleMinimumValueInterceptor
  extends glyvio_core.SimpleBeforeInterceptor<glyvio_entity.Sale> {
  async handleBefore(value: glyvio_entity.Sale, ctx: Context) {
    if (value.totalValue < 100) {
      throw new glyvio_core.GlyvioError("Valor mínimo de R$ 100,00");
    }
    return value;
  }
}
```

**AfterInterceptor** — side effects pós-save (notificações, audit trail,
denormalização):

```ts
@glyvio_core.AfterInterceptor({ entity: 'client', id: 'client-notify-deleted' })
export class ClientNotifyDeletedInterceptor
  extends glyvio_core.SimpleAfterInterceptor<glyvio_entity.Client> {

  async handleAfter(value: glyvio_entity.Client, ctx: Context) {
    if (!value.deletedAt) return;
    await crm.GenerateNotificationStrategy.pushToQueue({ entityId: value.id, ... });
  }
}
```

**AfterCommitInterceptor** — executa após commit durável (use para webhooks,
filas externas, emails).

**Controller** — endpoint HTTP decorado com
`@glyvio_core.Controller({ path, allowPrivateAccess })`.

UUIDs de status e grupos ficam centralizados em `plugin/server/src/constants.ts`
— nunca hardcode inline.

### 4. Camada Environment — IA

Tools são **descobertas automaticamente** via decorador — sem registro manual.

```ts
@glyvio_core.SystemTool({
  id: "company-daily-briefing",
  permission: Permissions.TOOL_DAILY_BRIEFING,
  description: "Retorna o briefing diário do usuário",
})
export class DailyBriefingTool implements glyvio_core.CoreSystemTool {
  async handle() {
    const userId = glyvio_core.getContext().loggedUserId;
    return TaskService.getInstance().fetchToday(userId);
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
| App         | Pages / Modals / Carts                    | Explícito em `index.ts` via `routerService.loadRoutes()`                   |
| App         | Interceptors de app                       | Explícito em `index.ts` via `appInterceptorService.registerInterceptors()` |
| App         | Menu items                                | Explícito em `index.ts` via `FullMenuPage.fullMenuGroupAdd()`              |
| Server      | Before / After / AfterCommit Interceptors | Descoberta automática via decorador                                        |
| Server      | Controllers                               | Descoberta automática via decorador                                        |
| Environment | SystemTool / CustomTool                   | Descoberta automática via decorador                                        |

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
| `/create-screen-from-image`   | Reproduz um screenshot como tela Glyvio |
| `/create-*-interceptor` (app) | Estende view existente do CRM           |

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

### Environment (IA)

| Skill                  | Quando usar                              |
| ---------------------- | ---------------------------------------- |
| `/create-system-tool`  | Ferramenta invocável pelo agente Jeannie |
| `/create-custom-tool`  | Tool customizada de roteamento           |
| `/create-custom-agent` | Agente com tools próprias                |
| `/format-llm-markdown-output` | Restringe texto markdown gerado por LLM às tags que o `glyvio_app` renderiza |

### Configuração

| Skill              | Quando usar                                    |
| ------------------ | ---------------------------------------------- |
| `/modify-manifest` | Adicionar permissões ou migrações no manifesto |
| `/release-project` | Build → bump de versão → commit → push         |

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
./build_all.sh    # build de todos os plugins do monorepo pai
./release_all.sh  # release de todos os plugins
```
