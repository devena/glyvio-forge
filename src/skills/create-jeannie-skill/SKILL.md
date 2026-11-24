---
name: create-jeannie-skill
description: "Cria ou corrige uma skill declarativa de escrita da Jeannie 3.1 para uma empresa ou plugin: mapeia o que a tela grava, define campos, valores automáticos e regras, cabe no limite de chamadas e testa com o modelo em uso conferindo o banco. Use quando a Jeannie precisa cadastrar ou alterar registros de um fluxo de negócio; cobre também as skills só de orientação (prose) e os modelos de relatório (report)."
---
# Skill: Skill de escrita da Jeannie 3.1

Skill é instrução ao modelo mais regras aplicadas pelo serviço. **O que precisa ser garantido vai no bloco JSON; a prosa só orienta.** Modelos mais fracos ignoram prosa com frequência.

## 1. Entrada

- O pedido real do usuário, com as palavras dele.
- Empresa de teste e modelo de produção, informados pelo operador. Comece sempre fora de produção.
- Alcance: só uma empresa ou todas com o plugin.

Onde a skill mora:

| Alcance | Lugar |
|---|---|
| Todas as empresas com o plugin | Bloco `skills` da raiz do `manifest.json` do plugin (formato, recusas e ensaio na skill `modify-manifest`, passo 4) |
| Só uma empresa | Skill de instalação, pela tela de skills da Jeannie ou pela conversa |

Pela conversa, só o administrador e só com o Claude como modelo: ele valida com `preview_skill`, propõe com `propose_skill`, e a skill só é gravada quando o administrador publica pelo cartão. O criador de agentes também propõe a skill que acompanha um agente. Skill de instalação com o mesmo `slug` vence a do plugin.

Se a regra de negócio estiver ambígua, pergunte. Ela costuma não estar nos dados.

## 2. Mapeie o que a tela faz

Antes de escrever, leia o código da tela e as linhas reais:

- Campos obrigatórios e os que a tela preenche sozinha.
- Grupo (`user_group_id`) dos registros existentes. Sem isso, a escrita cai no grupo pessoal, e o time não vê o registro.
- Registros vinculados que a tela cria junto.
- Interceptors do plugin dono e de quem escuta a entidade: financeiro, estoque, integrações. Procure em todos os plugins instalados na empresa, inclusive os do cliente: um item de venda pode reservar estoque.
- Campos `notNull` no manifesto do plugin dono.
- Quais estruturas o negócio usa de fato. Às vezes, o mesmo compromisso vive em duas tabelas.

## 3. Bloco e regras do serviço

Corpo: cerca ` ```jeannie-skill ` com JSON e, depois, prosa em Markdown.

| Limite | Valor |
|---|---|
| JSON | 16 KiB |
| Prosa | 6.000 caracteres em `write` e `report`; 4.000 em `prose`, ou 8.000 numa `prose` só de agente (`apply.when` só com `agent`/`mention`); 2.000 numa extensão (`extends`) |
| Entidades por skill | 4 |
| Campos por skill | 40 |
| `decision` | 300 caracteres |
| `triggers` | 30 |
| `aliases` | 5 |

Cabeçalho: `schemaVersion: 1`, `format: "write"`, `agents`, `aliases`, `decision`, `triggers` sem repetição, `effect`, `policy`. Em cada entidade:

- `fields`: lista fechada do que pode ser gravado.
- `never`: campos proibidos.
- `defaults`: valores do serviço. Ids de catálogo cabem aqui em skill de empresa. Use `$me.id` para responsável.
- `resolve`: SELECT que preenche campo pelo serviço. Use `when: "always"` quando o modelo não deve escolher, como status inicial. SQL sem literal de texto.
- `rules`: `when` e `then`; use `deny` para bloquear mudança de status por conversa.

A entidade precisa estar em `writes.entities`, que vale para a instalação inteira e respeita as permissões do usuário. Libere só o necessário, nunca tudo. Não use a escrita genérica: sem skill, o modelo gasta chamadas descobrindo campos.

`task`, `task_type` e `task_entity` pertencem à `jeannie-tarefas`: uma skill com outro `slug` não consegue declará-las. Para mudar uma skill de plataforma em uma empresa, crie uma versão de instalação com o mesmo `slug`. Ela vale para todos os usuários da empresa e deixa de receber melhorias da padrão: registre isso.

Com o limite de 4 entidades, separe por dono: uma skill para o fluxo comercial e outra para agenda. `deny` também conta como entidade. `defaults` e `resolve` só valem na criação; alteração passa só por `rules`.

Na prosa, cercas de código e marcadores `{{...}}` são removidos, salvo `{{me.*}}`: escreva SQL em linha. Prefira `resolve` a escrever ids de produto ou estoque na prosa, porque catálogo muda.

`triggers`: cada um com 2 a 40 caracteres (letras, dígitos, espaço e hífen). Dois gatilhos que só diferem em caixa, acento ou pontuação contam como repetidos e invalidam a skill (`relatório de vendas` e `relatorio de vendas`). O gatilho casa por palavra inteira, sem caixa e sem acento.

### Skill só de orientação (`format: "prose"`)

O bloco tem só o cabeçalho e `apply`; qualquer outra chave invalida a skill. `apply.when` (texto ou lista) diz quando a prosa entra:

| Valor | Entra quando |
|---|---|
| `trigger` | um dos `triggers` casa com a mensagem de uma conversa comum (exige `triggers`) |
| `mention` | o usuário escreve `#slug` (ou um dos `aliases`) |
| `agent` | uma rodada de agente indica a skill |
| `document` | o turno pede um documento |

