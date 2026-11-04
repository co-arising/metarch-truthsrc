import test from 'node:test';
import assert from 'node:assert/strict';
import fs, {
  existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applyEntries, previewEntries } from '../src/core/generate.mjs';

const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const generator = { id: 'owned-fixture', version: '1' };
const sourcePath = 'src/Owned.scala';
const evidencePath = '.truthsrc/project.evidence.json';
const freshPath = 'new/First.scala';
const entry = (path = sourcePath, content = 'object V1 {}\n', extra = {}) => ({
  path, content, kind: 'source', families: [], ...extra,
});
const evidence = version => entry(evidencePath, JSON.stringify({ version }) + '\n', { kind: 'project-evidence' });
const shell = (version, body = 'generatedDefault()') => `// generated ${version}\r\nobject Owned {\r\n  def execute(state: State) = {\r\n    // ==== BEGIN MANUAL ====\r\n    ${body}\r\n    // ==== END MANUAL ====\r\n  }\r\n}\r\n`;
const masked = text => text.replace(/(\/\/ ==== BEGIN MANUAL ====)[\s\S]*?(\/\/ ==== END MANUAL ====)/g, '$1$2');

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-owned-update-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outDir = join(root, 'output');
  const ownership = { id: join(root, 'truthsrc.project.json') };
  const args = (entries, extra = {}) => ({ entries, outDir, generator, ownership, ...extra });
  const put = (path, content) => {
    const absolute = join(outDir, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
    return absolute;
  };
  const read = path => readFileSync(join(outDir, path));
  const ledger = () => JSON.parse(read('truthsrc.ledger.json'));
  const index = () => JSON.parse(read('anchors.json'));
  const concern = (families = 'Selected') => {
    const registryFile = join(root, 'concerns.json');
    writeFileSync(registryFile, JSON.stringify({ flavors: { all: { artifactKinds: ['*'] } },
      concerns: { all: { schemaCategories: ['*'], flavors: ['all'] } } }));
    return { name: 'all', families, registryFile };
  };
  return { root, outDir, ownership, args, put, read, ledger, index, concern,
    run: (entries, extra) => applyEntries(args(entries, extra)),
    preview: (entries, extra) => previewEntries(args(entries, extra)),
  };
}

// Capture identity/times as well as bytes: rewriting identical source still counts as a write.
function snapshot(root) {
  if (!existsSync(root)) return null;
  const result = {};
  function visit(absolute, relative) {
    const info = lstatSync(absolute, { bigint: true });
    const metadata = Object.fromEntries(['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']
      .map(key => [key, String(info[key])]));
    if (info.isSymbolicLink()) result[relative] = { ...metadata, link: readlinkSync(absolute) };
    else if (info.isDirectory()) {
      result[relative] = { ...metadata, directory: true };
      for (const name of readdirSync(absolute).sort()) visit(join(absolute, name), relative ? `${relative}/${name}` : name);
    } else result[relative] = { ...metadata, bytes: readFileSync(absolute).toString('base64') };
  }
  visit(root, '');
  return result;
}

async function refuses(f, entries, message, extra = { update: true }) {
  const before = snapshot(f.root);
  assert.throws(() => f.preview(entries, extra), message);
  assert.deepEqual(snapshot(f.root), before, 'preview refusal wrote files');
  await assert.rejects(f.run(entries, extra), message);
  assert.deepEqual(snapshot(f.root), before, 'apply refusal wrote sources or receipts');
}
function baseline(f, path, kind = 'source') {
  const row = f.ledger().entries.find(row => row.path === path);
  assert.equal(row.kind, kind);
  assert.deepEqual(row.ownership, { id: f.ownership.id, generator: generator.id,
    fingerprint: hash(f.read(path)), generatedFingerprint: hash(masked(f.read(path).toString())) });
}

