#!/usr/bin/env node
// Zero-dependency static linter and generator architecture gate for metarch-truthsrc.
//
// Enforces:
//   1. Syntax validity across all .mjs / .js source files (`node --check`).
//   2. JS code hygiene: no `debugger`, no duplicate import sources, no `var `
//      in curated emitter/layout/tool modules, no `console.log` in library/emitter
//      modules, no tab indentation in emitter/layout modules.
//   3. Generator architecture rules:
//      - No hardcoded `'app/'` Scala path construction in `emitter/families/*.mjs`
//        (must route through `lib/layout/layout-strategy.mjs`).
//      - No direct package-to-path `.split('.').join('/')` or `.replaceAll('.', '/')`
//        path assembly in `emitter/families/*.mjs`.
//      - No hardcoded business identifiers or domain flip whitelists in `lib/`,
//        `bin/`, `generators/scala-cqrs-play-service/`, or production code of
//        `emitter/families/`.
//      - No hardcoded `net.imadz` / `net/imadz` runtime coordinates outside
//        `lib/runtime-profile.mjs` in `lib/`, `generators/scala-cqrs-play-service/`,
//        and active unified `emitter/families/`.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['emitter', 'lib', 'src', 'generators', 'tools', 'bin'];
const IGNORE_DIRS = new Set(['node_modules', '.git', 'target', 'cache', '_deprecated']);

function walkJsFiles(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(rel, out);
    } else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.js'))) {
      out.push(rel);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap(d => walkJsFiles(d)).sort();
const errors = [];

const report = (file, line, rule, message) => {
  errors.push({ file, line, rule, message });
};

// 1. Syntax check every JS/MJS file via `node --check`.
for (const rel of files) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
  } catch (err) {
    const stderr = String(err.stderr || err.message || '').trim().split('\n')[0];
    report(rel, 1, 'syntax', stderr || 'syntax error');
  }
}

// 2. Static hygiene + generator architecture rules.
const FORBIDDEN_BUSINESS_NAMES = /\b(bankwealth|CreditBalance|FundOrder|SipPlan|BankPayment|BankRefund|BankService|BankTa|BankSip|RULES_FLIP_AGGREGATES|EFFECT_FACE_FLIPS|PIPELINE_INVOCATION_FLIPS|[A-Z_]+_FLIP_CONTEXTS)\b|bank-(?:sip-dispatch|ta-effect|ta-submission|cash-payment|independent-refund|payment-host|refund-host)/u;
const FORBIDDEN_RUNTIME_LITERAL = /\bnet[./]imadz\b/u;
const ACTIVE_UNIFIED_EMITTERS = new Set([
  'emitter/families/value-object.mjs',
  'emitter/families/domain-entity.mjs',
  'emitter/families/aggregate-invariant-rules.mjs',
  'emitter/families/event-handler.mjs',
  'emitter/families/protocol-layer.mjs',
  'emitter/families/aggregate-layer.mjs',
  'emitter/families/aggregate-repository.mjs',
  'emitter/families/aggregate-bootstrap.mjs',
  'emitter/families/external-event-bridge.mjs',
  'emitter/families/proto-schema.mjs',
  'emitter/families/proto-converter.mjs',
  'emitter/families/serialization-adapter.mjs',
  'emitter/families/service-runtime.mjs',
  'emitter/families/project-scaffold.mjs',
  'emitter/families/effect-face.mjs',
  'emitter/families/pipeline-invocation-face.mjs',
]);

