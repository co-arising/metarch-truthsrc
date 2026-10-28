import { at, array, equal, fail, object, text, unique } from '../products/request.mjs';
import { refKey, reference } from '../domain-products/references.mjs';

export function compileExactTypes(binding, canonical, layout) {
  object(binding.value, ['schemaVersion', 'types'], at(binding.id));
  const types = array(binding.value.types, at(binding.id, '/types'));
  if (!types.length) fail('EXACT_EMPTY', 'exact type definitions are required', at(binding.id));
  const declarations = new Map(layout.declarations.map(d => [refKey(d.ref), d]));
  for (const [i, t] of types.entries()) {
    const location = at(binding.id, `/types/${i}`);
    object(t, ['domain', 'version', 'source', 'form', 'precision', 'scale', 'amountMember', 'unitMember', 'units'], location);
    reference(t.domain, location); text(t.version, location);
    const declaration = declarations.get(refKey(t.domain));
    if (t.domain.kind !== 'type' || !declaration || !equal(t.source, declaration.source) || t.source.document !== canonical.id)
      fail('EXACT_IDENTITY', 'domain type/source must match the declared layout', location);
    if (!Number.isSafeInteger(t.precision) || t.precision < 1 || t.precision > 38 || !Number.isSafeInteger(t.scale) || t.scale < 0 || t.scale > t.precision)
      fail('EXACT_BOUNDS', 'precision 1..38 and scale 0..precision must be explicit', location);
    array(t.units, location).forEach(u => text(u, location)); unique(t.units, 'EXACT_UNIT', location);
    if (t.form === 'decimal') {
      if (!equal(declaration.valueType, { form: 'primitive', name: 'decimal' }) || t.amountMember !== null || t.unitMember !== null || t.units.length)
        fail('EXACT_SHAPE', 'scalar decimal cannot declare record members or units', location);
    } else if (t.form === 'unit-decimal') {
      for (const r of [t.amountMember, t.unitMember]) if (r !== null) reference(r, location);
      const members = [t.amountMember, t.unitMember];
      if (t.amountMember === null || t.unitMember === null) fail('EXACT_SHAPE', 'unit-decimal requires amount and unit members', location);
      if (!t.units.length || refKey(t.amountMember) === refKey(t.unitMember) || declaration.valueType?.form !== 'record' ||
          !equal(declaration.valueType.members, members)) fail('EXACT_SHAPE', 'unit-decimal requires exactly ordered amount and unit members', location);
      for (const [j, member] of members.entries()) {
        const field = declarations.get(refKey(member));
        if (member.kind !== 'member' || member.context !== t.domain.context || !equal(member.owner, [t.domain.id]) ||
            !equal(field?.valueType, { form: 'primitive', name: j === 0 ? 'decimal' : 'string' }))
          fail('EXACT_SHAPE', 'amount/unit must be declared decimal/string members of this type', location);
      }
    } else fail('EXACT_SHAPE', 'unsupported exact type form', location);
    const original = canonicalAt(canonical, t.source.pointer);
    if (original?.name !== t.domain.id || original?.version !== t.version) fail('EXACT_VERSION', 'canonical domain identity/version differs', location);
    checkCanonicalShape(canonical, declaration, declarations, t.form === 'decimal' ? 'Decimal' : ['Decimal', 'String'], location);
  }
  unique(types.map(t => refKey(t.domain)), 'EXACT_IDENTITY', at(binding.id));
  return types;
}
export function checkCanonicalShape(canonical, declaration, declarations, shape, location) {
  const value = canonicalAt(canonical, declaration.source.pointer);
  if (!Array.isArray(shape)) {
    if (value?.dataType !== shape) fail('EXACT_SHAPE', 'canonical scalar representation differs from the declared type', location);
    return;
  }
  const members = declaration.valueType.members;
  if (!Array.isArray(value?.fields) || value.fields.length !== members.length) fail('EXACT_SHAPE', 'canonical fields must cover every record member', location);
  for (const [i, member] of members.entries()) {
    const d = declarations.get(refKey(member)), field = value.fields[i];
    if (!d || d.source.document !== canonical.id || d.source.pointer !== `${declaration.source.pointer}/fields/${i}` ||
        field?.name !== member.id || field?.dataType !== shape[i])
      fail('EXACT_SHAPE', 'canonical record field identity, type or source differs', location);
  }
}
export function canonicalAt(canonical, pointer) {
  return pointer.split('/').slice(1).reduce((value, part) => value?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], canonical.value);
}

