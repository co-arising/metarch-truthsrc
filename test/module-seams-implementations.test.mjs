import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { lowerModuleSeamsTarget } from '../lib/products/module-seams-target.mjs';
import { ProductError } from '../lib/products/request.mjs';
import { captureImplementations, implementationBuildInputs, assertImplementationsUnchanged } from '../lib/project/implementations.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/module-seams-project', import.meta.url));
const tool = fileURLToPath(new URL('..', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
const files = root => fs.readdirSync(root).sort().flatMap(name => {
  const file = path.join(root, name);
  return fs.lstatSync(file).isDirectory() ? files(file) : [file];
});

// Real author/compiler/lower inputs; all mutation, copying and cleanup is owned
// mkdtemp data, never scaffold/reference/another agent's workspace.
function fixture(t) {
  const owned = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'truthsrc-b-capture-'));
  const removeOwned = fs.rmSync;
  t.after(() => removeOwned(owned, { recursive: true, force: true }));
  const base = path.join(owned, 'project');
  fs.cpSync(scaffold, base, { recursive: true });
  const projectFile = path.join(base, 'truthsrc.project.json');
  const config = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  const tree = path.join(base, config.tree);
  const compiled = compileTreeWithSources(tree);
  const documents = config.documents.map(d => {
    const value = JSON.parse(fs.readFileSync(path.join(base, d.file), 'utf8'));
    return { id: d.id, schemaVersion: value.schemaVersion, value };
  });
  const compilation = compileProductSet(deriveProjectRequest(compiled.canonical, config, documents));
  assert.deepEqual(compilation.diagnostics, []);
  const byId = new Map(compilation.result.documents.map(d => [d.id, d]));
  const contract = compilation.result.requirements.find(r => r.id === 'module-seams-contract');
  const composition = compilation.result.requirements.find(r => r.id === 'module-seams-composition');
  const lower = lowerModuleSeamsTarget(byId.get(contract.inputRoles.canonical),
    byId.get(contract.inputRoles.moduleSeamsContractBinding),
    byId.get(composition.inputRoles.moduleSeamsCompositionBinding), config.options);
  const args = { projectFile, tree, inputFiles: [projectFile, ...files(tree), ...config.documents.map(d => path.join(base, d.file))],
    sourceRoots: copy(lower.sourceRoots), handwritten: copy(lower.handwritten) };
  const source = index => path.join(base, args.handwritten[index].sourceRoot, args.handwritten[index].file);
  const root = index => path.join(base, args.sourceRoots[index].path);
  return { owned, base, config, lower, args, source, root, outDir: path.join(base, 'generated') };
}
function rejected(fn, code, pattern) {
  assert.throws(fn, error => {
    assert.ok(error instanceof ProductError, String(error));
    assert.equal(typeof error.diagnostic.message, 'string');
    assert.equal(typeof error.diagnostic.source.document, 'string');
    assert.equal(typeof error.diagnostic.source.pointer, 'string');
    if (code) assert.equal(error.diagnostic.code, code, error.message);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}
function good(f) {
  const evidence = captureImplementations(f.args);
  assertImplementationsUnchanged(evidence);
  assert.deepEqual(implementationBuildInputs(evidence, { sourceRoots: f.args.sourceRoots,
    handwritten: f.args.handwritten, outDir: f.outDir }), f.args.sourceRoots.map(r =>
    ({ id: r.id, module: r.module, absolutePath: path.join(f.base, r.path) })));
  return evidence;
}

// Paired controls precede mutations, so a rejection cannot just be an always-red gate.
test('actual copied author captures frozen exact evidence and external build roots without source bodies', t => {
  const f = fixture(t), evidence = good(f);
  assert.deepEqual(Object.keys(evidence), ['schemaVersion', 'project', 'roots', 'members']);
  assert.equal(evidence.schemaVersion, 'truthsrc.module-seams-implementations/v1');
  assert.equal(evidence.project, f.args.projectFile);
  assert.equal(evidence.members.length, 3);
  assert.equal(evidence.roots.length, 3);
  for (const [i, member] of evidence.members.entries()) {
    const bytes = fs.readFileSync(f.source(i));
    assert.deepEqual(member, { ...f.args.handwritten[i], absoluteFile: f.source(i), bytes: bytes.length, sha256: hash(bytes) });
    const root = evidence.roots.find(r => r.id === member.sourceRootKey);
    assert.deepEqual(root, { ...f.args.sourceRoots.find(r => r.id === root.id), absolutePath: path.dirname(f.source(i)),
      inventory: { [member.file]: { bytes: bytes.length, sha256: hash(bytes) } } });
    assert.ok(Object.isFrozen(member) && Object.isFrozen(member.source) && Object.isFrozen(root.inventory));
  }
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.roots) && Object.isFrozen(evidence.members));
  assert.equal(JSON.stringify(evidence).includes('object CapacityRule'), false);
  assert.equal(JSON.stringify(evidence).includes('runtimeVerified'), false);
  assert.equal(Object.isFrozen(f.args), false);
  assert.equal(Object.isFrozen(f.args.handwritten[0]), false);
  assert.throws(() => { evidence.members[0].bytes = 0; }, TypeError);
  f.args.handwritten[0].id = 'caller-can-mutate';
  assert.equal(evidence.members[0].id, 'capacity-rule');
  assertImplementationsUnchanged(evidence);
});

