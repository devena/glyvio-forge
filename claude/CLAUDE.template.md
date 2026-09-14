# CLAUDE.md — plugin Glyvio

> Copie este arquivo para a **raiz do repositório do plugin** como `CLAUDE.md`.
> Ele é o único ponto que o Claude Code carrega automaticamente em toda sessão —
> sem ele, as regras arquiteturais em `.claude/architecture_rules.md` **não entram no contexto**.

Este é um plugin Glyvio: monorepo TypeScript em três camadas — `plugin/app`
(frontend), `plugin/server` (backend) e `plugin/environment` (IA).

## Regras arquiteturais

@.claude/architecture_rules.md

## Catálogo de componentes

Ao escolher um componente de UI, consulte o catálogo antes de escrever código:

- `.claude/component_catalog.md` — índice rápido "o que parece → qual classe"
- `.claude/references/component_catalog_full.md` — props, hierarquia e exemplos

## Comandos

```sh
pnpm build        # instala deps + build de todas as camadas
pnpm build:fast   # build sem install
pnpm lint         # ESLint + checagem de tipos
./run_helper.sh   # regenera tipos após editar manifest.json
```

## Validação

Depois de mexer em `plugin/app/src`, rode o linter arquitetural:

```sh
node .claude/scripts/validate_glyvio_rules.js
```

## Versionamento

Quando eu pedir para **"atualizar a versão"**, "subir a versão", "versionar",
"fazer um release" ou qualquer formulação equivalente, use a skill
`/release-project`. Ela faz, nesta ordem: build → bump do patch em
`package.json` → atualiza o `CHANGELOG.md` → commit com mensagem gerada a partir
do diff → push para `origin`.

Não faça o commit/bump/push à mão nesse caso — pular a skill pula o build e o
changelog.

## Notas do projeto

<!-- Anote aqui gotchas específicos deste plugin conforme forem descobertos. -->
