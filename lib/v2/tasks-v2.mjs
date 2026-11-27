// Derived, drift-free task queue for co-arising 2.0 @cloze isolation zones and S1 effect adapters.
// Computes task states (PENDING | STALE | UNVERIFIED | GREEN_NEEDS_REVIEW | VERIFIED) directly from
// Canonical Model v2 + SQLite provenance + real handwritten files on disk.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readClozeProvenanceMap, recordClozeBlindReview } from './knowledge-db.mjs';
import { buildSandwichContextPack } from './context-pack.mjs';
import { parseClozeRanges } from './guard-write.mjs';
import { loadEffectBinding } from './coverage-audit.mjs';

function toPascal(name) {
  return name
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function loadProjectConfig(rootDir, projectFile) {
  const candidate = projectFile ? resolve(projectFile) : join(resolve(rootDir), 'truthsrc.v2.json');
  if (!existsSync(candidate)) return { config: null, absRoot: resolve(rootDir) };
  return {
    config: JSON.parse(readFileSync(candidate, 'utf8')),
    absRoot: dirname(candidate),
  };
}

function resolveFilePath(explicit, configValue, absRoot, fallbackRel) {
  if (explicit) return resolve(explicit);
  if (configValue) return resolve(absRoot, configValue);
  return fallbackRel ? join(absRoot, fallbackRel) : null;
}

function inspectTargetClozeFile(absRoot, slot, target, packageName) {
  const pkgDir = packageName.split('.').join('/');
  const pascal = toPascal(slot.target);
  let relPath;
  let oraclePath;
  if (target === 'scala-strict' || target === 'scala-cqrs-play-service-v2') {
    if (slot.layer === 'application') {
      relPath = `handwritten/scala/${pkgDir}/application/services/${pascal}Impl.scala`;
      oraclePath = `generated-tests/scala/${pkgDir}/application/services/${pascal}EarsSpec.scala`;
    } else {
      relPath = `handwritten/scala/${pkgDir}/domain/services/impl/${pascal}Impl.scala`;
      oraclePath = `generated-tests/scala/${pkgDir}/domain/invariants/${pascal}EarsSpec.scala`;
    }
  } else if (target === 'scala') {
    relPath = `handwritten/scala/${pkgDir}/${pascal}Cloze.scala`;
    oraclePath = `generated-tests/scala/${pkgDir}/${pascal}EarsSpec.scala`;
  } else {
    relPath = `handwritten/${slot.slotId}.cloze.ts`;
    oraclePath = `generated-tests/ts/${slot.slotId}.ears.spec.ts`;
  }
  const absPath = join(absRoot, relPath);
  if (!existsSync(absPath)) {
    return { target, file: relPath, oracle: oraclePath, exists: false, unimplemented: true, bounds: null };
  }
  const src = readFileSync(absPath, 'utf8');
  const ranges = parseClozeRanges(src).filter(r => r.id === slot.slotId);
  return {
    target,
    file: relPath,
    oracle: oraclePath,
    exists: true,
    unimplemented: src.includes('CLOZE_NOT_IMPLEMENTED'),
    bounds: ranges[0] ?? null,
  };
}

const STATUS_PRIORITY = {
  STALE: 1,
  PENDING: 2,
  UNVERIFIED: 3,
  GREEN_NEEDS_REVIEW: 4,
  VERIFIED: 5,
};

export function deriveClozeTasksV2({
  rootDir = process.cwd(),
  projectFile = null,
  canonicalFile = null,
  dbFile = null,
  effectBindingFile = null,
  targets = null,
  packageName = null,
  includeDone = false,
} = {}) {
  const { config, absRoot } = loadProjectConfig(rootDir, projectFile);
  const effCanonical = resolveFilePath(canonicalFile, config?.canonicalOut, absRoot, '.truthsrc/canonical-v2.json');
  const effDb = resolveFilePath(dbFile, config?.dbOut, absRoot, '.truthsrc/knowledge.sqlite');
  const effBinding = resolveFilePath(effectBindingFile, config?.effectBinding, absRoot, null);
  const effTargets = targets ?? config?.targets ?? ['typescript'];
  const effPackage = packageName ?? config?.packageName ?? 'example.v2';

  if (!existsSync(effCanonical)) {
    throw new Error(`V2_TASKS_NO_CANONICAL: compiled canonical file not found at "${effCanonical}" (run compile-v2 first)`);
  }
  const canonicalV2 = JSON.parse(readFileSync(effCanonical, 'utf8'));
  const provenanceMap = existsSync(effDb) ? readClozeProvenanceMap(effDb) : new Map();
  const behByTarget = new Map((canonicalV2.behaviors ?? []).map(b => [b.target, b]));

  const allClozeTasks = [];
  for (const slot of canonicalV2.clozeSlots ?? []) {
    const beh = behByTarget.get(slot.target);
    const currentBehaviorSha = beh?.verification?.canonicalSha256 ?? canonicalV2.canonicalSha256;
    const prov = provenanceMap.get(slot.slotId) ?? null;
    const targetFiles = effTargets.map(t => inspectTargetClozeFile(absRoot, slot, t, effPackage));
    const anyUnimplemented = targetFiles.some(tf => !tf.exists || tf.unimplemented);

    let status;
    if (anyUnimplemented) {
      status = 'PENDING';
    } else if (prov?.passed && prov.behaviorSha256 && prov.behaviorSha256 !== currentBehaviorSha) {
      status = 'STALE';
    } else if (!prov?.passed) {
      status = 'UNVERIFIED';
    } else if (prov.blindReview?.verdict === 'PASS' && prov.blindReview?.behaviorSha256 === currentBehaviorSha) {
      status = 'VERIFIED';
    } else {
      status = 'GREEN_NEEDS_REVIEW';
    }

    allClozeTasks.push({
      taskKind: 'cloze',
      slotId: slot.slotId,
      target: slot.target,
      kind: slot.kind,
      layer: slot.layer,
      tier: slot.tier,
      ruleIds: slot.ruleIds,
      behaviorSha256: currentBehaviorSha,
      status,
      actionable: status === 'PENDING' || status === 'STALE' || status === 'UNVERIFIED',
      needsBlindReview: status === 'GREEN_NEEDS_REVIEW',
      targetFiles,
      provenance: prov,
      activeClozeEnv: `COARISING_ACTIVE_CLOZE=${slot.slotId}`,
    });
  }

  allClozeTasks.sort((a, b) => (STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]) || a.slotId.localeCompare(b.slotId));

  // Optional S1 effect adapter tasks from bindings/*-effects.yaml
  const s1Tasks = [];
  if (effBinding && existsSync(effBinding)) {
    const { doc } = loadEffectBinding(effBinding);
    for (const eff of doc.effects ?? []) {
      s1Tasks.push({
        taskKind: 's1-effect-adapter',
        name: eff.name,
        protocol: eff.protocol,
        idempotencyKey: eff.idempotencyKey ?? null,
        verifyCommand: `truthsrc run-tck-v2 --protocol ${eff.protocol} --adapter <adapter-module>`,
      });
    }
  }

  const counts = {
    deterministicDone: canonicalV2.verificationSummary?.deterministicCount ?? 0,
    totalCloze: allClozeTasks.length,
    pending: allClozeTasks.filter(t => t.status === 'PENDING').length,
    stale: allClozeTasks.filter(t => t.status === 'STALE').length,
    unverified: allClozeTasks.filter(t => t.status === 'UNVERIFIED').length,
    greenNeedsReview: allClozeTasks.filter(t => t.status === 'GREEN_NEEDS_REVIEW').length,
    verified: allClozeTasks.filter(t => t.status === 'VERIFIED').length,
    s1Effects: s1Tasks.length,
  };

  const visibleTasks = includeDone ? allClozeTasks : allClozeTasks.filter(t => t.status !== 'VERIFIED');
  const parallelizable = allClozeTasks.filter(t => t.actionable);
  const reviewQueue = allClozeTasks.filter(t => t.needsBlindReview);

  return {
    schemaVersion: 'co-arising.tasks-v2/v1',
    system: canonicalV2.system,
    context: canonicalV2.context,
    canonicalSha256: canonicalV2.canonicalSha256,
    rootDir: absRoot,
    targets: effTargets,
    summary: counts,
    tasks: visibleTasks,
    parallelizable,
    reviewQueue,
    s1Tasks,
  };
}