test('original scaffold is rejected as tool overlap, not made a privileged source root', t => {
  const f = fixture(t);
  good(f);
  const args = { ...f.args, projectFile: path.join(scaffold, 'truthsrc.project.json'), tree: path.join(scaffold, f.config.tree),
    inputFiles: [path.join(scaffold, 'truthsrc.project.json'), ...files(path.join(scaffold, f.config.tree)),
      ...f.config.documents.map(d => path.join(scaffold, d.file))] };
  rejected(() => captureImplementations(args), 'MODULE_SEAMS_CAPTURE_OVERLAP', /tool/);
});

const declarationMutations = [
  ['missing root', a => a.sourceRoots.pop()],
  ['extra unused root', a => a.sourceRoots.push({ id: 'unused', module: 'kernel', path: 'other' })],
  ['no roots', a => { a.sourceRoots = []; }],
  ['no members', a => { a.handwritten = []; }],
  ['different root module', a => { a.sourceRoots[0].module = 'glue'; }],
  ['different member module', a => { a.handwritten[0].module = 'ext'; }],
  ['array role coercion', a => { a.handwritten[0].role = ['pure-implementation']; }],
  ['root module unknown', a => { a.sourceRoots[0].module = 'root'; }],
  ['member construction unknown', a => { a.handwritten[0].construction = 'factory'; }],
  ['adapter without implements', a => { a.handwritten[1].implements = null; }],
  ['non-port implements', a => { a.handwritten[1].implements.kind = 'type'; }],
  ['wrong ref owner', a => { a.handwritten[1].implements.owner = ['owner']; }],
  ['missing member property', a => { delete a.handwritten[0].source; }],
  ['extra trusted field', a => { a.handwritten[0].trusted = true; }],
  ['wrong source pointer', a => { a.handwritten[0].source.pointer = 'not-a-pointer'; }],
  ['unknown source root key', a => { a.handwritten[0].sourceRootKey = 'unknown'; }],
  ['sourceRoot raw mismatch', a => { a.handwritten[0].sourceRoot = 'handwritten/other'; }],
  ['duplicate root key', a => { a.sourceRoots[1].id = a.sourceRoots[0].id; }],
  ['duplicate member id', a => { a.handwritten[1].id = a.handwritten[0].id; }],
  ['duplicate symbol', a => { a.handwritten[1].symbol = a.handwritten[0].symbol; }],
  ['duplicate member source', a => { a.handwritten.push(copy(a.handwritten[0])); a.handwritten[3].id = 'four'; a.handwritten[3].symbol = 'example.parcel.domain.Four'; }],
  ['non Scala declared member', a => { a.handwritten[0].file = 'README.txt'; }],
  ['bad symbol', a => { a.handwritten[0].symbol = 'not a Scala FQN'; }],
  ['prototype key root identity', a => { a.sourceRoots[0].id = '__proto__'; }],
];
for (const [name, mutate] of declarationMutations) test('closed declarations reject ' + name, t => {
  const f = fixture(t); good(f); mutate(f.args);
  rejected(() => captureImplementations(f.args));
});