// These tests are deliberately serial; race cases temporarily replace a builtin fs method.
test('fresh owned preview/apply and repeat are identical decisions without repeat source writes', async t => {
  const f = fixture(t);
  const entries = [entry(sourcePath, shell(1), { knowledgeIds: ['knowledge:owned'] }), evidence(1)];
  const before = snapshot(f.root);
  const preview = f.preview(entries);
  assert.equal(preview instanceof Promise, false, 'preview is synchronous');
  assert.deepEqual(snapshot(f.root), before, 'fresh preview created a directory');
  assert.equal(existsSync(f.outDir), false);
  assert.deepEqual(preview.actions.map(item => [item.path, item.outcome, item.changed]), [
    [sourcePath, 'ADD', true], [evidencePath, 'ADD', true],
  ]);
  const applied = await f.run(entries, { expectedFiles: preview.expectedFiles });
  assert.deepEqual(applied, preview);
  baseline(f, sourcePath);
  baseline(f, evidencePath, 'project-evidence');
  const source = snapshot(join(f.outDir, 'src'));
  const evidenceBytes = snapshot(join(f.outDir, '.truthsrc'));
  const ledgerBytes = f.read('truthsrc.ledger.json');
  const anchorsBytes = f.read('anchors.json');
  for (const update of [false, true]) {
    const next = f.preview(entries, { update });
    const result = await f.run(entries, { update });
    assert.deepEqual(result.actions, next.actions);
    assert.equal(result.written, 0);
    assert.equal(result.identical, 2);
    assert.deepEqual(snapshot(join(f.outDir, 'src')), source);
    assert.deepEqual(snapshot(join(f.outDir, '.truthsrc')), evidenceBytes);
    assert.deepEqual(f.read('truthsrc.ledger.json'), ledgerBytes);
    assert.deepEqual(f.read('anchors.json'), anchorsBytes);
  }
  const bumped = await f.run(entries, { update: true, generator: { ...generator, version: '2' } });
  assert.equal(bumped.written, 0);
  assert.deepEqual(snapshot(join(f.outDir, 'src')), source);
  assert.deepEqual(snapshot(join(f.outDir, '.truthsrc')), evidenceBytes);
  assert.equal(f.index().anchors['knowledge:owned'][0].generatorVersion, '2');
});

test('source and project evidence update together without a concern, including new anchor bytes', async t => {
  const f = fixture(t);
  await f.run([entry(sourcePath, 'object V1 {}\n', { knowledgeIds: ['old:key'] }), evidence(1)]);
  const entries = [entry(sourcePath, 'object V2 {}\n', { knowledgeIds: ['new:key'] }), evidence(2)];
  await refuses(f, entries, /refusing to overwrite existing file/, {});
  const preview = f.preview(entries, { update: true, generator: { ...generator, version: '2' } });
  assert.deepEqual(preview.actions.map(item => item.outcome), ['COVER', 'COVER']);
  const result = await f.run(entries, { update: true, generator: { ...generator, version: '2' }, expectedFiles: preview.expectedFiles });
  assert.deepEqual(result, preview);
  assert.equal(result.written, 2);
  baseline(f, sourcePath);
  baseline(f, evidencePath, 'project-evidence');
  assert.equal(f.index().anchors['old:key'], undefined);
  const anchor = f.index().anchors['new:key'][0];
  assert.equal(anchor.fingerprint, hash(f.read(sourcePath)));
  assert.equal(anchor.generatorVersion, '2');
  assert.equal(anchor.status, 'source-verified');
});

for (const conflictPath of [sourcePath, evidencePath]) {
  test(`late ${conflictPath} conflict refuses all earlier ADD/COVER writes, even incoming actual bytes`, async t => {
    const f = fixture(t);
    await f.run([entry(), evidence(1), entry('src/Legal.scala')]);
    const tampered = conflictPath === sourcePath ? 'object HumanEdit {}\n' : '{"human":true}\n';
    f.put(conflictPath, tampered);
    const entries = [entry(freshPath), entry('src/Legal.scala', 'object V2 {}\n'),
      entry(conflictPath, tampered, { kind: conflictPath === evidencePath ? 'project-evidence' : 'source' })];
    await refuses(f, entries, /update conflict.*outside MANUAL/);
    await refuses(f, entries, /update conflict.*outside MANUAL/, { update: true, concern: f.concern(null) });
  });
}

