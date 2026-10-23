import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import {
  ANCHORS_VERSION, readAnchorsIndex, migrateLegacyAnchorsIndex,
  planAnchors, verifyAnchorsPlan, writeAnchorsIndex,
} from '../src/core/anchors.mjs';

const digest = source => `sha256:${createHash('sha256').update(source).digest('hex')}`;
const empty = () => ({ version: ANCHORS_VERSION, anchors: {} });
const generator = { id: 'example-generator', version: '1.0.0' };
const loc = (file, extra = {}) => ({ repo: 'owned', file, ...extra });
const group = (knowledgeKey, ...locations) => ({ knowledgeKey, locations });
const outcome = (file, value = 'ADD', extra = {}) => ({ ...loc(file), outcome: value, ...extra });
const makePlan = (groups = [], outcomes = [], extra = {}) => planAnchors({
  generator, plannedKnowledgeKeys: groups, finalApplyOutcomes: outcomes, ...extra,
});
const exactSpan = (source, text) => {
  const bytes = Buffer.from(source);
  const start = bytes.indexOf(Buffer.from(text));
  return { start, end: start + Buffer.byteLength(text), text };
};
const jsParser = ({ source }) => ({
  method: 'test-js-declaration-parser/v1',
  symbols: [...source.toString('utf8').matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)]
    .map(match => {
      const charStart = match.index + match[0].lastIndexOf(match[1]);
      const start = Buffer.byteLength(source.toString('utf8').slice(0, charStart));
      return { symbol: match[1], span: { start, end: start + Buffer.byteLength(match[1]), text: match[1] } };
    }),
});
async function tree(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'truthsrc-anchors-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return {
    root, repoRoots: { owned: root }, indexLocation: loc('anchors.json'),
    async put(file, source) {
      const absolute = path.join(root, file);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, source);
      return absolute;
    },
    async read(file) { return fs.readFile(path.join(root, file), 'utf8'); },
  };
}
async function certify(tree, file, { key = 'domain:key', extra = {}, owner = generator } = {}) {
  return verifyAnchorsPlan(makePlan([group(key, loc(file, extra))], [outcome(file)], { generator: owner }), tree);
}
function entry(index, key = 'domain:key') { return index.anchors[key][0]; }

// All filesystem tests are confined to the temporary owned trees created above.
test('pure plan is detached, multi-valued, and never certifies planned templates', () => {
  const source = 'export function One() {}\n';
  const input = [group('domain:key', loc('One.mjs', { symbol: 'One', expectedFingerprint: digest(source) }), loc('Two.mjs'))];
  const plan = makePlan(input, [outcome('One.mjs', 'KEEP'), outcome('Two.mjs', 'ADD')]);
  assert.equal(plan.declarations.length, 2);
  for (const { location } of plan.declarations) {
    assert.equal(location.status, 'planned');
    assert.equal(location.fingerprint, null);
    assert.equal(location.verification.fileVerified, false);
  }
  input[0].locations[0].symbol = 'Mutation';
  assert.equal(plan.declarations[0].location.symbol, 'One');
});

test('one knowledge key retains multiple files, symbols and generator-declared modules/spans', async t => {
  const owned = await tree(t);
  const one = '/* é */\nexport function One() {}\n';
  const two = 'export class Two {}\n';
  await owned.put('domain/One.mjs', one);
  await owned.put('application/Two.mjs', two);
  const plan = makePlan([group('domain:key',
    loc('domain/One.mjs', { module: 'domain', symbol: 'One', span: exactSpan(one, 'export function One() {}') }),
    loc('application/Two.mjs', { module: 'application', symbol: 'Two' }),
  )], [outcome('domain/One.mjs'), outcome('application/Two.mjs')]);
  const result = await writeAnchorsIndex(plan, { ...owned, parseSymbols: jsParser });
  assert.equal(result.version, ANCHORS_VERSION);
  assert.equal(result.anchors['domain:key'].length, 2);
  for (const location of result.anchors['domain:key']) {
    assert.equal(location.status, 'source-verified');
    assert.equal(location.verification.level, 'symbol');
    assert.equal(location.verification.symbolVerified, true);
    assert.match(location.fingerprint, /^sha256:/);
  }
  assert.equal(result.anchors['domain:key'][0].verification.spanVerified, true);
  assert.deepEqual(readAnchorsIndex(await owned.read('anchors.json')), result);
  assert.deepEqual((await fs.readdir(owned.root)).sort(), ['anchors.json', 'application', 'domain']);
});