for (const spelling of ['../outside', '/absolute', 'C:/absolute', 'file:source', 'a\\b', './a', 'a//b', 'a/../b',
  'a/./b', 'a/', 'a b', 'con', 'dir/LPT1.scala', 'dir/name.', 'dir/name ', 'dir/with‮bidi', 'x\ud800']) {
  test('portable roots and members reject ' + JSON.stringify(spelling), t => {
    const f = fixture(t); good(f);
    const roots = copy(f.args); roots.sourceRoots[0].path = spelling; roots.handwritten[0].sourceRoot = spelling;
    rejected(() => captureImplementations(roots));
    const members = copy(f.args); members.handwritten[0].file = spelling;
    rejected(() => captureImplementations(members));
  });
}
for (const name of ['equal', 'nested', 'case', 'NFC']) test('root declarations reject ' + name + ' alias/overlap', t => {
  const f = fixture(t); good(f);
  const value = name === 'equal' ? f.args.sourceRoots[0].path : name === 'nested' ? f.args.sourceRoots[0].path + '/child' :
    name === 'case' ? f.args.sourceRoots[0].path.toUpperCase() : 'handwritten/café';
  if (name === 'NFC') { f.args.sourceRoots[0].path = 'handwritten/café'; f.args.handwritten[0].sourceRoot = 'handwritten/café'; }
  f.args.sourceRoots[1].path = value; f.args.handwritten[1].sourceRoot = value;
  rejected(() => captureImplementations(f.args));
});

test('duplicate input references are not silently normalized; project must be present, tree files complete', t => {
  const f = fixture(t); good(f);
  for (const inputFiles of [[...f.args.inputFiles, f.args.projectFile], f.args.inputFiles.slice(1),
    f.args.inputFiles.filter(file => file !== files(f.args.tree)[0]), [...f.args.inputFiles, f.args.tree],
    [...f.args.inputFiles, f.args.projectFile.toUpperCase()]]) rejected(() => captureImplementations({ ...f.args, inputFiles }));
});
for (const kind of ['tree', 'project', 'document', 'tool', 'graph']) test('roots reject overlap with ' + kind, t => {
  const f = fixture(t); good(f);
  const target = kind === 'tree' ? f.args.tree : kind === 'project' ? f.args.projectFile :
    kind === 'document' ? f.args.inputFiles.at(-1) : kind === 'tool' ? tool : path.join(f.base, '.truthsrc', 'knowledge.sqlite');
  const relative = path.relative(f.base, target).split(path.sep).join('/');
  f.args.sourceRoots[0].path = relative; f.args.handwritten[0].sourceRoot = relative;
  rejected(() => captureImplementations(f.args));
});

for (const change of ['missing member', 'extra Scala', 'extra nonScala', 'hidden member', 'empty root', 'missing root']) {
  test('complete root membership rejects ' + change, t => {
    const f = fixture(t); good(f);
    if (change === 'missing member' || change === 'empty root') fs.unlinkSync(f.source(0));
    else if (change === 'missing root') fs.rmSync(f.root(0), { recursive: true });
    else fs.writeFileSync(path.join(f.root(0), change === 'extra Scala' ? 'Extra.scala' : change === 'hidden member' ? '.hidden' : 'README.txt'), 'extra');
    rejected(() => captureImplementations(f.args));
  });
}

test('nested explicit member file is admitted; an undeclared sibling is not', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root(0), 'nested'));
  fs.renameSync(f.source(0), path.join(f.root(0), 'nested', 'CapacityRule.scala'));
  f.args.handwritten[0].file = 'nested/CapacityRule.scala';
  good(f);
  fs.writeFileSync(path.join(f.root(0), 'nested', 'note.txt'), 'not filtered');
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_MEMBERSHIP');
});

test('a second member in the same root needs its own complete declaration; case alias is refused', t => {
  const f = fixture(t);
  const next = { ...copy(f.args.handwritten[0]), id: 'other', symbol: 'example.parcel.domain.OtherRule', file: 'OtherRule.scala' };
  f.args.handwritten.push(next); fs.writeFileSync(path.join(f.root(0), next.file), 'opaque source; no execution');
  good(f);
  f.args.handwritten.at(-1).file = f.args.handwritten[0].file.toUpperCase();
  rejected(() => captureImplementations(f.args));
});

