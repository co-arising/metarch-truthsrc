// Solution-space ReadSide Physical Materialization Binding for co-arising 2.0.
// Maps N logical ReadModels (Problem Space) -> M physical materialized views (Solution Space),
// supporting shared materialized views, dedicated tables, live state snapshots, and external search indexes.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';
import { formatType, isTypeCompatible } from '../ears/type-compat.mjs';

const VALID_STRATEGIES = new Set([
  'shared-materialized-view',
  'dedicated-table',
  'live-state-snapshot',
  'external-search-index',
]);

function collectReadsideBindingFiles(bindingPath) {
  if (!bindingPath) return [];
  const abs = resolve(bindingPath);
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const files = [];
  const entries = readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/(?:readside|read-side|projections?).*\.(?:yaml|yml|json)$/iu.test(entry.name)) {
      files.push(join(abs, entry.name));
    }
  }
  return files;
}

export function loadAndValidateReadsideBindings(bindingPath, structures) {
  const files = collectReadsideBindingFiles(bindingPath);
  const diagnostics = [];
  if (files.length === 0) {
    return { readside: null, diagnostics };
  }

  const rmByName = new Map((structures.readModels ?? []).map(rm => [rm.name, rm]));
  const rawViews = [];

  for (const file of files) {
    const doc = parseStructuredDoc(readFileSync(file, 'utf8'), file);
    if (doc.schemaVersion && doc.schemaVersion !== 'co-arising.readside-binding/v2') {
      diagnostics.push({
        severity: 'error',
        code: 'V2_READSIDE_INVALID_SCHEMA',
        file,
        message: `readside binding schemaVersion must be "co-arising.readside-binding/v2", got "${doc.schemaVersion}"`,
      });
      continue;
    }
    let views = [];
    if (Array.isArray(doc.materializedViews)) {
      views = doc.materializedViews;
    } else if (Array.isArray(doc.readside?.materializedViews)) {
      views = doc.readside.materializedViews;
    }
    for (const mv of views) {
      rawViews.push({ ...mv, sourceFile: file });
    }
  }

  const seenMvNames = new Set();
  const claimedReadModels = new Map(); // readModelName -> mvName
  const materializedViews = [];

  for (const mv of rawViews) {
    const file = mv.sourceFile;
    const name = String(mv.name ?? '').trim();
    if (!name) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_READSIDE_INVALID_VIEW',
        file,
        message: 'materializedView entry requires a non-empty "name"',
      });
      continue;
    }
    if (seenMvNames.has(name)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_DUPLICATE_DECLARATION',
        file,
        message: `duplicate materializedView "${name}"`,
      });
      continue;
    }
    seenMvNames.add(name);

    const strategy = String(mv.strategy ?? 'dedicated-table').trim();
    if (!VALID_STRATEGIES.has(strategy)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_READSIDE_INVALID_STRATEGY',
        file,
        message: `materializedView "${name}" has invalid strategy "${strategy}" (allowed: ${[...VALID_STRATEGIES].join(', ')})`,
      });
    }

    const serves = Array.isArray(mv.servesReadModels) ? mv.servesReadModels.map(String) : [];
    if (serves.length === 0) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_READSIDE_EMPTY_TARGETS',
        file,
        message: `materializedView "${name}" must list at least one logical readModel in servesReadModels`,
      });
    }

    const columnMap = new Map(); // colName -> { type, resolvedType, sources: [] }
    const subscribedEvents = new Set();
    const sourceAggregates = new Set();

    for (const rmName of serves) {
      const rm = rmByName.get(rmName);
      if (!rm) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_READSIDE_UNKNOWN_READMODEL',
          file,
          message: `materializedView "${name}" serves undeclared logical readModel "${rmName}"`,
        });
        continue;
      }
      if (claimedReadModels.has(rmName)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_READSIDE_DUPLICATE_BINDING',
          file,
          message: `logical readModel "${rmName}" is bound to multiple materializedViews ("${claimedReadModels.get(rmName)}" and "${name}")`,
        });
      } else {
        claimedReadModels.set(rmName, name);
      }

      if (rm.sourceAggregate) sourceAggregates.add(rm.sourceAggregate);
      for (const ev of rm.sourceEvents ?? []) subscribedEvents.add(ev);

      for (const f of rm.fields ?? []) {
        if (f.source && f.source.startsWith('eventField:')) {
          const ref = f.source.slice('eventField:'.length).trim().split('.');
          if (ref.length >= 2) {
            subscribedEvents.add(ref.length === 3 ? `${ref[0]}.${ref[1]}` : ref[0]);
          }
        }
        if (!columnMap.has(f.name)) {
          columnMap.set(f.name, {
            name: f.name,
            type: formatType(f.resolvedType),
            resolvedType: f.resolvedType,
            fromReadModels: [rmName],
          });
        } else {
          const existing = columnMap.get(f.name);
          const compat = isTypeCompatible(f.resolvedType, existing.resolvedType, {
            allowOptionalWrap: true,
            allowNumericPromotion: false,
            exactScale: true,
          }) || isTypeCompatible(existing.resolvedType, f.resolvedType, {
            allowOptionalWrap: true,
            allowNumericPromotion: false,
            exactScale: true,
          });
          if (!compat) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_READSIDE_COLUMN_TYPE_CONFLICT',
              file,
              message: `shared materializedView "${name}" has conflicting types for column "${f.name}": ${existing.type} (from ${existing.fromReadModels[0]}) vs ${formatType(f.resolvedType)} (from ${rmName})`,
            });
          } else if (!existing.fromReadModels.includes(rmName)) {
            existing.fromReadModels.push(rmName);
          }
        }
      }
    }

    const indexes = [];
    for (const idx of mv.indexes ?? []) {
      const idxName = String(idx.name ?? '').trim();
      const keys = Array.isArray(idx.keys) ? idx.keys.map(String) : [];
      for (const k of keys) {
        if (!columnMap.has(k)) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READSIDE_UNKNOWN_INDEX_KEY',
            file,
            message: `materializedView "${name}" index "${idxName || '(unnamed)'}" references key "${k}" not present in the column union of servesReadModels [${serves.join(', ')}]`,
          });
        }
      }
      indexes.push({ name: idxName, keys });
    }

    materializedViews.push({
      name,
      strategy,
      storage: String(mv.storage ?? 'memory'),
      servesReadModels: serves,
      sourceAggregates: [...sourceAggregates],
      subscribedEvents: [...subscribedEvents],
      derivedColumns: [...columnMap.values()].map(({ resolvedType: _rt, ...rest }) => rest),
      indexes,
    });
  }

  const unboundReadModels = (structures.readModels ?? [])
    .map(rm => rm.name)
    .filter(name => !claimedReadModels.has(name));

  return {
    readside: {
      schemaVersion: 'co-arising.readside-binding/v2',
      materializedViews,
      unboundReadModels,
    },
    diagnostics,
  };
}