test('update refuses unowned identical files; explicit ordinary IDENTICAL can establish a baseline', async t => {
  const f = fixture(t);
  f.put(sourcePath, entry().content);
  await refuses(f, [entry(freshPath), entry()], /recorded ownership baseline/);
  const result = await f.run([entry()]);
  assert.equal(result.written, 0);
  baseline(f, sourcePath);
  await f.run([entry(sourcePath, 'object V2 {}\n')], { update: true });
  baseline(f, sourcePath);
});

test('legacy ledger rows and generator header alone are not update baselines', async t => {
  const f = fixture(t);
  await f.run([entry()], { ownership: undefined });
  assert.equal(f.ledger().entries[0].ownership, undefined);
  await refuses(f, [entry(freshPath), entry()], /recorded ownership baseline/);
});

for (const [name, extra, changedEntry, message] of [
  ['owner', { ownership: { id: 'some-other-project' } }, {}, /cross-owner/],
  ['generator', { generator: { id: 'other-generator', version: '1' } }, {}, /cross-generator/],
  ['kind', {}, { kind: 'unrelated-kind' }, /cross-kind/],
]) {
  test(`cross-${name} refusal precedes IDENTICAL and out-of-concern KEEP decisions`, async t => {
    const f = fixture(t);
    const initial = entry(sourcePath, 'object V1 {}\n', { families: ['Other'] });
    await f.run([initial, entry('src/Selected.scala', 'object Selected {}\n', { families: ['Selected'] })]);
    const entries = [entry(freshPath), { ...initial, ...changedEntry }];
    await refuses(f, entries, message, { update: true, ...extra });
    await refuses(f, entries, message, { update: true, ...extra, concern: f.concern() });
  });
}

for (const field of ['fingerprint', 'generatedFingerprint']) {
  test(`missing or invalid recorded ${field} refuses identical update`, async t => {
    const f = fixture(t);
    await f.run([entry()]);
    const ledger = f.ledger();
    delete ledger.entries[0].ownership[field];
    f.put('truthsrc.ledger.json', JSON.stringify(ledger));
    await refuses(f, [entry(freshPath), entry()], /recorded ownership baseline/);
    ledger.entries[0].ownership[field] = 'sha256:not-a-digest';
    f.put('truthsrc.ledger.json', JSON.stringify(ledger));
    await refuses(f, [entry(freshPath), entry()], /recorded ownership baseline/);
  });
}

test('manual-only edits are preserved and receipted without source writes; changed generated shell merges', async t => {
  const f = fixture(t);
  const initial = entry(sourcePath, shell(1), { knowledgeIds: ['manual:key'] });
  await f.run([initial]);
  const custom = 'humanOverride("é") // handwritten';
  f.put(sourcePath, shell(1, custom));
  const before = snapshot(join(f.outDir, 'src'));
  const result = await f.run([initial], { update: true });
  assert.equal(result.written, 0);
  assert.equal(result.actions[0].outcome, 'IDENTICAL');
  assert.deepEqual(snapshot(join(f.outDir, 'src')), before);
  baseline(f, sourcePath);
  const next = [{ ...initial, content: shell(2, 'differentGeneratedDefault()') }];
  const preview = f.preview(next, { update: true });
  assert.equal(preview.actions[0].outcome, 'MERGE');
  const merged = await f.run(next, { update: true });
  assert.deepEqual(merged, preview);
  assert.equal(merged.merged, 1);
  assert.equal(f.read(sourcePath).toString(), shell(2, custom));
  assert.equal(f.index().anchors['manual:key'][0].fingerprint, hash(shell(2, custom)));
  baseline(f, sourcePath);
  const finalSource = snapshot(join(f.outDir, 'src'));
  await f.run(next, { update: true });
  assert.deepEqual(snapshot(join(f.outDir, 'src')), finalSource);
});

