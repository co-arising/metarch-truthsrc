import { targetData, resolveNameSet, resolveArtifactPath } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { array, at, equal, fail, object, pointer, text, unique } from '../../lib/products/request.mjs';
import { owner, reference, refKey, typeRefs } from '../../lib/domain-products/references.mjs';
import { validateValue } from '../../lib/domain-products/values.mjs';
import { checkExactBounds, checkExactShape } from '../../lib/value-products/exact-types.mjs';
import { buildStateModels } from '../scala-cqrs-domain/build-state-models.mjs';

const location = at('target');
const productIds = ['reference-layout', 'exact-value-types', 'exact-value-codecs', 'domain-decision', 'domain-dependencies', 'domain-folds', 'domain-external-events'];
const roles = {
  value: ['type'], member: ['member', 'parameter', 'event-slot'], protocol: ['aggregate'], command: ['command'], event: ['event'],
  state: ['aggregate'], 'state-field': ['state-field'], computations: ['aggregate'], 'host-method': ['port'], 'rule-params': ['aggregate'], params: ['command']
};
const caseMembers = ['copy', 'productArity', 'productElement', 'productElementName', 'productElementNames', 'productIterator', 'productPrefix', 'canEqual', 'equals', 'hashCode', 'toString', 'getClass', 'notify', 'notifyAll', 'wait', 'clone', 'finalize', 'companion'];
const objectMembers = ['getClass', 'notify', 'notifyAll', 'wait', 'equals', 'hashCode', 'toString', 'clone', 'finalize'];
const standardTypes = ['String', 'Boolean', 'Byte', 'Short', 'Int', 'Long', 'Float', 'Double', 'BigDecimal', 'BigInt',
  'Array', 'Option', 'Some', 'None', 'Vector', 'Map', 'Set', 'Seq', 'List', 'Either', 'Left', 'Right', 'Unit', 'Any', 'AnyRef', 'AnyVal', 'Nothing', 'Null', 'Product', 'Serializable'];
const dedupe = values => [...new Set(values)];
const sourcesOf = values => [...new Map(values.map(s => [JSON.stringify(s), s])).values()];
const refsOf = values => [...new Map(values.map(r => [refKey(r), r])).values()];
const portable = value => value.normalize('NFC').toLowerCase();
const key = (ref, role) => JSON.stringify([refKey(ref), role]);
const reject = message => fail('KERNEL_MODEL', message, location);
function source(value) { object(value, ['document', 'pointer'], location); text(value.document, location); pointer(value.pointer, location); return value; }
function namedType(value) {
  return { form: 'nominal', role: value.role, ref: value.ref, name: value.name, identifier: value.identifier, fqn: value.fqn, path: value.path };
}
function typePaths(type) {
  if (type.form === 'nominal') return [type.path];
  if (type.form === 'record') return type.fields.flatMap(f => typePaths(f.type));
  if (['optional', 'sequence'].includes(type.form)) return typePaths(type.element);
  if (type.form === 'map') return [...typePaths(type.key), ...typePaths(type.value)];
  return [];
}
function typeReferences(type) {
  if (type.form === 'nominal') return [type.ref];
  if (type.form === 'record') return type.fields.flatMap(f => [...(f.ref ? [f.ref] : []), ...typeReferences(f.type)]);
  if (['optional', 'sequence'].includes(type.form)) return typeReferences(type.element);
  if (type.form === 'map') return [...typeReferences(type.key), ...typeReferences(type.value)];
  return [];
}

