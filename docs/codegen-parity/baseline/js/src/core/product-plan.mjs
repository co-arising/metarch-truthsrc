import { copyImmutableData } from '../../lib/immutable-data.mjs';
import { compileProductSet } from '../../lib/products/compile.mjs';
import { at, detach, equal, fail, object, ProductError, text, unique } from '../../lib/products/request.mjs';
import { PRODUCT_SET, COMPILER, profileFor } from '../../lib/products/registry.mjs';
import { validateCodeMappings } from './code-mappings.mjs';

const VERSION = 'truthsrc.product-generator/v1';
const entryKeys = ['path', 'content', 'kind', 'deps', 'knowledgeIds', 'productFootprint', 'merge', 'codeMappings'];
function manifest(raw) {
  const value = detach(raw);
  object(value, ['schemaVersion', 'name', 'version', 'targetProfile', 'products', 'producers', 'artifactKinds', 'options'], at('manifest'));
  if (value.schemaVersion !== VERSION) fail('PRODUCT_MANIFEST', 'explicit product generator manifest required', at('manifest'));
  if (!/^[a-z][a-z0-9-]*$/u.test(value.name)) fail('PRODUCT_MANIFEST', 'generator name must be a slug', at('manifest'));
  text(value.version, at('manifest')); text(value.targetProfile, at('manifest'));
  for (const name of ['products', 'producers', 'artifactKinds', 'options']) if (!Array.isArray(value[name])) fail('PRODUCT_MANIFEST', 'manifest arrays must be explicit', at('manifest'));
  if (!value.products.length || !value.producers.length || !value.artifactKinds.length) fail('PRODUCT_MANIFEST', 'full products, producers and artifact kinds required', at('manifest'));
  unique(value.products.map(p => p.id), 'PRODUCT_MANIFEST', at('manifest'));
  unique(value.producers.map(p => p.id), 'PRODUCT_MANIFEST', at('manifest'));
  unique(value.artifactKinds, 'PRODUCT_MANIFEST', at('manifest')); unique(value.options, 'PRODUCT_MANIFEST', at('manifest'));
  for (const p of value.products) {
    object(p, ['id', 'version', 'payloadSchemaVersion', 'capabilities'], at('manifest'));
    const profile = profileFor(p.id, p.version);
    if (!profile || profile.payloadSchemaVersion !== p.payloadSchemaVersion || !equal(profile.capabilities, p.capabilities)) fail('PRODUCT_MANIFEST', 'manifest requires an exact registered product', at('manifest'));
  }
  for (const p of value.producers) {
    object(p, ['id', 'version', 'products', 'artifactKinds'], at('manifest'));
    text(p.id, at('manifest')); text(p.version, at('manifest'));
    if (!Array.isArray(p.products) || !Array.isArray(p.artifactKinds) || p.products.some(id => !value.products.some(p => p.id === id)) || p.artifactKinds.some(k => !value.artifactKinds.includes(k))) fail('PRODUCT_MANIFEST', 'producer input/output declaration is outside target manifest', at('manifest'));
    unique(p.products, 'PRODUCT_MANIFEST', at('manifest')); unique(p.artifactKinds, 'PRODUCT_MANIFEST', at('manifest'));
  }
  value.options.forEach(k => text(k, at('manifest'))); value.artifactKinds.forEach(k => text(k, at('manifest')));
  return value;
}
function path(value) {
  text(value, at('entries'));
  if (value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/u.test(value) || value.split('/').some(p => !p || ['.', '..'].includes(p))) fail('PRODUCT_PATH', 'source path must be relative and canonical', at('entries'));
  if (['truthsrc.ledger.json', 'anchors.json'].includes(value)) fail('PRODUCT_PATH', 'source path collides with an apply receipt', at('entries'));
  return value;
}
function validateEntries(raw, producer, products) {
  const entries = detach(raw);
  if (!Array.isArray(entries)) fail('PRODUCT_ENTRY', 'producer must return source entries', at('entries'));
  for (const entry of entries) {
    object(entry, entryKeys.filter(key => key !== 'codeMappings' || Object.hasOwn(entry, key)), at('entries'));
    path(entry.path); text(entry.content, at('entries'), true); text(entry.kind, at('entries'));
    if (!producer.artifactKinds.includes(entry.kind)) fail('PRODUCT_ENTRY', 'entry kind not declared by producer', at('entries'));
    for (const name of ['deps', 'knowledgeIds', 'productFootprint']) if (!Array.isArray(entry[name])) fail('PRODUCT_ENTRY', 'entry evidence/dependency arrays required', at('entries'));
    entry.deps.forEach(path); unique(entry.deps, 'PRODUCT_ENTRY', at('entries'));
    entry.knowledgeIds.forEach(id => text(id, at('entries'))); unique(entry.knowledgeIds, 'PRODUCT_ENTRY', at('entries'));
    try { validateCodeMappings(entry); }
    catch (error) { fail('PRODUCT_ENTRY_MAPPING', error.message, at('entries')); }
    if (!entry.knowledgeIds.length || entry.merge !== null) fail('PRODUCT_ENTRY', 'source ownership and explicit default MANUAL merge policy required', at('entries'));
    if (!equal(entry.productFootprint, producer.products.map(id => ({ id, version: products.find(p => p.id === id).version })))) fail('PRODUCT_ENTRY', 'entire declared product footprint required', at('entries'));
    if (/\?\?\?/u.test(entry.content)) fail('PRODUCT_ENTRY', 'declared source profile cannot contain unimplemented placeholders', at('entries'));
  }
  const keys = entries.map(e => e.path.normalize('NFC').toLowerCase()); unique(keys, 'PRODUCT_PATH_ALIAS', at('entries'));
  return entries;
}
function restricted(products, producer, options) {
  const selected = Object.fromEntries(producer.products.map(id => [id, products.find(p => p.id === id).payload]));
  const view = new Proxy(copyImmutableData(selected), {
    get(target, key) {
      if (typeof key === 'string' && !Object.hasOwn(target, key)) fail('PRODUCT_UNDECLARED', 'producer read undeclared product ' + key, at('producer'));
      return Reflect.get(target, key);
    },
  });
  return Object.freeze({ products: view, options: copyImmutableData(options) });
}

