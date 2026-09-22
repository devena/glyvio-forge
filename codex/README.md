<!-- Generated from src/adapters/codex/files/README.md by tools/generate.py. Edit the source, not this file. -->
# Glyvio para Codex

Pacote gerado a partir dos **6 agents e 56 skills específicos do Glyvio** em `src/`.
São instruções e referências carregadas no contexto do Codex, não treinamento dos
pesos do modelo. O conteúdo técnico e os exemplos do Glyvio foram preservados,
incluindo as diferenças reconciliadas entre Claude e Antigravity. Para atualizar
o pacote no Glyvio Forge, edite `src/` e execute `python3 tools/generate.py`.

## Estrutura

```text
codex/
├── AGENTS.md               # Roteamento e convenções comuns
├── agents/*.toml           # 6 agentes personalizados nativos do Codex
├── skills/*/SKILL.md        # 56 workflows do Glyvio
├── component_catalog.md    # Catálogo visual resumido
├── references/             # Catálogo completo
├── scripts/                # Linter Glyvio e inspetor Chrome
└── mcp.example.toml         # Exemplo opcional de configuração MCP
```

## Instalação em um projeto Glyvio

A pasta `codex/` é o pacote de distribuição gerado. Apenas colocá-la no projeto não registra
automaticamente todos os agents e skills.

1. Copie esta pasta para `<projeto>/codex/`, mantendo esse nome: os caminhos nas
   instruções partem da raiz do projeto.
2. No `AGENTS.md` da **raiz do projeto**, acrescente o trecho abaixo. Se já houver
   instruções, preserve-as e resolva eventuais conflitos de escopo.
3. Para disponibilizar os agents para delegação, copie os seis arquivos
   `codex/agents/*.toml` para `.codex/agents/` no projeto. Preserve configurações
   existentes e mantenha essas cópias sincronizadas quando atualizar o pacote.
4. Para descoberta das skills e uso por `$nome`, crie `.agents/skills/` e, para
   cada pasta de `codex/skills/`, crie um link simbólico com o mesmo nome apontando
   para `../../codex/skills/<nome>`. Alternativamente, copie as pastas completas.
   Não substitua skills existentes sem comparar seu conteúdo.
5. Inicie uma nova sessão do Codex no projeto. O ambiente precisa carregar a
   configuração desse projeto e permitir subagents para utilizar a delegação.
   Se não permitir, o roteamento em `AGENTS.md` permite aplicar os mesmos prompts
   no agente principal.

Trecho para o `AGENTS.md` da raiz:

```markdown
## Desenvolvimento Glyvio

Para tarefas Glyvio, leia `codex/AGENTS.md` e aplique o papel e as skills
correspondentes à camada e à operação solicitadas.
```

Exemplo de um link, executado na raiz do projeto e **somente se o destino não existir**:

```bash
mkdir -p .agents/skills
ln -s ../../codex/skills/create-controller .agents/skills/create-controller
```

Exemplos de uso após instalação:

- `Use $create-controller para criar um endpoint privado de consulta de pedidos.`
- `Aplique glyvio-app-coordinator para implementar uma página de clientes.`
- `Use $audit-sync-task-query para revisar esta consulta de sincronização.`