test('successful path-scoped replacement preserves other paths and other generators without reading them', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function OldA() {}');
  await owned.put('b.mjs', 'function B() {}');
  const old = await verifyAnchorsPlan(makePlan([
    group('old', loc('a.mjs', { symbol: 'OldA' })), group('b', loc('b.mjs')),
  ], [outcome('a.mjs'), outcome('b.mjs')]), { ...owned, parseSymbols: jsParser });
  const foreign = structuredClone(entry(await certify(owned, 'a.mjs')));
  foreign.generator = 'other-generator';
  foreign.repo = 'foreign-no-root';
  old.anchors.old.push(foreign);
  old.anchors.foreignOnly = [{ ...structuredClone(foreign), file: 'do-not-read.mjs' }];
  await owned.put('a.mjs', 'function NewA() {}');
  const result = await verifyAnchorsPlan(makePlan([group('new', loc('a.mjs', { symbol: 'NewA' }))],
    [outcome('a.mjs', 'COVER')], { priorIndex: old }), { ...owned, parseSymbols: jsParser });
  assert.deepEqual(result.anchors.old, [foreign]);
  assert.deepEqual(result.anchors.foreignOnly, old.anchors.foreignOnly);
  assert.equal(result.anchors.b[0].status, 'source-verified');
  assert.equal(result.anchors.new[0].symbol, 'NewA');
});

test('KEEP hashes actual changed content, ignores planned templates, and cannot claim a missing symbol', async t => {
  const owned = await tree(t);
  const expected = 'function Intended() {}';
  const actual = 'function HumanOwned() { return 42; }';
  await owned.put('kept.mjs', actual);
  const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('kept.mjs', {
    symbol: 'Intended', expectedFingerprint: digest(expected),
  }))], [outcome('kept.mjs', 'KEEP')]), { ...owned, parseSymbols: jsParser });
  const location = entry(result);
  assert.equal(location.fingerprint, digest(actual));
  assert.notEqual(location.fingerprint, digest(expected));
  assert.equal(location.status, 'source-verified');
  assert.equal(location.verification.level, 'file');
  assert.equal(location.verification.symbolVerified, false);
  assert.equal(await owned.read('kept.mjs'), actual);
});

test('KEEP with changed content and generator-declared stale span must not reuse planned anchors', async t => {
  const owned = await tree(t);
  const expected = 'function Intended() {}';
  await owned.put('kept.mjs', 'function Renamed_() {}');
  const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('kept.mjs', {
    symbol: 'Intended', span: exactSpan(expected, 'Intended'), expectedFingerprint: digest(expected),
  }))], [outcome('kept.mjs', 'KEEP')]), { ...owned, parseSymbols: jsParser });
  assert.equal(entry(result).status, 'stale');
  assert.equal(entry(result).verification.reason, 'declared-span-source-mismatch');
  assert.equal(entry(result).verification.symbolVerified, false);
});

test('KEEP retains distinct prior anchors and can refresh authentic matching symbol evidence with a source check', async t => {
  const owned = await tree(t);
  await owned.put('kept.mjs', 'function Prior() {}\nfunction New() {}');
  const old = await verifyAnchorsPlan(makePlan([group('domain:key', loc('kept.mjs', { symbol: 'Prior' }))],
    [outcome('kept.mjs')]), { ...owned, parseSymbols: jsParser });
  const checked = await verifyAnchorsPlan(makePlan([group('domain:key', loc('kept.mjs', { symbol: 'Prior' }),
    loc('kept.mjs', { symbol: 'New' }))], [outcome('kept.mjs', 'KEEP')], { priorIndex: old }), owned);
  assert.equal(checked.anchors['domain:key'].length, 2);
  const prior = checked.anchors['domain:key'].find(item => item.symbol === 'Prior');
  const current = checked.anchors['domain:key'].find(item => item.symbol === 'New');
  assert.equal(prior.verification.symbolVerified, true);
  assert.equal(current.verification.symbolVerified, false);
  assert.equal(current.verification.level, 'file');
});

test('KEEP prior evidence is invalidated by actual byte changes and generator version changes', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const old = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', { symbol: 'A' }))],
    [outcome('a.mjs')]), { ...owned, parseSymbols: jsParser });
  await owned.put('a.mjs', 'function B() {}');
  const changed = await verifyAnchorsPlan(makePlan([], [outcome('a.mjs', 'KEEP')], { priorIndex: old }), owned);
  assert.equal(entry(changed).status, 'stale');
  assert.equal(entry(changed).verification.reason, 'source-fingerprint-changed');
  await owned.put('a.mjs', 'function A() {}');
  const versioned = await verifyAnchorsPlan(makePlan([], [outcome('a.mjs', 'KEEP')], {
    priorIndex: old, generator: { ...generator, version: '2.0.0' },
  }), owned);
  assert.equal(entry(versioned).status, 'stale');
  assert.equal(entry(versioned).verification.reason, 'generator-version-changed');
});

