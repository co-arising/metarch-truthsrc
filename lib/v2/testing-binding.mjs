// Solution-space Layered Testing Strategy Binding for co-arising 2.0 (`bindings/*-testing.yaml`).
// Declares per-Onion-layer test harnesses (Pure DI, Mockito, Akka TestKit, Play Test, Effect TCK,
// H2/Testcontainers), behavioral coverage thresholds, and parallel TDD worktree isolation.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';

const VALID_DOMAIN_HARNESSES = new Set(['pure-unit', 'property-based']);
const VALID_APP_HARNESSES = new Set([
  'constructor-di',
  'akka-testkit',
  'akka-persistence-testkit',
  'mockito',
  'hybrid',
]);
const VALID_INTERFACE_HARNESSES = new Set([
  'in-process-router',
  'play-test',
  'supertest',
  'http-smoke',
]);
const VALID_INFRA_HARNESSES = new Set([
  'effect-tck',
  'h2-in-memory',
  'testcontainers',
  'wiremock',
  'real-dependency-smoke',
  'hybrid',
]);
const VALID_DOUBLE_STRATEGIES = new Set([
  'fake-stub',
  'mockito',
  'akka-probe',
  'wiremock',
  'in-memory',
]);
const VALID_WORKSPACE_MODES = new Set(['share', 'branch', 'inherit']);
const VALID_MERGE_STRATEGIES = new Set(['slot-patch', 'git-merge']);

function collectTestingBindingFiles(bindingPath) {
  if (!bindingPath) return [];
  const abs = resolve(bindingPath);
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (st.isFile()) return /(?:testing|test-strategy)/iu.test(abs) ? [abs] : [];
  const files = [];
  const entries = readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/(?:testing|test-strategy).*\.(?:yaml|yml|json)$/iu.test(entry.name)) {
      files.push(join(abs, entry.name));
    }
  }
  return files;
}

function validatePct(val, label, file, diagnostics) {
  if (val === undefined || val === null) return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_TESTING_INVALID_COVERAGE',
      file,
      message: `${label} must be a number between 0 and 100, got "${val}"`,
    });
    return null;
  }
  return num;
}

