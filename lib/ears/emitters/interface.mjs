// Multi-language EarsTestEmitter contract & registry (Scala / TypeScript / Java / Rust / Go).

const registry = new Map();

export function validateEmitterContract(emitter) {
  if (!emitter || typeof emitter !== 'object') {
    throw new Error('EARS_EMITTER_INVALID: emitter must be an object');
  }
  for (const field of ['language', 'framework']) {
    if (typeof emitter[field] !== 'string' || emitter[field].length === 0) {
      throw new Error(`EARS_EMITTER_INVALID: missing string "${field}"`);
    }
  }
  for (const method of ['emitDomainSpec', 'emitApplicationSpec']) {
    if (typeof emitter[method] !== 'function') {
      throw new Error(`EARS_EMITTER_INVALID: missing method "${method}"`);
    }
  }
  return emitter;
}

export function registerEmitter(emitter) {
  validateEmitterContract(emitter);
  registry.set(`${emitter.language}:${emitter.framework}`, emitter);
  return emitter;
}

export function getEmitter(language, framework = null) {
  if (framework) return registry.get(`${language}:${framework}`) ?? null;
  for (const em of registry.values()) {
    if (em.language === language) return em;
  }
  return null;
}

export function listEmitters() {
  return [...registry.values()].map(em => ({ language: em.language, framework: em.framework }));
}