for (const location of ['root', 'member', 'parent', 'input', 'tree', 'dangling']) test('symlink rejection at ' + location, t => {
  const f = fixture(t); good(f);
  if (location === 'root' || location === 'parent' || location === 'tree') {
    const original = location === 'root' ? f.root(0) : location === 'tree' ? f.args.tree : path.dirname(f.root(0));
    const saved = path.join(f.owned, 'saved'); fs.renameSync(original, saved); fs.symlinkSync(saved, original);
  } else if (location === 'dangling') fs.symlinkSync(path.join(f.owned, 'absent'), path.join(f.root(0), 'dangling'));
  else {
    const original = location === 'member' ? f.source(0) : f.args.projectFile;
    const saved = path.join(f.owned, 'saved'); fs.renameSync(original, saved); fs.symlinkSync(saved, original);
  }
  rejected(() => captureImplementations(f.args));
});
for (const location of ['member', 'input', 'cross-root']) test('single-link/physical alias rejection for ' + location, t => {
  const f = fixture(t); good(f);
  if (location === 'cross-root') { fs.unlinkSync(f.source(1)); fs.linkSync(f.source(0), f.source(1)); }
  else fs.linkSync(location === 'member' ? f.source(0) : f.args.projectFile, path.join(f.owned, 'hardlink'));
  rejected(() => captureImplementations(f.args));
});

test('exact filesystem spelling is checked for roots, inputs and Unicode leaves', t => {
  const f = fixture(t); good(f);
  const a = copy(f.args); a.sourceRoots[0].path = a.sourceRoots[0].path.toUpperCase(); a.handwritten[0].sourceRoot = a.sourceRoots[0].path;
  rejected(() => captureImplementations(a));
  rejected(() => captureImplementations({ ...f.args, projectFile: f.args.projectFile.replace('project.json', 'PROJECT.json') }));
  const unicode = path.join(f.root(0), 'café.scala'); fs.renameSync(f.source(0), unicode);
  const actual = fs.readdirSync(f.root(0))[0]; f.args.handwritten[0].file = actual; good(f);
  f.args.handwritten[0].file = actual === actual.normalize('NFC') ? actual.normalize('NFD') : actual.normalize('NFC');
  rejected(() => captureImplementations(f.args));
});

for (const change of ['add', 'delete', 'rename', 'same bytes member replacement', 'same bytes root replacement',
  'same bytes parent replacement', 'same bytes input replacement', 'member mtime', 'root mtime', 'member mode', 'root mode',
  'input bytes', 'tree addition', 'empty directory addition', 'temporary membership drift']) {
  test('live recheck rejects ' + change, t => {
    const f = fixture(t), evidence = good(f);
    if (change === 'add') fs.writeFileSync(path.join(f.root(0), 'added.txt'), 'extra');
    else if (change === 'delete') fs.unlinkSync(f.source(0));
    else if (change === 'rename') fs.renameSync(f.source(0), path.join(f.root(0), 'renamed.scala'));
    else if (change.includes('replacement')) {
      const original = change.includes('member') ? f.source(0) : change.includes('root') ? f.root(0) :
        change.includes('parent') ? path.dirname(f.root(0)) : f.args.projectFile;
      const saved = path.join(f.owned, 'old'); fs.renameSync(original, saved); fs.cpSync(saved, original, { recursive: true });
    } else if (change.endsWith('mtime')) {
      const file = change.startsWith('member') ? f.source(0) : f.root(0); const stat = fs.statSync(file);
      fs.utimesSync(file, stat.atime, new Date(stat.mtimeMs + 2000));
    } else if (change.endsWith('mode')) fs.chmodSync(change.startsWith('member') ? f.source(0) : f.root(0), 0o700);
    else if (change === 'input bytes') fs.appendFileSync(f.args.projectFile, ' ');
    else if (change === 'tree addition') fs.writeFileSync(path.join(f.args.tree, 'extra.yaml'), 'extra');
    else if (change === 'empty directory addition') fs.mkdirSync(path.join(f.root(0), 'empty'));
    else { const transient = path.join(f.root(0), 'temporary'); fs.writeFileSync(transient, 'x'); fs.unlinkSync(transient); }
    rejected(() => assertImplementationsUnchanged(evidence), 'MODULE_SEAMS_CAPTURE_DRIFT');
    // Build inputs intentionally remain pure: they are not a freshness guarantee.
    assert.equal(implementationBuildInputs(evidence, { sourceRoots: f.args.sourceRoots, handwritten: f.args.handwritten, outDir: f.outDir }).length, 3);
  });
}

