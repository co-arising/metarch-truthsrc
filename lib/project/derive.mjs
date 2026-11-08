import { copyImmutableData } from '../immutable-data.mjs';
import { canonicalType, declaration, orderedReferences } from '../domain-products/values.mjs';
import { compileReferences, owner, reference, typeRefs } from '../domain-products/references.mjs';
import { deriveDecisions } from '../domain-products/decision.mjs';
import { deriveDependencies } from '../domain-products/dependencies.mjs';
import { deriveFolds } from '../domain-products/folds.mjs';
import { deriveExternalEvents } from '../domain-products/external-events.mjs';
import { compileExactTypes } from '../value-products/exact-types.mjs';
import { compileExactCodecs } from '../value-products/exact-codecs.mjs';
import { deriveProductDesigns } from '../products/designs.mjs';
import { deriveModuleSeamsContract } from '../products/module-seams-contract.mjs';
import { COMPILATION, profileFor } from '../products/registry.mjs';
import { array, at, fail, identity, object, text, unique, validateRequest, rejectLegacyModuleSeams } from '../products/request.mjs';

// Derivation support, not a second product registry. All role schemas, capabilities
// and dependency/version requirements come from profileFor.
const DERIVED = new Map([
  ['module-seams-contract', ['module-seams-contract', 'contract', ['1']]],
  ['reference-layout', ['references', 'layout', ['1']]],
  ['exact-value-types', ['types', 'types', ['1']]],
  ['exact-value-codecs', ['codecs', 'codecs', ['1']]],
  ['domain-decision', ['decisions', 'decisions', ['1', '2', '3', '4']]],
  ['domain-dependencies', ['dependencies', 'dependencies', ['1', '2', '3', '4', '5', '6']]],
  ['domain-folds', ['folds', 'folds', ['1', '2', '3', '4', '5', '6']]],
  ['domain-external-events', ['external', 'externalEvents', ['1', '2']]],
  ['saga-host-contract', ['hosts', 'hosts', ['1', '2']]],
  ['artifact-contract', ['artifacts', 'artifacts', ['1', '2', '3']]],
  ['effect-host-contract', ['effects', 'effects', ['1', '2']]],
  ['product-design', ['designs', 'designs', ['1']]],
]);
const TECHNICAL_PRODUCTS = new Set(['saga-contract', 'saga-runtime-contract', 'execution-contract', 'child-plan-contract', 'module-seams-composition']);
const TECHNICAL_ROLES = new Set(['sagaBinding', 'runtimeBinding', 'executionBinding', 'childPlanBinding', 'moduleSeamsCompositionBinding']);
const CONFIG_INPUTS = ['canonicalId', 'context', 'products', 'exactTypes', 'exactCodecs', 'roles', 'assemblies'];
const CONFIG_IO = ['schemaVersion', 'tree', 'documents', 'generator', 'options'];
const record = (value, location) => object(value, Object.keys(value ?? {}), location);

function checkContext(value, context, location) {
  record(value, location);
  if (Object.hasOwn(value, 'context') && value.context !== context)
    fail('PROJECT_CONTEXT', 'canonical declaration conflicts with the explicit project context', location);
}

function checkDeclarationContexts(value, context, document) {
  for (const family of ['valueObjects', 'types', 'aggregates', 'ports', 'sagas', 'pipelines', 'artifactContracts', 'productDesigns']) {
    if (!Object.hasOwn(value, family)) continue;
    array(value[family], at(document, '/' + family)).forEach((row, i) => {
      const location = at(document, '/' + family + '/' + i);
      checkContext(row, context, location);
      if (['artifactContracts', 'productDesigns'].includes(family)) {
        reference(row.artifact, location);
        if (row.artifact.context !== context) fail('PROJECT_CONTEXT', 'artifact declaration crosses the explicit project context', location);
      }
    });
  }
}

