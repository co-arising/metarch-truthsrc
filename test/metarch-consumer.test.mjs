import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync, readdirSync } from 'node:fs';
import { join, isAbsolute, delimiter } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadMetarchSnapshot, verifyMetarchCapture, projectMetarchProducts } from '../lib/compat/metarch.mjs';
import { compileSnapshot } from '../lib/compile-snapshot.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const PRODUCT_FILES = {
  METARCH: 'metarch.json', TEMPLATE: 'metarch.fields.template.json',
  READMODELS: 'story.readmodels.json', STORIES: 'story.stories.json', CONCERNS: 'concerns.json',
};
const configured = process.env.TRUTHSRC_BC_CONSUMER_MANIFEST;
function classFiles(root, dir = '') {
  return readdirSync(join(root, dir)).sort().flatMap(name => {
    const file = dir ? dir + '/' + name : name, path = join(root, file), stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink() && (stat.isFile() || stat.isDirectory()), path);
    if (stat.isDirectory()) return [{ file, kind: 'directory' }, ...classFiles(root, file)];
    assert.equal(stat.nlink, 1, path);
    const bytes = readFileSync(path);
    return [{ file, kind: 'file', bytes: bytes.length, sha256: sha256(bytes) }];
  });
}

// This opt-in probe consumes already compiled BC classes. It does not launch sbt,
// select active caches, generate applications or resolve missing dependencies.
test('opt-in BC Scala consumer: successful typed parsing, all merge views and complete AssemblyResult', { skip: !configured, timeout: 180000 }, async t => {
  assert.ok(isAbsolute(configured));
  const manifest = JSON.parse(readFileSync(configured, 'utf8'));
  assert.equal(manifest.schemaVersion, 'truthsrc.metarch-consumer-runtime/v1');
  for (const key of ['bcRoot', 'java', 'evidence', 'cwd']) assert.ok(isAbsolute(manifest[key]), key);
  const root = realpathSync(manifest.bcRoot);
  assert.equal(root, manifest.bcRoot);
  assert.equal(realpathSync(manifest.cwd), manifest.cwd);
  const java = readFileSync(manifest.java);
  assert.equal(sha256(java), manifest.javaSha256);
  assert.ok(Array.isArray(manifest.classpath) && manifest.classpath.length > 1);
  assert.ok(Array.isArray(manifest.inputs) && manifest.inputs.length > 0);
  const verifyInputs = () => {
    for (const input of manifest.inputs) {
      assert.ok(isAbsolute(input.path));
      const stat = lstatSync(input.path);
      assert.ok(stat.isFile() && !stat.isSymbolicLink());
      assert.equal(stat.size, input.bytes, input.path);
      assert.equal(sha256(readFileSync(input.path)), input.sha256, input.path);
    }
    assert.deepEqual(manifest.classpathEvidence.map(entry => entry.path), manifest.classpath);
    for (const entry of manifest.classpathEvidence) {
      const path = entry.path;
      assert.ok(isAbsolute(path));
      assert.equal(realpathSync(path), path);
      const stat = lstatSync(path);
      if (entry.kind === 'jar') {
        assert.ok(stat.isFile() && !stat.isSymbolicLink());
        assert.equal(stat.nlink, 1, path);
        assert.equal(stat.size, entry.bytes, path);
        assert.equal(sha256(readFileSync(path)), entry.sha256, path);
      } else {
        assert.equal(entry.kind, 'directory');
        assert.ok(stat.isDirectory());
        assert.deepEqual(classFiles(path), entry.files, path);
      }
    }
  };
  verifyInputs();
  const oracleSource = fileURLToPath(new URL('./fixtures/MetarchConsumerOracle.scala', import.meta.url));
  assert.equal(manifest.oracleSourceSha256, sha256(readFileSync(oracleSource)));
  assert.ok(manifest.classpathEvidence.some(entry => entry.kind === 'directory'
    && ['truthsrc/compat/MetarchConsumerOracle.class', 'truthsrc/compat/MetarchConsumerOracle$.class'].every(file => entry.files.some(row => row.file === file))));
  const compileFile = join(root, 'tools/truthsrc/compile.mjs');
  assert.equal(sha256(readFileSync(compileFile)), manifest.bcCompilerSha256);
  mkdirSync(manifest.evidence, { recursive: false });
  const receipts = [];
  const run = (name, baseline, candidate, passed) => {
    const dir = join(manifest.evidence, name);
    mkdirSync(dir);
    const left = typeof baseline === 'string' ? baseline : JSON.stringify(baseline, null, 2);
    const right = typeof candidate === 'string' ? candidate : JSON.stringify(candidate, null, 2);
    const baselineFile = join(dir, 'baseline.json'), candidateFile = join(dir, 'candidate.json');
    writeFileSync(baselineFile, left, { flag: 'wx' });
    writeFileSync(candidateFile, right, { flag: 'wx' });
    const result = spawnSync(manifest.java, ['-XX:-UsePerfData', '-Dfile.encoding=UTF-8', '-cp', manifest.classpath.join(delimiter),
      'truthsrc.compat.MetarchConsumerOracle', baselineFile, candidateFile], {
      cwd: manifest.cwd, env: { PATH: '/usr/bin:/bin', LANG: 'C', HOME: manifest.cwd },
      encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024,
    });
    writeFileSync(join(dir, 'stdout.log'), result.stdout || '', { flag: 'wx' });
    writeFileSync(join(dir, 'stderr.log'), result.stderr || '', { flag: 'wx' });
    const receipt = { name, pid: result.pid, status: result.status, signal: result.signal,
      ...(result.error ? { error: result.error.message } : {}),
      inputs: [{ file: 'baseline.json', bytes: Buffer.byteLength(left), sha256: sha256(left) },
        { file: 'candidate.json', bytes: Buffer.byteLength(right), sha256: sha256(right) }] };
    writeFileSync(join(dir, 'result.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    receipts.push(receipt);
    assert.equal(result.error, undefined, name);
    assert.equal(result.signal, null, name);
    assert.equal(result.status, passed ? 0 : 2, result.stderr || name);
    const output = JSON.parse(result.stdout);
    assert.equal(output.passed, passed, name);
    if (passed) assert.ok(Object.values(output.checks).every(value => value === true));
    return output;
  };
  const loaded = loadMetarchSnapshot(join(root, 'truth/metarch'), { ignoreOSMetadata: true });
  const { compileTree } = await import(pathToFileURL(compileFile).href);
  const baseline = compileTree(join(root, 'truth/metarch'));
  const candidate = projectMetarchProducts(compileSnapshot(loaded.snapshot).canonical, loaded.legacy);
  try {
    await t.test('all five exact serialized products before typed consumption', () => {
      const summary = [];
      for (const [key, file] of Object.entries(PRODUCT_FILES)) {
        assert.deepEqual(candidate[key], baseline[key], key);
        const a = JSON.stringify(baseline[key], null, 2) + (key === 'METARCH' ? '' : '\n');
        const b = JSON.stringify(candidate[key], null, 2) + (key === 'METARCH' ? '' : '\n');
        assert.equal(b, a, key);
        writeFileSync(join(manifest.evidence, file), b, { flag: 'wx' });
        summary.push({ product: key, file, bytes: Buffer.byteLength(b), sha256: sha256(b) });
      }
      writeFileSync(join(manifest.evidence, 'products.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    });
    await t.test('actual full Metarch tree parses and assembles successfully on both paths', () => {
      const result = run('actual', baseline.METARCH, candidate.METARCH, true);
      assert.ok(result.notes > 0 && result.aggregates > 0);
      t.diagnostic(JSON.stringify(result));
    });
    const state = {
      workshop: 'precedence', sessions: [
        { session: 'commandStorming', scopes: [{ scope: 'one', notes: [
          { type: 'role', name: 'Clerk', noteId: 'same-alias', stage: 'refining', description: 'higher priority', links: [], info: { value: 'refining' } },
        ] }] },
        { session: 'refining', scopes: [{ scope: 'two', notes: [
          { type: 'role', name: 'Clerk', noteId: 'same-alias', stage: 'commandStorming', description: 'lower priority', links: [], info: { value: 'commandStorming' } },
        ] }] },
      ],
    };
    await t.test('duplicate IDs and deliberately distinct session/note stages preserve real merge precedence', () => {
      const result = run('same-two-stage-values', state, structuredClone(state), true);
      assert.equal(result.notes, 2);
      assert.equal(result.mergedNotes, 1);
    });
    await t.test('forcing payload stages to session stages is detected as a real consumer change', () => {
      const changed = structuredClone(state);
      for (const session of changed.sessions) for (const scope of session.scopes) for (const note of scope.notes) note.stage = session.session;
      const result = run('normalized-stage-rejected', state, changed, false);
      assert.equal(result.checks.mergedNotes, false);
      assert.equal(result.checks.assembledSystem, false);
    });
    await t.test('a note lost by ID-only deduplication cannot pass typed state parity', () => {
      const changed = structuredClone(state);
      changed.sessions[0].scopes[0].notes = [];
      assert.equal(run('deduplicated-alias-rejected', state, changed, false).checks.parsedState, false);
    });
    await t.test('equal malformed inputs are rejected instead of treating two parse failures as parity', () => {
      const dir = join(manifest.evidence, 'both-malformed'); mkdirSync(dir);
      const path = join(dir, 'input.json'); writeFileSync(path, '{', { flag: 'wx' });
      const result = spawnSync(manifest.java, ['-XX:-UsePerfData', '-cp', manifest.classpath.join(delimiter),
        'truthsrc.compat.MetarchConsumerOracle', path, path], {
        cwd: manifest.cwd, env: { PATH: '/usr/bin:/bin', HOME: manifest.cwd }, encoding: 'utf8',
        timeout: 20000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024,
      });
      writeFileSync(join(dir, 'stdout.log'), result.stdout || '', { flag: 'wx' });
      writeFileSync(join(dir, 'stderr.log'), result.stderr || '', { flag: 'wx' });
      receipts.push({ name: 'both-malformed', pid: result.pid, status: result.status, signal: result.signal });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /IllegalArgumentException/);
    });
  } finally {
    writeFileSync(join(manifest.evidence, 'processes.json'), JSON.stringify(receipts, null, 2) + '\n', { flag: 'wx' });
    verifyInputs();
    verifyMetarchCapture(loaded);
  }
});
