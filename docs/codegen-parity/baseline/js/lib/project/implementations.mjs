import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ProductError, at, array, detach, equal, fail, object, pointer, text } from '../products/request.mjs';
import { portableSeamsPath } from '../products/module-seams-composition.mjs';
import { reference } from '../domain-products/references.mjs';
import { resolveName } from '../scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../scala-target/profiles.mjs';
import { assertCanonicalPath, captureEvidenceFile } from '../verification/files.mjs';
import { inventoryEvidence, compareEvidenceInventories } from '../verification/inventory.mjs';

const SCHEMA = 'truthsrc.module-seams-implementations/v1';
const LIMIT = 8 * 1024 * 1024;
const MAX_ROOTS = 64, MAX_MEMBERS = 1024, MAX_FILES = 4096, MAX_ENTRIES = 8192, MAX_DEPTH = 32;
const TOOL = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const live = new WeakMap();
const fold = value => value.normalize('NFC').toLowerCase();
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid];
// atime is deliberately not freshness evidence: our own reads can change it.
const stamp = stat => [...identity(stat), stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs];
const inode = stat => `${stat.dev}:${stat.ino}`;
const nativeRelative = portable => portable.split('/').join(path.sep);
const roleModules = new Map([['pure-implementation', ['kernel']], ['adapter', ['glue', 'ext']], ['extension', ['ext']]]);
const memberKeys = ['id', 'version', 'module', 'role', 'symbol', 'construction', 'implements', 'sourceRootKey', 'file', 'source', 'sourceRoot'];