export function checkExactBounds(type) {
  if (!type || !Number.isSafeInteger(type.precision) || type.precision < 1 || type.precision > 38 ||
      !Number.isSafeInteger(type.scale) || type.scale < 0 || type.scale > type.precision)
    fail('EXACT_BOUNDS', 'precision 1..38 and scale 0..precision must be explicit');
}
/** Canonical, fixed-scale decimal text. No Number conversion, rounding or exponent. */
export function parseExact(textValue, type) {
  checkExactBounds(type);
  if (typeof textValue !== 'string' || textValue.length > 80 || !/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/u.test(textValue)) fail('EXACT_VALUE', 'expected canonical decimal text');
  const negative = textValue.startsWith('-'), unsigned = negative ? textValue.slice(1) : textValue;
  const [whole, fraction = ''] = unsigned.split('.');
  if (fraction.length !== type.scale || type.scale === 0 && unsigned.includes('.')) fail('EXACT_SCALE', 'decimal scale must match exactly; rounding forbidden');
  const coefficient = BigInt(whole + fraction) * (negative ? -1n : 1n);
  if (negative && coefficient === 0n) fail('EXACT_VALUE', 'negative zero is not canonical');
  if ((coefficient < 0n ? -coefficient : coefficient).toString().length > type.precision) fail('EXACT_OVERFLOW', 'decimal exceeds declared precision');
  return coefficient;
}
export function formatExact(coefficient, type) {
  checkExactBounds(type);
  if (typeof coefficient !== 'bigint') fail('EXACT_VALUE', 'exact coefficients must be BigInt');
  const negative = coefficient < 0n, absolute = (negative ? -coefficient : coefficient).toString();
  const digits = absolute.padStart(type.scale + 1, '0');
  const result = (negative ? '-' : '') + (type.scale ? digits.slice(0, -type.scale) + '.' + digits.slice(-type.scale) : digits);
  parseExact(result, type);
  return result;
}
export function checkExactShape(type) {
  if (!type || !Array.isArray(type.units) || !['decimal', 'unit-decimal'].includes(type.form) ||
      (type.form === 'decimal' ? type.amountMember !== null || type.unitMember !== null || type.units.length :
        !type.amountMember || !type.unitMember || type.amountMember.id === type.unitMember.id || !type.units.length))
    fail('EXACT_SHAPE', 'exact value requires a complete declared scalar or unit record shape');
}
export function unpackExact(value, type) {
  checkExactShape(type);
  if (type.form === 'decimal') return { coefficient: parseExact(value, type), unit: null };
  object(value, [type.amountMember.id, type.unitMember.id], at('value'));
  const unit = value[type.unitMember.id];
  if (!type.units.includes(unit)) fail('EXACT_UNIT', 'unit is not declared for this exact type');
  return { coefficient: parseExact(value[type.amountMember.id], type), unit };
}
export function packExact(coefficient, unit, type) {
  checkExactShape(type);
  const amount = formatExact(coefficient, type);
  if (type.form === 'decimal') return amount;
  if (!type.units.includes(unit)) fail('EXACT_UNIT', 'unit is not declared for this exact type');
  return { [type.amountMember.id]: amount, [type.unitMember.id]: unit };
}
export function compareExact(type, left, right) {
  const a = unpackExact(left, type), b = unpackExact(right, type);
  if (a.unit !== b.unit) fail('EXACT_UNIT', 'cannot compare different units');
  return a.coefficient < b.coefficient ? -1 : a.coefficient > b.coefficient ? 1 : 0;
}
