import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { copyImmutableData } from '../immutable-data.mjs';
import { MAX_JSON_BYTES, parseStrictJson } from '../strict-json.mjs';
import { at, array, fail, object, text, validateRequest } from './request.mjs';
import { COMPILATION } from './registry.mjs';
import { compileProductSet } from './compile.mjs';

function read(file, includeText = false) {
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) fail('PRODUCT_FILE', 'input must be a regular non-symlink file');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > MAX_JSON_BYTES) fail('PRODUCT_FILE', 'input is not a bounded regular file');
    const buffer = Buffer.alloc(MAX_JSON_BYTES + 1);
    let size = 0, n;
    while (size < buffer.length && (n = readSync(fd, buffer, size, buffer.length - size, null)) > 0) size += n;
    const after = fstatSync(fd);
    if (size > MAX_JSON_BYTES || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
      fail('PRODUCT_FILE', 'input changed during capture or exceeds size bound');
    const bytes = buffer.subarray(0, size);
    return { value: parseStrictJson(bytes), file: realpathSync(file), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: size,
      ...(includeText ? { text: bytes.toString('utf8') } : {}) };
  } finally { closeSync(fd); }
}

export function captureProductJson(file, { includeText = false } = {}) {
  if (!isAbsolute(file)) fail('PRODUCT_FILE', 'captured JSON must use an absolute path');
  return copyImmutableData(read(file, includeText));
}

export function captureProductRequest(file) {
  if (!isAbsolute(file)) fail('PRODUCT_FILE', 'request manifest must be an absolute path');
  const captured = read(file), manifest = captured.value;
  object(manifest, ['schemaVersion', 'documents', 'assemblies', 'requirements', 'options'], at('request'));
  if (manifest.schemaVersion !== 'truthsrc.product-input-files/v1') fail('PRODUCT_VERSION', 'unsupported file manifest');
  const sources = [{ role: 'manifest', file: captured.file, sha256: captured.sha256, bytes: captured.bytes }];
  let totalBytes = captured.bytes;
  const documents = array(manifest.documents, at('request', '/documents')).map((d, i) => {
    const location = at('request', `/documents/${i}`);
    object(d, ['id', 'schemaVersion', 'file'], location);
    text(d.id, location); text(d.schemaVersion, location); text(d.file, location);
    const doc = read(resolve(dirname(file), d.file));
    totalBytes += doc.bytes;
    if (totalBytes > MAX_JSON_BYTES) fail('PRODUCT_FILE', 'captured request files exceed 8 MiB total');
    sources.push({ document: d.id, file: doc.file, sha256: doc.sha256, bytes: doc.bytes });
    return { id: d.id, schemaVersion: d.schemaVersion, value: doc.value };
  });
  const request = validateRequest({ schemaVersion: COMPILATION, documents, assemblies: manifest.assemblies, requirements: manifest.requirements, options: manifest.options });
  return copyImmutableData({ request, sources });
}
export function readProductRequest(file) { return captureProductRequest(file).request; }

export function compileProductCli(args) {
  const options = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--request', '--out'].includes(flag) || options.has(flag) || !value || value.startsWith('--'))
      fail('PRODUCT_CLI', 'requires unique --request <file> and --out <new-file>; unknown flags refused');
    options.set(flag, resolve(value));
  }
  if (options.size !== 2) fail('PRODUCT_CLI', '--request and --out are mandatory');
  const captured = captureProductRequest(options.get('--request'));
  const compilation = compileProductSet(captured.request);
  if (compilation.result === null) fail('PRODUCT_COMPILATION', JSON.stringify(compilation.diagnostics));
  const output = options.get('--out');
  const pretty = JSON.stringify(compilation.result, null, 2) + '\n';
  const bytes = Buffer.byteLength(pretty, 'utf8') <= MAX_JSON_BYTES ? pretty : JSON.stringify(compilation.result) + '\n';
  if (Buffer.byteLength(bytes, 'utf8') > MAX_JSON_BYTES) fail('PRODUCT_INPUT', 'serialized product exceeds 8 MiB');
  // Exclusive creation: existing input/output files (including aliases) are never overwritten.
  writeFileSync(output, bytes, { encoding: 'utf8', flag: 'wx' });
  return copyImmutableData({ output, sha256: createHash('sha256').update(bytes).digest('hex'), sources: captured.sources });
}
