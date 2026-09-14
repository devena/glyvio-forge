#!/usr/bin/env node

/**
 * glyvio-forge — gerador de distribuições por plataforma.
 *
 * Fonte única em `src/`. Este script emite `claude/`, `antigravity/` e `agy/`
 * aplicando a tabela de substituição de cada plataforma.
 *
 * NUNCA edite os diretórios de saída à mão — eles são sobrescritos.
 *
 *   node build.js           # gera tudo
 *   node build.js --check   # falha se a saída estiver dessincronizada (CI)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

// ---------------------------------------------------------------------------
// Plataformas
// ---------------------------------------------------------------------------

/** Skills entregues ao AGY (o resto do catálogo não se aplica a ele). */
const AGY_SKILLS = ['audit-sync-task-query', 'format-llm-markdown-output', 'test-plugin-browser'];

const PLATFORMS = {
  claude: {
    out: 'claude',
    skills: 'all',
    agents: true,
    layout: {
      skills: 'skills',
      agents: 'agents',
      rules: '.', // architecture_rules.md e component_catalog.md na raiz de .claude/
      refs: 'references',
      scripts: 'scripts',
      mcp: 'mcp.json',
    },
    // Claude Code só carrega CLAUDE.md automaticamente — o template importa as regras.
    template: { from: 'templates/CLAUDE.template.md', to: 'CLAUDE.template.md' },
    tokens: {
      SKILLS_DIR: '.claude/skills',
      SCRIPTS_DIR: '.claude/scripts',
      REFS_DIR: '.claude/references',
      CATALOG: '.claude/component_catalog.md',
      RULES: '.claude/architecture_rules.md',
      TEMP_DIR: '.agents/temp',
      WRITE_TOOL: 'the `Write` tool',
      SHELL_TOOL: 'the `Bash` tool',
      AGENT_DOC: 'CLAUDE.md',
      TOOL_LIST: '`Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`',
    },
    agentFrontmatter: {
      tools: 'Read, Grep, Glob, Edit, Write, Bash, Skill, TodoWrite',
      model: 'opus',
      foldDescription: false,
    },
  },

  antigravity: {
    out: 'antigravity',
    skills: 'all',
    agents: true,
    pluginJson: true,
    layout: {
      skills: 'skills',
      agents: 'agents',
      rules: 'rules',
      refs: 'rules/references',
      scripts: 'scripts',
      mcp: 'mcp_config.json',
    },
    template: { from: 'templates/CLAUDE.template.md', to: 'AGENTS.template.md' },
    tokens: {
      SKILLS_DIR: 'antigravity/skills',
      SCRIPTS_DIR: 'antigravity/scripts',
      REFS_DIR: 'antigravity/rules/references',
      CATALOG: 'antigravity/rules/component_catalog.md',
      RULES: 'antigravity/rules/architecture_rules.md',
      TEMP_DIR: '.agents/temp',
      WRITE_TOOL: '`write_to_file`',
      SHELL_TOOL: '`run_command`',
      AGENT_DOC: 'AGENTS.md',
      TOOL_LIST:
        '`view_file`, `grep_search`, `list_dir`, `replace_file_content`, `write_to_file`, `run_command`',
    },
    agentFrontmatter: {
      tools: null, // Antigravity não declara tools no frontmatter
      model: 'pro',
      foldDescription: true,
    },
  },

  agy: {
    out: 'agy',
    skills: AGY_SKILLS,
    agents: false,
    layout: {
      skills: 'skills',
      rules: 'rules',
      refs: 'rules/references',
      scripts: 'scripts',
      mcp: 'mcp_config.json',
    },
    tokens: {
      SKILLS_DIR: 'agy/skills',
      SCRIPTS_DIR: 'agy/scripts',
      REFS_DIR: 'agy/rules/references',
      CATALOG: 'agy/rules/component_catalog.md',
      RULES: 'agy/rules/architecture_rules.md',
      TEMP_DIR: '.agents/temp',
      WRITE_TOOL: '`write_to_file`',
      SHELL_TOOL: '`run_command`',
      AGENT_DOC: 'AGENTS.md',
      TOOL_LIST:
        '`view_file`, `grep_search`, `list_dir`, `replace_file_content`, `write_to_file`, `run_command`',
    },
  },
};

