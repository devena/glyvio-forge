---
name: test-plugin-browser
description: Instruções para o AGY (Antigravity) conectar a aplicação Glyvio App publicada ao bundle local do plugin e testar via Browser usando a AI bridge (window.__GLYVIO_AI__), sem depender da árvore de semântica/acessibilidade.
---

# Skill: Conexão e Teste de Plugins contra o Glyvio App Publicado (via AI bridge)

Esta skill guia o **AGY** (Antigravity) para testar e validar o plugin do cliente (ex: `glyvio-plugin-crm`, `glyvio-plugin-project`, `glyvio-plugin-travel`) contra o site do **Glyvio App** publicado (produção/staging), sem depender do código-fonte do Flutter e **sem usar `aria-label`/`role`/snapshot semântico** — a interação é feita lendo o JSON estruturado de design/estado que o próprio app já expõe para a Jeannie.

**Pré-requisito**: `window.__GLYVIO_AI__` sempre existe na página, mas toda chamada é rejeitada com `AI bridge is disabled for this session...` a menos que uma destas duas condições seja verdadeira:
- o alvo (staging/homologação) foi compilado com `--dart-define=ENABLE_AI_BRIDGE=true`; **ou**
- você está logado numa **company sandbox** que o backend do Glyvio marcou explicitamente com `aiBridgeSandbox: true` — esse é o caminho para testar contra **produção de verdade** (mesma build que todo cliente usa, mesmos dados reais), sem precisar de uma flag de build.

---

## 1. Execução Automatizada via CLI Runner (Recomendado para IA e CI)

O repositório inclui o script executável **`test_runner.js`** (`glyvio-forge/tools/test-runner/runner.js`), que orquestra todo o ciclo de forma autônoma:
1. Sobe o servidor HTTP local com CORS na porta especificada (default: `3000`).
2. Abre o navegador Chromium headless com gerenciamento de sessão persistente.
3. Injeta o override do plugin local (`setPluginDevOverride`) e recarrega os módulos (`reloadPlugins`).
4. Executa a navegação, ações, preenchimento de campos ou cenários JSON.
5. Captura erros internos via `getErrors()` e retorna o resumo estruturado.

### Exemplos de Comandos CLI:

```bash
# 1. Navegar para uma rota e validar se carregou sem erros de Cubit
node /home/ubuntu/glyvio-forge/tools/test-runner/runner.js \
  --project "/home/ubuntu/_DISK_AI/glyvio-plugin-crm" \
  --plugin-name "crm" \
  --navigate "/crm/clients/kanban"

# 2. Listar todas as rotas registradas após recarregar o plugin
node /home/ubuntu/glyvio-forge/tools/test-runner/runner.js \
  --plugin-name "crm" \
  --list-routes

# 3. Disparar uma ação específica na tela aberta
node /home/ubuntu/glyvio-forge/tools/test-runner/runner.js \
  --plugin-name "crm" \
  --navigate "/crm/clients/kanban" \
  --dispatch "OPEN_FILTER"

# 4. Inspecionar o Design JSON AST da tela ativa
node /home/ubuntu/glyvio-forge/tools/test-runner/runner.js \
  --plugin-name "crm" \
  --navigate "/crm/clients/kanban" \
  --get-design

# 5. Executar um cenário completo de teste via arquivo JSON
node /home/ubuntu/glyvio-forge/tools/test-runner/runner.js \
  --plugin-name "crm" \
  --scenario "/home/ubuntu/glyvio-forge/tools/test-runner/examples/crm_kanban_test.json" \
  --screenshot "./artifacts/kanban_result.png"
```

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

3. **Ler o design (árvore de widgets) de uma tela**:
   ```javascript
   await window.__GLYVIO_AI__.getDesign(callbackId);
   ```

4. **Ler o estado atual de uma tela**:
   ```javascript
   await window.__GLYVIO_AI__.getState(callbackId);
   ```

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

3. **Preencher autocomplete de entidade**:
   ```javascript
   await window.__GLYVIO_AI__.selectEntityField(callbackId, fieldName, searchText, pickIndex);
   ```

4. **Navegar**:
   ```javascript
   await window.__GLYVIO_AI__.navigate({ path: '/crm/clients/kanban' });
   ```

5. **Esperar a tela ficar ociosa**:
   ```javascript
   await window.__GLYVIO_AI__.waitForIdle(callbackId, 15000);
   ```
