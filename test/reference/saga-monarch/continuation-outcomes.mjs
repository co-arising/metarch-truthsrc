import { acceptance } from '../compiler-tools.mjs';

export const mutationAssertions = Object.freeze({
  'DROP-PARTICIPANT': 'MUTATION_DROP_PARTICIPANT',
  'UNKNOWN-SUCCESS': 'MUTATION_UNKNOWN_SUCCESS',
  'COMPENSATE-COMMITTED': 'MUTATION_COMPENSATE_COMMITTED',
  'IDENTITY-MISMATCH': 'MUTATION_OPERATION_IDENTITY',
  'NOTFOUND-SAFEABSENT': 'MUTATION_NOTFOUND_SAFEABSENT',
  'RELEASE-EARLY': 'MUTATION_RELEASE_EARLY',
  'DROP-ITEM': 'MUTATION_DROP_ITEM',
  'SETTLE-BEFORE-RESULT': 'MUTATION_SETTLE_BEFORE_RESULT',
});
export function continuationFailure(result, expected) {
  const environmentError = acceptance(result).environmentError;
  const output = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  const marker = mutationAssertions[expected.caseId];
  const mutation = expected.family === 'mutation' && marker && result.status === 1 &&
    output.split('\n').some(line => line.startsWith('- ' + marker + ':') && line.endsWith(' *** FAILED ***')) &&
    new RegExp('^\\s+.*(?:was (?:false|true)|did not equal [^\\n]+|was not instance of [^\\n]+) '+marker+' \\(MutationOracle\\.scala:\\d+\\)$', 'm').test(output) &&
    /^Total number of tests run: 1$/m.test(output) &&
    /^Tests: succeeded 0, failed 1, canceled 0, ignored 0, pending 0$/m.test(output) &&
    /^Suites: completed 1, aborted 0$/m.test(output);
  const retry = expected.family === 'retry-restart' && result.status === 77 &&
    output.split('\n').includes('EXPECTED_RETRY_FORCE_BEFORE_ACK code=77');
  return { accepted: !result.error && result.signal === null && !environmentError && Boolean(mutation || retry), environmentError };
}
