#!/usr/bin/env node

/**
 * Static AST & Regex Linter for Glyvio Architecture Rules
 * Validates TypeScript files under plugin/app/src against non-negotiable architectural rules.
 */

const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'plugin/app/src');

if (!fs.existsSync(targetDir)) {
  console.log(`[glyvio-linter] Directory ${targetDir} does not exist. Skipping app lint.`);
  process.exit(0);
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.startsWith('.') || file === 'node_modules' || file === 'dist') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const tsFiles = getAllFiles(targetDir);
let errorCount = 0;
let warningCount = 0;

console.log(`[glyvio-linter] Validating ${tsFiles.length} files in ${targetDir}...\n`);

for (const filePath of tsFiles) {
  const relPath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Rule 1: Direct Entity constructor instantiation (new glyvio_entity.X())
    // The .new() factory is mandatory in every layer; only the `await` differs.
    // Exception: AttachmentEntity built from a structure cast with a pre-generated id.
    if (/\bnew\s+glyvio_entity\.[A-Z]\w*\s*\(/.test(line) && !/\bnew\s+glyvio_entity\.AttachmentEntity\s*\(/.test(line)) {
      console.error(`❌ [${relPath}:${lineNum}] Direct entity constructor call detected.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Use the '.new()' factory — 'await glyvio_entity.X.new()' in plugin/app,`);
      console.error(`        'glyvio_entity.X.new()' (no await) in plugin/server and plugin/environment.\n`);
      errorCount++;
    }

    // Rule 2: stateName missing 'state.' prefix in interopDesign
    if (/stateName\s*:\s*['"](?!state\.)[\w.]+['"]/.test(line)) {
      console.error(`❌ [${relPath}:${lineNum}] interopDesign stateName missing 'state.' prefix.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Change stateName to start with 'state.' (e.g. 'state.results').\n`);
      errorCount++;
    }

    // Rule 3: EntityAutocomplete bound to xxxId / xxxIc instead of relation getter xxx
    if (/(?:SingleTextfield|Autocomplete).*?(?:name|isRequired|errorText)\s*:\s*['"][\w.]+(?:Id|Ic)['"]/.test(line)) {
      console.error(`❌ [${relPath}:${lineNum}] Autocomplete bound to foreign-key ID property instead of relation property.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Remove 'Id'/'Ic' suffix to bind to relation getter (e.g. 'state.delivery.sale' instead of 'saleId').\n`);
      errorCount++;
    }

    // Rule 4: Redundant callRefreshState() inside onEvent
    if (/this\.getView\(\)\.callRefreshState\(\)/.test(line)) {
      console.error(`❌ [${relPath}:${lineNum}] Redundant callRefreshState() call detected inside event handler.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Remove this call — state refresh happens automatically after onEvent.\n`);
      errorCount++;
    }

    // Rule 5: Raw JS Date or raw TypeScript number in state definitions
    if (/\b(?:Date|number)\b/.test(line) && /State\b/.test(relPath)) {
      if (!line.includes('//') && !line.includes('*')) {
        console.warn(`⚠️ [${relPath}:${lineNum}] Potential raw Date or number in state definition.`);
        console.warn(`   Line: ${line.trim()}`);
        console.warn(`   Recommendation: Use DateTime or Decimal for state types.\n`);
        warningCount++;
      }
    }
  });

  // Rule 7 (§1.2): scalar FK id assigned at runtime instead of the whole entity
  // ❌ state.delivery.saleId = x.id     ✅ state.delivery.sale = saleObj
  lines.forEach((line, idx) => {
    const m = /^\s*(?:this\.)?(state\.[\w.]*?)(\w+)(Id|Ic)\s*=\s*(?!=)/.exec(line);
    if (m && !line.trim().startsWith('//')) {
      console.error(`❌ [${relPath}:${idx + 1}] Scalar foreign-key assignment — assign the entity object instead.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: '${m[1]}${m[2]} = <entityObject>' (drop the '${m[3]}' suffix).\n`);
      errorCount++;
    }
  });

  // Rule 8 (§1.2): StringTextfieldDesign used for a field that references another entity
  lines.forEach((line, idx) => {
    if (/new\s+glyvio_core\.StringTextfieldDesign/.test(line) && /name\s*:\s*['"][\w.]*(?:Id|Ic)['"]/.test(line)) {
      console.error(`❌ [${relPath}:${idx + 1}] StringTextfieldDesign bound to a foreign-key field.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Use the entity-specific subclass of EntityAutocompleteSingleTextfieldDesign.\n`);
      errorCount++;
    }
  });

  // Rule 9 (§3.2): nested Handlebars conditionals inside an interpolated string
  // Already rendered the literal "ERROR ON PROCESS PARSE" in production.
  lines.forEach((line, idx) => {
    const ifCount = (line.match(/\{\{#if/g) ?? []).length;
    if (ifCount >= 2) {
      console.error(`❌ [${relPath}:${idx + 1}] Nested {{#if}} inside an interpolated string.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Resolve the label/color in TypeScript (refreshState) and interpolate the result.\n`);
      errorCount++;
    }
  });

  // Rule 10 (§3.5): cart titleOpened/subtitleOpened are `string` in @types, never a design object
  lines.forEach((line, idx) => {
    if (/\.(?:titleOpened|subtitleOpened)\s*=\s*new\s+/.test(line)) {
      console.error(`❌ [${relPath}:${idx + 1}] titleOpened/subtitleOpened assigned a design object.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: These are plain 'string' in @types — assign a string (use $S{...} if dynamic).\n`);
      errorCount++;
    }
  });

  // Rule 6: FormEntityLayoutDesign missing actionKeyChangeObservers or actionKeyChangeTags
  if (content.includes('FormEntityLayoutDesign')) {
    if (!content.includes('actionKeyChangeObservers')) {
      console.error(`❌ [${relPath}] FormEntityLayoutDesign is missing 'actionKeyChangeObservers'.`);
      console.error(`   Fix: Add actionKeyChangeObservers: 'onChangeObservers'.\n`);
      errorCount++;
    }
    if (!content.includes('actionKeyChangeTags')) {
      console.error(`❌ [${relPath}] FormEntityLayoutDesign is missing 'actionKeyChangeTags'.`);
      console.error(`   Fix: Add actionKeyChangeTags: 'actionKeyChangeTags'.\n`);
      errorCount++;
    }
  }
}

console.log(`[glyvio-linter] Validation complete: ${errorCount} errors, ${warningCount} warnings.`);

if (errorCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
