---
name: test-plugin-browser
description: "Instruções para o Codex conectar a aplicação Glyvio App publicada ao bundle local do plugin e testar via Browser usando a AI bridge (window.__GLYVIO_AI__), sem depender da árvore de semântica/acessibilidade. Inclui o procedimento padrão de validação visual (print por passo) a ser usado ao final de qualquer implementação de tela."
---
<!-- Generated from src/skills/test-plugin-browser/SKILL.md by tools/generate.py. Edit the source, not this file. -->
# Skill: Conexão e Teste de Plugins contra o Glyvio App Publicado (via AI bridge)

Esta skill guia o **Codex** para testar e validar o plugin do cliente (ex: `glyvio-plugin-crm`, `glyvio-plugin-project`, `glyvio-plugin-travel`) contra o site do **Glyvio App** publicado (produção/staging), sem depender do código-fonte do Flutter e **sem usar `aria-label`/`role`/snapshot semântico** — a interação é feita lendo o JSON estruturado de design/estado que o próprio app já expõe para a Jeannie.

**Pré-requisito**: `window.__GLYVIO_AI__` sempre existe na página, mas toda chamada é rejeitada com `AI bridge is disabled for this session...` a menos que uma destas duas condições seja verdadeira:
- o alvo (staging/homologação) foi compilado com `--dart-define=ENABLE_AI_BRIDGE=true`; **ou**
- você está logado numa **company sandbox** que o backend do Glyvio marcou explicitamente com `aiBridgeSandbox: true` — esse é o caminho para testar contra **produção de verdade** (mesma build que todo cliente usa, mesmos dados reais), sem precisar de uma flag de build.

**Credenciais**: sempre via `.env` (`GLYVIO_APP_URL`, `GLYVIO_EMAIL`, `GLYVIO_PASSWORD`) lido internamente pelo script Node (`require('dotenv').config()`). **Nunca** peça para o usuário colar a senha no chat, e nunca imprima/ecoe o valor da senha em nenhum output ou comando.

---

## 0. Regra padrão: validação visual ao vivo é OBRIGATÓRIA ao final de qualquer implementação de tela

Sempre que uma tarefa **criar ou alterar** uma page/modal/sidebar/cart do `plugin/app`, a tarefa **não está concluída** só porque o build passou. Depois de `pnpm pretty && pnpm lint && pnpm build` com sucesso:

1. Suba o bundle local (`npx http-server ./plugin/app/dist -p 3000 --cors`, em background).
2. Rode um cenário (via `--scenario` ou um script ad-hoc baseado no template da seção 5) que **navegue até a tela**, **execute cada ação relevante do fluxo** (criar, editar, marcar, remover, etc.) e **tire um screenshot depois de cada passo**.
3. Salve os screenshots na **raiz do projeto** (o diretório de trabalho do plugin), numerados em ordem: `NN_descricao.png` (ex: `01_estado_vazio.png`, `02_apos_adicionar_item.png`, `03_apos_marcar_concluido.png`, `04_apos_remover_item.png`).
4. **Leia cada screenshot** (com a ferramenta de visualização de imagens disponível) antes de declarar a tarefa concluída — não basta rodar o script e assumir que renderizou certo; o AI bridge confirma que a *ação* aconteceu no estado, não que o *layout* ficou visualmente correto (ver gotcha do `RowLayoutFieldDesign` na seção 6).
5. Confira `getErrors()` sem itens novos em cada passo relevante.
6. **Se `.env`/credenciais não estiverem disponíveis**, pare e peça ao usuário para configurar antes de considerar a tarefa concluída — não é opcional, não pule esta fase silenciosamente.

Esse é o mesmo procedimento que o agente `glyvio-app-coordinator` executa como sua "Fase 5" (ver `codex/agents/glyvio-app-coordinator.toml`).

---

## 1. Execução Automatizada via CLI Runner (Recomendado para IA e CI)

