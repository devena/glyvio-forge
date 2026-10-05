<!-- Generated from src/references/architecture_rules.md by tools/generate.py. Edit the source, not this file. -->
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
  - ✅ Correto: `name: 'state.delivery.sale'`, `required: true` (validado por `validateForm` no salvar — `TextFieldDesign.isRequired` está obsoleto)
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

### 1.5. Escopo de `userGroup` em Persistência de Entidades
- **Toda entidade nova enviada a qualquer operação de persistência** (`saveEntity`, `saveList`, `saveEntityWithoutPermission` ou uma fila equivalente) **deve ter `userGroupId` definido explicitamente antes do save**. Uma entidade sem esse escopo é um erro de segurança, não um valor a ser deixado para o backend inferir.
- Ao criar uma entidade filha, de junção ou auxiliar para uma entidade já existente, copie o `userGroupId` da entidade proprietária/origem. Não substitua esse escopo pelo usuário executor.
- Em uma criação independente, use o grupo efetivamente escolhido para o registro; em fluxos internos, resolva o grupo do ator por uma regra conhecida. Para o contexto de ferramenta/serviço, o mapeamento confirmado é `loggedUserId === 'system' ? 'core_admin' : loggedUserId`.
- Nunca aceite um `userGroupId` arbitrário vindo de request, planilha ou cliente sem autorizá-lo; nunca use `'core_admin'` como atalho para uma ação humana; e não altere o grupo de uma entidade existente incidentalmente durante um update.
- Quando não for possível determinar com segurança qual é o grupo da nova entidade, **pare e peça essa definição** antes de escrever o save.

### 1.6. Padrão Visual Moderno (telas novas e redesenhos)
- **Monte telas novas com `glyvio_core.ui` + `SurfaceDesign`/`StackLayoutDesign`/`GridLayoutDesign`** (guia: `.agents/rules/references/modern_layout.md`). Não empilhe `RowLayoutDesign`/`ColumnLayoutDesign` com padding por campo para fazer cards, listas ou grades.
- **Ordem do `padding` difere**: designs modernos usam ordem CSS (`'top right bottom left'`, tokens `xs|sm|md|lg...`); designs antigos (`*LayoutFieldDesign`, `AvatarDesign`, `StringTextDesign`...) usam **LTRB** (`'left top right bottom'`, dois valores = `'horizontal vertical'`).
- **Cor por nome + `variant`** (`colorTheme: 'GREEN', variant: 'subtle'`) em vez dos sufixos `_ONLY_BORDER`/`_PRIMARY` em código novo; status com nomes semânticos (`SUCCESS`, `INFO`, `WARNING`, `DANGER`, `NEUTRAL`).
- **Ao redesenhar, preserve as `key`s e `action.key`s existentes** que interceptors (de qualquer plugin) procuram com `findWidgetByKey` — grep em `nossos/`, `clientes/` e `services/ts/` antes de mudar a árvore. `findWidgetByKey` atravessa Surface/Stack/Grid, então mover o widget para dentro de um card é seguro; trocar a key não é.
- Seções (`*SectionDesign`) continuam só no topo; `ui.page(...)` já é uma seção.
- `visible: a && b` pode resultar em `undefined` (= visível): force booleano (`!!a && b`).

### 1.7. Traduções com Parâmetros (ICU)
- Frases com número, nome ou gênero usam **uma chave ICU** (`{count, plural, ...}`, `{name}`, `{g, select, ...}`) passada como `$T{chave count=state.total}` no design ou `glyvio_core.t('chave', { count })` no TS. **Não concatene** pedaços traduzidos. Guia: `.agents/rules/references/i18n.md`.
- Toda chave nova em **todos** os `.arb` do projeto; nunca `$S{}`/`{{}}` dentro do `.arb`.
- Rode `node .agents/scripts/i18n_check.mjs .` depois de mexer em `.arb` ou `$T{}`.

### 1.8. Filtros e Ações Rápidas
- Em `Simple*Page`, **só adicione os campos de filtro** em `design.filterSectionsDesign?.push(FilterSidebar.section(...))`; cabeçalho, busca, filtros salvos e rodapé já vêm da base, e o painel some sozinho se não houver filtro (`FilterSidebar.finalize`). Descreva os filtros ativos em `getActiveFilterChips`/`clearFilter`. Guia: `.agents/rules/references/filters_and_headers.md`.
- Atalhos que **executam** algo (criar pedido, buscar e abrir registro) são quick actions (`menuRegistryService.addAction`, skill `create-quick-action`), não itens de rota. O `popActionKey` de um modal aberto por ela vem de `MenuRegistryService.popActionKey(key)`.

