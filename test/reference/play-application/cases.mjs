import assert from 'node:assert/strict';

const end = ['real-journal-sequences', 'resource-stream-isolated', 'html-escaped', 'html-pagination-link', 'no-store',
  'close-idempotent', 'close-drained', 'closed-admission'];
export const httpCases = Object.freeze({
  write: ['readiness', 'auth-missing', 'auth-invalid', 'reader-query', 'resource-denied', 'page-resource-denied',
    'role-denied', 'csrf-denied', 'json-number-denied', 'json-exponent-denied', 'long-overflow-denied',
    'duplicate-json-denied', 'unknown-field-denied', 'media-type-denied', 'body-bound', 'denied-requests-no-actor',
    'domain-rejected', 'domain-rejection-no-events',
    ...Array.from({ length: 3 }, () => ['command-persisted', 'actual-reservation-identity', 'commit-persisted']).flat(),
    'second-resource-command', 'projection-visible', 'query-keyset-first', 'query-keyset-next', 'cursor-resource-denied',
    'duplicate-query-denied', 'query-limit-denied', ...end,
    'existing-storage-positive', 'old-readside-empty-journal-denied', 'old-readside-not-fresh-rebuild'],
  reopen: ['readiness', 'projection-visible', 'recovered-no-change', ...end],
  fresh: ['readiness', 'projection-visible', 'recovered-no-change', ...end],
});
export const lifecycleCases = ['lifecycle-same-future', 'cleanup-continues-in-reverse-order', 'cleanup-failures-retained',
  'closing-registration-rejected', 'workload-executor-saturated', 'synchronous-release-does-not-block-close',
  'blocking-release-entered', 'play-dispatcher-progresses-during-release',
  'one-absolute-close-deadline', 'blocked-release-not-drained', 'deadline-continues-remaining-cleanup',
  'blocked-executor-eventually-terminated', 'mandatory-disposal-not-discarded'];
export const failureCases = Object.freeze({
  'authority-unavailable': ['authority-failure-status', 'authority-error-redacted', 'authority-failure-no-domain-call', 'failure-fixture-close-drained'],
  'authority-unexpected': ['authority-failure-status', 'authority-error-redacted', 'authority-failure-no-domain-call', 'failure-fixture-close-drained'],
  'csrf-unavailable': ['authority-failure-status', 'authority-error-redacted', 'authority-failure-no-domain-call', 'failure-fixture-close-drained'],
  'ask-timeout': ['ask-timeout-outcome-unknown', 'timeout-can-still-persist', 'timeout-does-not-resubmit', 'failure-fixture-close-drained'],
  'invalid-output': ['output-contract-violation-not-returned', 'failure-fixture-close-drained'],
  drain: ['close-waits-for-admitted-request', 'closing-refuses-new-admission', 'admitted-request-completes', 'admission-drained-before-resources'],
  'source-failure': ['source-failure-invalidates-readiness', 'source-failure-denies-admission', 'runner-failure-not-clean-close'],
  unicode: ['utf8-boundary-command', 'utf8-boundary-command', 'multibyte-keyset-roundtrip', 'utf8-overflow-denied', 'unicode-rejection-no-extra-event', 'failure-fixture-close-drained'],
  initialization: ['partial-initialization-cleaned'],
});
export const journalCases = Object.freeze({
  positive: ['real-journal-control-sequence'],
  'wrong-type': ['wrong-journal-type-rejected'],
  'wrong-role': ['wrong-frame-role-rejected'],
  'fake-sequence': ['real-journal-control-sequence', 'fabricated-sequence-rejected', 'poison-does-not-advance-readside', 'source-poison-retained-in-shutdown', 'journal-control-executor-stopped'],
  'missing-serializer': ['serializer-required-before-readiness'],
});
export function assertCases(stdout, cases, marker) {
  const lines = stdout.split(/\r?\n/);
  assert.deepEqual(lines.filter(l => l.startsWith('CASE ')).map(l => l.slice(5)), cases, 'exact oracle cases and order');
  assert.equal(lines.filter(l => l === marker + ' assertions=' + cases.length).length, 1, 'one complete oracle result');
}
