# Glyvio Forge

Base de agents, skills, referências e exemplos para desenvolver no Glyvio com
Claude, Codex e Antigravity. O conteúdo compartilhado é mantido em **`src/`**;
as pastas dos assistentes são geradas e continuam prontas para distribuição.

## Estrutura

```text
src/
├── agents/                 # 6 papéis, com instruções independentes do assistente
├── skills/                 # Skills compartilhadas
├── component_catalog.md    # Índice visual
├── references/             # Catálogo completo e regras arquiteturais
├── scripts/                # Helpers compartilhados
├── examples/               # Exemplos por camada
├── plugin-development.md   # Guia de desenvolvimento de plugins
├── mcp.json                # Configuração MCP compartilhada
└── adapters/
    ├── claude/             # Modelo, ferramentas, nomes e caminhos do Claude
    ├── codex/              # TOML, instruções de execução e instalação
    ├── antigravity/        # Metadados e layout do Antigravity
    ├── agy/                # Seleção reduzida de skills para o pacote legado
    └── opencode/           # Configuração e layout nativos do OpenCode V2

tools/generate.py           # Geração determinística e verificação de divergências
tools/tests/                # Testes do gerador em diretórios temporários
.generated-files.json      # Arquivos gerenciados e hashes da última geração
claude/                    # Gerado
codex/                     # Gerado
antigravity/                # Gerado
agy/                       # Gerado; mantém as 3 skills do pacote legado
opencode/                  # Gerado; bundle nativo para .opencode/
docs/examples/             # Gerado de src/examples/
docs/plugin-development.md # Gerado de src/plugin-development.md
```

O [guia de desenvolvimento de plugins](docs/plugin-development.md) contém a
arquitetura app/server/environment, as convenções e os comandos dos projetos
Glyvio. Esses comandos de build pertencem aos plugins, não a este repositório.

## Alterar e gerar

Requer **Python 3.11 ou superior**, sem dependências Python adicionais.

1. Edite a skill, agent, referência, helper ou exemplo em `src/`.
2. Execute:

```bash
python3 tools/generate.py
python3 tools/generate.py --check
python3 -m unittest discover -s tools/tests -v
```

3. Revise o diff e inclua na mesma entrega `src/`, os arquivos gerados e
   `.generated-files.json`. A checagem também é executada no CI.

`--check` não escreve arquivos e retorna erro quando uma saída está ausente,
alterada ou desatualizada. A geração só remove arquivos anteriormente gerenciados
que deixaram de ter origem; nunca limpa as pastas inteiras.

Se alguém editar diretamente uma saída, o gerador recusa sobrescrevê-la.
Transfira a alteração para a fonte correspondente em `src/`, confira o diff e
restaure **somente aquela saída** à versão gerada anterior, ou mova-a para um
backup fora do caminho gerenciado. Depois gere novamente. Não edite o manifesto
manualmente nem reverta outras alterações para contornar essa proteção.

## Onde editar

| Mudança | Fonte |
| --- | --- |
| Regra ou procedimento do Glyvio | `src/agents/`, `src/skills/` ou `src/references/` |
| Exemplo de código | `src/examples/` |
| Modelo, ferramentas, seleção de skills e nomes dos arquivos | `src/adapters/<assistente>/config.json` |
| Orientações específicas de instalação ou execução | `src/adapters/<assistente>/files/` ou `preamble.md` |
| Conversão de formatos e caminhos | `tools/generate.py` |

Os headers canônicos de agents e skills contêm apenas `name` e `description`.
Use strings JSON de uma linha entre aspas duplas (válidas em YAML), especialmente
quando houver dois-pontos ou aspas na descrição. Metadados exclusivos do assistente
ficam no adapter. Uma skill nova em `src/skills/<nome>/SKILL.md` entra automaticamente
nos três pacotes completos; o AGY usa uma lista explícita. Um agent novo exige
adicionar seu nome aos três adapters completos.

Os únicos placeholders de empacotamento são `@@ASSISTANT@@`, `@@REFERENCES@@`,
`@@ARCHITECTURE@@`, `@@CATALOG@@`, `@@SKILLS@@`, `@@SCRIPTS@@`, `@@TEMP@@`,
`@@PROJECT_INSTRUCTIONS@@` e `@@AGENT:nome-do-agent@@`. O gerador resolve esses
valores por assistente e falha se restar algum placeholder. Interpolações do
Glyvio, como `$S{...}`, `$T{...}` e Handlebars, são preservadas.
Recursos não Markdown dentro das skills são copiados byte a byte.

## Distribuição

- **Claude:** distribua o conteúdo de `claude/` em `.claude/` no projeto de destino;
  os caminhos das instruções seguem essa convenção já usada pelo pacote.
- **Codex:** siga o [guia do pacote](codex/README.md).
- **Antigravity:** o conteúdo usa caminhos relativos a `antigravity/` no projeto;
  preserve a estrutura ao distribuí-lo pelo mecanismo usado pela equipe.
- **AGY:** `agy/` mantém o pacote legado reduzido, com caminhos de execução em
  `.agents/`. A instalação local `.agents/` deste checkout não é atualizada pelo gerador.
- **OpenCode:** copie `opencode/.opencode/` para `.opencode/` no projeto de destino e
  mescle `opencode/AGENTS.md` no `AGENTS.md` da raiz. Veja `opencode/README.md`.

A geração monta arquivos para distribuição; não instala pacotes em outros
projetos, não inicia MCPs e não altera configurações pessoais dos assistentes.

## Reconciliação e limites

Veja [as decisões da migração](docs/reconciliation.md): o conteúdo foi reconciliado
entre Claude, Antigravity, AGY e a adaptação para Codex, preservando as alterações
locais de controllers, árvores e master-detail.

`claude/skills/synced/`, `.agents/`, credenciais, caches e scripts locais do
`tools/test-runner/` não são fontes nem saídas gerenciadas. O runner continua sendo
uma dependência opcional dos testes de navegador. O guia HTML em `docs/` também
permanece independente; não é regenerado a partir de `src/` nesta migração.

A validação do pacote verifica formatos, cobertura, caminhos e propagação das
instruções. Ela não substitui a compilação dos exemplos contra os tipos da versão
Glyvio do projeto-alvo nem os testes ao vivo com a AI bridge.
