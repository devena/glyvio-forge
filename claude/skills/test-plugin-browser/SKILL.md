---
name: test-plugin-browser
description: Inststruções para o Claude Code navegar, testar e alterar a aplicação Glyvio via Browser usando Semântica do Flutter Web e a Glyvio Dev Bridge.
---

# Skill: Navesgação e Teste Semântico de Plugins no Glyvio App via Browser

Esta skill guia o **Claude Code** para interagir com o **Glyvio App** no browser, navegar pelas telas geradas por um plugin, preencher formulários, testar interações e validar mudanças.

---

## 1. Fluxo de Trabalho de Desenvolvimento & Teste

Sempre que alterar o código de um plugin (`plugin/app`, `plugin/server` ou `manifest.json`):

1. **Compilar o Plugin**:
   ```sh
   pnpm build
   ```
2. **Garantir que o Glyvio App esteja rodando**:
   - URL padrão de dev: `http://localhost:8080` (ou porta configurada).
3. **Navegar via Playwright MCP**:
   - Abra a URL no browser usando a ferramenta do Playwright MCP.

---

## 2. Inspecionando a Árvore Semântica do Flutter Web

O Flutter Web renderiza nós semânticos no elemento `<flt-semantics-host>`. Para navegar e interagir:

### Método A: Inspecionar via Dev Bridge (`window.__GLYVIO_DEV__`)
Execute no console da página:
```javascript
window.__GLYVIO_DEV__.getSemanticsSnapshot();
```
Isso retorna uma lista JSON com os botões, rótulos e campos visíveis:
```json
[
  { "tag": "FLT-SEMANTICS", "id": "engesolda.modal1.btn_save", "role": "button", "label": "Salvar Soldador" },
  { "tag": "FLT-SEMANTICS", "id": "engesolda.page1.input_name", "role": "textbox", "label": "Nome do Soldador" }
]
```

### Método B: Hot-Reload do Plugin sem dar Refresh na Página
Para testar alterações no JS sem perder o estado/sessão do app:
```javascript
window.__GLYVIO_DEV__.reloadPluginScript('engesolda-bundle', '/plugins/engesolda/dist/bundle.js');
```

---

## 3. Interagindo com Elementos Semânticos no Playwright MCP

* **Clicar em um botão pelo label semântico**:
  Procure o elemento com `aria-label="<label>"` ou `id="<identifier>"`.
* **Preencher campos**:
  Localize o campo pelo label semântico e envie as teclas correspondentes.
* **Captura de Logs**:
  Verifique os `browser_console_logs` para garantir que nenhum interceptor ou callback lançou erros durante a execução.