/** Trusted producer implementations are an explicit parameter, never JSON imports. */
export function planProductSet({ compilation, manifest: rawManifest, options = {} }, producerRegistry) {
  try {
    const m = manifest(rawManifest), c = detach(compilation), o = detach(options);
    object(o, m.options, at('options'));
    if (c?.diagnostics?.length || !c?.result || c.result.schemaVersion !== PRODUCT_SET || !equal(c.result.compiler, COMPILER)) fail('PRODUCT_PLAN_INPUT', 'complete successful compilation required');
    const output = c.result;
    const derived = new Set(output.assemblies.map(a => a.id));
    const replay = compileProductSet({ schemaVersion: 'truthsrc.product-compilation/v1', documents: output.documents.filter(d => !derived.has(d.id)),
      assemblies: output.assemblies.map(({ provenance, ...a }) => a), requirements: output.requirements, options: {} });
    if (!replay.result || !equal(replay.result, output)) fail('PRODUCT_PLAN_INPUT', 'whole compilation must equal a complete live recompile, not supplied flags');
    const products = output.products;
    for (const p of m.products) {
      const actual = products.find(a => a.id === p.id);
      if (!actual || actual.version !== p.version || actual.payloadSchemaVersion !== p.payloadSchemaVersion || !equal(actual.capabilities, p.capabilities)) fail('PRODUCT_PLAN_REQUIRED', 'target required product is missing or wrong version');
    }
    const entries = [];
    for (const producer of m.producers) {
      const implementation = producerRegistry?.[producer.id];
      if (!implementation || implementation.version !== producer.version || typeof implementation.produce !== 'function') fail('PRODUCT_PRODUCER', 'exact trusted producer implementation is required');
      const first = validateEntries(implementation.produce(restricted(products, producer, o)), producer, products);
      const second = validateEntries(implementation.produce(restricted(products, producer, o)), producer, products);
      if (!equal(first, second)) fail('PRODUCT_NONDETERMINISTIC', 'two independently detached source plans differ');
      entries.push(...first);
    }
    unique(entries.map(e => e.path.normalize('NFC').toLowerCase()), 'PRODUCT_PATH_ALIAS', at('entries'));
    const paths = new Set(entries.map(e => e.path));
    if (entries.some(e => e.deps.some(p => !paths.has(p)))) fail('PRODUCT_ENTRY_DEPENDENCY', 'all source entry dependencies must be generated in the same complete plan');
    return copyImmutableData({ plan: { schemaVersion: 'truthsrc.source-product-plan/v1', generator: { id: m.name, version: m.version },
      targetProfile: m.targetProfile, manifest: m, entries: [...entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) }, diagnostics: [] });
  } catch (error) {
    if (error instanceof ProductError) return copyImmutableData({ plan: null, diagnostics: [error.diagnostic] });
    if (error instanceof TypeError) return copyImmutableData({ plan: null, diagnostics: [{ code: 'PRODUCT_PRODUCER', message: 'producer violated the frozen source-plan boundary', source: at('producer'), related: [] }] });
    throw error;
  }
}
