// Mandatory semantic families are never removed to make a targeted run appear complete.
const groups = Object.freeze({
  A: ['VERSION', 'TCC', 'RECEIPT', 'ROLE', 'SUPPLY', 'CAPACITY', 'CARRY', 'POLICY', 'OWNERSHIP', 'NAMING', 'MODULE', 'WIRE'],
  B: ['FIVE-RESULTS', 'PREPARE-REJECT', 'AFTER-COMMIT', 'CANCEL-FENCE', 'SAFE-ABSENCE', 'REPLAY-INERT', 'AUTHORIZATION', 'BOUNDED-RECONCILE', 'STALE-CALLBACK', 'CONFLICTING-INPUT'],
  C: ['OFFER-IDEMPOTENCE', 'OFFER-CONFLICT/GAP', 'BACKPRESSURE', 'MANIFEST-FREEZE', 'COUNT-WAIT/EOF', 'COMPATIBILITY/HARD-MIN', 'QUEUED', 'ITEM-CONSERVATION', 'RESOURCE-PROOF', 'SUBSET-RETRY', 'DURABLE-DELAY/BUDGET', 'HOLD/VERIFY', 'DRAIN-NOT-SUCCESS', 'WHOLE-CARRY'],
  D: ['INPUT-EOF', 'MANIFEST', 'GRANT-ACK', 'INBOX-CHILD', 'PARTICIPANT-ACK', 'COMMIT-DECISION', 'SAGA-TERMINAL/OPERATION-TERMINAL', 'CHECKPOINT/RUN-TERMINAL', 'RESULT-ACK', 'RELEASE-SETTLEMENT'],
  E: ['DROP-PARTICIPANT', 'UNKNOWN-SUCCESS', 'COMPENSATE-COMMITTED', 'IDENTITY-MISMATCH', 'NOTFOUND-SAFEABSENT', 'RELEASE-EARLY', 'DROP-ITEM', 'SETTLE-BEFORE-RESULT'],
  F: ['CHECKOUT-REFERENCE-INDEPENDENT', 'INSTALLED-RELOCATED', 'NO-CHECKOUT-FALLBACK', 'SOURCE-SPANS', 'AUTHOR/BINDING/IMPLEMENTATION-STALE', 'ZERO-WRITE-REGEN', 'MANUAL/OWNER', 'RENAME-STABLE-WIRE'],
});
const selected = {
  'A.MODULE': ['covered', ['PURE-VALUES:'], 'Four modules independently compile; forbidden kernel→Akka import is a real compiler rejection.'],
  'A.WIRE': ['partial', ['WIRE-CODEC:'], 'Actual fixed journal serialization exercised; explicit missing-registration mutation remains.'],
  'B.FIVE-RESULTS': ['covered', ['FIVE-RESULTS:', 'SAGA-HAPPY:', 'PREPARE-REJECT:', 'COMPENSATED:', 'UNKNOWN-AUTHORIZATION:'], 'All five protocol cases and actual Saga classifications.'],
  'B.PREPARE-REJECT': ['partial', ['PREPARE-REJECT:', 'COMPENSATED:'], 'Authoritative fenced absence covered; plain Rejected→query case still needs its own test.'],
  'B.AFTER-COMMIT': ['covered', ['AFTER-COMMIT:'], 'Lost durable commit ACK recovers forward without compensation.'],
  'B.CANCEL-FENCE': ['covered', ['CANCEL-FENCE:'], 'Durable fence reopened; delayed prepare cannot take effect.'],
  'B.SAFE-ABSENCE': ['covered', ['SAFE-ABSENCE:', 'UNKNOWN-AUTHORIZATION:'], 'NotFound is not a fence or resubmission authority.'],
  'B.REPLAY-INERT': ['covered', [], 'RecoveryOracle: second/third JVM ordinary queries cause no drive; third journal and ledger hashes unchanged.'],
  'B.AUTHORIZATION': ['covered', ['UNKNOWN-AUTHORIZATION:'], 'Denied authorization and successful explicit recovery are exercised.'],
  'B.BOUNDED-RECONCILE': ['partial', ['UNKNOWN-AUTHORIZATION:', 'STALE-CALLBACK:'], 'Zero/excessive budgets denied and bounded calls exercised; explicit budget exhaustion boundary remains.'],
  'B.STALE-CALLBACK': ['covered', ['STALE-CALLBACK:'], 'Late receipt cannot resume timed-out incarnation/ordinal; explicit query recovers durable receipt.'],
  'B.CONFLICTING-INPUT': ['partial', ['CONFLICTING-INPUT:', 'RUN-IDENTITY:', 'SAGA-HAPPY:'], 'Args and forged reply identity/receipt checked; Saga definition/codec conflict execution variants remain.'],
  'C.COUNT-WAIT/EOF': ['partial', ['COUNT-WAIT-EOF:', 'R2-MAIN:'], 'Pure policy limits and actual three-item EOF workflow covered; isolated timing windows remain.'],
  'C.COMPATIBILITY/HARD-MIN': ['partial', ['COUNT-WAIT-EOF:'], 'Pure hard minimum rejection; actual compatibility-group job remains.'],
  'C.ITEM-CONSERVATION': ['covered', ['ITEM-CONSERVATION:', 'R2-MAIN:'], 'Missing/duplicate/foreign IDs rejected; actual main publishes all three originals.'],
  'C.RESOURCE-PROOF': ['partial', ['RESOURCE-PROOF:', 'R2-MAIN:'], 'Invalid proof rejected and actual release settlement succeeds; held/queued/early-release windows remain.'],
  'C.DRAIN-NOT-SUCCESS': ['partial', ['R2-MAIN:'], 'Happy outcome checks every result, not Drained alone; held/failed drain case remains.'],
  'D.PARTICIPANT-ACK': ['partial', [], 'Real force-before-ACK lost Prepare A receipt, exit 73, restart+authorized recovery+third read. Other phase/before-write boundaries remain.'],
  'E.IDENTITY-MISMATCH': ['partial', ['RUN-IDENTITY:'], 'Compiled Run identity-check mutant fails exact assertion; required operation-identity mutation remains.'],
  'F.CHECKOUT-REFERENCE-INDEPENDENT': ['partial', [], 'Reference/oracle use no generator emitters. Generated and installed comparison is pending.'],
};
// B2 extends the reference lane only. Compiler/generated/installed claims stay separate.
const continuation = {
  'B.PREPARE-REJECT': ['oracle/MutationOracle.scala', ['B-PREPARE-REJECT-REAL:'], 'Refusal alone remains unknown; explicit durable fence then bounded recovery yields rejected-before-effects or compensated.'],
  'B.BOUNDED-RECONCILE': ['oracle/MutationOracle.scala', ['B-BOUNDED-RECONCILE:'], 'One authorized query exhausts its budget before Prepare B; another explicit bounded invocation completes.'],
  'B.CONFLICTING-INPUT': ['oracle/MutationOracle.scala', ['B-CONFLICTING-PINS:'], 'Real Attach rejects changed definition, args, codec and plan pins; original-input conflict remains covered.'],
  'C.OFFER-IDEMPOTENCE': ['oracle/R2Oracle.scala', ['R2-OFFER-QUEUED:'], 'Same original Offer is idempotent before and after settlement/EOF.'],
  'C.OFFER-CONFLICT/GAP': ['oracle/R2Oracle.scala', ['R2-OFFER-QUEUED:'], 'Changed payload/key, duplicate item ID and sequence gap rejected by real job.'],
  'C.BACKPRESSURE': ['oracle/R2Oracle.scala', ['R2-OFFER-QUEUED:'], 'Unsettled credit backpressures without consuming input sequence.'],
  'C.MANIFEST-FREEZE': ['oracle/R2Oracle.scala', ['R2-OFFER-QUEUED:'], 'Deserialize original journal Sealed manifest; queued duplicate/conflicting Offers cannot alter it.'],
  'C.COUNT-WAIT/EOF': ['oracle/R2Oracle.scala', ['R2-WAIT-EOF:', 'R2-OFFER-QUEUED:'], 'Real full count, durable acceptance-to-seal wait and explicit partial EOF.'],
  'C.COMPATIBILITY/HARD-MIN': ['oracle/R2Oracle.scala', ['R2-COMPATIBILITY-HARD-MIN:'], 'Real red/blue grouping; unmatched tail remains ClosingBlocked despite elapsed wait and EOF.'],
  'C.QUEUED': ['oracle/R2Oracle.scala', ['R2-OFFER-QUEUED:'], 'Actual resource Queued yields no child journal or external effects.'],
  'C.ITEM-CONSERVATION': ['oracle/MutationOracle.scala', ['MUTATION_DROP_ITEM:'], 'Real two-item Saga manifest preserves both original dispositions; compiled omission mutant detected.'],
  'C.RESOURCE-PROOF': ['oracle/R2Oracle.scala', ['R2-OFFER-QUEUED:'], 'Resource actor rejects forged release and retains grant until valid evidence.'],
  'C.SUBSET-RETRY': ['oracle/R2Oracle.scala', ['R2-SUBSET-RETRY:'], 'Real second manifest contains only retry item with durable execution/lineage; success item executes once.'],
  'C.DURABLE-DELAY/BUDGET': ['oracle/RetryRestartOracle.scala', [], 'Force-before-ACK Settled; fresh JVM proves no attempt before original dueAt and budget exhaustion after exactly second execution; third read unchanged.'],
  'C.HOLD/VERIFY': ['oracle/R2Oracle.scala', ['R2-HOLD-VERIFY:'], 'Held item keeps credit; only registered query-only route resumes, without external writes.'],
  'C.DRAIN-NOT-SUCCESS': ['oracle/R2Oracle.scala', ['R2-DRAIN-NOT-SUCCESS:', 'R2-HOLD-VERIFY:'], 'Known failure drains but is not success; held item cannot drain.'],
  'C.WHOLE-CARRY': ['oracle/R2Oracle.scala', ['R2-WHOLE-CARRY:'], 'All two holders travel through carry, retainCarried middle and final release; no split.'],
};
const restartWindows = {
  'D.INPUT-EOF': ['input', 'eof'], 'D.MANIFEST': ['manifest'], 'D.GRANT-ACK': ['grant'],
  'D.INBOX-CHILD': ['inbox', 'child-intent'], 'D.COMMIT-DECISION': ['commit-decision'],
  'D.SAGA-TERMINAL/OPERATION-TERMINAL': ['saga-terminal', 'operation-terminal'],
  'D.CHECKPOINT/RUN-TERMINAL': ['checkpoint', 'run-terminal'], 'D.RELEASE-SETTLEMENT': ['release', 'settlement'],
  'D.PARTICIPANT-ACK': ['participant-commit'], 'D.RESULT-ACK': ['result'],
};
const mutantTests = ['DROP_PARTICIPANT', 'UNKNOWN_SUCCESS', 'COMPENSATE_COMMITTED', 'OPERATION_IDENTITY',
  'NOTFOUND_SAFEABSENT', 'RELEASE_EARLY', 'DROP_ITEM', 'SETTLE_BEFORE_RESULT'];
