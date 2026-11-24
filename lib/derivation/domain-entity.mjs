// Knowledge → contract derivation for the domain-entity family
// (emitter-unification plan F2, rulings 2026-11-23 §17). Turns the reference
// layout's aggregate and event declarations, domain-folds defaults and
// exact-value-types descriptors into the truthsrc.domain-entity-input/v1
// contract. Pure and fail-closed (D-P08 discipline): anything the contract
// cannot express refuses with a DE_DERIVATION diagnostic instead of emitting.
const fail = message => { throw new Error('DE_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.domain-entity-input/v1';
const PRIMITIVE_FORMS = new Set(['string', 'integer', 'boolean', 'decimal']);

const requireArray = (value, what) => {
  if (!Array.isArray(value)) fail(what + ' must be an array');
  return value;
};
const refKey = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    fail(what + ' must carry a {document, pointer} knowledge source');
  return { document: source.document, pointer: source.pointer };
}

/** Transcribe a knowledge-side valueType tree into the contract's type tree. */
function typeTree(type) {
  if (!type || typeof type !== 'object') fail('field type must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVE_FORMS.has(type.name)) fail('unsupported primitive type name: ' + JSON.stringify(type.name));
    return { form: 'primitive', name: type.name };
  }
  if (type.form === 'nominal') {
    if (!type.ref || typeof type.ref !== 'object') fail('nominal type must carry a ref');
    return { form: 'nominal', context: type.ref.context, name: type.ref.id };
  }
  if (type.form === 'optional') return { form: 'optional', element: typeTree(type.element) };
  if (type.form === 'sequence') return { form: 'sequence', element: typeTree(type.element) };
  if (type.form === 'map') return { form: 'map', key: typeTree(type.key), value: typeTree(type.value) };
  fail('unsupported field type form: ' + JSON.stringify(type.form));
}

/** Transcribe a knowledge-side default value + type into a structured literal AST. */
function literalAst(value, type, declarationByKey, exactByKey, what) {
  if (!type || typeof type !== 'object') fail(what + ' type must be a type tree');
  if (type.form === 'primitive') {
    if (type.name === 'string') {
      if (typeof value !== 'string') fail(what + ' string literal must be a string');
      return { kind: 'string', value };
    }
    if (type.name === 'boolean') {
      if (typeof value !== 'boolean') fail(what + ' boolean literal must be a boolean');
      return { kind: 'boolean', value };
    }
    if (type.name === 'integer') {
      if (typeof value !== 'string' || !/^-?\d+$/u.test(value)) fail(what + ' integer literal must be a decimal digit string');
      return { kind: 'integer', value };
    }
    if (type.name === 'decimal') {
      if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(value)) fail(what + ' decimal literal must be a numeric string');
      return { kind: 'decimal', value };
    }
    fail(what + ' unsupported primitive literal: ' + JSON.stringify(type.name));
  }
  if (type.form === 'nominal') {
    if (!type.ref || typeof type.ref !== 'object') fail(what + ' nominal type must carry a ref');
    const key = refKey(type.ref);
    const descriptor = exactByKey.get(key);
    if (descriptor) {
      if (descriptor.form === 'decimal') {
        if (typeof value !== 'string') fail(what + ' exact decimal literal must be a string');
        return { kind: 'nominal-exact-decimal', context: type.ref.context, name: type.ref.id, amount: value };
      }
      if (descriptor.form === 'unit-decimal') {
        if (!value || typeof value !== 'object') fail(what + ' exact unit-decimal literal must be an object');
        const amount = value[descriptor.amountMember.id];
        const unit = value[descriptor.unitMember.id];
        if (typeof amount !== 'string' || typeof unit !== 'string') fail(what + ' exact unit-decimal literal must carry string amount and unit');
        return { kind: 'nominal-exact-unit-decimal', context: type.ref.context, name: type.ref.id, amount, unit };
      }
      fail(what + ' unsupported exact descriptor form: ' + JSON.stringify(descriptor.form));
    }
    const declaration = declarationByKey.get(key);
    if (!declaration) fail(what + ' nominal declaration missing for ' + key);
    const underlying = declaration.valueType;
    if (underlying.form === 'record') {
      if (!value || typeof value !== 'object') fail(what + ' record literal must be an object');
      const members = requireArray(underlying.members, what + ' record members');
      return {
        kind: 'nominal-record',
        context: type.ref.context,
        name: type.ref.id,
        args: members.map(memberRef => {
          const member = declarationByKey.get(refKey(memberRef));
          if (!member) fail(what + ' record member declaration missing for ' + memberRef.id);
          return literalAst(value[memberRef.id], member.valueType, declarationByKey, exactByKey, what + '.' + memberRef.id);
        }),
      };
    }
    return {
      kind: 'nominal-wrapper',
      context: type.ref.context,
      name: type.ref.id,
      inner: literalAst(value, underlying, declarationByKey, exactByKey, what + '.value'),
    };
  }
  if (type.form === 'optional') {
    if (!value || typeof value !== 'object' || typeof value.present !== 'boolean')
      fail(what + ' optional literal must carry a boolean present flag');
    if (!value.present) return { kind: 'optional', present: false };
    return { kind: 'optional', present: true, value: literalAst(value.value, type.element, declarationByKey, exactByKey, what + '.value') };
  }
  if (type.form === 'sequence') {
    const items = requireArray(value, what + ' sequence literal');
    return { kind: 'sequence', elements: items.map((v, i) => literalAst(v, type.element, declarationByKey, exactByKey, what + '[' + i + ']')) };
  }
  if (type.form === 'map') {
    const entries = requireArray(value, what + ' map literal');
    return {
      kind: 'map',
      entries: entries.map((entry, i) => {
        if (!entry || typeof entry !== 'object') fail(what + '[' + i + '] map entry must be an object');
        return {
          key: literalAst(entry.key, type.key, declarationByKey, exactByKey, what + '[' + i + '].key'),
          value: literalAst(entry.value, type.value, declarationByKey, exactByKey, what + '[' + i + '].value'),
        };
      }),
    };
  }
  fail(what + ' unsupported literal carrier: ' + JSON.stringify(type.form));
}