export function getNextTaskWithContextPack(options = {}) {
  const report = deriveClozeTasksV2({ ...options, includeDone: true });
  const nextTask = report.parallelizable[0] ?? report.reviewQueue[0] ?? null;
  if (!nextTask) {
    return {
      schemaVersion: 'co-arising.next-task-v2/v1',
      done: true,
      summary: report.summary,
      nextTask: null,
      contextPack: null,
    };
  }
  const { config, absRoot } = loadProjectConfig(options.rootDir ?? process.cwd(), options.projectFile ?? null);
  const effCanonical = resolveFilePath(options.canonicalFile, config?.canonicalOut, absRoot, '.truthsrc/canonical-v2.json');
  const effDb = resolveFilePath(options.dbFile, config?.dbOut, absRoot, '.truthsrc/knowledge.sqlite');
  const canonicalV2 = JSON.parse(readFileSync(effCanonical, 'utf8'));
  const packRes = buildSandwichContextPack({
    canonicalV2,
    dbFile: existsSync(effDb) ? effDb : null,
    slotId: nextTask.slotId,
    workspaceDir: absRoot,
  });
  return {
    schemaVersion: 'co-arising.next-task-v2/v1',
    done: false,
    summary: report.summary,
    nextTask,
    contextPack: packRes.pack,
    contextPackMarkdown: packRes.markdown,
  };
}