function boundedArray(value, maximum, location, nonempty = true) {
  array(value, location);
  if (value.length > maximum) fail('MODULE_SEAMS_CAPTURE_LIMIT', `collection exceeds ${maximum} entries`, location);
  if (nonempty && !value.length) fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'nonempty explicit collection required', location);
  return value;
}
function scalar(value, location) {
  text(value, location);
  if (!value.isWellFormed() || /[\p{Cc}\p{Cf}]/u.test(value)) fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'well-formed scalar without controls required', location);
  return value;
}
function portable(value, location) {
  text(value, location);
  if (Buffer.byteLength(value) > 4096 || value.split('/').length > MAX_DEPTH || value.split('/').some(p => Buffer.byteLength(p) > 255))
    fail('MODULE_SEAMS_CAPTURE_LIMIT', 'path exceeds 4096 bytes, 255 bytes per component or depth 32', location);
  if (!value.isWellFormed()) fail('MODULE_SEAMS_PATH', 'well-formed path required', location);
  return portableSeamsPath(value, location);
}
// Lexical only. Actual existing spellings are checked with assertCanonicalPath;
// prospective outDir spellings belong to the caller's localPath/I/O gate.
function absolute(value, location, code = 'MODULE_SEAMS_PATH') {
  if (typeof value !== 'string' || !value || !value.isWellFormed() || /[\p{Cc}\p{Cf}]/u.test(value) ||
      !path.isAbsolute(value) || path.resolve(value) !== value || path.sep === '/' && value.includes('\\'))
    fail(code, 'canonical native absolute path required', location);
  if (Buffer.byteLength(value) > 4096 || value.slice(path.parse(value).root.length).split(path.sep).length > 128)
    fail(code, 'absolute path exceeds 4096 bytes or 128 components', location);
  if (path.sep === '\\') {
    const root = path.parse(value).root, parts = value.slice(root.length).split(path.sep);
    const unc = /^\\\\[^\\]+\\[^\\]+\\$/.test(root) && !/^\\\\[?.]\\/.test(root);
    if (!(/^[A-Za-z]:\\$/.test(root) || unc) || value.includes('/') ||
        parts.some(p => !p || /[<>:"|?*]|[. ]$/u.test(p) || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\s*(?:\.|$)/iu.test(p)))
      fail(code, 'native drive/UNC path without filesystem aliases required', location);
  }
  return value;
}
function overlaps(a, b) {
  const x = fold(a), y = fold(b), contains = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === '' || !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
  };
  return contains(x, y) || contains(y, x);
}
function distinct(values, location, label, normalize = value => value) {
  const seen = new Set();
  for (const value of values) {
    const key = normalize(value);
    if (seen.has(key)) fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', `duplicate or aliased ${label}: ${value}`, location);
    seen.add(key);
  }
}
function declarations(sourceRoots, handwritten, project) {
  const source = p => at(project, p);
  boundedArray(sourceRoots, MAX_ROOTS, source('/sourceRoots'));
  boundedArray(handwritten, MAX_MEMBERS, source('/handwritten'));
  for (const [i, root] of sourceRoots.entries()) {
    const s = source('/sourceRoots/' + i);
    object(root, ['id', 'module', 'path'], s); scalar(root.id, s); portable(root.path, s);
    if (!['kernel', 'glue', 'ext'].includes(root.module)) fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'source root module must be kernel, glue or ext', s);
  }
  distinct(sourceRoots.map(r => r.id), source('/sourceRoots'), 'root key');
  for (const [i, root] of sourceRoots.entries()) for (const other of sourceRoots.slice(0, i))
    if (overlaps(nativeRelative(root.path), nativeRelative(other.path)))
      fail('MODULE_SEAMS_CAPTURE_OVERLAP', 'source roots must be distinct, non-nested and NFC/case disjoint', source('/sourceRoots/' + i));
  const byRoot = new Map(sourceRoots.map(r => [r.id, r]));
  for (const [i, member] of handwritten.entries()) {
    const s = source('/handwritten/' + i);
    object(member, memberKeys, s);
    for (const key of ['id', 'version', 'symbol', 'sourceRootKey']) scalar(member[key], s);
    portable(member.file, s); portable(member.sourceRoot, s);
    if (!member.file.endsWith('.scala')) fail('MODULE_SEAMS_PATH', 'declared implementation must be a Scala file (inventory never filters extensions)', s);
    const modules = roleModules.get(member.role);
    if (!modules?.includes(member.module) || !['class', 'object'].includes(member.construction))
      fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'invalid implementation role/module/construction', s);
    if (!/^(?:[a-z][a-z0-9_]*\.)+[A-Z][A-Za-z0-9]*$/u.test(member.symbol))
      fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'complete portable Scala type FQN required', s);
    const parts = member.symbol.split('.'), typeName = parts.pop(), packageName = parts.join('.');
    for (const [space, spelling] of [['scala-package', packageName], ['scala-type', typeName]])
      resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: member.id, scope: packageName, space, spelling, binding: spelling, prefix: [], suffix: [] });
    object(member.source, ['document', 'pointer'], s); scalar(member.source.document, s); pointer(member.source.pointer, s);
    if (member.implements !== null) {
      reference(member.implements, s);
      if (member.implements.kind !== 'port') fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'implements must be a port reference or explicit null', s);
    } else if (member.role !== 'pure-implementation') fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'adapter/extension require an explicit port reference', s);
    const root = byRoot.get(member.sourceRootKey);
    if (!root || root.module !== member.module || root.path !== member.sourceRoot)
      fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'member root key, raw sourceRoot path and module must match exactly', s);
  }
  distinct(handwritten.map(h => h.id), source('/handwritten'), 'member id');
  distinct(handwritten.map(h => h.symbol), source('/handwritten'), 'symbol', fold);
  const memberPaths = handwritten.map(h => nativeRelative(h.sourceRoot + '/' + h.file));
  distinct(memberPaths, source('/handwritten'), 'member file', fold);
  for (const [i, file] of memberPaths.entries()) for (const other of memberPaths.slice(0, i))
    if (overlaps(file, other)) fail('MODULE_SEAMS_CAPTURE_OVERLAP', 'member paths must be distinct, non-nested and NFC/case disjoint', source('/handwritten/' + i));
  for (const root of sourceRoots) if (!handwritten.some(h => h.sourceRootKey === root.id))
    fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'every source root needs at least one declared member', source('/sourceRoots'));
}
function paths(input) {
  const { projectFile, tree, inputFiles, sourceRoots } = input, source = p => at(projectFile, p);
  absolute(projectFile, source('/projectFile')); absolute(tree, source('/tree'));
  boundedArray(inputFiles, MAX_FILES, source('/inputFiles'));
  inputFiles.forEach(file => absolute(file, source('/inputFiles')));
  distinct(inputFiles, source('/inputFiles'), 'input file', fold);
  if (!inputFiles.includes(projectFile)) fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'inputFiles must uniquely include projectFile', source('/inputFiles'));
  const base = path.dirname(projectFile), graph = path.join(base, '.truthsrc', 'knowledge.sqlite');
  const roots = sourceRoots.map(r => ({ ...r, absolutePath: path.join(base, nativeRelative(r.path)) }));
  const protectedPaths = [{ file: tree, label: 'author tree' }, { file: projectFile, label: 'project' },
    ...inputFiles.map(file => ({ file, label: 'input/document' })), { file: TOOL, label: 'tool' }, { file: graph, label: 'project graph' }];
  for (const [i, root] of roots.entries()) for (const protectedPath of protectedPaths)
    if (overlaps(root.absolutePath, protectedPath.file)) fail('MODULE_SEAMS_CAPTURE_OVERLAP', `implementation root overlaps ${protectedPath.label}: ${root.absolutePath}`, source('/sourceRoots/' + i));
  return { roots, protectedPaths };
}
function io(project, phase, file, operation, code = 'MODULE_SEAMS_CAPTURE_IO') {
  try { return operation(); }
  catch (error) {
    if (error instanceof ProductError) throw error;
    const reason = error && typeof error.message === 'string' ? error.message : 'unknown I/O failure';
    fail(code, `${phase} at ${file}: ${error?.code ? error.code + ' ' : ''}${reason}; no repair performed`, at(project));
  }
}
function regular(stat, file, project) {
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1n)
    fail('MODULE_SEAMS_CAPTURE_IO', 'regular single-link file required: ' + file, at(project));
  if (stat.size < 0n || stat.size > BigInt(LIMIT)) fail('MODULE_SEAMS_CAPTURE_LIMIT', 'file exceeds 8 MiB: ' + file, at(project));
}