test('rename/delete do not delete human files; old location stays unmapped and new path is separately mapped', async t => {
  const owned = await tree(t);
  await owned.put('old.mjs', 'function A() {}');
  const prior = await certify(owned, 'old.mjs');
  await fs.rename(path.join(owned.root, 'old.mjs'), path.join(owned.root, 'new.mjs'));
  const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('new.mjs'))],
    [outcome('old.mjs', 'MISSING'), outcome('new.mjs', 'ADD')], { priorIndex: prior }), owned);
  assert.equal(result.anchors['domain:key'].length, 2);
  assert.equal(result.anchors['domain:key'].find(item => item.file === 'old.mjs').status, 'unmapped');
  assert.equal(result.anchors['domain:key'].find(item => item.file === 'new.mjs').status, 'source-verified');
  await fs.unlink(path.join(owned.root, 'new.mjs'));
  const deleted = await verifyAnchorsPlan(makePlan([], [], { priorIndex: result }), owned);
  assert.equal(deleted.anchors['domain:key'].length, 2);
  assert.ok(deleted.anchors['domain:key'].every(item => item.status === 'unmapped'));
});

test('stale prior fingerprint is never reused, including after legacy migration', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const prior = await certify(owned, 'a.mjs');
  entry(prior).fingerprint = digest('different');
  const result = await verifyAnchorsPlan(makePlan([], [outcome('a.mjs', 'KEEP')], { priorIndex: prior }), owned);
  assert.equal(entry(result).status, 'stale');
  assert.equal(entry(result).verification.fileVerified, false);
});

test('MISSING and FAILED never certify existing source from planned output and retain prior locations', async t => {
  const owned = await tree(t);
  const human = '/* human owned */ function A() {}';
  await owned.put('a.mjs', human);
  const old = await certify(owned, 'a.mjs');
  for (const value of ['MISSING', 'FAILED']) {
    const result = await verifyAnchorsPlan(makePlan([group('new:key', loc('a.mjs'))],
      [outcome('a.mjs', value)], { priorIndex: old }), owned);
    assert.equal(entry(result).status, 'stale');
    assert.equal(entry(result, 'new:key').status, 'stale');
    assert.equal(entry(result, 'new:key').verification.fileVerified, false);
    assert.equal(await owned.read('a.mjs'), human);
  }
  const missing = await verifyAnchorsPlan(makePlan([group('missing', loc('missing.mjs'))],
    [outcome('missing.mjs', 'ADD')]), owned);
  assert.equal(entry(missing, 'missing').status, 'unmapped');
});

test('a missing final outcome stays planned even when source bytes exist', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs'))]), owned);
  assert.equal(entry(result).status, 'planned');
  assert.equal(entry(result).fingerprint, null);
});

test('final bytehash guards ADD/COVER/IDENTICAL; MERGE uses final bytes, not a pre-merge template', async t => {
  const owned = await tree(t);
  const source = 'function A() {} // human merge';
  await owned.put('a.mjs', source);
  for (const value of ['ADD', 'COVER', 'IDENTICAL']) {
    const bad = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', {
      expectedFingerprint: digest('function A() {}'),
    }))], [outcome('a.mjs', value)]), owned);
    assert.equal(entry(bad).status, 'stale');
  }
  const merge = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', {
    expectedFingerprint: digest('function A() {}'),
  }))], [outcome('a.mjs', 'MERGE', { fingerprint: digest(source) })]), owned);
  assert.equal(entry(merge).fingerprint, digest(source));
  assert.equal(entry(merge).status, 'source-verified');
  const changed = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs'))],
    [outcome('a.mjs', 'KEEP', { fingerprint: digest('stale receipt') })]), owned);
  assert.equal(entry(changed).status, 'stale');
});

test('no module/symbol inference; absent parser or actual symbol gives only file verification', async t => {
  const owned = await tree(t);
  await owned.put('src/domain/Thing.mjs', 'const name = "Fake"; // function Fake, not a declaration');
  const plan = makePlan([group('domain:key', loc('src/domain/Thing.mjs', { symbol: 'Fake' }))],
    [outcome('src/domain/Thing.mjs')]);
  const noParser = await verifyAnchorsPlan(plan, owned);
  assert.equal(entry(noParser).module, null);
  assert.equal(entry(noParser).symbol, 'Fake');
  assert.equal(entry(noParser).verification.symbolVerified, false);
  assert.equal(entry(noParser).verification.level, 'file');
  const parsed = await verifyAnchorsPlan(plan, { ...owned, parseSymbols: () => ({ method: 'empty-language-parser', symbols: [] }) });
  assert.equal(entry(parsed).verification.level, 'file');
  assert.equal(entry(parsed).verification.symbolVerified, false);
  const fileOnly = await certify(owned, 'src/domain/Thing.mjs');
  assert.equal(entry(fileOnly).symbol, null);
  assert.equal(entry(fileOnly).module, null);
  assert.equal(entry(fileOnly).span, null);
});

test('parser gets post-apply actual bytes and cannot mutate the bytes used to fingerprint/verify', async t => {
  const owned = await tree(t);
  const source = 'function A() {}';
  await owned.put('a.mjs', source);
  const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', { symbol: 'A' }))],
    [outcome('a.mjs', 'MERGE')]), { ...owned, parseSymbols: input => {
    assert.equal(input.source.toString(), source);
    const parsed = jsParser(input);
    input.source.fill(0);
    return parsed;
  } });
  assert.equal(entry(result).fingerprint, digest(source));
  assert.equal(entry(result).verification.symbolVerified, true);
});