// ---------------------------------------------------------------------------
// Substituição
// ---------------------------------------------------------------------------

const TOKEN_RE = /\{\{([A-Z_]+)\}\}/g;

function render(text, tokens, origin) {
  return text.replace(TOKEN_RE, (match, name) => {
    if (!(name in tokens)) {
      throw new Error(`Token desconhecido ${match} em ${origin}`);
    }
    return tokens[name];
  });
}

// ---------------------------------------------------------------------------
// Frontmatter dos agentes
// ---------------------------------------------------------------------------

function splitFrontmatter(text, origin) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`Frontmatter ausente ou malformado em ${origin}`);
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2];
  }
  return { fields, body: match[2] };
}

function buildAgent(text, platform, origin) {
  const { fields, body } = splitFrontmatter(text, origin);
  const cfg = platform.agentFrontmatter;
  if (!fields.name) throw new Error(`Agente sem \`name\` em ${origin}`);
  if (!fields.description) throw new Error(`Agente sem \`description\` em ${origin}`);

  const lines = [`name: ${fields.name}`];
  lines.push(cfg.foldDescription ? `description: >-\n  ${fields.description}` : `description: ${fields.description}`);
  if (cfg.tools) lines.push(`tools: ${cfg.tools}`);
  if (cfg.model) lines.push(`model: ${cfg.model}`);

  return `---\n${lines.join('\n')}\n---\n${body}`;
}

// ---------------------------------------------------------------------------
// Emissão
// ---------------------------------------------------------------------------

const checkOnly = process.argv.includes('--check');
const stale = [];
let written = 0;