export function loadAndValidateTestingBindings(bindingPath, structures) {
  const files = collectTestingBindingFiles(bindingPath);
  const diagnostics = [];
  if (files.length === 0) {
    return { testing: null, diagnostics };
  }

  const portNames = new Set([
    ...(structures.ports ?? []).map(p => p.name),
    ...(structures.externContracts ?? []).map(e => e.name),
    ...(structures.sagas ?? []).map(s => s.name),
    ...(structures.readModels ?? []).map(r => r.name),
  ]);

  let merged = null;
  for (const file of files) {
    const doc = parseStructuredDoc(readFileSync(file, 'utf8'), file);
    if (doc.schemaVersion && doc.schemaVersion !== 'co-arising.testing-binding/v2') {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_INVALID_SCHEMA',
        file,
        message: `testing binding schemaVersion must be "co-arising.testing-binding/v2", got "${doc.schemaVersion}"`,
      });
      continue;
    }

    const layers = doc.layers ?? {};

    // 1. Domain layer (strictly pure — no Mockito/AkkaTestKit allowed inside pure domain!)
    const rawDomain = layers.domain ?? {};
    const domainHarness = String(rawDomain.harness ?? 'pure-unit').trim();
    if (!VALID_DOMAIN_HARNESSES.has(domainHarness)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_FORBIDDEN_DOMAIN_HARNESS',
        file,
        message: `domain layer harness "${domainHarness}" is forbidden (domain must remain pure; allowed: ${[...VALID_DOMAIN_HARNESSES].join(', ')}; place mockito/akka-testkit under layers.application or layers.infrastructure)`,
      });
    }
    const domainMinLine = validatePct(rawDomain.minLineCoverage, 'layers.domain.minLineCoverage', file, diagnostics);
    const domainMinBranch = validatePct(rawDomain.minBranchCoverage, 'layers.domain.minBranchCoverage', file, diagnostics);

    // 2. Application layer (constructor-di, akka-testkit, mockito, hybrid)
    const rawApp = layers.application ?? {};
    const appHarness = String(rawApp.harness ?? 'constructor-di').trim();
    if (!VALID_APP_HARNESSES.has(appHarness)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_INVALID_HARNESS',
        file,
        message: `layers.application.harness "${appHarness}" is invalid (allowed: ${[...VALID_APP_HARNESSES].join(', ')})`,
      });
    }
    const appMinLine = validatePct(rawApp.minLineCoverage, 'layers.application.minLineCoverage', file, diagnostics);
    const appMinBranch = validatePct(rawApp.minBranchCoverage, 'layers.application.minBranchCoverage', file, diagnostics);

    const doubles = [];
    for (const dbl of rawApp.doubles ?? []) {
      const targetPort = String(dbl.port ?? '').trim();
      const strategy = String(dbl.strategy ?? 'fake-stub').trim();
      if (!targetPort || (portNames.size > 0 && !portNames.has(targetPort))) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_TESTING_UNKNOWN_PORT',
          file,
          message: `layers.application.doubles references undeclared port/extern "${targetPort}"`,
        });
      }
      if (!VALID_DOUBLE_STRATEGIES.has(strategy)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_TESTING_INVALID_HARNESS',
          file,
          message: `layers.application.doubles "${targetPort}" has invalid strategy "${strategy}" (allowed: ${[...VALID_DOUBLE_STRATEGIES].join(', ')})`,
        });
      }
      doubles.push({
        port: targetPort,
        strategy,
        ...(dbl.notes ? { notes: String(dbl.notes) } : {}),
      });
    }

    // 3. Interfaces layer
    const rawIf = layers.interfaces ?? {};
    const ifHarness = String(rawIf.harness ?? 'in-process-router').trim();
    if (!VALID_INTERFACE_HARNESSES.has(ifHarness)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_INVALID_HARNESS',
        file,
        message: `layers.interfaces.harness "${ifHarness}" is invalid (allowed: ${[...VALID_INTERFACE_HARNESSES].join(', ')})`,
      });
    }

    // 4. Infrastructure layer
    const rawInfra = layers.infrastructure ?? {};
    const infraHarness = String(rawInfra.harness ?? 'effect-tck').trim();
    if (!VALID_INFRA_HARNESSES.has(infraHarness)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_INVALID_HARNESS',
        file,
        message: `layers.infrastructure.harness "${infraHarness}" is invalid (allowed: ${[...VALID_INFRA_HARNESSES].join(', ')})`,
      });
    }

    // 5. Parallel TDD workspace isolation
    const rawParallel = doc.parallelTdd ?? {};
    const workspaceMode = String(rawParallel.workspaceMode ?? 'share').trim();
    if (!VALID_WORKSPACE_MODES.has(workspaceMode)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_INVALID_HARNESS',
        file,
        message: `parallelTdd.workspaceMode "${workspaceMode}" is invalid (allowed: ${[...VALID_WORKSPACE_MODES].join(', ')})`,
      });
    }
    const mergeStrategy = String(rawParallel.mergeStrategy ?? 'slot-patch').trim();
    if (!VALID_MERGE_STRATEGIES.has(mergeStrategy)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_TESTING_INVALID_HARNESS',
        file,
        message: `parallelTdd.mergeStrategy "${mergeStrategy}" is invalid (allowed: ${[...VALID_MERGE_STRATEGIES].join(', ')})`,
      });
    }

    merged = {
      schemaVersion: 'co-arising.testing-binding/v2',
      layers: {
        domain: {
          harness: domainHarness,
          minLineCoverage: domainMinLine,
          minBranchCoverage: domainMinBranch,
          requireAllRuleHits: rawDomain.requireAllRuleHits !== false,
          mutationGate: Boolean(rawDomain.mutationGate),
          forbidNondeterministicApis: rawDomain.forbidNondeterministicApis !== false,
        },
        application: {
          harness: appHarness,
          minLineCoverage: appMinLine,
          minBranchCoverage: appMinBranch,
          doubles,
        },
        interfaces: {
          harness: ifHarness,
          verifyAuthzMatrix: rawIf.verifyAuthzMatrix !== false,
        },
        infrastructure: {
          harness: infraHarness,
          requireTck: rawInfra.requireTck !== false,
        },
      },
      parallelTdd: {
        workspaceMode,
        mergeStrategy,
        isolationDirPrefix: String(rawParallel.isolationDirPrefix ?? '.truthsrc/worktrees'),
      },
    };
  }

  return { testing: merged, diagnostics };
}
