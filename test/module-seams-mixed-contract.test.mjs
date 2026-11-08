import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, cpSync, mkdtempSync, realpathSync, rmSync, appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules, referenceInventory, writerInventory, generatedInventory, handwrittenInventory,
  parcelClasspaths, readOracle, compilerControls } from './reference/module-seams-mixed/contract.mjs';
import { admitReferenceInputs, admitMixedInputs } from './reference/module-seams-mixed/inputs.mjs';
import { projectCli } from '../lib/project/cli.mjs';

const reference = fileURLToPath(new URL('./reference/module-seams', import.meta.url));
const lock = JSON.parse(readFileSync(new URL('./reference/module-seams-mixed/oracle.lock.json', import.meta.url)));
const temp = t => {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'module-seams-mixed-inputs-'));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return dir;
};
const tools = { library: '/cache/library.jar', compiler: ['/cache/compiler.jar', '/cache/library.jar', '/cache/reflect.jar'],
  testLibraries: ['/cache/library.jar', '/cache/reflect.jar', '/cache/scalatest.jar'] };
const classes = Object.fromEntries(modules.map(module => [module, '/classes/' + module]));

test('main sample preserves reference10 and writer7 plus external3 responsibilities', () => {
  assert.equal(referenceInventory.length, 10); assert.equal(writerInventory.length, 15);
  assert.equal(modules.flatMap(m => generatedInventory[m]).length, 7);
  assert.equal(modules.flatMap(m => handwrittenInventory[m]).length, 3);
  const admitted = admitReferenceInputs(reference);
  assert.deepEqual(modules.map(m => admitted.sets[m].length), [7, 1, 1, 1]); admitted.close();
});

test('the fixed independent oracle has original34 names and bytes', () => {
  const rows = readOracle(reference, lock);
  assert.deepEqual(rows.map(row => row.testNames.length), [20, 9, 5]);
  assert.equal(rows.reduce((n, row) => n + row.tests, 0), 34);
  const changed = structuredClone(lock); changed.suites[0].sha256 = '0'.repeat(64);
  assert.throws(() => readOracle(reference, changed), /oracle bytes drifted/);
});

test('four-module classpaths are directional and do not contain compiler or test supply', () => {
  const cp = parcelClasspaths(tools, classes);
  assert.deepEqual(cp.kernel, [tools.library]);
  assert.deepEqual(cp.glue, [tools.library, classes.kernel]);
  assert.deepEqual(cp.ext, [tools.library, classes.kernel, classes.glue]);
  assert.deepEqual(cp.root, [tools.library, classes.kernel, classes.glue, classes.ext]);
  for (const module of modules) assert(!cp[module].some(p => /compiler|reflect|scalatest/.test(p)));
  for (const invalid of [{ ...classes, root: classes.kernel }, { ...classes, root: classes.kernel + '/root' },
    { ...classes, root: 'relative' }, { ...classes, extra: '/classes/extra' }]) assert.throws(() => parcelClasspaths(tools, invalid));
});

test('all seven original compiler pairs retain explicit positive and diagnostic negative expectations', () => {
  const root = readFileSync(join(reference, generatedInventory.root[0]), 'utf8');
  const pairs = compilerControls(root);
  assert.equal(pairs.length, 7); assert.equal(new Set(pairs.map(p => p.name)).size, 7);
  const cp = parcelClasspaths(tools, classes);
  for (const p of pairs) {
    assert(p.control && p.negative && p.file && p.symbol && p.diagnostics.length);
    assert(cp[p.controlCP] && cp[p.negativeCP]);
    assert(p.diagnostics.every(d => d instanceof RegExp));
  }
});

test('actual writer final bytes and fresh live handwritten capture admit without reference production', async t => {
  const dir = temp(t), projectDir = join(dir, 'project');
  cpSync(fileURLToPath(new URL('../scaffold/module-seams-project', import.meta.url)), projectDir, { recursive: true });
  const project = join(projectDir, 'truthsrc.project.json'), source = join(dir, 'generated');
  const result = await projectCli('generate-project', ['--project', project, '--out', source]);
  const sourceReceipt = join(dir, 'writer.json'); writeFileSync(sourceReceipt, JSON.stringify(result));
  const producerRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
  const admitted = await admitMixedInputs({ source, sourceReceipt, project, producerRoot });
  assert.deepEqual(modules.map(m => admitted.sets[m].length), [7, 1, 1, 1]);
  assert.equal(modules.flatMap(m => admitted.sets[m]).filter(s => s.role === 'handwritten').length, 3);
  assert(!modules.flatMap(m => admitted.sets[m]).some(s => s.path.startsWith(reference)));
  admitted.close();
  appendFileSync(join(projectDir, 'handwritten/kernel/CapacityRule.scala'), '\n// changed after admission\n');
  assert.throws(() => admitted.close(), /changed|drift/i);
  await assert.rejects(() => admitMixedInputs({ source, sourceReceipt, project, producerRoot }), /mismatch|differ/i);
});