O repositório inclui o script executável **`test_runner.js`** (`glyvio-forge/tools/test-runner/runner.js`), que orquestra todo o ciclo de forma autônoma:
1. Sobe o servidor HTTP local com CORS na porta especificada (default: `3000`).
2. Abre o navegador Chromium headless com gerenciamento de sessão persistente.
3. Faz login (email por seletor → senha/botão por coordenada — ver gotcha de login na seção 6) se detectar o form.
4. Injeta o override do plugin local (`setPluginDevOverride`) e recarrega os módulos (`reloadPlugins`).
5. Executa a navegação, ações, preenchimento de campos ou cenários JSON — incluindo screenshots por passo.
6. Captura erros internos via `getErrors()` e retorna o resumo estruturado, com `getState()` já **desembrulhado** (ver seção 6).

### Exemplos de Comandos CLI:

Execute na raiz do plugin. Os exemplos pressupõem que `tools/test-runner/` foi
fornecido no projeto (runner, dependências e exemplos); ele pertence ao repositório
Glyvio Forge e não faz parte deste pacote. Se ausente, use o template da seção 5
com as ferramentas de navegador disponíveis, ou informe a dependência faltante.
Não suponha caminhos de outra máquina nem acesso a um repositório irmão.

```bash
# 1. Navegar para uma rota e validar se carregou sem erros de Cubit
node tools/test-runner/runner.js \
  --project "." \
  --plugin-name "crm" \
  --navigate "/crm/clients/kanban"

# 2. Listar todas as rotas registradas após recarregar o plugin
node tools/test-runner/runner.js \
  --plugin-name "crm" \
  --list-routes

# 3. Disparar uma ação específica na tela aberta
node tools/test-runner/runner.js \
  --plugin-name "crm" \
  --navigate "/crm/clients/kanban" \
  --dispatch "OPEN_FILTER"

# 4. Inspecionar o Design JSON AST da tela ativa
node tools/test-runner/runner.js \
  --plugin-name "crm" \
  --navigate "/crm/clients/kanban" \
  --get-design

# 5. Executar um cenário completo de teste via arquivo JSON, com screenshot por passo
node tools/test-runner/runner.js \
  --plugin-name "crm" \
  --scenario "tools/test-runner/examples/crm_kanban_test.json"
```

Um step `{"action": "screenshot", "path": "01_estado_vazio.png"}` dentro do `--scenario` tira o print na hora — é a forma preferida de cumprir a regra da seção 0 sem escrever um script Node à mão.

Para fluxos com navegação em cascata (lista → cart → modal, 2+ níveis), use `{"action": "waitForScreen", "nameObject": "SaleEditCart", "surfaceType": "cart"}` **depois** do `dispatch`/`navigate` que abre a tela nova, em vez de confiar em "a última tela do array" + sleep fixo — ver seção 6. A partir desse step, os steps seguintes (`dispatch`/`setField`/`selectEntity`/`waitForIdle`) usam automaticamente essa tela "pinada" até o próximo `waitForScreen`.

---

## 2. Fluxo Manual / Interativo (via Browser Console ou Playwright MCP)

Se estiver operando diretamente no console do navegador ou via tool do Playwright:

1. **Subir o Servidor Local do Bundle (CORS Ativo)**:
   ```sh
   # No diretório do plugin
   npx http-server ./plugin/app/dist -p 3000 --cors
   ```

2. **Abrir o Glyvio App (staging)**:
   Navegue para: `https://app-beta.glyvio.com/`.

3. **Injetar o Override e Recarregar o Flutter**:
   Execute no console da página:
   ```javascript
   // Configura o Flutter para buscar o plugin do servidor local de dev
   await window.__GLYVIO_AI__.setPluginDevOverride('crm', 'http://localhost:3000/bundle.js');

   // Dispara o unload + reload de módulos/rotas
   await window.__GLYVIO_AI__.reloadPlugins();
   ```

