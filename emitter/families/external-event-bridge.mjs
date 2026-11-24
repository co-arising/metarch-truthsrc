// Byte-exact emitter for the external-event-bridge family (#46).
// Provenance: handwritten-golden (ruling §22, 2026-11-24). Distinct from
// #13 external-connector-port and #25 connector-implementation (subprocess
// tool-gate connectors): emits the domain external-event bridge object
// (`<Aggregate>ExternalEvents.scala`) mapping external producer outputs to
// domain protocol events and stable identity vectors.
// No golden bytes are embedded: every package, aggregate, producer id, event,
// output type, slot member, identity key, and unwrap depth flows from the
// fail-closed input contract (`truthsrc.external-event-bridge-input/v1`).

const fail = message => {
  const error = new Error('EEB_INPUT: ' + message);
  error.code = 'EEB_INPUT';
  throw error;
};

const KEYWORDS = new Set([
  'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false',
  'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy',
  'match', 'new', 'null', 'object', 'override', 'package', 'private',
  'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try',
  'true', 'type', 'val', 'var', 'while', 'with', 'yield',
]);

const PRIMITIVES = new Map([
  ['string', 'String'],
  ['integer', 'Long'],
  ['boolean', 'Boolean'],
  ['money', 'BigDecimal'],
  ['decimal', 'BigDecimal'],
  ['timestamp', 'String'],
]);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const CONTEXT = /^[a-z][a-z0-9-]*$/;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const PRODUCER_ID = /^[a-z0-9]+([_-][a-z0-9]+)*$/;

const symbol = name => (KEYWORDS.has(name) ? '`' + name + '`' : name);

const requireObject = (value, what) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(what + ' must be an object');
  return value;
};

const requireNonEmptyString = (value, what, pattern = null) => {
  if (typeof value !== 'string' || value.length === 0)
    fail(what + ' must be a nonempty string');
  if (pattern && !pattern.test(value))
    fail(what + ' has invalid format: ' + JSON.stringify(value));
  return value;
};

const requireSource = (source, what) => {
  requireObject(source, what);
  requireNonEmptyString(source.document, what + '.document');
  requireNonEmptyString(source.pointer, what + '.pointer');
};

function checkType(type, packageMap, what) {
  requireObject(type, what);
  if (type.form === 'primitive') {
    if (!PRIMITIVES.has(type.name)) fail(what + '.name unsupported primitive: ' + JSON.stringify(type.name));
    return;
  }
  if (type.form === 'nominal') {
    requireNonEmptyString(type.context, what + '.context', CONTEXT);
    if (!packageMap.has(type.context)) fail(what + '.context missing from packages: ' + type.context);
    requireNonEmptyString(type.name, what + '.name', PASCAL);
    return;
  }
  if (type.form === 'optional' || type.form === 'sequence') {
    checkType(type.element, packageMap, what + '.element');
    return;
  }
  if (type.form === 'map') {
    checkType(type.key, packageMap, what + '.key');
    checkType(type.value, packageMap, what + '.value');
    return;
  }
  fail(what + '.form unsupported: ' + JSON.stringify(type.form));
}

function renderType(type, packageMap, ownContext) {
  if (type.form === 'primitive') return PRIMITIVES.get(type.name);
  if (type.form === 'nominal') {
    if (ownContext && type.context === ownContext) return symbol(type.name);
    return packageMap.get(type.context) + '.domain.values.' + symbol(type.name);
  }
  if (type.form === 'optional') return 'Option[' + renderType(type.element, packageMap, ownContext) + ']';
  if (type.form === 'sequence') return 'Vector[' + renderType(type.element, packageMap, ownContext) + ']';
  if (type.form === 'map') return 'Map[' + renderType(type.key, packageMap, ownContext) + ', ' + renderType(type.value, packageMap, ownContext) + ']';
  fail('unsupported type form: ' + JSON.stringify(type.form));
}

function usesOwnValues(type, ownContext) {
  if (type.form === 'nominal') return type.context === ownContext;
  if (type.form === 'optional' || type.form === 'sequence') return usesOwnValues(type.element, ownContext);
  if (type.form === 'map') return usesOwnValues(type.key, ownContext) || usesOwnValues(type.value, ownContext);
  return false;
}