function deriveLayout(canonical, context) {
  const value = canonical.value, declarations = [], layout = { contexts: [context], declarations };
  const source = pointer => at(canonical.id, pointer);
  const ref = (kind, id, owners = []) => ({ context, kind, owner: owners, id });
  const rows = family => Object.hasOwn(value, family) ? array(value[family], source('/' + family)) : [];
  const named = (row, pointer, key = 'name') => {
    checkContext(row, context, source(pointer));
    return text(row[key], source(pointer + '/' + key));
  };
  const add = (r, pointer, valueType = null) => {
    reference(r, source(pointer));
    if (r.context !== context) fail('PROJECT_CONTEXT', 'declaration crosses the project context', source(pointer));
    const parent = owner(r);
    const d = { ref: r, valueType, source: source(pointer),
      dependencies: orderedReferences([...(parent ? [parent] : []), ...(valueType === null ? [] : typeRefs(valueType, source(pointer)))]) };
    declarations.push(d);
    return d;
  };
  const spelling = (row, pointer) => {
    if (Object.hasOwn(row, 'type') && Object.hasOwn(row, 'dataType') && row.type !== row.dataType)
      fail('VALUE_TYPE', 'conflicting canonical type spellings', source(pointer));
    return row.dataType ?? row.type;
  };
  const typedFields = (fields, pointer, kind, owners) => array(fields, source(pointer)).map((field, i) => {
    const p = pointer + '/' + i, r = ref(kind, named(field, p), owners);
    return add(r, p, canonicalType(spelling(field, p), context, layout, source(p))).ref;
  });

  // Declare every nominal identity before resolving any spelling (including forward
  // references). No type is invented from an exact binding or a use site.
  const types = ['valueObjects', 'types'].flatMap(family => rows(family).map((row, i) => {
    const pointer = '/' + family + '/' + i;
    return { row, d: add(ref('type', named(row, pointer)), pointer) };
  }));
  types.forEach(({ row, d }) => {
    const pointer = d.source.pointer;
    if (Object.hasOwn(row, 'dataType') || Object.hasOwn(row, 'type')) {
      if (Object.hasOwn(row, 'fields') && array(row.fields, source(pointer + '/fields')).length)
        fail('PROJECT_TYPE', 'a canonical type cannot declare both scalar syntax and record members', d.source);
      d.valueType = canonicalType(spelling(row, pointer), context, layout, d.source);
    } else {
      const members = typedFields(row.fields, pointer + '/fields', 'member', [d.ref.id]);
      d.valueType = { form: 'record', members };
    }
    d.dependencies = orderedReferences(typeRefs(d.valueType, d.source));
  });
  rows('aggregates').forEach((aggregate, i) => {
    const pointer = '/aggregates/' + i, name = named(aggregate, pointer);
    add(ref('aggregate', name), pointer);
    typedFields(aggregate.stateFields, pointer + '/stateFields', 'state-field', [name]);
    for (const [family, kind, slots, slotKind] of [
      ['commands', 'command', 'parameters', 'parameter'], ['events', 'event', 'payloads', 'event-slot'],
    ]) array(aggregate[family], source(pointer + '/' + family)).forEach((row, j) => {
      const p = pointer + '/' + family + '/' + j, id = named(row, p);
      add(ref(kind, id, [name]), p);
      typedFields(row[slots], p + '/' + slots, slotKind, [name, id]);
    });
  });
  for (const [family, kind, key] of [['ports', 'port', 'name'], ['sagas', 'saga', 'id'], ['pipelines', 'pipeline', 'id']])
    rows(family).forEach((row, i) => add(ref(kind, named(row, '/' + family + '/' + i, key)), '/' + family + '/' + i));
  for (const family of ['artifactContracts', 'productDesigns']) rows(family).forEach((row, i) => {
    const pointer = '/' + family + '/' + i;
    checkContext(row, context, source(pointer));
    reference(row.artifact, source(pointer + '/artifact'));
    if (row.artifact.kind !== 'artifact') fail('PROJECT_REFERENCE', 'formal artifact identity must be an artifact reference', source(pointer));
    add(row.artifact, pointer);
  });
  return layout;
}

/**
 * Pure, detached in-memory request derivation. The caller captures/validates local
 * files and the complete project config; this function also accepts just its seven
 * CONFIG_INPUTS fields. No authored semantic snapshots or role overrides are used.
 * Throws ProductError on invalid input. The caller must still compileProductSet:
 * request admission is not semantic compilation or runtime certification.
 */