test('moving an entire same-byte project does not transfer live path identity', t => {
  const f = fixture(t), evidence = good(f), moved = path.join(f.owned, 'renamed-project');
  fs.renameSync(f.base, moved);
  rejected(() => assertImplementationsUnchanged(evidence), 'MODULE_SEAMS_CAPTURE_DRIFT');
});

for (const moment of ['open replacement', 'read mutation', 'read addition', 'input read changes root']) {
  test('capture-in-flight change rejects ' + moment + ' using existing Node FS mock mechanism', t => {
    const f = fixture(t); good(f);
    const open = fs.openSync, read = fs.readSync, descriptors = new Map(); let changed = false;
    t.mock.method(fs, 'openSync', (file, ...args) => {
      if (!changed && moment === 'open replacement' && file === f.source(0)) {
        changed = true; const saved = path.join(f.owned, 'original'); fs.renameSync(file, saved); fs.copyFileSync(saved, file);
      }
      const fd = open(file, ...args); descriptors.set(fd, file); return fd;
    });
    t.mock.method(fs, 'readSync', (fd, ...args) => {
      const result = read(fd, ...args), file = descriptors.get(fd);
      if (!changed && result > 0 && (file === f.source(0) || moment === 'input read changes root' && file === f.args.projectFile)) {
        changed = true;
        if (moment === 'read mutation') { const data = fs.readFileSync(file); data[0] ^= 1; fs.writeFileSync(file, data); }
        else if (moment !== 'open replacement') fs.writeFileSync(path.join(f.root(0), 'in-flight.txt'), 'new membership');
      }
      return result;
    });
    rejected(() => captureImplementations(f.args)); assert.equal(changed, true);
  });
}

test('capture rejects every I/O error with context; no repair and no writes', t => {
  const f = fixture(t); good(f);
  const lstat = fs.lstatSync; const marker = new Error('owned EIO injection'); marker.code = 'EIO';
  t.mock.method(fs, 'lstatSync', (file, ...args) => { if (file === f.source(0)) throw marker; return lstat(file, ...args); });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_IO', /EIO.*owned EIO injection/);
});

test('forged/cloned/proxy evidence cannot take build inputs or live recheck', t => {
  const f = fixture(t), evidence = good(f); let executed = 0;
  for (const value of [copy(evidence), JSON.parse(JSON.stringify(evidence)), Object.freeze({ ...evidence }), null, {},
    new Proxy(evidence, { get() { executed++; throw new Error('proxy ran'); } })]) {
    rejected(() => implementationBuildInputs(value, { sourceRoots: f.args.sourceRoots, handwritten: f.args.handwritten, outDir: f.outDir }), 'MODULE_SEAMS_CAPTURE_REQUIRED');
    rejected(() => assertImplementationsUnchanged(value), 'MODULE_SEAMS_CAPTURE_REQUIRED');
  }
  assert.equal(executed, 0);
});

test('capture inputs reject getters/proxies/sparse/cyclic/non JSON data without invoking user code', t => {
  const f = fixture(t); good(f); let calls = 0;
  const getter = { ...f.args }; Object.defineProperty(getter, 'sourceRoots', { enumerable: true, get() { calls++; throw new Error('getter'); } });
  const cycle = { ...f.args }; cycle.self = cycle;
  const sparse = copy(f.args); delete sparse.handwritten[0];
  for (const args of [getter, cycle, sparse, { ...f.args, extra: true }, { ...f.args, sourceRoots: new Date() },
    new Proxy(f.args, { ownKeys() { calls++; throw new Error('proxy'); } }),
    { ...f.args, handwritten: [Object.assign(copy(f.args.handwritten[0]), { callback() { calls++; } })] }]) rejected(() => captureImplementations(args));
  assert.equal(calls, 0);
});

test('fresh lower declarations must be fully equal, not just matching root keys or symbols', t => {
  const f = fixture(t), evidence = good(f);
  for (const mutate of [a => { a.sourceRoots.reverse(); }, a => { a.handwritten.reverse(); },
    a => { a.handwritten[0].version = '2'; }, a => { a.handwritten[0].source.pointer += '/different'; },
    a => { a.handwritten[0].symbol = 'example.parcel.domain.Different'; }, a => { a.handwritten[0].construction = 'class'; }]) {
    const a = copy(f.args); mutate(a);
    rejected(() => implementationBuildInputs(evidence, { sourceRoots: a.sourceRoots, handwritten: a.handwritten, outDir: f.outDir }), 'MODULE_SEAMS_CAPTURE_DECLARATIONS');
  }
});

