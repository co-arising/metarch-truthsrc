import { isDeepStrictEqual } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';
import { COMPILATION, PROFILES, profileFor } from './registry.mjs';
import { assembleDocuments } from './assemblies.mjs';

export class ProductError extends Error {
  constructor(code, message, source = { document: 'request', pointer: '' }, related = []) {
    super(message);
    this.diagnostic = { code, message, source, related };
  }
}
export const fail = (code, message, source, related) => { throw new ProductError(code, message, source, related); };
export const at = (document, pointer = '') => ({ document, pointer });
export const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
export const equal = (a, b) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
export function object(value, keys, source) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('PRODUCT_SHAPE', 'expected object', source);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail('PRODUCT_FIELD_UNKNOWN', `unsupported field: ${key}`, source);
  for (const key of keys) if (!Object.hasOwn(value, key)) fail('PRODUCT_FIELD_MISSING', `missing field: ${key}`, source);
}
export function array(value, source) {
  if (!Array.isArray(value)) fail('PRODUCT_SHAPE', 'expected array', source);
  return value;
}
export function text(value, source, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > 65536) fail('PRODUCT_SHAPE', 'invalid string', source);
  return value;
}
export function identity(value, source) {
  object(value, ['id', 'version'], source);
  text(value.id, source); text(value.version, source);
  return value;
}
export function pointer(value, source) {
  text(value, source, true);
  if (value !== '' && (!value.startsWith('/') || /~(?![01])/u.test(value))) fail('PRODUCT_POINTER', 'invalid JSON Pointer', source);
  return value === '' ? [] : value.slice(1).split('/').map(s => s.replaceAll('~1', '/').replaceAll('~0', '~'));
}
export function resolve(value, path, source) {
  for (const key of pointer(path, source)) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key) || (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/u.test(key)))
      fail('PRODUCT_SOURCE', 'source pointer does not resolve', source);
    value = value[key];
  }
  return value;
}
export function source(value, documents, location) {
  object(value, ['document', 'pointer'], location);
  text(value.document, location);
  const doc = documents.find(d => d.id === value.document);
  if (!doc) fail('PRODUCT_SOURCE', 'source document does not resolve', location);
  return resolve(doc.value, value.pointer, value);
}
export function unique(values, code, location) {
  if (new Set(values).size !== values.length) fail(code, 'duplicate identity', location);
}
export function detach(value) {
  const result = copyImmutableData(value, '', (p, message) => fail('PRODUCT_INPUT', message, at('request', p)));
  function numbers(v) {
    if (typeof v === 'number' && (!Number.isSafeInteger(v) || Object.is(v, -0))) fail('PRODUCT_EXACT_NUMBER', 'JSON numbers must be safe integers; exact values use strings');
    if (v && typeof v === 'object') Object.values(v).forEach(numbers);
  }
  numbers(result);
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 8 * 1024 * 1024) fail('PRODUCT_INPUT', 'request exceeds 8 MiB');
  return result;
}
export function validateRequest(raw) {
  const request = detach(raw);
  object(request, ['schemaVersion', 'documents', 'assemblies', 'requirements', 'options'], at('request'));
  if (request.schemaVersion !== COMPILATION) fail('PRODUCT_VERSION', 'unsupported request version');
  object(request.options, [], at('request', '/options'));
  array(request.assemblies, at('request', '/assemblies'));
  array(request.documents, at('request', '/documents'));
  unique(request.documents.map(d => d?.id), 'PRODUCT_DUPLICATE', at('request', '/documents'));
  const schemas = new Set(Object.values(PROFILES).flatMap(p => Object.values(p.roles)));
  for (const [i, doc] of request.documents.entries()) {
    const location = at('request', `/documents/${i}`);
    object(doc, ['id', 'schemaVersion', 'value'], location); text(doc.id, location);
    if (!schemas.has(doc.schemaVersion) || doc.value?.schemaVersion !== doc.schemaVersion) fail('PRODUCT_VERSION', 'unsupported or mismatched document schema', location);
    if (doc.schemaVersion === 'truthsrc.reference-binding/v1') object(doc.value, ['schemaVersion', 'layout'], location);
    if (['truthsrc.domain-semantic-binding/v1', 'truthsrc.domain-semantic-binding/v2', 'truthsrc.domain-semantic-binding/v3', 'truthsrc.domain-semantic-binding/v4'].includes(doc.schemaVersion)) object(doc.value, ['schemaVersion', 'decisions'], location);
    if (doc.schemaVersion === 'truthsrc.exact-type-binding/v1') object(doc.value, ['schemaVersion', 'types'], location);
    if (doc.schemaVersion === 'truthsrc.exact-codec-binding/v1') object(doc.value, ['schemaVersion', 'codecs'], location);
    if (doc.schemaVersion === 'truthsrc.effect-host-binding/v1') object(doc.value, ['schemaVersion', 'effects'], location);
    if (doc.schemaVersion === 'truthsrc.product-design-binding/v1') object(doc.value, ['schemaVersion', 'designs'], location);
    if (doc.schemaVersion === 'truthsrc.saga-host-binding/v1') object(doc.value, ['schemaVersion', 'hosts'], location);
    if (['truthsrc.artifact-binding/v1', 'truthsrc.artifact-binding/v2', 'truthsrc.artifact-binding/v3'].includes(doc.schemaVersion)) object(doc.value, ['schemaVersion', 'artifacts'], location);
    if (['truthsrc.domain-external-event-binding/v1', 'truthsrc.domain-external-event-binding/v2'].includes(doc.schemaVersion)) object(doc.value, ['schemaVersion', 'externalEvents'], location);
    if (['truthsrc.domain-dependency-binding/v1', 'truthsrc.domain-dependency-binding/v2', 'truthsrc.domain-dependency-binding/v3', 'truthsrc.domain-dependency-binding/v4', 'truthsrc.domain-dependency-binding/v5', 'truthsrc.domain-dependency-binding/v6'].includes(doc.schemaVersion)) object(doc.value, ['schemaVersion', 'dependencies'], location);
    if (['truthsrc.domain-fold-binding/v1', 'truthsrc.domain-fold-binding/v2', 'truthsrc.domain-fold-binding/v3', 'truthsrc.domain-fold-binding/v4', 'truthsrc.domain-fold-binding/v5', 'truthsrc.domain-fold-binding/v6'].includes(doc.schemaVersion)) object(doc.value, ['schemaVersion', 'folds'], location);
    if (!doc.value || Array.isArray(doc.value) || typeof doc.value !== 'object') fail('PRODUCT_SHAPE', 'document must be an object', location);
  }
  const assembled = assembleDocuments(request.documents, request.assemblies, { array, at, equal, escape, fail, object, text, unique });
  const documents = assembled.documents;
  array(request.requirements, at('request', '/requirements'));
  if (!request.requirements.length) fail('PRODUCT_REQUIRED', 'at least one requirement is necessary');
  request.requirements.forEach((r, i) => {
    const location = at('request', `/requirements/${i}`);
    object(r, ['id', 'version', 'payloadSchemaVersion', 'capabilities', 'inputRoles', 'requires'], location);
    text(r.id, location); text(r.version, location); text(r.payloadSchemaVersion, location);
  });
  unique(request.requirements.map(r => r.id), 'PRODUCT_DUPLICATE', at('request', '/requirements'));
  const consumed = new Set(assembled.consumed);
  for (const [i, r] of request.requirements.entries()) {
    const location = at('request', `/requirements/${i}`);
    object(r, ['id', 'version', 'payloadSchemaVersion', 'capabilities', 'inputRoles', 'requires'], location);
    text(r.id, location); text(r.version, location); text(r.payloadSchemaVersion, location);
    const profile = profileFor(r.id, r.version);
    if (!profile || r.version !== profile.version || r.payloadSchemaVersion !== profile.payloadSchemaVersion) fail('PRODUCT_UNSUPPORTED', 'unsupported product profile', location);
    if (!equal(r.capabilities, profile.capabilities)) fail('PRODUCT_CAPABILITY', 'exact capability declaration required', location);
    if (!equal(r.requires, profile.requires)) fail('PRODUCT_DEPENDENCY', 'exact product dependencies required', location);
    object(r.inputRoles, Object.keys(profile.roles), location);
    for (const [role, schema] of Object.entries(profile.roles)) {
      const id = r.inputRoles[role];
      if (!documents.some(d => d.id === id && d.schemaVersion === schema)) fail('PRODUCT_ROLE', 'role document missing or wrong schema', location);
      consumed.add(id);
    }
    for (const dep of r.requires) if (!request.requirements.some(other => other.id === dep.id && other.version === dep.version)) fail('PRODUCT_DEPENDENCY', 'missing required product', location);
  }
  if (documents.some(d => !consumed.has(d.id))) fail('PRODUCT_DOCUMENT_UNUSED', 'document is not used by a declared role or explicit assembly');
  return request;
}