**Sem `apply`, vale só `document`: os `triggers` não fazem nada e a skill não entra numa pergunta comum.** Para entrar sozinha quando o usuário pergunta do assunto, use `trigger`:

````
```jeannie-skill
{ "schemaVersion": 1, "format": "prose", "agents": ["jeannie"], "effect": "none", "decision": "quando usar, em uma frase", "triggers": ["funil de vendas", "vendas por status"], "apply": { "when": ["trigger", "mention"] } }
```
Não chame get_database_structure. 1. Rode esta consulta: SELECT ...
````

### Modelo de relatório (`format: "report"`)

O relatório vai num objeto `report` com `mode`, `period`, `queries` e `sections`. Chave fora dessas, inclusive na raiz da skill (salvo `presentation`), invalida a skill. A SQL das consultas-base nunca vai ao modelo.

- `period.default`: `{"preset": "last_7_days" | "last_30_days" | "this_month" | "last_month" | "this_year" | "last_12_months"}` ou `{"days": 1–730}`; `label` opcional.
- `queries`: até 6, cada uma `{name, sql, params, limit?}`. `name` em `[a-z][a-z0-9_]`, até 31. Uma SELECT só leitura, sem literal de texto ou data (exceto a unidade de `date_trunc`/`date_part`). Um `?` por item de `params`, que aceita só `"$period.start"`, `"$period.end"`, `"$period.endExclusive"`, `"$me.id"`, números e booleanos. Toda tabela precisa existir na estrutura da empresa.
- `sections`: de 1 a 12, cada uma `{key, heading, required?, text?}` e no máximo um de `chart`, `table` ou `expects`. `chart`: `{type: bar|line|area|pie, source: <name da consulta>, x, y}`; a pizza usa `labels` e `values`. `table`: `{source, columns: ["col", ...], format: {"col": "currency"|"number"|"integer"|"percent"|"date"|"text"}, total: [...]}`. `kpis`, `layout` e `style` invalidam a skill.

```json
{ "schemaVersion": 1, "format": "report", "agents": ["jeannie"], "effect": "none",
  "report": { "mode": "report",
    "period": { "default": { "preset": "last_30_days" } },
    "queries": [ { "name": "por_status", "sql": "SELECT st.name AS status, count(*) AS qtd, sum(s.total_value) AS valor FROM sale s JOIN sale_type_status st ON st.id = s.sale_status_id WHERE s.deleted = false AND s.created_at >= ? AND s.created_at < ? GROUP BY st.name", "params": ["$period.start", "$period.endExclusive"] } ],
    "sections": [
      { "key": "grafico", "heading": "Vendas por status", "required": true, "chart": { "type": "bar", "source": "por_status", "x": "status", "y": "qtd" } },
      { "key": "tabela", "heading": "Detalhe", "table": { "source": "por_status", "columns": ["status", "qtd", "valor"], "format": { "valor": "currency" } } } ] } }
```