/** Lower only already-admitted product payloads; never read author files or render target syntax. */
export function buildModels(raw) {
  const input = targetData(raw);
  object(input, ['products', 'options'], location);
  const { products, options } = input;
  object(products, productIds, location); object(options, ['packages', 'names', 'protobuf'], location);
  const layout = products['reference-layout'];
  object(layout, ['contexts', 'declarations'], location);
  array(layout.contexts, location).forEach(c => text(c, location));
  unique(layout.contexts, 'KERNEL_CONTEXT', location);
  if (!layout.contexts.length) reject('at least one semantic context is required');
  const declarations = new Map();
  for (const d of array(layout.declarations, location)) {
    object(d, ['ref', 'valueType', 'source', 'dependencies'], location); reference(d.ref, location); source(d.source);
    for (const id of [d.ref.context, d.ref.id, ...d.ref.owner])
      if (!id.isWellFormed() || /[\x00-\x1f\x7f]/u.test(id)) reject('reference identity must be well-formed text without controls');
    if (!layout.contexts.includes(d.ref.context)) reject('declaration context is missing');
    if (declarations.has(refKey(d.ref))) reject('duplicate declaration');
    array(d.dependencies, location).forEach(r => reference(r, location));
    declarations.set(refKey(d.ref), d);
  }
  const find = ref => { reference(ref, location); const d = declarations.get(refKey(ref)); if (!d) reject('missing declaration closure'); return d; };
  const visiting = new Set(), visited = new Set();
  function checkDeclaration(d) {
    const id = refKey(d.ref);
    if (visited.has(id)) return;
    if (visiting.has(id)) reject('recursive nominal type closure is unsupported');
    visiting.add(id);
    const typed = ['type', 'member', 'state-field', 'parameter', 'event-slot'].includes(d.ref.kind);
    if (typed !== (d.valueType !== null)) reject('declaration type presence mismatch');
    const parent = owner(d.ref); if (parent) find(parent);
    if (d.ref.kind === 'member' && !find(parent).valueType?.members?.some(r => equal(r, d.ref))) reject('member must belong to its owner record');
    const refs = typed ? typeRefs(d.valueType, d.source) : [];
    for (const r of refs) {
      if (d.valueType.form === 'record') {
        if (d.ref.kind !== 'type' || r.kind !== 'member' || r.context !== d.ref.context || !equal(r.owner, [d.ref.id])) reject('record member owner mismatch');
      } else if (r.kind !== 'type') reject('nominal type must reference a value definition');
      checkDeclaration(find(r));
    }
    const expected = dedupe([...(parent ? [refKey(parent)] : []), ...refs.map(refKey)]).sort();
    if (!equal(d.dependencies.map(refKey).sort(), expected)) reject('declaration dependency closure mismatch');
    visiting.delete(id); visited.add(id);
  }
  layout.declarations.forEach(checkDeclaration);

  const packageRows = array(options.packages, location);
  packageRows.forEach(p => { object(p, ['context', 'package'], location); text(p.context, location); });
  unique(packageRows.map(p => p.context), 'KERNEL_PACKAGE', location);
  if (!equal(packageRows.map(p => p.context).sort(), [...layout.contexts].sort())) reject('one explicit package per semantic context required');
  const packageNames = resolveNameSet({ profile: MODULAR_CANDIDATE, names: packageRows.map(p => ({
    knowledgeId: p.context, scope: 'contexts', space: 'scala-package', spelling: p.context, binding: p.package, prefix: [], suffix: []
  })), reserved: [] });
  const packages = new Map(packageRows.map((p, i) => [p.context, packageNames[i].name]));
  const overrides = new Map(), usedOverrides = new Set();
  for (const binding of array(options.names, location)) {
    object(binding, ['ref', 'role', 'name'], location); find(binding.ref); text(binding.name, location);
    if (!Object.hasOwn(roles, binding.role) || !roles[binding.role].includes(binding.ref.kind)) reject('name binding role does not match declaration kind');
    const id = key(binding.ref, binding.role);
    if (overrides.has(id)) reject('duplicate name override');
    overrides.set(id, binding.name);
  }
  const nameSpecs = [], reserved = [], reservations = new Set();
  function reserve(scope, space, names) {
    for (const name of names) {
      const id = JSON.stringify([scope, space, portable(name)]);
      if (!reservations.has(id)) { reserved.push({ scope, space, name, reason: 'name collides with an emitted or inherited member' }); reservations.add(id); }
    }
  }
  function name(ref, role, scope, { suffix = [], prefix = [], member = false, local = false, exact = false } = {}) {
    const id = key(ref, role), binding = overrides.get(id) ?? null;
    if (binding !== null) usedOverrides.add(id);
    if (!member && role !== 'params') reserve(scope, 'scala-type', standardTypes.filter(value => !['command', 'event'].includes(role) || value !== 'Set'));
    if (member && !local) reserve(scope, 'scala-member', role === 'host-method' ? objectMembers : [...caseMembers, ...(exact ? ['checkedAmount', 'isPositive', 'compareSameUnit', 'plus', 'minus', 'require'] : [])]);
    const token = { index: nameSpecs.length };
    nameSpecs.push({ knowledgeId: id, scope, space: member ? 'scala-member' : 'scala-type', spelling: ref.id, binding,
      prefix: binding === null ? prefix : [], suffix: binding === null ? suffix : [] });
    return token;
  }
  const valueHeaders = new Map(), aggregateHeaders = new Map(), fieldNames = new Map(), methodNames = new Map();
  const exacts = array(products['exact-value-types'], location), codecRows = array(products['exact-value-codecs'], location);
  const exactById = new Map();
  for (const exact of exacts) {
    object(exact, ['domain', 'version', 'source', 'form', 'precision', 'scale', 'amountMember', 'unitMember', 'units'], location);
    const d = find(exact.domain); text(exact.version, location); checkExactBounds(exact); checkExactShape(exact);
    if (d.ref.kind !== 'type' || !equal(exact.source, d.source) || exactById.has(refKey(d.ref))) reject('exact descriptor identity mismatch');
    if (exact.form === 'decimal') {
      if (!equal(d.valueType, { form: 'primitive', name: 'decimal' })) reject('exact scalar shape mismatch');
    } else {
      if (!equal(d.valueType, { form: 'record', members: [exact.amountMember, exact.unitMember] })) reject('exact record shape mismatch');
      for (const [r, primitive] of [[exact.amountMember, 'decimal'], [exact.unitMember, 'string']]) {
        if (!equal(find(r).valueType, { form: 'primitive', name: primitive })) reject('exact member shape mismatch');
      }
    }
    unique(exact.units, 'KERNEL_EXACT', location); exact.units.forEach(u => text(u, location));
    exactById.set(refKey(d.ref), exact);
  }
  for (const d of layout.declarations.filter(d => d.ref.kind === 'type'))
    valueHeaders.set(refKey(d.ref), { declaration: d, token: name(d.ref, 'value', packages.get(d.ref.context) + '.domain.values') });
  for (const d of layout.declarations.filter(d => d.ref.kind === 'aggregate')) {
    const pkg = packages.get(d.ref.context), scope = refKey(d.ref);
    const header = { declaration: d,
      protocol: name(d.ref, 'protocol', pkg + '.domain', { suffix: ['Protocol'] }),
      state: name(d.ref, 'state', pkg + '.domain', { suffix: ['State'] }),
      computations: name(d.ref, 'computations', pkg + '.domain.ports', { suffix: ['Computations'] }),
      ruleParams: name(d.ref, 'rule-params', pkg + '.domain.invariant.params', { suffix: ['RuleParams'] }),
      commands: new Map(), events: new Map(), params: new Map() };
    reserve(scope + ':protocol', 'scala-type', ['Command', 'Event']);
    for (const child of layout.declarations.filter(c => c.ref.context === d.ref.context && c.ref.owner[0] === d.ref.id)) {
      if (['command', 'event'].includes(child.ref.kind)) {
        header[child.ref.kind + 's'].set(refKey(child.ref), name(child.ref, child.ref.kind, scope + ':protocol'));
        if (child.ref.kind === 'command') header.params.set(refKey(child.ref), name(child.ref, 'params', scope + ':params', { suffix: ['Params'] }));
      }
    }
    aggregateHeaders.set(scope, header);
  }
  for (const d of layout.declarations.filter(d => ['member', 'parameter', 'event-slot', 'state-field'].includes(d.ref.kind))) {
    const p = owner(d.ref), role = d.ref.kind === 'state-field' ? 'state-field' : 'member';
    fieldNames.set(refKey(d.ref), name(d.ref, role, refKey(p) + ':fields', { member: true, exact: exactById.has(refKey(p)) }));
  }
  const dependency = products['domain-dependencies'];
  object(dependency, ['commands', 'events', 'hosts', 'externalProducers'], location);
  for (const k of ['commands', 'events', 'hosts', 'externalProducers']) array(dependency[k], location);
  unique(dependency.hosts.map(h => refKey(h.id)), 'KERNEL_HOST', location);
  for (const [i, host] of dependency.hosts.entries()) {
    object(host, ['id', 'version', 'command', 'outputType', 'inputDependencies', 'stableIdentityContract', 'source'], location);
    if (find(host.id).ref.kind !== 'port' || find(host.command).ref.kind !== 'command' || host.id.context !== host.command.context) reject('host identity/command mismatch');
    text(host.version, location); source(host.source);
    object(host.stableIdentityContract, ['id', 'version', 'keys'], location);
    text(host.stableIdentityContract.id, location); text(host.stableIdentityContract.version, location);
    const keys = array(host.stableIdentityContract.keys, location); keys.forEach(find);
    unique(keys.map(refKey), 'KERNEL_HOST', location);
    if (!keys.length || keys.some(r => !host.inputDependencies.some(input => equal(input, r)))) reject('host stable identity keys must be explicit input dependencies');
    const aggregate = owner(host.command);
    const method = { token: name(host.id, 'host-method', refKey(aggregate) + ':methods', { member: true }), parameters: [] };
    unique(array(host.inputDependencies, location).map(refKey), 'KERNEL_HOST', location);
    for (const r of host.inputDependencies) {
      find(r);
      if (r.context !== host.command.context || !(r.kind === 'state-field' && equal(r.owner, host.command.owner) || r.kind === 'parameter' && equal(r.owner, [...host.command.owner, host.command.id]))) reject('host parameter scope mismatch');
      method.parameters.push(name(r, r.kind === 'state-field' ? 'state-field' : 'member', 'host-input:' + i, { member: true, local: true }));
    }
    methodNames.set(i, method);
  }
  const resolved = resolveNameSet({ profile: MODULAR_CANDIDATE, names: nameSpecs, reserved });
  if (usedOverrides.size !== overrides.size) reject('unused name override');
  const names = token => { const n = resolved[token.index]; return { name: n.name, identifier: n.identifier }; };
  const artifacts = [];
  function artifact(ref, role, kind, pkg, token, module = 'kernel') {
    const n = typeof token === 'string' ? { name: token, identifier: token } : names(token);
    const value = { role, kind, module, ref, ...n, package: pkg, fqn: pkg + '.' + n.identifier,
      path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module, packageName: pkg, typeName: n.name }),
      refs: ref ? [ref] : [], sources: [], directDeps: [], deps: [] };
    artifacts.push(value); return value;
  }
  const values = [...valueHeaders.values()].map(({ declaration: d, token }) => artifact(d.ref, 'value', 'value-object', packages.get(d.ref.context) + '.domain.values', token));
  const valueById = new Map(values.map(v => [refKey(v.ref), v]));
  function resolveType(type, decimal = false) {
    typeRefs(type, location);
    if (type.form === 'primitive') { if (type.name === 'decimal' && !decimal) reject('decimal requires an admitted exact nominal definition'); return { form: 'primitive', name: type.name }; }
    if (type.form === 'nominal') { const v = valueById.get(refKey(type.ref)); if (!v) reject('nominal value definition missing'); return namedType(v); }
    if (['optional', 'sequence'].includes(type.form)) return { form: type.form, element: resolveType(type.element) };
    if (type.form === 'map') return { form: 'map', key: resolveType(type.key), value: resolveType(type.value) };
    reject('record types are only legal in named value definitions');
  }
  function field(d, token = fieldNames.get(refKey(d.ref)), decimal = false) {
    const n = names(token);
    return { ref: d.ref, ...n, accessor: n.identifier, type: resolveType(d.valueType, decimal), source: d.source, sources: [d.source] };
  }
  const synthetic = (name, type, s) => ({ ref: null, name, identifier: name, accessor: name, type, source: s, sources: [s] });
  function finishFields(value, fields, initialSources) {
    value.fields = fields;
    value.refs = refsOf([...value.refs, ...fields.flatMap(f => [...(f.ref ? [f.ref] : []), ...typeReferences(f.type)])]);
    value.sources = sourcesOf([...initialSources, ...fields.flatMap(f => f.sources)]);
    value.directDeps = dedupe(fields.flatMap(f => typePaths(f.type)));
  }
  for (const v of values) {
    const d = find(v.ref); v.exact = exactById.get(refKey(v.ref)) ?? null;
    const fields = d.valueType.form === 'record' ? d.valueType.members.map(r => field(find(r), undefined, v.exact?.form === 'unit-decimal' && equal(r, v.exact.amountMember)))
      : [synthetic('value', resolveType(d.valueType, v.exact?.form === 'decimal'), d.source)];
    v.type = d.valueType.form === 'record' ? { form: 'record', fields } : fields[0].type;
    finishFields(v, fields, [d.source]);
  }
  // Reuse only State's semantic selection. Legacy package/paths/dependencies/literal spellings are discarded.
  object(products['domain-folds'], ['defaults', 'events'], location);
  array(products['domain-folds'].events, location);
  const defaults = array(products['domain-folds'].defaults, location);
  unique(defaults.map(d => refKey(d.target)), 'KERNEL_DEFAULT', location);
  const stateDeclarations = layout.declarations.filter(d => d.ref.kind === 'state-field');
  if (!equal(defaults.map(d => refKey(d.target)).sort(), stateDeclarations.map(d => refKey(d.ref)).sort())) reject('each state field requires exactly one explicit default');
  for (const d of defaults) {
    object(d, ['target', 'valueType', 'source', 'value'], location); const declaration = find(d.target); source(d.source);
    if (!equal(d.valueType, declaration.valueType) || !equal(d.source, { document: declaration.source.document, pointer: declaration.source.pointer + '/default' })) reject('state default type/source mismatch');
    validateValue(d.value, d.valueType, layout, exacts, d.source);
  }
  const stateSemantics = buildStateModels({ products: {
    'reference-layout': layout, 'domain-folds': { defaults }, 'exact-value-types': exacts
  }, options: { packages: packageRows } }, false);
  function rowsByRef(rows, property, kind) {
    const result = new Map();
    for (const row of rows) { const d = find(row[property]); if (d.ref.kind !== kind || result.has(refKey(d.ref))) reject('duplicate or wrong-kind signature'); result.set(refKey(d.ref), row); }
    const expected = layout.declarations.filter(d => d.ref.kind === kind).map(d => refKey(d.ref)).sort();
    if (!equal([...result.keys()].sort(), expected)) reject('signature declarations do not cover layout');
    return result;
  }
  const commandRows = rowsByRef(dependency.commands, 'command', 'command'), eventRows = rowsByRef(dependency.events, 'event', 'event');
  object(products['domain-decision'], ['commands'], location);
  rowsByRef(array(products['domain-decision'].commands, location), 'command', 'command');
  object(products['domain-external-events'], ['producers'], location);
  if (!equal(array(products['domain-external-events'].producers, location), dependency.externalProducers)) reject('external producer product mismatch');
  function signature(row, kind) {
    object(row, kind === 'command' ? ['command', 'source', 'declaredSignature', 'usedDependencies', 'events'] : ['event', 'source', 'declaredSlots'], location);
    const ref = row[kind], d = find(ref); if (!equal(row.source, d.source)) reject('signature source mismatch');
    const fields = array(kind === 'command' ? row.declaredSignature : row.declaredSlots, location);
    const expected = layout.declarations.filter(c => equal(owner(c.ref), ref));
    if (!equal(fields.map(f => refKey(f.ref)).sort(), expected.map(f => refKey(f.ref)).sort())) reject('signature coverage mismatch');
    return fields.map(f => {
      object(f, kind === 'command' ? ['ref', 'valueType', 'origin', 'source'] : ['ref', 'valueType', 'source'], location);
      const d = find(f.ref); if (!equal(f.valueType, d.valueType) || !equal(f.source, d.source)) reject('signature field type/source mismatch');
      if (kind === 'command' && !['BUSINESS_INPUT', 'PROPAGATED'].includes(f.origin)) reject('unsupported parameter origin');
      return { ...field(d), ...(kind === 'command' ? { origin: f.origin } : {}) };
    });
  }
  const aggregates = [...aggregateHeaders.values()].map(h => {
    const d = h.declaration, pkg = packages.get(d.ref.context);
    const protocol = artifact(d.ref, 'protocol', 'domain-protocol', pkg + '.domain', h.protocol);
    const state = artifact(d.ref, 'state', 'domain-state', pkg + '.domain', h.state);
    const computations = artifact(d.ref, 'computations', 'domain-computations-port', pkg + '.domain.ports', h.computations);
    const ruleParams = artifact(d.ref, 'rule-params', 'rule-parameters', pkg + '.domain.invariant.params', h.ruleParams);
    function nested(ref, role, token, container, fields) {
      const n = names(token), s = find(ref).source;
      return { ref, role, ...n, fqn: container.fqn + '.' + n.identifier, path: container.path, fields, source: s, sources: sourcesOf([s, ...fields.flatMap(f => f.sources)]) };
    }
    protocol.commands = [...h.commands].map(([id, token]) => nested(commandRows.get(id).command, 'command', token, protocol, signature(commandRows.get(id), 'command')));
    protocol.events = [...h.events].map(([id, token]) => nested(eventRows.get(id).event, 'event', token, protocol, signature(eventRows.get(id), 'event')));
    const children = [...protocol.commands, ...protocol.events];
    protocol.sources = sourcesOf([d.source, ...children.flatMap(c => c.sources)]);
    protocol.refs = refsOf([d.ref, ...children.flatMap(c => [c.ref, ...c.fields.flatMap(f => [f.ref, ...typeReferences(f.type)])])]);
    protocol.directDeps = dedupe(children.flatMap(c => c.fields.flatMap(f => typePaths(f.type))));
    const semantic = stateSemantics.find(s => equal(s.aggregate.ref, d.ref));
    const byDefault = new Map(semantic.fields.map(f => [refKey(f.target), f]));
    finishFields(state, stateDeclarations.filter(f => equal(owner(f.ref), d.ref)).map(declaration => {
      const f = byDefault.get(refKey(declaration.ref));
      return { ...field(declaration), default: f.value, defaultSource: f.source, sources: sourcesOf([declaration.source, f.source]) };
    }), [d.source]);
    computations.methods = dependency.hosts.flatMap((host, i) => {
      if (!equal(owner(host.command), d.ref)) return [];
      const m = methodNames.get(i), n = names(m.token), parameters = host.inputDependencies.map((r, j) => field(find(r), m.parameters[j]));
      return [{ ref: host.id, command: host.command, version: host.version, stableIdentityContract: host.stableIdentityContract,
        ...n, fqn: computations.fqn + '.' + n.identifier, path: computations.path, parameters, outputType: resolveType(host.outputType),
        source: host.source, sources: sourcesOf([host.source, ...parameters.flatMap(p => p.sources)]) }];
    });
    computations.sources = sourcesOf([d.source, ...computations.methods.flatMap(m => m.sources)]);
    computations.refs = refsOf([d.ref, ...computations.methods.flatMap(m => [m.ref, m.command, ...typeReferences(m.outputType), ...m.parameters.flatMap(p => [p.ref, ...typeReferences(p.type)])])]);
    computations.directDeps = dedupe(computations.methods.flatMap(m => [...typePaths(m.outputType), ...m.parameters.flatMap(p => typePaths(p.type))]));
    ruleParams.params = protocol.commands.map(c => nested(c.ref, 'params', h.params.get(refKey(c.ref)), ruleParams,
      [synthetic('state', namedType(state), c.source), synthetic('command', namedType(c), c.source), synthetic('hosts', namedType(computations), c.source)]));
    ruleParams.refs = refsOf([d.ref, ...protocol.commands.map(c => c.ref)]);
    ruleParams.sources = sourcesOf([d.source, ...ruleParams.params.flatMap(p => p.sources)]);
    ruleParams.directDeps = ruleParams.params.length ? [state.path, protocol.path, computations.path] : [];
    return { ref: d.ref, source: d.source, protocol, state, computations, ruleParams };
  });
  unique(codecRows.map(c => c.id), 'KERNEL_CODEC', location);
  if (!equal(codecRows.map(c => refKey(c.domain)).sort(), exacts.map(t => refKey(t.domain)).sort())) reject('exact codec coverage mismatch');
  const representations = new Set(exacts.map(t => refKey(t.domain)));
  const codecArtifacts = new Map();
  for (const context of layout.contexts.filter(c => codecRows.some(r => r.domain.context === c)))
    codecArtifacts.set(context, artifact(null, 'exact-codecs', 'exact-value-codec', packages.get(context) + '.infrastructure.serialization', 'ExactValueCodecs', 'glue'));
  const codecs = codecRows.map(c => {
    object(c, ['domain', 'domainVersion', 'id', 'version', 'format', 'wire', 'po', 'source'], location);
    text(c.id, location); text(c.version, location); source(c.source);
    const domain = valueById.get(refKey(c.domain)), exact = exactById.get(refKey(c.domain));
    if (!exact || c.domainVersion !== exact.version || !['fixed-decimal-text', 'minor-units-text'].includes(c.format)) reject('exact codec pin/format mismatch');
    for (const r of [c.wire, c.po]) {
      object(r, ['ref', 'version', 'amountMember', 'unitMember'], location); text(r.version, location); const d = find(r.ref);
      if (d.ref.kind !== 'type' || representations.has(refKey(r.ref))) reject('wire/PO representation must be distinct nominal definitions');
      representations.add(refKey(r.ref));
      if (exact.form === 'decimal') {
        if (!equal(d.valueType, { form: 'primitive', name: 'string' }) || r.amountMember !== null || r.unitMember !== null) reject('scalar codec requires text representations');
      } else {
        if (!equal(d.valueType, { form: 'record', members: [r.amountMember, r.unitMember] })) reject('unit codec record mismatch');
        for (const member of [r.amountMember, r.unitMember]) if (!equal(find(member).valueType, { form: 'primitive', name: 'string' })) reject('unit codec members must be text');
      }
    }
    const wire = valueById.get(refKey(c.wire.ref)), po = valueById.get(refKey(c.po.ref));
    const pkg = packages.get(c.domain.context) + '.infrastructure.serialization', name = domain.name + 'Codec';
    const codecArtifact = codecArtifacts.get(c.domain.context);
    return { role: 'exact-codec', kind: 'exact-value-codec', module: 'glue', ref: c.domain, name, identifier: name, package: pkg,
      fqn: codecArtifact.fqn + '.' + name, path: codecArtifact.path, descriptor: c, exact, domain: namedType(domain), wire: namedType(wire), po: namedType(po),
      refs: refsOf([...domain.refs, ...wire.refs, ...po.refs]), sources: sourcesOf([...domain.sources, ...wire.sources, ...po.sources]),
      directDeps: [domain.path, wire.path, po.path], deps: [] };
  });
  for (const [context, a] of codecArtifacts) {
    a.codecs = codecs.filter(c => c.ref.context === context);
    a.refs = refsOf(a.codecs.flatMap(c => c.refs)); a.sources = sourcesOf(a.codecs.flatMap(c => c.sources));
    a.directDeps = dedupe(a.codecs.flatMap(c => c.directDeps));
  }
  const protobuf = array(options.protobuf, location);
  protobuf.forEach(p => { object(p, ['context', 'package', 'messages'], location); text(p.context, location); });
  if (!equal(protobuf.map(p => p.context).sort(), [...layout.contexts].sort())) reject('one explicit protobuf binding per context required');
  resolveNameSet({ profile: MODULAR_CANDIDATE, names: protobuf.map(p => ({ knowledgeId: p.context, scope: 'protobuf-contexts', space: 'scala-package', spelling: p.context,
    binding: p.package, prefix: [], suffix: [] })), reserved: [] });
  const contexts = layout.contexts.map(context => {
    const pkg = packages.get(context), pb = protobuf.find(p => p.context === context);
    if ([...packages.values()].some(base => pb.package === base + '.domain' || pb.package.startsWith(base + '.domain.')))
      reject('protobuf package cannot occupy a kernel domain namespace');
    const expected = [...values.filter(v => v.ref.context === context).map(v => key(v.ref, 'value')),
      ...aggregates.filter(a => a.ref.context === context).flatMap(a => [key(a.ref, 'state'), ...a.protocol.events.map(e => key(e.ref, 'event'))])].sort();
    const actual = array(pb.messages, location).map(m => {
      object(m, ['ref', 'role', 'name'], location); find(m.ref); text(m.name, location);
      if (m.ref.context !== context || !['value', 'state', 'event'].includes(m.role)) reject('protobuf binding context/role mismatch');
      return key(m.ref, m.role);
    }).sort();
    if (!equal(actual, expected)) reject('each value/state/event requires exactly one explicit protobuf root binding');
    if (!/^[a-z][a-z0-9-]*$/.test(context)) reject('this finite protobuf source layout requires a portable context id');
    const protoPath = 'modules/glue/src/main/protobuf/' + context + '_domain.proto';
    const owned = [...values.filter(v => v.ref.context === context), ...aggregates.filter(a => a.ref.context === context).flatMap(a => [a.protocol, a.state])];
    const proto = { role: 'protobuf', kind: 'proto', module: 'glue', ref: null, name: null, identifier: null, package: pb.package, fqn: null,
      path: protoPath, refs: refsOf(owned.flatMap(v => v.refs)), sources: sourcesOf(owned.flatMap(v => v.sources)), directDeps: [], deps: [] };
    artifacts.push(proto);
    const converter = artifact(null, 'converter', 'protobuf-converter', pkg + '.infrastructure.serialization', 'DomainConverters', 'glue');
    converter.refs = proto.refs; converter.sources = proto.sources;
    converter.directDeps = [protoPath, ...owned.map(v => v.path), ...(codecArtifacts.has(context) ? [codecArtifacts.get(context).path] : [])];
    return { context, package: pkg, protobuf: pb, protoPath, converter };
  });
  for (const context of contexts) {
    const symbols = artifacts.filter(a => a.package === context.protobuf.package && a.name !== null).map(a => portable(a.name));
    if (context.protobuf.messages.some(m => symbols.includes(portable(m.name)))) reject('protobuf class shadows another emitted glue declaration');
  }
  const paths = new Map();
  for (const a of artifacts) {
    const normalized = portable(a.path); if (paths.has(normalized)) reject('portable artifact path collision'); paths.set(normalized, a);
    a.directDeps = dedupe(a.directDeps);
  }
  const complete = new Set(), pending = new Set();
  function closure(a) {
    if (complete.has(a.path)) return a.deps;
    if (pending.has(a.path)) reject('artifact dependency cycle'); pending.add(a.path);
    a.deps = dedupe(a.directDeps.flatMap(path => { const dep = paths.get(portable(path)); if (!dep || dep.path !== path) reject('missing actual output dependency'); return [path, ...closure(dep)]; }));
    pending.delete(a.path); complete.add(a.path); return a.deps;
  }
  artifacts.forEach(closure);
  function nestedDependencies(child, fields, additional = []) {
    child.directDeps = dedupe([...fields.flatMap(f => typePaths(f.type)), ...additional]);
    child.deps = dedupe(child.directDeps.flatMap(path => [path, ...paths.get(portable(path)).deps]));
    child.refs = refsOf([child.ref, ...fields.flatMap(f => [...(f.ref ? [f.ref] : []), ...typeReferences(f.type)])]);
  }
  for (const a of aggregates) {
    for (const c of [...a.protocol.commands, ...a.protocol.events, ...a.ruleParams.params]) nestedDependencies(c, c.fields);
    for (const m of a.computations.methods) {
      nestedDependencies(m, m.parameters, typePaths(m.outputType));
      m.refs = refsOf([...m.refs, m.command, ...typeReferences(m.outputType)]);
    }
  }
  for (const c of codecs) c.deps = paths.get(portable(c.path)).deps;
  return targetData({ profile: MODULAR_CANDIDATE, contexts, values, aggregates, codecs, artifacts });
}