for (const which of ['relative', 'traversal', 'trailing slash', 'source', 'source child', 'source parent', 'input', 'tree',
  'tool', 'tool case', 'graph', 'graph parent', 'project parent', 'root case']) {
  test('pure build inputs reject wrong output ' + which, t => {
    const f = fixture(t), evidence = good(f);
    const outDir = which === 'relative' ? 'generated' : which === 'traversal' ? f.base + '/./generated' :
      which === 'trailing slash' ? f.outDir + '/' : which === 'source' ? f.root(0) : which === 'source child' ? path.join(f.root(0), 'output') :
      which === 'source parent' ? path.dirname(f.root(0)) : which === 'input' ? f.args.projectFile : which === 'tree' ? f.args.tree :
      which === 'tool' ? tool : which === 'tool case' ? tool.toUpperCase() : which === 'graph' ? path.join(f.base, '.truthsrc', 'knowledge.sqlite') :
      which === 'graph parent' ? path.join(f.base, '.truthsrc') : which === 'project parent' ? f.base : f.root(0).toUpperCase();
    rejected(() => implementationBuildInputs(evidence, { sourceRoots: f.args.sourceRoots, handwritten: f.args.handwritten, outDir }), 'MODULE_SEAMS_CAPTURE_OUTPUT');
  });
}

test('buildInputs is read-free and detached; true output spelling remains the caller localPath gate', t => {
  const f = fixture(t), evidence = good(f);
  for (const method of ['lstatSync', 'statSync', 'realpathSync', 'readdirSync', 'opendirSync', 'openSync', 'readSync', 'readFileSync', 'existsSync'])
    t.mock.method(fs, method, () => { throw new Error('build inputs touched FS ' + method); });
  const options = { sourceRoots: f.args.sourceRoots, handwritten: f.args.handwritten, outDir: path.join(f.owned, 'not-created', 'out') };
  const roots = implementationBuildInputs(evidence, options);
  assert.equal(roots.length, 3);
  assert.ok(Object.isFrozen(roots) && Object.isFrozen(roots[0]));
});

test('readonly API never creates, copies, writes, renames, removes or executes captured source', t => {
  const f = fixture(t); const before = files(f.base).map(file => [file, hash(fs.readFileSync(file))]);
  for (const method of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'renameSync', 'unlinkSync', 'rmSync',
    'rmdirSync', 'cpSync', 'copyFileSync', 'linkSync', 'symlinkSync', 'chmodSync', 'utimesSync'])
    t.mock.method(fs, method, () => { throw new Error('readonly API wrote via ' + method); });
  const open = fs.openSync;
  t.mock.method(fs, 'openSync', (file, flags, ...args) => {
    assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC), 0);
    return open(file, flags, ...args);
  });
  try {
    good(f);
    assert.deepEqual(files(f.base).map(file => [file, hash(fs.readFileSync(file))]), before);
    assert.equal(fs.existsSync(f.outDir), false);
  } finally { t.mock.restoreAll(); }
});

for (const location of ['one file', 'total implementations', 'combined inputs']) test('8 MiB bounds reject ' + location + ' before any content read', t => {
  const f = fixture(t); good(f);
  if (location === 'one file') fs.writeFileSync(f.source(0), Buffer.alloc(8 * 1024 * 1024 + 1));
  else if (location === 'total implementations') {
    fs.writeFileSync(f.source(0), Buffer.alloc(5 * 1024 * 1024)); fs.writeFileSync(f.source(1), Buffer.alloc(4 * 1024 * 1024));
  } else fs.writeFileSync(f.args.inputFiles.at(-1), Buffer.alloc(8 * 1024 * 1024));
  let reads = 0; const read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => { reads++; return read(...args); });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_LIMIT'); assert.equal(reads, 0);
});

