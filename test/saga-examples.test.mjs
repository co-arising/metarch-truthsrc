import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const [name, expected] of [['saga-money-transfer', ['money-transfer']], ['fab-split-merge', ['fab-split', 'fab-merge']]]) {
  test(`authored ${name} tree validates, round-trips and compiles through the public Saga CLI`, (t) => {
    const example = join(root, 'example', name);
    const tree = join(example, 'tree');
    assert.deepEqual(validateTree(tree).hard, []);
    assert.equal(roundtrip(tree).ok, true);
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'saga-example-cli-')));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const output = join(directory, 'saga.ir.json');
    const command = [join(root, 'bin', 'truthsrc.js'), 'compile-sagas', '--tree', tree,
      '--binding', join(example, 'bindings.json'), '--out', output];
    const result = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const ir = JSON.parse(readFileSync(output));
    assert.equal(ir.readiness, 'contract-only');
    assert.deepEqual(ir.sagas.map(({ definition }) => definition.id), expected);
    assert.equal(ir.sourceMap['/sagas/0/definition/payload'].file,
      join(tree, 'sagas', `${expected[0]}.saga.yaml`));
    assert.equal(ir.sourceMap['/sagas/0/definition/payload'].location, null);
    assert.match(result.stdout, /runtime not verified/);
    const executionOutput = join(directory, 'execution.ir.json');
    const execution = spawnSync(process.execPath, [join(root, 'bin', 'truthsrc.js'), 'compile-execution',
      '--tree', tree, '--binding', join(example, 'execution-bindings.json'), '--out', executionOutput], { encoding: 'utf8' });
    assert.equal(execution.status, 0, execution.stderr);
    const model = JSON.parse(readFileSync(executionOutput));
    assert.equal(model.pipelines.length, expected.length);
    assert.ok(model.pipelines.every(pipeline => pipeline.readiness === 'contract-only'));
    assert.deepEqual(model.sagas.map(({ definition }) => definition.id).sort(), [...expected].sort());
    for (const source of Object.values(model.sourceMap).filter(source => source.document === 'canonical' && source.pointer.startsWith('/sagas/'))) {
      assert.ok(source.file.includes('/sagas/'), `Saga provenance must not fall back to workshop: ${JSON.stringify(source)}`);
      assert.equal(source.location, null);
    }
    if (name === 'fab-split-merge') assert.equal(model.documentOnly.length, 1, 'Unimplemented durable child waiting stays narrative-only');
  });
}