for (const [name, text, message] of [
  ['outside manual', shell(99, 'human()'), /outside MANUAL/],
  ['removed manual markers', shell(1).replace(/\/\/ ==== (?:BEGIN|END) MANUAL ====/g, ''), /outside MANUAL/],
  ['unpaired manual markers', shell(1).replace('// ==== END MANUAL ====', ''), /MANUAL.*畸形/],
  ['nested manual markers', shell(1).replace('generatedDefault()', '// ==== BEGIN MANUAL ====\n// ==== END MANUAL ===='), /MANUAL.*畸形/],
]) {
  test(`update refuses ${name} with zero writes`, async t => {
    const f = fixture(t);
    await f.run([entry(sourcePath, shell(1))]);
    f.put(sourcePath, text);
    await refuses(f, [entry(freshPath), entry(sourcePath, shell(2))], message);
  });
}

for (const content of [shell(2).replace('def execute(', 'def renamed('), 'object NoManualSlots {}\n']) {
  test('update never silently discards an orphan manual block', async t => {
    const f = fixture(t);
    await f.run([entry(sourcePath, shell(1))]);
    f.put(sourcePath, shell(1, 'mustSurvive()'));
    await refuses(f, [entry(freshPath), entry(sourcePath, content)], /手写块无落点/);
  });
}

test('owned marker merges also preserve MANUAL bodies and reject orphan blocks', async t => {
  const f = fixture(t);
  const route = (version, body) => entry('conf/routes',
    `# >>> gen_api_layer (E301) >>>\n${shell(version, body).replace(/\r\n/g, '\n')}# <<< gen_api_layer <<<`, { kind: 'routes', merge: 'markers' });
  const head = '# hand-owned header\n', tail = '\n# hand-owned footer\n';
  f.put('conf/routes', head + route(1).content + tail);
  await f.run([route(1)]);
  f.put('conf/routes', head + route(1, 'human()').content + tail);
  const result = await f.run([route(2)], { update: true });
  assert.equal(result.actions[0].outcome, 'MERGE');
  assert.equal(f.read('conf/routes').toString(), head + route(2, 'human()').content + tail);
  baseline(f, 'conf/routes', 'routes');
  const orphan = { ...route(3), content: '# >>> gen_api_layer (E301) >>>\nGET /new Controller.index\n# <<< gen_api_layer <<<' };
  await refuses(f, [entry(freshPath), orphan], /手写块无落点/);
});

test('deletion cannot transfer an existing ledger path to another owner or kind', async t => {
  const f = fixture(t);
  await f.run([entry()]);
  rmSync(join(f.outDir, sourcePath));
  await refuses(f, [entry(freshPath), entry()], /cross-owner/, { update: true, ownership: { id: 'new-owner' } });
  await refuses(f, [entry(freshPath), entry(sourcePath, 'object New {}\n', { kind: 'other-kind' })], /cross-kind/);
  const restored = await f.run([entry()], { update: true });
  assert.equal(restored.actions[0].outcome, 'ADD');
  baseline(f, sourcePath);
});

test('removed owned outputs stay physically and in ledger, classified retained rather than current actions', async t => {
  const f = fixture(t);
  const removed = 'src/Removed.scala';
  const missing = 'src/DeletedBeforeUpdate.scala';
  const other = 'other/Unrelated.scala';
  await f.run([entry(), entry(removed), entry(missing)]);
  await f.run([entry(other)], { ownership: { id: 'other-project' }, generator: { id: 'other-generator', version: '1' } });
  rmSync(join(f.outDir, missing));
  const removedSource = snapshot(join(f.outDir, removed));
  const rows = f.ledger().entries.filter(row => row.path !== sourcePath);
  const entries = [entry(sourcePath, 'object V2 {}\n')];
  const preview = f.preview(entries, { update: true });
  assert.deepEqual(preview.retained, [
    { path: removed, kind: 'source', outcome: 'RETAINED', changed: false, exists: true },
    { path: missing, kind: 'source', outcome: 'RETAINED', changed: false, exists: false },
  ]);
  assert.deepEqual(preview.actions.map(item => item.path), [sourcePath]);
  const result = await f.run(entries, { update: true });
  assert.deepEqual(result, preview);
  assert.deepEqual(f.ledger().entries.filter(row => row.path !== sourcePath), rows);
  assert.deepEqual(snapshot(join(f.outDir, removed)), removedSource);
  assert.equal(existsSync(join(f.outDir, missing)), false);
  const empty = await f.run([], { update: true });
  assert.equal(empty.actions.length, 0);
  assert.deepEqual(empty.retained.map(item => item.path), [sourcePath, removed, missing]);
  assert.equal(empty.retained.some(item => item.path === other), false);
});

