// Full-Coverage & Evidence Ledger Auditor for co-arising 2.0:
// Enforces 100% file classification across Problem Space (D1/D2 -> E1) and Solution Space (S1/S2/S3 -> E2/E3/E4),
// checks architecture-style forbidden imports, inline shadow markers, and human-signoff SHA-256 freshness.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';
import { writeV2CoverageLedger } from './knowledge-db.mjs';

const TIER_RULES = {
  D1: { branch: 'problem', evidenceTier: 'E1' },
  D2: { branch: 'problem', evidenceTier: 'E1' },
  S1: { branch: 'solution', evidenceTier: 'E2' },
  S2: { branch: 'solution', evidenceTier: 'E3' },
  S3: { branch: 'solution', evidenceTier: 'E4' },
};

const VALID_STAGES = new Set(['stage-0-raw', 'stage-1-shadow', 'stage-2-cloze', 'stage-3-generated']);

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function toPosix(relPath) {
  return relPath.split(sep).join('/');
}

function collectGovernedFiles(baseDir, governedRoots) {
  const found = new Set();
  for (const spec of governedRoots ?? []) {
    const absRoot = resolve(baseDir, spec.root);
    if (!existsSync(absRoot)) continue;
    const exts = spec.extensions ?? ['.ts', '.scala', '.mjs'];
    const ignores = spec.ignore ?? [];

    const walk = dir => {
      const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = toPosix(relative(baseDir, full));
        if (ignores.some(ig => rel === ig || rel.startsWith(`${ig}/`) || rel.includes(`/${ig}/`))) continue;
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
          found.add(rel);
        }
      }
    };
    walk(absRoot);
  }
  return [...found].sort();
}

export function loadEffectBinding(bindingFile) {
  const abs = resolve(bindingFile);
  const raw = readFileSync(abs, 'utf8');
  const doc = parseStructuredDoc(raw, abs);
  const errors = [];
  if (doc.schemaVersion !== 'co-arising.effect-binding/v2') {
    errors.push({
      code: 'V2_INVALID_EFFECT_BINDING',
      message: `effect binding schemaVersion must be "co-arising.effect-binding/v2", got ${JSON.stringify(doc.schemaVersion)}`,
    });
  }
  if (!Array.isArray(doc.effects) || doc.effects.length === 0) {
    errors.push({
      code: 'V2_INVALID_EFFECT_BINDING',
      message: 'effect binding must declare at least one effect protocol',
    });
  }
  return { doc, errors };
}

function checkForbiddenImports(baseDir, governedFiles, forbiddenImports) {
  const findings = [];
  for (const rule of forbiddenImports ?? []) {
    const regex = new RegExp(rule.forbidPattern, 'mu');
    for (const rel of governedFiles) {
      if (!rel.startsWith(rule.scopePrefix)) continue;
      const text = readFileSync(resolve(baseDir, rel), 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        if (regex.test(trimmed)) {
          findings.push({
            severity: 'error',
            code: 'V2_ARCH_FORBIDDEN_IMPORT',
            file: rel,
            line: i + 1,
            ruleId: rule.id,
            message: `${rule.id}: forbidden dependency in "${rel}:${i + 1}" (${rule.reason})`,
          });
        }
      }
    }
  }
  return findings;
}

