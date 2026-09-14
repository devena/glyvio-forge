# glyvio-forge

Ferramental de IA para desenvolvimento de plugins Glyvio: **56 skills**, **6 agentes**,
as regras arquiteturais e os scripts de inspeção — empacotados para três plataformas
(Claude Code, Antigravity e AGY).

Este repositório **não é um plugin**. Ele produz os arquivos que você instala
*dentro* de um repositório de plugin (`glyvio-plugin-crm`, `glyvio-plugin-project`, …).

👉 **[Catálogo completo de skills e agentes](docs/skills.md)**

---

## Fonte única e geração

```
src/                      ← ÚNICA fonte de verdade. Edite aqui.
├── skills/               56 SKILL.md
├── agents/               6 agentes
├── rules/                architecture_rules.md + catálogo de componentes
├── scripts/              chrome_inspector.js, validate_glyvio_rules.js
├── templates/            CLAUDE.template.md
├── mcp.json
└── plugin.json

         │  node build.js
         ▼
claude/       antigravity/       agy/        ← GERADOS. Nunca edite à mão.
```

```sh
node build.js           # gera as três distribuições
node build.js --check   # falha se a saída estiver dessincronizada (use no CI)
```

As três distribuições são o **mesmo conteúdo** com uma tabela de substituição por
plataforma. A fonte usa tokens `{{...}}`; o gerador os resolve:

| Token | Claude | Antigravity | AGY |
| --- | --- | --- | --- |
| `{{SKILLS_DIR}}` | `.claude/skills` | `antigravity/skills` | `agy/skills` |
| `{{SCRIPTS_DIR}}` | `.claude/scripts` | `antigravity/scripts` | `agy/scripts` |
| `{{REFS_DIR}}` | `.claude/references` | `antigravity/rules/references` | `agy/rules/references` |
| `{{CATALOG}}` | `.claude/component_catalog.md` | `antigravity/rules/component_catalog.md` | `agy/rules/component_catalog.md` |
| `{{RULES}}` | `.claude/architecture_rules.md` | `antigravity/rules/architecture_rules.md` | `agy/rules/architecture_rules.md` |
| `{{TEMP_DIR}}` | `.agents/temp` | `.agents/temp` | `.agents/temp` |
| `{{WRITE_TOOL}}` | ``the `Write` tool`` | `` `write_to_file` `` | `` `write_to_file` `` |
| `{{SHELL_TOOL}}` | ``the `Bash` tool`` | `` `run_command` `` | `` `run_command` `` |
| `{{AGENT_DOC}}` | `CLAUDE.md` | `AGENTS.md` | `AGENTS.md` |
| `{{TOOL_LIST}}` | `Read, Grep, Glob, …` | `view_file, grep_search, …` | `view_file, grep_search, …` |

O frontmatter dos agentes também é emitido por plataforma (`tools:` e `model: opus`
só no Claude; `model: pro` no Antigravity). O AGY recebe apenas o subconjunto de
skills definido em `AGY_SKILLS` no [build.js](build.js).

---

## Instalação num repositório de plugin

### Claude Code

```sh
cd <repo-do-plugin>
cp -R <caminho>/glyvio-forge/claude/. .claude/
cp .claude/CLAUDE.template.md CLAUDE.md     # só na primeira vez
```

O `CLAUDE.md` na raiz é obrigatório: é o único arquivo que o Claude Code carrega
automaticamente. Ele importa `.claude/architecture_rules.md` via `@`. Sem ele, as
regras não-negociáveis **não entram no contexto**.

Para o MCP do Playwright, mescle `.claude/mcp.json` na sua configuração de MCP.

### Antigravity

```sh
cd <repo-do-plugin>
cp -R <caminho>/glyvio-forge/antigravity ./antigravity
cp antigravity/AGENTS.template.md AGENTS.md
```

### AGY

```sh
cd <repo-do-plugin>
cp -R <caminho>/glyvio-forge/agy ./agy
```

> Preferindo symlink ao invés de cópia, aponte para o diretório gerado — assim um
> `git pull` no forge atualiza todos os plugins de uma vez.

---

## Como alterar uma skill

1. Edite `src/skills/<nome>/SKILL.md`. Use os tokens da tabela acima em vez de
   caminhos literais — caminho fixo quebra as outras plataformas.
2. `node build.js`
3. Faça commit de `src/` **e** da saída gerada.

Para criar uma skill nova, crie `src/skills/<nome>/SKILL.md` com frontmatter
`name:` (idêntico ao diretório) e `description:`. O catálogo em
[docs/skills.md](docs/skills.md) é regenerado sozinho.

---

## Scripts

| Script | O que faz |
| --- | --- |
| `validate_glyvio_rules.js` | Linter estático das regras arquiteturais sobre `plugin/app/src`. Rode a partir da raiz do plugin. |
| `chrome_inspector.js` | Captura o design JSON de uma view em execução via Chrome DevTools (porta 9222), para as skills `*-interceptor`. Grava em `.agents/temp/`. |

Ambos resolvem caminhos a partir de `process.cwd()` — execute-os **da raiz do
repositório do plugin**, não de dentro do diretório de skills.

---

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| [docs/skills.md](docs/skills.md) | Catálogo de skills e agentes (gerado) |
| [docs/examples/](docs/examples/) | 19 exemplos de código por camada |
| [docs/guia-do-desenvolvedor.html](docs/guia-do-desenvolvedor.html) | Guia do desenvolvedor |
| [docs/plugin-template-README.md](docs/plugin-template-README.md) | README modelo para o repositório de um plugin |
| `src/rules/architecture_rules.md` | Regras não-negociáveis e gotchas de runtime |

---

## tools/test-runner

Configuração de ambiente para testes automatizados contra o Glyvio App publicado
(usada pela skill `/test-plugin-browser`). Copie `.env.test.example` para `.env`
e preencha. Os arquivos com segredo são ignorados pelo git — **nunca** cole
credenciais no chat nem as versione.