test('parser symbol/span must quote literal source, lie outside no declared span and be unambiguous', async t => {
  const owned = await tree(t);
  const source = 'function A() {}\nfunction B() {}';
  await owned.put('a.mjs', source);
  const plan = makePlan([group('domain:key', loc('a.mjs', { symbol: 'A' }))], [outcome('a.mjs')]);
  const mismatch = await verifyAnchorsPlan(plan, { ...owned, parseSymbols: () => ({
    method: 'test-parser', symbols: [{ symbol: 'A', span: { start: 0, end: 1, text: 'A' } }],
  }) });
  assert.equal(entry(mismatch).status, 'stale');
  assert.equal(entry(mismatch).verification.reason, 'symbol-source-mismatch');
  const outside = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', {
    symbol: 'A', span: exactSpan(source, 'function B() {}'),
  }))], [outcome('a.mjs')]), { ...owned, parseSymbols: jsParser });
  assert.equal(entry(outside).status, 'stale');
  assert.equal(entry(outside).verification.reason, 'symbol-span-mismatch');
  await owned.put('a.mjs', 'function A() {}\nfunction A() {}');
  const ambiguous = await verifyAnchorsPlan(plan, { ...owned, parseSymbols: jsParser });
  assert.equal(entry(ambiguous).verification.symbolVerified, false);
  assert.equal(entry(ambiguous).verification.level, 'file');
});

test('span is only generator-declared UTF-8 byte span, never parser-inferred into location', async t => {
  const owned = await tree(t);
  const source = '// 中文\nfunction A() {}';
  await owned.put('a.mjs', source);
  const noSpan = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', { symbol: 'A' }))],
    [outcome('a.mjs')]), { ...owned, parseSymbols: jsParser });
  assert.equal(entry(noSpan).span, null);
  assert.equal(entry(noSpan).verification.symbolVerified, true);
  const matchedSpanNoSymbol = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', {
    symbol: 'A', span: exactSpan(source, 'function A() {}'),
  }))], [outcome('a.mjs')]), { ...owned, parseSymbols: () => ({ method: 'no-symbol-parser', symbols: [] }) });
  assert.equal(entry(matchedSpanNoSymbol).verification.level, 'file');
  assert.equal(entry(matchedSpanNoSymbol).verification.spanVerified, false);
  const declared = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', {
    span: exactSpan(source, 'function A() {}'),
  }))], [outcome('a.mjs')]), owned);
  assert.equal(entry(declared).verification.level, 'span');
  assert.equal(entry(declared).verification.spanVerified, true);
  const wrong = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs', {
    span: { start: 0, end: 1, text: 'A' },
  }))], [outcome('a.mjs')]), owned);
  assert.equal(entry(wrong).status, 'stale');
  assert.throws(() => makePlan([group('bad', loc('a.mjs', { span: { start: 0, end: 1, text: 'é' } }))]), /UTF-8/);
});

test('legacy reader requires explicit migration, converts one value to planned array and discards fake evidence', async t => {
  const owned = await tree(t);
  const old = { anchors: {
    one: { path: 'a.mjs', repo: 'owned', module: 'domain', symbol: 'A',
      fingerprint: digest('fake'), status: 'source-verified', span: { fake: true },
      verification: { symbolVerified: true } }, two: 'b.mjs',
  } };
  assert.throws(() => readAnchorsIndex(old), { code: 'ANCHORS_LEGACY' });
  const migrated = readAnchorsIndex(old, { legacy: 'planned', legacyDefaults: { repo: 'owned' } });
  assert.equal(migrated.version, ANCHORS_VERSION);
  assert.equal(migrated.anchors.one.length, 1);
  for (const location of Object.values(migrated.anchors).flat()) {
    assert.equal(location.status, 'planned');
    assert.equal(location.fingerprint, null);
    assert.equal(location.span, null);
    assert.equal(location.verification.symbolVerified, false);
  }
  assert.deepEqual(migrateLegacyAnchorsIndex(old, { repo: 'owned' }), migrated);
  assert.throws(() => readAnchorsIndex({ version: 'truthsrc.anchors/v2', anchors: {} }, { legacy: 'planned' }), /Unsupported/);
  assert.throws(() => readAnchorsIndex({ version: ANCHORS_VERSION, anchors: { key: loc('a.mjs') } }), /arrays/);
  await owned.put('a.mjs', 'function A() {}');
  const checked = await verifyAnchorsPlan(makePlan([], [outcome('a.mjs', 'KEEP')], {
    priorIndex: migrated, generator: { id: 'legacy', version: 'unknown' },
  }), owned);
  assert.equal(entry(checked, 'one').verification.symbolVerified, false);
  assert.notEqual(entry(checked, 'one').status, 'source-verified');
});