### 1.9. Rota, Classe da Tela e Export
- `getRouteNameObject()` deve devolver **exatamente o nome da classe da tela**, e a classe deve ser exportada pelo `index.ts` do plugin (`export * from './caminho/da/tela'`). O app abre `<namespace>.<NomeDaClasse>`; sem o export a tela não abre e o console mostra `[glyvio] A rota ... aponta para ..., mas o plugin não exporta essa classe` — o build continua verde.
- Registre a rota uma vez com `glyvio_core.routerService.loadRoutes([...])` e o menu com `glyvio_core.menuRegistryService.addGroup/addItem` (o `FullMenuPage.fullMenuGroupAdd` está **deprecated**). Itens de administração vão em `glyvio_core.adminRegistryService` (skill `register-menu-and-admin`).
- Ciclo de vida das views, navegação, diálogos e interceptors: `.agents/rules/references/views_and_interceptors.md`.

---

## 2. Gotchas Confirmados do QueryBuilder

Estes comportamentos não aparecem no `.d.ts` e foram confirmados em execução real:

1. **`findAll()` ignora `.limit()` e `.offset()` silenciosamente:**
   - Apenas `.find()` realiza paginação real. Chamar `.limit()` em `.findAll()` não tem efeito.
2. **Self-joins exigem alias explícito:**
   - Fazer join de uma entidade contra ela mesma sem definir alias (ex.: `parentTask`) lança erro no Postgres (`table name specified more than once`), frequentemente quebrando a tela silenciosamente sem exibir mensagem para o usuário.
3. **Relações Cross-Plugin em `findAll()`:**
   - Chamar `.findAll()` numa entidade compartilhada sem restringir campos pode disparar `Cannot read property 'structureName' of undefined` para relações do outro plugin não carregadas. Restrinja com `setFromEntity(AllEntities.x, { fields: [AllEntities.x.id, AllEntities.x.name, ...] })` — `fields` recebe `glyvio_structure.EntityField[]`, não strings.
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

## 2.1. Gotchas Confirmados de Persistência e Transação (`plugin/server`)

Confirmados em execução real (2026-09-25):

1. **Um `catch` não desfaz o rollback da plataforma:**
   - Quando uma chamada da plataforma falha dentro da requisição (save rejeitado, lock recusado etc.), a transação já foi marcada como *rollback-only* antes de a exceção chegar ao seu código. Engolir a exceção e retornar normalmente faz a resposta virar `500 UnexpectedRollbackException: Transaction rolled back because it has been marked as rollback-only`, e a mensagem original se perde.
   - Deixe a exceção propagar (a plataforma responde com o motivo real) ou valide antes de chamar. Um `UnexpectedRollbackException` "sem motivo" quase sempre é um `catch` escondendo o erro verdadeiro.
2. **`lockService.acquireLock` não espera:**
   - Apesar do JSDoc ("blocks until the lock is acquired"), se outra requisição detém o lock a chamada falha e a requisição termina com `400 {"errors":[{"reason":"cannot_acquire_lock"}]}`.
   - Para reservar/"tomar" uma unidade: um lock por unidade, adquiridos em ordem de id (evita deadlock), revalidar a disponibilidade depois de adquirir, liberar no `finally`, e tratar `cannot_acquire_lock` como "tente de novo". Validado com 4 pedidos simultâneos do mesmo item: 1 passou, 3 receberam `cannot_acquire_lock`.
3. **FK é validada dentro do próprio lote de `saveList`:**
   - Um registro apontando por FK para outro registro **do mesmo lote** pode falhar com `400 invalid_value_for_field` (confirmado: `person.main_person_contact_id` → `person_contact` salvo no mesmo `saveListWithoutPermission`).
   - Salve o lote sem essa FK e preencha-a depois: `entityService.saveInputWithoutPermission({ main_person_contact_id: id }, 'person', personId)`. Vale para qualquer FK circular (pessoa ↔ contato, cliente ↔ endereço principal).

---

## 3. Peculiaridades de Componentes de UI

1. **`ChoiceMultipleTextfieldDesign` (Bug Flutter confirmado):**
   - No widget Flutter subjacente, ao tentar adicionar um novo valor a uma seleção que já possui 1+ itens, ocorre erro de tipo (`item['key']` em `List<String>`). Prefira `EntityAutocompleteMultipleTextfieldDesign` ou toggles individuais caso o usuário vá editar repetidamente.
2. **Condicionais Handlebars em Chips:**
   - Evite `{{#if}}...{{else}}{{#if}}...{{/if}}{{/if}}` dentro do `label` ou `value` de `ChipDesign`. Isso pode renderizar `"ERROR ON PROCESS PARSE"`. Calcule o label e a cor no TypeScript (`refreshState`) e interpole o valor resolvido (`$S{state.computedLabel}`).
3. **Nomes de Ícones:**
   - Nomes de ícones (`SimpleIconDesign.name`, `iconName`) aceitam qualquer string; um nome desconhecido vira um triângulo, sem erro. Tipe como `glyvio_core.GlyvioIconName` para ter autocomplete, rode `node .agents/scripts/check_icons.mjs .` na raiz do plugin e confirme visualmente via captura de tela (`test-plugin-browser`).
4. **Colisão de Rotas em `navigate()`:**
   - Se uma Page e um Modal compartilharem o mesmo path (ex.: `/sale-table`), use `navigate({ nameSpace, nameObject })` para desambiguar e garantir que a view pretendida seja aberta.
