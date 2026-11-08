import { targetData, resolveNameSet, resolveArtifactPath } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { array, at, equal, fail, object, pointer, text, unique } from '../../lib/products/request.mjs';
import { owner, reference, refKey } from '../../lib/domain-products/references.mjs';
import { presentWhen, references } from '../../lib/domain-products/expressions.mjs';
import { orderedReferences, valueReferences } from '../../lib/domain-products/values.mjs';
import { buildModels as buildKernelModels } from '../scala-cqrs-domain-kernel-v1/build-models.mjs';
import { serializationModel } from '../scala-cqrs-domain-kernel-v1/serialization-model.mjs';
import { expressionResolver } from './expression-model.mjs';

const location = at('target');
const reject = message => fail('AGGREGATE_MODEL', message, location);
const dedupe = values => [...new Set(values)];
const refsOf = refs => orderedReferences(refs);
const sourcesOf = sources => [...new Map(sources.map(s => [JSON.stringify(s), s])).values()];
const portable = name => name.normalize('NFC').toLowerCase();
const nameKey = (ref, role) => JSON.stringify([refKey(ref), role]);
const artifactsSpec = [
  ['rules', 'rules', 'rules', 'domain.invariant', [], ['Rules'], 'kernel'],
  ['helpers', 'command-helpers', 'command-helpers', 'domain.command', [], ['CommandHelpers'], 'kernel'],
  ['eventHandler', 'event-handler', 'event-handler', 'domain.entities.behaviors', [], ['EventHandler'], 'kernel'],
  ['actorProtocol', 'actor-protocol', 'actor-protocol', 'application.aggregates', [], ['ActorProtocol'], 'glue'],
  ['aggregate', 'aggregate', 'aggregate', 'application.aggregates', [], ['Aggregate'], 'glue'],
  ['factory', 'factory', 'aggregate-factory', 'application.factories', [], ['AggregateFactory'], 'glue'],
  ['bootstrap', 'bootstrap', 'aggregate-bootstrap', 'infrastructure.bootstrap', [], ['Bootstrap'], 'glue'],
  ['repository', 'actor-repository', 'actor-repository', 'application.aggregates', [], ['ActorRepository'], 'glue'],
  ['repositoryImplementation', 'local-actor-repository', 'actor-repository-implementation', 'infrastructure.repositories', ['Local'], ['ActorRepository'], 'glue'],
];
const newRoles = new Map([...artifactsSpec.map(([, role]) => [role, 'aggregate']), ['rule-method', 'command'], ['emit-method', 'command']]);
const objectMembers = ['getClass', 'notify', 'notifyAll', 'wait', 'equals', 'hashCode', 'toString', 'clone', 'finalize'];
const standardTypes = ['String', 'Boolean', 'Byte', 'Short', 'Int', 'Long', 'Float', 'Double', 'BigDecimal', 'BigInt', 'Array', 'Option', 'Some', 'None', 'Vector', 'Map', 'Set', 'Seq', 'List', 'Either', 'Left', 'Right', 'Unit', 'Any', 'AnyRef', 'AnyVal', 'Nothing', 'Null', 'Product', 'Serializable',
  'ActorRef', 'Behavior', 'Effect', 'EventSourcedBehavior', 'PersistenceId', 'EventAdapter', 'SnapshotAdapter'];
function source(s) { object(s, ['document', 'pointer'], location); text(s.document, location); pointer(s.pointer, location); return s; }
function ordinals(rows, s, suffix) {
  array(rows, location).forEach(row => {
    if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.sourceOrdinal) || row.sourceOrdinal < 0) reject('behavior row requires a nonnegative source ordinal');
  });
  const sorted = [...rows].sort((a, b) => a.sourceOrdinal - b.sourceOrdinal);
  sorted.forEach((row, i) => {
    if (row.sourceOrdinal !== i || !equal(source(row.source), { document: s.document, pointer: s.pointer + suffix + i })) reject('source ordinals/pointers must cover the exact ordered source');
  });
  return sorted;
}
function sameRefs(actual, expected, message) {
  array(actual, location).forEach(r => reference(r, location));
  if (!equal(actual, refsOf(expected))) reject(message);
}