test('legacy migration can be committed explicitly to its own derived index without authenticating old anchors', async t => {
  const owned = await tree(t);
  const old = { key: { file: 'a.mjs', repo: 'owned' } };
  await owned.put('a.mjs', 'function A() {}');
  await owned.put('anchors.json', JSON.stringify(old));
  const priorIndex = readAnchorsIndex(old, { legacy: 'planned', legacyDefaults: { repo: 'owned' } });
  const result = await writeAnchorsIndex(makePlan([], [], { priorIndex }), owned);
  assert.equal(entry(result, 'key').status, 'planned');
  assert.equal(entry(result, 'key').verification.fileVerified, false);
});

test('lexical escaping/absolute/backslash paths fail before any writes', async t => {
  const owned = await tree(t);
  for (const file of ['../outside', '/tmp/outside', 'a/../../x', 'a/./x', 'a//x', 'C:\\outside', 'a\\x']) {
    assert.throws(() => makePlan([group('key', loc(file))]), { code: 'ANCHORS_PATH' });
  }
  await assert.rejects(writeAnchorsIndex(makePlan(), { ...owned, indexLocation: loc('../index.json') }), { code: 'ANCHORS_PATH' });
  assert.deepEqual(await fs.readdir(owned.root), []);
});

test('escaping symlink, ancestor symlink and dangling symlink fail preflight with no verified receipt', async t => {
  const owned = await tree(t);
  const outside = await tree(t);
  await outside.put('external.mjs', 'outside');
  await fs.symlink(path.join(outside.root, 'external.mjs'), path.join(owned.root, 'link.mjs'));
  await fs.symlink(outside.root, path.join(owned.root, 'dir'));
  await fs.symlink(path.join(outside.root, 'absent'), path.join(owned.root, 'dangling.mjs'));
  for (const file of ['link.mjs', 'dir/external.mjs', 'dir/not-yet-created.mjs', 'dangling.mjs']) {
    await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc(file))], [outcome(file)]), owned), { code: 'ANCHORS_PATH' });
  }
  assert.equal(await outside.read('external.mjs'), 'outside');
  assert.ok(!(await fs.readdir(owned.root)).some(name => name.includes('anchors')));
});

test('inside symlinks are allowed once, but realpath/hardlink aliases are rejected across paths/repos', async t => {
  const owned = await tree(t);
  await owned.put('actual.mjs', 'function A() {}');
  await fs.symlink('actual.mjs', path.join(owned.root, 'link.mjs'));
  const once = await verifyAnchorsPlan(makePlan([group('key', loc('link.mjs'))], [outcome('link.mjs')]), owned);
  assert.equal(entry(once, 'key').status, 'source-verified');
  await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('actual.mjs'), loc('link.mjs'))],
    [outcome('actual.mjs'), outcome('link.mjs')]), owned), { code: 'ANCHORS_ALIAS' });
  await fs.link(path.join(owned.root, 'actual.mjs'), path.join(owned.root, 'hard.mjs'));
  await assert.rejects(verifyAnchorsPlan(makePlan([group('key', loc('actual.mjs'), loc('hard.mjs'))],
    [outcome('actual.mjs'), outcome('hard.mjs')]), owned), { code: 'ANCHORS_ALIAS' });
  await assert.rejects(verifyAnchorsPlan(makePlan([group('key', loc('actual.mjs'), {
    ...loc('actual.mjs'), repo: 'same-root-other-name',
  })], [outcome('actual.mjs')]), { ...owned, repoRoots: { ...owned.repoRoots, 'same-root-other-name': owned.root } }),
  { code: 'ANCHORS_ALIAS' });
});

test('casefold duplicate paths and existing directory aliases fail even before source parsing', async t => {
  const owned = await tree(t);
  await owned.put('Dir/Foo.mjs', 'function A() {}');
  let parsed = 0;
  for (const paths of [['Dir/Foo.mjs', 'Dir/foo.mjs'], ['dir/Foo.mjs'], ['missing.mjs', 'MISSING.mjs']]) {
    await assert.rejects(writeAnchorsIndex(makePlan([group('key', ...paths.map(file => loc(file)))],
      paths.map(file => outcome(file))), { ...owned, parseSymbols: () => { parsed++; return null; } }), { code: 'ANCHORS_ALIAS' });
  }
  assert.equal(parsed, 0);
  assert.deepEqual(await fs.readdir(owned.root), ['Dir']);
});

test('preflight includes unplanned final outcomes before opening any index temporary file', async t => {
  const owned = await tree(t);
  const outside = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  await fs.symlink(outside.root, path.join(owned.root, 'escape'));
  let writes = 0;
  const io = { ...fs, async open(...args) { if (args[1] === 'wx') writes++; return fs.open(...args); } };
  await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('a.mjs'))],
    [outcome('a.mjs'), outcome('escape/no.mjs', 'FAILED')]), { ...owned, io }), { code: 'ANCHORS_PATH' });
  assert.equal(writes, 0);
});

