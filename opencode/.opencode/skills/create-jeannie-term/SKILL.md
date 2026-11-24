---
name: create-jeannie-term
description: "Cria ou corrige um termo de negócio da Jeannie 3.1 a partir de perguntas reais: decide entre plugin e empresa, escreve definição e SQL, confere campos e datas contra os dados e testa com o modelo em uso. Use quando a Jeannie responde errado por não saber o que um conceito significa."
---
<!-- Generated from src/skills/create-jeannie-term/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Skill: Termo de negócio da Jeannie 3.1

Um termo diz à Jeannie o que um conceito significa, onde ele está e como calcular. Termo errado é pior que resposta errada: ele se repete em toda conversa com aparência de regra aprovada.

## 1. Entrada

Colete antes de escrever:

- As perguntas reais do usuário, com as palavras dele.
- Ambiente de leitura e ambiente de teste, informados pelo operador. Nunca teste em produção.
- O número certo para pelo menos um período, de fonte independente da Jeannie.

Sem uma resposta conhecida, pergunte ao operador. Não invente o oráculo.

## 2. Onde o termo mora

| Conceito | Lugar |
|---|---|
| Vale em qualquer empresa com aquele plugin | Plugin dono do universo, no bloco `terms` da raiz do `manifest.json` |
| Entidade do core, que é somente leitura | Plugin da Jeannie |
| Nome próprio da empresa: agente, canal, carteira, regra local | Termo de empresa, cadastrado pela tela de termos ou pela conversa |

Confirme o dono procurando a entidade em `manifest.json` do plugin, nunca pelo nome da tabela.

Termo de empresa pela conversa: só o administrador. A Jeannie investiga e mostra um cartão com o termo, a verificação da SQL e um teste; nada é gravado sem o clique em **Salvar** do cartão. Com o Claude como modelo, o administrador também recebe o rascunho pelo `propose_term`, inclusive na janela de resolução. O cartão só publica termo de empresa: termo de plugin sempre passa pelo repositório do plugin.

Precedência: usuário > grupo > empresa > plugin (bloco `terms`) > legado (`data[]`). **Termo de empresa com o mesmo nome esconde o do plugin.** Antes de publicar, liste os termos ativos. Se houver colisão, a correção do plugin não vale até o termo de empresa ser ajustado ou retirado. Retirar antes de publicar deixa valer a versão antiga do plugin.

## 3. Nome e sinônimos

O nome traz o universo: `pontos de atenção do atendimento`, nunca `pontos de atenção`. Venda e compra têm pontos de atenção próprios. Evite alias de uma palavra só que exista em outro universo. Inclua as palavras reais do usuário. O seletor ignora caixa e acento, e cada palavra da forma precisa aparecer na pergunta; a partir de 4 letras, vale prefixo, então `atendimento` casa `atendimentos`. Erro de digitação não casa: não crie alias para isso. Para checar colisão, liste os termos ativos pela tela ou pelos termos dos outros plugins.

## 4. Confira os dados antes de definir

Rode em leitura e anote:

1. **Preenchimento:** `count(*)`, `count(coluna)` e valores distintos de cada coluna usada. Coluna sempre igual ou quase vazia não serve de filtro, mesmo com nome convincente.
2. **Datas:** compare o mesmo período em cada coluna de data da tabela. Uma diferença grande costuma indicar que o campo escolhido mede outra coisa.
3. **Valores reais:** liste os status antes de citar nomes. Nunca confie em exemplo de outra empresa.
4. **Escala:** mínimo e máximo de notas. Diga se maior é melhor, com base no código que gera o dado ou na correlação com o status.
5. **Cobertura:** quanto do total tem a informação, por canal ou tipo. Se a fonte cobre só parte, a SQL traz o total para a resposta dizer a proporção.

## 5. Definição e SQL

