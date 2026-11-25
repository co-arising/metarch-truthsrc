// Deterministic four-layer package routing and companion-object modularization
// for value-object declarations (S12 / Phase B / Problem-Space Packaging).
// Enforces the canonical four-layer topology (`domain`, `application`,
// `interfaces`, `infrastructure`, plus `modules`):
//   - `domain.values`: pure domain value objects (standalone files)
//   - `interfaces.api`: HTTP/JSON wire & endpoint DTOs (companion-object modules)
//   - `application.process.protocol`: workflow messages & participant step triplets (companion-object modules)
//   - `application.connectors`: durable external-effect protocol DTOs (companion-object modules)
//   - `application.readmodels`: read-side view DTOs (companion-object module `ReadModelViews`)
//   - Persistence objects (`*PO`) are owned exclusively by ScalaPB (`app/protobuf/*.proto`).
//
// Zero business-name hardcoding: routing and grouping are purely by architectural role suffix.
import { scalaSubpackagePath } from '../layout/layout-strategy.mjs';

export const ALLOWED_VO_SUBPACKAGES = Object.freeze([
  'domain.values',
  'interfaces.api',
  'application.readmodels',
  'application.process',
  'application.process.protocol',
  'application.connectors',
]);

const ALLOWED_SET = new Set(ALLOWED_VO_SUBPACKAGES);
const DYNAMIC_VO_SUBPACKAGE_RE = /^application\.(?:process|readmodels|policies)\.[a-z][a-z0-9_]*$/u;

export const isAllowedValueObjectSubpackage = subpackage =>
  typeof subpackage === 'string' && (ALLOWED_SET.has(subpackage) || DYNAMIC_VO_SUBPACKAGE_RE.test(subpackage));

export function collectProcessOriginalNames(typeNames) {
  const names = typeNames instanceof Set ? typeNames : new Set(typeNames ?? []);
  const out = new Set();
  for (const name of names) {
    if (typeof name !== 'string' || !name.endsWith('Original')) continue;
    const stem = name.slice(0, -'Original'.length);
    if (stem && (names.has(stem + 'Args') || names.has(stem + 'Result'))) {
      out.add(name);
    }
  }
  return out;
}

export function valueObjectSubpackage(name, processOriginals = null) {
  if (typeof name !== 'string' || !name) return 'domain.values';
  if (/(Effect|Dispatch)(Request|Operation|Observation|Reconcile|Result)$/u.test(name)) return 'application.connectors';
  if (/(Prepare|Commit|Compensate)(Input|Query|Receipt)$/u.test(name)) return 'application.process.protocol';
  if (/(Args|Result)$/u.test(name)) return 'application.process.protocol';
  if (name.endsWith('Original') && processOriginals?.has(name)) return 'application.process.protocol';
  if (/(View|Watermark|ReadMetadata|Page)$/u.test(name)) return 'application.readmodels';
  if (/(Wire|Submit|Create|Intent|Original|Response|Acknowledgement|Key)$/u.test(name)) return 'interfaces.api';
  if (/(BootstrapInput|RevisionInput|Revise|Tick)$/u.test(name)) return 'interfaces.api';
  return 'domain.values';
}

export function valueObjectModule(name, explicitSubpackage = null, processOriginals = null) {
  if (typeof name !== 'string' || !name) return null;
  const sub = explicitSubpackage ?? valueObjectSubpackage(name, processOriginals);
  if (sub === 'application.process' || sub.startsWith('application.process.')) {
    const step = /^([A-Z][A-Za-z0-9_]*?)(?:Prepare|Commit|Compensate)(?:Input|Query|Receipt)$/u.exec(name);
    if (step) return step[1] + 'Step';
    const msg = /^([A-Z][A-Za-z0-9_]*?)(?:Args|Result|Original)$/u.exec(name);
    if (msg) return msg[1] + 'Messages';
    return null;
  }
  if (sub === 'application.connectors') {
    const conn = /^([A-Z][A-Za-z0-9_]*?(?:Effect|Dispatch))(?:Request|Operation|Observation|Reconcile|Result)$/u.exec(name);
    if (conn) return conn[1] + 'Protocol';
    return null;
  }
  if (sub === 'application.readmodels' || sub.startsWith('application.readmodels.')) {
    if (/(View|Watermark|ReadMetadata|Page)$/u.test(name)) return 'ReadModelViews';
    return null;
  }
  if (sub === 'interfaces.api') {
    if (/Wire$/u.test(name)) return 'ApiWire';
    if (/Key$/u.test(name)) return 'ApiKeys';
    if (/Response$/u.test(name)) return 'ApiResponses';
    if (/Acknowledgement$/u.test(name)) return 'ApiAcknowledgements';
    return 'ApiCommands';
  }
  return null;
}

