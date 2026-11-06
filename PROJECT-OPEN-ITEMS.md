# Project-entry open items

Updated 2026-11-06. These are recorded debts and candidates, not authorization to
expand the current implementation batch. The 2026-11-04 sections below are retained
as historical observations; current delivery status is governed by
[MINIMAL-DELIVERY.md](MINIMAL-DELIVERY.md) and [TEMPLATE-PARITY.md](TEMPLATE-PARITY.md).
In particular, new inline knowledge annotations are paused and precise generated-code
spans are implemented. The later task108 user decision permits compatible migration;
Entity/Behaviors/Bootstrap/local repositories and explicit JDBC projectionStore have
now been implemented and verified. Their concrete BC compatibility exceptions and
explicit hand-written ports are in TEMPLATE-PARITY.md; the historical OPEN sections
below do not override that current status.

## DEFERRED — useful ideas from the information-density alternative review

On 2026-11-06 the user requested review and parallel/fork feasibility, then asked to
record useful ideas rather than implement the alternative. These candidates do not
add acceptance requirements to the current A–E delivery or resolve its protected
application/template migration boundary. No fork, source migration, prototype
integration, runtime work or Git publication was authorized by this request.

Review baseline: TOOL `d1c1c8b5a83f85b1982a231f68316ced4d102de5`, BANK
`21dc6c60d75a5b87a576986539c283b4cdbc87c6`. Local workspace review inputs, not shipped
modules:

- `review_information_density_implementation_alternative.txt`, SHA-256
  `aaf524605e01dd8b673ec9e2fec251c2b4815bed0ecb81fdc41f2fe48679dcdd`.
- `truthsrc_precompiler.mjs`, SHA-256
  `5d67b6a72aa0c8ff3352af081df23bbfa3e2b5e650c5b5238e7e30d21a1cbef9`.
- `truthsrc_context_pack.mjs`, SHA-256
  `3c5a1e7b5dd2a97845a42fe5623c3990037b56d27aff0d1fbf8c411e3cfb9e29`.

### 1. Prefer readable type spellings in controlled micro-syntax slots

Current author example:

```json
"compensatedIncoming: \"Map[TxId, Money]\" = []"
```

The inner quotes are imposed by `lib/author-micro-codec.mjs`'s generic string atom
rule; the outer JSON encoding escapes them. They are not required by the Map type
or by JSON when the whole declaration is already a string. A desirable future
spelling is:

```json
"compensatedIncoming: Map[TxId, Money] = []"
```

Current parsing rejects that spelling with `AUTHOR_MICRO: quote text containing
punctuation or whitespace`; do not remove the quotes from the current tree first.
A scoped type-token reader/writer can admit balanced nested type applications,
retain the exact type text, and keep the existing quoted spelling as fallback.
Do not relax every string/guard/expression slot or replace the author YAML dialect.
String defaults such as `id: AccountId = ""` still need their JSON string quotes.

This is a small, independently developable codec/test change. Integration must
preserve old quoted inputs, strict default parsing, generic nesting/error checks,
raw author roundtrip and source-index mappings. Share lexical rules where suitable;
leave nominal type resolution and semantic admission to existing product gates.
The current `test/author-micro.test.mjs` passed 22/22 during review. No codec or
author input was changed.

### 2. Build a read-only task context pack over the existing graph/query evidence

Retain the prototype's idea of presenting relevant contracts, rules, source
locations, actual code and existing test references in one bounded task view.
Implement selection/formatting over the existing verified project query and
`KnowledgeGraphStore` interfaces, not another YAML/macro/micro parser. Batch against
one captured snapshot; avoid recompiling the project separately for every node.

Required result contract: explicit project/output and snapshot/generation;
qualified identities and ambiguity; real author file/pointer with N:1 labels;
actual code fingerprint/span or candidacy; freshness/missing-evidence diagnostics;
UTF-8 byte budget, omitted items/reasons and snapshot-bound continuation. Derived
text is data, not an Agent instruction or proof that tests passed. Actual test
references and available receipts must remain distinct from proposed scenarios.