- Limites da Jeannie, conferidos a cada carga: nome até 64 caracteres; `meaning` até 500; até 10 aliases de até 64 caracteres; `entities` obrigatório, com até 10 tabelas; `metric`, `dateField` e `statusFilter` até 200; SQL até 2.000 caracteres e até 20 marcadores `?`. O servidor aceita mais na ativação, mas o termo que passa dos limites da Jeannie fica fora do vocabulário sem aviso na ativação.
- A definição cita todo filtro que a SQL aplica. O usuário aprova o texto, não a consulta.
- Diga o que **não** usar: tabela vazia, campo enganoso.
- **Se a resposta precisa de dois números, a SQL traz os dois.** Pedir em texto que o modelo calcule o segundo produz número inventado. Texto orienta; SQL garante.
- Traga contagens no mesmo grão da pergunta, como por canal.
- Sem `now()` nem `current_date`: datas são parâmetros, em `timestamptz`, com início incluído e fim excluído. O modelo resolve "ontem" e o fuso.
- Uma única consulta de leitura (`SELECT` ou `WITH ... SELECT`). Nenhum valor fixo: texto, status, tipo de agente, datas e números fora de 0 e 1 vão por `?`. Ficam de fora o argumento de `LIMIT`/`OFFSET`, as posições de `ORDER BY 2`/`GROUP BY 1`, os argumentos de tipo (`numeric(10,2)`) e `true`/`false`. `round(x, 2)` tem literal: use `round(x, ?)` ou deixe o arredondamento para a resposta. Literal tipado (`INTERVAL '1 month'`, `DATE '2026-01-01'`) é recusado: use `?::interval` ou `?::date`. Termo com literal fica fora do vocabulário.
- `?::timestamptz` é um marcador, de tipo `TIMESTAMP`. `paramTypes` precisa ter um tipo por marcador, na ordem, entre `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `TIMESTAMP` e `JSON`.

No plugin, o termo é uma entrada do bloco `terms` da raiz do `manifest.json` (formato completo, recusas e ensaio na skill `modify-manifest`, passo 6):

```json
{ "key": "conceito", "language": "pt", "term": "nome como o usuário fala", "aliases": ["..."], "meaning": "...", "entities": ["tabela"], "metric": "o que mede", "dateField": "tabela.coluna", "sqlExample": "SELECT ... WHERE criado_em >= ?::timestamptz AND criado_em < ?::timestamptz", "paramTypes": ["TIMESTAMP", "TIMESTAMP"], "version": 1 }
```

- `key` é a identidade da linha: não mude depois de publicado. Renomear `term` mantém a linha.
- `language`: só `pt`, `en` ou `*`. O servidor aceita `pt-BR`, mas a Jeannie não lê esse termo.
- O servidor reconcilia o bloco a cada ativação. Termo igual não muda nada; termo alterado vira revisão nova; termo que sai do manifesto **continua valendo**. Para tirar, declare `{"key", "language", "retire": true, "reason"}`.
- O conflito entre plugins é pelo nome normalizado (caixa, acento e espaços) e idioma: vale o último plugin que publicou.
- A Jeannie carrega no máximo 60 termos de plugin por empresa e idioma, somando todos os plugins. Conte os que já existem antes de acrescentar.
- Termo em `data[]` da tabela `jeannie3_plugin_term` é o formato antigo. Ele ainda é lido como legado, abaixo do bloco, mas um `dbVersion` processado nunca é reaplicado: não crie termo novo assim e migre os antigos para o bloco.
- Com muitos termos, mantenha um arquivo por termo no repositório e um script que monta o bloco e confere os limites da Jeannie antes do commit. Não edite o bloco gerado à mão.

Pergunta que depende da conversa, como "o relatório que conversamos", não é caso de termo. Registre e não force uma definição.

## 6. Validar

1. Rode a SQL final no período conhecido e compare com o oráculo. Métrica sem fonte independente fica declarada como conferida só por coerência interna.
2. Passe a SQL pelo verificador do serviço, se o ambiente permitir: a tela de termos testa a consulta e recusa `now()` e literais.
3. Antes de ativar, rode `GET /plugin/{companyId}/{pluginId}/{version}/terms-dry-run` (administrador): veja o que entra, muda ou é recusado, e se algum termo toma o nome de outro plugin.
4. Publique uma versão nova do plugin no ambiente de teste e ative-a. O bloco é reconciliado na ativação: limpar cache não aplica nada.
5. Monte dados no formato real. Status inventados escondem erro. O período de teste precisa separar as hipóteses: ex.: 13 por fechamento e 4 por início.
6. Teste com **o modelo usado em produção**, pelo menos 2 repetições por pergunta, usando as palavras reais do usuário.
7. Inclua um controle: pergunta parecida de outro universo, que não deve usar o termo.
8. Leia as respostas. Palavra-chave no texto não prova acerto.

## 7. Depois de publicar

Confira que a versão chegou: `list_business_terms` mostra o termo com origem de plugin, e o escondido por termo de empresa aparece como encoberto. Retire colisões e faça uma pergunta real com número conhecido. Prefira um dia útil com dados: "ontem" sem registro não prova nada, e fim de semana pode ter canais parados.

## Sinais de problema

| Sintoma | Causa provável |
|---|---|
| Resposta certa no teste e baixa em produção | Termo de empresa com precedência |
| "Não encontrei o campo" | Termo não selecionado, ou entidade fora da estrutura |
| Termo do plugin não aparece | Passou de um limite da Jeannie, tem literal na SQL, `paramTypes` não bate, idioma fora de `pt`/`en`/`*`, entidade ou `dateField` que não existe na estrutura da empresa, ou o teto de 60 termos de plugin foi atingido |
| Total diferente a cada resposta | SQL não traz o número, e o modelo calcula sozinho |
| Conta proibida na resposta | Regra só no texto; mova para a SQL |