test('exact aggregate 8 MiB control and zero byte declared source are admitted', t => {
  const f = fixture(t);
  fs.writeFileSync(f.source(0), '');
  const remaining = 8 * 1024 * 1024 - [...f.args.inputFiles, f.source(0), f.source(1)].reduce((sum, file) => sum + fs.statSync(file).size, 0);
  fs.writeFileSync(f.source(2), Buffer.alloc(remaining));
  const evidence = good(f); assert.equal(evidence.members[0].bytes, 0); assert.equal(evidence.members[2].bytes, remaining);
});

test('root/member/input count and path depth are bounded before content reads', t => {
  const f = fixture(t); good(f);
  for (const a of [{ ...f.args, sourceRoots: Array(65).fill(f.args.sourceRoots[0]) },
    { ...f.args, handwritten: Array(1025).fill(f.args.handwritten[0]) },
    { ...f.args, inputFiles: Array(4097).fill(f.args.projectFile) },
    { ...f.args, sourceRoots: [{ ...f.args.sourceRoots[0], path: Array(33).fill('dir').join('/') }, ...f.args.sourceRoots.slice(1)] }])
    rejected(() => captureImplementations(a), 'MODULE_SEAMS_CAPTURE_LIMIT');
});

test('member declarations reject file/directory prefix nesting before filesystem admission', t => {
  const f = fixture(t); good(f);
  f.args.handwritten.push({ ...copy(f.args.handwritten[0]), id: 'nested-member', symbol: 'example.parcel.domain.NestedMember',
    file: f.args.handwritten[0].file + '/Child.scala' });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_OVERLAP');
});

test('safe sibling output creation does not invalidate parent membership that capture does not own', t => {
  const f = fixture(t), evidence = good(f);
  fs.mkdirSync(f.outDir); fs.writeFileSync(path.join(f.outDir, 'generated.txt'), 'writer-owned');
  assertImplementationsUnchanged(evidence);
});

for (const method of ['openSync', 'readSync', 'opendirSync', 'closeSync']) test('I/O exceptions are explicit without repair: ' + method, t => {
  const f = fixture(t); good(f);
  const original = fs[method]; let called = false;
  t.mock.method(fs, method, (...args) => {
    called = true;
    if (method === 'closeSync') original(...args);
    const error = new Error('controlled ' + method + ' failure'); error.code = 'EIO'; throw error;
  });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_IO', /EIO.*controlled/);
  assert.equal(called, true);
});

test('directory depth is bounded for unexpected entries, not just declared paths', t => {
  const f = fixture(t); good(f);
  fs.mkdirSync(path.join(f.root(0), ...Array(33).fill('nested')), { recursive: true });
  let reads = 0; const read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => { reads++; return read(...args); });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_LIMIT'); assert.equal(reads, 0);
});

for (const kind of ['directories', 'entries']) test('stat-only preflight enforces aggregate ' + kind + ' bound', t => {
  const f = fixture(t); good(f);
  for (let i = 0; i < (kind === 'directories' ? 4097 : 8193); i++) {
    const file = path.join(f.root(0), 'extra-' + i);
    if (kind === 'directories') fs.mkdirSync(file); else fs.writeFileSync(file, '');
  }
  let reads = 0; const read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => { reads++; return read(...args); });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_LIMIT'); assert.equal(reads, 0);
});

test('extra policy flags/getters cannot authorize links or wrong output spelling', t => {
  const f = fixture(t), evidence = good(f); let calls = 0;
  rejected(() => captureImplementations({ ...f.args, allowHardlinks: true }));
  rejected(() => implementationBuildInputs(evidence, { sourceRoots: f.args.sourceRoots, handwritten: f.args.handwritten,
    outDir: 'relative', trustedOutput: true }));
  rejected(() => implementationBuildInputs(evidence, { sourceRoots: f.args.sourceRoots, handwritten: f.args.handwritten,
    get outDir() { calls++; return f.outDir; } }));
  assert.equal(calls, 0);
});

test('bounded preflight stops a huge undeclared tree before readers run', t => {
  const f = fixture(t); good(f);
  const unexpected = path.join(f.root(0), 'extra'); fs.mkdirSync(unexpected);
  for (let i = 0; i < 4100; i++) fs.writeFileSync(path.join(unexpected, String(i)), '');
  let reads = 0; const read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => { reads++; return read(...args); });
  rejected(() => captureImplementations(f.args), 'MODULE_SEAMS_CAPTURE_LIMIT'); assert.equal(reads, 0);
});
