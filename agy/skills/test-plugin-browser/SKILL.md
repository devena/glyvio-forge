---
name: test-plugin-browser
description: Instruções para o AGY / AGY conectar a aplicação Glyvio App publicada ao bundle local do plugin e testar via Browser usando a AI bridge (window.__GLYVIO_AI__), sem depender da árvore de semântica/acessibilidade.
---

# Skill: Conexão e Teste de Plugins contra o Glyvio App Publicado (via AI bridge)

Esta skill guia o **AGY** / **AGY** para testar e validar o plugin do cliente (ex: `glyvio-plugin-engesolda`) contra o site do **Glyvio App** publicado (produção/staging), sem depender do código-fonte do Flutter e **sem usar `aria-label`/`role`/snapshot semântico** — a interação é feita lendo o JSON estruturado de design/estado que o próprio app já expõe para a Jeannie.

**Pré-requisito**: `window.__GLYVIO_AI__` sempre existe na página, mas toda chamada é rejeitada com `AI bridge is disabled for this session...` a menos que uma destas duas condições seja verdadeira:
- o alvo (staging/homologação) foi compilado com `--dart-define=ENABLE_AI_BRIDGE=true`; **ou**
- você está logado numa **company sandbox** que o backend do Glyvio marcou explicitamente com `aiBridgeSandbox: true` — esse é o caminho para testar contra **produção de verdade** (mesma build que todo cliente usa, mesmos dados reais), sem precisar de uma flag de build. Só funciona se essa company já tiver sido marcada como sandbox do lado do backend (peça a alguém do time Glyvio se sua company de teste ainda não tem essa flag) — nenhuma ação do lado do plugin/cliente liga isso sozinha.

Nunca espere a bridge funcionar contra uma company de cliente real — ela é rejeitada por padrão em qualquer company não marcada como sandbox, mesmo em produção.

---

## 1. Fluxo de Trabalho do Cliente

1. **Subir o Servidor Local do Bundle (CORS Ativo)**:
   No repositório do plugin:
   ```sh
   pnpm dev
   # ou servir dist/bundle.js via HTTP na porta 3000
   ```
   Certifique-se de que o servidor local esteja disponibilizando `http://localhost:3000/dist/bundle.js`.

2. **Abrir o Glyvio App (staging, com `ENABLE_AI_BRIDGE=true`) via Playwright MCP**:
   Navegue no browser para a URL de staging do Glyvio App: `https://app-beta.glyvio.com/`.

3. **Injetar o Override e Recarregar o Flutter**:
   Execute via console JS no browser:
   ```javascript
   // Configura o Flutter para buscar o plugin do servidor local de dev
   await window.__GLYVIO_AI__.setPluginDevOverride('engesolda', 'http://localhost:3000/dist/bundle.js');

   // Dispara o unload + reload de módulos/rotas (AppRuleService.unloadModules + AppCubit.resetServices)
   await window.__GLYVIO_AI__.reloadPlugins();
   ```

---

## 2. Inspecionando via JSON estruturado (sem DOM/semantics)

O Flutter Web irá descarregar os módulos antigos, baixar o novo `dist/bundle.js`, re-executar os registradores do `glyvio_core` e recarregar o roteador `GoRouter`.

Para navegar e validar, use exclusivamente os métodos abaixo — nunca `page.locator('[aria-label=...]')`/`role=...`/seletor DOM:

1. **Listar rotas registradas** (para saber `nameSpace`/`nameObject`/`path` de cada tela do plugin):
   ```javascript
   await window.__GLYVIO_AI__.listRoutes();
   ```

2. **Descobrir quais telas estão abertas agora** (cada uma com seu `callbackId`, o identificador que os demais métodos usam):
   ```javascript
   await window.__GLYVIO_AI__.describeCurrentScreens();
   // -> [{ callbackId, surfaceType: 'page'|'modal'|'sidebar'|'cart'|'sidePanel'|'chatView', nameSpace, nameObject, path }, ...]
   ```

3. **Ler o design (árvore de widgets) de uma tela** — é aqui que estão todos os botões/campos e suas `key`s reais, a fonte de verdade para localizar elementos (não o snapshot semântico):
   ```javascript
   await window.__GLYVIO_AI__.getDesign(callbackId);
   ```

4. **Ler o estado atual (form values, seleção, etc.) de uma tela**:
   ```javascript
   await window.__GLYVIO_AI__.getState(callbackId);
   ```

5. **Ler o contexto narrativo da tela** (texto/resumo que a própria tela expõe para a Jeannie, quando implementado — pode vir vazio em telas que ainda não adotaram isso):
   ```javascript
   await window.__GLYVIO_AI__.getJeannieContext(callbackId);
   ```

6. **Depuração de Erros**:
   - Monitore os `browser_console_logs` para verificar se algum interceptor ou callback JS disparou exceções.
   - Todo erro da bridge chega como `Error` rejeitado na Promise (não como snapshot silenciosamente vazio) — trate a rejeição, não assuma sucesso.

---

## 3. Escrevendo e navegando (Fase 1)

Todo elemento a disparar/preencher deve vir de uma `key` que apareça em `getDesign(callbackId)` (botão → `action.key`, campo → `key`) — nunca invente uma key.

1. **Clicar/disparar uma ação** (mesmo caminho de um clique real, mesmos interceptors/permissões):
   ```javascript
   await window.__GLYVIO_AI__.dispatchAction(callbackId, key, data);
   ```
   Rejeita com `Error` se `key` não estiver em `getDesign()` nem for uma key interna conhecida do tipo de tela (ex.: `_ON_COLUMN_CHANGE` em Kanban, `_FETCH_ITEMS` em Grid/Table). Para esses casos raros (ou depuração), passe `unsafeMode: true` como 4º argumento — só em QA, nunca como padrão.

2. **Preencher um campo**:
   ```javascript
   await window.__GLYVIO_AI__.setFieldValue(callbackId, key, value);
   ```

3. **Navegar** (resolve pelo `path` retornado em `listRoutes()`, ou por `nameSpace`+`nameObject` — página/modal/sidebar/cart são todos endereçados por `path`, não precisa saber qual é qual):
   ```javascript
   await window.__GLYVIO_AI__.navigate({ path: '/orders/new' });
   // ou: await window.__GLYVIO_AI__.navigate({ nameSpace, nameObject, params, cleanStack });
   ```

4. **Esperar a tela ficar ociosa** antes do próximo passo (evita `sleep` arbitrário):
   ```javascript
   await window.__GLYVIO_AI__.waitForIdle(callbackId, 10000);
   ```

**Importante**: a Fase 2 (continuidade multi-etapa da Jeannie embutida em produção) ainda não foi implementada — esta skill cobre apenas o entry point de QA/staging (`window.__GLYVIO_AI__`), nunca use isso contra produção.
