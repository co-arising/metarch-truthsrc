// Knowledge → contract derivation for the value-object family
// (emitter-unification plan F2, rulings 2026-11-23 §8). Turns the reference
// layout's type declarations, their member declarations and the exact-value
// type descriptors into the truthsrc.value-object-input/v1 contract. Pure and
// fail-closed (D-P08 discipline): anything the contract cannot express —
// missing member declarations, unsupported type forms, inconsistent exact
// descriptors, missing or duplicated package bindings — refuses with a
// VO_DERIVATION diagnostic instead of emitting. Nominal member references are
// transcribed verbatim (the knowledge machine has already resolved member
// types; the emitter validates their context bindings at checkInput time).
import { valueObjectSubpackage } from './value-object-package.mjs';

const fail = message => { throw new Error('VO_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.value-object-input/v1';
const PRIMITIVE_FORMS = new Map([['string', 'string'], ['integer', 'integer'], ['boolean', 'boolean'], ['decimal', 'decimal']]);

const requireArray = (value, what) => {
  if (!Array.isArray(value)) fail(what + ' must be an array');
  return value;
};
const refKey = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

/** Transcribe a knowledge-side valueType tree into the contract's type tree. */
function typeTree(type) {
  if (!type || typeof type !== 'object') fail('member type must be a type tree');
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
  fail('unsupported member type form: ' + JSON.stringify(type.form));
}

/**
 * Derive the value-object contract. Pure over {products, options}: reads the
 * reference-layout declarations and the exact-value-types descriptors, and
 * the explicit context package bindings. Every type declaration in the layout
 * becomes exactly one value; the emission wrapper filters by flip manifest.
 */
export function deriveValueObjects(products, options) {
  const layout = requireArray(products['reference-layout']?.declarations, 'reference-layout declarations');
  const exact = requireArray(products['exact-value-types'], 'exact-value-types');
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

  const boundContexts = new Set(packages.map(p => p.context));
  const values = [];
  const seen = new Set();
  for (const declaration of layout.values()) {
    const ref = declaration.ref;
    if (ref.kind !== 'type') continue;
    // Persistence objects (*PO) are generated exclusively by ScalaPB from app/protobuf/*.proto.
    if (/PO$/u.test(ref.id)) continue;
    if (!boundContexts.has(ref.context)) fail('context ' + ref.context + ' has no package binding');
    const key = refKey(ref);
    const seenKey = ref.context + '/' + ref.id;
    if (seen.has(seenKey)) fail('duplicate type declaration ' + seenKey);
    seen.add(seenKey);
    if (Array.isArray(ref.owner) && ref.owner.length) fail('value object types must be context-level, owner declared: ' + seenKey);

    const descriptor = exactByKey.get(key);
    let shape;
    if (descriptor) {
      if (!descriptor.domain || refKey(descriptor.domain) !== key) fail('exact descriptor domain mismatch for ' + seenKey);
      if (!Number.isInteger(descriptor.scale) || descriptor.scale <= 0 || !Number.isInteger(descriptor.precision) || descriptor.precision <= 0)
        fail('exact descriptor for ' + seenKey + ' must carry positive integer scale and precision');
      const amountMember = descriptor.amountMember ? descriptor.amountMember.id : 'value';
      if (typeof amountMember !== 'string' || !amountMember) fail('exact descriptor for ' + seenKey + ' must carry an amount member');
      if ((descriptor.unitMember == null) !== (!Array.isArray(descriptor.units) || descriptor.units.length === 0))
        fail('exact descriptor for ' + seenKey + ' must declare its unit member and unit set together');
      shape = {
        kind: 'exact', amountMember,
        ...(descriptor.unitMember ? { unitMember: descriptor.unitMember.id, units: [...descriptor.units] } : {}),
        scale: descriptor.scale, precision: descriptor.precision,
      };
    } else if (declaration.valueType?.form === 'primitive') {
      shape = { kind: 'primitive', member: 'value', type: typeTree(declaration.valueType) };
    } else if (declaration.valueType?.form === 'record') {
      const members = requireArray(declaration.valueType.members, 'record members of ' + seenKey);
      if (!members.length) fail('record ' + seenKey + ' must declare at least one member');
      shape = {
        kind: 'record',
        members: members.map(memberRef => {
          const member = declarationByKey.get(refKey(memberRef));
          if (!member) fail('member declaration missing for ' + seenKey + '.' + memberRef.id);
          return { name: memberRef.id, type: typeTree(member.valueType) };
        }),
      };
    } else {
      fail('unsupported value object type form for ' + seenKey + ': ' + JSON.stringify(declaration.valueType?.form));
    }
    if (!declaration.source || typeof declaration.source.document !== 'string' || !declaration.source.document ||
      typeof declaration.source.pointer !== 'string' || !declaration.source.pointer.startsWith('/'))
      fail('type declaration ' + seenKey + ' must carry a {document, pointer} knowledge source');
    const subpackage = valueObjectSubpackage(ref.id);
    values.push({
      context: ref.context,
      name: ref.id,
      ...(subpackage !== 'domain.values' ? { subpackage } : {}),
      source: { ...declaration.source },
      shape,
    });
  }
  if (!values.length) fail('no type declarations in the reference layout');

  // The contract carries the project's full binding set: nominal references
  // may target contexts with no local values, and the emitter validates the
  // bindings it actually needs (checkInput).
  return { schemaVersion: SCHEMA, packages: packages.map(p => ({ context: p.context, package: p.package })), values };
}