---

## 3. Inspecionando via JSON estruturado (sem DOM/semantics)

1. **Listar rotas registradas**:
   ```javascript
   await window.__GLYVIO_AI__.listRoutes();
   ```

2. **Descobrir quais telas estão abertas agora**:
   ```javascript
   await window.__GLYVIO_AI__.describeCurrentScreens();
   // -> [{ callbackId, surfaceType: 'page'|'modal'|'sidebar'|'cart', nameSpace, nameObject, path }, ...]
   ```
   Não rastreia a tela de login/seleção de company — retorna `[]` nesses dois casos.

3. **Ler o design (árvore de widgets) de uma tela**:
   ```javascript
   await window.__GLYVIO_AI__.getDesign(callbackId);
   ```

4. **Ler o estado atual de uma tela**:
   ```javascript
   await window.__GLYVIO_AI__.getState(callbackId);
   ```
   ⚠️ Ver o gotcha do formato "wrapped" na seção 6 antes de ler qualquer campo do resultado.

5. **Consultar Erros Internos da Aplicação (Cubit.onError)**:
   ```javascript
   await window.__GLYVIO_AI__.getErrors({ callbackId, limit: 10 });
   await window.__GLYVIO_AI__.clearErrors();
   ```

---

## 4. Escrevendo e navegando

1. **Clicar/disparar uma ação**:
   ```javascript
   await window.__GLYVIO_AI__.dispatchAction(callbackId, key, data);
   ```

2. **Preencher um campo**:
   ```javascript
   await window.__GLYVIO_AI__.setFieldValue(callbackId, key, value);
   ```
   ⚠️ `key` precisa ser o path **completo, prefixado com `state.`**, exatamente como aparece no `name` do design (ex: `state.projectTask.checklist[0].done`) — ver seção 6.

3. **Preencher autocomplete de entidade**:
   ```javascript
   await window.__GLYVIO_AI__.selectEntityField(callbackId, fieldName, searchText, pickIndex);
   ```

4. **Navegar**:
   ```javascript
   await window.__GLYVIO_AI__.navigate({ path: '/crm/clients/kanban' });
   ```
   ⚠️ Se **duas rotas registrarem o mesmo `path`** (ex: uma page e um modal ambos em `/sale-table` — confira em `listRoutes()`), navegar só por `path` é ambíguo e pode abrir a tela errada **sem erro nenhum**. Nesse caso, desambigue com `nameSpace`/`nameObject` (os mesmos identificadores de `listRoutes()`/`describeCurrentScreens()`): `navigate({ nameSpace: 'crm', nameObject: 'SaleTablePage' })`. Ver seção 6.

5. **Esperar a tela ficar ociosa**:
   ```javascript
   await window.__GLYVIO_AI__.waitForIdle(callbackId, 15000);
   ```

---

## 5. Template de script completo (login + override + navegação + screenshots)

Use isto como ponto de partida em vez de reescrever o fluxo de login/override do zero — o `runner.js` já implementa o mesmo fluxo internamente (então prefira `--scenario` quando um cenário JSON já cobre o caso), mas para fluxos mais dinâmicos (ex: extrair um id do design antes do próximo passo) um script ad-hoc como este é mais direto:

```js
require('dotenv').config();
const { chromium } = require('playwright');
const shot = (n) => require('path').resolve(process.cwd(), n); // sempre a raiz do projeto

function unwrap(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if ('$_type' in v) {
    const t = v['$_type'];
    if (t === 'undefined') return undefined;
    if (t === 'null') return null;
    const val = v.value;
    if (Array.isArray(val)) return val.map(unwrap);
    if (val && typeof val === 'object') {
      const out = {};
      for (const k in val) out[k] = unwrap(val[k]);
      return out;
    }
    return val;
  }
  const out = {};
  for (const k in v) out[k] = unwrap(v[k]);
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR', // sem isso, Flutter Intl lança RangeError antes do bridge registrar
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block', // evita bundle antigo cacheado pelo SW logo após um deploy
  });
  const page = await context.newPage();

  await page.goto(process.env.GLYVIO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // bridge-ready real (não apenas o shim JS, que existe antes do Dart registrar o callback)
  for (let i = 0; i < 90; i++) {
    try { await page.evaluate(() => window.__GLYVIO_AI__.listRoutes()); break; }
    catch (e) { await page.waitForTimeout(500); }
  }

  // login: só o primeiro input é localizável por seletor; o campo de senha e o botão são por
  // coordenada (Tab NÃO move o foco neste app — testado e confirmado que não funciona; ver seção 6).
  // Coordenadas válidas apenas para o viewport 1440x900 acima.
  await page.locator('input').first().fill(process.env.GLYVIO_EMAIL, { timeout: 30000 });
  await page.mouse.click(1050, 496); // campo de senha
  await page.waitForTimeout(300);
  await page.keyboard.type(process.env.GLYVIO_PASSWORD, { delay: 30 });
  await page.mouse.click(1050, 569); // botão "Logar"
  await page.waitForTimeout(15000);

  await page.evaluate(async ({ ns, url }) => {
    await window.__GLYVIO_AI__.setPluginDevOverride(ns, url);
    await window.__GLYVIO_AI__.reloadPlugins();
  }, { ns: '<plugin-namespace>', url: 'http://localhost:3000/bundle.js' });
  await page.waitForTimeout(3000);

  await page.evaluate((p) => window.__GLYVIO_AI__.navigate({ path: p }), '/rota-da-tela');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: shot('01_estado_inicial.png') });

  const screens = await page.evaluate(() => window.__GLYVIO_AI__.describeCurrentScreens());
  const cb = screens[0].callbackId;

  await page.evaluate((cb) => window.__GLYVIO_AI__.dispatchAction(cb, 'minhaAcao', {}), cb);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shot('02_apos_minha_acao.png') });

  const state = unwrap(await page.evaluate((cb) => window.__GLYVIO_AI__.getState(cb), cb));
  console.log(JSON.stringify(state, null, 2));

  const errors = await page.evaluate((cb) => window.__GLYVIO_AI__.getErrors({ callbackId: cb, limit: 20 }), cb);
  console.log('errors:', JSON.stringify(errors));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
```

Esse template básico assume 1 tela e um `await` direto em `navigate`/`dispatchAction` — aceitável para um fluxo de 1 hop com tempo de resposta previsível. Para qualquer fluxo com **2+ telas em cascata** (lista → cart → modal) ou uma ação que pode disparar uma validação de negócio, use o padrão da seção 7 (`waitForScreen` em vez de sleep fixo + `screens[0]`, chamadas de `navigate`/`dispatch` com timeout tolerante em vez de `await` direto) — um `navigate`/`dispatchAction` que nunca resolve a própria promise trava o script inteiro sem log nenhum caso contrário (ver seção 6).

---

## 6. Gotchas confirmados (leia antes de investigar um "bug" que pode ser seu próprio script)

