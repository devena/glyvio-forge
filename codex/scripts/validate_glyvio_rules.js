#!/usr/bin/env node
// Generated from src/scripts/validate_glyvio_rules.js by tools/generate.py.

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
    if (/\bnew\s+glyvio_entity\.[A-Z]\w*\s*\(/.test(line)) {
      console.error(`❌ [${relPath}:${lineNum}] Direct entity constructor call detected.`);
      console.error(`   Line: ${line.trim()}`);
      console.error(`   Fix: Use 'await glyvio_entity.EntityName.new()' instead.\n`);
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
