# Saga runtime binding v1 — lowered contract, not runnable

最后更新: 2026-10-22

## #196 additive exact-pins v2 and typed input admission

`lowerSagaRuntimeBindingV2({ canonical, binding, runtimeBinding, ir? })` is an
explicit new function emitting `truthsrc.saga-runtime-contract/v2`. **Input
versions are unchanged**: it requires the existing explicit
`truthsrc.saga-runtime-binding/v1` document and calls the actual `compileSagas`
on the original canonical/binding inputs. It does not rewrite versions, infer
pins, coerce types, introduce another truth source, or use a v1 permutation
fallback. Errors still return both `ir: null` and `plan: null`.

Each v2 Saga additionally contains:

```text
runtimeBinding: { target: <exact original target>, saga: <exact original mapping> }
```

The mapping retains `sagaId`, original string `definitionVersion`, independent
positive-Int `runtimeVersion`, args `{id, version, runtimeVersion}`, and every
receipt `{stepId, phase, id, version, runtimeVersion}`. The receipt **ARRAY order
is preserved**, not phase-sorted. Original target capability array order is also
preserved. The same pin set in a different order yields a different accurate
`definitionDigest`, covering stable JSON of `{definition, binding,
runtimeBinding}`. Digest equality establishes semantic-material consistency,
**not source/compiler authentication**. Object key order is irrelevant; array
order is not. No digest is mechanically relabelled solely to change the output
schema. With the same original target/material, v1 and v2 digests remain equal.

All v2 returned JSON is detached: input mutation cannot change `ir` or `plan`,
`ir` and `plan` do not share JSON aliases, and full-contract/projection/material
subobjects do not share mutable aliases. Outputs remain plain JSON, not frozen
runtime objects; caller mutation of one returned package does not certify the
mutated package. Legacy `lowerSagaRuntimeBinding` retains its v1 output shape,
behavior, digest and historical `ir === plan` identity.

The independent codegen API is
`net.imadz.meta.execution.AdmittedSagaInput.fromJson(String, SystemMetadata)` or
`fromBytes(Array[Byte], SystemMetadata)`. It strictly accepts **only v2** through
the existing shared syntax/duplicate-key scanner and UTF-8/8 MiB/128-depth
boundary. It decodes all full-contract fields, validates exact ID/positive-Int
pins, uniqueness, completeness and target, checks every lowered projection and
one exact digest (no permutations), and runs the existing base/typed harness.
The private-constructor non-case-class token retains immutable typed
`PinnedSagaExecution(execution, pins)` values; `SagaRuntimePins.receiptCodecs` is
an ordered `Vector[ReceiptCodecPin]`. It stores no raw JSON, source byte arrays,
or caller base reference. There is no `apply`, `copy`, naked-AST, flags-only or
digest-only token constructor. Typed contract/pin copies are not tokens. Malicious
reflection is not in scope; the caller base is validated at admission, not given
a permanent mutation/provenance guarantee.

`SagaIrAdapter` v1 methods and the independent bare typed harness remain legacy
contract checks, **not generator admission**. The historical six-order digest
reconstruction stays confined to the v1 single-step route. A v1 package, even
with a valid digest/flags, cannot create the new token. Neither can v2 with
missing exact pins. The token is actually callable now, but **no public
CLI/CodegenMain/builder/dispatch wiring is added in this batch**. Future dispatch
must require this token rather than a copyable `ExecutionSystemMetadata`.
Public/runtime verification is **SKIP**, not import-and-call verification.

All existing single-step/group/dataflow limits and upstream blocked flags remain,
including `scala-ast-adapter-missing`; `runnable=false` and
`runtimeBindingVerified=false` are not lifted. Real transfer resources and
receipt semantics are not erased. No runtime sources, truth tree or generated
applications are changed.

Engineering evidence for this batch lives at
`backkend-codegen/.rounds/s6-exact-pins-owned-20261022-d6c4be977b4c/`.
Its producer replays the prior independent one-resource legal inputs through
actual Node compilation/lowering for original, reversed and rotated receipt
orders, a second explicitly different receipt pin set, Unicode, scalar forward
types and original target order. Fixtures are
derived test resources, not authored lowered expectations or compiler
provenance certificates. Directed tests are
`test/saga-runtime-binding-v2.test.mjs` plus the unchanged old 123 suite, and
`AdmittedSagaInputSpec` plus the unchanged old 66 Scala tests. Actual Node used
here is **v18.16.0; Node 20 is not verified**. JDK 11 / sbt 1.11.7 use owned
isolated boot, server off and explicit no-Git pin/trap. Failed attempts remain
in evidence; rerun counts are not summed into passing-test counts.