function emit(outPath, content) {
  const abs = path.join(ROOT, outPath);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (current === content) return;
  if (checkOnly) {
    stale.push(outPath);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  written++;
}

function listSkills(platform) {
  const all = fs
    .readdirSync(path.join(SRC, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (platform.skills === 'all') return all;
  for (const name of platform.skills) {
    if (!all.includes(name)) throw new Error(`Skill "${name}" listada para ${platform.out} não existe em src/skills`);
  }
  return platform.skills.slice().sort();
}

function buildPlatform(key) {
  const platform = PLATFORMS[key];
  const { tokens, layout } = platform;
  const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

  // skills
  for (const name of listSkills(platform)) {
    const origin = `src/skills/${name}/SKILL.md`;
    emit(path.join(platform.out, layout.skills, name, 'SKILL.md'), render(read(`skills/${name}/SKILL.md`), tokens, origin));
  }

  // agents
  if (platform.agents) {
    for (const file of fs.readdirSync(path.join(SRC, 'agents')).filter((f) => f.endsWith('.md')).sort()) {
      const origin = `src/agents/${file}`;
      emit(path.join(platform.out, layout.agents, file), buildAgent(render(read(`agents/${file}`), tokens, origin), platform, origin));
    }
  }

  // rules + catálogos
  emit(path.join(platform.out, layout.rules, 'architecture_rules.md'), render(read('rules/architecture_rules.md'), tokens, 'src/rules/architecture_rules.md'));
  emit(path.join(platform.out, layout.rules, 'component_catalog.md'), render(read('rules/component_catalog.md'), tokens, 'src/rules/component_catalog.md'));
  emit(path.join(platform.out, layout.refs, 'component_catalog_full.md'), render(read('rules/references/component_catalog_full.md'), tokens, 'src/rules/references/component_catalog_full.md'));

  // scripts (JS puro — sem substituição de token)
  for (const file of fs.readdirSync(path.join(SRC, 'scripts')).sort()) {
    emit(path.join(platform.out, layout.scripts, file), read(`scripts/${file}`));
  }

  // configs
  emit(path.join(platform.out, layout.mcp), read('mcp.json'));
  if (platform.pluginJson) emit(path.join(platform.out, 'plugin.json'), read('plugin.json'));
  if (platform.template) {
    emit(path.join(platform.out, platform.template.to), render(read(platform.template.from), tokens, `src/${platform.template.from}`));
  }
}

// ---------------------------------------------------------------------------
// Catálogo (docs/skills.md) — gerado do frontmatter, nunca escrito à mão
// ---------------------------------------------------------------------------

/** Prefixo do nome da skill → camada. A primeira correspondência vence. */
const LAYERS = [
  ['App (frontend)', (n) => /-(page|modal|sidebar|cart)(-interceptor)?$/.test(n) || n === 'create-app-strategy' || n === 'create-screen-from-image' || n === 'create-entity-links-section'],
  ['Server (backend)', (n) => /interceptor$/.test(n) || ['create-controller', 'create-strategy', 'create-notification', 'create-timeline-entry', 'schedule-queued-operation', 'audit-sync-task-query', 'query-external-datasource', 'external-user-api', 'fork-company-script'].includes(n)],
  ['Environment (IA)', (n) => ['create-system-tool', 'create-custom-agent', 'format-llm-markdown-output'].includes(n)],
  ['Configuração e processo', () => true],
];

/** Abreviações que não terminam frase — protegidas antes de procurar o ponto final. */
const ABBREV = /\b(e\.g|i\.e|etc|ex|vs|cf|Ex|obs)\./g;

function firstSentence(text) {
  let cut = text.replace(/\s+/g, ' ').trim();
  // remove escalar YAML citado ('...' ou "...")
  if (/^'.*'$/.test(cut) || /^".*"$/.test(cut)) cut = cut.slice(1, -1).replace(/''/g, "'");
  const masked = cut.replace(ABBREV, (m) => m.replace(/\./g, ' '));
  const stop = masked.search(/\.(\s|$)/);
  const sentence = (stop === -1 ? masked : masked.slice(0, stop + 1)).replace(/ /g, '.').trim();
  // tabela markdown: escapa o pipe
  return sentence.replace(/\|/g, '\\|');
}

function buildCatalog() {
  const skills = fs
    .readdirSync(path.join(SRC, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const { fields } = splitFrontmatter(fs.readFileSync(path.join(SRC, 'skills', name, 'SKILL.md'), 'utf8'), `src/skills/${name}/SKILL.md`);
      const layer = LAYERS.find(([, test]) => test(name))[0];
      return { name, layer, summary: firstSentence(fields.description || '') };
    });

  const agents = fs
    .readdirSync(path.join(SRC, 'agents'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const { fields } = splitFrontmatter(fs.readFileSync(path.join(SRC, 'agents', file), 'utf8'), `src/agents/${file}`);
      return { name: fields.name, summary: firstSentence(fields.description || '') };
    });

  const out = [
    '<!-- GERADO POR build.js — NÃO EDITE À MÃO. Edite o frontmatter em src/skills/ e rode `node build.js`. -->',
    '',
    '# Catálogo de skills e agentes',
    '',
    `${skills.length} skills e ${agents.length} agentes. Invoque uma skill no chat com \`/nome-da-skill\`.`,
    '',
  ];

  for (const [layer] of LAYERS) {
    const rows = skills.filter((s) => s.layer === layer);
    if (!rows.length) continue;
    out.push(`## ${layer}`, '', '| Skill | O que faz |', '| --- | --- |');
    for (const s of rows) out.push(`| \`/${s.name}\` | ${s.summary} |`);
    out.push('');
  }

  out.push('## Agentes', '', '| Agente | Quando usar |', '| --- | --- |');
  for (const a of agents) out.push(`| \`${a.name}\` | ${a.summary} |`);
  out.push('');

  emit(path.join('docs', 'skills.md'), out.join('\n'));
}

for (const key of Object.keys(PLATFORMS)) buildPlatform(key);
buildCatalog();

if (checkOnly) {
  if (stale.length) {
    console.error(`[forge] ${stale.length} arquivo(s) dessincronizado(s) com src/:`);
    for (const f of stale) console.error(`  ${f}`);
    console.error('\nRode `node build.js` e faça commit do resultado.');
    process.exit(1);
  }
  console.log('[forge] saída sincronizada com src/.');
} else {
  console.log(`[forge] ${written} arquivo(s) escrito(s) em ${Object.keys(PLATFORMS).join(', ')}.`);
}
