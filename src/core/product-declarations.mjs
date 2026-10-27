// Lightweight versioned declarations shared by manifest and product admission.
import { copyImmutableData } from '../../lib/immutable-data.mjs';

export const REQUIREMENTS_VERSION = 'truthsrc.product-requirements/v1';
export const ENVELOPE_VERSION = 'truthsrc.product-envelope/v1';
export const registry = copyImmutableData({
  canonical: { version: '1', payloadSchemaVersion: 'truthsrc/v1', capabilities: [] },
  'saga-contract': { version: '1', payloadSchemaVersion: 'truthsrc.saga-ir/v1',
    capabilities: [{ id: 'saga-static-contract', version: '1' }] },
});
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
const child = (pointer, key) => `${pointer}/${escape(String(key))}`;
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

class DataError extends Error {
  constructor(document, pointer, message) {
    super(message);
    this.document = document;
    this.pointer = pointer;
  }
}

export function copy(value, document, request = false) {
  return copyImmutableData(value, '', (pointer, message) => {
    const match = request && pointer.match(/^\/(manifest|canonical|products|bindings)(?=\/|$)/);
    throw new DataError(match ? match[1] : document, match ? pointer.slice(match[0].length) : pointer, message);
  });
}

export function diagnostics() {
  const rows = [];
  const report = (code, document, pointer, message) => rows.push({ code, message, source: { document, pointer } });
  const finish = () => copyImmutableData(rows.sort((a, b) => compare(a.source.document, b.source.document)
    || compare(a.source.pointer, b.source.pointer) || compare(a.code, b.code)));
  return { report, finish, rows };
}

export function closed(value, keys, document, pointer, report) {
  if (!object(value)) {
    report('PRODUCT_SHAPE', document, pointer, 'Expected an object.');
    return false;
  }
  for (const key of Object.keys(value)) if (!keys.includes(key)) {
    report('PRODUCT_FIELD_UNKNOWN', document, child(pointer, key), 'Unsupported contract field.');
  }
  for (const key of keys) if (!Object.hasOwn(value, key)) {
    report('PRODUCT_FIELD_REQUIRED', document, child(pointer, key), 'Explicit contract field required.');
  }
  return true;
}

export function capabilities(value, document, pointer, report, productId) {
  if (!Array.isArray(value)) {
    report('PRODUCT_CAPABILITY_SHAPE', document, pointer, 'Expected an explicit capabilities array.');
    return;
  }
  const supported = typeof productId === 'string' && Object.hasOwn(registry, productId)
    ? registry[productId].capabilities : [];
  const seen = new Set();
  value.forEach((entry, i) => {
    const at = child(pointer, i);
    if (!closed(entry, ['id', 'version'], document, at, report)) return;
    if (typeof entry.id !== 'string' || !entry.id.trim()) report('PRODUCT_CAPABILITY_SHAPE', document, child(at, 'id'), 'Capability id must be a nonempty string.');
    if (typeof entry.version !== 'string' || !entry.version.trim()) report('PRODUCT_CAPABILITY_SHAPE', document, child(at, 'version'), 'Capability version must be an explicit nonempty string.');
    if (seen.has(entry.id)) report('PRODUCT_CAPABILITY_DUPLICATE', document, child(at, 'id'), 'Duplicate capability id.');
    seen.add(entry.id);
    const expected = supported.find(capability => capability.id === entry.id);
    if (!expected) report('PRODUCT_CAPABILITY_UNSUPPORTED', document, at, supported.length
      ? 'Capability is not supported by this product.' : 'This product contract admits no semantic capabilities.');
    else if (entry.version !== expected.version) report('PRODUCT_CAPABILITY_VERSION', document, child(at, 'version'), 'Expected exact capability version "1".');
  });
  for (const expected of supported) if (!seen.has(expected.id)) {
    report('PRODUCT_CAPABILITY_MISSING', document, pointer, `Required capability ${expected.id} is absent.`);
  }
}

export function identity(entry, document, pointer, report) {
  if (typeof entry.id !== 'string' || !Object.hasOwn(registry, entry.id)) {
    report('PRODUCT_UNKNOWN', document, child(pointer, 'id'), 'Only canonical and saga-contract are registered.');
    return;
  }
  const contract = registry[entry.id];
  if (entry.version !== contract.version) report('PRODUCT_VERSION', document, child(pointer, 'version'), 'Expected exact product version "1".');
  if (entry.payloadSchemaVersion !== contract.payloadSchemaVersion) report('PRODUCT_PAYLOAD_SCHEMA', document, child(pointer, 'payloadSchemaVersion'), `Expected exact payload schema ${contract.payloadSchemaVersion}.`);
}

export function declaration(manifest, report) {
  if (!object(manifest)) {
    report('PRODUCT_MANIFEST_SHAPE', 'manifest', '', 'Expected a manifest object.');
    return null;
  }
  if (!Object.hasOwn(manifest, 'declaredProducts')) return null;
  if (typeof manifest.name !== 'string' || !/^_?[a-z0-9-]+$/.test(manifest.name)) report('PRODUCT_MANIFEST_ID', 'manifest', '/name', 'Explicit slug-cased plugin identity required.');
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) report('PRODUCT_MANIFEST_VERSION', 'manifest', '/version', 'Explicit nonempty plugin version required.');
  if (manifest.inputSchema !== 'truthsrc/v1.0') report('PRODUCT_INPUT_SCHEMA', 'manifest', '/inputSchema', 'Opt-in admission requires exact truthsrc/v1.0.');
  const value = manifest.declaredProducts;
  const at = '/declaredProducts';
  if (!closed(value, ['schemaVersion', 'products'], 'manifest', at, report)) return null;
  if (value.schemaVersion !== REQUIREMENTS_VERSION) report('PRODUCT_REQUIREMENTS_VERSION', 'manifest', `${at}/schemaVersion`, `Expected ${REQUIREMENTS_VERSION}.`);
  if (!Array.isArray(value.products) || !value.products.length) {
    report('PRODUCT_REQUIREMENTS_SHAPE', 'manifest', `${at}/products`, 'Expected a nonempty product requirements array.');
    return null;
  }
  const seen = new Set();
  value.products.forEach((entry, i) => {
    const pointer = `${at}/products/${i}`;
    if (!closed(entry, ['id', 'version', 'payloadSchemaVersion', 'capabilities'], 'manifest', pointer, report)) return;
    identity(entry, 'manifest', pointer, report);
    if (seen.has(entry.id)) report('PRODUCT_DUPLICATE', 'manifest', `${pointer}/id`, 'Duplicate product requirement id.');
    seen.add(entry.id);
    capabilities(entry.capabilities, 'manifest', `${pointer}/capabilities`, report, entry.id);
  });
  return value;
}

export function dataFailure(error, result, finish) {
  if (!(error instanceof DataError)) throw error;
  result.report('PRODUCT_DATA', error.document, error.pointer, error.message);
  return finish();
}

// This checks the new declaration and plugin identity, not the entire legacy
// generator manifest. loadManifest retains that filesystem-facing contract.
export function validateDeclaredProducts(input) {
  const result = diagnostics();
  const finish = requirements => Object.freeze({ requirements: result.rows.length ? null : requirements ?? null, diagnostics: result.finish() });
  let manifest;
  try { manifest = copy(input, 'manifest'); }
  catch (error) { return dataFailure(error, result, () => finish(null)); }
  return finish(declaration(manifest, result.report));
}
