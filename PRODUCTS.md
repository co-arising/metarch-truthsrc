# Versioned product admission — canonical and static Saga contracts

最后更新: 2026-11-10

## Finite Strict Saga and Monarch R2 products

The explicit `scala-cqrs-saga-monarch-v1` producer targets
`scala-cqrs-saga-monarch@1`. Its eight product versions are reference-layout@1,
exact-value-types@1, exact-value-codecs@1, saga-contract@2,
saga-runtime-contract@2, execution-contract@2, workflow-contract@1 and
saga-host-contract@3. These versions do not reinterpret the legacy v1 contracts.

Saga v2 uses a typed result port and per-interaction timeout; the runtime product
uses v4 lowering with the pinned Strict Saga artifact. Execution v2 retains the
R2 Run definition/codec identity and complete reads, writes and outcome mapping.
Workflow v1 admits finite batches, original-item settlement, explicit release or
whole-group Carry, and bounded retry with an explicit exhausted disposition.
The host product closes these references over captured implementations and an
explicit composition root; unknown or unsupported shapes fail before generation.

Static product validity is not runtime qualification. The nonbank samples have
separate source-bound compile, behavior and journal-recovery evidence; no bank
migration, runtime publication, generic deadline or architecture approval is
inferred. See [the family contract](docs/artifacts/SAGA-MONARCH-R2.md) and
[project use](PROJECT.md#finite-sagamonarch-r2-projects).

## Finite persistence/readside product

`persistence-readside-contract@1` (`truthsrc.persistence-readside-contract/v1`)
uses the explicit `truthsrc.persistence-readside-binding/v1` technical document.
It requires reference-layout@1, exact-value-types@1, exact-value-codecs@1,
domain-decision@4, domain-dependencies@6, domain-folds@6 and
domain-external-events@2. The shipped producer is
`scala-cqrs-persistence-readside-v1`, target `scala-cqrs-persistence-readside@1`.

The finite contract covers one context/aggregate, every local event and state wire
registration, and one existing String-carried state-map index. Wire versions and
transitive-layout SHA pins, serializer ID, source/store identity and H2 capacities
are explicit technical choices. They do not duplicate event folds, invent payload
identity fields or authorize arbitrary Scala/SQL expressions. Unknown capabilities
and mismatched wire pins fail closed. Legacy journal-readside/v1 is unchanged.

Product readiness remains `static-contract-only`, `runnable=false` and
`runtimeBindingVerified=false`. The Warehouse candidate's compiler, serializer and
JDBC evidence is separate; JDBC file replay is not production Actor journal
qualification. This batch is still in acceptance, not a complete CQRS application
or architecture approval. See [the bounded contract](docs/artifacts/scala-cqrs/PERSISTENCE-READSIDE.md)
and [project use](PROJECT.md#finite-persistencereadside-projects).

## Finite module-seams products

The explicit `scala-cqrs-module-seams-v1` producer targets
`scala-cqrs-module-seams@1`. It consumes two strict versioned products:

- `module-seams-contract@1` (`truthsrc.module-seams-contract/v1`, capability
  `finite-module-seams-signature@1`) reconstructs the single-context nominal value
  closure and pure/future port signatures from the author tree.
- `module-seams-composition@1` (`truthsrc.module-seams-composition/v1`, capability
  `finite-module-seams-composition@1`) requires the contract above and the explicit
  `truthsrc.module-seams-composition-binding/v1` technical input: implementation
  identity/module/FQN, constructor parameter groups, delegate and root selection.
  It does not accept arbitrary Scala expressions or a second copy of the signatures.

Readiness remains `static-contract-only`, `runnable=false` and
`runtimeBindingVerified=false`. The actual Parcel sample has separate compiler and
behavior evidence; that is not runtime certification for arbitrary product inputs.
Its seven generated production Scala files consume three external handwritten
implementations. Build and generated shape suites are separate outputs.

Use `compile-project` and `generate-project` with live mixed-input capture; raw
`generate-products` rejects this family even in plan mode. Serialized canonical,
request or capture data cannot authorize source-root admission. Existing layout1
and artifact1–3 contracts are not expanded implicitly. See [project use](PROJECT.md#finite-module-seams-projects)
and [the module-seams contract](docs/artifacts/scala-cqrs/MODULE-SEAMS.md).

## Explicit five-plane design and deterministic review projection

`product-design@1` (`truthsrc.product-design/v1`, capability
`five-plane-product-design@1`) consumes canonical + designBinding
(`truthsrc.product-design-binding/v1`) and requires `reference-layout@1` only.
It independently reconstructs the whole canonical `productDesigns[]` collection:
qualified design artifacts, proposal/accepted/historical status, provenance and
same-version author-decision sources, five-plane nodes, exact design-node endpoints,
restricted relationships, complete command parameter origins, and typed feedback
resource/watermark evidence. It never infers pages, toast, business authorization,
terminal success or deployment from domain structure or a display label.

Nodes are strategy/scope/structure/skeleton/surface; action/feedback contracts are
explicit and source-complete. Machine action cannot use public intent. Pending or
unknown feedback cannot claim terminal evidence; terminal requires its exact event,
resource keys and typed watermark. See [SCHEMA.md](SCHEMA.md#five-plane-product-design-explicit-opt-in-2026-10-30)
and `schema/product-design-v1.schema.json`. Formal product-design and optional
product-design-decision atoms carry whole bodies, not historical-note conversions.
Accepted is an authored design status, not runtime or authorized reviewer certification.

The shipped `generators/product-design-review` target `product-design-review@1`
uses the existing two-render/full-plan/apply/ledger/actual-file-anchor channel. It
reads declared typed products, not raw canonical. Options are explicitly `{}`.
Output is exactly `design/product-designs.json`, five `design/<plane>.mmd` files and
`design/source-index.json`. Each is **design-review-only / runnable=false**; file
anchors are not symbol/span, CQRS read-side, replay, UI or deployment evidence.

```sh
node bin/truthsrc.js generate-products \
  --request /absolute/path/to/product-design-products/inventory/files.json \
  --generator /absolute/path/to/metarch-truthsrc/generators/product-design-review \
  --options-json /absolute/path/to/product-design-products/inventory/options.json \
  --out /absolute/path/to/new-owned-review --plan
```

Independent fixtures are `test/fixtures/product-design-products/{inventory,appointment}/files.json`.
BC consumes the same serialized product contract with explicit
`codegen.productTargetProfile=product-design-review@1`, `codegen.semanticProductsFile`,
`codegen.productOptionsFile` containing `{}`, and new absolute `codegen.targetDir`.
BC typed model/builder/template reconstruct independently; neither chain calls the
other renderer. No bank source or historical design migration is performed.

## Finite host contract and application profile

`saga-host-contract@1` (`truthsrc.saga-host-contract/v1`, capability
`finite-saga-host-contract@1`) consumes explicit canonical + hostBinding
(`truthsrc.saga-host-binding/v1`). Ordered requirements: layout1, exactTypes1,
Saga1, runtime1, execution1, externalEvents2, artifact2. Canonical `sagaHosts[]`
contains id/version/saga/argsType/entry/association/participants/results/technicalPorts.
The compiler and independent BC adapter reconstruct complete source, not digest flags.

Each phase retains its complete typed command signature, original input lineage,
confirmation outputs, seven-part identity and whole receipt payload, both codec pins
and a read-only query. Five explicit result destinations retain complete event-slot
lineage and a versioned original association before any phase effect. Entry payload
and Saga args are different nominal records: never discard original request identity.
The host persists original bytes, length-prefixed domain-separated association identity,
observed authoritative runtime identity, result intent and delivery acknowledgment.
No authority, installed module or delivery certificate is inferred.

`artifact-contract@2` adds strict canonical type-spelling resolution;
`domain-external-events@2` adds nominal identities whose final carrier is String.
Legacy @1 remains strict. Explicit dependencies/folds@5 pins externalEvents@2,
without upgrading @4 or changing decision3/production2 grammar.

The shipped `generators/scala-cqrs-application` manifest targets
`scala-cqrs-application@1`, reuses six domain producers and adds finite host sources.
The same `generate-products` flags apply; options additionally require runtimeArtifact
with coordinate/sha256/repository/symbolicTarget. Actual frozen P23 artifact bytes
are checked before target writes, not downloaded or republished. BC opt-in is
`codegen.productTargetProfile=scala-cqrs-application@1` with existing product/options
file inputs. Both chains render independently. Pipeline-owned finite invocations are
now explicit: the generated host retains the complete parent checkpoint and args
before Start, persists the runtime's authoritative identity before Attach, and returns
its typed result only after result-delivery acknowledgment. The parent checkpoints
success only. Direct and pipeline host request surfaces remain distinct.

Actual independent input: `test/fixtures/inventory-host-products/files.json`.
Two Warehouse resources and a last AllocationOrder have real generated phase calls,
receipt-field consumption, external result event persistence and same-identity host replay.
Generated inventory test ports/cache are explicitly test-only; not banking policy,
production receipt durability, TA/SIP qualification or different-JVM recovery.
The generated test now exercises all five result kinds against real generated recipient
events, UNKNOWN-after-persist confirmation via authorized reconciliation, safe-absence
retry, lost delivery acknowledgment and same-identity host/coordinator replay. These are
bounded local technical tests, not production exactly-once delivery or bank acceptance.

Technical ports additionally expose `Implementation[I,O]`, closed typed `Bindings` and
privately constructed `Installed` objects. Installation checks every required function
object and implementation id/version; declarations derive from those actual objects.
Definition creation requires `Ports.technical`, matching declarations and every real
phase port/codec/read-only query before coordinator startup. `fromTechnical` now lowers
complete command-input and seven-part identity query records into the installed
operation-context functions; the independent generated tests actually reach aggregate
actors through this path. A query returning None remains UNKNOWN, never safe absence.
This does not certify function behavior, production receipt durability, or claim all
authority/TA/occurrence/read-side adapters are connected.

`execution-contract@1` is an explicit application producer input. The current finite
execution producer emits complete nominal inputs/outputs, stage requests/results,
version-pinned protobuf checkpoint state and a real frozen PersistentMonarch behavior
for single-run, single-step, single-chunk **pure port** plans. Input
`test/fixtures/inventory-execution-products/files.json` exercises actual journal prefix
and tail replay without using observer mirrors as authority. The same application
profile now also supports explicitly pipeline-owned `invokeSaga` adapters; input
`test/fixtures/inventory-invocation-products/files.json` verifies real three-participant
effects, host recovery before parent checkpoint, lost result acknowledgment and all
five mapped outcomes. External effects still require a separate complete adapter.

`child-plan-contract@1` (`truthsrc.child-plan-contract/v1`, capability
`finite-typed-child-plan@1`) consumes canonical + childPlanBinding
(`truthsrc.child-plan-binding/v1`) and requires layout1 + execution1. Each explicit
binding row pins a qualified child pipeline, its version and complete execution
binding. The canonical `monarch.typedPlan` carries `truthsrc.child-plan/v1`, exact
version, inputs/outputs/steps/recovery/admission. Child stages remain finite pure
ports, checked by the complete execution checker; payload, result fields and type
implementations must exactly match the parent's declared await contract. The old
execution@1 document-only rows are unchanged and never become whole child plans.

The shipped opt-in `generators/scala-cqrs-child-application` targets
`scala-cqrs-child-application@1`; BC uses the same explicit target-profile value.
`test/fixtures/inventory-child-products/files.json` exercises actual child checkpoint
prefix and replay, durable parent/child intent, typed result checkpoint and rejection
of conflicting payload or terminal records missing the confirmed prefix. Generated
`ChildJournal.CurrentJournal` queries a supplied Akka current-events read journal;
`ChildJournal.observe` validates actual RunStarted bytes, exact plan, contiguous
StageDone rows and RunCompleted identity before returning success. The generated
oracle uses actual PersistenceTestKit storage, not a synthetic mirrored progress record.
These are finite local technical proofs, not different-JVM fencing, production journal
operation, external effects, complete TA/SIP policy, or P24/P25 whole acceptance.

## Formal roots carried by the tree

The explicit `formal-product` atom residence in [SCHEMA.md](SCHEMA.md#formal-product-residence-additive-v1)
projects whole authored bodies into artifactContracts, ports, sagaHosts, hostComputations
and externalEventProducers. Compile/decompose preserve payloads and authored scalar
headers with a `formalProductSurface` transport sibling. Old `info.artifact` notes are
not lifted; status is not promoted. `validate` and `roundtrip` check residence/identity,
then existing `compile-products` performs full semantic admission. This is the public
source entry, not a bank-side normalizer or a statement that bank application requests
are complete. New declarations and bindings remain the domain owner's responsibility.

## Formal typed source generation

`scala-cqrs-domain@1` is the explicit domain-source target, using six registered
producers (`aggregate`, `invariant`, `command`, `valueobject`, `proto`, `converter`)
with `reference-layout@1`, `decision@3`, `dependencies/folds@4`, exact types/codecs@1
and external ingress@1. It emits state, protocol, rules, pre-event handlers,
event-sourced aggregate/factory, computation interfaces, external-event adapters,
value objects, actual protobuf, converters, event/snapshot adapters, explicit
protobuf serializers, build support and generated tests. It is **not** the
complete P25 Saga/pipeline application target or bank business qualification.

```sh
node bin/truthsrc.js generate-products \
  --request /absolute/path/to/files.json \
  --generator /absolute/path/to/metarch-truthsrc/generators/scala-cqrs-domain \
  --options-json /absolute/path/to/options.json \
  --out /absolute/path/to/owned-target --plan
```

Options are exactly `{packages:[{context,package}],verificationCases:[...]}`.
Verification cases are explicit typed target-test vectors, not production rules
or authored bank policy. `--plan` captures/compiles/validates a complete source
plan and never writes the target. Apply reuses the existing preflight/MANUAL/KEEP
channel and `written-only` file anchors. Ledger rows retain product versions and
`source:<document>#<pointer>` keys. All source entries are detached and separately
validated on both producer calls; unregistered generator directories are refused.
The shipped registry is trusted code, not a hostile same-process plugin sandbox.

Reproducible independent inputs: `test/fixtures/domain-generation/files.json` and
`domain-generation-corners/files.json` (unit Distance, 38-digit exact Ratio,
nested optional presence, keyword fields). BC reads the same serialized products
via the mutually exclusive `codegen.semanticProductsFile` and explicit
`codegen.productOptionsFile`; its builder/model/templates do not invoke JS.
Targets are new exclusive directories; all validation/rendering precedes writes.
Current minimal actor tests are local typed messages with real journal protobuf
serialization and same-JVM actor replay; they are not different-JVM recovery,
three-participant Saga, remote-command wire or bank funds/TA/SIP certification.

## Artifact and technical obligations

`artifact-contract@1` has payload `truthsrc.artifact-contract/v1`, capability
`artifact-static-contract@1`, roles canonical + artifactBinding
(`truthsrc.artifact-binding/v1`) and requires reference-layout@1. The canonical
`artifactContracts` array declares exact artifact identity/version, authored
selected/proposal/historical status, resolvable provenance, qualified references,
required typed port/version pins, symbolic deployment secret references and one
explicit implementation obligation per port. The product rederives the whole
row before comparing the binding; BC independently repeats these checks.

No `approved` status, secret value, inferred implementation or installed/runtime
certification is produced. An obligation id/version is not proof that its module
exists. Actual file entry: `test/fixtures/artifact-products/files.json`; offline
schema: `urn:truthsrc:artifact-contract:v1`.

## Complete static Saga/execution/runtime products

The same request/CLI explicitly supports:

| Product | Payload | Capability | Roles | Ordered requires |
|---|---|---|---|---|
| `saga-contract@1` | `truthsrc.saga-ir/v1` | `saga-static-contract@1` | canonical + sagaBinding (`truthsrc.saga-binding/v1`) | `[]` |
| `execution-contract@1` | `truthsrc.execution/v1` | `execution-static-contract@1` | canonical + executionBinding (`truthsrc.execution-binding/v1`) + sagaBinding | saga-contract@1 |
| `saga-runtime-contract@1` | `truthsrc.saga-runtime-contract/v3` | `saga-runtime-lowering@3` | canonical + sagaBinding + runtimeBinding (`truthsrc.saga-runtime-binding/v2`) | saga-contract@1 |

These dispatch the existing complete checkers, including full types, phases,
confirmation/query/idempotency, stable identity, outcomes, sourceMap and exact pins.
Execution/runtime must use the identical explicit canonical and Saga binding as
the required Saga product. Execution's embedded `sagaBindings` must entirely equal
that explicit role; omission or conflict is not a fallback. Runtime product version
1 is not runtime-library version 1 or a verified implementation.

`test/fixtures/product-contracts/files.json` is the actual complete file entry.
Register `urn:truthsrc:formal-contracts:v1` along with the existing offline schemas.
BC independently decodes immutable typed contracts and rederives the complete
source projections; source hints remain hints, not actual file authentication.

Assemblies have `{id,kind,sources}`; `execution-bindings-union` additionally requires
`sagaBinding`. Sources are exact earlier document IDs, in declared row order:

- saga-bindings-union: complete Saga binding documents, merging all sagas;
- runtime-bindings-union: complete runtime v2 bindings, identical entire targets;
- execution-bindings-union: complete execution bindings, merging all pipelines and
  associating the explicitly named complete Saga union. An original embedded Saga
  must equal that union or one complete source in its declared ancestry.

No duplicate row identities, filtering, override precedence, forward/cyclic source,
conflicting hint or unused output is accepted. Original documents are preserved;
output adds derived documents and `provenance:[{targetPointer,source}]` on each
assembly receipt. File capture retains the authored, unassembled request so it can
be validated/compiled repeatedly without treating derived documents as new input.

## Explicit external event ingress

`domain-external-events@1` uses payload `truthsrc.domain-external-events/v1`,
capability `external-event-producers@1`, roles canonical + externalEventBinding
(`truthsrc.domain-external-event-binding/v1`), and requires reference-layout@1.
Its complete binding is `{schemaVersion,externalEvents:{producers:[...]}}`.

Canonical `externalEventProducers` records contain exactly
`{id,version,kind,event,port,outputType,slotMappings,stableIdentityContract}`.
Kind is authority-event, saga-completion or technical-bridge. A canonical port has
an exact version and nominal output record; `slotMappings:[{slot,member}]` covers
every event slot once, with identical nominal types. Stable identity keys are
unique, consumed String output members. This is typed ingress, not an invented
command, a trusted sender implementation or a guarantee of authorized delivery.

`domain-dependencies@4` explicitly requires layout@1, decision@3, exact-types@1,
external-events@1; its v4 binding/payload adds the complete `externalProducers`.
Every event without a command producer must have exactly one external producer;
external and command production cannot silently overlap. `domain-folds@4`
requires layout@1, dependencies@4, exact-types@1; production expressions retain the
v2 finite grammar. Old dependencies/folds@1/@2/@3 do not acquire external ingress.

Actual file fixture: `test/fixtures/external-events/files.json`, with an independent
measurement observation and event-only replay. Offline schema:
`urn:truthsrc:domain-external-events:v1`.

## P24 static semantic compilation slice

The additive `lib/products/compile.mjs` API now exports
`compileProductSet(request)` → detached, deeply frozen `{result, diagnostics}`.
Any input/semantic error returns `result: null` and stable diagnostics
`{code, message, source: {document, pointer}, related}`. Domain profiles preserve
first-error behavior; complete Saga/execution/runtime checkers retain their whole
ordered diagnostic set. This remains static compilation, not complete P24/P25 generation.
The legacy API described below is unchanged; it is a separate versioned contract.

```js
import { compileProductSet } from './lib/products/compile.mjs';
import { readProductRequest, captureProductRequest } from './lib/products/cli.mjs';

const request = readProductRequest('/absolute/path/to/files.json');
const { result, diagnostics } = compileProductSet(request);
// captureProductRequest(file) also returns the actual per-file path/SHA/byte count.
// It does not place filesystem claims into the target-neutral semantic products.
```

Public file entry (from this repository):

```sh
node bin/truthsrc.js compile-products \
  --request test/fixtures/semantic-products/files.json \
  --out /absolute/existing-parent/new-products.json
```

The output must not exist; it is created exclusively and never overwritten.
Unknown/duplicate flags fail. CLI stdout is a JSON receipt with output SHA and
captured input paths/SHA/byte counts. The pure API performs no filesystem,
process, clock, network, generator or implicit directory lookup. Dependency
module loading is separate from request processing. These purity checks are not
an adversarial JavaScript plugin sandbox.

### Exact input and product versions

- File manifest: `truthsrc.product-input-files/v1`, exactly
  `{schemaVersion, documents, assemblies, requirements, options}`. Each document
  is `{id, schemaVersion, file}`; paths resolve relative to the manifest. The API
  manifest path is absolute; the CLI resolves its explicit arguments.
- Memory request: `truthsrc.product-compilation/v1`, same outer fields, document
  `{id, schemaVersion, value}` instead of `file`.
- `options` remains `{}`. Assemblies are either `[]` or the explicit complete
  unions documented below. No automatic union, document/schema selection,
  missing binding or capability default is accepted.
- Output: `truthsrc.semantic-product-set/v1`, compiler contract
  `{id: "truthsrc-semantic-products", version: "1"}`, envelopes
  `truthsrc.semantic-product/v1`. All original input documents remain in output.
- `reference-layout@1`: payload `truthsrc.reference-layout/v1`, capability
  `qualified-reference-layout@1`, roles `canonical` (`truthsrc/v1`) and
  `referenceBinding` (`truthsrc.reference-binding/v1`), `requires: []`.
- `domain-decision@1`: payload `truthsrc.domain-decision/v1`, capability
  `ordered-domain-decision@1`, roles `canonical` and `semanticBinding`
  (`truthsrc.domain-semantic-binding/v1`), requires exactly `reference-layout@1`
  on the same canonical document.

Each requirement has exactly `{id, version, payloadSchemaVersion, capabilities,
inputRoles, requires}`. Capabilities and dependencies are ordered identity arrays
with string versions. The complete working example is
[`test/fixtures/semantic-products/files.json`](test/fixtures/semantic-products/files.json).
Schema documents are [request and payload definitions](schema/product-compilation-v1.schema.json)
and [output set](schema/semantic-product-set-v1.schema.json). Register their
absolute `urn:truthsrc:product-compilation:v1` and
`urn:truthsrc:semantic-product-set:v1` IDs in an offline schema resolver; they are
identifiers, not URLs to fetch. Schema validation is only shape validation; the
compiler and BC consumer separately enforce semantics.

### Source-derived semantics and explicit limits

The reference binding declares the nominal/context-qualified layout, value types,
source pointers and exact owner/type dependencies. This is an explicit mapping,
not inferred target language types. It must be closed and acyclic. It is **not** a
complete validation of every raw canonical field/type or unselected artifact.

The semantic binding asserts the complete `decisions: {commands: [...]}` payload.
The compiler does not trust/copy this assertion as its decision implementation:
it reparses every canonical command's ordered `guards`, derives predicates,
on-false behavior and ordered dependencies, then compares the entire assertion.
Every canonical command must appear exactly once in the decision layout; its
name, aggregate owner and any explicit context must match. Commands need an
explicit guard array (including `[]`). No guard reordering or errCode deduplication.

Supported source grammar in this slice:

- Direct declared `param.<identifier>` and `state.<identifier>`; ASCII identifiers
  in raw expressions. Structured map guards use explicit direct paths.
- JSON string literals, `true`/`false`, parentheses, `!`, short-circuit `&&`/`||`,
  type-equal `==`/`!=`.
- String/collection/optional `.isEmpty`/`.nonEmpty`, typed `.contains(value)`, map
  `.get(key).contains(value)`, and `.keys.forall(_ == declaredReference)`.
- `map(key)` only with a dominating `map.contains(key)` true fact: from the current
  short-circuit branch or an earlier ordered guard whose false branch terminates.
  Optional map get needs no presence fact. Unknown methods, arbitrary closures,
  raw Scala/eval and unprotected lookup are refused.
- Existing structured `map-contains`/`map-absent` guards; invariantRef guards
  default to reject as before. Every reject retains its errCode; succeed-empty
  terminates subsequent checks on predicate false.
- Raw expression bounds: 65,536 characters, 512 tokens, nesting 32, AST depth 64.
  The v1 decision profile does not gain numeric literals or member syntax; the
  additive explicit v2 profile below supports exact comparisons and members.
  Numeric arithmetic, statusTransition, structured exact predicates and
  collection-covered are available only in the explicit v3 profile below; v1/v2
  source vocabularies do not acquire them.

File input is strict UTF-8 JSON, non-symlink regular files, maximum 8 MiB per file
and combined capture. Duplicate keys (including escaped aliases), non-safe or
non-integer JSON numeric tokens, negative zero and excessive nesting fail.
Represent exact values as strings; the optional exact profiles below supply
static reversible conversion descriptors, not runtime codec certification.
Capture detects ordinary during-read file changes but is not a multi-file atomic
snapshot or an inter-process source lock.

BC `AdmittedSemanticProducts.fromFile/fromBytes/fromJson` independently parses
and checks these products, including source/predicate correspondence and lookup
safety. Its `compilerProvenanceVerified` stays false: only an external execution
receipt and matching actual bytes establish which compiler produced a file.
Readiness is always `static-contract-only`, `runnable: false`,
`runtimeBindingVerified: false`.

### Exact type/codec profiles and explicit decision v2

The same request/CLI now supports `exact-value-types@1` and
`exact-value-codecs@1`. Their payload schema versions are
`truthsrc.exact-value-types/v1` and `truthsrc.exact-value-codecs/v1`; capabilities
are the corresponding singleton `{id, version: "1"}`. Both use the same canonical
as the reference layout. Types require `reference-layout@1`; codecs require
`reference-layout@1` followed by `exact-value-types@1` in that order.

- Type roles: `canonical` and `exactTypeBinding` (`truthsrc.exact-type-binding/v1`).
  Binding exactly `{schemaVersion, types}`. The product payload is the complete
  **types array** at `/types`, not another `{types: ...}` wrapper.
- Codec roles: `canonical` and `exactCodecBinding`
  (`truthsrc.exact-codec-binding/v1`). Binding exactly `{schemaVersion, codecs}`.
  Payload is the complete **codecs array** at `/codecs`.
- Types contain `{domain, version, source, form, precision, scale, amountMember,
  unitMember, units}`. Forms: `decimal` (no members/units) or `unit-decimal`
  (exactly one decimal amount member plus one string unit member).
- Layout `record` form is `{form: "record", members: [qualifiedRef, ...]}`.
  Record/member dependencies and owner identity remain explicit. Exact profiles
  additionally compare canonical scalar `dataType` or complete ordered `fields`
  (`name`, `dataType`) and each actual member source pointer. Empty/ghost
  representations or changing a decimal member to Double fail.
- Domain, wire and PO type identities must all be declared, distinct and not
  shared between exact codecs. Their versions are pinned separately. Canonical
  declarations carry matching string `version`; a codec has its own string
  `id`/`version` and pinned `domainVersion`.
- Codec fields: `{domain, domainVersion, id, version, format, wire, po, source}`.
  Each representation is `{ref, version, amountMember, unitMember}`. Scalar
  representations are string types; unit records have two string members.
  Codec source must identify its whole input binding row.
- Formats: `fixed-decimal-text`, `minor-units-text`. Precision 1..38, scale
  0..precision. Text must use exactly that many fractional digits; no rounding,
  exponent, plus sign, leading zero or negative zero. Overflow fails. Unit/currency
  values must belong to the explicitly declared `units` array; no default unit,
  currency, NAV, fee or pricing formula exists in the compiler.

```js
import { encodeExact, decodeExact } from './lib/value-products/exact-codecs.mjs';
import { compareExact } from './lib/value-products/exact-types.mjs';
// type/codec are validated descriptors from the compilation result.
const wire = encodeExact(type, codec, value, 'wire'); // or target 'po'
const restored = decodeExact(type, codec, wire, 'wire');
const order = compareExact(type, value, otherValue); // refuses different units
```

The pure oracle uses BigInt coefficients only; it does not execute target codecs
or prove that a named codec is installed/registered. BC `ExactValues` independently
implements descriptor validation and the same exact conversion contract with
BigInt. Identity/version labels alone are never runtime credentials. Canonical
fixed-scale text roundtrips exactly; it is not a promise to accept every possible
historical decimal spelling or preserve a whole serialized receipt envelope.

`domain-decision@2` is explicit: payload `truthsrc.domain-decision/v2`, capability
`ordered-domain-decision@2`, semantic binding
`truthsrc.domain-semantic-binding/v2`, dependencies exactly layout@1 then
exact-value-types@1. It adds declared record member paths and exact decimal text
literals with `== != < <= > >=`. Comparisons need a specific admitted exact type:
same-type operands or one representable literal. Bare decimal fields, unrelated
nominal types and literal-only comparisons do not acquire permission merely
because some exact type is present. Unit-bearing comparisons verify record scale,
precision and declared units; comparing two unit records with different units
fails. v1 source syntax/dependencies remain unchanged; two decision versions in
one set are refused rather than silently selecting one.

`evaluateDecisions(command, valuesMap, layout, {types})` is a pure JS decision
oracle using qualified-reference Map keys, Maps for business map values and
plain objects for records; BC `DomainDecision.evaluate(command, values, layout,
exactTypes)` supplies its independent oracle. These do not mutate business state
or implement an application. Exact values are validated when consumed, preserving
ordered guard/short-circuit behavior. Static compilation still never sets runnable
or runtimeBindingVerified to true.

The independent logistics fixture is
[`test/fixtures/exact-products/files.json`](test/fixtures/exact-products/files.json):
unit-bearing Distance plus unit-free Ratio, with domain/wire/PO layouts and
ordered ReportLeg rules. Both CLIs use the same file manifest format. Financial
Money/scale-2 and shares/scale-6 cases in tests are explicitly authored conversion
oracles, **not bank-owner bindings or bank business acceptance**.

Schema registry additionally needs
[`schema/exact-values-v1.schema.json`](schema/exact-values-v1.schema.json), ID
`urn:truthsrc:exact-values:v1`. The original request/set schemas now include these
additive profiles; their v1 decision branch remains restricted. JSON Schema only
checks shape; source identity, cross-document coverage and representability are
checked by the compiler and independent consumer.

### Explicit finite guards v3

`domain-decision@3` uses payload `truthsrc.domain-decision/v3`, capability
`ordered-domain-decision@3`, semantic binding `truthsrc.domain-semantic-binding/v3`,
and exact ordered dependencies `[reference-layout@1, exact-value-types@1]`.
`domain-dependencies@3` and `domain-folds@3` have their corresponding v3 payload,
capability and binding versions. Dependencies require `[layout@1, decision@3,
exact-value-types@1]`; folds require `[layout@1, dependencies@3, exact-value-types@1]`.
Their payload shapes and value-production language remain the v2 complete
signature/slot/default/pre-event contract, not an expanded arbitrary expression API.

New canonical structured `when` forms have closed fields:

- `{form: "money-positive", amount: "param.value"}` checks a complete admitted
  exact nominal value against zero, using its declared scale and units. The
  historical form name does not require a financial type or supply Money/CNY.
- `{form: "money-sufficient", amount: "param.value", in: "balance"}` checks the
  declared direct state field: same exact nominal, or a String-keyed map of the
  same unit-decimal nominal keyed by the request's explicit unit. Missing map key
  is false; wrong nominal, unit, scale or precision is an error, not conversion.
- `{form: "collection-covered", map: "items", collection: "param.batch"}` checks
  every Sequence element against declared Map keys of the identical nominal type.
  Empty sequence is true; no arbitrary callback/closure is executed.

Structured operands are explicit declared param/state paths, optionally through
nominal members; they are not expressions or literal escape hatches. Positivity
and requested sufficiency values must retain the whole exact nominal type.

Canonical `statusTransition` requires explicit `ruleId`, `errCode`, `onFail`, plus
`from` (a nonempty String) and/or `notStatus` (a nonempty unique String array).
Both present means AND, not first-wins. It checks a declared String `state.status`.
Optional nonempty `toStatus` is retained in source but never mutates state; event
folds alone determine state evolution. No-precondition, wrong-shape, unknown-field
or missing identity/error/outcome declarations are refused. This explicit v3
contract is not a universal legacy status spelling adapter.

Finite invariant source adds left-associated `+`/`-`, before comparison. Integer
literals are signed-64 text (`{op:"integer", value:"1"}`); decimal literals keep
explicit fractional digits. Arithmetic uses identical signed-64 types, identical
admitted exact nominal types, or a representable exact decimal literal. Bare
Decimal, cross nominal, cross unit, overflow, rounding, multiply/divide, conversion
and arbitrary calls fail closed. Unit identity also survives arithmetic over
amount-member expressions. The original source/token/nesting/AST bounds remain;
status conjunctions are bounded to 62 clauses.

Typed IR adds `exact-positive` unary, `exact-sufficient`/`collection-covered` binary,
`integer` literal and `add`/`subtract` binary nodes. Complete canonical predicates,
ordered dependencies and on-false results are recomputed and compared to the
whole binding. No v1/v2 grammar or requirements silently expand.

Use `evaluateDecisions(command, values, layout, {types}, "3")` or BC
`DomainDecision.evaluate(command, values, layout, exact, "3")` for the finite pure
oracle. The v3 argument is explicit; the previous default remains v2. These do not
execute hosts, mutate state, prove runtime binding or generate application code.
The independent measurement example is
[`test/fixtures/guards-v3/files.json`](test/fixtures/guards-v3/files.json).
Register [`schema/domain-guards-v3.schema.json`](schema/domain-guards-v3.schema.json)
as `urn:truthsrc:domain-guards:v3` alongside the five previous offline schema IDs.
Schema is shape-only; the JS compiler and BC consumer enforce source/type closure.

### Complete dependency and pre-event fold profiles

The same explicit API/CLI supports these target-neutral static products:

| Product | Payload schema / capability | Binding role | Exact ordered dependencies |
|---|---|---|---|
| `domain-dependencies@1` | `truthsrc.domain-dependencies/v1` / `domain-dependencies@1` | `dependencyBinding`: `truthsrc.domain-dependency-binding/v1` | layout@1, decision@1 |
| `domain-folds@1` | `truthsrc.domain-folds/v1` / `domain-folds@1` | `foldBinding`: `truthsrc.domain-fold-binding/v1` | layout@1, dependencies@1, exact-value-types@1 |
| `domain-dependencies@2` | `truthsrc.domain-dependencies/v2` / `domain-dependencies@2` | `dependencyBinding`: `truthsrc.domain-dependency-binding/v2` | layout@1, decision@2, exact-value-types@1 |
| `domain-folds@2` | `truthsrc.domain-folds/v2` / `domain-folds@2` | `foldBinding`: `truthsrc.domain-fold-binding/v2` | layout@1, dependencies@2, exact-value-types@1 |

Both also require `canonical` with the same document as the layout. Binding
objects are exactly `{schemaVersion, dependencies}` and `{schemaVersion, folds}`;
their whole payload objects are assertions compared against source derivation,
not instructions trusted in place of canonical commands/events. The dependency
v1 profile does not silently accept decision-v2; select the explicit v2 profiles
and their v2 bindings above. Exact metadata is consumed by v2 event literals and
arithmetic, not merely listed as a requirement. Guard numeric arithmetic is v3-only;
decision-v2 keeps its already declared vocabulary.

- Dependency payload: `{commands, events, hosts}`. Each command preserves
  `{command, source, declaredSignature, usedDependencies, events}`. A signature
  parameter is `{ref, valueType, origin, source}`; its explicit origin must be
  `BUSINESS_INPUT` or `PROPAGATED`. Every canonical parameter stays in signature,
  including guard-only and unused parameters. Used dependencies are ordered,
  first-appearance-deduplicated reads: ordered decisions, event slots, then host
  input dependencies. These lists are not substitutes for each other.
- Every canonical aggregate/command/event/state field/parameter/payload slot
  requires exactly one matching context/name/owner/type/source layout declaration.
  This profile requires explicit aggregate context, `commands`, `events`,
  `stateFields`, command `parameters`/`produces`, and event `payloads`. The finite
  canonical type spellings are String/Boolean/Long/Int/Integer/Decimal,
  Option/List/Seq/Vector/Map brackets and declared nominal names. Conflicting
  type/dataType spellings or ghost fields fail. It is not a broad legacy spelling
  adapter or an implicit identifier/default injector.
- Each command's produced event has its complete ordered slots, each with
  `{slot, valueType, source, producer, dependencies}`. If `emissionBindings` is
  present, it must cover all produced events and all their slots; no missing-slot
  fallback to event `bindings`. Without it, event `{slot, expr}` bindings must
  cover each slot exactly once. An event without an explicit command producer is
  refused in this profile; external event producers need their own contract.
- Canonical `hostComputations` is an explicit array (including `[]`). A host
  descriptor has `{id, version, command, outputType, inputDependencies,
  stableIdentityContract, source}` in the product; canonical input omits only
  derived `source`. Its qualified id is a declared `port`, pinned to an actual
  canonical `/ports/i` name/version/outputType in the same command context.
  Stable identity contract is `{id, version, keys}`; keys are nonempty unique
  declared host inputs. Authored slot `{form:"host", id, version}` becomes a typed
  host value, never a fabricated command parameter. No implementation, clock or
  runtime stable-identity enforcement is certified by this descriptor.
- Finite value expressions are separate from decision grammar: typed direct
  references, literals, nominal record members, optional map get, and pinned host
  output. Authored paths are param/state on emission and state/event on replay;
  `state.map[event.key]` deliberately yields optional, not an unsafe raw lookup.
  Host and command inputs are forbidden on replay. Literal `{form:"literal",
  value}` is typed by the explicit target; `literal:text` handles scalar text,
  boolean and signed-64 integer text. Exact decimals require admitted nominal
  descriptors. No raw Scala, receipt alias, SYSTEM_NOW or arbitrary expression
  is treated as a magic runtime value.
- V2 value producers additionally accept authored `{form:"add"|"subtract",
  left, right}`, producing closed typed `{op:"add"|"subtract", left, right}`
  expressions. Each operand is parsed against the explicit target type and must
  be the same signed-64 integer or admitted exact nominal type. Recursive depth
  is bounded at 64. Integer and exact coefficients use BigInt with overflow and
  same-unit checks; there is no bare Decimal, cross-nominal arithmetic,
  multiplication/division, rounding or implicit unit conversion. V1 authored
  value grammar and dependencies remain unchanged. All v2 replay RHS still read
  the original pre-event snapshot.
- Fold payload: `{defaults, events}`. Every state field has an explicit canonical
  `default` carrier and product `{target, valueType, source, value}`. Each event
  retains its complete `foldAssignments`, producing ordered
  `{target, valueType, sourceOrdinal, source, update, dependencies}`. Targets must
  be unique. No first-wins or silent missing/extra row filtering.
- Updates are `set`, `put`, `remove`, `put-all`, `remove-all`, `money-apply`,
  `integer-apply`. Collection updates require map targets; `*-all` keys are a
  declared sequence. Arithmetic sign is exactly 1 or -1. Integer carriers are
  canonical signed-64 decimal **strings**, never JS Number; exact arithmetic uses
  BigInt coefficients, same nominal type and matching explicit units, rejecting
  scale/precision/overflow. `money-apply` is the established operator spelling,
  not a built-in Money/CNY/business policy.

`evaluateFolds(event, qualifiedValuesMap, layout, exactTypesArray)` is a pure JS
oracle; business maps here are JSON arrays of `{key,value}` (unique keys),
optional values are `{present: boolean, value}` (absent value is null), and records
are plain objects. Presence remains distinct even for nested Option[Option[T]].
This dataflow carrier is
not `evaluateDecisions`' business-Map carrier. It computes every RHS and update
base against the original input, then creates a new state map; no intermediate
assignment is visible to another RHS. BC `DomainFolds.evaluate` independently
uses immutable JSON values and returns Either diagnostics/result. Neither oracle
runs a host or application. `evaluateValue` accepts host outputs only as explicit
qualified inputs; it never executes a descriptor.

Independent inventory input:
[`test/fixtures/dataflow-products/files.json`](test/fixtures/dataflow-products/files.json).
It retains guard-only warehouse, explicit release-id host output, complete event
slots, optional old-label read alongside map removal, collection update and
integer/exact Ratio arithmetic. These are public contract fixtures, not bank
bindings or live business acceptance. Schema registry adds
[`schema/domain-dataflow-v1.schema.json`](schema/domain-dataflow-v1.schema.json),
ID `urn:truthsrc:domain-dataflow:v1`. Explicit v2 adds
[`schema/domain-dataflow-v2.schema.json`](schema/domain-dataflow-v2.schema.json),
ID `urn:truthsrc:domain-dataflow:v2`; register all five URNs locally, do not fetch.
The independent measurement input
[`test/fixtures/dataflow-v2/files.json`](test/fixtures/dataflow-v2/files.json)
combines a guard-only label, exact decision, exact/integer event production and
pre-event value arithmetic. Its bindings are independently authored expectations,
not compiler output; the BC resource comes from the actual compile-products CLI.

**Not yet delivered:** `planProductSet`/`generate-products`, six pure source
producers, external-event-producer contracts, assemblies, execution/runtime/artifact
product families and new-product file anchors. `compile-products` is not a code-generation
entry and cannot generate a bank application. These remain public P24/P25 work;
consumers supply their own business bindings/ports and business acceptance, not a
replacement compiler.

## Legacy admission contract

This opt-in public contract admits explicit data before a future producer call.
It does **not** enable versioned products in `truthsrc generate`: the legacy
`plan()`/`apply()` path rejects every opted-in manifest with
`PRODUCT_PLAN_UNSUPPORTED`, before loading canonical or importing a generator.
Existing producers retain their `products: {}` context.

## Supported identities

| Layer | Exact identity |
|---|---|
| Declaration schema | `truthsrc.product-requirements/v1` |
| Supplied envelope schema | `truthsrc.product-envelope/v1` |
| Opt-in manifest inputSchema | `truthsrc/v1.0` |
| Canonical product | `canonical`, version string `"1"`, payload `truthsrc/v1` |
| Static Saga product | `saga-contract`, version string `"1"`, payload `truthsrc.saga-ir/v1` |
| Static Saga capability | `{id: "saga-static-contract", version: "1"}` |
| Saga binding input | Exactly one complete `truthsrc.saga-binding/v1` document |

Context map keys are `canonical@1` and `saga-contract@1`. These versions are
independent. Plugin `manifest.version` must be an explicit nonempty string; it
identifies the plugin, not a certified release. Authored Saga definition versions,
codec versions and engine artifact/API pins never substitute for product or
capability versions. No ranges, automatic upgrade or inferred compatibility.

Canonical capabilities remain exactly `[]`. Saga requirements and envelopes must
both carry exactly the singleton static capability above. Unknown, missing,
repeated or wrong-version capabilities fail closed. An engine's `required`
capabilities inside a binding are **host obligations**, not verified runtime
capabilities, and cannot be copied into the product capability list.

The old manifest `products: string[]` vocabulary remains
`template`, `readmodels`, `stories`, `useCases`. It has no implicit mapping to the
new product identities.

## Explicit API

```js
import {
  admitProducts, validateDeclaredProducts,
} from './src/core/products.mjs';
import { compileSagas } from './lib/saga/compile.mjs';

// canonical and sagaBinding are explicit parsed documents supplied by the caller.
// For multiple input files, the caller must explicitly provide a complete binding
// document; admission neither finds files nor merges or filters binding families.
const requirement = {
  id: 'saga-contract', version: '1', payloadSchemaVersion: 'truthsrc.saga-ir/v1',
  capabilities: [{ id: 'saga-static-contract', version: '1' }],
};
const manifest = {
  name: 'my-producer', version: '1.0.0', inputSchema: 'truthsrc/v1.0',
  products: ['template'], artifactKinds: ['summary'], output: {},
  declaredProducts: {
    schemaVersion: 'truthsrc.product-requirements/v1', products: [requirement],
  },
};
const compiled = compileSagas(canonical, sagaBinding);
if (compiled.diagnostics.length) {
  // Report the existing static compiler diagnostics; do not invent an IR.
} else {
  const result = admitProducts({
    manifest, canonical, bindings: [sagaBinding], options: {},
    products: [{
      schemaVersion: 'truthsrc.product-envelope/v1', ...requirement,
      source: { document: 'canonical', pointer: '' }, payload: compiled.ir,
    }],
  });
  // Admission independently recomputes the live complete IR. The candidate's
  // digest, readiness and capabilities are not accepted as authority.
  if (!result.diagnostics.length) {
    const admitted = result.context.products['saga-contract@1'];
  }
}
```

The initialized APIs are synchronous. `validateDeclaredProducts(manifest)` returns
frozen `{requirements, diagnostics}`. No own `declaredProducts` means null
requirements and no new diagnostics; a present null/malformed declaration is not
legacy fallback. It checks supported requirements, **not achieved capabilities**
or the whole legacy manifest. `loadManifest()` retains its existing validation.

`admitProducts(request)` requires exactly five explicit fields: `manifest`,
`canonical`, `bindings`, `products`, `options`. No default bindings, schema,
validator, registry, files, cache, plugin or target lookup is accepted. Options
remain opaque plain-JSON transport, not plugin-option semantic validation.

On success, the recursively frozen `{context, diagnostics: []}` contains detached
manifest/canonical/bindings/options and a null-prototype product map. The map has
only declared, validated products, deterministically ordered by ID. Envelopes are
reconstructed from checked identities and live results. Any failure returns
`{context: null, diagnostics}`; there is no partially admitted prefix.

### Canonical-only compatibility

A canonical declaration uses `id: 'canonical'`, `version: '1'`,
`payloadSchemaVersion: 'truthsrc/v1'`, `capabilities: []`, and an envelope payload
identical to the explicit canonical. With no Saga product declared, bindings must
remain an explicit empty array and nested Saga business payloads stay opaque.
Merely carrying canonical Sagas does not opt into static Saga validation.

The new API requires full canonical transport: `schemaVersion: 'truthsrc/v1'`,
workshop string, and explicit sessions/aggregates/valueObjects/readModels/stories/
domainServices arrays. Known optional collections must have the expected
containers. Unknown authored extras are not stripped, normalized or re-keyed.
The legacy canonical loader still accepts its existing sparse fixtures.

### Static Saga semantics

A valid Saga declaration requires exactly one whole binding document. Zero or
multiple documents fail; the API neither invents an empty binding nor cherry-picks
one Saga. An explicitly empty binding document may close an absent/empty canonical
Saga family, producing the original compiler's empty IR without inventing a Saga.
A binding row without a definition is an orphan; every definition needs a binding.

The product uses the **same complete checker** as `compileSagas`, not a weaker
schema-only test. This includes exact definition versions, aggregate-owned
references, nominal types and bounded type graphs, resource addressing, TCC phase
coverage and availability, confirmation fields, triggers and all result mappings.
A bad member rejects the complete family.

The candidate must equal the entire ordered JSON serialization of the live
`truthsrc.saga-ir/v1`: every field, array order, key order, digest and sourceMap
participates. Reusing an old digest, deleting fields, adding certificates or
changing source hints cannot authorize a stale candidate. The admitted payload
is the detached, recursively frozen **live compiler output**.

`readiness: 'contract-only'` is preserved. Named codecs, implementation modules,
ports, receipts and engine capabilities are declarations, not checked execution
artifacts. Money type admission does not prove decimal conversion, conservation
or funds behavior. Integer quantity admission checks type/bound declarations,
not actual stock sufficiency or arithmetic. Guards, folds, permissions, runtime
fencing and recovery are not certified.

## Source linkage

Both envelopes retain the closed source value
`{document: 'canonical', pointer: ''}`. For `saga-contract@1`, the fixed additional
input linkage is the whole `context.bindings[0]` document. The complete IR keeps its
native `canonical` / singular `binding` source identities:

- IR `binding:/sagas/2/version` resolves to context `bindings:/0/sagas/2/version`.
- IR sourceMap keys, original source ordinals, digest and schema remain unchanged.
- File/atom/path/location values are supplied hints, not authenticated provenance.
  An ancestor's location is its supplied anchor, never an invented child line.

This is explicit document linkage, not a physical-file certificate or complete
semantic dependency graph. Snapshot `/atoms/<i>/doc` pointers remain capture
locations; no `sourceVerified` or generated-code anchors are manufactured.

## Safety and diagnostics

The whole raw request is copied by descriptors before any destructuring. Getters
and Proxy traps are not executed. Only detached data is frozen; caller objects
stay unchanged. Key order and null prototypes are retained. Cycles, accessors,
functions, undefined, nonfinite numbers, sparse arrays, symbols, hidden properties,
nonplain containers and nesting beyond the immutable helper's 128-container bound
are refused. Frozen Map/Set is not immutable JSON transport. The same bounded
copy protects trusted schema constants and the complete output IR/sourceMap.

Diagnostics contain `{code, message, source: {document, pointer}}`. Public document
names are request/manifest/canonical/products/bindings, with RFC 6901 pointers.
Compiler `SAGA_*` diagnostics additionally retain file/atom/path/location hints
and related locations. Only their `binding` document and pointer are translated
to `bindings` and `/0...`; hint paths and the payload's sourceMap are not rewritten.
Results sort deterministically by document, pointer, then code. Unsafe transport
returns one first-error diagnostic; contract checks may report multiple errors.

| Codes | Refusal |
|---|---|
| `PRODUCT_DATA` | Unsafe/non-JSON descriptor, cycle or nesting |
| `PRODUCT_SHAPE`, `PRODUCT_FIELD_REQUIRED`, `PRODUCT_FIELD_UNKNOWN` | Closed contract or explicit fields |
| `PRODUCT_MANIFEST_SHAPE`, `PRODUCT_MANIFEST_ID`, `PRODUCT_MANIFEST_VERSION`, `PRODUCT_INPUT_SCHEMA`, `PRODUCT_DECLARATION_REQUIRED` | Missing/invalid opt-in identity |
| `PRODUCT_REQUIREMENTS_VERSION`, `PRODUCT_REQUIREMENTS_SHAPE` | Requirements schema or array |
| `PRODUCT_UNKNOWN`, `PRODUCT_VERSION`, `PRODUCT_PAYLOAD_SCHEMA`, `PRODUCT_ENVELOPE_VERSION` | Product/schema identity or exact version |
| `PRODUCT_DUPLICATE`, `PRODUCT_MISSING`, `PRODUCT_UNDECLARED`, `PRODUCT_REQUIREMENT_MISMATCH`, `PRODUCT_SUPPLY_SHAPE` | Declaration/supply mismatch |
| `PRODUCT_CANONICAL_VERSION`, `PRODUCT_CANONICAL_SHAPE`, `PRODUCT_PAYLOAD_MISMATCH`, `PRODUCT_SOURCE_MISMATCH` | Canonical transport or complete candidate linkage |
| `PRODUCT_CAPABILITY_SHAPE`, `PRODUCT_CAPABILITY_DUPLICATE`, `PRODUCT_CAPABILITY_UNSUPPORTED`, `PRODUCT_CAPABILITY_MISSING`, `PRODUCT_CAPABILITY_VERSION` | Capability shape, support, presence or exact version |
| `PRODUCT_BINDINGS_SHAPE`, `PRODUCT_BINDINGS_UNSUPPORTED`, `PRODUCT_BINDINGS_COUNT`, `PRODUCT_OPTIONS_SHAPE` | Binding permission/count or transport |
| `SAGA_*` | Existing complete compiler diagnostic; binding pointer mapped to `/0...` |
| `PRODUCT_PLAN_UNSUPPORTED` | Legacy generation cannot deliver new declared products |

Execution/runtime binding schemas, missing fields and unknown binding keys are
refused by the Saga compiler (for example `SAGA_SCHEMA` at
`bindings:/0/schemaVersion`); no automatic conversion is attempted. Internal
schema audit/programming defects are not disguised as successful admission.

## Purity and compatibility boundary

`lib/saga/compile-pure.mjs` holds the original schema-bound checker;
`lib/saga/compile.mjs` preserves the old schema-loading facade and synchronous
`compileSagas` behavior. Its omitted-binding default and detached mutable result
contract remain unchanged. No second checker or schema mirror is maintained.

`lib/saga/product.mjs` loads the sole fixed package JSON schema as a module
 dependency, using dynamic import options for both assertions and attributes.
Module dependency initialization may await; initialized admission calls do not.
`src/core/product-declarations.mjs` is lightweight so manifest/legacy CLI loading
does not initialize the Saga product dependency.

Source and JSON module loading are loader I/O, not request-time filesystem access.
Worker initialization and calls contain no explicit fs, process/argv, clock,
random, subprocess, network, target, cache or plugin access. Tests preload the
complete source graph **and JSON bytes** as data URLs before denying effects and
initializing the worker. Deterministic SHA-256 computation is permitted. Node
loader warnings must not be suppressed or confused with worker logging.

This boundary is not a sandbox against malicious same-process module-cache or
builtin tampering, a multi-file capture transaction or an inter-process lock.

## Remaining work

Execution/runtime products, complete semantic dependency maps, guard/fold/value/
authority admission, plugin mutation/undeclared-access controls, X01-B pure
producers, X01-C admitted dispatch and X01-D integration remain open. Complete
X01-A and bank application/runtime qualification are **not** implied.

P20 returned its earlier shared consumption window; this contract no longer
assumes that old pause is active. New edits still require their own approved scope
and fresh test receipts. Historical green receipts certify their original bytes,
not later changes. Central CODEGEN integration is not part of this slice.
