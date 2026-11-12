import { types } from 'node:util';

const asyncPrototype = Object.getPrototypeOf(async function () {});
const nativeThen = Promise.prototype.then;
const signalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
const signalThrowIfAborted = AbortSignal.prototype.throwIfAborted;
const signalAddListener = EventTarget.prototype.addEventListener;
const signalRemoveListener = EventTarget.prototype.removeEventListener;
const invalid = (settled = true) => Object.assign(new Error('invalid verification callback result'), { callbackSettled: settled });

// Capture native capabilities before acquiring resources, never caller overrides.
// Proxies and custom prototypes are rejected before a native brand check can read them.
export function captureVerificationSignal(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== AbortSignal.prototype)
    throw new Error('invalid cancellation signal');
  try { signalAborted.call(value); } catch { throw new Error('invalid cancellation signal'); }
  return Object.freeze({
    get aborted() { return signalAborted.call(value); },
    throwIfAborted: signalThrowIfAborted.bind(value),
    addEventListener: signalAddListener.bind(value),
    removeEventListener: signalRemoveListener.bind(value),
  });
}

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
  // isPromise cannot see through a proxy; rejection cannot prove its work stopped.
  if (types.isProxy(value)) throw invalid(false);
  if (!types.isPromise(value)) {
    immediate(value);
    return Promise.resolve(convert(value));
  }
  if (Object.getPrototypeOf(value) !== Promise.prototype || Object.hasOwn(value, 'constructor')) throw invalid(false);
  const valid = Reflect.ownKeys(value).every(key => typeof key === 'symbol' &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
  return new Promise((resolve, reject) => nativeThen.call(value, result => {
    try {
      if (!valid) throw invalid();
      immediate(result); resolve(convert(result));
    } catch (error) { reject(error); }
  }, error => reject(valid ? error : invalid())));
}
