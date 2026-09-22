# Reconciliação da base compartilhada

A migração parte do estado local em 2026-09-21, sobre o commit `4c7b3a2`, incluindo
as oito alterações de arquivos versionados já presentes antes deste trabalho.
O histórico registra um conversor em `c73391c` (14/07), removido em `5630412`
(11/08). O novo fluxo retoma a geração com uma base neutra em `src/`.

## Decisões de conteúdo

| Área | Diferença encontrada | Decisão na fonte comum |
| --- | --- | --- |
| Skills | 56 nomes comuns; 34 arquivos idênticos e 22 diferentes entre Claude e Antigravity | Manter uma única definição de cada skill; separar caminhos e ferramentas das regras do Glyvio |
| Edit modal e batch filter | Antigravity documentava o problema ao adicionar itens em `ChoiceMultipleTextfieldDesign` | Preservar o alerta e sua referência no catálogo em todos os pacotes; o relato é de 2026-09, não uma revalidação do framework atual |
| Catálogo completo | Claude tinha master-detail, comunicação entre side panels e larguras; Antigravity tinha o alerta de seleção múltipla | Unir os dois conteúdos e preservar a inclusão local de `TreeLayoutDesign` |
| Catálogo resumido | Antigravity tinha Gantt, sidebars com abas, carts, links e observação sobre chips; Claude tinha master-detail | Unir as entradas sem retirar as de qualquer uma das fontes |
| Coordenador de app | Antigravity detalhava `dynamic` no Dart versus `string` nos tipos TS e acrescentava referências ao catálogo completo | Incorporar esses detalhes à definição comum |
| Outros agents | Diferenças de frontmatter, ferramentas, nomes e caminhos | Preservar a instrução de domínio; mover formato/modelo/ferramentas para adapters |
| Teste de navegador | Claude tinha credenciais via `.env`, prints por etapa, unwrap, gotchas e navegação em cascata ausentes no Antigravity/AGY | Usar o procedimento completo, com os caminhos portáveis da adaptação Codex e a alternativa quando o runner não estiver disponível |
| Controllers | Alterações locais corrigiam chamadas para `restService.postController/putController/getController` | Preservar integralmente a correção na skill e no exemplo compartilhado |
| Regras arquiteturais | Arquivo consolidado existia apenas no Antigravity | Levar para `src/references/architecture_rules.md` e disponibilizar a todos os pacotes |
| API externa | `CLAUDE.md` versus `AGENTS.md` | Resolver com `@@PROJECT_INSTRUCTIONS@@`: Claude usa o primeiro; Codex, Antigravity e AGY usam o segundo |
| Inspetor Chrome | Caminhos divergentes para o projeto e para os temporários | Resolver o projeto pelo diretório de execução e usar o mesmo diretório temporário documentado em cada pacote; rejeitar nomes de view inválidos |
| Registro server | Guia antigo dizia descoberta automática; outras regras exigiam exports e algumas ainda citavam `behavior_listeners` | Unificar em `plugin/server/src/index.ts`, conforme o coordenador server e as seções principais das skills; o decorator precisa de seu módulo incluído no bundle |
| Release | `git add -A` contradizia as instruções de preservar trabalho de outras sessões | Selecionar os arquivos da entrega e interromper se houver staging alheio; mensagem de commit por arquivo |
| Exemplos | Índice apontava para skills e exemplos inexistentes | Corrigir links para as fontes de skills; identificar os exemplos ausentes sem criar conteúdo fictício |

As regras de runtime foram reconciliadas a partir da documentação existente.
Não houve acesso a produção, execução dos testes de navegador nem compilação dos
exemplos contra um Glyvio Core externo. Os tipos e o runtime do projeto-alvo
continuam sendo a confirmação necessária para diferenças entre versões.

## Distribuição preservada

- Claude, Codex e Antigravity: seis agents e 56 skills cada.
- AGY: as três skills existentes; as referências e scripts são gerados da mesma base.
- Exemplos: `src/examples/` gera `docs/examples/`.
- Guia antes mantido no README da raiz: fonte em `src/plugin-development.md`, saída
  em `docs/plugin-development.md`. O README da raiz passa a documentar o Forge.
- Catálogos e helpers: uma fonte comum, com caminhos resolvidos pelo adapter.
- MCP: uma configuração fonte; JSON para os pacotes existentes e TOML de exemplo
  para Codex, sem alterar os comandos do servidor nem instalá-lo.

`.agents/`, `claude/skills/synced/`, caches, credenciais e arquivos locais do runner
permanecem intactos. As configurações `opus`/`pro` dos pacotes existentes foram
preservadas; Codex herda o modelo e as permissões da sessão.

## Manutenção futura

Os arquivos gerados identificam a fonte em seu cabeçalho quando o formato permite.
`.generated-files.json` registra os hashes, sem timestamps, para detectar edições
locais e retirar somente saídas obsoletas que continuem iguais à última geração.
O manifesto deve ser versionado junto com as fontes e os pacotes.