// inventoryEvidence bounds each file but has no aggregate budget/traversal limit.
// This stat-only preflight supplies those bounds and exact admission BEFORE any
// content reader. It is not a replacement scanner/hash reader: strict inventory
// still performs its own canonical path, descriptor and pre/post checks.
function observe(input, resolved) {
  const project = input.projectFile, source = at(project), fileRows = new Map(), directoryInodes = new Map(), fileInodes = new Map();
  const parents = new Map(), trees = [], rootSizes = [];
  let total = 0n, entries = 0;
  function parentsOf(file) {
    for (let directory = path.dirname(file); ; directory = path.dirname(directory)) {
      if (!parents.has(directory)) {
        const stat = fs.lstatSync(directory, { bigint: true });
        if (stat.isSymbolicLink() || !stat.isDirectory()) fail('MODULE_SEAMS_CAPTURE_IO', 'ordinary directory ancestor required: ' + directory, source);
        parents.set(directory, identity(stat));
      }
      if (directory === path.dirname(directory)) break;
    }
  }
  function addFile(file, stat) {
    regular(stat, file, project);
    const row = { file, stamp: stamp(stat), bytes: Number(stat.size) }, previous = fileRows.get(file);
    if (previous) {
      if (!isDeepStrictEqual(previous, row)) fail('MODULE_SEAMS_CAPTURE_DRIFT', 'file changed during bounded preflight: ' + file, source);
    } else {
      const other = fileInodes.get(inode(stat));
      if (other) fail('MODULE_SEAMS_CAPTURE_IO', `physical file alias: ${other} / ${file}`, source);
      fileInodes.set(inode(stat), file); fileRows.set(file, row); total += stat.size;
      if (fileRows.size > MAX_FILES || total > BigInt(LIMIT)) fail('MODULE_SEAMS_CAPTURE_LIMIT', 'combined inputs/implementations exceed 4096 files or 8 MiB', source);
    }
    return row;
  }
  assertCanonicalPath(input.projectFile, { kind: 'file' });
  assertCanonicalPath(input.tree);
  parentsOf(input.tree);
  for (const file of input.inputFiles) {
    assertCanonicalPath(file, { kind: 'file' }); parentsOf(file); addFile(file, fs.lstatSync(file, { bigint: true }));
  }
  function walk(root) {
    assertCanonicalPath(root); parentsOf(root);
    const rows = [], inventoryFiles = [];
    function visit(directory, depth) {
      if (depth > MAX_DEPTH) fail('MODULE_SEAMS_CAPTURE_LIMIT', 'directory depth exceeds 32: ' + directory, source);
      const stat = fs.lstatSync(directory, { bigint: true });
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail('MODULE_SEAMS_CAPTURE_IO', 'ordinary directory required: ' + directory, source);
      const other = directoryInodes.get(inode(stat));
      if (other) fail('MODULE_SEAMS_CAPTURE_IO', `physical directory alias: ${other} / ${directory}`, source);
      directoryInodes.set(inode(stat), directory);
      if (directoryInodes.size > MAX_FILES) fail('MODULE_SEAMS_CAPTURE_LIMIT', 'directory count exceeds 4096', source);
      const names = [], handle = fs.opendirSync(directory);
      try {
        for (let entry; (entry = handle.readSync()) !== null;) {
          if (++entries > MAX_ENTRIES) fail('MODULE_SEAMS_CAPTURE_LIMIT', 'tree entries exceed 8192', source);
          portable(entry.name, source); names.push(entry.name);
        }
      } finally { handle.closeSync(); }
      names.sort(); distinct(names, source, 'directory entry', fold);
      rows.push({ file: directory, kind: 'directory', stamp: stamp(stat), names });
      for (const name of names) {
        const file = path.join(directory, name), relative = path.relative(root, file);
        portable(relative.split(path.sep).join('/'), source);
        const entry = fs.lstatSync(file, { bigint: true });
        if (entry.isSymbolicLink()) fail('MODULE_SEAMS_CAPTURE_IO', 'symlink in implementation/input tree: ' + file, source);
        if (entry.isDirectory()) visit(file, depth + 1);
        else { const row = addFile(file, entry); inventoryFiles.push(relative); rows.push({ ...row, kind: 'file' }); }
      }
      if (!isDeepStrictEqual(stamp(fs.lstatSync(directory, { bigint: true })), stamp(stat)))
        fail('MODULE_SEAMS_CAPTURE_DRIFT', 'directory changed during bounded preflight: ' + directory, source);
    }
    visit(root, 0);
    trees.push({ root, rows });
    return inventoryFiles.sort();
  }
  const treeFiles = walk(input.tree);
  const inputs = new Set(input.inputFiles);
  if (treeFiles.some(file => !inputs.has(path.join(input.tree, file))))
    fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'inputFiles must include every file in tree (no inferred or excluded files)', source);
  for (const root of resolved.roots) {
    const actual = walk(root.absolutePath), expected = input.handwritten.filter(h => h.sourceRootKey === root.id).map(h => nativeRelative(h.file)).sort();
    if (!isDeepStrictEqual(actual, expected)) fail('MODULE_SEAMS_CAPTURE_MEMBERSHIP', `root ${root.id} membership differs; expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`, source);
    rootSizes.push(Math.max(...actual.map(file => fileRows.get(path.join(root.absolutePath, file)).bytes)));
  }
  return { files: [...fileRows.values()], parents: [...parents], trees, rootSizes, total: Number(total) };
}
function sameState(expected, actual, project) {
  if (!isDeepStrictEqual(expected, actual)) fail('MODULE_SEAMS_CAPTURE_DRIFT', 'implementation/input membership, file stat, root or ancestor identity changed', at(project));
}
function checkedState(input, resolved, baseline, phase, code = 'MODULE_SEAMS_CAPTURE_IO') {
  const actual = io(input.projectFile, phase, input.projectFile, () => observe(input, resolved), code);
  sameState(baseline, actual, input.projectFile);
}
function inputInventory(input, baseline) {
  const sizes = new Map(baseline.files.map(row => [row.file, row.bytes])), inventory = {};
  for (const file of input.inputFiles) {
    const captured = io(input.projectFile, 'capture input', file, () => captureEvidenceFile(file, { limit: sizes.get(file) }));
    Object.defineProperty(inventory, file, { value: { bytes: captured.bytes, sha256: captured.sha256 }, enumerable: true });
  }
  return inventory;
}
function rootInventory(input, root, maximum) {
  return io(input.projectFile, 'capture complete root inventory', root.absolutePath,
    () => inventoryEvidence(root.absolutePath, { limit: maximum }));
}
function requireLive(evidence) {
  const record = live.get(evidence);
  if (!record) fail('MODULE_SEAMS_CAPTURE_REQUIRED', 'original live implementation capture required; cloned/serialized evidence is display-only', at('implementations'));
  return record;
}

