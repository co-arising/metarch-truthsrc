import { types } from 'node:util';

const asyncPrototype = Object.getPrototypeOf(async function () {});
const nativeThen = Promise.prototype.then;
const invalid = (settled = true) => Object.assign(new Error('invalid verification callback result'), { callbackSettled: settled });

export function assertVerificationCallback(value) {
  if (typeof value !== 'function' || types.isProxy(value) || types.isGeneratorFunction(value) ||
    ![Function.prototype, asyncPrototype].includes(Object.getPrototypeOf(value))) throw invalid();
  return value;
}

function immediate(value) {
  for (let current = value; current !== null && ['object', 'function'].includes(typeof current); current = Object.getPrototypeOf(current)) {
    if (types.isProxy(current) || types.isGeneratorObject(current)) throw invalid();
    const then = Object.getOwnPropertyDescriptor(current, 'then');
    if (then) {
      if (!Object.hasOwn(then, 'value') || typeof then.value === 'function') throw invalid();
      break;
    }
  }
}

// Copy synchronous results before yielding. Native promises with extra metadata
// are drained before rejection; shape failure is not proof that work has stopped.
// Constructor/species overrides cannot be observed without executing user code,
// so their settlement remains unverified and the owning lease must be retained.
export function settleVerificationCallback(callback, args, convert) {
  const value = assertVerificationCallback(callback)(...args);
  if (!types.isPromise(value)) {
    immediate(value);
    return Promise.resolve(convert(value));
  }
  if (types.isProxy(value) || Object.getPrototypeOf(value) !== Promise.prototype ||
    Object.hasOwn(value, 'constructor')) throw invalid(false);
  const valid = Reflect.ownKeys(value).every(key => typeof key === 'symbol' &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
  return new Promise((resolve, reject) => nativeThen.call(value, result => {
    try {
      if (!valid) throw invalid();
      immediate(result); resolve(convert(result));
    } catch (error) { reject(error); }
  }, error => reject(valid ? error : invalid())));
}
