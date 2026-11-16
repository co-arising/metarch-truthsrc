import { ProductError } from '../products/request.mjs';

// Plain-data counterpart of the pinned cqrs/TypeSystem.scala. Package and type
// parameters are kept separate: an import FQN is NOT a generic signature.
function invalid(message) {
  throw new ProductError('CLASSIC_TYPE_REF', message);
}

function check(ref) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref) ||
      typeof ref.name !== 'string' || typeof ref.packageName !== 'string' ||
      !Array.isArray(ref.typeParams)) invalid('expected a structured TypeRef');
}

/** Construct an immutable value, without retaining mutable parameter objects. */
export function typeRef(name, packageName = '', typeParams = []) {
  if (typeof name !== 'string' || typeof packageName !== 'string' || !Array.isArray(typeParams))
    invalid('TypeRef requires string name/packageName and an array of typeParams');
  const params = typeParams.map(ref => {
    check(ref);
    return typeRef(ref.name, ref.packageName, ref.typeParams);
  });
  return Object.freeze({ name, packageName, typeParams: Object.freeze(params) });
}

export function fqn(ref) {
  check(ref);
  return ref.packageName === '' ? ref.name : `${ref.packageName}.${ref.name}`;
}

export function signature(ref) {
  check(ref);
  const params = ref.typeParams.map(signature);
  // Scala's forall(isDigit) is also true for the empty suffix: Tuple[T] gets
  // this spelling too. Neither the declared arity nor the package is checked.
  const isTuple = ref.name.startsWith('Tuple') &&
    ref.name.slice('Tuple'.length).split('').every(char => /^\p{Nd}$/u.test(char));
  if (isTuple && params.length) return `(${params.join(', ')})`;
  return params.length ? `${ref.name}[${params.join(', ')}]` : ref.name;
}

/** Scala case-class equality includes recursively ordered type parameters. */
function structuralKey(ref) {
  check(ref);
  return [ref.name, ref.packageName, ref.typeParams.map(structuralKey)];
}

/** Self plus recursive parameters, deduped structurally, not by FQN/signature.
 * First encounter order is deterministic; import filtering and ordering belong
 * to each Scala template (notably CommandHelpers excludes all scala* imports).
 */
export function collectDependencies(refs) {
  if (!Array.isArray(refs)) invalid('collectDependencies requires an array of TypeRefs');
  const seen = new Set();
  const result = [];
  function visit(ref) {
    const key = JSON.stringify(structuralKey(ref));
    if (seen.has(key)) return;
    seen.add(key);
    result.push(typeRef(ref.name, ref.packageName, ref.typeParams));
    ref.typeParams.forEach(visit);
  }
  refs.forEach(visit);
  return Object.freeze(result);
}

export function shouldImport(ref, currentPackage) {
  check(ref);
  return ref.packageName !== '' && ref.packageName !== currentPackage &&
    ref.packageName !== 'scala' && ref.packageName !== 'java.lang';
}