test('derived anchors/source maps never participate in source digest/anchoring; explicit names avoid self references', async t => {
  const owned = await tree(t);
  for (const file of ['anchors.json', 'truthsrc.anchors.json', 'sourceMap.json', 'gen.source-map.json', 'bundle.mjs.map']) {
    assert.throws(() => makePlan([group('key', loc(file))]), { code: 'ANCHORS_SELF_REFERENCE' });
  }
  assert.throws(() => makePlan([group('key', loc('custom.json'))], [], { derivedFiles: [loc('custom.json')] }),
    { code: 'ANCHORS_SELF_REFERENCE' });
  await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('custom.json'))], [outcome('custom.json')]),
    { ...owned, indexLocation: loc('custom.json') }), { code: 'ANCHORS_SELF_REFERENCE' });
  const prior = empty();
  prior.anchors.old = [{ ...loc('sourceMap.json'), module: null, symbol: null, span: null,
    generator: generator.id, generatorVersion: generator.version, fingerprint: null,
    status: 'planned', verification: { method: 'none', level: 'none', fileVerified: false,
      spanVerified: false, symbolVerified: false, reason: 'legacy-unverified' } }];
  await owned.put('sourceMap.json', 'not valid JSON and must not be hashed');
  let reads = 0;
  const io = { ...fs, async open(...args) {
    if (String(args[0]).endsWith('sourceMap.json')) reads++;
    return fs.open(...args);
  } };
  const result = await writeAnchorsIndex(makePlan([], [], { priorIndex: prior }), { ...owned, io });
  assert.equal(reads, 0);
  assert.equal(entry(result, 'old').status, 'unmapped');
});

test('failed atomic rename leaves prior index unchanged, returns no certificate and removes only its own temp', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const prior = await writeAnchorsIndex(makePlan([group('domain:key', loc('a.mjs'))], [outcome('a.mjs')]), owned);
  const original = await owned.read('anchors.json');
  await owned.put('.anchors.json.tmp-unknown', 'do not delete');
  await owned.put('a.mjs', 'function B() {}');
  let returned;
  const io = { ...fs, async rename() { throw Object.assign(new Error('injected rename failure'), { code: 'EIO' }); } };
  await assert.rejects(async () => {
    returned = await writeAnchorsIndex(makePlan([group('domain:key', loc('a.mjs'))],
      [outcome('a.mjs', 'COVER')], { priorIndex: prior }), { ...owned, io });
  }, /injected rename failure/);
  assert.equal(returned, undefined);
  assert.equal(await owned.read('anchors.json'), original);
  assert.equal(await owned.read('.anchors.json.tmp-unknown'), 'do not delete');
  assert.deepEqual((await fs.readdir(owned.root)).sort(), ['.anchors.json.tmp-unknown', 'a.mjs', 'anchors.json']);
});

test('failed first index write/sync creates no verified receipt and no temp residue', async t => {
  for (const step of ['writeFile', 'sync']) {
    const owned = await tree(t);
    await owned.put('a.mjs', 'function A() {}');
    const io = { ...fs, async open(...args) {
      const handle = await fs.open(...args);
      if (args[1] !== 'wx') return handle;
      return {
        stat: () => handle.stat(), close: () => handle.close(),
        writeFile: (...values) => step === 'writeFile' ? Promise.reject(new Error('injected writeFile')) : handle.writeFile(...values),
        sync: () => step === 'sync' ? Promise.reject(new Error('injected sync')) : handle.sync(),
      };
    } };
    await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('a.mjs'))], [outcome('a.mjs')]),
      { ...owned, io }), /injected/);
    assert.deepEqual(await fs.readdir(owned.root), ['a.mjs']);
  }
});

test('unknown existing index/JSON, symlink index, missing parent cannot be overwritten', async t => {
  const owned = await tree(t);
  const outside = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const plan = makePlan([group('key', loc('a.mjs'))], [outcome('a.mjs')]);
  await owned.put('anchors.json', '{"unrelated":"human"}');
  await assert.rejects(writeAnchorsIndex(plan, owned), { code: 'ANCHORS_LEGACY' });
  assert.equal(await owned.read('anchors.json'), '{"unrelated":"human"}');
  await assert.rejects(writeAnchorsIndex(plan, { ...owned, indexLocation: loc('absent/anchors.json') }), { code: 'ENOENT' });
  await outside.put('index.json', JSON.stringify(empty()));
  await fs.symlink(path.join(outside.root, 'index.json'), path.join(owned.root, 'link.json'));
  await assert.rejects(writeAnchorsIndex(plan, { ...owned, indexLocation: loc('link.json') }), { code: 'ANCHORS_PATH' });
  await owned.put('inside.json', JSON.stringify(empty()));
  await fs.symlink('inside.json', path.join(owned.root, 'inside-link.json'));
  await assert.rejects(writeAnchorsIndex(plan, { ...owned, indexLocation: loc('inside-link.json') }), { code: 'ANCHORS_PATH' });
  assert.equal(await outside.read('index.json'), JSON.stringify(empty()));
});

