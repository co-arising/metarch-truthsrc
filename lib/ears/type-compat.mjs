// Shared type compatibility, formatting, and default-value validation for co-arising 2.0
// (used across structure-loader, EARS binder, and v2 data-lineage verification).

export function formatType(t) {
  if (!t || typeof t !== 'object') return 'unknown';
  switch (t.kind) {
    case 'int': return t.typeName ?? 'Int';
    case 'bool': return t.typeName ?? 'Bool';
    case 'decimal': return t.typeName ?? (t.scale !== undefined ? `Decimal(${t.scale})` : 'Decimal');
    case 'string': {
      const base = t.typeName ?? 'String';
      if (Array.isArray(t.enumValues) && t.enumValues.length > 0) {
        return `${base}[${t.enumValues.join('|')}]`;
      }
      return base;
    }
    case 'none': return 'None';
    case 'optional': return `Optional[${formatType(t.element)}]`;
    case 'sequence': return `Seq[${formatType(t.element)}]`;
    case 'map': return `Map[${formatType(t.key)}, ${formatType(t.value)}]`;
    case 'record': return t.typeName ?? 'Record';
    default: return t.kind ?? 'unknown';
  }
}

function isNominalString(t) {
  return t?.kind === 'string' && Boolean(t.nominal) && Boolean(t.typeName) && t.typeName !== 'String';
}

function areRecordsCompatible(actual, expected, opts) {
  if (actual.typeName && expected.typeName && actual.typeName !== expected.typeName) {
    return false;
  }
  const aFields = actual.fields ?? {};
  const eFields = expected.fields ?? {};
  const aKeys = Object.keys(aFields);
  const eKeys = Object.keys(eFields);
  if (aKeys.length !== eKeys.length) return false;
  for (const k of eKeys) {
    if (!Object.hasOwn(aFields, k)) return false;
    if (!isTypeCompatible(aFields[k], eFields[k], opts)) return false;
  }
  return true;
}

/**
 * Determine whether a value of type `actual` can safely flow into a slot of type `expected`.
 *
 * Options:
 * - allowOptionalWrap: allow `T` to flow into `Optional[T]` (e.g. `post: opt' = val`)
 * - allowNumericPromotion: allow `Int` <-> `Decimal` (e.g. comparisons / arithmetic expressions)
 * - exactScale: when both are `Decimal` with explicit scale, require identical scale
 * - strictNominal: when true, disallow plain `String` <-> `NominalId` without matching typeName
 * - allowUnitDecimalUnwrap: allow unit-decimal `Money` to project its inner amount into `Decimal`
 */
