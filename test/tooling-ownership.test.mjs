import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { TOOLING_OWNERSHIP_SCHEMA, verifyToolingOwnership } from '../lib/verification/tooling-ownership.mjs';

function fixture(t) {
  const base = mkdtempSync(join(realpathSync(tmpdir()), 'tooling-ownership-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'consumer 项目'), publicRoot = join(base, 'library');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'test'));
  mkdirSync(join(publicRoot, 'lib'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'audit.mjs'), "import '../../library/lib/files.mjs';\nthrow new Error('NEVER execute inventoried code');\n");
  writeFileSync(join(root, 'test', 'audit.test.mjs'), "import '../scripts/audit.mjs';\n");
  writeFileSync(join(publicRoot, 'lib', 'files.mjs'), "throw new Error('NEVER execute a public target');\n");
  return { root, sourceRoots: { library: publicRoot }, candidateFiles: ['scripts/audit.mjs', 'test/audit.test.mjs'],
    inventory: { schemaVersion: TOOLING_OWNERSHIP_SCHEMA, toolRoots: ['scripts'],
      scope: 'Explicit non-bank tracked file list; no Git or package install performed by checker.', entries: [{
        file: 'scripts/audit.mjs', lifecycle: 'current',
        provenance: { kind: 'engineering-authored', basis: 'Maintained by the audit tool team, not generated from domain truth.' },
        responsibility: { summary: 'Capture audit input evidence.', owners: ['audit maintainers'], nature: 'adapter',
          mechanism: 'Delegate file capture to the library.', policy: 'Consumer selects admitted audit paths.' },
        consumers: [{ file: 'test/audit.test.mjs', kind: 'test', evidence: "import '../scripts/audit.mjs';",
          note: 'Declared static test import; neither test nor tool is executed.' }],
        publicMechanism: { status: 'migrated', note: 'File reference resolves; not proof of JavaScript semantics.', targets: [{
          sourceRoot: 'library', file: 'lib/files.mjs', consumer: 'scripts/audit.mjs', specifier: '../../library/lib/files.mjs',
        }] },
      }] },
  };
}
const entry = data => data.inventory.entries[0];

test('non-bank explicit inventory captures evidence without importing targets or modifying caller data', t => {
  const data = fixture(t), before = JSON.stringify(data);
  const result = verifyToolingOwnership(data);
  assert.equal(result.passed, true);
  assert.equal(result.toolCount, 1);
  assert.equal(result.references.length, 3);
  assert.match(result.entries[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.declaration, 'owner-declared-not-semantic-proof');
  for (const key of ['semanticsVerified', 'executionVerified', 'importClosureVerified', 'candidateCompletenessVerified']) {
    assert.equal(result[key], false);
  }
  assert.equal(JSON.stringify(data), before);
  assert.ok(Object.isFrozen(result.entries));
  assert.ok(!Object.isFrozen(data.inventory));
  assert.match(readFileSync(join(data.root, 'scripts/audit.mjs'), 'utf8'), /NEVER execute/);
});

test('unreferenced non-tool candidates are never opened, including absent local outputs', t => {
  const data = fixture(t);
  data.candidateFiles.push('.local/never-read.json', 'generated/never-read.scala', 'target/never-read.json');
  const result = verifyToolingOwnership(data);
  assert.equal(result.toolCount, 1);
  assert.equal(result.references.length, 3);
  assert.ok(result.references.every(reference => !/never-read/.test(reference.file)));
});

test('a local-only declaration needs no public source checkout or execution', t => {
  const data = fixture(t);
  data.sourceRoots = {};
  entry(data).publicMechanism = { status: 'consumer-policy', targets: [], note: 'Policy remains local.' };
  assert.equal(verifyToolingOwnership(data).references.length, 2);
});

test('exact membership rejects omitted, extra and newly declared missing tool files', t => {
  for (const change of [
    data => data.inventory.entries.pop(),
    data => data.candidateFiles.push('scripts/new.mjs'),
    data => data.candidateFiles.splice(0, 1),
  ]) {
    const data = fixture(t); change(data);
    assert.throws(() => verifyToolingOwnership(data), /exact candidate|array required/);
  }
  const data = fixture(t);
  entry(data).file = 'scripts/not-yet-created.mjs';
  data.candidateFiles[0] = entry(data).file;
  assert.throws(() => verifyToolingOwnership(data), /missing path|ENOENT/);
});

test('duplicate files, aliases, overlapping roots, unsafe paths and unlisted references fail', t => {
  const mutations = [
    data => data.candidateFiles.push(data.candidateFiles[0]),
    data => data.candidateFiles.push('scripts/AUDIT.mjs'),
    data => data.inventory.entries.push(structuredClone(entry(data))),
    data => data.inventory.toolRoots.push('scripts/subdir'),
    data => data.candidateFiles.push('../escape.mjs'),
    data => data.candidateFiles.push('/absolute.mjs'),
    data => data.candidateFiles.push('scripts//alias.mjs'),
    data => data.candidateFiles.push('scripts/./alias.mjs'),
    data => data.candidateFiles.push('scripts\\alias.mjs'),
    data => data.candidateFiles.push('scripts/control\0.mjs'),
    data => entry(data).consumers[0].file = 'unlisted.mjs',
    data => entry(data).publicMechanism.targets[0].file = '../outside.mjs',
  ];
  for (const mutate of mutations) {
    const data = fixture(t); mutate(data);
    assert.throws(() => verifyToolingOwnership(data), /duplicate|alias|overlapping|unsafe|concrete text|absent from candidateFiles/);
  }
});

test('required fields, enum values and nonempty responsibility/owners are mechanical contracts', t => {
  const mutations = [
    data => delete entry(data).provenance,
    data => { entry(data).provenance.kind = 'guessed'; },
    data => { entry(data).lifecycle = 'unused'; },
    data => { entry(data).responsibility.nature = 'magic'; },
    data => { entry(data).responsibility.summary = ' '; },
    data => { entry(data).responsibility.owners = []; },
    data => { entry(data).responsibility.owners = ['']; },
    data => { entry(data).responsibility.policy = ''; },
    data => { entry(data).publicMechanism.status = 'done'; },
    data => { entry(data).consumers[0].kind = 'proved'; },
    data => { data.inventory.extra = 'typo'; },
    data => { entry(data).publicMechanism.targets = []; },
  ];
  for (const mutate of mutations) {
    const data = fixture(t); mutate(data);
    assert.throws(() => verifyToolingOwnership(data), /fields|unsupported|concrete text|array required|resolvable targets/);
  }
});

test('missing consumer files, stale literal evidence and duplicate references fail', t => {
  const data = fixture(t);
  rmSync(join(data.root, 'test/audit.test.mjs'));
  assert.throws(() => verifyToolingOwnership(data), /missing path|ENOENT/);
  writeFileSync(join(data.root, 'test/audit.test.mjs'), 'no longer refers to audit');
  assert.throws(() => verifyToolingOwnership(data), /missing literal reference/);
  writeFileSync(join(data.root, 'test/audit.test.mjs'), "import '../scripts/audit.mjs';");
  entry(data).consumers.push(structuredClone(entry(data).consumers[0]));
  assert.throws(() => verifyToolingOwnership(data), /duplicate consumer/);
});

test('migrated targets must resolve from declared roots and captured literal specifiers', t => {
  const mutations = [
    data => { entry(data).publicMechanism.targets[0].sourceRoot = 'unknown'; },
    data => { entry(data).publicMechanism.targets[0].specifier = '../../wrong/lib/files.mjs'; },
    data => { entry(data).publicMechanism.targets[0].specifier = 'library'; },
    data => { entry(data).publicMechanism.targets.push(structuredClone(entry(data).publicMechanism.targets[0])); },
    data => rmSync(join(data.sourceRoots.library, 'lib/files.mjs')),
    data => writeFileSync(join(data.root, 'scripts/audit.mjs'), 'the public import was removed'),
  ];
  for (const mutate of mutations) {
    const data = fixture(t); mutate(data);
    assert.throws(() => verifyToolingOwnership(data), /undeclared|does not resolve|relative file specifier|duplicate public|missing path|missing literal/);
  }
});

test('source links and oversized tool inputs fail through shared file capture', t => {
  const data = fixture(t), file = join(data.root, 'scripts/audit.mjs');
  rmSync(file);
  symlinkSync(join(data.sourceRoots.library, 'lib/files.mjs'), file);
  assert.throws(() => verifyToolingOwnership(data), /symlink/);
  rmSync(file);
  writeFileSync(file, Buffer.alloc(8 * 1024 * 1024 + 1));
  assert.throws(() => verifyToolingOwnership(data), /bounded regular file/);
});

test('data getters cannot execute during inventory validation', t => {
  const data = fixture(t);
  Object.defineProperty(entry(data), 'lifecycle', { enumerable: true, get() { assert.fail('getter executed'); } });
  assert.throws(() => verifyToolingOwnership(data), /enumerable data properties/);
});

test('literal comments can satisfy declarations: result never claims parsed import/semantic proof', t => {
  const data = fixture(t);
  writeFileSync(join(data.root, 'scripts/audit.mjs'), "// declaration only: '../../library/lib/files.mjs'\n");
  const result = verifyToolingOwnership(data);
  assert.equal(result.passed, true);
  assert.equal(result.executionVerified, false);
  assert.equal(result.importClosureVerified, false);
});