test('ordinary ownership opt-in does not claim KEEP/MISSING or reclassify an unrelated IDENTICAL row', async t => {
  const f = fixture(t);
  const kept = entry('src/Kept.scala', 'object Kept {}\n', { families: ['Other'], knowledgeIds: ['old:kept'] });
  const unrelated = entry('src/Unrelated.scala', 'object Unrelated {}\n', { kind: 'different-kind' });
  const selected = entry('src/Selected.scala', 'object Selected {}\n', { families: ['Selected'] });
  await f.run([kept, unrelated, selected], { ownership: undefined });
  const prior = f.ledger().entries;
  const routes = entry('conf/routes', '# >>> gen_api_layer (E301) >>>\nGET /generated Controller.index\n# <<< gen_api_layer <<<',
    { kind: 'routes', merge: 'markers' });
  const result = await f.run([
    { ...kept, content: 'object Planned {}\n', knowledgeIds: ['new:kept'] },
    { ...unrelated, kind: 'source' }, selected, routes,
  ], { concern: f.concern() });
  assert.deepEqual(result.actions.map(item => item.outcome), ['KEEP', 'IDENTICAL', 'IDENTICAL', 'MISSING']);
  assert.deepEqual(f.ledger().entries.find(row => row.path === kept.path), prior[0]);
  assert.deepEqual(f.ledger().entries.find(row => row.path === unrelated.path), prior[1]);
  assert.equal(f.ledger().entries.some(row => row.path === routes.path), false);
  assert.equal(f.index().anchors['new:kept'], undefined);
  baseline(f, selected.path);
});

test('ordinary opt-in preserves an unrelated project ownership row on IDENTICAL', async t => {
  const f = fixture(t);
  await f.run([entry()]);
  const prior = f.ledger().entries;
  await f.run([entry(sourcePath, entry().content, { schemaCategory: 'different' })], { ownership: { id: 'other-project' } });
  assert.deepEqual(f.ledger().entries, prior);
});

test('legacy no-ownership overwrite refusal, concern COVER, and noLedger marker behavior remain', async t => {
  const f = fixture(t);
  const legacy = { ownership: undefined };
  await f.run([entry()], legacy);
  await refuses(f, [entry(sourcePath, 'object V2 {}\n')], /refusing to overwrite/, legacy);
  const covered = await f.run([entry(sourcePath, 'object V2 {}\n')], { ...legacy, concern: f.concern(null) });
  assert.equal(covered.actions[0].outcome, 'COVER');
  assert.equal(f.ledger().entries[0].ownership, undefined);
  f.put('conf/routes', '# handwritten routes\n');
  const routes = entry('conf/routes', '# >>> gen_api_layer (E301) >>>\nGET /generated Controller.index\n# <<< gen_api_layer <<<',
    { kind: 'routes', merge: 'markers', noLedger: true });
  const merged = await f.run([routes]);
  assert.equal(merged.actions[0].outcome, 'MERGE');
  assert.equal(f.ledger().entries.some(row => row.path === routes.path), false);
  await refuses(f, [routes], /recorded ownership baseline/);
});

for (const [extra, pattern] of [
  [{ ownership: undefined, update: true }, /update requires ownership/],
  [{ ownership: null }, /ownership requires/],
  [{ ownership: { id: '' } }, /ownership requires/],
  [{ ownership: { id: 'bad\0id' } }, /ownership requires/],
  [{ update: 'true' }, /update must be a boolean/],
  [{ expectedFiles: [{ path: 'absent', fingerprint: 'not-sha256' }] }, /expectedFiles require/],
  [{ expectedFiles: [{ path: 'absent' }] }, /expectedFiles require/],
]) {
  test('invalid update/ownership/precondition options refuse before directory creation', async t => {
    const f = fixture(t);
    await refuses(f, [entry()], pattern, extra);
    assert.equal(existsSync(f.outDir), false);
  });
}