/** Compose one unchanged family1 model with resolved pure behavior and Actor metadata. */
export function buildModels(raw) {
  const input = targetData(raw); object(input, ['products', 'options'], location);
  object(input.options, ['packages', 'names', 'protobuf'], location);
  const { products, options } = input, baseNames = [], overrides = new Map(), used = new Set();
  for (const binding of array(options.names, location)) {
    object(binding, ['ref', 'role', 'name'], location); reference(binding.ref, location); text(binding.name, location);
    if (!newRoles.has(binding.role)) { baseNames.push(binding); continue; }
    if (binding.ref.kind !== newRoles.get(binding.role)) reject('new name role does not match declaration kind');
    const id = nameKey(binding.ref, binding.role);
    if (overrides.has(id)) reject('duplicate new name binding');
    overrides.set(id, binding);
  }
  // Original family1 name whitelist/unused checks are unchanged. Never build it
  // twice, synthesize renamed base models or mutate its fields/FQNs.
  const kernel = buildKernelModels({ products, options: { ...options, names: baseNames } });
  const serialization = serializationModel(kernel);
  const layout = products['reference-layout'], dependency = products['domain-dependencies'];
  const declarations = new Map(layout.declarations.map(d => [refKey(d.ref), d]));
  function find(ref) {
    reference(ref, location); const d = declarations.get(refKey(ref));
    if (!d) reject('missing new-model declaration'); return d;
  }
  for (const binding of overrides.values()) find(binding.ref);
  if (!equal(products['domain-external-events'].producers, dependency.externalProducers)) reject('external producer product mismatch');
  if (dependency.externalProducers.length) reject('no-external aggregate-core rejects all external producers');

  const specs = [], reserved = [], reservedKeys = new Set();
  function reserve(scope, space, names) {
    for (const name of names) {
      const id = JSON.stringify([scope, space, space === 'scala-type' ? portable(name) : name]);
      if (!reservedKeys.has(id)) { reserved.push({ scope, space, name, reason: 'name collides with an emitted, inherited or shadowed declaration' }); reservedKeys.add(id); }
    }
  }
  const packageRoots = dedupe(['scala', 'java', 'akka', ...kernel.contexts.flatMap(c => [c.package.split('.')[0], c.protobuf.package.split('.')[0]])]);
  for (const a of kernel.artifacts.filter(a => a.name)) reserve(a.package, 'scala-type', [a.name]);
  for (const n of serialization.nodes) reserve(n.fqn.slice(0, n.fqn.lastIndexOf('.')), 'scala-type', [n.name]);
  for (const c of kernel.contexts) {
    const stem = c.protoPath.split('/').at(-1).replace(/\.proto$/, '');
    const descriptor = stem.split('_').map(s => s[0].toUpperCase() + s.slice(1)).join('') + 'Proto';
    reserve(c.protobuf.package, 'scala-type', [descriptor]);
  }
  function name(ref, role, scope, prefix = [], suffix = [], method = false) {
    const binding = overrides.get(nameKey(ref, role)); if (binding) used.add(nameKey(ref, role));
    reserve(scope, method ? 'scala-member' : 'scala-type', method ? [...objectMembers, ...packageRoots] : standardTypes);
    if (role === 'actor-protocol') reserve(scope, 'scala-type', ['Command', 'Reply', 'Execute', 'GetState', 'Accepted', 'Rejected']);
    if (role === 'actor-repository') reserve(scope, 'scala-type', ['Handle']);
    if (role === 'local-actor-repository') reserve(scope, 'scala-type', ['IllegalStateException', 'IllegalArgumentException']);
    const index = specs.length;
    specs.push({ knowledgeId: nameKey(ref, role), scope, space: method ? 'scala-member' : 'scala-type', spelling: ref.id,
      binding: binding?.name ?? null, prefix: binding ? [] : prefix, suffix: binding ? [] : suffix });
    return index;
  }
  const headers = kernel.aggregates.map(base => {
    const pkg = kernel.contexts.find(c => c.context === base.ref.context).package, scope = refKey(base.ref);
    reserve(scope + ':rules', 'scala-member', ['decide', 'state', 'command', 'hosts', 'value']);
    const tokens = Object.fromEntries(artifactsSpec.map(([key, role, , subpackage, prefix, suffix]) => [key, name(base.ref, role, pkg + '.' + subpackage, prefix, suffix)]));
    const methods = base.protocol.commands.map(c => ({ ref: c.ref,
      rule: name(c.ref, 'rule-method', scope + ':rules', [], [], true),
      emit: name(c.ref, 'emit-method', scope + ':helpers', ['emit'], [], true) }));
    return { base, pkg, tokens, methods };
  });
  const resolved = resolveNameSet({ profile: MODULAR_CANDIDATE, names: specs, reserved });
  if (used.size !== overrides.size) reject('unused new name binding');
  const names = token => ({ name: resolved[token].name, identifier: resolved[token].identifier });
  const artifacts = [...kernel.artifacts], expressions = expressionResolver(kernel, products);
  function artifact(ref, role, kind, module, pkg, token, s) {
    const n = names(token), metadata = { ref, role, kind, module, ...n, package: pkg, fqn: pkg + '.' + n.identifier,
      path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module, packageName: pkg, typeName: n.name }), sources: [s], refs: [ref], directDeps: [] };
    artifacts.push(metadata); return metadata;
  }
  function rowsByRef(rows, key, kind) {
    const map = new Map();
    for (const row of array(rows, location)) {
      if (!row || typeof row !== 'object') reject('behavior row must be an object');
      const d = find(row[key]);
      if (d.ref.kind !== kind || map.has(refKey(d.ref))) reject('duplicate/wrong-kind behavior row');
      if (!equal(source(row.source), d.source)) reject('behavior row source differs from declaration');
      map.set(refKey(d.ref), row);
    }
    if (!equal([...map.keys()].sort(), layout.declarations.filter(d => d.ref.kind === kind).map(d => refKey(d.ref)).sort())) reject('behavior rows do not cover all declarations');
    return map;
  }
  const decisions = rowsByRef(products['domain-decision'].commands, 'command', 'command');
  const commands = rowsByRef(dependency.commands, 'command', 'command');
  const folds = rowsByRef(products['domain-folds'].events, 'event', 'event');
  const produced = new Set();
  const aggregates = headers.map(({ base, pkg, tokens, methods }) => {
    const a = { ref: base.ref, source: base.source, base };
    for (const [key, role, kind, subpackage, , , module] of artifactsSpec) a[key] = artifact(base.ref, role, kind, module, pkg + '.' + subpackage, tokens[key], base.source);
    a.commands = base.protocol.commands.map((c, ci) => {
      const row = commands.get(refKey(c.ref)), decision = decisions.get(refKey(c.ref));
      object(decision, ['command', 'source', 'decisions'], location);
      let known = new Set();
      const guards = ordinals(decision.decisions, c.source, '/guards/').map(d => {
        object(d, ['sourceOrdinal', 'ruleId', 'source', 'predicate', 'onFalse', 'dependencies'], location); text(d.ruleId, d.source);
        if (d.onFalse?.kind === 'reject') { object(d.onFalse, ['kind', 'errCode'], d.source); text(d.onFalse.errCode, d.source); }
        else if (d.onFalse?.kind === 'succeed-empty') object(d.onFalse, ['kind'], d.source);
        else reject('guard failure must be explicit reject or succeed-empty');
        const predicate = expressions.predicate(d.predicate, c.ref, d.source, known);
        sameRefs(d.dependencies, references(d.predicate), 'guard dependencies must equal predicate references');
        known = new Set([...known, ...presentWhen(d.predicate, true)]);
        return { ...d, predicate };
      });
      array(row.events, location).forEach(e => { object(e, ['event', 'source', 'slots'], location); reference(e.event, location); });
      unique(row.events.map(e => refKey(e.event)), 'AGGREGATE_EMISSION', location);
      const emissions = row.events.map(emission => {
        object(emission, ['event', 'source', 'slots'], location);
        const event = base.protocol.events.find(e => equal(e.ref, emission.event));
        if (!event) reject('emitted event must be declared in the same aggregate');
        source(emission.source); produced.add(refKey(event.ref));
        const slots = array(emission.slots, location);
        if (!equal(slots.map(s => s.slot), event.fields.map(f => f.ref))) reject('emission slots must cover declared fields in actual order');
        return { event: event.ref, base: event, source: emission.source, slots: slots.map((s, index) => {
          object(s, ['slot', 'valueType', 'source', 'producer', 'dependencies'], location); source(s.source);
          const f = event.fields[index], producer = expressions.value(s.producer, c.ref, s.source);
          if (!equal(expressions.resolveType(s.valueType), f.type) || !equal(producer.type, f.type)) reject('emission slot producer must exactly match its field type');
          sameRefs(s.dependencies, valueReferences(s.producer), 'slot dependencies must equal producer references');
          return { slot: s.slot, field: f, source: s.source, producer, dependencies: s.dependencies };
        }) };
      });
      const rawDeps = [...guards.flatMap(d => d.dependencies), ...emissions.flatMap(e => e.slots.flatMap(s => s.dependencies))];
      for (const r of [...rawDeps]) if (r.kind === 'port') {
        const h = dependency.hosts.find(h => equal(h.id, r)); if (!h) reject('host dependency missing'); rawDeps.push(...h.inputDependencies);
      }
      sameRefs(row.usedDependencies, rawDeps, 'command used dependencies must be the exact ordered closure');
      function method(role, container, token) {
        const n = names(token); return { ref: c.ref, role, ...n, fqn: container.fqn + '.' + n.identifier, path: container.path, source: c.source };
      }
      return { ref: c.ref, source: c.source, base: c, params: base.ruleParams.params[ci],
        ruleMethod: method('rule-method', a.rules, methods[ci].rule), emitMethod: method('emit-method', a.helpers, methods[ci].emit), guards, emissions,
        sources: sourcesOf([c.source, ...guards.map(g => g.source), ...emissions.flatMap(e => [e.source, ...e.slots.map(s => s.source)])]),
        directDeps: dedupe([base.protocol.path, base.state.path, base.computations.path, base.ruleParams.path, ...guards.flatMap(g => g.predicate.directDeps), ...emissions.flatMap(e => e.slots.flatMap(s => s.producer.directDeps))]) };
    });
    a.events = base.protocol.events.map(e => {
      const row = folds.get(refKey(e.ref)); object(row, ['event', 'source', 'assignments'], location);
      const targets = new Set();
      const assignments = ordinals(row.assignments, e.source, '/foldAssignments/').map(assignment => {
        object(assignment, ['target', 'valueType', 'sourceOrdinal', 'source', 'update', 'dependencies'], location);
        const f = expressions.field(assignment.target);
        if (f.ref.kind !== 'state-field' || !equal(owner(f.ref), base.ref) || !equal(f.type, expressions.resolveType(assignment.valueType))) reject('fold target/type must match this aggregate state');
        if (targets.has(refKey(f.ref))) reject('duplicate fold target'); targets.add(refKey(f.ref));
        const u = assignment.update, keys = { set: ['value'], put: ['key', 'value'], remove: ['key'], 'put-all': ['key', 'value'], 'remove-all': ['key'], 'money-apply': ['delta', 'sign'], 'integer-apply': ['delta', 'sign'] };
        if (!Object.hasOwn(keys, u?.op)) reject('unknown fold operator'); object(u, ['op', ...keys[u.op]], location);
        const update = { op: u.op }, dependencyRefs = u.op === 'set' ? [] : [assignment.target];
        function value(key, expected) {
          const v = expressions.value(u[key], e.ref, assignment.source);
          if (!equal(v.type, expected)) reject('fold operand must exactly match its target type');
          update[key] = v; dependencyRefs.push(...valueReferences(u[key]));
        }
        if (u.op === 'set') value('value', f.type);
        else if (['integer-apply', 'money-apply'].includes(u.op)) {
          if (![1, -1].includes(u.sign)) reject('fold arithmetic sign must be exactly 1 or -1');
          if (u.op === 'integer-apply') {
            if (!equal(f.type, { form: 'primitive', name: 'integer' })) reject('integer-apply requires signed-64 target'); update.mode = 'checked-long';
          } else {
            const descriptor = products['exact-value-types'].find(t => f.type.form === 'nominal' && equal(t.domain, f.type.ref));
            update.exact = expressions.exact(descriptor); update.mode = 'exact';
          }
          value('delta', f.type); update.sign = u.sign;
        } else {
          if (f.type.form !== 'map') reject('collection fold requires map target');
          value('key', u.op.endsWith('-all') ? { form: 'sequence', element: f.type.key } : f.type.key);
          if (['put', 'put-all'].includes(u.op)) value('value', f.type.value);
        }
        sameRefs(assignment.dependencies, dependencyRefs, 'fold dependencies must equal the exact ordered operand closure');
        return { ...assignment, field: f, valueType: f.type, update };
      });
      return { ref: e.ref, source: e.source, base: e, assignments,
        sources: sourcesOf([e.source, ...assignments.map(a => a.source)]),
        directDeps: dedupe([base.protocol.path, base.state.path, ...assignments.flatMap(a => Object.values(a.update).filter(v => v?.op).flatMap(v => v.directDeps))]) };
    });
    const setDeps = (artifact, dependencies, rows = []) => {
      artifact.directDeps = dedupe([...dependencies.map(d => typeof d === 'string' ? d : d.path), ...rows.flatMap(r => r.directDeps ?? [])]).filter(p => p !== artifact.path);
      artifact.sources = sourcesOf([base.source, ...rows.flatMap(r => r.sources ?? [])]);
      artifact.refs = refsOf([base.ref, ...rows.flatMap(r => r.ref ? [r.ref] : [])]);
    };
    setDeps(a.helpers, [base.protocol, base.state, base.computations], a.commands.map(c => ({ ref: c.ref, sources: [c.source, ...c.emissions.flatMap(e => [e.source, ...e.slots.map(s => s.source)])], directDeps: c.emissions.flatMap(e => e.slots.flatMap(s => s.producer.directDeps)) })));
    setDeps(a.rules, [base.protocol, base.state, base.computations, base.ruleParams, a.helpers], a.commands);
    setDeps(a.eventHandler, [base.protocol, base.state], a.events);
    setDeps(a.actorProtocol, [base.protocol, base.state]);
    setDeps(a.aggregate, [base.protocol, base.state, base.computations, a.actorProtocol, a.rules, a.eventHandler], a.commands.map(c => ({ ref: c.ref, sources: [c.source] })));
    setDeps(a.factory, [base.protocol, base.state, base.computations, a.actorProtocol]);
    setDeps(a.bootstrap, [a.factory, a.aggregate, a.eventHandler, a.actorProtocol, base.protocol, base.state, base.computations]);
    setDeps(a.repository, [a.actorProtocol]);
    setDeps(a.repositoryImplementation, [a.repository, a.actorProtocol]);
    return a;
  });
  if (kernel.aggregates.some(a => a.protocol.events.some(e => !produced.has(refKey(e.ref))))) reject('every declared event must have a local command producer');
  const paths = new Set();
  for (const artifact of artifacts) {
    const key = portable(artifact.path); if (paths.has(key)) reject('new/base portable artifact path collision'); paths.add(key);
  }
  const actualPaths = new Set(artifacts.map(a => a.path));
  for (const artifact of artifacts) for (const dep of artifact.directDeps) {
    if (!actualPaths.has(dep) || dep === artifact.path) reject('artifact direct dependency is not an actual output');
    if (artifact.module === 'kernel' && artifacts.find(a => a.path === dep).module !== 'kernel') reject('kernel dependency cannot point into glue');
  }
  return targetData({ profile: 'scala-cqrs-aggregate-core@1', kernel, serialization, aggregates, artifacts });
}