export function recordTaskBlindReviewV2({
  rootDir = process.cwd(),
  projectFile = null,
  canonicalFile = null,
  dbFile = null,
  slotId,
  verdict,
  reviewer = 'blind-reviewer',
  notes = '',
} = {}) {
  if (!slotId) throw new Error('tasks-v2 --record-review requires --slot <slot-id>');
  if (verdict !== 'PASS' && verdict !== 'FAIL') {
    throw new Error('tasks-v2 --record-review requires --verdict PASS|FAIL');
  }
  const { config, absRoot } = loadProjectConfig(rootDir, projectFile);
  const effCanonical = resolveFilePath(canonicalFile, config?.canonicalOut, absRoot, '.truthsrc/canonical-v2.json');
  const effDb = resolveFilePath(dbFile, config?.dbOut, absRoot, '.truthsrc/knowledge.sqlite');
  if (!existsSync(effDb)) {
    throw new Error(`V2_TASKS_NO_DB: knowledge SQLite not found at "${effDb}"`);
  }
  let behaviorSha256 = null;
  if (existsSync(effCanonical)) {
    const canonicalV2 = JSON.parse(readFileSync(effCanonical, 'utf8'));
    const slot = (canonicalV2.clozeSlots ?? []).find(s => s.slotId === slotId);
    const beh = slot ? (canonicalV2.behaviors ?? []).find(b => b.target === slot.target) : null;
    behaviorSha256 = beh?.verification?.canonicalSha256 ?? canonicalV2.canonicalSha256;
  }
  const provenance = recordClozeBlindReview(effDb, slotId, { verdict, reviewer, notes, behaviorSha256 });
  return {
    schemaVersion: 'co-arising.review-record-v2/v1',
    slotId,
    verdict,
    reviewer,
    behaviorSha256,
    provenance,
  };
}

export function renderTasksV2Human(report) {
  const s = report.summary;
  const lines = [
    `[co-arising 2.0 tasks-v2] ${report.system}/${report.context} (sha=${report.canonicalSha256.slice(0, 12)})`,
    `  Channel 4A (L1 zero-token) : ${s.deterministicDone} DONE`,
    `  Channel 4B (@cloze slots)  : ${s.totalCloze} total | PENDING=${s.pending} STALE=${s.stale} UNVERIFIED=${s.unverified} NEEDS_REVIEW=${s.greenNeedsReview} VERIFIED=${s.verified}`,
    '',
  ];
  if (report.tasks.length === 0) {
    lines.push('  All @cloze slots are VERIFIED.');
  } else {
    for (const t of report.tasks) {
      const files = t.targetFiles.map(f => f.file).join(', ');
      lines.push(`  - [${t.status.padEnd(18)}] ${t.slotId} (${t.layer}/${t.tier}) -> ${files}`);
    }
  }
  if (report.s1Tasks.length > 0) {
    lines.push('');
    lines.push('  S1 Effect Protocols:');
    for (const eff of report.s1Tasks) {
      lines.push(`  - ${eff.name} [${eff.protocol}] -> ${eff.verifyCommand}`);
    }
  }
  return lines.join('\n');
}