O uso de `.codex/agents/*.toml` segue a [documentação oficial de subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
A descoberta em `.agents/skills/` e os arquivos `SKILL.md` seguem a
[documentação oficial de skills](https://learn.chatgpt.com/docs/build-skills).

## Adaptações realizadas

- Frontmatter de agents (`tools`, `model: opus`) convertido em `name`, `description`
  e `developer_instructions` no TOML. Modelo, permissões e ferramentas são herdados
  da sessão; o pacote não fixa um modelo OpenAI nem altera o sandbox.
- Instruções de ferramentas do Claude adaptadas para leitura, edição, shell e
  inspeção de imagens disponíveis no Codex. Skills são lidas e aplicadas; não há
  dependência de uma ferramenta chamada `Skill`.
- Referências `.claude/` convertidas para `codex/`; temporários padronizados em
  `codex/temp/`. Referências entre agents apontam para os respectivos TOMLs.
- Fluxos de coordenação preservados com execução local quando delegação não estiver
  disponível ou autorizada. Regras do pacote respeitam a hierarquia da sessão.
- Caminhos de `/home/ubuntu/` removidos do teste de navegador. O inspetor Chrome
  resolve `package.json` e `plugin/app/dist` a partir da raiz do projeto em que o
  comando é executado, e grava no mesmo caminho documentado pelas skills.
- `mcp.json` convertido em exemplo TOML opcional, sem instalar ou iniciar serviços.

## Escopo e dependências

`claude/skills/synced/` contém 16 entradas genéricas em duas coleções, com nomes
repetidos (PDF, Word, PowerPoint, planilhas, documentos, memória, morning e
skill-creator). Está fora do Git e não integra as 56 skills específicas do Glyvio.
Foi deixada fora desta adaptação; não houve consolidação nem remoção da origem.
Arquivos `.DS_Store` também foram omitidos.

Os projetos de destino precisam fornecer seus próprios `manifest.json`, pacotes,
`@types`, scripts de build e `run_helper.sh`. Esses recursos não existem nesta
pasta de instruções e não são gerados pela migração.

`test-plugin-browser` referencia o runner do Glyvio Forge, que não está incluído
neste pacote. A skill explica a dependência e mantém o template alternativo.
Testes ao vivo dependem do navegador, credenciais locais e AI bridge habilitada.
O inspetor legado também exige Chrome com depuração remota, Node com `fetch` e
`WebSocket` globais e `npx`/`httpster`; ele altera o override e preferências locais
da sessão do navegador. Execute-o somente no contexto do teste solicitado.

O catálogo completo cita exemplos do Glyvio Core e imagens ainda não produzidas.
São referências externas/pendências herdadas, não arquivos incluídos no pacote.
Os exemplos e regras devem ser conferidos contra os tipos do plugin de destino.

A configuração MCP preserva o pacote usado pela origem; sua disponibilidade não
foi validada nesta migração. Não é necessária para ler os agents e skills.

## Inventário dos agents

| Origem em `src/agents/` | Versão em `codex/agents/` |
| --- | --- |
| `glyvio-app-chart.md` | [glyvio-app-chart.toml](agents/glyvio-app-chart.toml) |
| `glyvio-app-coordinator.md` | [glyvio-app-coordinator.toml](agents/glyvio-app-coordinator.toml) |
| `glyvio-doc-agent.md` | [glyvio-doc-agent.toml](agents/glyvio-doc-agent.toml) |
| `glyvio-environment-agent.md` | [glyvio-environment-agent.toml](agents/glyvio-environment-agent.toml) |
| `glyvio-report-agent.md` | [glyvio-report-agent.toml](agents/glyvio-report-agent.toml) |
| `glyvio-server-coordinator.md` | [glyvio-server-coordinator.toml](agents/glyvio-server-coordinator.toml) |

## Inventário das skills

Todas correspondem às pastas de mesmo nome em `src/skills/`.

- [audit-sync-task-query](skills/audit-sync-task-query/SKILL.md)
- [create-after-commit-interceptor](skills/create-after-commit-interceptor/SKILL.md)
- [create-after-interceptor](skills/create-after-interceptor/SKILL.md)
- [create-app-strategy](skills/create-app-strategy/SKILL.md)
- [create-batch-filter-modal](skills/create-batch-filter-modal/SKILL.md)
- [create-batch-page](skills/create-batch-page/SKILL.md)
- [create-batch-page-interceptor](skills/create-batch-page-interceptor/SKILL.md)
- [create-before-interceptor](skills/create-before-interceptor/SKILL.md)
- [create-calendar-page](skills/create-calendar-page/SKILL.md)
- [create-calendar-page-interceptor](skills/create-calendar-page-interceptor/SKILL.md)
- [create-controller](skills/create-controller/SKILL.md)
- [create-custom-agent](skills/create-custom-agent/SKILL.md)
- [create-custom-interceptor](skills/create-custom-interceptor/SKILL.md)
- [create-edit-modal](skills/create-edit-modal/SKILL.md)
- [create-edit-modal-interceptor](skills/create-edit-modal-interceptor/SKILL.md)
- [create-entity-links-section](skills/create-entity-links-section/SKILL.md)
- [create-entity-modal](skills/create-entity-modal/SKILL.md)
- [create-entity-modal-interceptor](skills/create-entity-modal-interceptor/SKILL.md)
- [create-gantt-page](skills/create-gantt-page/SKILL.md)
- [create-gantt-page-interceptor](skills/create-gantt-page-interceptor/SKILL.md)
- [create-grid-page](skills/create-grid-page/SKILL.md)
- [create-grid-page-interceptor](skills/create-grid-page-interceptor/SKILL.md)
- [create-kanban-page](skills/create-kanban-page/SKILL.md)
- [create-kanban-page-interceptor](skills/create-kanban-page-interceptor/SKILL.md)
- [create-list-modal](skills/create-list-modal/SKILL.md)
- [create-list-modal-interceptor](skills/create-list-modal-interceptor/SKILL.md)
- [create-list-page](skills/create-list-page/SKILL.md)
- [create-list-page-interceptor](skills/create-list-page-interceptor/SKILL.md)
- [create-notification](skills/create-notification/SKILL.md)
- [create-screen-from-image](skills/create-screen-from-image/SKILL.md)
- [create-send-modal](skills/create-send-modal/SKILL.md)
- [create-send-modal-interceptor](skills/create-send-modal-interceptor/SKILL.md)
- [create-sidebar](skills/create-sidebar/SKILL.md)
- [create-sidebar-interceptor](skills/create-sidebar-interceptor/SKILL.md)
- [create-simple-batch-cart](skills/create-simple-batch-cart/SKILL.md)
- [create-simple-cart](skills/create-simple-cart/SKILL.md)
- [create-simple-cart-interceptor](skills/create-simple-cart-interceptor/SKILL.md)
- [create-strategy](skills/create-strategy/SKILL.md)
- [create-sync-interceptor](skills/create-sync-interceptor/SKILL.md)
- [create-system-tool](skills/create-system-tool/SKILL.md)
- [create-tab-sidebar](skills/create-tab-sidebar/SKILL.md)
- [create-tab-sidebar-interceptor](skills/create-tab-sidebar-interceptor/SKILL.md)
- [create-table-entity-modal](skills/create-table-entity-modal/SKILL.md)
- [create-table-modal](skills/create-table-modal/SKILL.md)
- [create-table-modal-interceptor](skills/create-table-modal-interceptor/SKILL.md)
- [create-table-page](skills/create-table-page/SKILL.md)
- [create-table-page-interceptor](skills/create-table-page-interceptor/SKILL.md)
- [create-timeline-entry](skills/create-timeline-entry/SKILL.md)
- [external-user-api](skills/external-user-api/SKILL.md)
- [fork-company-script](skills/fork-company-script/SKILL.md)
- [format-llm-markdown-output](skills/format-llm-markdown-output/SKILL.md)
- [modify-manifest](skills/modify-manifest/SKILL.md)
- [query-external-datasource](skills/query-external-datasource/SKILL.md)
- [release-project](skills/release-project/SKILL.md)
- [schedule-queued-operation](skills/schedule-queued-operation/SKILL.md)
- [test-plugin-browser](skills/test-plugin-browser/SKILL.md)