- **Login não muda a URL para `/login` neste app** — o form pode renderizar direto em `/`. Detecte pela presença de um `<input>` visível logo após o load, não só pela URL. `runner.js` já faz essa detecção.
- **`page.locator(...).isVisible({timeout})` NÃO faz polling** — é um check instantâneo do DOM naquele exato momento; o `timeout` passado não faz o Playwright esperar (confirmado empiricamente: retornou em ~25ms independente do valor). Se você usar `isVisible()` para detectar o form de login logo após `domcontentloaded`, e o app estiver demorando mais que o normal pra sair da splash screen (Firebase/canvaskit init observados levando 10-20s+ em alguns runs), o check via `isVisible()` vê `false` e o script segue como se já estivesse logado - toda chamada seguinte ao AI bridge falha de formas confusas (`navigate` rejeita com "no route matches", `reloadPlugins()` "resolve" mas `listRoutes()` fica `[]` pra sempre, `setPluginDevOverride` pode lançar um erro Dart minificado tipo `Instance of 'minified:cU'`) - fácil de confundir com o app/staging estar fora do ar. `runner.js` já usa a forma certa: `.waitFor({state: 'visible', timeout: 30000})`, que de fato faz polling. Se for escrever um script ad-hoc do zero, use `waitFor`, nunca `isVisible` sozinho, pra checar algo que ainda pode não existir no DOM.
- **Só o primeiro campo de login é localizável por seletor CSS, e `Tab` NÃO move o foco neste app.** Os inputs do Flutter web não têm `type`/`name`/`role` distintivos, e o campo de senha só existe no DOM enquanto focado (proxy de IME do Flutter). Um fluxo por `Tab` (`fill()` no email → `keyboard.press('Tab')` → `type()` senha → `Enter`) **foi tentado e confirmado que não funciona** — o `Tab` não move o foco para o campo de senha neste Flutter web app; o texto digitado não vai para lugar nenhum (campo fica visivelmente vazio no screenshot, `post-login url` continua em `/login`). O único fluxo confirmado funcionando: `fill()` no primeiro `input` (email) → **clique por coordenada** no campo de senha → `keyboard.type()` (senha) → **clique por coordenada** no botão "Logar". As coordenadas usadas (`1050, 496` senha / `1050, 569` botão) são válidas para o viewport fixo `1440x900` que `runner.js` sempre usa — se o viewport mudar, revalide as coordenadas antes de confiar nelas de novo.
- **`getState()`/`getDesign()` embrulham cada valor em `{"$_type": "...", "value": ...}`.** Ler `st.projectTask.checklist` direto no resultado bruto retorna `undefined` mesmo quando o dado real está lá — sempre passe o resultado por um `unwrap()` (seção 5) antes de inspecionar. Isso já causou uma investigação inteira de "bug" que na verdade era o script de teste, não o plugin.
- **`setFieldValue(callbackId, key, value)` exige o path completo prefixado com `state.`**, idêntico ao `name` usado no design (ex: `state.projectTask.checklist[1].done`, não `projectTask.checklist[1].done`). Sem o prefixo, a chamada rejeita com `key "..." is not present in getDesign() for this screen`.
- **`setFieldValue()` e um clique real testam caminhos de código DIFERENTES — um passar não garante o outro.** Confirmado: um `BooleanTextfieldDesign` com `cleanDesign: true` aceitava `setFieldValue(cb, 'state.x.checklist[0].done', true)` perfeitamente (escrita programática, passa por cima de qualquer gesture handling do próprio widget), mas um **clique real por coordenada** no mesmo checkbox renderizado não fazia **nada** — sem erro, sem efeito visual, `getState()` inalterado. Pra validar que um campo booleano/checkbox é realmente clicável por um usuário, **simule o clique de verdade** (`page.mouse.click(x, y)` nas coordenadas do widget) — não confie só em `setFieldValue()`. Se o clique real não funcionar, considere trocar o binding nativo por um `ActionButtonDesign` + action explícita (mesmo padrão de um botão de remover/toggle já comprovado).
- **Nomes de ícone não são validados em compile-time — um nome "que parece certo" pode renderizar o glifo errado, silenciosamente.** `iconName` é `string` livre (`SimpleIconDesign.name`, famílias `sax_*`/`fa_*`/`ma_*`). Um nome plausível mas inexistente/errado (ex: `sax_linear_square` esperando um quadrado vazio) pode coincidir com outro ícone real do mesmo font-set e renderizar algo visualmente diferente do pretendido (ex: um ícone de "camadas/duplicar") sem erro nenhum, nem em build nem em runtime. Pra confirmar um nome de ícone: grep a string exata em `glyvio_app/build/web/main.dart.js` (lista todos os nomes reais do font) e **sempre confira visualmente via screenshot** antes de considerar o ícone certo — nunca assuma que um nome "faz sentido" e vai renderizar o glifo esperado.
- **Um `getState()`/`getDesign()` correto não garante um layout correto.** Um `RowLayoutFieldDesign` sem `width` nem `flex`/`isExpanded` explícito pode colapsar para largura zero e renderizar como uma caixa vazia — a ação disparou, o estado mudou certinho, e mesmo assim nada aparece na tela. Sempre confira visualmente (screenshot lido de verdade, não só o retorno da action) antes de declarar uma UI funcionando. Ver também o padrão comprovado (`flex: 1` no campo expansível, `width` fixo nos botões/checkboxes) em `client_insert_modal.ts` do `glyvio-plugin-crm`.
- **Deploy em andamento**: `main.dart.js`/o bundle versionado do `glyvio-plugin-core` podem responder HTTP 200 com `text/html` (fallback de SPA) durante um deploy ativo — resolve-se sozinho; não é bug do plugin. Confirme via `curl -I` antes de investigar mais.
- **Service Worker pode servir bundle desatualizado do core logo após um deploy**, mesmo com o CDN já correto. `serviceWorkers: 'block'` no `newContext` evita essa classe de falso-negativo (seguro para um contexto de teste descartável).
- **`navigate({path})` é ambíguo quando duas rotas compartilham o mesmo path.** Confirmado: `crm_SaleTablePage` (page) e `crm_SaleTableModal` (modal) registram os dois `/sale-table` — `navigate({path: '/sale-table'})` abriu o modal (que não tem ação "new" e trava o fluxo), não a page pretendida, **sem lançar nenhum erro**. Desambigue com `navigate({nameSpace, nameObject})` (mesmos campos de `listRoutes()`) sempre que o path puder colidir. Isso não está documentado num JSDoc explícito — foi descoberto forçando um `navigate({name: ...})` inválido e lendo a mensagem de erro do bridge (`"no route matches path=null nameSpace=null nameObject=null"`), que revela os 3 campos aceitos.
- **`navigate()`/`dispatchAction()` podem nunca resolver a própria promise mesmo quando o efeito real já aconteceu** (a navegação mudou de tela, o estado mudou) — ou, no caso de uma validação de negócio (`GlyvioError`) disparada dentro de um `dispatchAction`, o app registra o erro em `getErrors()` mas a chamada do bridge não necessariamente rejeita/resolve nunca. **Nunca dê `await` direto nessas duas chamadas sem timeout** — isso trava o script inteiro indefinidamente sem nenhum log. Dispare com timeout tolerante (não fatal) e confirme o resultado real via `waitForScreen`/`getState`/`getErrors` — é exatamente o que `runner.js` faz internamente (`fireAndTolerate`) e o que os steps `navigate`/`dispatch` do `--scenario` já aplicam.
- **`getErrors()` é a fonte de verdade pra validação de negócio, não o retorno do `dispatchAction`.** Uma regra de negócio real (ex: "Tabela de preço é obrigatória para a escolha das parcelas" antes de abrir um modal de seleção de estoque) aparece em `getErrors({callbackId})` mesmo quando o `dispatchAction` que a disparou não lançou nada capturável no script. Sempre confira `getErrors()` depois de qualquer `dispatch` que pareça não ter tido efeito.
- **`selectEntityField(callbackId, fieldName, '', 0)` com busca vazia funciona como "listar tudo, pegar o índice N"** — útil quando o campo tem só uma opção óbvia (ex: um único cliente de teste). Se o campo realmente não tiver nenhuma opção disponível (ex: company de teste sem nenhuma tabela de preço cadastrada), a chamada rejeita com uma mensagem clara e específica (`search "" for "..." returned 0 result(s)... Available: (none)`) — não trava e não falha silenciosamente; leia a mensagem, ela já diz se o problema é dado de teste ausente, não bug de código.
- **`app-beta.glyvio.com` pode estar roteando chamadas de controller customizado para o fallback do SPA em vez da API.** Confirmado em `glyvio-plugin-financial`: `requestService.post` contra `app-beta.glyvio.com` retornou a página HTML de fallback da SPA (não uma resposta real da API) para **todo** controller customizado testado, não uma rota isolada — o host real da API observado nesse ambiente foi `webapi-prod.glyvio.com`. Se uma verificação ao vivo contra `app-beta` falhar de um jeito que parece "a rota não existe"/"resposta é HTML", **antes de investigar o código do plugin**, confirme o host real com `curl -I` na URL usada e considere que pode ser um problema de roteamento do ambiente `app-beta`, não do plugin. Isso ainda não tem causa raiz confirmada no `glyvio_core`/environment — trate como um gotcha conhecido do ambiente `app-beta`, e prefira `webapi-prod.glyvio.com` (ou o host de API real do ambiente-alvo) para bater direto num controller, em vez de assumir que `app-beta.glyvio.com` sempre serve tanto o app quanto a API.
- **Strings `$T{...}` renderizam como `?chave?` literal sob `setPluginDevOverride`, mesmo em plugins já publicados.** Confirmado num plugin em produção (`crm`, título da app bar e campos de card num kanban) e não só num plugin novo/não publicado - o override local troca o `bundle.js`, mas não parece carregar/registrar o catálogo de traduções (`.arb`) do jeito que um publish de verdade faz. Texto que vem direto do banco (ex: nome de uma coluna de kanban configurada pelo usuário) renderiza normal; só chave de template `$T{}` fica quebrada. **Não conclua que as traduções do seu plugin estão erradas só por ver `?chave?` num teste ao vivo via dev-override** — isso é esperado nesse modo de teste. Pra validar o texto traduzido de verdade, é preciso um publish real (homologação), não dev-override.