for (const [path, expected] of [
  [sourcePath, null], [sourcePath, hash('different')], ['absent.txt', hash('required')],
  ['truthsrc.ledger.json', null], ['anchors.json', hash('wrong')], ['extra.txt', hash('wrong')],
]) {
  test(`expectedFiles mismatch on ${path} refuses preview and all writes`, async t => {
    const f = fixture(t);
    await f.run([entry()]);
    f.put('extra.txt', 'extra content');
    await refuses(f, [entry(freshPath), entry(sourcePath, 'object V2 {}\n')], /expected file precondition mismatch/,
      { update: true, expectedFiles: [{ path, fingerprint: expected }] });
  });
}

test('explicit expected bytes and absence, including receipts and non-output files, permit matching update', async t => {
  const f = fixture(t);
  await f.run([entry()]);
  f.put('extra.txt', 'stable extra');
  const expectedFiles = [sourcePath, 'truthsrc.ledger.json', 'anchors.json', 'extra.txt']
    .map(path => ({ path, fingerprint: hash(f.read(path)) }));
  expectedFiles.push({ path: freshPath, fingerprint: null });
  const entries = [entry(freshPath), entry(sourcePath, 'object V2 {}\n')];
  const preview = f.preview(entries, { update: true, expectedFiles });
  const applied = await f.run(entries, { update: true, expectedFiles });
  assert.deepEqual(applied, preview);
  assert.equal(f.read('extra.txt').toString(), 'stable extra');
});

for (const [paths, pattern] of [
  [['../escape'], /unsafe entry path/], [['/absolute'], /unsafe entry path/],
  [['C:/absolute'], /unsafe entry path/], [['bad\\path'], /unsafe entry path/],
  [['extra', 'EXTRA'], /duplicate\/case-fold expected path/],
  [['SRC/Another.scala'], /case-fold.*alias/],
  [[`${sourcePath}/child`], /file\/directory output collision/],
  [['extra/One', 'EXTRA/Two'], /case-fold path component alias/],
  [['ANCHORS.JSON'], /case-fold.*alias/],
]) {
  test('expected-only paths participate in traversal, alias, and output collision checks', async t => {
    const f = fixture(t);
    await f.run([entry()]);
    await refuses(f, [entry(freshPath), entry()], pattern,
      { update: true, expectedFiles: paths.map(path => ({ path, fingerprint: null })) });
  });
}

for (const makeLink of [symlinkSync, linkSync]) {
  test('expected-only link paths cannot bypass path safety', async t => {
    const f = fixture(t);
    await f.run([entry()]);
    const external = join(f.root, 'external');
    writeFileSync(external, 'external bytes');
    makeLink(external, join(f.outDir, 'alias'));
    await refuses(f, [entry(freshPath), entry()], /symlink apply path|hardlink apply target/,
      { update: true, expectedFiles: [{ path: 'alias', fingerprint: hash('external bytes') }] });
  });
}

test('an approved preview can be pinned; later valid manual edits still fail its exact expectedFiles', async t => {
  const f = fixture(t);
  await f.run([entry(sourcePath, shell(1))]);
  const entries = [entry(sourcePath, shell(2))];
  const approved = f.preview(entries, { update: true });
  f.put(sourcePath, shell(1, 'laterHumanEdit()'));
  await refuses(f, entries, /expected file precondition mismatch/,
    { update: true, expectedFiles: approved.expectedFiles });
  assert.equal(f.preview(entries, { update: true }).actions[0].outcome, 'MERGE');
});