/** Read-only synchronous capture. No source execution, body parsing or certification. */
export function captureImplementations(raw) {
  const input = detach(raw);
  object(input, ['projectFile', 'tree', 'inputFiles', 'sourceRoots', 'handwritten'], at('implementations'));
  declarations(input.sourceRoots, input.handwritten, typeof input.projectFile === 'string' ? input.projectFile : 'implementations');
  const resolved = paths(input);
  const baseline = io(input.projectFile, 'bounded capture preflight', input.projectFile, () => observe(input, resolved));
  const inputs = inputInventory(input, baseline);
  checkedState(input, resolved, baseline, 'after input capture');
  const roots = resolved.roots.map((root, i) => {
    const inventory = rootInventory(input, root, baseline.rootSizes[i]);
    checkedState(input, resolved, baseline, 'after root inventory');
    const expected = {};
    for (const member of input.handwritten.filter(h => h.sourceRootKey === root.id)) {
      const key = nativeRelative(member.file), fingerprint = inventory[key];
      if (!fingerprint) fail('MODULE_SEAMS_CAPTURE_MEMBERSHIP', 'inventory missing declared member: ' + key, at(input.projectFile));
      Object.defineProperty(expected, key, { value: fingerprint, enumerable: true });
    }
    io(input.projectFile, 'compare complete root inventory', root.absolutePath, () => compareEvidenceInventories(expected, inventory));
    return { ...root, inventory };
  });
  const byRoot = new Map(roots.map(root => [root.id, root]));
  const members = input.handwritten.map(member => {
    const root = byRoot.get(member.sourceRootKey), file = nativeRelative(member.file);
    return { ...member, absoluteFile: path.join(root.absolutePath, file), ...root.inventory[file] };
  });
  const evidence = detach({ schemaVersion: SCHEMA, project: input.projectFile, roots, members });
  checkedState(input, resolved, baseline, 'close implementation capture');
  live.set(evidence, { input, resolved, baseline, inputs });
  return evidence;
}