This gate emits pure JSON adapter data. It does not emit Scala AST, construct
`StrictSagaDefinition`, invoke ports, certify public/internal import calls, or
validate a running transaction. `runnable` and `runtimeBindingVerified` remain
`false`; `strict-scala` remains blocked even when engineering tests are green.

## Compiler closure is authoritative

`lowerSagaRuntimeBinding({ canonical, binding, runtimeBinding, ir? })` calls the
actual `compileSagas(canonical, binding)` with the original, unchanged inputs.
There is no version sentinel, private coercion, input rewrite, or replacement IR
digest. Optional `ir` must equal the **entire actual compiler output** under stable
JSON key ordering, including all nested fields, readiness, digest and sourceMap.
Missing/extra fields, stale sourceMap, forged digest, and certification flags fail.
Every error returns both `ir: null` and `plan: null`, never partial Saga plans.
Inputs must be plain JSON data; getters/proxies/callbacks are rejected without
invocation. No default binding, inferred codec, or empty-document success exists.

The atom header boundary is broader than the current Saga compiler schema. This
gate does not extend the compiler: currently business definition/codec versions
must satisfy its bounded ID-string schema (`[A-Za-z][A-Za-z0-9_-]*`, max 128).
Numbers, numeric-leading strings such as `"1"`, blank/space-padded versions and
other strings outside that schema are diagnosed, not made valid by rewriting.
Runtime mappings use exact original values/types; no parseInt, trim, prefix
stripping, or compatible-version fallback is used.

## Explicit unpublished candidate target

The required target is an explicit **unpublished placeholder candidate**, not a
released or locally verified artifact:

```json
{
  "artifact": "net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT",
  "artifactStatus": "unpublished-candidate",
  "apiMode": "strict",
  "definitionApi": "net.imadz.infra.saga.strict.StrictSagaDefinition",
  "coordinatorApi": "net.imadz.infra.saga.strict.StrictSagaCoordinator",
  "executionMode": "static-serial-allTCC",
  "capabilities": [
    "positive-int-definition-version", "static-participants", "serial-all-tcc",
    "fresh-canonical-args", "pinned-args-codec", "pinned-phase-receipt-codecs",
    "minor-unit-string-money"
  ]
}
```

This coordinate only names the intended lowering contract; existence,
resolution and binary API compatibility are unverified. It is not an automatic
release selection and is not built or published by this gate. The technical
binding's engine artifact/apiMode must match this explicit target. Released
`net.imadz:saga-core:0.2` does **not** supply this new strict API and cannot be
selected as falsely compatible. Existing authored fixtures naming 0.2 stay
contract-valid under the compiler but are runtime-binding blocked.

## Independent definition and codec mappings

Each Saga entry requires exact `sagaId` and `definitionVersion`, plus independent
positive Scala Int `runtimeVersion` (1 through 2147483647). Args codec mapping
requires `{ id, version, runtimeVersion }`. Every declared command step/phase
requires a receipt row `{ stepId, phase, id, version, runtimeVersion }`, including
phases with empty outputs. No runtime version defaults to 1 or derives from the
business string or another pin.

Args id/version must exactly equal `binding.codec`. Receipt version must exactly
equal that step/phase's `binding.steps[].phases[].receipt.version`. The current
technical receipt declaration has no codec ID: the independently explicit receipt
codec ID is preserved as declared, never inferred from `receipt.mapper`. A mapper
is not a codec implementation or evidence of compatibility. Rows cannot be
missing, duplicated, orphaned, or contain unknown fields.

Lowered args and each phase expose both:

- `contractCodec: { id, version: string }` — retained business pin;
- `runtimeCodec: { id, version: Int }` — actual Scala `CodecPin` shape, using the
  independent explicit runtimeVersion.

`runtimeIdentity` uses `{ name: sagaId, version: Int }`. `definitionDigest` is
`sha256:` followed by 64 lowercase hex digits, matching the current local strict
Scala API's accepted format. Its hash covers stable JSON of the full definition,
technical binding, target and explicit Saga runtime mapping. It is **not** the
compiler IR digest, Scala planDigest, argsDigest, a runtime certificate, or proof
that a codec/port implementation exists. Provenance/anchors are excluded from this
semantic fingerprint but remain mandatory in optional IR closure equality.

