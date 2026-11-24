// Deterministic three-layer package routing for value-object declarations (S12).
// Enforces docs/codegen-parity/layout-and-style.md §2: only domain, application,
// and infrastructure layers exist under <base>, and domain.values contains only
// domain value objects (plus any domain-closure boundary records), never HTTP
// API DTOs, CQRS read models/views, Monarch saga protocol triplets, or
// persistence-object (*PO) carriers.
//
// Zero business-name hardcoding: routing is purely by architectural role suffix.
import { scalaSubpackagePath } from '../layout/layout-strategy.mjs';

export const ALLOWED_VO_SUBPACKAGES = Object.freeze([
  'domain.values',
  'application.api',
  'application.projection',
  'application.process',
  'application.integration',
  'infrastructure.persistence',
]);

const ALLOWED_SET = new Set(ALLOWED_VO_SUBPACKAGES);

export const isAllowedValueObjectSubpackage = subpackage =>
  typeof subpackage === 'string' && ALLOWED_SET.has(subpackage);

export function valueObjectSubpackage(name) {
  if (typeof name !== 'string' || !name) return 'domain.values';
  if (/PO$/u.test(name)) return 'infrastructure.persistence';
  if (/(Effect|Dispatch)(Request|Operation|Observation|Reconcile|Result)$/u.test(name)) return 'application.integration';
  if (/(Prepare|Commit|Compensate)(Input|Query|Receipt)$/u.test(name)) return 'application.process';
  if (/(Args|Result)$/u.test(name)) return 'application.process';
  if (/(View|Watermark|ReadMetadata|Page)$/u.test(name)) return 'application.projection';
  if (/(Response|Acknowledgement|Key)$/u.test(name)) return 'application.api';
  if (/(BootstrapInput|RevisionInput|Revise|Tick)$/u.test(name)) return 'application.api';
  return 'domain.values';
}

export const valueObjectPackage = (basePkg, name) =>
  basePkg + '.' + valueObjectSubpackage(name);

export const valueObjectPath = (basePkg, name, options) =>
  scalaSubpackagePath(basePkg, valueObjectSubpackage(name), name + '.scala', options);

export function renderGroupedValueImports(basePkg, names, currentSubpackage = null) {
  const bySub = new Map();
  for (const name of names) {
    const sub = valueObjectSubpackage(name);
    if (currentSubpackage && sub === currentSubpackage) continue;
    if (!bySub.has(sub)) bySub.set(sub, new Set());
    bySub.get(sub).add(name);
  }
  return [...bySub.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sub, set]) => {
      const sorted = [...set].sort();
      return sorted.length === 1
        ? `import ${basePkg}.${sub}.${sorted[0]}`
        : `import ${basePkg}.${sub}.{${sorted.join(', ')}}`;
    });
}