export function isTypeCompatible(actual, expected, opts = {}) {
  const {
    allowOptionalWrap = false,
    allowNumericPromotion = false,
    exactScale = true,
    strictNominal = false,
    allowUnitDecimalUnwrap = false,
  } = opts;

  if (!actual || !expected) return true;
  if (actual.kind === 'unknown' || expected.kind === 'unknown') return true;

  // `none` literal flows ONLY into Optional[T]
  if (actual.kind === 'none') {
    return expected.kind === 'optional';
  }
  if (expected.kind === 'none') {
    return actual.kind === 'optional';
  }

  // Optional handling
  if (expected.kind === 'optional') {
    if (actual.kind === 'optional') {
      return isTypeCompatible(actual.element, expected.element, opts);
    }
    if (allowOptionalWrap) {
      return isTypeCompatible(actual, expected.element, opts);
    }
    return false;
  }
  if (actual.kind === 'optional') {
    // Cannot silently drop nullability into a non-optional slot
    return false;
  }

  // Unit-decimal projection (e.g., Money -> AmountDecimal across application/domain boundary)
  if (allowUnitDecimalUnwrap && actual.kind === 'record' && actual.exactForm === 'unit-decimal' && expected.kind === 'decimal') {
    const amountField = Object.values(actual.fields ?? {}).find(f => f?.kind === 'decimal');
    if (amountField) {
      return isTypeCompatible(amountField, expected, { ...opts, allowUnitDecimalUnwrap: false });
    }
  }

  // Numeric kinds
  if (actual.kind === 'int' && expected.kind === 'int') return true;
  if (actual.kind === 'decimal' && expected.kind === 'decimal') {
    if (exactScale && actual.scale !== undefined && expected.scale !== undefined) {
      return actual.scale === expected.scale;
    }
    return true;
  }
  if (allowNumericPromotion && ((actual.kind === 'int' && expected.kind === 'decimal') || (actual.kind === 'decimal' && expected.kind === 'int'))) {
    return true;
  }

  if (actual.kind !== expected.kind) return false;

  if (actual.kind === 'bool') return true;

  if (actual.kind === 'string') {
    const aNom = isNominalString(actual);
    const eNom = isNominalString(expected);
    if (aNom && eNom && actual.typeName !== expected.typeName) {
      return false;
    }
    if (strictNominal && aNom !== eNom) {
      return false;
    }
    // If both declare closed enum vocabularies, actual's values must be a subset of expected's
    const aEnum = Array.isArray(actual.enumValues) && actual.enumValues.length > 0 ? actual.enumValues : null;
    const eEnum = Array.isArray(expected.enumValues) && expected.enumValues.length > 0 ? expected.enumValues : null;
    if (aEnum && eEnum) {
      const allowed = new Set(eEnum);
      for (const v of aEnum) {
        if (!allowed.has(v)) return false;
      }
    }
    return true;
  }

  if (actual.kind === 'sequence') {
    return isTypeCompatible(actual.element, expected.element, opts);
  }

  if (actual.kind === 'map') {
    return isTypeCompatible(actual.key, expected.key, opts)
      && isTypeCompatible(actual.value, expected.value, opts);
  }

  if (actual.kind === 'record') {
    return areRecordsCompatible(actual, expected, opts);
  }

  return true;
}

/**
 * Validate that a YAML default value matches its resolved field type (and closed enum if present).
 * Returns null if valid, or a descriptive error reason string if invalid.
 */
export function validateDefaultValue(defaultValue, resolvedType) {
  if (defaultValue === undefined || !resolvedType || resolvedType.kind === 'unknown') return null;

  if (resolvedType.kind === 'optional') {
    if (defaultValue === null || defaultValue === 'null' || defaultValue === 'none') return null;
    return validateDefaultValue(defaultValue, resolvedType.element);
  }

  if (defaultValue === null) {
    return `cannot assign null default to non-optional type ${formatType(resolvedType)}`;
  }

  switch (resolvedType.kind) {
    case 'int': {
      if (typeof defaultValue === 'number' && Number.isInteger(defaultValue)) return null;
      return `expected integer default for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
    }
    case 'bool': {
      if (typeof defaultValue === 'boolean') return null;
      return `expected boolean default for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
    }
    case 'decimal': {
      if (typeof defaultValue === 'number' && Number.isFinite(defaultValue)) return null;
      if (typeof defaultValue === 'string' && /^-?\d+(?:\.\d+)?$/u.test(defaultValue.trim())) return null;
      return `expected numeric/decimal string default for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
    }
    case 'string': {
      if (typeof defaultValue !== 'string') {
        return `expected string default for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
      }
      if (Array.isArray(resolvedType.enumValues) && resolvedType.enumValues.length > 0) {
        if (!resolvedType.enumValues.includes(defaultValue)) {
          return `default ${JSON.stringify(defaultValue)} is outside declared closed enum [${resolvedType.enumValues.join(', ')}]`;
        }
      }
      return null;
    }
    case 'sequence': {
      if (Array.isArray(defaultValue)) return null;
      return `expected array default for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
    }
    case 'map': {
      // Allow both {} and legacy YAML shorthand [] for empty map defaults
      if (typeof defaultValue === 'object' && (!Array.isArray(defaultValue) || defaultValue.length === 0)) return null;
      return `expected map default ({} or []) for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
    }
    case 'record': {
      if (typeof defaultValue === 'object' && !Array.isArray(defaultValue)) return null;
      return `expected record object default for ${formatType(resolvedType)}, got ${JSON.stringify(defaultValue)}`;
    }
    default:
      return null;
  }
}