This is the strongest independent-task/fork candidate. A separate package is
possible after its read-only input/output contract is fixed. It must not write the
graph/anchors/generated tree, install hooks, guess Scala signatures, invent finance
oracles, or promise a complete call graph/Zero-Grep operation. Current graph relations
and narrative trace links are not a complete causal graph.

### 3. Evaluate higher-level finite protocol profiles for incremental author savings

The alternative's M1–M4 grouping suggests a more intention-level author surface
than generic structural tables. Retain that as an experiment, not as an approved
replacement compiler. Any profile must keep financial choices and technical pins
explicit, reject unsupported variants, preserve identity/order, and return standard
expanded documents plus real representation mappings through the existing frontend.
Do not move bank-specific policy tables into hidden compiler constants.

Measure against the current 157 YAML / 590,184 bytes / 13,847 physical lines, not
only the pre-compression 303-file tree. The proposal's 159-file / 9,485-line / 72.2%
figures use another representation and counting baseline; they are not verified
incremental savings over the current tree. Effect macro coverage also differs.
Pure profile lowering and independent fixtures can be explored separately; author
version selection, migration, source evidence, tool fingerprinting and final apply
remain main-integrator responsibilities. Existing `compact-author` explicitly
rejects an already-structured tree, so it is not a ready-made second pass.

Admission requires a frozen independent semantic/14-product baseline, unchanged
Saga digest and ordering, compact-author byte roundtrip with tamper rejection,
N:1 graph/code queries, and explicit changed-input/unknown-mode/collision tests.
An experiment with no material net readability or maintenance benefit can be dropped.

### Not adopted from the supplied scripts

The standalone implementations are not drop-in equivalents. Reviewed counterexamples
include global interpretation of literal `@ref` strings, comma truncation in fold
values, unknown TCC styles producing empty guards, path-based elimination without
comparing original facts, and destructive destination replacement. The context pack
ignores current structure atoms, assumes expanded object fields, invents signatures
and scenario expectations, and can claim complete context for an empty index.
Its presentation ideas do not justify adopting those behaviors. Any fixture-level
byte roundtrip is separate from production compile/products/source evidence gates.

### Separate observed regression-test debt, not a borrowed feature

The current pure codec also maps
`compactMicro({name:'n',dataType:'Integer',default:-0}, 'state-field')` to
`n: Integer = 0`; `JSON.stringify` equality does not distinguish negative zero.
Ordinary author JSON parsing likewise must not be described as a full exact-number
token audit merely because duplicate keys are checked. Record focused counterexamples
before changing numeric admission; downstream product acceptance of these cases
was not established in this review. No bank money policy or accepted product payload
was changed.

## OPEN — JS / BC generated-code style and structure gap

User observation: JS (`metarch-truthsrc`) output still differs substantially from
BC (`backkend-codegen`). User identified `ingested-app` as the useful BC-generated
comparison target. This batch performed only a four-file Scala sample against
four JS entry/render files. No shared application or BC source was modified.

Concrete sample (workspace-relative paths; line numbers at inspection):

| Face | BC-chain sample under `ingested-app/` | JS source template | Observed difference |
|---|---|---|---|
| Protocol | `app/net/imadz/metarch/application/aggregates/ProjectProtocol.scala:24–49,66–79` | `generators/scala-cqrs-domain/render-domain.mjs:28–34` | BC application protocol carries `ActorRef[Reply]`, replies and handler aliases; JS domain protocol groups Command/Event and declared fields. |
| Command handling | `app/net/imadz/metarch/application/aggregates/behaviors/ProjectBehaviors.scala:17–25,39–43` | same render `:36–46,66–70` | BC sample uses `runReplyingPolicy`, `withPost`, `replyWith`; JS domain face separates computation/event helpers and `Either[String, Vector[Event]]` rules. |
| Event handling | `app/net/imadz/metarch/domain/entities/behaviors/ProjectEventHandler.scala:23–26,38–41,57` | same render `:73–91` | BC sample has annotated direct copies and a default unchanged-state case; JS emits typed `nextN` assignments then copy, without that default in this template. |
| State | `app/net/imadz/metarch/domain/entities/ProjectEntity.scala:9–34,96` | same render `:15–21` | BC groups state/empty/event family/handler alias in Entity; JS has a separate State case class and companion. |