test('index concurrency mismatch and post-read source change abort before atomic rename', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  await owned.put('anchors.json', JSON.stringify({ ...empty(), migration: { other: true } }));
  const plan = makePlan([group('key', loc('a.mjs', { symbol: 'A' }))], [outcome('a.mjs')]);
  await assert.rejects(writeAnchorsIndex(plan, owned), { code: 'ANCHORS_INDEX_CHANGED' });
  await owned.put('anchors.json', JSON.stringify(empty()));
  const initial = await owned.read('anchors.json');
  await assert.rejects(writeAnchorsIndex(plan, { ...owned, parseSymbols: async input => {
    const result = jsParser(input);
    await owned.put('a.mjs', 'function B() {}');
    return result;
  } }), { code: 'ANCHORS_SOURCE_CHANGED' });
  assert.equal(await owned.read('anchors.json'), initial);
  assert.deepEqual((await fs.readdir(owned.root)).sort(), ['a.mjs', 'anchors.json']);
});

test('source change during temporary write and index change just before rename leave no helper receipt', async t => {
  for (const changed of ['source', 'index']) {
    const owned = await tree(t);
    await owned.put('a.mjs', 'function A() {}');
    let applied = false;
    const io = { ...fs, async open(...args) {
      const handle = await fs.open(...args);
      if (args[1] !== 'wx') return handle;
      return {
        stat: () => handle.stat(), close: () => handle.close(), sync: () => handle.sync(),
        async writeFile(...values) {
          await handle.writeFile(...values);
          applied = true;
          await owned.put(changed === 'source' ? 'a.mjs' : 'anchors.json', changed === 'source' ? 'changed' : '{"unknown":true}');
        },
      };
    } };
    await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('a.mjs'))], [outcome('a.mjs')]),
      { ...owned, io }), { code: changed === 'source' ? 'ANCHORS_SOURCE_CHANGED' : 'ANCHORS_INDEX_CHANGED' });
    assert.equal(applied, true);
    assert.ok(!(await fs.readdir(owned.root)).some(name => name.includes('.tmp-')));
    if (changed === 'index') assert.equal(await owned.read('anchors.json'), '{"unknown":true}');
    else await assert.rejects(owned.read('anchors.json'), { code: 'ENOENT' });
  }
});

test('successful outcome with missing/mismatching actual source preserves prior path as unmapped/stale', async t => {
  const owned = await tree(t);
  const oldSource = 'function Old() {}';
  await owned.put('a.mjs', oldSource);
  const priorIndex = await certify(owned, 'a.mjs', { key: 'old:key' });
  await fs.unlink(path.join(owned.root, 'a.mjs'));
  const missing = await verifyAnchorsPlan(makePlan([group('new:key', loc('a.mjs'))],
    [outcome('a.mjs', 'COVER')], { priorIndex }), owned);
  assert.equal(entry(missing, 'old:key').status, 'unmapped');
  assert.equal(entry(missing, 'new:key').status, 'unmapped');
  await owned.put('a.mjs', 'actual human bytes');
  const mismatching = await verifyAnchorsPlan(makePlan([group('new:key', loc('a.mjs', {
    expectedFingerprint: digest('planned expected bytes'),
  }))], [outcome('a.mjs', 'COVER')], { priorIndex }), owned);
  assert.equal(entry(mismatching, 'old:key').status, 'stale');
  assert.equal(entry(mismatching, 'new:key').status, 'stale');
});

test('KEEP contradictory final hash downgrades matching prior certificate rather than silently retaining it', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const priorIndex = await certify(owned, 'a.mjs');
  const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs'))],
    [outcome('a.mjs', 'KEEP', { fingerprint: digest('contradictory receipt') })], { priorIndex }), owned);
  assert.equal(entry(result).status, 'stale');
  assert.equal(entry(result).verification.fileVerified, false);
});

test('MISSING/FAILED matching location retains its prior observed fingerprint and becomes stale, not deleted', async t => {
  const owned = await tree(t);
  const source = 'function A() {}';
  await owned.put('a.mjs', source);
  const priorIndex = await certify(owned, 'a.mjs');
  for (const value of ['MISSING', 'FAILED']) {
    const result = await verifyAnchorsPlan(makePlan([group('domain:key', loc('a.mjs'))],
      [outcome('a.mjs', value)], { priorIndex }), owned);
    assert.equal(result.anchors['domain:key'].length, 1);
    assert.equal(entry(result).status, 'stale');
    assert.equal(entry(result).fingerprint, digest(source));
    assert.equal(entry(result).verification.fileVerified, false);
  }
});

