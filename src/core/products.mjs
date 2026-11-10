// Explicit versioned product admission. No producer or runtime dispatch.
import { compileSagaProduct } from '../../lib/saga/product.mjs';
import {
  ENVELOPE_VERSION, registry, object, compare, copy, diagnostics, closed, capabilities,
  identity, declaration, dataFailure,
} from './product-declarations.mjs';
export { REQUIREMENTS_VERSION, ENVELOPE_VERSION, validateDeclaredProducts } from './product-declarations.mjs';

function canonicalShape(value, report) {
  if (!object(value)) {
    report('PRODUCT_CANONICAL_SHAPE', 'canonical', '', 'Expected a complete canonical object.');
    return;
  }
  if (value.schemaVersion !== 'truthsrc/v1') report('PRODUCT_CANONICAL_VERSION', 'canonical', '/schemaVersion', 'Expected exact truthsrc/v1.');
  if (typeof value.workshop !== 'string') report('PRODUCT_CANONICAL_SHAPE', 'canonical', '/workshop', 'Expected an explicit workshop string.');
  for (const key of ['sessions', 'aggregates', 'valueObjects', 'readModels', 'stories', 'domainServices']) {
    if (!Array.isArray(value[key])) report('PRODUCT_CANONICAL_SHAPE', 'canonical', `/${key}`, 'Expected an explicit canonical array.');
  }
  for (const key of ['pipelines', 'scenarios', 'sagas']) if (Object.hasOwn(value, key) && !Array.isArray(value[key])) report('PRODUCT_CANONICAL_SHAPE', 'canonical', `/${key}`, 'Expected a canonical collection array.');
  for (const key of ['useCases', 'inboxLayout', 'noteSurface', 'noteResidence']) if (Object.hasOwn(value, key) && !object(value[key])) report('PRODUCT_CANONICAL_SHAPE', 'canonical', `/${key}`, 'Expected a canonical object surface.');
}

export function admitProducts(input) {
  const result = diagnostics();
  const finish = context => Object.freeze({ context: result.rows.length ? null : context ?? null, diagnostics: result.finish() });
  let request;
  try { request = copy(input, 'request', true); }
  catch (error) { return dataFailure(error, result, () => finish(null)); }
  if (!closed(request, ['manifest', 'canonical', 'bindings', 'products', 'options'], 'request', '', result.report)) return finish(null);
  const { manifest, canonical, bindings, products, options } = request;
  const requirements = declaration(manifest, result.report);
  const sagaDeclared = !result.rows.length && requirements?.products.some(entry => entry.id === 'saga-contract');
  if (object(manifest) && !Object.hasOwn(manifest, 'declaredProducts')) result.report('PRODUCT_DECLARATION_REQUIRED', 'manifest', '/declaredProducts', 'Memory admission requires an explicit versioned declaration.');
  canonicalShape(canonical, result.report);
  if (!Array.isArray(bindings)) result.report('PRODUCT_BINDINGS_SHAPE', 'bindings', '', 'Expected an explicit bindings array.');
  else if (sagaDeclared) {
    if (bindings.length !== 1) result.report('PRODUCT_BINDINGS_COUNT', 'bindings', '', 'Saga admission requires exactly one complete explicit binding document.');
  } else if (bindings.length) result.report('PRODUCT_BINDINGS_UNSUPPORTED', 'bindings', '', 'Typed binding admission is not supported; supply an explicit empty array.');
  if (!object(options)) result.report('PRODUCT_OPTIONS_SHAPE', 'request', '/options', 'Expected an explicit plain JSON options object.');
  if (!Array.isArray(products)) {
    result.report('PRODUCT_SUPPLY_SHAPE', 'products', '', 'Expected an explicit supplied products array.');
    return finish(null);
  }
  const required = new Map((requirements?.products ?? []).filter(entry => object(entry) && typeof entry.id === 'string').map(entry => [entry.id, entry]));
  const seen = new Set();
  products.forEach((entry, i) => {
    const pointer = `/${i}`;
    if (!closed(entry, ['schemaVersion', 'id', 'version', 'payloadSchemaVersion', 'capabilities', 'source', 'payload'], 'products', pointer, result.report)) return;
    if (entry.schemaVersion !== ENVELOPE_VERSION) result.report('PRODUCT_ENVELOPE_VERSION', 'products', `${pointer}/schemaVersion`, `Expected ${ENVELOPE_VERSION}.`);
    identity(entry, 'products', pointer, result.report);
    if (seen.has(entry.id)) result.report('PRODUCT_DUPLICATE', 'products', `${pointer}/id`, 'Duplicate supplied product id.');
    seen.add(entry.id);
    if (!required.has(entry.id)) result.report('PRODUCT_UNDECLARED', 'products', `${pointer}/id`, 'Supplied product was not declared.');
    const expected = required.get(entry.id);
    if (expected && (entry.version !== expected.version || entry.payloadSchemaVersion !== expected.payloadSchemaVersion)) result.report('PRODUCT_REQUIREMENT_MISMATCH', 'products', pointer, 'Supplied identity versions differ from the requirement.');
    capabilities(entry.capabilities, 'products', `${pointer}/capabilities`, result.report, entry.id);
    if (closed(entry.source, ['document', 'pointer'], 'products', `${pointer}/source`, result.report)
      && (entry.source.document !== 'canonical' || entry.source.pointer !== '')) result.report('PRODUCT_SOURCE_MISMATCH', 'products', `${pointer}/source`, 'Expected the explicit canonical document root.');
    if (entry.id !== 'saga-contract' && (!Object.hasOwn(entry, 'payload') || JSON.stringify(entry.payload) !== JSON.stringify(canonical))) result.report('PRODUCT_PAYLOAD_MISMATCH', 'products', `${pointer}/payload`, 'Payload must exactly match the ordered explicit canonical value.');
  });
  for (const id of required.keys()) if (!seen.has(id)) result.report('PRODUCT_MISSING', 'products', '', `Required product ${id} is absent.`);
  if (result.rows.length) return finish(null);
  const payloads = new Map([['canonical', canonical]]);
  if (sagaDeclared) {
    if (bindings[0]?.schemaVersion === 'truthsrc.saga-binding/v2') {
      result.report('PRODUCT_BINDINGS_VERSION', 'bindings', '/0/schemaVersion', 'Declared saga-contract@1 requires exact truthsrc.saga-binding/v1.');
      return finish(null);
    }
    const compiled = compileSagaProduct(canonical, bindings[0]);
    result.rows.push(...compiled.diagnostics);
    if (result.rows.length) return finish(null);
    const index = products.findIndex(entry => entry.id === 'saga-contract');
    if (JSON.stringify(products[index].payload) !== JSON.stringify(compiled.ir)) {
      result.report('PRODUCT_PAYLOAD_MISMATCH', 'products', `/${index}/payload`, 'Payload must exactly match the entire ordered live Saga compiler result, including digest and sourceMap.');
      return finish(null);
    }
    try { payloads.set('saga-contract', copy(compiled.ir, 'products')); }
    catch (error) { return dataFailure(error, result, () => finish(null)); }
  }
  const admitted = Object.create(null);
  for (const id of [...required.keys()].sort(compare)) {
    const contract = registry[id];
    const envelope = Object.freeze({ schemaVersion: ENVELOPE_VERSION, id, ...contract,
      source: Object.freeze({ document: 'canonical', pointer: '' }), payload: payloads.get(id) });
    Object.defineProperty(admitted, `${id}@${contract.version}`, { value: envelope, enumerable: true });
  }
  return finish(Object.freeze({ manifest, canonical, bindings, options, products: Object.freeze(admitted) }));
}