O relatório é usado quando o usuário escreve `#slug` ou pede um documento. O servidor e o `skills-dry-run` aceitam qualquer corpo: quem valida o formato é a Jeannie, na carga. Depois de publicar, confira na tela de skills que ela aparece como válida; a inválida mostra o motivo e fica fora dos turnos.

## 4. Orçamento de chamadas

O padrão do turno é 12 chamadas e 10 rodadas. A configuração da Jeannie pode mudar isso por modelo (`maxToolCalls` de 1 a 60, `maxRounds` de 1 a 40): pergunte ao operador o limite do modelo de produção e planeje para o menor. Faça a conta antes:

- Cada `load_skill`, consulta e gravação conta 1, inclusive a recusada.
- A resposta final consome uma rodada.
- `load_skill` vale só no turno: depois da resposta do usuário, carregue de novo.
- Registros que dependem de id criado antes ficam em rodadas diferentes. O serviço aceita, no mesmo lote, uma referência a registro criado ali com `id` próprio, mas um modelo fraco pode errar esse id: só use depois de testar.
- Junte buscas em uma consulta só, com `UNION ALL`.
- Agrupe `load_skill` com a consulta, na mesma rodada.
- Busca por frase falha. Em catálogo pequeno, traga a lista toda e deixe o modelo escolher. Em catálogo grande, use uma palavra.

Mire em 9 chamadas ou menos e 8 rodadas ou menos, para sobrar folga para correção.

## 5. Prosa para modelo fraco

- Primeira linha: o que substitui regras gerais, como "não chame `get_database_structure`".
- Passos numerados, com SQL exata e campos exatos.
- Copie ids como vieram. Um caractere errado derruba a gravação.
- Com o parâmetro `skill`, `save_records` só aceita entidades daquela skill: mande uma chamada por skill.
- Decida o que é pedido e o que precisa de confirmação.
- Não grave o cliente antes de achar todos os itens: isso deixa cadastro pela metade.
- "Solicitado" não é "criado". Efeito externo, como calendário, não aparece no recibo.
- Nunca diga que salvou sem recibo. Recusa corrigida não é pendência.

## 6. Teste

1. Salve a skill no ambiente de teste, com `writes.entities` em configuração de teste.
2. Prepare catálogos com os mesmos nomes de produção.
3. Rode a conversa real, palavra por palavra, em dois formatos: em vários turnos e em uma mensagem.
4. Use o modelo de produção, com pelo menos 3 repetições na versão final.
5. **Confira o banco, não a resposta:** registros, valores, grupo, responsável, vínculos e campo por campo.
6. Teste uma recusa: pedido que deve perguntar antes de gravar.
7. Teste o desfazer. Ele desfaz uma gravação por vez e não cobre registros alterados depois.
8. Conte chamadas e rodadas.

Ambiente de teste pode não ter tudo: plugin ausente ou integração externa sem conta. Liste o que ficou sem prova.

## 7. Produção

1. Gere o corpo com os ids reais e compare com o salvo. Skill de plugin: rode antes `GET /plugin/{companyId}/{pluginId}/{version}/skills-dry-run` e publique uma versão nova do plugin; o bloco é reconciliado na ativação.
2. Combine o teste com quem usa os dados: gravação real tem efeito real.
3. Use registros marcados como `TESTE`, em conversa nova.
4. Confira cada registro.
5. Limpe pelo desfazer, da última gravação para a primeira. Apagar pela tela pode deixar filhos órfãos.
6. Acompanhe as primeiras conversas reais.

## Sinais de problema

| Sintoma | Causa provável |
|---|---|
| "Limite atingido" repetido | Falta skill, entidade liberada ou o modelo lê estrutura |
| Registro criado e invisível ao time | Grupo pessoal |
| Mesma recusa mudando de campo | Campo obrigatório fora de `fields` |
| Id quase igual ao real | Modelo copiou errado; a mensagem de erro deve pedir conferência |
| Conferir recibo diz que faltou algo | Modelo confundiu recusa corrigida com falha |
