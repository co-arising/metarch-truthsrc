// Exact finite ScalaTest mutation acceptance; not any-nonzero success.
import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { acceptance } from './compiler-tools.mjs';

export function runtimeMutationAcceptance(result, expected) {
  assert(expected?.kind === 'suite-rejection' && typeof expected.suite === 'string' &&
    /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+$/.test(expected.suite) && Array.isArray(expected.testNames) && expected.testNames.length > 0 &&
    new Set(expected.testNames).size === expected.testNames.length && expected.testNames.includes(expected.failedTestName) &&
    expected.diagnostic instanceof RegExp && !expected.diagnostic.global && !expected.diagnostic.sticky, 'Fixed mutation case/diagnostic required');
  const output = result.stdout ?? '', lines = output.split('\n');
  const clean = acceptance({ ...result, status: 0 }, { kind: 'success' }).accepted;
  const n = expected.testNames.length, name = basename(expected.suite.replaceAll('.', '/'));
  const suiteHeaders = lines.filter(line => /^[A-Za-z_][\w$]*:$/.test(line));
  const summary = [
    `Total number of tests run: ${n}`, 'Suites: completed 1, aborted 0',
    `Tests: succeeded ${n - 1}, failed 1, canceled 0, ignored 0, pending 0`, '*** 1 TEST FAILED ***',
  ].every(line => lines.filter(value => value === line).length === 1);
  const cases = lines.filter(line => line.startsWith('- '));
  const exactCases = cases.length === n && expected.testNames.every(test => cases.includes(
    '- ' + test + (test === expected.failedTestName ? ' *** FAILED ***' : '')));
  const failedLine = '- ' + expected.failedTestName + ' *** FAILED ***';
  const start = lines.indexOf(failedLine), next = lines.findIndex((line, i) => i > start && (line.startsWith('- ') || line.startsWith('Run completed') || line.startsWith('Total number')));
  const block = start < 0 ? '' : lines.slice(start + 1, next < 0 ? lines.length : next).join('\n');
  return { accepted: result.status === 1 && result.signal === null && clean && summary && exactCases &&
    suiteHeaders.length === 1 && suiteHeaders[0] === name + ':' &&
    lines.filter(line => line.startsWith('Run starting.')).length === 1 &&
    lines.filter(line => line.startsWith('Run completed')).length === 1 &&
    ['Total number of tests run:', 'Suites:', 'Tests:', '*** '].every(prefix => lines.filter(line => line.startsWith(prefix)).length === 1) &&
    lines.includes(`Run starting. Expected test count is: ${n}`) && expected.diagnostic.test(block),
    clean, summary, exactCases };
}
