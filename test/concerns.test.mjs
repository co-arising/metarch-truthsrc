// concerns.test.mjs — the concerns engine (change-impact → regeneration-scope protocol):
// unit semantics over synthetic ledger rows, then the acceptance e2e (EP V4-4 item 3):
// a field change → only the event-journal-suite face regenerates, everything else is kept.
// The e2e builds the full reference-project chain (skeleton → rules → api into ONE outDir,
// merged final-writer-wins ledger) over the ModelCatalog corpus.
import { deepEqual, equal, ok, throws } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCHEMA_CATEGORIES, loadConcernRegistry, resolveConcernFilter, inScopeOf, expandScope, compileClosure } from '../src/core/concerns.mjs';
import { apply, mergedRows, scopeOf } from '../src/core/generate.mjs';

const ROOT = join(import.meta.dirname, '..');
const REG = join(ROOT, 'golden', 'scala-cqrs-es-metarch', 'concerns.json');
const CANON = join(ROOT, 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const GEN_SKEL = join(ROOT, 'generators', 'scala-cqrs-es');
const GEN_RULES = join(ROOT, 'generators', 'scala-cqrs-es-rules');
const GEN_API = join(ROOT, 'generators', 'scala-cqrs-es-api');
const scratch = () => mkdtempSync(join(tmpdir(), 'truthsrc-concerns-'));

// ── unit: registry validation (fail-fast on bad JSON / unregistered flavor / unknown category)
const registry = loadConcernRegistry(REG);
ok(registry.flavors.get('event-journal-suite').includes('protocol'));
{
  const bad = scratch();
  const write = (text) => { const p = join(bad, `${Math.random().toString(36).slice(2)}.json`); writeFileSync(p, text); return p; };
  throws(() => loadConcernRegistry(write('{ not json')), /concerns registry read\/parse failed/);
  throws(() => loadConcernRegistry(write(JSON.stringify({ flavors: {}, concerns: { x: { flavors: ['nope'], schemaCategories: ['*'] } } }))), /unregistered flavor: nope/);
  throws(() => loadConcernRegistry(write(JSON.stringify({ flavors: { f: { artifactKinds: ['k'] } }, concerns: { x: { flavors: ['f'], schemaCategories: ['wat'] } } }))), /unknown schemaCategory: wat/);
  deepEqual([...SCHEMA_CATEGORIES].sort(), ['aggregate', 'entity', 'field', 'global', 'projection', 'saga', 'valueObject']);
}

// ── unit: scope expansion + dependency closure over synthetic rows
const rows = [
  { path: 'a/LoanProtocol.scala', kind: 'protocol', schemaCategory: 'aggregate', schemaNode: 'Loan', families: ['Loan'], deps: ['Loan', 'LoanEntity'] },
  { path: 'a/LoanEntity.scala', kind: 'entity', schemaCategory: 'entity', schemaNode: 'LoanEntity', families: ['Loan'], deps: [] },
  { path: 'a/LoanRules.scala', kind: 'rules', schemaCategory: 'aggregate', schemaNode: 'LoanRules', families: ['Loan'], deps: ['LoanRuleParams'] },
  { path: 'shared/ViewKeys.scala', kind: 'view-keys', schemaCategory: 'projection', families: [], deps: [] },
];
const filter = resolveConcernFilter(registry, 'event-journal-suite', null, new Set(['Loan']));
deepEqual([...filter.kinds].sort(), ['entity', 'event-handler', 'protocol']);
// predicate: protocol+entity hit; rules face and the global artifact do not
deepEqual([...expandScope(rows, filter)].sort(), ['a/LoanEntity.scala', 'a/LoanProtocol.scala']);
ok(!inScopeOf(filter, rows[2]) && !inScopeOf(filter, rows[3]));
// closure: protocol deps pull the entity (stem key) — the rules row has no in-bound edge
deepEqual([...compileClosure(expandScope(rows, filter), rows)].sort(), ['a/LoanEntity.scala', 'a/LoanProtocol.scala']);
// closure resolution is double-keyed (schemaNode OR stem) and transitive to fixpoint
const chain = [
  { path: 'X.scala', kind: 'k1', schemaCategory: 'aggregate', schemaNode: 'X', families: ['F'], deps: ['Y'] },
  { path: 'Y.scala', kind: 'k2', schemaCategory: 'aggregate', schemaNode: 'Y', families: ['F'], deps: ['Z'] },
  { path: 'Z.scala', kind: 'k3', schemaCategory: 'aggregate', schemaNode: 'Z', families: ['F'], deps: ['External', 'X'] },
];
deepEqual([...compileClosure(new Set(['X.scala']), chain)].sort(), ['X.scala', 'Y.scala', 'Z.scala'], 'transitive + cycle-safe + unresolved dropped');

// ── unit: filter errors are fail-fast with the available vocabulary
throws(() => resolveConcernFilter(registry, 'nope', null, new Set()), /no concern: nope \(available: aggregate-scaffold, api-layer, event-journal-suite, full, rules-invariants\)/);
throws(() => resolveConcernFilter(registry, 'full', 'Nope', new Set(['Loan'])), /--families references unknown families: Nope/);
{
  const famReg = { ...registry, familySets: new Map([['loans', ['Loan', 'Line']]]) };
  const f2 = resolveConcernFilter(famReg, 'full', 'loans,Loan', new Set(['Loan']));
  deepEqual([...f2.families].sort(), ['Line', 'Loan'], 'familySets expand and dedupe');
}

// ── e2e: the acceptance scenario — full project build, then a field change regenerates ONLY
// the event-journal-suite face (everything else kept byte-identical on disk).
const out = scratch();
const optsSkel = { generatorVersion: 'concern-e2e', relics: { skipValueObjects: ['UcStep'] } }; // V4-16: the VO face rides the skeleton generator
const optsRules = { generatedBy: 'rules_domain_gen:2026-08-23' };

// full build: skeleton (no concern) → rules → api, both under `full` (overwrite allowed in scope)
const r1 = await apply({ canonicalFile: CANON, generatorDir: GEN_SKEL, outDir: out, options: optsSkel });
equal(r1.written, 40); // V4-16: 8 aggregate kinds + 30 value objects + 2 proto files (aggregate + shared)
const r2 = await apply({ canonicalFile: CANON, generatorDir: GEN_RULES, outDir: out, options: optsRules, concern: { name: 'full', families: null, registryFile: REG } });
equal(r2.written, 8); // V4-10: the event-handler rewrite joined (8 rules paths, 3 shared-path upserts)
equal(r2.kept, 0);
equal(r2.inScope, 45, 'rules full run: scope = merged rows (8 skeleton + 5 new rules paths + 30 global VO rows + 2 proto rows)');
const r3 = await apply({ canonicalFile: CANON, generatorDir: GEN_API, outDir: out, options: {}, concern: { name: 'full', families: null, registryFile: REG } });
equal(r3.written, 8); // V4-13 vector + V4-14 aggregate-state controllers joined (8 api paths)
equal(r3.inScope, 53, 'api full run: scope = merged rows (45 + 8 api paths)');
// merged ledger: the rules face owns the shared Behaviors/CommandHelpers paths (final-writer-wins)
{
  const ledger = JSON.parse(readFileSync(join(out, 'truthsrc.ledger.json'), 'utf8'));
  equal(ledger.entries.length, 53, 'merged ledger = (skeleton 8 + VO 30 + proto 2) + rules 8 + api 8 − 3 shared-path upserts (Behaviors/CommandHelpers/EventHandler)');
  equal(ledger.entries.find((r) => r.path.endsWith('ModelCatalogBehaviors.scala')).kind, 'behaviors-rules');
  ok(ledger.concern && ledger.concern.name === 'full' && ledger.concern.scopeFileHash, 'concern audit chain in ledger');
}

const snap = {};
for (const f of JSON.parse(readFileSync(join(out, 'truthsrc.ledger.json'), 'utf8')).entries) {
  snap[f.path] = readFileSync(join(out, f.path), 'utf8');
}
equal(Object.keys(snap).length, 53); // V4-14: the aggregate-state controller joins the snapshot; V4-16: +30 value objects +2 proto files

// mutate: ADD a state field (state-shape change — additive, so no rule text dangles) in a temp
// canonical. Consumers verified against the builders: entityModel renders stateFields (Entity
// changes), factoryModel only reads the id field, eventHandlerModel/protocolModel don't consume
// stateFields at all (the reference protocol face carries commands/replies, not state).
const canonical = JSON.parse(readFileSync(CANON, 'utf8'));
canonical.aggregates[0].stateFields.push({ name: 'reviewNote', dataType: 'String', description: 'e2e mutation' });
const CANON2 = join(scratch(), 'canonical-mutated.json');
writeFileSync(CANON2, JSON.stringify(canonical));

// negative control: without --concern the overwrite refusal still guards the tree
await apply({ canonicalFile: CANON2, generatorDir: GEN_SKEL, outDir: out, options: optsSkel })
  .then(() => { throw new Error('should have refused'); }, (e) => ok(/refusing to overwrite/.test(e.message)));

// the concern run: a field change → ONLY the event-journal-suite face (+ closure) rewrites
const r4 = await apply({
  canonicalFile: CANON2, generatorDir: GEN_SKEL, outDir: out, options: optsSkel,
  concern: { name: 'event-journal-suite', families: 'ModelCatalog', registryFile: REG },
});
equal(r4.inScope, 9, 'scope = 3 predicate hits + 6 closure-pulled (root/factory/repo via the schemaNode key + the two glue paths via stems + the ModelCatalog proto row via the same key)');
equal(r4.closureAdded, 6);
equal(r4.kept, 0, 'all 8 skeleton paths + the proto row sit inside the closure for the single-family corpus');
{
  const ledger = JSON.parse(readFileSync(join(out, 'truthsrc.ledger.json'), 'utf8'));
  equal(ledger.concern.name, 'event-journal-suite');
  equal(ledger.concern.families, 'ModelCatalog');
  equal(ledger.concern.inScope, 9);
  equal(ledger.concern.closureAdded, 6);
}

// partition: changed files ⊆ scope; the state carrier pair changed; everything outside untouched
// (the rules face — Rules/RuleParams/RulesSpec/Policies — is NOT in the skeleton run's scope:
//  the field change does not drag it in, and its glue paths are re-asserted by the replay below)
const scope4 = new Set([
  'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/ModelCatalogProtocol.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/ModelCatalogAggregate.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/domain/entities/ModelCatalogEntity.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/domain/entities/behaviors/ModelCatalogEventHandler.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/repository/ModelCatalogRepository.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/factories/ModelCatalogAggregateFactory.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogBehaviors.scala',
  'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogCommandHelpers.scala',
  'app/protobuf/model_catalog.proto', // V4-16: StatePO carries the added state field
]);
const changed = Object.keys(snap).filter((p) => snap[p] !== readFileSync(join(out, p), 'utf8'));
ok(changed.length > 0, 'the mutation changed something');
ok(changed.every((p) => scope4.has(p)), `changed ⊆ concern scope (got: ${changed.join(' · ')})`);
ok(changed.some((p) => p.endsWith('ModelCatalogEntity.scala')), 'entity (the state carrier) changed');
ok(!changed.some((p) => p.endsWith('ModelCatalogProtocol.scala')), 'protocol face (commands/replies) untouched by a state-field change');
const untouched = Object.keys(snap).filter((p) => !scope4.has(p) && p.endsWith('.scala'));
ok(untouched.every((p) => readFileSync(join(out, p), 'utf8') === snap[p]), 'out-of-scope files byte-untouched (rules-spec/policies/rules/api kept)');

// chain replay: the owning faces re-assert themselves (the skeleton concern run transiently
// wrote skeleton glue over the rules-owned shared paths — the rules face restores them, and
// its Rules.scala picks up the new state param)
const r5 = await apply({ canonicalFile: CANON2, generatorDir: GEN_RULES, outDir: out, options: optsRules, concern: { name: 'full', families: null, registryFile: REG } });
equal(r5.written, 4, 'rules re-asserts the three shared glue paths (Behaviors/CommandHelpers/EventHandler — V4-10) + RulesSpec (state-shape-sensitive)');
equal(r5.identical, 4, 'the rest of the rules face is unchanged');
const r6 = await apply({ canonicalFile: CANON2, generatorDir: GEN_API, outDir: out, options: {}, concern: { name: 'full', families: null, registryFile: REG } });
equal(r6.written, 0, 'api face untouched by a state-field rename');
equal(r6.identical, 8); // V4-13+V4-14: eight api paths (the vector/state controllers are state-shape-insensitive)
// after the replay the tree equals the pre-mutation snapshot except exactly two files:
// the Entity (skeleton face, in scope) and the RulesSpec suite (rules face, regenerated with
// the new state shape by its own replay) — the transient glue clobber is fully undone.
const stillChanged = Object.keys(snap).filter((p) => snap[p] !== readFileSync(join(out, p), 'utf8')).sort();
deepEqual(stillChanged, [
  'app/protobuf/model_catalog.proto', // V4-16: StatePO carries the added state field — proto owns it
  'modules/kernel/src/main/scala/net/imadz/metarch/domain/entities/ModelCatalogEntity.scala',
  'modules/kernel/src/test/scala/net/imadz/metarch/domain/invariant/ModelCatalogRulesSpec.scala',
], 'post-replay drift = proto + Entity + RulesSpec exactly (glue clobber undone, everything else byte-equal)');

// --plan preview: scopeOf + mergedRows without writing
const { entries } = await import('../src/core/generate.mjs').then((m) => m.plan({ canonicalFile: CANON2, generatorDir: GEN_SKEL, options: optsSkel }));
const preview = scopeOf(mergedRows(out, entries), { name: 'event-journal-suite', families: 'ModelCatalog', registryFile: REG });
equal(preview.set.size, 9); // V4-16: the proto row joins via the schemaNode stem


console.log('✅ concerns.test — engine units + incremental-regeneration e2e all green');