## Honest first-gate capability boundary

The current lowering is **single-step only**: one dependency-free group, one step
in that group, static participants, admission maxInFlight 1, all three command TCC
phases, one attempt/no backoff/equal phase and query timeout, and exact
minor-unit-string Money. Fresh canonical args and transaction identity resolve
command inputs. Named trigger/completion/confirmation/query/idempotency mappings
and resource addressing remain data, not invoked implementations.

The actual two-account money-transfer fixture remains intact and contract-valid,
but has concurrent same-group steps, prior receipt-slot dataflow and unsupported
resilience, as well as the legacy artifact pin. It yields no lowered plan. The
positive test is an independent one-resource synthetic contract, **not** a
money-transfer example with its second participant or reservation slot deleted.
Even moving both real steps to compiler-valid serial barrier groups remains
blocked: the next implementation needs real serial-group/dataflow AST and a
receipt-aware host adapter, not erased group or slot semantics in this gate.

Explicit rejection covers dependent/barrier groups, concurrent admission,
durable-reference/dynamic manifests, collections/manifest expansion, command and
completion receipt-slot dataflow, all-none/read-only phases and unsupported Money
encoding. Unknown/missing schema keys and capability declarations are rejected by
the runtime document gate and unchanged compiler admission/semantic/schema gate.

Even successful lowered output retains these blocked obligations:

- strict Scala AST adapter and runnable wiring;
- unpublished artifact availability/API verification;
- real phase ports and durable participant receipts;
- args/receipt codec implementations and canonical encoding;
- host total deadline, admission and business invariant enforcement;
- all required host safety capabilities, including durable decisions,
  reconciliation, authorized manual evidence and cancellation fencing.

`validateSagaRuntimeBinding` reports only engineering document validity and never
publishes a plan. Directed regression command (not runtime certification):

```bash
node --test test/saga-runtime-binding.test.mjs
```

## Additive v3 compatibility — singleton serial barriers and receipt sources

Last updated: 2026-10-22. Approved #197, independent Node engineering sub-batch;
no Scala/runtime, generator entrypoint, CLI routing or shared schema change.

`lowerSagaRuntimeBinding` and `lowerSagaRuntimeBindingV2` keep their v1 input
document, seven exact target capabilities, single-step feature restrictions,
full JSON shapes, digests and failure behavior. They do **not** acquire v3 support.
`validateSagaRuntimeBinding` remains the original v1 validator. The single-step
and receipt-dataflow restrictions above still describe these legacy exports.

The independent export is:

```js
lowerSagaRuntimeBindingV3({ canonical, binding, runtimeBinding, ir? })
// { ir: detachedPlainJSON | null, plan: detachedPlainJSON | null, diagnostics }
```

It requires an explicit new mapping document. No version autodetection, v1
fallback, business-version parsing/coercion or compatible-version selection:

```js
{
  schemaVersion: 'truthsrc.saga-runtime-binding/v2',
  target: {
    artifact: 'net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT',
    artifactStatus: 'unpublished-candidate', apiMode: 'strict',
    definitionApi: 'net.imadz.infra.saga.strict.StrictSagaDefinition',
    coordinatorApi: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
    executionMode: 'static-serial-allTCC',
    capabilities: [
      'positive-int-definition-version', 'static-participants', 'serial-all-tcc',
      'fresh-canonical-args', 'pinned-args-codec', 'pinned-phase-receipt-codecs',
      'minor-unit-string-money', 'singleton-serial-barriers',
      'confirmed-receipt-context', 'fresh-receipt-decode'
    ]
  },
  sagas: [{
    sagaId: 'money-transfer', definitionVersion: 'v2', runtimeVersion: 2,
    argsCodec: { id: 'ArgsCodec', version: 'codec-v1', runtimeVersion: 1 },
    receiptCodecs: [
      // Every declared command step/phase requires exactly one explicit row:
      // { stepId, phase, id, version, runtimeVersion }
    ]
  }]
}
```

All object fields remain exact required/allowed fields; unknown/missing fields,
duplicate/orphan mappings, hostile non-JSON data, proxies, accessors, callbacks,
cycles, sparse arrays and invalid pins remain failclosed. All runtime versions
are independently explicit positive Scala Ints. Only this new document permits
up to **3072 receipt rows** (1024 singleton steps × three command phases); legacy
v1 keeps its original 1024-row limit. Other mapping-array bounds remain 1024.