/**
 * Derive the domain-entity contract. Pure over {products, options}: reads
 * reference-layout declarations, domain-folds defaults, exact-value-types
 * descriptors and explicit context package bindings.
 */
export function deriveDomainEntities(products, options) {
  const layout = requireArray(products['reference-layout']?.declarations, 'reference-layout declarations');
  const defaults = requireArray(products['domain-folds']?.defaults, 'domain-folds defaults');
  const exact = requireArray(products['exact-value-types'], 'exact-value-types');
  const allDepEvents = requireArray(products['domain-dependencies']?.events, 'domain-dependencies events');
  const packages = requireArray(options?.packages, 'explicit context package bindings');

  const exactByKey = new Map();
  for (const descriptor of exact) {
    const key = refKey(descriptor.domain);
    if (exactByKey.has(key)) fail('duplicate exact-value-type descriptor for ' + key);
    exactByKey.set(key, descriptor);
  }
  const declarationByKey = new Map();
  for (const declaration of layout) {
    if (!declaration.ref || typeof declaration.ref !== 'object') fail('layout declaration must carry a ref');
    const key = refKey(declaration.ref);
    if (declarationByKey.has(key)) fail('duplicate layout declaration for ' + key);
    declarationByKey.set(key, declaration);
  }
  const depEventByKey = new Map();
  for (const row of allDepEvents) {
    if (!row?.event || typeof row.event !== 'object') fail('domain-dependencies event row must carry event ref');
    const key = refKey(row.event);
    if (depEventByKey.has(key)) fail('duplicate domain-dependencies event for ' + key);
    depEventByKey.set(key, row);
  }

  const boundContexts = new Set(packages.map(p => p.context));
  const aggregates = [];
  const seen = new Set();
  for (const declaration of layout) {
    const ref = declaration.ref;
    if (ref.kind !== 'aggregate') continue;
    if (!boundContexts.has(ref.context)) fail('context ' + ref.context + ' has no package binding');
    const seenKey = ref.context + '/' + ref.id;
    if (seen.has(seenKey)) fail('duplicate aggregate declaration ' + seenKey);
    seen.add(seenKey);
    const owns = target => target && target.context === ref.context && Array.isArray(target.owner) && target.owner[0] === ref.id;
    const aggDefaults = defaults.filter(d => owns(d.target));
    const aggEvents = layout.filter(d => d.ref.kind === 'event' && owns(d.ref));

    const fields = aggDefaults.map(d => ({
      name: d.target.id,
      type: typeTree(d.valueType),
      default: literalAst(d.value, d.valueType, declarationByKey, exactByKey, seenKey + '.' + d.target.id),
      source: checkSource(d.source, seenKey + ' field ' + d.target.id),
    }));
    const events = aggEvents.map(e => {
      const depRow = depEventByKey.get(refKey(e.ref));
      if (!depRow) fail('event ' + seenKey + '.' + e.ref.id + ' missing from domain-dependencies');
      const slots = requireArray(depRow.declaredSlots, 'event ' + seenKey + '.' + e.ref.id + ' declaredSlots').map(r => ({
        name: (r.ref ?? r.target).id,
        valueType: typeTree(r.valueType),
      }));
      return {
        name: e.ref.id,
        source: checkSource(e.source, seenKey + ' event ' + e.ref.id),
        slots,
      };
    });
    aggregates.push({
      context: ref.context,
      name: ref.id,
      source: checkSource(declaration.source, seenKey),
      fields,
      events,
    });
  }
  if (!aggregates.length) fail('no aggregate declarations in the reference layout');

  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    aggregates,
  };
}
