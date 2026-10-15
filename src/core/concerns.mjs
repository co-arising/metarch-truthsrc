// concerns.mjs — the change-impact → regeneration-scope engine (core-owned, one implementation).
// Verbatim port of the production-verified concerns_lib.mjs (backend-codegen, E5-WP1 2026-09-12);
// the Scala-side ConcernScope/ConcernScopeLoader pair shares the same semantics and vocabulary.
//
// A concern answers: *this piece of the truth source changed — which generated faces must be
// regenerated?* A concern = schemaCategories × flavors; a flavor = a set of artifact kinds
// (the vocabulary each generator declares in its manifest). Scope expansion filters ledger
// rows by (kind × category × families); the dependency closure then pulls in the rows each
// in-scope artifact declares as deps — transitively, to fixpoint — so cross-flavor
// dependencies (converter→protocol, controller→protocol) are never left behind broken.
//
// Ledger row contract (see CODEGEN.md): { path, kind, schemaNode?, schemaCategory, families[], deps[] }.
// deps are generated-artifact identifiers (class names = file stems); identifiers that resolve
// to no ledger row (external library types) drop out harmlessly — production parity.

import fs from 'node:fs';

export const SCHEMA_CATEGORIES = new Set([
  'aggregate', 'entity', 'valueObject', 'field', 'projection', 'saga', 'global',
]);

/** Parse and validate a concerns registry (bad JSON / unregistered flavor / unknown
 *  schemaCategory → throw). shape: { flavors: {name: {artifactKinds[]}}, concerns: {name:
 *  {schemaCategories[], flavors[]}}, familySets: {name: [families]} } */
export function loadConcernRegistry(scopeFile) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(scopeFile, 'utf8'));
  } catch (e) {
    throw new Error(`concerns registry read/parse failed: ${scopeFile} (${e.message})`);
  }
  const flavors = new Map(Object.entries(json.flavors || {}).map(([k, v]) => [k, v.artifactKinds || []]));
  const concerns = new Map(Object.entries(json.concerns || {}).map(([k, v]) => [k, { schemaCategories: v.schemaCategories || [], flavors: v.flavors || [] }]));
  const familySets = new Map(Object.entries(json.familySets || {}).map(([k, v]) => [k, v]));
  const unknownFlavors = [...new Set([...concerns.values()].flatMap((c) => c.flavors))].filter((f) => !flavors.has(f));
  if (unknownFlavors.length) throw new Error(`concerns registry: concern references unregistered flavor: ${unknownFlavors.join(', ')}`);
  const badCategories = [...new Set([...concerns.values()].flatMap((c) => c.schemaCategories))].filter((c) => c !== '*' && !SCHEMA_CATEGORIES.has(c));
  if (badCategories.length) throw new Error(`concerns registry: unknown schemaCategory: ${badCategories.join(', ')} (vocabulary: ${[...SCHEMA_CATEGORIES].join('/')})`);
  return { flavors, concerns, familySets };
}

/** concern name + families selection → filter predicate args (families: null = all known,
 *  'A,B' = explicit names or familySets references; unknown → throw). */
export function resolveConcernFilter(registry, concernName, familiesProp, knownFamilies) {
  const concern = registry.concerns.get(concernName);
  if (!concern) {
    throw new Error(`concerns registry has no concern: ${concernName} (available: ${[...registry.concerns.keys()].sort().join(', ')})`);
  }
  let families;
  if (familiesProp == null) families = [...knownFamilies].sort();
  else {
    const names = familiesProp.split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = names.filter((n) => !knownFamilies.has(n) && !registry.familySets.has(n));
    if (unknown.length) {
      throw new Error(`--families references unknown families: ${unknown.join(', ')} (known: ${[...knownFamilies].sort().join(', ')}; familySets: ${[...registry.familySets.keys()].join(', ')})`);
    }
    families = [...new Set(names.flatMap((n) => registry.familySets.get(n) || [n]))];
  }
  const kinds = new Set(concern.flavors.flatMap((f) => registry.flavors.get(f)));
  const categories = new Set(concern.schemaCategories.filter((c) => c !== '*'));
  const wildcardCategories = concern.schemaCategories.includes('*');
  return { concernName, kinds, categories, wildcardCategories, families: new Set(families) };
}

/** Does a ledger row hit the concern filter? (kind × category × families; family-less rows
 *  are GLOBAL artifacts — they always pass, family filtering does not apply to them). */
export function inScopeOf(filter, row) {
  const kindHit = filter.kinds.has('*') || filter.kinds.has(row.kind);
  const catHit = filter.wildcardCategories || filter.categories.has(row.schemaCategory);
  const famHit = (row.families || []).length === 0 || (row.families || []).some((f) => filter.families.has(f));
  return kindHit && catHit && famHit;
}

/** Initial in-scope set (ledger predicate). */
export function expandScope(ledger, filter) {
  return new Set(ledger.filter((row) => inScopeOf(filter, row)).map((row) => row.path));
}

/** Dependency closure: deps (artifact identifiers) map back to ledger rows via the
 *  schemaNode/file-stem double key (a generated class name is its file stem), transitively
 *  to fixpoint. Unresolvable deps (external types) drop out. */
export function compileClosure(inScope, ledger) {
  const byName = new Map(); // schemaNode / file stem → set of paths
  for (const row of ledger) {
    const stem = row.path.split('/').pop().replace(/\.(scala|proto)$/, '');
    for (const key of new Set([row.schemaNode, stem])) {
      if (!byName.has(key)) byName.set(key, new Set());
      byName.get(key).add(row.path);
    }
  }
  const closure = new Set(inScope);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of closure) {
      const row = ledger.find((r) => r.path === p);
      if (!row) continue;
      for (const dep of row.deps || []) {
        const targets = byName.get(dep);
        if (!targets) continue;
        for (const t of targets) {
          if (!closure.has(t)) { closure.add(t); grew = true; }
        }
      }
    }
  }
  return closure;
}