const toCamel = id => {
  const pascal = id.split(/[-_]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return pascal[0].toLowerCase() + pascal.slice(1);
};

function valueDeps(type, packageMap) {
  if (type.form === 'nominal') {
    return ['app/' + packageMap.get(type.context).replaceAll('.', '/') + '/domain/values/' + type.name + '.scala'];
  }
  if (type.form === 'optional' || type.form === 'sequence') return valueDeps(type.element, packageMap);
  if (type.form === 'map') return [...valueDeps(type.key, packageMap), ...valueDeps(type.value, packageMap)];
  return [];
}

export function checkInput(input) {
  requireObject(input, 'input');
  if (input.schemaVersion !== 'truthsrc.external-event-bridge-input/v1')
    fail('unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.packages) || input.packages.length === 0)
    fail('packages must be a nonempty array');

  const packageMap = new Map();
  for (let i = 0; i < input.packages.length; i++) {
    const entry = requireObject(input.packages[i], `packages[${i}]`);
    const ctx = requireNonEmptyString(entry.context, `packages[${i}].context`, CONTEXT);
    const pkg = requireNonEmptyString(entry.package, `packages[${i}].package`, PACKAGE);
    if (packageMap.has(ctx)) fail('duplicate package binding for context: ' + ctx);
    packageMap.set(ctx, pkg);
  }

  if (!Array.isArray(input.bridges) || input.bridges.length === 0)
    fail('bridges must be a nonempty array');

  const seenBridges = new Set();
  for (let i = 0; i < input.bridges.length; i++) {
    const bridge = requireObject(input.bridges[i], `bridges[${i}]`);
    const ctx = requireNonEmptyString(bridge.context, `bridges[${i}].context`, CONTEXT);
    if (!packageMap.has(ctx)) fail(`bridges[${i}].context missing from packages: ` + ctx);
    const agg = requireNonEmptyString(bridge.aggregate, `bridges[${i}].aggregate`, PASCAL);
    const bridgeKey = ctx + ':' + agg;
    if (seenBridges.has(bridgeKey)) fail('duplicate bridge for aggregate: ' + bridgeKey);
    seenBridges.add(bridgeKey);

    if (!Array.isArray(bridge.producers) || bridge.producers.length === 0)
      fail(`bridges[${i}].producers must be a nonempty array`);

    const seenMethods = new Set();
    for (let j = 0; j < bridge.producers.length; j++) {
      const p = requireObject(bridge.producers[j], `bridges[${i}].producers[${j}]`);
      const id = requireNonEmptyString(p.id, `bridges[${i}].producers[${j}].id`, PRODUCER_ID);
      const methodName = id.replaceAll('-', '_');
      if (!IDENT.test(methodName)) fail(`bridges[${i}].producers[${j}].id produces invalid Scala identifier: ` + methodName);
      if (seenMethods.has(methodName)) fail(`bridges[${i}].producers[${j}].id duplicates method name: ` + methodName);
      seenMethods.add(methodName);

      requireNonEmptyString(p.event, `bridges[${i}].producers[${j}].event`, PASCAL);
      checkType(p.outputType, packageMap, `bridges[${i}].producers[${j}].outputType`);

      if (!Array.isArray(p.slotMembers))
        fail(`bridges[${i}].producers[${j}].slotMembers must be an array`);
      for (let k = 0; k < p.slotMembers.length; k++) {
        requireNonEmptyString(p.slotMembers[k], `bridges[${i}].producers[${j}].slotMembers[${k}]`, IDENT);
      }

      if (!Array.isArray(p.identityKeys) || p.identityKeys.length === 0)
        fail(`bridges[${i}].producers[${j}].identityKeys must be a nonempty array`);
      for (let k = 0; k < p.identityKeys.length; k++) {
        const keySpec = requireObject(p.identityKeys[k], `bridges[${i}].producers[${j}].identityKeys[${k}]`);
        requireNonEmptyString(keySpec.member, `bridges[${i}].producers[${j}].identityKeys[${k}].member`, IDENT);
        if (!Number.isInteger(keySpec.unwrapDepth) || keySpec.unwrapDepth < 0)
          fail(`bridges[${i}].producers[${j}].identityKeys[${k}].unwrapDepth must be a non-negative integer`);
      }

      requireSource(p.source, `bridges[${i}].producers[${j}].source`);
    }
  }
}

export function renderExternalEventBridgeFiles(input) {
  checkInput(input);
  const packageMap = new Map(input.packages.map(p => [p.context, p.package]));
  return input.bridges.map(bridge => {
    const pkg = packageMap.get(bridge.context);
    const pkgPath = pkg.replaceAll('.', '/');
    const name = symbol(bridge.aggregate);
    const importValues = bridge.producers.some(p => usesOwnValues(p.outputType, bridge.context));
    const lines = [
      `package ${pkg}.application.aggregates.behaviors`,
      '',
      `import ${pkg}.domain.events.${name}Events._`,
      ...(importValues ? [`import ${pkg}.domain.values._`] : []),
      '',
      `object ${name}ExternalEvents {`,
    ];
    for (const producer of bridge.producers) {
      const baseMethod = toCamel(producer.id);
      const outType = renderType(producer.outputType, packageMap, bridge.context);
      const eventName = symbol(producer.event);
      const args = producer.slotMembers.map(m => 'output.' + symbol(m)).join(', ');
      const idParts = producer.identityKeys.map(k => 'output.' + symbol(k.member) + '.value'.repeat(k.unwrapDepth)).join(', ');
      lines.push(`  def ${symbol(baseMethod)}(output: ${outType}): ${eventName} = ${eventName}(${args})`);
      lines.push(`  def ${symbol(baseMethod + 'Identity')}(output: ${outType}): Vector[String] = Vector(${idParts})`);
    }
    lines.push('}', '');
    const eventsDep = `app/${pkgPath}/domain/events/${bridge.aggregate}Events.scala`;
    const deps = [eventsDep, ...new Set(bridge.producers.flatMap(p => valueDeps(p.outputType, packageMap)))];
    return {
      path: `app/${pkgPath}/application/aggregates/behaviors/${bridge.aggregate}ExternalEvents.scala`,
      content: lines.join('\n'),
      kind: 'external-event-bridge',
      sources: bridge.producers.map(p => ({ ...p.source })),
      deps,
    };
  });
}

export function renderAll(input) {
  const files = renderExternalEventBridgeFiles(input);
  const out = {};
  for (const file of files) out[file.path] = file.content;
  return out;
}

const clone = value => JSON.parse(JSON.stringify(value));

export function runNegatives(baseInput) {
  const cases = [
    ['wrong schemaVersion', x => { x.schemaVersion = 'truthsrc.external-event-bridge-input/v99'; }],
    ['empty packages', x => { x.packages = []; }],
    ['duplicate package context', x => { x.packages.push({ ...x.packages[0] }); }],
    ['invalid package name', x => { x.packages[0].package = 'Example.Bad'; }],
    ['empty bridges', x => { x.bridges = []; }],
    ['bridge context missing from packages', x => { x.bridges[0].context = 'unknown'; }],
    ['invalid aggregate name', x => { x.bridges[0].aggregate = 'fund_order'; }],
    ['duplicate bridge aggregate', x => { x.bridges.push(clone(x.bridges[0])); }],
    ['empty producers', x => { x.bridges[0].producers = []; }],
    ['invalid producer id', x => { x.bridges[0].producers[0].id = 'Bad Id!'; }],
    ['duplicate producer method name', x => { x.bridges[0].producers.push(clone(x.bridges[0].producers[0])); }],
    ['invalid event name', x => { x.bridges[0].producers[0].event = 'bad_event'; }],
    ['unsupported outputType form', x => { x.bridges[0].producers[0].outputType = { form: 'union' }; }],
    ['outputType nominal context missing', x => { x.bridges[0].producers[0].outputType = { form: 'nominal', context: 'missing', name: 'Foo' }; }],
    ['non-array slotMembers', x => { x.bridges[0].producers[0].slotMembers = 'txid'; }],
    ['invalid slotMember identifier', x => { x.bridges[0].producers[0].slotMembers = ['bad-field']; }],
    ['empty identityKeys', x => { x.bridges[0].producers[0].identityKeys = []; }],
    ['negative unwrapDepth', x => { x.bridges[0].producers[0].identityKeys[0].unwrapDepth = -1; }],
    ['missing producer source', x => { delete x.bridges[0].producers[0].source; }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, mutate] of cases) {
    const mutated = clone(baseInput);
    mutate(mutated);
    let threw = false;
    try {
      renderAll(mutated);
    } catch (error) {
      if (error?.code === 'EEB_INPUT') threw = true;
      else failures.push(`negative "${label}" threw wrong error code: ${error?.code ?? error?.message}`);
    }
    if (threw) rejected++;
    else if (!failures.some(f => f.includes(label))) failures.push(`negative "${label}" was not rejected`);
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'external-event-bridge',
  familyNumber: 46,
  inputSchema: 'truthsrc.external-event-bridge-input/v1',
  goldenRoot: 'test/reference/curated/external-event-bridge/v1',
  fixtureDir: 'test/fixtures/external-event-bridge-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput,
  renderAll,
  runNegatives,
});
