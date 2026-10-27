# Independent serial money-transfer contract

Last updated: 2026-10-27

This is a **new v2 design under approved #197**, derived from the domain tree in
`../saga-money-transfer/`. It is not a historical workshop capture, observed
transfer, generated application or runnable runtime certification. Design
provenance is recorded in the Saga's authored `purpose` and the invocation
product's description, using fields accepted by the unchanged compiler. No
historical note, origin or new/densified sequence has been invented.

The original example stays unchanged: business v1, two concurrent steps in group
1, maxInFlight 2, three attempts, 100 ms backoff and distinct phase/query timeouts.
This independent tree keeps Saga ID `money-transfer` and explicitly declares
business version **v2**; `bindings.json` pins v2. `runtime-binding.json` independently
maps it to the integer **2**, without parsing/coercing the business version.

## Incoming-credit positive guard (P22, 2026-10-27)

`RecordIncomingCredits` now reuses the existing `IR-CB-RESERVE-003` positive
amount rule after its terminal and live-map guards. A new transaction carrying
parseable zero or negative minor units rejects with `60004`; it must not create
an incoming credit that a later Commit could book as a balance reduction.
Existing terminal `60011`/`60012` and live-repeat `60007` priorities remain intact.
A rejected transaction without durable facts can be corrected to a positive
amount and retried; this is not a cancel-before-Prepare tombstone.

This reuses `MoneyOps.isPositive`, not new format, null, precision or currency
validation. Existing invalid-numeric exception behavior and historical journal
values are not repaired. Host production code, receipt codecs and Saga definition
are unchanged. P22 verification is tracked separately: real command rejection,
same-journal participant recovery and corrected transactions, real Host outcomes,
and explicitly synthetic rule precedence. Basic tree gates do not certify these
runtime properties, and no P22 acceptance is claimed by this documentation alone.

## Prepare terminal barrier (P21, 2026-10-27)

The current tree adds two leading guards to both `ReserveFunds` and
`RecordIncomingCredits`: an existing committed marker rejects with `60011`, and
an existing compensated marker rejects with `60012`. These execute before the
original live-map idempotency and amount checks. An already terminal txid cannot
reopen its reservation or incoming credit through these aggregate commands.
Marker presence is sufficient even for contradictory or unavailable values;
committed has deterministic priority when both terminal maps contain the txid.

This does not add an amount/identity-matching receipt, role-alias discrimination,
cancel-before-Prepare tombstone or production concurrency/fencing contract. The
strict Saga plan/digest and existing P19/P20 Host observation/receipt codecs are
unchanged. The P21 emitted test suite separates real commands and participant
same-journal recovery from synthetic rule-priority checks. Current application
verification belongs to the P21 execution receipts, not to this tree's basic
validate/roundtrip green result.

The sections below retain the original engineering batch history. In particular,
old placeholder/readiness or not-yet-wired descriptions are not an assertion that
the later P15–P21 generated application evidence did not occur.

## Exact retained business shape

- `source` and `target` are both `CreditBalance` participants, addressed by exact
  `args:from` and `args:to` AccountId slots, with distinct original resolvers.
- Source singleton group 1 has no dependencies; target singleton group 2 explicitly
  depends on `[1]`. Admission maxInFlight is 1.
- All six original command phases, confirmation/query/idempotency declarations,
  Prepare `reservation` outputs, Commit `receiptId` outputs, and Commit/Compensate
  references to each step's **own Prepare reservation** are unchanged.
- Prepare/Commit plan order is source then target; Compensate is target then source.
- All five original completions use only transaction ID and are retained.
- v2 explicitly limits resilience to **one attempt, no backoff, equal 1000 ms
  phase/query timeouts**, with the original 10000 ms total deadline retained as an
  unverified host obligation. These are deliberate new-version restrictions,
  not normalization or silent weakening of v1.

All unchanged domain atoms were copied byte-for-byte. Only the new Saga and
invocation products were transformed using `parseDoc` / `emitDoc`; no canonical
file was edited or added. The copied invocation pins business v2/plan-v2 but no
execution binding, CLI generation path or host adapter is connected by this batch.

## Independent v3 lowering boundary

Use the library export `lowerSagaRuntimeBindingV3({ canonical, binding,
runtimeBinding, ir? })`. Compile the new tree in memory using the existing
`compileTree`; `canonical` is derived, never a handwritten source.

The input mapping schema is `truthsrc.saga-runtime-binding/v2`. Its target retains
the explicit `net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT` **unpublished
placeholder** and adds the required lowering capabilities
`singleton-serial-barriers`, `confirmed-receipt-context`, `fresh-receipt-decode`.
These are **pending target contracts**, not proof that any resolved binary exposes
those APIs. The technical engine's existing safety capability schema is unchanged.
Do not substitute released `0.2` or claim artifact/runtime compatibility.

Output schema is `truthsrc.saga-runtime-contract/v3`. A phase receipt input is
exactly `{ slot, type, source: { kind: 'receipt-field', stepId, phase, slot } }`,
never an args slot inferred by slicing the `step:` prefix. The gate supports
1..1024 static singleton numeric barrier groups, requiring transitive predecessor
dependencies. Plan order follows numeric groups, not the `steps` array. The full
original compiler closure and independent v3 feature checks must both pass.

The transfer does **not** invent cross-account receipt edges. Cross-step receipt
positive/negative cases belong to an independent synthetic engineering fixture in
`test/saga-runtime-binding-v3.test.mjs`. Completion receipt reads remain blocked
because the host completion adapter is not connected.

The exact definition digest for this example is
`sha256:3a586c81b1a9af9a2cadfdc66306bc06ce063c1b37989985b5568c88fed9971d`.
(P4 state deepening + receipt re-cut, 2026-10-23: the aggregate gained the
golden-master four-field money state with real fold assignments and structured
guards; the `ReservationId` participant-handle type was retired by user ruling —
the transaction identity addresses every phase, no step-receipt reads remain,
and the confirmation facts are `(txid, amount)` for prepare / `(txid)` for
commit and compensate. Receipt shape is definition material, so the digest
advanced from the P1 baseline `16c3bf7a…`.)
It hashes stable-key JSON of `{ definition, binding, runtimeBinding: { target,
saga } }` once. All six receipt mapping rows and target capability arrays retain
their exact authored order; there is no sorting or permutation fallback. Mapping
order is source Prepare/Commit/Compensate, then target Prepare/Commit/Compensate.

All readiness/blocked obligations are retained: `lowered-contract-only`,
`runtimeBindingVerified: false`, `runnable: false`. Runtime receipt-context work,
Scala AST/generation wiring, real ports/codecs/receipts, publication and business
execution remain outside this Node engineering example.

## Engineering checks

Run from the repository root, using an available Node executable:

```sh
node --test test/saga-runtime-binding.test.mjs test/saga-runtime-binding-v2.test.mjs test/saga-runtime-binding-v3.test.mjs
node bin/truthsrc.js validate --tree example/saga-money-transfer-serial/tree
node bin/truthsrc.js roundtrip --tree example/saga-money-transfer-serial/tree
```

This batch uses Node **18.16.0**; Node 20 was not tested or installed. Tree
validate/roundtrip establish product transport fidelity, not Saga execution,
compiler/runtime certification or end-to-end money transfer.