export function auditFullCoverageV2({
  rootDir,
  manifestFile,
  effectBindingFile = null,
  dbFile = null,
} = {}) {
  const baseDir = resolve(rootDir);
  const manifestAbs = resolve(manifestFile);
  const manifest = JSON.parse(readFileSync(manifestAbs, 'utf8'));
  const diagnostics = [];

  if (manifest.schemaVersion !== 'co-arising.coverage-manifest/v2') {
    diagnostics.push({
      severity: 'error',
      code: 'V2_INVALID_MANIFEST_SCHEMA',
      message: `expected schemaVersion "co-arising.coverage-manifest/v2", got ${JSON.stringify(manifest.schemaVersion)}`,
    });
  }

  const governedFiles = collectGovernedFiles(baseDir, manifest.governedRoots);
  const governedSet = new Set(governedFiles);
  const manifestMap = new Map();

  for (const entry of manifest.files ?? []) {
    if (manifestMap.has(entry.path)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_DUPLICATE_MANIFEST_ENTRY',
        file: entry.path,
        message: `duplicate coverage manifest entry for "${entry.path}"`,
      });
      continue;
    }
    manifestMap.set(entry.path, entry);
  }

  // 1. Zero gray-zone invariant: every governed file MUST be classified
  for (const rel of governedFiles) {
    if (!manifestMap.has(rel)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_UNCOVERED_FILE',
        file: rel,
        message: `governed file "${rel}" is not registered in coverage-manifest.json (zero gray-zone invariant)`,
      });
    }
  }

  // 2. Validate every manifest entry against real disk state, tier rules, markers, and human signoff
  const ledgerEntries = [];
  const countsByTier = { D1: 0, D2: 0, S1: 0, S2: 0, S3: 0 };
  const countsByStage = { 'stage-0-raw': 0, 'stage-1-shadow': 0, 'stage-2-cloze': 0, 'stage-3-generated': 0 };
  const countsByEvidence = { E1: 0, E2: 0, E3: 0, E4: 0 };

  for (const [rel, entry] of manifestMap) {
    const abs = resolve(baseDir, rel);
    if (!existsSync(abs) || !governedSet.has(rel)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_STALE_MANIFEST_ENTRY',
        file: rel,
        message: `manifest entry "${rel}" does not match an existing file under governedRoots`,
      });
      continue;
    }

    const expected = TIER_RULES[entry.tier];
    if (!expected || entry.branch !== expected.branch || entry.evidenceTier !== expected.evidenceTier) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_INVALID_TIER_EVIDENCE',
        file: rel,
        message: `invalid mapping for "${rel}": tier=${entry.tier} requires branch=${expected?.branch} and evidenceTier=${expected?.evidenceTier}`,
      });
    }
    if (!VALID_STAGES.has(entry.stage)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_INVALID_STAGE',
        file: rel,
        message: `invalid graduation stage "${entry.stage}" for "${rel}"`,
      });
    }

    const actualSha256 = sha256File(abs);

    // Inline shadow/contract marker check when shadowMode === 'inline-marker'
    if (entry.shadowMode === 'inline-marker') {
      const content = readFileSync(abs, 'utf8');
      if (!/@coarising:contract\(/u.test(content)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_MISSING_INLINE_MARKER',
          file: rel,
          message: `file "${rel}" declares shadowMode="inline-marker" but lacks // @coarising:contract(...) annotation`,
        });
      }
    }

    // E4 (S3 UI / subjective experience) requires explicit humanSignoff bound to current file SHA-256
    if (entry.evidenceTier === 'E4') {
      if (!entry.humanSignoff) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_MISSING_HUMAN_SIGNOFF',
          file: rel,
          message: `E4 file "${rel}" requires explicit humanSignoff record (reviewer, fileSha256, signedAt, checklist)`,
        });
      } else if (entry.humanSignoff.fileSha256 !== actualSha256) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_STALE_HUMAN_SIGNOFF',
          file: rel,
          message: `humanSignoff for "${rel}" is stale (signed ${entry.humanSignoff.fileSha256.slice(0, 12)}, current ${actualSha256.slice(0, 12)}); re-review required`,
        });
      }
    }

    if (expected) {
      countsByTier[entry.tier] += 1;
      countsByEvidence[entry.evidenceTier] += 1;
    }
    if (VALID_STAGES.has(entry.stage)) {
      countsByStage[entry.stage] += 1;
    }

    ledgerEntries.push({
      path: rel,
      branch: entry.branch,
      tier: entry.tier,
      stage: entry.stage,
      evidenceTier: entry.evidenceTier,
      contractRef: entry.contractRef ?? null,
      fileSha256: actualSha256,
      humanSignoff: entry.humanSignoff ?? null,
    });
  }

  // 3. Architecture-style Effect Binding & Forbidden Import Fitness Function
  let resolvedBindingPath = null;
  if (effectBindingFile) {
    resolvedBindingPath = resolve(effectBindingFile);
  } else if (manifest.effectBindingFile) {
    resolvedBindingPath = resolve(baseDir, manifest.effectBindingFile);
  }

  let effectBindingSummary = null;
  if (resolvedBindingPath) {
    const loadedBinding = loadEffectBinding(resolvedBindingPath);
    for (const err of loadedBinding.errors) {
      diagnostics.push({ severity: 'error', ...err });
    }
    const importFindings = checkForbiddenImports(baseDir, governedFiles, loadedBinding.doc.forbiddenImports ?? []);
    diagnostics.push(...importFindings);
    effectBindingSummary = {
      file: toPosix(relative(baseDir, resolvedBindingPath)),
      architectureStyle: loadedBinding.doc.architectureStyle,
      effectCount: (loadedBinding.doc.effects ?? []).length,
      forbiddenImportRules: (loadedBinding.doc.forbiddenImports ?? []).length,
      importViolations: importFindings.length,
    };
  }

  const passed = diagnostics.filter(d => d.severity === 'error').length === 0;
  let dbRecord = null;
  if (passed && dbFile) {
    dbRecord = writeV2CoverageLedger(dbFile === ':memory:' ? ':memory:' : resolve(dbFile), ledgerEntries);
  }

  return {
    schemaVersion: 'co-arising.coverage-audit/v2',
    passed,
    system: manifest.system,
    context: manifest.context,
    totalGovernedFiles: governedFiles.length,
    classifiedFiles: ledgerEntries.length,
    coverageRatio: governedFiles.length === 0 ? 1 : ledgerEntries.length / governedFiles.length,
    countsByTier,
    countsByStage,
    countsByEvidence,
    effectBindingSummary,
    dbRecord,
    diagnostics,
  };
}
