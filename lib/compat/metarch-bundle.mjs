import { lstatSync, readFileSync, readdirSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { loadAuthorTree } from '../author-tree.mjs';
import { projectMetarchProducts } from './metarch.mjs';
import { parseStrictJson, MAX_JSON_BYTES } from '../strict-json.mjs';
import { copyImmutableData } from '../immutable-data.mjs';

export const METARCH_BUNDLE_VERSION = 'truthsrc.metarch-bundle/v1';
export const METARCH_PRODUCT_FILES = Object.freeze({ METARCH: 'metarch.json', TEMPLATE: 'metarch.fields.template.json',
  READMODELS: 'story.readmodels.json', STORIES: 'story.stories.json', CONCERNS: 'concerns.json' });
const MANIFEST = 'metarch-bundle.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error('METARCH_BUNDLE: ' + message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys, where) => {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(where + ': unknown or missing fields');
};
const segment = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
const same = (a, b, where) => { if (!isDeepStrictEqual(a, b)) fail(where + ': changed or inconsistent'); };
const inside = (a, b) => { const p = relative(a, b); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };
function absolutePath(input, absent = false) {
  if (typeof input !== 'string' || !isAbsolute(input) || input.includes('\0') || resolve(input) !== input) fail('absolute normalized path required');
  let current = parse(input).root;
  for (const part of input.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || realpathSync(current) !== current) fail('path alias: ' + current);
    } catch (error) { if (!(absent && error.code === 'ENOENT')) throw error; }
  }
  return input;
}
function bytes(file) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_JSON_BYTES) fail('regular single-link bounded file required: ' + file);
  const content = readFileSync(file), after = lstatSync(file);
  if (after.dev !== stat.dev || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || content.length !== stat.size) fail('file changed while reading: ' + file);
  return content;
}
function sourceInventory(root) {
  absolutePath(root);
  if (!lstatSync(root).isDirectory()) fail('source root must be a directory');
  const files = [], directories = [];
  let size = 0;
  const walk = (dir = '') => {
    for (const name of readdirSync(join(root, dir)).sort()) {
      const file = dir ? dir + '/' + name : name;
      if (/[\\\x00-\x1f]/.test(file)) fail('unsafe source filename');
      const full = join(root, file), stat = lstatSync(full);
      if (stat.isSymbolicLink()) fail('source symlink: ' + file);
      if (stat.isDirectory()) { directories.push(file); walk(file); }
      else {
        const content = bytes(full); size += content.length;
        if (size > MAX_JSON_BYTES) fail('source exceeds 8 MiB');
        files.push({ file, bytes: content.length, sha256: hash(content) });
      }
    }
  };
  walk(); files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0); directories.sort();
  return { root, files, directories };
}
function productJson(content) {
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(content), value = JSON.parse(raw);
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [], stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (tokens[i + 1] === ':') {
      const key = JSON.parse(token), seen = stack.at(-1);
      if (seen.has(key)) fail('duplicate product JSON key');
      seen.add(key);
    }
  }
  if (!plain(value)) fail('product must be a JSON object');
  return value;
}
function manifestShape(manifest) {
  exact(manifest, ['schemaVersion', 'profile', 'system', 'context', 'source', 'products'], 'manifest');
  if (manifest.schemaVersion !== METARCH_BUNDLE_VERSION || manifest.profile !== 'metarch.truth.v1/main' || manifest.context !== 'main' || !segment(manifest.system)) fail('unsupported manifest identity/profile');
  exact(manifest.source, ['root', 'files', 'directories'], 'source');
  if (basename(manifest.source.root) !== manifest.system) fail('source basename must equal system');
  if (!Array.isArray(manifest.source.files) || !Array.isArray(manifest.source.directories)) fail('source inventory arrays required');
  for (const row of manifest.source.files) {
    exact(row, ['file', 'bytes', 'sha256'], 'source file');
    checkDigest(row);
  }
  for (const file of ['system.yaml', 'contexts/main/context.yaml']) if (!manifest.source.files.some(row => row.file === file)) fail('source declaration missing: ' + file);
  if (!Array.isArray(manifest.products) || manifest.products.length !== 5) fail('exactly five products required');
  manifest.products.forEach((row, i) => {
    exact(row, ['name', 'file', 'bytes', 'sha256'], 'product');
    const [name, file] = Object.entries(METARCH_PRODUCT_FILES)[i];
    if (row.name !== name || row.file !== file) fail('product order/name/file mismatch');
    checkDigest(row);
  });
}
function checkDigest(row) {
  if (!Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > MAX_JSON_BYTES || !/^[0-9a-f]{64}$/.test(row.sha256)) fail('invalid file digest or size');
}
export function captureMetarchAuthor(treeDir) {
  const source = sourceInventory(treeDir);
  if (!source.files.some(row => row.file === 'system.yaml')) fail('explicit new author system.yaml required');
  const author = loadAuthorTree(treeDir);
  if (author.context.id !== 'main' || !author.system.compatibility?.metarch) fail('Metarch compatibility author profile required');
  const products = projectMetarchProducts(author.canonical, author.system.compatibility.metarch);
  same(sourceInventory(treeDir), source, 'author source');
  return { source, products, system: author.system.id, context: author.context.id };
}
export function readMetarchBundle(manifestFile) {
  absolutePath(manifestFile);
  if (basename(manifestFile) !== MANIFEST) fail('manifest filename must be ' + MANIFEST);
  const root = dirname(manifestFile), capturedManifest = bytes(manifestFile), manifest = parseStrictJson(capturedManifest);
  manifestShape(manifest);
  if (inside(root, manifest.source.root) || inside(manifest.source.root, root)) fail('source and bundle must be disjoint');
  const inventory = [MANIFEST, ...Object.values(METARCH_PRODUCT_FILES)].sort();
  same(readdirSync(root).sort(), inventory, 'bundle inventory');
  same(sourceInventory(manifest.source.root), manifest.source, 'source inventory');
  const products = {}, contents = new Map();
  for (const row of manifest.products) {
    const content = bytes(join(root, row.file));
    if (content.length !== row.bytes || hash(content) !== row.sha256) fail('product digest mismatch: ' + row.name);
    products[row.name] = productJson(content); contents.set(row.file, content);
  }
  const author = loadAuthorTree(manifest.source.root);
  if (author.system.id !== manifest.system || author.context.id !== manifest.context) fail('source identity differs');
  const projected = projectMetarchProducts(author.canonical, author.system.compatibility?.metarch);
  for (const row of manifest.products) {
    const expected = Buffer.from(JSON.stringify(projected[row.name], null, 2) + (row.name === 'METARCH' ? '' : '\n'));
    same(contents.get(row.file), expected, 'source projection ' + row.name);
  }
  same(sourceInventory(manifest.source.root), manifest.source, 'source after read');
  same(bytes(manifestFile), capturedManifest, 'manifest after read');
  for (const [file, content] of contents) same(bytes(join(root, file)), content, 'product after read');
  same(readdirSync(root).sort(), inventory, 'bundle inventory after read');
  return copyImmutableData({ manifest, products });
}
export function writeMetarchBundle({ treeDir, outDir }) {
  absolutePath(outDir, true);
  if (inside(treeDir, outDir) || inside(outDir, treeDir)) fail('source and bundle must be disjoint');
  try { lstatSync(outDir); fail('destination already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const captured = captureMetarchAuthor(treeDir), products = [], contents = [];
  for (const [name, file] of Object.entries(METARCH_PRODUCT_FILES)) {
    const content = JSON.stringify(captured.products[name], null, 2) + (name === 'METARCH' ? '' : '\n');
    products.push({ name, file, bytes: Buffer.byteLength(content), sha256: hash(content) });
    contents.push({ file, content });
  }
  const manifest = { schemaVersion: METARCH_BUNDLE_VERSION, profile: 'metarch.truth.v1/main', system: captured.system,
    context: captured.context, source: captured.source, products };
  manifestShape(manifest);
  same(sourceInventory(treeDir), captured.source, 'source before publication');
  mkdirSync(dirname(outDir), { recursive: true }); absolutePath(dirname(outDir)); mkdirSync(outDir);
  for (const { file, content } of contents) writeFileSync(join(outDir, file), content, { flag: 'wx' });
  same(sourceInventory(treeDir), captured.source, 'source before manifest');
  writeFileSync(join(outDir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  readMetarchBundle(join(outDir, MANIFEST));
  return copyImmutableData({ manifest: join(outDir, MANIFEST), system: captured.system, context: captured.context, products, source: captured.source });
}
