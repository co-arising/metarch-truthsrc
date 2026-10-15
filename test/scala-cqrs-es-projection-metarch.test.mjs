// scala-cqrs-es-projection-metarch.test.mjs — V4-14 gate: the projection/storage face, the
// engine's biggest unmeasured surface, byte-identical to the live CodegenMain +
// gen_projection_handlers output. Entry shapes over the canonical's ①-layer slots
// (projectionViews / graphViews / eventAgg / gatedReadModels — tools/augment-api-canonical.mjs):
//   • <View>.scala ×43          — Akka Projection definitions in THREE shapes: composite
//                                 (dispatcher wiring order = the note's `event:` LINK order —
//                                 CollisionResolved rides the links without a refCode),
//                                 single-handler (ContextGraphView/TruthSourceProvenance),
//                                 multi-aggregate (KnowledgeSemanticView Note+Concept;
//                                 OpenSession's Stage group has zero handlers → one section).
//   • <View>On<Event>Handler ×240 — engine skeleton + MANUAL block: the rewriter port derives
//                                 the mechanical form from the referenceCodes (28 of the corpus
//                                 blocks derive byte-equal — the port's proof); every divergence
//                                 (handwritten MERGE-preserved content, post-fill refCode drift
//                                 like the strOr() removal) rides the manual-blocks sidecar.
//   • <View>Repository ×43      — trait + Table companion (sorted DTO fields, Instant →
//                                 Option[Instant], field anchors via elementHashes), the
//                                 AssemblyEngine method set (sorted keys → findByIdentity,
//                                 idNames → findBy*), mongo paged/count, graph four-verb,
//                                 vector fixed 4-set.
//   • <View>RepositoryImpl ×43  — table (scalikejdbc INSERT..ON DUPLICATE KEY UPDATE) /
//                                 mongo (MongoViewStore + field codecs + kind face) /
//                                 graph (GraphMutationExecutor Strict) / vector (PgVectorStore +
//                                 OllamaEmbeddingClient) storage forks. 26 corpus files carry
//                                 stale-generation bodies (the 2026-10-15 stamp refresh renewed
//                                 stamps across 718 files without rewriting bytes) — those ride
//                                 the stale-generations sidecar verbatim.
// Handwritten-forever (honestly absent): KnInstanceProjection + its handler/store and the
// ParkConceptDecisionViewCompositeHandler; PauseProject×10 are live relics (no ①-layer note).
import { equal, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', 'scala-cqrs-es-projection');
const CANON = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const PROJ_GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-projection-metarch');
const HASHES = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch', 'full-corpus.elementHashes.json');

const options = {
  elementHashes: JSON.parse(readFileSync(HASHES, 'utf8')),
  manualBlocks: JSON.parse(readFileSync(join(PROJ_GOLD, 'manual-blocks.json'), 'utf8')),
  protoFields: JSON.parse(readFileSync(join(PROJ_GOLD, 'proto-fields.json'), 'utf8')),
  staleGenerations: JSON.parse(readFileSync(join(PROJ_GOLD, 'stale-generations.json'), 'utf8')),
};

const { entries } = await plan({ canonicalFile: CANON, generatorDir: GEN, options });
const byKind = Object.groupBy(entries, (e) => e.kind);
equal(entries.length, 369, '43 defs + 240 handlers + 43 repos + 43 impls (fixture carries the global corpus)');
equal(byKind['projection-def'].length, 43);
equal(byKind['projection-handler'].length, 240, '240 = 247 live − PauseProject relics ×7 (duplicate links dedupe first-wins)');
equal(new Set(byKind['projection-handler'].map((e) => e.path)).size, 240, 'unique handler paths');
equal(byKind['projection-repository'].length, 43);
equal(byKind['projection-repository-impl'].length, 43);

// Golden spot checks: one representative per shape/kind against live bytes.
const GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-projection-metarch', 'expected');
for (const rel of [
  'app/net/imadz/metarch/application/projection/CaptureNoteDecisionView.scala', // composite
  'app/net/imadz/metarch/application/projection/ContextGraphView.scala', // single-handler
  'app/net/imadz/metarch/application/projection/KnowledgeSemanticView.scala', // multi-aggregate
  'app/net/imadz/metarch/application/projection/OpenSessionDecisionView.scala', // multi-agg, one active group
  'app/net/imadz/metarch/application/projection/handlers/CaptureNoteDecisionViewOnNoteCapturedHandler.scala', // handwritten MANUAL
  'app/net/imadz/metarch/application/projection/handlers/CatalogGraphViewOnCatalogVersionCreatedHandler.scala', // graph fill
  'app/net/imadz/metarch/application/projection/handlers/KnowledgeSemanticViewOnNoteCapturedHandler.scala', // vector fill
  'app/net/imadz/metarch/application/projection/repository/CaptureNoteDecisionViewRepository.scala', // table trait
  'app/net/imadz/metarch/application/projection/repository/KnowledgeSemanticViewRepository.scala', // vector trait
  'app/net/imadz/metarch/infrastructure/repositories/projection/CaptureNoteDecisionViewRepositoryImpl.scala', // table impl
  'app/net/imadz/metarch/infrastructure/repositories/projection/KnowledgeSemanticViewRepositoryImpl.scala', // vector impl
  'app/net/imadz/metarch/infrastructure/repositories/projection/ContextRelationGraphViewRepositoryImpl.scala', // graph impl + mergeEdge
]) {
  const e = entries.find((x) => x.path === rel);
  ok(e, `entry present: ${rel}`);
  const want = readFileSync(join(GOLD, rel), 'utf8');
  equal(e.content, want, `byte identity: ${rel}`);
}

// Knowledge identity: defs/repos/impls carry the view note id; handlers carry their EVENT's id.
const captureDef = byKind['projection-def'].find((e) => e.path.endsWith('CaptureNoteDecisionView.scala'));
equal(captureDef.noteIds.length, 1, 'def noteIds = the view note id (the ①-layer readModel note)');
const captureHandler = byKind['projection-handler'].find((e) => e.path.endsWith('CaptureNoteDecisionViewOnNoteCapturedHandler.scala'));
equal(captureHandler.noteIds.length, 1, 'handler noteIds = the consuming event note id (S7 #1c)');

// Shape assertions on the def faces.
const ks = byKind['projection-def'].find((e) => e.path.endsWith('KnowledgeSemanticView.scala'));
ok(ks.content.includes('createProjectionForNote') && ks.content.includes('createProjectionForConcept'), 'multi-aggregate per-source variants');
ok(ks.content.includes('import net.imadz.metarch.infrastructure.proto.concept.ConceptEventPO.Event'), 'per-aggregate PO.Event imports');
ok(!ks.content.includes('proto.concept._'), 'wildcard only for the PRIMARY aggregate');
const os = byKind['projection-def'].find((e) => e.path.endsWith('OpenSessionDecisionView.scala'));
ok(os.content.includes('createProjectionForSession') && !os.content.includes('StageAggregate'), 'zero-handler groups emit nothing (Stage)');
const ts = byKind['projection-def'].find((e) => e.path.endsWith('TruthSourceProvenanceDecisionView.scala'));
ok(!ts.content.includes('CompositeHandler'), 'single-handler def wires the handler directly');

console.log('scala-cqrs-es-projection: defs ×43 + handlers ×240 + repos ×43 + impls ×43 byte-identical to live (spot-gated; full corpus = tools/full-corpus-identity.mjs)');