// Mutate immediately after a captured read, before full preparation completes. This does not
// simulate locking: it verifies ordinary optimistic drift is caught before our first write.
function mutateAfterRead(t, target, mutate) {
  const original = fs.readFileSync;
  let fired = false;
  const mock = t.mock.method(fs, 'readFileSync', function(file, ...args) {
    const bytes = original.call(this, file, ...args);
    if (!fired && file === target) { fired = true; mutate(); }
    return bytes;
  });
  syncBuiltinESMExports();
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports(); });
  return () => fired;
}

for (const mode of ['preview', 'apply']) {
  for (const path of [sourcePath, evidencePath, 'truthsrc.ledger.json', 'anchors.json']) {
    test(`${mode} catches captured ${path} racing during preflight before any writes`, async t => {
      const f = fixture(t);
      await f.run([entry(), evidence(1)]);
      const original = f.read(path);
      let afterMutation;
      const fired = mutateAfterRead(t, join(f.outDir, path), () => {
        f.put(path, Buffer.concat([original, Buffer.from(' ')]));
        afterMutation = snapshot(f.root);
      });
      const entries = [entry(freshPath), entry(sourcePath, 'object V2 {}\n'), evidence(2)];
      if (mode === 'preview') assert.throws(() => f.preview(entries, { update: true }), /apply precondition changed/);
      else await assert.rejects(f.run(entries, { update: true }), /apply precondition changed/);
      assert.equal(fired(), true);
      assert.deepEqual(snapshot(f.root), afterMutation, 'core wrote after the injected race');
      assert.equal(existsSync(join(f.outDir, freshPath)), false);
    });
  }
}

for (const mode of ['preview', 'apply']) {
  test(`${mode} rechecks expected-only files after full preflight`, async t => {
    const f = fixture(t);
    await f.run([entry()]);
    f.put('extra.txt', 'approved extra');
    let afterMutation;
    const fired = mutateAfterRead(t, join(f.outDir, 'extra.txt'), () => {
      f.put('extra.txt', 'racing extra');
      afterMutation = snapshot(f.root);
    });
    const extra = { update: true, expectedFiles: [{ path: 'extra.txt', fingerprint: hash('approved extra') }] };
    if (mode === 'preview') assert.throws(() => f.preview([entry(freshPath), entry()], extra), /apply precondition changed/);
    else await assert.rejects(f.run([entry(freshPath), entry()], extra), /apply precondition changed/);
    assert.equal(fired(), true);
    assert.deepEqual(snapshot(f.root), afterMutation);
  });

  test(`${mode} catches a captured absent output appearing during preflight`, async t => {
    const f = fixture(t);
    await f.run([entry()]);
    let afterMutation;
    const fired = mutateAfterRead(t, join(f.outDir, 'truthsrc.ledger.json'), () => {
      f.put(freshPath, 'created by concurrent writer');
      afterMutation = snapshot(f.root);
    });
    const entries = [entry(freshPath), entry(sourcePath, 'object V2 {}\n')];
    if (mode === 'preview') assert.throws(() => f.preview(entries, { update: true }), /apply precondition changed/);
    else await assert.rejects(f.run(entries, { update: true }), /apply precondition changed/);
    assert.equal(fired(), true);
    assert.deepEqual(snapshot(f.root), afterMutation);
  });

  test(`${mode} catches a previously absent receipt appearing after capture`, async t => {
    const f = fixture(t);
    f.put('extra.txt', 'guard bytes');
    let afterMutation;
    const fired = mutateAfterRead(t, join(f.outDir, 'extra.txt'), () => {
      f.put('truthsrc.ledger.json', '{"entries":[]}\n');
      afterMutation = snapshot(f.root);
    });
    const extra = { expectedFiles: [{ path: 'extra.txt', fingerprint: hash('guard bytes') }] };
    if (mode === 'preview') assert.throws(() => f.preview([entry()], extra), /apply precondition changed/);
    else await assert.rejects(f.run([entry()], extra), /apply precondition changed/);
    assert.equal(fired(), true);
    assert.deepEqual(snapshot(f.root), afterMutation);
    assert.equal(existsSync(join(f.outDir, sourcePath)), false);
  });
}