---

## 7. Como testar um fluxo com navegação em cascata (menu → lista → cart → modal)

Quando a tela final só é alcançável por uma sequência de telas (ex: menu → lista → cart → preencher campos → modal de seleção), **descubra o fluxo lendo o código-fonte, não adivinhando na tela nem confiando de memória**:

1. **Rota inicial**: `plugin/app/src/index.ts` — `routerService.loadRoutes([...])` + `fullMenuGroupAdd`/`fullMenuItemAdd` dizem qual `Route` e path reais o menu usa.
2. **Cada hop seguinte**: grep pelo nome da tela de destino (ex: `StockSelectForSaleTableModal`) na tela de origem — o `events()`/botão que a abre revela o **action key exato** e o **route class** (`pushCart`/`pushModal(new XyzRoute({...}))`), incluindo qualquer payload que a rota espera.
3. **Nomes de campo**: `getDesign()` da tela (ou o `name` prop no `.ts`) dá o path completo prefixado com `state.` — não assuma a raiz do state (ex: pode ser `state.saleDto.sale.client`, não `state.sale.client`).
4. **Validações bloqueantes**: leia o handler da ação (`events()`/método correspondente) por um `throw new glyvio_core.GlyvioError(...)` condicional — isso é uma regra de negócio real, não só uma condição de UI, e vai aparecer em `getErrors()` durante o teste ao vivo se a pré-condição não for satisfeita.

Depois de mapear os hops, o cenário de teste é uma sequência `navigate` (com `nameSpace`+`nameObject` se o path colidir) → `waitForScreen` (nunca "sleep fixo + pegar a última tela") → `dispatch`/`selectEntity`/`setField` → `screenshot`, repetida por hop, com `getErrors()` conferido ao final. Um exemplo completo e validado ao vivo (`glyvio-plugin-crm`, fluxo `SaleTablePage → SaleEditCart → StockSelectForSaleTableModal`) está em `glyvio-forge/tools/test-runner/sale_flow_test.js`.
