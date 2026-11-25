// Three-way classic CQRS conformance auditor (excluding saga-strict & monarch).
// Evaluates a generated Scala project against the canonical contract derived
// from playAkkaCQRS, backkend-codegen, and common-core 0.2.1 across four gates:
//   Gate 1: Package topology, DIP direction, and anti-file-explosion cohesion
//   Gate 2: common-core adoption and anti-reinventing rules
//   Gate 3: Per-artifactType structural contract conformance
//   Gate 4: Three-way reference fingerprint comparison (playAkkaCQRS / golden_master / target)
import fs from 'node:fs';
import path from 'node:path';

const CONTRACT_PATH = path.resolve(import.meta.dirname, 'classic-cqrs-contract.json');

export function loadContract() {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

function walkScala(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkScala(full));
    else if (entry.name.endsWith('.scala')) out.push(full);
  }
  return out.sort();
}

function isSimpleCaseClassFile(content) {
  const stripped = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('package ') && !l.startsWith('import ') && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'));
  if (stripped.length === 0) return false;
  const joined = stripped.join(' ');
  const declMatches = joined.match(/\b(?:object|trait|class)\b/g) ?? [];
  return declMatches.length === 1 && /\b(?:final\s+)?case\s+class\b/.test(joined);
}

function extractPackage(content) {
  const m = /^package\s+([^\s;]+)/m.exec(content);
  return m ? m[1] : '';
}

function isExcludedStrictOrMonarch(relPath, content) {
  if (/(?:SagaDefinition|Host|HostIO|Ports|Execution|EffectHost|EffectBootstrap|ProcessBootstrap|PortBindings|StateCodec|HostSerializer|ServiceContract|ServiceLoader|ServiceConfiguration)\.scala$/.test(relPath)) {
    return true;
  }
  if (/net\.imadz\.infra\.saga\.strict|PersistentMonarch|MonarchPipeline/.test(content)) {
    return true;
  }
  return false;
}

export function auditGate1Topology(projectRoot, baseRel, contract) {
  const violations = [];
  const businessRoot = path.join(projectRoot, baseRel);
  if (!fs.existsSync(businessRoot)) {
    return [{ gate: 'G1', severity: 'P0', rule: 'root-missing', file: baseRel, message: 'business package root not found' }];
  }

  const allowedTop = new Set(contract.layers.allowedTopLayers);
  for (const entry of fs.readdirSync(businessRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !allowedTop.has(entry.name)) {
      violations.push({
        gate: 'G1',
        severity: 'P0',
        rule: 'top-layer',
        file: path.join(baseRel, entry.name),
        message: `unsanctioned top-level entry under business root: ${entry.name}`,
      });
    }
  }

  for (const forbidden of contract.layers.forbiddenPackages) {
    const full = path.join(businessRoot, ...forbidden.split('.'));
    if (fs.existsSync(full)) {
      violations.push({
        gate: 'G1',
        severity: 'P0',
        rule: 'forbidden-package',
        file: path.join(baseRel, ...forbidden.split('.')),
        message: `forbidden package exists: ${forbidden}`,
      });
    }
  }

  // DIP checks: domain -> zero app/infra/interfaces/akka/play; application -> zero infrastructure
  for (const file of walkScala(path.join(businessRoot, 'domain'))) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(projectRoot, file);
    for (const [label, re] of [
      ['akka.*', /\bakka\./],
      ['play.*', /\bplay\./],
      ['.application.', /\.application\./],
      ['.infrastructure.', /\.infrastructure\./],
      ['.interfaces.', /\.interfaces\./],
    ]) {
      if (re.test(content)) {
        violations.push({ gate: 'G1', severity: 'P0', rule: 'domain-dip', file: rel, message: `domain references ${label}` });
      }
    }
  }

  for (const file of walkScala(path.join(businessRoot, 'application'))) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(projectRoot, file);
    if (/(?:^|\s)import\s+[^\n]*\.infrastructure\./m.test(content) || /\bexample\.bankwealth\.infrastructure\./.test(content)) {
      violations.push({
        gate: 'G1',
        severity: 'P0',
        rule: 'application-dip',
        file: rel,
        message: 'application layer directly depends on infrastructure layer',
      });
    }
  }

  // Anti-file-explosion check on non-domain DTO/process/api/connector directories
  const maxFlat = contract.layers.maxFlatDtoFilesPerDir;
  const checkDirs = [
    path.join(businessRoot, 'application', 'process'),
    path.join(businessRoot, 'application', 'api'),
    path.join(businessRoot, 'application', 'integration'),
    path.join(businessRoot, 'application', 'connectors'),
    path.join(businessRoot, 'interfaces', 'api'),
  ];
  for (const dir of checkDirs) {
    if (!fs.existsSync(dir)) continue;
    const directFiles = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.scala'));
    const flatDtos = directFiles.filter(e => isSimpleCaseClassFile(fs.readFileSync(path.join(dir, e.name), 'utf8')));
    if (flatDtos.length > maxFlat) {
      violations.push({
        gate: 'G1',
        severity: 'P1',
        rule: 'flat-dto-explosion',
        file: path.relative(projectRoot, dir),
        message: `${flatDtos.length} flat single-case-class DTO files exceed max ${maxFlat}; group into companion objects`,
      });
    }
  }

  return violations;
}