export const valueObjectPackage = (basePkg, name, explicitSubpackage = null, processOriginals = null) =>
  basePkg + '.' + (explicitSubpackage ?? valueObjectSubpackage(name, processOriginals));

export function valueObjectTypeQualifier(basePkg, name, explicitSubpackage = null, processOriginals = null) {
  const sub = explicitSubpackage ?? valueObjectSubpackage(name, processOriginals);
  const mod = valueObjectModule(name, sub, processOriginals);
  return mod ? `${basePkg}.${sub}.${mod}.${name}` : `${basePkg}.${sub}.${name}`;
}

export function valueObjectPath(basePkg, name, options = undefined) {
  const processOriginals = options?.processOriginals ?? null;
  const sub = options?.subpackage ?? valueObjectSubpackage(name, processOriginals);
  const mod = valueObjectModule(name, sub, processOriginals);
  return scalaSubpackagePath(basePkg, sub, (mod ?? name) + '.scala', options);
}

function mergeProcessOriginals(names, explicitProcessOriginals) {
  const detected = collectProcessOriginalNames(names);
  if (!explicitProcessOriginals) return detected;
  for (const name of explicitProcessOriginals) detected.add(name);
  return detected;
}

export function renderGroupedValueImports(basePkg, names, currentSubpackage = null, currentModule = null, processOriginals = null) {
  const resolvedOriginals = mergeProcessOriginals(names, processOriginals);
  const byTarget = new Map();
  for (const name of names) {
    const sub = valueObjectSubpackage(name, resolvedOriginals);
    const mod = valueObjectModule(name, sub, resolvedOriginals);
    if (mod) {
      if (currentSubpackage === sub && currentModule === mod) continue;
      const prefix = currentSubpackage === sub ? mod : `${basePkg}.${sub}.${mod}`;
      if (!byTarget.has(prefix)) byTarget.set(prefix, new Set());
      byTarget.get(prefix).add(name);
    } else {
      if (currentSubpackage === sub) continue;
      const prefix = `${basePkg}.${sub}`;
      if (!byTarget.has(prefix)) byTarget.set(prefix, new Set());
      byTarget.get(prefix).add(name);
    }
  }
  return [...byTarget.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, set]) => {
      const sorted = [...set].sort();
      if (sorted.length === 1) return `import ${prefix}.${sorted[0]}`;
      const explicit = `import ${prefix}.{${sorted.join(', ')}}`;
      return explicit.length <= 105 ? explicit : `import ${prefix}._`;
    });
}

export function renderValueWildcardImports(basePkg, names, currentSubpackage = null, processOriginals = null) {
  const resolvedOriginals = mergeProcessOriginals(names, processOriginals);
  const targets = new Set();
  for (const name of names) {
    const sub = valueObjectSubpackage(name, resolvedOriginals);
    const mod = valueObjectModule(name, sub, resolvedOriginals);
    if (mod) {
      targets.add(currentSubpackage === sub ? `${mod}._` : `${basePkg}.${sub}.${mod}._`);
    } else if (currentSubpackage !== sub) {
      targets.add(`${basePkg}.${sub}._`);
    }
  }
  return [...targets].sort().map(target => `import ${target}`);
}