for (const rel of files) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = source.split('\n');
  const seenImports = new Set();
  const isEmitterFamily = rel.startsWith('emitter/families/') && rel !== 'emitter/families/index.mjs' && rel !== 'emitter/families/project-scaffold.mjs';
  const isLayoutModule = rel.startsWith('lib/layout/') || rel === 'lib/derivation/value-object-package.mjs';
  const isGenericCore = rel.startsWith('lib/') || rel.startsWith('bin/') || rel.startsWith('generators/scala-cqrs-play-service/');
  const isActiveUnifiedEmitter = ACTIVE_UNIFIED_EMITTERS.has(rel);
  const isLibrary = (rel.startsWith('lib/') || rel.startsWith('emitter/families/') || rel.startsWith('generators/scala-cqrs-play-service/')) &&
    !rel.startsWith('lib/workshop/client.js');

  let inNegativesBattery = false;
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const trimmed = raw.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    if (isActiveUnifiedEmitter && (/^(?:export\s+)?function\s+runNegatives\b/u.test(trimmed) || /^const\s+NEGATIVES\s*=/u.test(trimmed))) {
      inNegativesBattery = true;
    }

    if (!isComment && /^debugger\s*;?$/u.test(trimmed)) {
      report(rel, lineNo, 'no-debugger', 'debugger statement is forbidden');
    }

    if (!isComment && /^import\s+.*?\s+from\s+['"]([^'"]+)['"]/u.test(trimmed)) {
      const m = trimmed.match(/from\s+['"]([^'"]+)['"]/u);
      if (m) {
        if (seenImports.has(m[1])) {
          report(rel, lineNo, 'no-duplicate-imports', `duplicate import source ${JSON.stringify(m[1])}`);
        }
        seenImports.add(m[1]);
      }
    }

    if ((isEmitterFamily || isLayoutModule || rel === 'tools/lint.mjs') && !isComment) {
      if (/^(?:export\s+)?var\s+[A-Za-z_$]/u.test(trimmed)) {
        report(rel, lineNo, 'no-var', 'use const/let instead of var');
      }
      if (/^\t/u.test(raw)) {
        report(rel, lineNo, 'no-tabs', 'use spaces instead of tabs');
      }
    }

    if (isLibrary && !isComment && /\bconsole\.log\s*\(/u.test(trimmed)) {
      report(rel, lineNo, 'no-console-log', 'avoid console.log in library/emitter modules');
    }

    // Architecture rule: emitter families must not hardcode `app/` Scala path assembly.
    if (isEmitterFamily && !isComment) {
      const isGoldenMeta = trimmed.includes('test/reference/') || trimmed.includes('EMISSION_FILES') ||
        (rel === 'emitter/families/proto-schema.mjs' && trimmed.includes("startsWith('app/protobuf/')")) ||
        (rel === 'emitter/families/composition-invocation-host.mjs' && trimmed.startsWith("'app/example/"));
      if (!isGoldenMeta && /['"`]app\//u.test(trimmed)) {
        report(rel, lineNo, 'arch/no-hardcoded-app-path', 'route Scala/Proto paths through lib/layout/layout-strategy.mjs instead of hardcoding app/');
      }
    }

    // Architecture rule: generic core (lib/, bin/, play-service) and active
    // unified emitter production code must never hardcode domain/business names
    // or context flip whitelists.
    if ((isGenericCore || (isActiveUnifiedEmitter && !inNegativesBattery)) && !isComment && FORBIDDEN_BUSINESS_NAMES.test(trimmed)) {
      report(rel, lineNo, 'arch/no-business-names', 'generic generator/emitter code must not hardcode business identifiers or domain flip whitelists');
    }

    // Architecture rule: runtime organization/package literals must be routed
    // through lib/runtime-profile.mjs instead of hardcoded across lib/ or active emitters.
    if ((isGenericCore || (isActiveUnifiedEmitter && !inNegativesBattery)) &&
        rel !== 'lib/runtime-profile.mjs' &&
        !isComment &&
        FORBIDDEN_RUNTIME_LITERAL.test(trimmed)) {
      report(rel, lineNo, 'arch/no-hardcoded-runtime', 'route runtime package/organization coordinates through lib/runtime-profile.mjs');
    }
  });
}

if (errors.length > 0) {
  for (const e of errors) {
    process.stderr.write(`${e.file}:${e.line} [${e.rule}] ${e.message}\n`);
  }
  process.stderr.write(`\nlint failed: ${errors.length} issue(s) across ${files.length} checked JS/MJS files.\n`);
  process.exit(1);
}

process.stdout.write(`lint ok: ${files.length} JS/MJS files checked, 0 issues.\n`);