The three new capabilities live solely in this independent runtime mapping gate;
the unchanged technical-binding/compiler capability schema is **not** broadened.
The target coordinate is still an unpublished placeholder. These capabilities
are pending adapter contracts, not artifact/API certification; released `0.2`
must not be selected or described as supplying the new APIs.

### Independent v3 feature gate and plan

The **unchanged live `compileSagas(canonical, binding)` full closure** runs on the
original inputs. Optional IR must match its entire stable JSON (including digest,
sourceMap and retained fields); flags/digests confer no authority. v3 then
independently rechecks the admitted definition/binding, not compiler flags:

- 1..1024 unique positive numeric groups, exactly one static command step per
  group, explicit transitive dependency on the preceding numeric barrier;
- no same-group concurrency, arbitrary DAG frontier serialization, dynamic or
  collection/manifest expansion; maxInFlight exactly 1;
- all three command TCC phases, exact minor-unit-string Money;
- one attempt, zero backoff, equal phase/query deadlines;
- resource-typed command slots pinned to that participant's exact arg/type,
  never another resource, including same-canonical-type aliases.

Prepare and Commit schedules and participant-plan projection follow **numeric
singleton group order**, never `payload.steps` or technical step array order.
Compensate is reverse numeric barrier order. Original definition/binding arrays
remain unaltered in the retained contract and digest.

A lowered command input has exactly one of these typed source shapes:

```js
{ slot, type, source: { kind: 'transaction-id' } }
{ slot, type, source: { kind: 'args', slot: argumentSlot } }
{ slot, type, source: { kind: 'receipt-field', stepId, phase, slot: outputSlot } }
```

Receipt inputs require an existing exact typed producer output. Prepare can read
only an ancestor group's Prepare output; Commit can read any Prepare output after
the global durable CommitDecision, or an ancestor group's Commit output;
Compensate can read only its **own Prepare** output. Forward/tentative reads,
self/peer Commit, cross-step compensation and unknown/wrong-type outputs fail.
**Completion `step:` refs still fail**: completion receipt delivery is an
unimplemented host adapter obligation. Completions using txid remain unchanged.

### Exact v3 output and independent example

Output `schemaVersion` is `truthsrc.saga-runtime-contract/v3`. The full v2 field
shape is retained, with numeric-barrier-derived schedules and receipt-field
sources. `ir`, `plan` and repeated projection fields are detached plain JSON.
Every Saga retains exact `runtimeBinding: { target, saga }` and:

```js
definitionDigest = 'sha256:' + sha256(stableKeyJSON({
  definition, binding, runtimeBinding: { target, saga }
}))
```

Hash the material **once**, never the projected plan or a second digest wrapper.
Stable JSON sorts object keys only. Target capability and receipt mapping arrays
retain exact input order, and order changes change the digest; no permutation
normalization or fallback. Full compiler IR closure equality remains unchanged.
All existing `blocked`, `readiness: 'lowered-contract-only'`,
`runtimeBindingVerified: false`, and `runnable: false` obligations remain intact.

[Independent serial transfer example](example/saga-money-transfer-serial/README.md)
keeps ID `money-transfer` in a separate tree, explicitly declares business v2,
technical binding v2 and independent runtime Int 2. It preserves both
`CreditBalance` participants (`args:from`, `args:to`), two exact addresses, all six
phases, own Prepare reservation refs and Commit receiptId outputs. Source group 1
is singleton; target group 2 is singleton and depends on `[1]`. Its new-version
one-attempt/no-backoff/equal-timeout restrictions are authored, not retrofitted
onto the untouched original concurrent/retrying v1 tree. No fictitious
cross-account receipt edge is introduced: independent synthetic engineering
cases test cross-step receipt availability. Provenance records the present design
in accepted authored fields, not fictional old notes or execution history.

Directed engineering commands (Node 18.16.0 used; Node 20 not verified):

```sh
node --test test/saga-runtime-binding.test.mjs test/saga-runtime-binding-v2.test.mjs test/saga-runtime-binding-v3.test.mjs
node bin/truthsrc.js validate --tree example/saga-money-transfer-serial/tree
node bin/truthsrc.js roundtrip --tree example/saga-money-transfer-serial/tree
```

These establish Node lowering and tree fidelity only. They do not connect a CLI,
Scala AST adapter, generated app, real runtime receipt context, codecs/ports,
published artifact or end-to-end business execution.