export function deriveProjectRequest(canonicalValue, config, technicalDocuments) {
  const input = copyImmutableData({ canonicalValue, config, technicalDocuments }, '',
    (pointer, message) => fail('PRODUCT_INPUT', message, at('project', pointer)));
  ({ canonicalValue, config, technicalDocuments } = input);
  record(config, at('project'));
  object(config, [...CONFIG_INPUTS, ...CONFIG_IO.filter(key => Object.hasOwn(config, key))], at('project'));
  if (Object.hasOwn(config, 'schemaVersion') && config.schemaVersion !== 'truthsrc.project/v1')
    fail('PROJECT_VERSION', 'unsupported project version', at('project', '/schemaVersion'));
  text(config.canonicalId, at('project', '/canonicalId'));
  text(config.context, at('project', '/context'));
  checkContext(canonicalValue, config.context, at(config.canonicalId));
  if (canonicalValue.schemaVersion !== 'truthsrc/v1') fail('PRODUCT_VERSION', 'unsupported canonical schema', at(config.canonicalId));
  if (Object.hasOwn(canonicalValue, 'contexts')) {
    const contexts = array(canonicalValue.contexts, at(config.canonicalId, '/contexts'));
    if (contexts.length !== 1 || contexts[0] !== config.context)
      fail('PROJECT_CONTEXT', 'only the explicit single project context is supported', at(config.canonicalId, '/contexts'));
  }
  checkDeclarationContexts(canonicalValue, config.context, config.canonicalId);
  const canonical = { id: config.canonicalId, schemaVersion: 'truthsrc/v1', value: canonicalValue };
  const selected = new Map(), technicalRoles = new Map();
  array(config.products, at('project', '/products')).forEach((product, i) => {
    const location = at('project', '/products/' + i);
    identity(product, location);
    const profile = profileFor(product.id, product.version), derived = DERIVED.get(product.id);
    if (!profile || !(derived ? derived[2].includes(product.version) : TECHNICAL_PRODUCTS.has(product.id) && product.version === '1'))
      fail('PROJECT_PRODUCT_UNSUPPORTED', 'unknown profile or unsupported project derivation', location);
    if (selected.has(product.id)) fail('PRODUCT_DUPLICATE', 'select exactly one version of each product', location);
    selected.set(product.id, profile);
    for (const [role, schema] of Object.entries(profile.roles)) {
      if (TECHNICAL_ROLES.has(role)) technicalRoles.set(role, schema);
      else if (role !== 'canonical' && (!derived || role !== profile.bindingRole))
        fail('PROJECT_PRODUCT_UNSUPPORTED', 'product role has no project derivation', location);
    }
  });
  if (!selected.size) fail('PRODUCT_REQUIRED', 'at least one product must be selected', at('project', '/products'));
  if (['domain-dependencies', 'domain-folds', 'domain-external-events'].some(id => selected.has(id)))
    array(canonicalValue.aggregates, at(canonical.id, '/aggregates')).forEach((row, i) => {
      if (row.context !== config.context) fail('PROJECT_CONTEXT', 'domain products require explicit aggregate context matching the project', at(canonical.id, '/aggregates/' + i));
    });
  for (const profile of selected.values()) for (const dependency of profile.requires)
    if (selected.get(dependency.id)?.version !== dependency.version)
      fail('PRODUCT_DEPENDENCY', `select the required product ${dependency.id}@${dependency.version} explicitly`, at('project', '/products'));
  object(config.roles, [...technicalRoles.keys()], at('project', '/roles'));
  for (const role of technicalRoles.keys()) text(config.roles[role], at('project', '/roles/' + role));
  array(config.assemblies, at('project', '/assemblies'));
  array(technicalDocuments, at('project', '/documents')).forEach((doc, i) => {
    const location = at('project', '/documents/' + i);
    object(doc, ['id', 'schemaVersion', 'value'], location);
    text(doc.id, location);
    if (![...technicalRoles.values()].includes(doc.schemaVersion))
      fail('PROJECT_TECHNICAL_DOCUMENT', 'only selected technical binding schemas may be captured documents', location);
  });
  for (const [field, product] of [['exactTypes', 'exact-value-types'], ['exactCodecs', 'exact-value-codecs']]) {
    const rows = array(config[field], at('project', '/' + field));
    if (rows.length && !selected.has(product)) fail('PROJECT_INPUT_UNUSED', `${field} requires its selected product`, at('project', '/' + field));
    rows.forEach((row, i) => {
      const location = at('project', '/' + field + '/' + i);
      record(row, location);
      if (Object.hasOwn(row, 'source')) fail('PROJECT_SOURCE', 'exact binding source is derived, never authored', location);
    });
  }

  const bindings = new Map();
  const bindingSchema = id => selected.get(id).roles[selected.get(id).bindingRole];
  const bind = (id, payload) => {
    const [document, key] = DERIVED.get(id), schemaVersion = bindingSchema(id);
    const binding = { id: document, schemaVersion, value: { schemaVersion, [key]: payload } };
    bindings.set(id, binding);
    return binding;
  };
  // Reserve identities before deriving payloads, including assembly outputs.
  const reserved = [canonical.id, ...[...DERIVED].filter(([id]) => selected.has(id)).map(([, [id]]) => id), ...technicalDocuments.map(d => d.id)];
  config.assemblies.forEach((specification, i) => {
    record(specification, at('project', '/assemblies/' + i));
    reserved.push(text(specification.id, at('project', '/assemblies/' + i)));
  });
  unique(reserved, 'PRODUCT_DUPLICATE', at('project', '/documents'));

  let layout, types = [], decisions, externalEvents, dependencies;
  if (selected.has('module-seams-contract')) {
    const contract = deriveModuleSeamsContract(canonical);
    if (contract.context !== config.context) fail('PROJECT_CONTEXT', 'module-seams contract conflicts with the explicit project context', at(canonical.id, '/moduleSeamsContracts/0/context'));
    bind('module-seams-contract', contract);
  }
  if (selected.has('reference-layout')) {
    rejectLegacyModuleSeams(canonicalValue, at(canonical.id));
    const binding = bind('reference-layout', deriveLayout(canonical, config.context));
    layout = compileReferences(binding, canonical, [canonical, binding]);
  }
  if (selected.has('exact-value-types')) {
    const rows = config.exactTypes.map((row, i) => {
      const location = at('project', '/exactTypes/' + i), d = declaration(row.domain, layout, location);
      if (row.domain.kind !== 'type' || d.source.document !== canonical.id || !/^\/(valueObjects|types)\/(0|[1-9][0-9]*)$/u.test(d.source.pointer))
        fail('EXACT_IDENTITY', 'exact domain must identify a complete canonical nominal type', location);
      return { ...row, source: d.source };
    });
    types = compileExactTypes(bind('exact-value-types', rows), canonical, layout);
  }
  if (selected.has('exact-value-codecs')) {
    const rows = config.exactCodecs.map((row, i) => ({ ...row, source: at('codecs', '/codecs/' + i) }));
    compileExactCodecs(bind('exact-value-codecs', rows), canonical, layout, types);
  }
  if (selected.has('domain-decision')) {
    const version = selected.get('domain-decision').version;
    decisions = deriveDecisions(canonical, layout, version === '1' ? null : { types }, version);
    bind('domain-decision', decisions);
  }
  if (selected.has('domain-external-events')) {
    externalEvents = deriveExternalEvents(canonical, layout, bindingSchema('domain-external-events'));
    bind('domain-external-events', externalEvents);
  }
  if (selected.has('domain-dependencies')) {
    const profile = selected.get('domain-dependencies');
    dependencies = deriveDependencies(canonical, layout, decisions, profile.version === '1' ? [] : types,
      profile.requires.some(r => r.id === 'domain-external-events') ? externalEvents : null, bindingSchema('domain-dependencies'));
    bind('domain-dependencies', dependencies);
  }
  if (selected.has('domain-folds'))
    bind('domain-folds', deriveFolds(canonical, layout, dependencies, types, bindingSchema('domain-folds')));
  // These formal compilers reconstruct and compare the complete canonical rows.
  // Do not lower/reinterpret them here, or accept a supplied semantic snapshot.
  for (const [id, family, key] of [
    ['saga-host-contract', 'sagaHosts', 'hosts'], ['artifact-contract', 'artifactContracts', 'artifacts'],
    ['effect-host-contract', 'effectHosts', 'hosts'],
  ]) if (selected.has(id)) {
    const rows = array(canonicalValue[family], at(canonical.id, '/' + family)).map((row, i) => {
      const source = at(canonical.id, '/' + family + '/' + i);
      checkContext(row, config.context, source);
      if (Object.hasOwn(row, 'source')) fail('PROJECT_SOURCE', 'formal product source is derived, never authored', source);
      return { ...row, source };
    });
    bind(id, { [key]: rows });
  }
  if (selected.has('product-design')) bind('product-design', deriveProductDesigns(canonical, layout));

  const requirements = [...selected].map(([id, profile]) => ({
    id, version: profile.version, payloadSchemaVersion: profile.payloadSchemaVersion,
    capabilities: profile.capabilities, requires: profile.requires,
    inputRoles: Object.fromEntries(Object.keys(profile.roles).map(role => [role,
      role === 'canonical' ? canonical.id : TECHNICAL_ROLES.has(role) ? config.roles[role] : bindings.get(id).id])),
  }));
  return validateRequest({ schemaVersion: COMPILATION,
    documents: [canonical, ...[...DERIVED.keys()].filter(id => bindings.has(id)).map(id => bindings.get(id)), ...technicalDocuments],
    assemblies: config.assemblies, requirements, options: {} });
}