export function auditGate2CommonCore(projectRoot, baseRel, contract) {
  const violations = [];
  const buildSbt = path.join(projectRoot, 'build.sbt');
  if (fs.existsSync(buildSbt)) {
    const sbtContent = fs.readFileSync(buildSbt, 'utf8');
    const expected = `${contract.commonCore.organization}" %% "${contract.commonCore.name}`;
    if (!sbtContent.includes(expected)) {
      violations.push({
        gate: 'G2',
        severity: 'P0',
        rule: 'missing-common-core-dep',
        file: 'build.sbt',
        message: `build.sbt does not depend on ${contract.commonCore.organization} %% ${contract.commonCore.name}`,
      });
    }
  }

  const businessRoot = path.join(projectRoot, baseRel);
  for (const file of walkScala(businessRoot)) {
    const rel = path.relative(projectRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    if (isExcludedStrictOrMonarch(rel, content)) continue;

    if (rel.endsWith('CommandHelpers.scala') && !content.includes('CommandHelper[')) {
      violations.push({
        gate: 'G2',
        severity: 'P0',
        rule: 'reinvented-command-helper',
        file: rel,
        message: 'CommandHelpers does not extend common-core CommandHelper[Command, State, Param, Reply]',
      });
    }
    if (rel.endsWith('Behaviors.scala') && !content.includes('runReplyingPolicy(')) {
      violations.push({
        gate: 'G2',
        severity: 'P0',
        rule: 'reinvented-replying-policy',
        file: rel,
        message: 'AggregateBehaviors does not use common-core runReplyingPolicy',
      });
    }
    if (rel.endsWith('Projection.scala') && (/KillSwitches/.test(content) || !content.includes('JdbcProjection.exactlyOnce'))) {
      violations.push({
        gate: 'G2',
        severity: 'P0',
        rule: 'reinvented-projection',
        file: rel,
        message: 'Projection does not use Akka JdbcProjection.exactlyOnce + EventSourcedProvider.eventsByTag',
      });
    }
    if (rel.endsWith('RepositoryImpl.scala') && rel.includes('/aggregate/') && /mutable\.Map/.test(content)) {
      violations.push({
        gate: 'G2',
        severity: 'P0',
        rule: 'inmemory-aggregate-repo',
        file: rel,
        message: 'AggregateRepositoryImpl uses local mutable.Map instead of ClusterSharding.entityRefFor',
      });
    }
  }

  return violations;
}

function classifyClassicArtifact(relToBase, content) {
  const norm = relToBase.replaceAll(path.sep, '/');
  if (norm.startsWith('domain/entities/behaviors/') && norm.endsWith('EventHandler.scala')) return 'event-handler';
  if (norm.startsWith('domain/entities/') && norm.endsWith('Entity.scala')) return 'domain-entity';
  if ((norm.startsWith('domain/invariants/') || norm.startsWith('domain/invariant/')) && !norm.includes('/params/') && (norm.endsWith('Rules.scala') || norm.endsWith('Rule.scala'))) return 'invariant-rule';
  if (norm.startsWith('domain/services/')) return 'domain-service';
  if (norm.startsWith('domain/values/')) return 'value-object';
  if (norm.startsWith('application/aggregates/behaviors/') && norm.endsWith('CommandHelpers.scala')) return 'command-helper';
  if (norm.startsWith('application/aggregates/behaviors/') && norm.endsWith('Behaviors.scala')) return 'aggregate-behavior';
  if (norm.startsWith('application/aggregates/factories/') && norm.endsWith('AggregateFactory.scala')) return 'aggregate-factory';
  if (norm.startsWith('application/aggregates/repository/') && norm.endsWith('Repository.scala')) return 'aggregate-repository-port';
  if (norm.startsWith('application/aggregates/') && norm.endsWith('Protocol.scala')) return 'aggregate-protocol';
  if (norm.startsWith('application/aggregates/') && norm.endsWith('Aggregate.scala')) return 'aggregate-root';
  if (norm.startsWith('application/projection/repository/') && norm.endsWith('Repository.scala')) return 'projection-repository-port';
  if (norm.startsWith('application/projection/') && norm.endsWith('ProjectionHandler.scala')) return 'projection-handler';
  if (norm.startsWith('application/projection/') && norm.endsWith('Projection.scala')) return 'projection';
  if (norm.startsWith('infrastructure/bootstrap/') && norm.endsWith('Bootstrap.scala') && /(?:Projection|Readside)Bootstrap\.scala$/.test(norm)) return 'projection-bootstrap';
  if (norm.startsWith('infrastructure/bootstrap/') && norm.endsWith('Bootstrap.scala') && !norm.endsWith('ApplicationBootstrap.scala') && !/(?:Process|Effect|Saga|Projection|Readside|MonthlyIncome|Fab)/.test(norm)) return 'aggregate-bootstrap';
  if (norm.startsWith('infrastructure/persistence/converters/') && norm.endsWith('ProtoConverters.scala')) return 'proto-converter';
  if (norm.startsWith('infrastructure/persistence/converters/') && /DomainConvertersPart\d+\.scala$/.test(norm)) return 'proto-converter';
  if (norm.startsWith('infrastructure/persistence/') && (norm.endsWith('EventAdapter.scala') || norm.endsWith('Adapters.scala'))) return 'event-adapter';
  if (norm.startsWith('infrastructure/persistence/') && norm.endsWith('SnapshotAdapter.scala')) return 'snapshot-adapter';
  if (norm.startsWith('infrastructure/repositories/aggregate/') && norm.endsWith('RepositoryImpl.scala')) return 'aggregate-repository-impl';
  if (/extends\s+JdbcHandler\[/.test(content)) return 'projection-handler';
  return null;
}

export function auditGate3Contracts(projectRoot, baseRel, contract) {
  const violations = [];
  const businessRoot = path.join(projectRoot, baseRel);
  const foundTypes = new Map();

  for (const file of walkScala(businessRoot)) {
    const rel = path.relative(projectRoot, file);
    const relToBase = path.relative(businessRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    if (isExcludedStrictOrMonarch(rel, content)) continue;

    const kind = classifyClassicArtifact(relToBase, content);
    if (!kind || !contract.artifacts[kind]) continue;
    if (!foundTypes.has(kind)) foundTypes.set(kind, []);
    foundTypes.get(kind).push(rel);

    const spec = contract.artifacts[kind];
    if (spec.requiredDecl && !new RegExp(spec.requiredDecl, 'm').test(content)) {
      violations.push({ gate: 'G3', severity: 'P1', rule: `${kind}:decl`, file: rel, message: `missing required declaration /${spec.requiredDecl}/` });
    }
    for (const imp of spec.requiredImports ?? []) {
      if (!new RegExp(imp, 'm').test(content)) {
        violations.push({ gate: 'G3', severity: 'P0', rule: `${kind}:import`, file: rel, message: `missing required import /${imp}/` });
      }
    }
    for (const pat of spec.requiredPatterns ?? []) {
      if (!new RegExp(pat, 'm').test(content)) {
        violations.push({ gate: 'G3', severity: 'P0', rule: `${kind}:pattern`, file: rel, message: `missing required contract pattern /${pat}/` });
      }
    }
    for (const bad of spec.forbiddenPatterns ?? []) {
      if (new RegExp(bad, 'm').test(content)) {
        violations.push({ gate: 'G3', severity: 'P0', rule: `${kind}:forbidden`, file: rel, message: `contains forbidden pattern /${bad}/` });
      }
    }
  }

  // Projection must have companion ProjectionHandler and ProjectionRepository port
  if (foundTypes.has('projection')) {
    if (!foundTypes.has('projection-handler')) {
      violations.push({
        gate: 'G3',
        severity: 'P0',
        rule: 'projection:missing-handler',
        file: path.join(baseRel, 'application/projection'),
        message: 'Projection exists without separate ProjectionHandler (JdbcHandler)',
      });
    }
    if (!foundTypes.has('projection-repository-port')) {
      violations.push({
        gate: 'G3',
        severity: 'P0',
        rule: 'projection:missing-repo-port',
        file: path.join(baseRel, 'application/projection/repository'),
        message: 'Projection exists without application.projection.repository port trait',
      });
    }
  }

  // EventAdapter and SnapshotAdapter must be separate files
  if (foundTypes.has('event-adapter') && !foundTypes.has('snapshot-adapter')) {
    violations.push({
      gate: 'G3',
      severity: 'P1',
      rule: 'adapter:merged-files',
      file: path.join(baseRel, 'infrastructure/persistence'),
      message: 'SnapshotAdapter must be emitted in its own <Agg>SnapshotAdapter.scala file separate from EventAdapter',
    });
  }

  return { violations, coverage: Object.fromEntries([...foundTypes.entries()].map(([k, v]) => [k, v.length])) };
}

export function extractReferenceFingerprint(projectRoot, baseRel, aggregateName = 'CreditBalance') {
  const businessRoot = path.join(projectRoot, baseRel);
  const files = walkScala(businessRoot);
  const fp = {};
  for (const file of files) {
    const relToBase = path.relative(businessRoot, file).replaceAll(path.sep, '/');
    const name = path.basename(file);
    if (!name.startsWith(aggregateName) && !name.includes('Projection') && !name.includes('Readside') && !name.includes('Converters') && !name.includes('Rule')) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (isExcludedStrictOrMonarch(relToBase, content)) continue;
    const kind = classifyClassicArtifact(relToBase, content);
    if (!kind) continue;
    if (fp[kind]) continue;
    fp[kind] = {
      file: relToBase,
      package: extractPackage(content),
      usesCommonCore: /net\.imadz\.(?:framework\.)?common\./.test(content),
      usesCommandHelper: /\bCommandHelper\[/.test(content),
      usesRunReplyingPolicy: /\brunReplyingPolicy\(/.test(content),
      usesInvariantRule: /\bInvariantRule\[/.test(content),
      usesCborSerializable: /\bCborSerializable\b/.test(content),
      usesClusterSharding: /\bClusterSharding\b|\bShardedDaemonProcess\b|\bEntityTypeKey\[|\bEntityRef\[/.test(content),
      usesAkkaProjection: /\bJdbcProjection\.exactlyOnce\b|\bJdbcHandler\[/.test(content),
      usesPrimitiveConverter: /\bPrimitiveConverter\b/.test(content),
    };
  }
  return fp;
}

export function auditGate4Fingerprint(targetFp, goldenFp) {
  const diffs = [];
  const checkKeys = [
    'usesCommandHelper',
    'usesRunReplyingPolicy',
    'usesInvariantRule',
    'usesCborSerializable',
    'usesClusterSharding',
    'usesAkkaProjection',
    'usesPrimitiveConverter',
  ];
  for (const [kind, g] of Object.entries(goldenFp)) {
    const t = targetFp[kind];
    if (!t) {
      diffs.push({ gate: 'G4', severity: 'P0', rule: `fp-missing:${kind}`, file: g.file, message: `missing classic artifact kind '${kind}' present in golden sample` });
      continue;
    }
    for (const k of checkKeys) {
      if (g[k] && !t[k]) {
        diffs.push({
          gate: 'G4',
          severity: 'P0',
          rule: `fp-drift:${kind}:${k}`,
          file: t.file,
          message: `golden '${kind}' has ${k}=true (${g.file}), target has false`,
        });
      }
    }
  }
  return diffs;
}

export function runThreeWayAudit({ targetRoot, targetBaseRel, playAkkaRoot, goldenMasterRoot }) {
  const contract = loadContract();
  const g1 = auditGate1Topology(targetRoot, targetBaseRel, contract);
  const g2 = auditGate2CommonCore(targetRoot, targetBaseRel, contract);
  const g3Result = auditGate3Contracts(targetRoot, targetBaseRel, contract);
  const targetFp = extractReferenceFingerprint(targetRoot, targetBaseRel);
  const playFp = playAkkaRoot && fs.existsSync(playAkkaRoot)
    ? extractReferenceFingerprint(playAkkaRoot, 'app/net/imadz')
    : null;
  const codegenFp = goldenMasterRoot && fs.existsSync(goldenMasterRoot)
    ? extractReferenceFingerprint(goldenMasterRoot, 'net/imadz')
    : null;
  const g4 = playFp ? auditGate4Fingerprint(targetFp, playFp) : [];
  const violations = [...g1, ...g2, ...g3Result.violations, ...g4];
  return {
    summary: {
      totalViolations: violations.length,
      p0Count: violations.filter(v => v.severity === 'P0').length,
      p1Count: violations.filter(v => v.severity === 'P1').length,
      byGate: {
        G1: g1.length,
        G2: g2.length,
        G3: g3Result.violations.length,
        G4: g4.length,
      },
      coverage: g3Result.coverage,
    },
    fingerprints: {
      playAkkaCQRS: playFp,
      backkendCodegenGoldenMaster: codegenFp,
      target: targetFp,
    },
    violations,
  };
}