test('temporary stat/close/open failure never returns a receipt or deletes a pre-existing collision', async t => {
  for (const step of ['stat', 'close', 'open']) {
    const owned = await tree(t);
    await owned.put('a.mjs', 'function A() {}');
    let collision;
    const io = { ...fs, async open(...args) {
      if (args[1] === 'wx' && step === 'open') {
        collision = args[0];
        await fs.writeFile(collision, 'unknown collision');
        return fs.open(...args);
      }
      const handle = await fs.open(...args);
      if (args[1] !== 'wx') return handle;
      let failed = false;
      return {
        async stat() {
          if (step === 'stat' && !failed) { failed = true; throw new Error('injected stat'); }
          return handle.stat();
        },
        async close() {
          if (step === 'close' && !failed) { failed = true; throw new Error('injected close'); }
          return handle.close();
        },
        writeFile: (...values) => handle.writeFile(...values), sync: () => handle.sync(),
      };
    } };
    await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('a.mjs'))], [outcome('a.mjs')]),
      { ...owned, io }), step === 'open' ? { code: 'EEXIST' } : /injected/);
    await assert.rejects(owned.read('anchors.json'), { code: 'ENOENT' });
    if (collision) assert.equal(await fs.readFile(collision, 'utf8'), 'unknown collision');
    else assert.deepEqual(await fs.readdir(owned.root), ['a.mjs']);
  }
});

test('successful owned path apply with empty locations marks prior mapping unmapped instead of deleting it', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const priorIndex = await certify(owned, 'a.mjs');
  const result = await verifyAnchorsPlan(makePlan([group('domain:key')], [outcome('a.mjs', 'IDENTICAL')],
    { priorIndex }), owned);
  assert.equal(result.anchors['domain:key'].length, 1);
  assert.equal(entry(result).status, 'unmapped');
  assert.equal(entry(result).verification.reason, 'no-longer-planned');
  assert.equal(await owned.read('a.mjs'), 'function A() {}');
});

test('casefold aliases between index and source fail without overwriting application source', async t => {
  const owned = await tree(t);
  const source = '{"human":true}';
  await owned.put('receipt.json', source);
  await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('receipt.json'))], [outcome('receipt.json')]),
    { ...owned, indexLocation: loc('Receipt.json') }), { code: 'ANCHORS_ALIAS' });
  assert.equal(await owned.read('receipt.json'), source);
});

test('temporary replaced by an unknown inode is never cleaned up by failure handling', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  let temp;
  const io = { ...fs, async open(...args) {
    const handle = await fs.open(...args);
    if (args[1] !== 'wx') return handle;
    temp = args[0];
    return {
      stat: () => handle.stat(), close: () => handle.close(), sync: () => handle.sync(),
      async writeFile(...values) {
        await handle.writeFile(...values);
        await fs.rename(temp, path.join(owned.root, 'displaced-helper-temp'));
        await fs.writeFile(temp, 'unknown replacement');
        throw new Error('injected replacement failure');
      },
    };
  } };
  await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('a.mjs'))], [outcome('a.mjs')]),
    { ...owned, io }), /injected replacement/);
  assert.equal(await fs.readFile(temp, 'utf8'), 'unknown replacement');
  await assert.rejects(owned.read('anchors.json'), { code: 'ENOENT' });
});

test('temporary inode replacement cannot be atomically committed as our verified index', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  let temp;
  const io = { ...fs, async open(...args) {
    const handle = await fs.open(...args);
    if (args[1] !== 'wx') return handle;
    temp = args[0];
    return {
      stat: () => handle.stat(), close: () => handle.close(), sync: () => handle.sync(),
      async writeFile(...values) {
        await handle.writeFile(...values);
        await fs.rename(temp, path.join(owned.root, 'displaced-helper-temp'));
        await fs.writeFile(temp, 'unknown replacement');
      },
    };
  } };
  await assert.rejects(writeAnchorsIndex(makePlan([group('key', loc('a.mjs'))], [outcome('a.mjs')]),
    { ...owned, io }), { code: 'ANCHORS_INDEX_CHANGED' });
  assert.equal(await fs.readFile(temp, 'utf8'), 'unknown replacement');
  await assert.rejects(owned.read('anchors.json'), { code: 'ENOENT' });
});

test('tampered plan verification claims are rebuilt, and malformed v1 certificates are rejected', async t => {
  const owned = await tree(t);
  await owned.put('a.mjs', 'function A() {}');
  const plan = makePlan([group('key', loc('a.mjs', { symbol: 'Ghost' }))], [outcome('a.mjs', 'KEEP')]);
  plan.declarations[0].location.verification = { symbolVerified: true };
  plan.declarations[0].location.fingerprint = digest('fake');
  plan.declarations[0].location.status = 'source-verified';
  const result = await verifyAnchorsPlan(plan, owned);
  assert.equal(entry(result, 'key').verification.symbolVerified, false);
  const invalid = structuredClone(result);
  entry(invalid, 'key').verification.symbolVerified = true;
  assert.throws(() => readAnchorsIndex(invalid), /Invalid source verification/);
  assert.throws(() => makePlan([], [outcome('a.mjs'), outcome('a.mjs')]), /Duplicate/);
  assert.throws(() => makePlan([], [outcome('a.mjs', 'OTHER')]), /Unknown/);
  assert.throws(() => makePlan([group('key', loc('a.mjs', { expectedFingerprint: 'fake' }))]), /Invalid/);
});
