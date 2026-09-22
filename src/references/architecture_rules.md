# Regras Arquiteturais e Gotchas Críticos do Glyvio

Este documento reúne as diretrizes não-negociáveis e os gotchas de runtime confirmados na arquitetura Glyvio (camadas `app`, `server` e `environment`). Devem ser seguidas rigorosamente por desenvolvedores e agentes de IA.

> Os gotchas de runtime abaixo foram registrados nas versões usadas pelos projetos de origem.
> Confirme a aplicabilidade na versão do projeto-alvo; esta migração não reexecutou esses cenários.

---

## 1. Regras Não-Negociáveis do Frontend (`plugin/app`)

### 1.1. Instanciação de Entidades
- **Sempre use `await glyvio_entity.Entity.new()`** — nunca chame o construtor síncrono `new glyvio_entity.Entity()`.
- *Única exceção confirmada*: uploads de anexos que precisam apenas de um `id` temporário pré-gerado antes de chamar persistência especializada (`attachFromTemp`).

### 1.2. Campos de Chave Estrangeira / Relações (FKs)
- **Nunca use `StringTextfieldDesign` para campos que referenciam outra entidade** (campos com sufixo `_id`, `_ic` ou tipo `ENTITY`).
- **Use sempre a subclasse concreta** de `EntityAutocompleteSingleTextfieldDesign` exposta em `@types` para aquela entidade (ex.: `crm.SaleSingleTextfield`). Nunca instancie a classe base diretamente.
- **Bind SEMPRE na relation property, NUNCA no FK id:**
  - ✅ Correto: `name: 'state.delivery.sale'`, `errorText: TextFieldDesign.isRequired(state, 'state.delivery.sale')`
  - ❌ Proibido: `name: 'state.delivery.saleId'` (o autocomplete manipula o objeto resolvido, não a chave escalar).
- **Atribuição em Runtime:** sempre atribua a entidade inteira (`state.delivery.sale = saleObj`), nunca o id escalar isolado (`state.delivery.saleId = id`).

### 1.3. Reatividade e Estado
- **Prefixo obrigatório em `interopDesign`:** toda propriedade `stateName` DEVE iniciar com `state.` (ex.: `'state.results'`, `'state.filter'`). Sem esse prefixo, a reatividade falha silenciosamente.
- **Não chame `this.getView().callRefreshState()` dentro de `onEvent`:** o framework Glyvio já invoca `callRefreshState()` automaticamente após a execução de qualquer evento. Invocar manualmente causa renderizações duplicadas desnecessárias.
- **Tipos de data e número:** Use `DateTime` e `Decimal` para dados de negócio, nunca `Date` ou `number` brutos de JavaScript no estado.

### 1.4. Suporte a Observadores e Tags em Telas de Entidade
- Em formulários modais (`FormEntityLayoutDesign`), declare sempre:
  `actionKeyChangeObservers: 'onChangeObservers'`, `actionKeyChangeTags: 'actionKeyChangeTags'`.
- Em sidebars (`SimpleSidebar`), implemente:
  - `onChangeObservers` invocando `entityService.updateObservers`.
  - `actionKeyChangeTags` invocando `entityService.updateTags`.

---

## 2. Gotchas Confirmados do QueryBuilder

Estes comportamentos não aparecem no `.d.ts` e foram confirmados em execução real:

1. **`findAll()` ignora `.limit()` e `.offset()` silenciosamente:**
   - Apenas `.find()` realiza paginação real. Chamar `.limit()` em `.findAll()` não tem efeito.
2. **Self-joins exigem alias explícito:**
   - Fazer join de uma entidade contra ela mesma sem definir alias (ex.: `parentTask`) lança erro no Postgres (`table name specified more than once`), frequentemente quebrando a tela silenciosamente sem exibir mensagem para o usuário.
3. **Relações Cross-Plugin em `findAll()`:**
   - Chamar `.findAll()` numa entidade compartilhada sem restringir campos pode disparar `Cannot read property 'structureName' of undefined` para relações do outro plugin não carregadas. Restrinja com `setFromEntity(AllEntities.x, { fields: ['id', 'name', ...] })`.
4. **`addLeftJoinEntity` derruba o getter do id se `id` for omitido:**
   - Se `id` não constar em `fieldsForeign`, o getter `<relation>Id` do lado "from" deixa de funcionar.
5. **`'user'` é palavra reservada no Postgres:**
   - Nunca utilize `'user'` como `aliasTableForeign`; utilize aliases como `app_user` ou `usr`.
6. **Arrays de IDs em campos JSON / JSONB:**
   - Use `addFilterRaw` com o operador `@>`:
     ```ts
     qb.addFilterRaw('client.mailing_lists @> to_jsonb(?::text)', [mailingListId]);
     ```

---

## 3. Peculiaridades de Componentes de UI

1. **`ChoiceMultipleTextfieldDesign` (Bug Flutter confirmado):**
   - No widget Flutter subjacente, ao tentar adicionar um novo valor a uma seleção que já possui 1+ itens, ocorre erro de tipo (`item['key']` em `List<String>`). Prefira `EntityAutocompleteMultipleTextfieldDesign` ou toggles individuais caso o usuário vá editar repetidamente.
2. **Condicionais Handlebars em Chips:**
   - Evite `{{#if}}...{{else}}{{#if}}...{{/if}}{{/if}}` dentro do `label` ou `value` de `ChipDesign`. Isso pode renderizar `"ERROR ON PROCESS PARSE"`. Calcule o label e a cor no TypeScript (`refreshState`) e interpole o valor resolvido (`$S{state.computedLabel}`).
3. **Nomes de Ícones:**
   - Nomes de ícones (`SimpleIconDesign.name`) são strings livres sem checagem de tipos em tempo de compilação. Confirme visualmente via captura de tela (`test-plugin-browser`).
4. **Colisão de Rotas em `navigate()`:**
   - Se uma Page e um Modal compartilharem o mesmo path (ex.: `/sale-table`), use `navigate({ nameSpace, nameObject })` para desambiguar e garantir que a view pretendida seja aberta.
