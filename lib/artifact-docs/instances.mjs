import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileRecord, readJson, walk } from './io.mjs';

export function reconcileInstance(root, ledgerFile, sourceFiles) {
  const ledger = readJson(join(root, ledgerFile)), actual = new Set(sourceFiles), rows = ledger.artifacts;
  assert.ok(Array.isArray(rows), 'artifact ledger rows required');
  const byName = new Map();
  for (const file of sourceFiles) {
    const name = basename(file);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }
  const resolved = [], unmatched = [], ambiguous = [];
  for (const row of rows) {
    if (actual.has(row.path)) { resolved.push({ original: row.path, current: row.path, kind: row.kind, method: 'exact' }); continue; }
    const candidates = [];
    if (row.path.startsWith('app/app/controllers/')) candidates.push({ path: row.path.slice(4), method: 'root-controller-double-app-prefix' });
    if (row.kind === 'rolemap' && row.path.startsWith('modules/kernel/src/main/scala/app/net/imadz/metarch/infrastructure/auth/'))
      candidates.push({ path: row.path.slice('modules/kernel/src/main/scala/'.length), method: 'rolemap-root-placement-same-package' });
    if (row.path.startsWith('app/modules/')) candidates.push({ path: row.path.slice(4), method: 'remove-stale-app-prefix' });
    if (row.path.startsWith('app/protobuf/')) candidates.push({ path: 'modules/glue/src/main/protobuf/' + row.path.slice('app/protobuf/'.length), method: 'protobuf-glue-build-root' });
    if (row.path.startsWith('app/')) {
      const suffix = row.path.slice(4);
      for (const module of ['kernel', 'glue', 'ext']) candidates.push({ path: 'modules/' + module + '/src/main/scala/' + suffix, method: 'module-root-with-same-package-path' });
    }
    const matches = candidates.filter(candidate => actual.has(candidate.path));
    const unique = [...new Map(matches.map(candidate => [candidate.path, candidate])).values()];
    if (unique.length === 1) resolved.push({ original: row.path, current: unique[0].path, kind: row.kind, method: unique[0].method });
    else if (unique.length > 1) ambiguous.push({ original: row.path, kind: row.kind, candidates: unique });
    else unmatched.push({ original: row.path, kind: row.kind, schemaNode: row.schemaNode ?? null,
      sameFilenameCandidates: byName.get(basename(row.path)) ?? [], disposition: 'ledger-only-unresolved' });
  }
  const covered = new Set(resolved.map(row => row.current));
  return { ledger: fileRecord(root, ledgerFile), rows: rows.length, actualFiles: sourceFiles.length,
    resolved, unmatched, ambiguous, sourceOnly: sourceFiles.filter(file => !covered.has(file)),
    guarantee: 'Package-preserving root relocations only; same filename never implies identity. Ledger-only entries remain historical evidence and are not rewritten.' };
}