These are organization/interface/rendering differences, not merely whitespace.
They are not yet a judgment of which shape is correct. The JS v2 producer also
registers `renderActors` (`generators/scala-cqrs-domain/produce-v2.mjs:1–13`), so
comparing this domain template to BC's application protocol cannot prove that JS
has no actor/reply layer. BC samples also contain long single-line declarations;
“JS single-line versus BC multi-line” is not an accurate overall conclusion.

Source headers on Protocol/Entity identify `CodegenMain:225ed28b` and
`@knowledge-release 1.0.0`; the two handlers identify
`rules_domain_gen:2026-08-23`. This supports BC-chain provenance for these samples,
not a verified claim about all files or their current fingerprint integrity.

Follow-up inspection confirmed `semantic-products*` as separate profile/fixture
golden outputs, not a replacement golden for all of `ingested-app`. Their presence
does not establish the historical cause of style divergence. The unification work
preserves that distinction and does not change templates to resemble BC output.

## OPEN — inline knowledge anchors / source identity continuity

BC samples contain entity/field/parameter/command/event `@knowledge UUID@hash`
annotations and descriptive comments. The inspected JS renderer does not emit
these annotations in source bodies.

The JS v2 entry (`generators/scala-cqrs-domain-v2/generate.mjs:1–6`) uses the shared
producer registry and rendering helpers. `generators/scala-cqrs-domain/naming.mjs:24–27`
constructs `source:<document>#<pointer>` identifiers and returns them in
`knowledgeIds`; source `content` receives only the generated header. This is a
concrete separation between plan metadata and inline source annotations. The v2
path also reuses a body header marked `scala-cqrs-domain:1`; do not infer the actual
selected producer version from that header alone.

Current project-entry tests verify that the core applies those source identities
to root `anchors.json` entries backed by actual file SHA-256 bytes. That does not
supply BC-style in-source anchors or prove UUID/hash identity continuity, symbol
mapping, or semantic correctness.

“Missing server-side ID allocation caused the missing inline anchors” is **not
established**. The local chain already has source coordinates and does not need a
server merely to refer to a source document/pointer. Whether stable identity should
be authored, locally allocated, migrated from existing note IDs, or mapped across
the two systems remains an explicit design/compatibility question. No new IDs were
invented and no server requirement was introduced in this batch.

## OPEN — retry/backoff/deadline execution debt (unchanged)

The authoritative existing debt remains
`../bank-wealth-demo/docs/TRUTHSRC-CONTINUATION.md` §3. Truth-declared attempts,
backoff and deadlines are not fully connected to the strict execution path.
It is not an accepted finite-profile exemption. No runtime repair, rebuild,
publication, journal modification or re-certification was performed. P23 artifacts
and the bank's 1134 bounded release evidence remain frozen.

## Delivered by the authorized unification implementation

The first-batch deferral is superseded by [PROJECT.md](PROJECT.md): recommended
system/context authoring, compatibility import, snapshot source indexing,
`query-project`, `status-project` and opt-in baseline-checked `--update` are now
implemented. Default overwrite refusal remains; update is not a force bypass.
The bank root entry and teaching coverage are described in its `TRUTH.md`; actual
verification is recorded in [PROJECT-UNIFICATION-ACCEPTANCE.md](PROJECT-UNIFICATION-ACCEPTANCE.md).

Still outside the delivered capability: arbitrary multi-context generation,
automatic identity continuity for name-only renames, symbol/span mapping, BC full
generator parity and coordinated BC active-source cutover. Actual BC migration
now reports seven historical origin/payload stage conflicts; see [COMPATIBILITY.md](COMPATIBILITY.md).
They require an author-meaning decision, not automatic normalization. No server ID allocator
is required for existing qualified declarations. Retry and output-style debts
above remain independent OPEN items.
