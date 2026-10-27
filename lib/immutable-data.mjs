import { types } from 'node:util';

// Read descriptors, not getters. Keep insertion order and null prototypes;
// freeze detached data only, never the caller's objects.
export function copyImmutableData(value, pointer = '', onInvalid = (at, message) => {
  throw new Error(`data ${at}: ${message}`);
}) {
  const ancestors = new Set();
  const fail = (at, message) => {
    onInvalid(at, message);
    throw new Error(`data ${at}: ${message}`);
  };
  const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
  function copy(value, at) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || types.isProxy(value)) fail(at, 'expected plain JSON data');
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (!(array ? proto === Array.prototype : proto === Object.prototype || proto === null)) fail(at, 'expected plain JSON data');
    if (ancestors.has(value)) fail(at, 'cyclic data');
    if (ancestors.size >= 128) fail(at, 'nesting exceeds 128');
    ancestors.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
    if (array && (keys.length !== value.length || keys.some((key, i) => key !== String(i)))) fail(at, 'sparse or non-JSON array');
    const result = array ? [] : Object.create(proto);
    for (const key of keys) {
      const entry = descriptors[key];
      if (typeof key !== 'string' || !entry.enumerable || !Object.hasOwn(entry, 'value')) fail(at, 'expected enumerable data properties');
      Object.defineProperty(result, key, { value: copy(entry.value, `${at}/${escape(key)}`), enumerable: true, writable: true, configurable: true });
    }
    ancestors.delete(value);
    return Object.freeze(result);
  }
  return copy(value, pointer);
}
