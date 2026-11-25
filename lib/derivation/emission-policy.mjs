// Central emission policy for unified emitter families.
// Zero hardcoded business context, aggregate, host, or pipeline names.
//
// Resolution precedence:
//   1. `options.service.emission === 'classic'` (or `options.emission === 'classic'`)
//      -> unified emission disabled for all contexts.
//   2. `Array.isArray(options.service.emitterContexts)` (or `options.emitterContexts`)
//      -> unified emission enabled strictly for the listed contexts.
//   3. Otherwise:
//      - `isUnifiedContext(context, options)` returns `true` for every declared
//        non-empty bounded context (unified-by-default for any domain).
//      - `isClassicRetiredContext(context, options)` returns `true` only when
//        unified emission has been explicitly activated (e.g., by the
//        scala-cqrs-play-service generator wrapper), so standalone classic
//        generators (`scala-cqrs-domain`, `scala-cqrs-application`) remain intact.

const emissionMode = options => options?.service?.emission ?? options?.emission ?? null;
const configuredContexts = options => {
  const list = options?.service?.emitterContexts ?? options?.emitterContexts;
  return Array.isArray(list) ? list : null;
};

export function isUnifiedContext(context, options) {
  if (typeof context !== 'string' || !context) return false;
  if (emissionMode(options) === 'classic') return false;
  const list = configuredContexts(options);
  if (list) return list.includes(context);
  return true;
}

export function isClassicRetiredContext(context, options) {
  if (typeof context !== 'string' || !context) return false;
  const mode = emissionMode(options);
  if (mode === 'classic') return false;
  const list = configuredContexts(options);
  if (list) return list.includes(context);
  return mode === 'unified';
}

export function withPlayServiceEmission(context) {
  const mode = emissionMode(context?.options);
  if (mode === 'classic' || mode === 'unified') return context;
  const list = configuredContexts(context?.options);
  if (list) return context;
  return {
    ...context,
    options: {
      ...(context?.options ?? {}),
      emission: 'unified',
    },
  };
}
