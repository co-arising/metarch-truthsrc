import { types } from 'node:util';

// Selection reads descriptors only. Each selected compiler still checks the whole
// original input; unknown, mixed or malformed versions never gain a fallback.
export function selectBindingCompiler(binding, version, legacy, current) {
  if (binding === null || typeof binding !== 'object' || types.isProxy(binding)) return legacy;
  const descriptor = Object.getOwnPropertyDescriptor(binding, 'schemaVersion');
  return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value === version ? current : legacy;
}
