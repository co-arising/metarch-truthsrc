import { at, array, equal, fail, object, text, unique } from '../products/request.mjs';
import { reference, refKey } from '../domain-products/references.mjs';
import { canonicalAt, checkCanonicalShape, checkExactShape, packExact, unpackExact } from './exact-types.mjs';

export function compileExactCodecs(binding, canonical, layout, exactTypes) {
  object(binding.value, ['schemaVersion', 'codecs'], at(binding.id));
  const codecs = array(binding.value.codecs, at(binding.id, '/codecs'));
  const declarations = new Map(layout.declarations.map(d => [refKey(d.ref), d]));
  const representations = new Set(exactTypes.map(t => refKey(t.domain)));
  for (const [i, c] of codecs.entries()) {
    const location = at(binding.id, `/codecs/${i}`);
    object(c, ['domain', 'domainVersion', 'id', 'version', 'format', 'wire', 'po', 'source'], location);
    reference(c.domain, location); text(c.domainVersion, location); text(c.id, location); text(c.version, location);
    if (!equal(c.source, location)) fail('EXACT_SOURCE', 'codec source must identify its complete binding row', location);
    const type = exactTypes.find(t => equal(t.domain, c.domain));
    if (!type || c.domainVersion !== type.version) fail('EXACT_VERSION', 'codec must pin the exact declared domain version', location);
    if (!['fixed-decimal-text', 'minor-units-text'].includes(c.format)) fail('EXACT_CODEC', 'unsupported reversible conversion', location);
    for (const r of [c.wire, c.po]) {
      object(r, ['ref', 'version', 'amountMember', 'unitMember'], location);
      reference(r.ref, location); text(r.version, location);
      const d = declarations.get(refKey(r.ref));
      if (r.ref.kind !== 'type' || !d || representations.has(refKey(r.ref))) fail('EXACT_IDENTITY', 'domain/wire/PO identities must be declared, distinct and unaliased', location);
      representations.add(refKey(r.ref));
      if (canonicalAt(canonical, d.source.pointer)?.name !== r.ref.id || canonicalAt(canonical, d.source.pointer)?.version !== r.version)
        fail('EXACT_VERSION', 'wire/PO version differs from canonical declaration', location);
      if (type.form === 'decimal') {
        if (!equal(d.valueType, { form: 'primitive', name: 'string' }) || r.amountMember !== null || r.unitMember !== null)
          fail('EXACT_SHAPE', 'scalar exact representation must be a declared text type', location);
      } else {
        reference(r.amountMember, location); reference(r.unitMember, location);
        if (equal(r.amountMember, r.unitMember) || !equal(d.valueType, { form: 'record', members: [r.amountMember, r.unitMember] }))
          fail('EXACT_SHAPE', 'unit representation must declare exactly amount/unit text members', location);
        for (const member of [r.amountMember, r.unitMember]) {
          if (member.kind !== 'member' || member.context !== r.ref.context || !equal(member.owner, [r.ref.id]) ||
              !equal(declarations.get(refKey(member))?.valueType, { form: 'primitive', name: 'string' }))
            fail('EXACT_SHAPE', 'representation member must be its own declared text field', location);
        }
      }
      checkCanonicalShape(canonical, d, declarations, type.form === 'decimal' ? 'String' : ['String', 'String'], location);
    }
  }
  unique(codecs.map(c => refKey(c.domain)), 'EXACT_CODEC', at(binding.id));
  unique(codecs.map(c => c.id), 'EXACT_CODEC', at(binding.id));
  if (!equal(codecs.map(c => refKey(c.domain)).sort(), exactTypes.map(t => refKey(t.domain)).sort()))
    fail('EXACT_COVERAGE', 'each exact type needs exactly one complete codec', at(binding.id));
  return codecs;
}
export function encodeExact(type, codec, value, target = 'wire') {
  check(type, codec, target);
  const { coefficient, unit } = unpackExact(value, type), representation = codec[target];
  const amount = codec.format === 'minor-units-text' ? coefficient.toString() :
    (type.form === 'decimal' ? value : value[type.amountMember.id]);
  return type.form === 'decimal' ? amount : { [representation.amountMember.id]: amount, [representation.unitMember.id]: unit };
}
export function decodeExact(type, codec, value, target = 'wire') {
  check(type, codec, target);
  const r = codec[target];
  if (type.form !== 'decimal') object(value, [r.amountMember.id, r.unitMember.id], at('value'));
  const amount = type.form === 'decimal' ? value : value[r.amountMember.id];
  const unit = type.form === 'decimal' ? null : value[r.unitMember.id];
  if (codec.format === 'fixed-decimal-text') {
    const result = type.form === 'decimal' ? amount : { [type.amountMember.id]: amount, [type.unitMember.id]: unit };
    unpackExact(result, type); return result;
  }
  if (typeof amount !== 'string' || amount.length > 40 || !/^-?(0|[1-9][0-9]*)$/u.test(amount) || amount === '-0') fail('EXACT_VALUE', 'minor units require canonical integer text');
  return packExact(BigInt(amount), unit, type);
}
function check(type, codec, target) {
  checkExactShape(type);
  if (!['wire', 'po'].includes(target) || !equal(type.domain, codec.domain) || type.version !== codec.domainVersion ||
      !['fixed-decimal-text', 'minor-units-text'].includes(codec.format)) fail('EXACT_CODEC', 'codec pin, representation or format mismatch');
  const r = codec[target];
  if (!r || (type.form === 'decimal' ? r.amountMember !== null || r.unitMember !== null :
      !r.amountMember || !r.unitMember || r.amountMember.id === r.unitMember.id)) fail('EXACT_CODEC', 'representation shape is incomplete');
}
