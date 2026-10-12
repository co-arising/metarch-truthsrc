// scala-cqrs-es-rules-metarch.test.mjs — V4-3 inc6+inc7 gate: golden byte identity against the LIVE
// rules_domain_gen output (di-poc, verified fresh: re-running CODEGEN_MULTI=1 rules_domain_gen
// --agg=ModelCatalog into a temp copy reproduced both committed files byte-for-byte, 2026-10-13),
// for the ModelCatalog CommandHelpers glue and the Behaviors command-flow wiring.
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
equal(entries.length, 2);
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

console.log('✅ scala-cqrs-es-rules-metarch — golden byte identity (ModelCatalog CommandHelpers + Behaviors, rules face)');