/** Pure admission of a live capture against a fresh lower and a lexical output. */
export function implementationBuildInputs(evidence, raw) {
  const record = requireLive(evidence), input = detach(raw);
  object(input, ['sourceRoots', 'handwritten', 'outDir'], at(record.input.projectFile));
  if (!equal(input.sourceRoots, record.input.sourceRoots) || !equal(input.handwritten, record.input.handwritten))
    fail('MODULE_SEAMS_CAPTURE_DECLARATIONS', 'fresh lower sourceRoots and handwritten must match the whole captured declarations (including order and provenance)', at(record.input.projectFile));
  absolute(input.outDir, at(record.input.projectFile, '/outDir'), 'MODULE_SEAMS_CAPTURE_OUTPUT');
  for (const protectedPath of [...record.resolved.protectedPaths, ...record.resolved.roots.map(r => ({ file: r.absolutePath, label: 'implementation root' }))])
    if (overlaps(input.outDir, protectedPath.file)) fail('MODULE_SEAMS_CAPTURE_OUTPUT', `output overlaps ${protectedPath.label}: ${input.outDir}`, at(record.input.projectFile, '/outDir'));
  return detach(record.resolved.roots.map(({ id, module, absolutePath }) => ({ id, module, absolutePath })));
}

/** Recheck every input, file, directory membership and captured path identity. */
export function assertImplementationsUnchanged(evidence) {
  const record = requireLive(evidence), { input, resolved, baseline } = record;
  try {
    checkedState(input, resolved, baseline, 'live recheck preflight', 'MODULE_SEAMS_CAPTURE_DRIFT');
    const actual = inputInventory(input, baseline);
    io(input.projectFile, 'compare input fingerprints', input.projectFile, () => compareEvidenceInventories(record.inputs, actual), 'MODULE_SEAMS_CAPTURE_DRIFT');
    for (const [i, root] of evidence.roots.entries()) {
      const inventory = rootInventory(input, root, baseline.rootSizes[i]);
      io(input.projectFile, 'compare complete live root inventory', root.absolutePath,
        () => compareEvidenceInventories(root.inventory, inventory), 'MODULE_SEAMS_CAPTURE_DRIFT');
      checkedState(input, resolved, baseline, 'after live root inventory', 'MODULE_SEAMS_CAPTURE_DRIFT');
    }
    checkedState(input, resolved, baseline, 'close live recheck', 'MODULE_SEAMS_CAPTURE_DRIFT');
  } catch (error) {
    if (error instanceof ProductError && error.diagnostic.code !== 'MODULE_SEAMS_CAPTURE_DRIFT')
      fail('MODULE_SEAMS_CAPTURE_DRIFT', 'live implementation/input recheck failed: ' + error.message, at(input.projectFile), [error.diagnostic]);
    throw error;
  }
}
