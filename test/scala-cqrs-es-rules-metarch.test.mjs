// scala-cqrs-es-rules-metarch.test.mjs — V4-3 inc6 gate: golden byte identity against the LIVE
// rules_domain_gen output (di-poc, verified fresh: re-running rules_domain_gen --agg=ModelCatalog
// into a temp copy reproduced the committed file byte-for-byte, 2026-10-12), for the ModelCatalog
// CommandHelpers glue.
//
// This is the SECOND generator (the rules face). Where scala-cqrs-es emits the CodegenMain skeleton,
// scala-cqrs-es-rules reproduces the rules_domain_gen pass that overwrites the behaviors glue. The
// load-bearing fact it exercises: `toParam`'s field ORDER is NOT the declared param order — it is a
// union discovered over (1) the COMMAND_PRECONDITION rule var-refs attributed to the command and
// (2) the ④-layer behaviorModel bindings. The canonical's rules-face slots (preconditionRules,
// behaviorModel) are attached by tools/augment-rules-canonical.mjs from the raw backend-codegen
// inputs (generated_rules.json / executable_cases.json / refining behaviorModel); the discovery
// itself lives in the generator (builders/rules.mjs).
import { equal, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', 'scala-cqrs-es-rules');
const CANON = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-rules-metarch', 'expected');

const { entries } = await plan({
  canonicalFile: CANON,
  generatorDir: GEN,
  options: { generatedBy: 'rules_domain_gen:2026-08-23' },
});
equal(entries.length, 1);
for (const e of entries) {
  const want = readFileSync(join(GOLD, e.path), 'utf8');
  equal(e.content, want, `byte identity: ${e.path}`);
}

// toParam order is union-discovered, not declared order: AssembleMetadata is declared
// (tenantId, projectId, version, manifest, triggeredBy) but toParam leads with triggeredBy (the
// rule-referenced field) then the ④-layer binding order.
const ch = entries[0].content;
ok(ch.includes('AssembleMetadataParams(command.triggeredBy, command.projectId, command.version, command.manifest, command.tenantId)'),
  'toParam = union-discovery order (triggeredBy first), not declared order');
// The query command is imported (both Get<Name>State and its Reply) but gets no helper object.
ok(ch.includes('ModelCatalogProtocol.GetModelCatalogState\n'), 'query command imported');
ok(ch.includes('ModelCatalogProtocol.GetModelCatalogStateReply\n'), 'query reply imported');
ok(!ch.includes('GetModelCatalogStateHelper'), 'query command has no helper object');

console.log('✅ scala-cqrs-es-rules-metarch — golden byte identity (ModelCatalog CommandHelpers, rules face)');
