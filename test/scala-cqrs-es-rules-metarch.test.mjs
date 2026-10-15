// scala-cqrs-es-rules-metarch.test.mjs — V4-3 inc6…inc10 + V4-10 gate: golden byte identity against the
// LIVE rules_domain_gen output (di-poc, verified fresh: re-running CODEGEN_MULTI=1 rules_domain_gen
// --agg=ModelCatalog into a temp copy — with the app/ → modules/kernel/src/main/scala signature
// mirror the S2-102 erratum prescribes — reproduced all SEVEN committed files byte-for-byte,
// 2026-10-15), for the ModelCatalog CommandHelpers glue, the Behaviors command-flow wiring, the
// RuleParams projection VOs, the Rules invariant object (exprToScala engine), the RulesSpec
// pure-domain suite and the Policies reaction face (S2-44).
//
// This is the SECOND generator (the rules face). Where scala-cqrs-es emits the CodegenMain skeleton,
// scala-cqrs-es-rules reproduces the rules_domain_gen pass that overwrites the behaviors glue. The
// load-bearing facts it exercises:
//   • CommandHelpers: `toParam`'s field ORDER is NOT the declared param order — it is a union
//     discovered over (1) the COMMAND_PRECONDITION rule var-refs attributed to the command and
//     (2) the ④-layer behaviorModel bindings. The canonical's rules-face slots (preconditionRules,
//     behaviorModel) are attached by tools/augment-rules-canonical.mjs from the raw backend-codegen
//     inputs (generated_rules.json / executable_cases.json / refining behaviorModel); the discovery
//     itself lives in the generator (builders/rules.mjs).
//   • Behaviors: per-command runReplyingPolicy wiring with class-form port injection — ONLY the
//     command whose behaviorModel exprs reference a port member (adjudicator.) gets
//     `new <Cmd>Rule(adjudicator)`; the rest reference the bare Rule object. `.withPost` hangs
//     off the aggregate's event-postcondition bit. Each write case anchors its command concept
//     noteId + elementHashes hash (`@knowledge <uuid>@<hash16>`); the Get<X>State query is the
//     mechanical Effect.reply(state) body with NO anchor.
//   • RuleParams: one case class per write command in the SAME union-discovered order as toParam,
//     types from the declared command parameters (`string (uuid)` → Id); the per-class anchor is
//     the rule targetId (all of a command's precondition rules share its concept noteId → one
//     deduped line) and the doc comment lists the rule IDs; List-typed fields get ` = List.empty`;
//     the Id/values import bits are regex-decided over the rendered field lines (voNames registry).
import { equal, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', 'scala-cqrs-es-rules');
const CANON = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const HASHES = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch', 'model-catalog.elementHashes.json');
const GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-rules-metarch', 'expected');

const { entries } = await plan({
  canonicalFile: CANON,
  generatorDir: GEN,
  options: {
    generatedBy: 'rules_domain_gen:2026-08-23',
    elementHashes: JSON.parse(readFileSync(HASHES, 'utf8')),
  },
});
equal(entries.length, 8);
for (const e of entries) {
  const want = readFileSync(join(GOLD, e.path), 'utf8');
  equal(e.content, want, `byte identity: ${e.path}`);
}

// toParam order is union-discovered, not declared order: AssembleMetadata is declared
// (tenantId, projectId, version, manifest, triggeredBy) but toParam leads with triggeredBy (the
// rule-referenced field) then the ④-layer binding order.
const ch = entries.find((e) => e.kind === 'command-helpers-rules').content;
ok(ch.includes('AssembleMetadataParams(command.triggeredBy, command.projectId, command.version, command.manifest, command.tenantId)'),
  'toParam = union-discovery order (triggeredBy first), not declared order');
// The query command is imported (both Get<Name>State and its Reply) but gets no helper object.
ok(ch.includes('ModelCatalogProtocol.GetModelCatalogState\n'), 'query command imported');
ok(ch.includes('ModelCatalogProtocol.GetModelCatalogStateReply\n'), 'query reply imported');
ok(!ch.includes('GetModelCatalogStateHelper'), 'query command has no helper object');

// Behaviors: port injection is PER-COMMAND, discovered from the behaviorModel exprs — only
// ApplyKnowledgePatch references `adjudicator.` (emitWhen cond + emission binding); the other
// seven write commands wire the bare Rule object.
const bh = entries.find((e) => e.kind === 'behaviors-rules').content;
equal((bh.match(/new ModelCatalogRules\.\w+Rule\(adjudicator\)/g) || []).length, 1,
  'exactly one class-form Rule (port injection)');
ok(bh.includes('runReplyingPolicy(new ModelCatalogRules.ApplyKnowledgePatchRule(adjudicator), ApplyKnowledgePatchHelper)(state, cmd)'),
  'ApplyKnowledgePatch: class-form Rule with closure-injected port member');
ok(bh.includes('runReplyingPolicy(ModelCatalogRules.AssembleMetadataRule, AssembleMetadataHelper)(state, cmd)'),
  'AssembleMetadata: bare object-form Rule (no port)');
equal((bh.match(/\.withPost\(ModelCatalogRules\.checkEventPostconditions\)/g) || []).length, 8,
  'withPost hangs on all 8 write commands (event postconditions exist)');
// @knowledge anchors carry the command noteId + hash16; the query case carries none.
ok(bh.includes('// @knowledge 693bff63-3dfb-4903-b70d-03df85582708@a6fde370ee4bf2c9'),
  'write-case anchor: command noteId + elementHashes hash');
ok(!bh.split('case cmd: GetModelCatalogState')[0].endsWith('@knowledge'), 'no anchor leak before query case');
ok(bh.includes('Effect.reply(cmd.replyTo)(GetModelCatalogStateReply(state))'),
  'Get<X>State → mechanical Effect.reply(state) body (S1 ruling)');
// Port closure shape: the apply overload takes the member, require-guards it, and imports the trait.
ok(bh.includes('def apply(adjudicator: ConceptDeltaAdjudicator): ModelCatalogAggregateCommandHandler'),
  'apply(port) overload signature');
ok(bh.includes('require(adjudicator != null, "adjudicator 未绑定")'), 'port member require-guard');
ok(bh.includes('import net.imadz.metarch.domain.service.ConceptDeltaAdjudicator\n'), 'port trait import');

// RuleParams: the case class carries the SAME union-discovered field order as toParam (string
// (uuid) → Id), the List-typed field gets ` = List.empty`, and the query command gets no class.
const rp = entries.find((e) => e.kind === 'rule-params').content;
ok(rp.includes('final case class ApplyKnowledgePatchParams(sessionId: Id, concepts: List[ConceptDelta] = List.empty, triggeredBy: String, catalogId: Id, patchId: Id, patchHash: String, parentPatchId: Id)'),
  'ApplyKnowledgePatchParams: paramDefs order + Id mapping + List.empty default');
ok(rp.includes('final case class AssembleMetadataParams(triggeredBy: String, projectId: Id, version: String, manifest: String, tenantId: Id)'),
  'AssembleMetadataParams: union-discovery order, not declared order');
ok(!rp.includes('GetModelCatalogStateParams'), 'query command has no Params class');
// The per-class anchor is the rule targetId (deduped — all 3 ApplyKnowledgePatch rules share the
// command noteId → exactly one anchor line) and the doc comment lists the rule IDs in order.
equal((rp.match(/@knowledge 693bff63-3dfb-4903-b70d-03df85582708/g) || []).length, 1,
  'rule targetIds dedupe to one anchor per class');
ok(rp.includes('/** ApplyKnowledgePatch 规则投影：IR-CAT-CMD-002_concepts / ir_cmd_ApplyKnowledgePatch_triggered_by / ir_gen_ref_IR_CAT_CMD_002_sessionId */'),
  'doc comment lists attributed rule IDs (attached order)');
// Import bits: Id (uuid params) + values._ (List[ConceptDelta] ∈ voNames) present; Instant absent.
ok(rp.includes('import net.imadz.common.CommonTypes.Id\nimport net.imadz.metarch.domain.values._\n/**'),
  'Id + values imports abut the doc comment (no blank lines)');
ok(!rp.includes('import java.time.Instant'), 'no Instant import (no Instant-typed field)');

// ── inc9: Rules + RulesSpec ──────────────────────────────────────────────────────────────────
// Rules: the exprToScala-driven invariant object. Load-bearing facts exercised:
//   • checkAggregate = RULING5 gate (ModelCatalog whitelist = CreateCatalogVersion) + the
//     aggregate-level checks in attached order, each anchored at its own rule targetId.
//   • Command checks are ④-layer guards-ORDERED (not localeCompare sorted): triggered_by before
//     IR-CAT-CMD-002_concepts before the ir_gen_ref sentinel — the raw decision's guards order.
//   • The ApplyKnowledgePatchRule emission merges the fixed leg with the emitWhen conditional leg
//     (`::: (if (...) List(...) else Nil)`) and the cond translates through exprToScala.
//   • The import face is the UNION of the Rule-constructor ports (adjudicator) and the EventHandler
//     fold-face fn: ports (ComputeCatalogStateHash → ContentFingerprintPort) — one port trait with
//     NO Rule taking it proves the fold-face add.
//   • checkEventPostconditions dispatches the surviving firstBad<Event> chain (event-construction
//     conflict guard filters unguaranteed checks).
const rl = entries.find((e) => e.kind === 'rules').content;
ok(rl.includes('private val InitialCommands: Set[String] = Set("CreateCatalogVersion")'),
  'RULING5 creation-family whitelist (裁决⑤)');
ok(rl.includes('    else if (!((!(Option(state.conflicts).exists(_.nonEmpty)) || (Option(state.status).exists(x => Set("CONFLICT_DETECTED", "RESOLVED").contains(x)))))) Some(err("CAT_CONFLICT_STATE"'),
  'aggregate check: exprToScala translates implies/notEqual to Option combinators (IR-CAT-AGG-002)');
const akpChecks = rl.slice(rl.indexOf('object ApplyKnowledgePatchRule') >= 0 ? rl.indexOf('class ApplyKnowledgePatchRule') : 0, rl.indexOf('object AssembleMetadataRule'));
const chkOrder = ['ir_cmd_ApplyKnowledgePatch_triggered_by', 'IR-CAT-CMD-002_concepts', 'ir_gen_ref_IR_CAT_CMD_002_sessionId']
  .map((id) => akpChecks.indexOf(`// ${id}`));
ok(chkOrder.every((i) => i >= 0) && chkOrder.every((i, n) => n === 0 || i > chkOrder[n - 1]),
  'command checks in ④-layer guards order (not localeCompare)');
ok(akpChecks.includes('      else Right(List(KnowledgePatched(p.catalogId, CatalogPatchSet(p.sessionId.toString, p.concepts, Instant.now()), p.patchId, p.patchHash, p.triggeredBy, Instant.now(), state.tenantId, p.concepts)) ::: (if (((Option(p.parentPatchId).isEmpty || Option(state.headPatchId).isEmpty || p.parentPatchId != state.headPatchId) || (adjudicator.hasConflicts(p.concepts, state.conceptIndex)))) List(CatalogConflictDetected(p.catalogId, CatalogConflictSet(Instant.now(), adjudicator.conflicts(p.concepts, state.conceptIndex)), p.triggeredBy, Instant.now(), state.tenantId)) else Nil))'),
  '④-layer fixed leg ::: emitWhen conditional leg (expr: bindings + cond translation)');
ok(rl.includes('import net.imadz.metarch.domain.service.ContentFingerprintPort\n') && !rl.includes('ContentFingerprintPort('),
  'fold-face port import (ContentFingerprintPort) with no Rule constructor taking it');
equal((rl.match(/private def firstBad\w+\(e: \w+\): Option\[iMadzError\]/g) || []).length, 8,
  'checkEventPostconditions: 8 surviving firstBad<Event> helpers (conflict-guard filtered)');
ok(rl.includes('// @knowledge c577f2ab-ec59-41b1-a41f-f7f6a3bad709@4dd79a10902388f9'),
  'event-postcondition anchor carries the EVENT noteId + hash (extract projects event noteIds)');

// RulesSpec: executable_cases-driven pure-domain suite.
const sp = entries.find((e) => e.kind === 'rules-spec').content;
ok(sp.includes('class ModelCatalogRulesSpec extends AnyWordSpecLike with Matchers {'), 'spec class');
equal((sp.match(/" in \{/g) || []).length, 78, '78 executable cases rendered (zero SKIPs — every ModelCatalog case targets an implemented rule)');
ok(sp.includes('"CreateCatalogVersion negative ir_agg_ModelCatalog_status_enum"'), 'aggregate-rule case rendered');
ok(sp.includes('ModelCatalogState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "DRAFT"'),
  'state fixture: case given.state + Id FQN literalFor + statusFallback');
ok(sp.includes('List(CatalogConflict("", "", Nil, "", null, "", "", ""))'),
  'VO object literal via valueObjectSigs signature (IR-CAT-AGG-002 negative conflicts)');
ok(sp.includes('      val r = new ModelCatalogRules.ApplyKnowledgePatchRule(adjudicatorImpl)'),
  'class-form rule constructed with the port Impl val');
ok(sp.includes('    new net.imadz.metarch.domain.service.ConceptDeltaAdjudicator {'),
  'port Impl val: object-shape anonymous-class delegation (functions.yaml ports declaration)');
ok(sp.includes('      def hasConflicts(deltas: List[net.imadz.metarch.domain.values.ConceptDelta], conceptIndex: List[net.imadz.metarch.domain.values.ConceptIndexEntry]): Boolean ='),
  'delegation sigs FQ-qualified (PORT_VALUE_TYPES)');
ok(sp.includes('ModelCatalogRules.checkEventPostconditions(r.toOption.get) shouldBe None'),
  'positive cases assert the event-postcondition chain');

// ── inc10: Policies + PoliciesSpec (the S2-44 reaction face) ────────────────────────────────
// Policies: on(event) => List[Params] objects driven by policy-note info.bindings. Load-bearing
// facts exercised:
//   • Attribution: 2 of the 10 candidate policy notes target ModelCatalog (generate=false notes
//     never travel); the OTHER 8 belong to Concept/KnowledgePatch/Session/Tenant and are absent.
//   • Cross-aggregate event imports: ProjectEntity.ProjectInitiated (Project) and
//     KnowledgePatchEntity.KnowledgePatchMergeCommitted (KnowledgePatch) — the evtHostAgg face.
//   • literal: bindings render as quoted Scala strings ("1.0.0"/"0.0.0"), event.<field> direct
//     refs pass through, and e.patchId twice (idempotent re-apply) survives verbatim.
//   • The header stamp is the policy face's own (2026-09-05 (S2-44)), not the rules-face one.
//   • Spec sentinels: List<ConceptDelta> VO payloads default-construct via the VO signature
//     (values import added), UUID-ish List<String> fields get the double-UUID-string pair.
const pl = entries.find((e) => e.kind === 'policies').content;
ok(pl.startsWith('// @generated by rules_domain_gen:2026-09-05 (S2-44)\n// @knowledge-release 1.0.0\n'),
  'policy face carries its own generator stamp');
ok(pl.includes('import net.imadz.metarch.domain.entities.ProjectEntity.ProjectInitiated\n') &&
   pl.includes('import net.imadz.metarch.domain.entities.KnowledgePatchEntity.KnowledgePatchMergeCommitted\n'),
  'cross-aggregate event imports (host Entity case classes)');
equal((pl.match(/^  object PolicyOn\w+ \{/gm) || []).length, 2, 'exactly two policy objects');
ok(!pl.includes('PolicyOnEstablishConcept') && !pl.includes('PolicyOnRecordConceptLandings'),
  'policies targeting OTHER aggregates absent (attribution is per target)');
ok(pl.includes('    List(CreateCatalogVersionParams(e.projectId, "1.0.0", e.triggeredBy, "0.0.0", e.tenantId))'),
  'literal: bindings + direct event refs (non-fanOut body)');
ok(pl.includes('    List(ApplyKnowledgePatchParams(e.patchId, e.concepts, e.triggeredBy, e.catalogId, e.patchId, e.patchHash, e.parentPatchId))'),
  'ApplyKnowledgePatch body: e.patchId re-referenced verbatim (declaration-is-authority)');

const pls = entries.find((e) => e.kind === 'policies-spec').content;
ok(pls.includes('import net.imadz.metarch.domain.values.ConceptDelta\n'), 'VO import for the sentinel default-construction');
ok(pls.includes('ProjectInitiated(Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000001"), "system", "system", Id.of("00000000-0000-0000-0000-000000000001"), "system", "system", java.time.Instant.now(), Id.of("00000000-0000-0000-0000-000000000001"))'),
  'evLit type-aware sentinels over the RAW ②-layer payload dataTypes');
ok(pls.includes('List("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002")'),
  'String-element list field: double UUID-string pair (Id.of-parseable)');
ok(pls.includes('List(ConceptDelta("", "", "", Nil, "", Id.of("00000000-0000-0000-0000-000000000001"),'),
  'List<ConceptDelta> payload: VO default construction via valueObjectSigs');
equal((pls.match(/results\.size shouldBe 1 \/\/ 单元素（非扇出）/g) || []).length, 2,
  'both tests assert the single-element (non-fanOut) expectation');

console.log('✅ scala-cqrs-es-rules-metarch — golden byte identity (ModelCatalog RuleParams + Rules + RulesSpec + CommandHelpers + Behaviors + Policies + PoliciesSpec, rules face inc6-inc10)');