for (const [id, windows] of Object.entries(restartWindows)) continuation[id] = ['oracle/RecoveryMatrix.scala', [],
  'Fresh-JVM original journal recovery and inert third read: ' + windows.join(', ') +
  (id === 'D.PARTICIPANT-ACK' ? '; prior Prepare A lost ACK retained plus new Commit A lost ACK.' :
    id === 'D.RESULT-ACK' ? '; external file forced before lost delivery ACK.' : '; both fail-before-write and force-before-ACK per event.')];
for (const [i, name] of groups.E.entries()) continuation['E.' + name] = ['oracle/MutationOracle.scala', ['MUTATION_' + mutantTests[i] + ':'],
  'Compiled production mutant rejected by its exact independent assertion; original nonzero process outcome retained.'];
export const cases = Object.freeze(Object.entries(groups).flatMap(([family, names]) => names.map(name => {
  const id = family + '.' + name;
  const [priorCoverage, tests, priorNote] = selected[id] ?? ['pending', [], 'Mandatory; no acceptance claimed in the targeted B gate.'];
  const newer = continuation[id];
  const coverage = newer ? 'covered' : priorCoverage;
  const assertions = newer ? [{ source: newer[0], tests: Object.freeze(newer[1]) }] : [];
  return Object.freeze({ id, family, coverage, tests: Object.freeze(tests), assertions: Object.freeze(assertions),
    windows: Object.freeze(restartWindows[id] ?? []),
    owner: family === 'A' || family === 'F' ? 'MAIN/MODELS with reference oracle' : 'REFERENCE-SHELL', note: newer?.[2] ?? priorNote });
})));
export const referenceBComplete = cases.filter(c => ['B', 'C', 'D', 'E'].includes(c.family)).every(c => c.coverage === 'covered');
// Whole-family A-F acceptance is not reference B acceptance.
export const fullBComplete = false;
