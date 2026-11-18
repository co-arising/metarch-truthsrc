import { at, equal, fail, object } from '../products/request.mjs';

const fields = ['schemaVersion', 'architecture', 'multiProject', 'formalSemantics', 'strictInput', 'composition'];

/** Explicit side inputs supplied with a complete classic metadata export. */
export function classicTechnicalInputs(value, system, source) {
  object(value, fields, source);
  if (value.schemaVersion !== 'truthsrc.classic-technical-input/v1')
    fail('CLASSIC_TECHNICAL_VERSION', 'explicit classic technical input schema required', source);
  if (!equal(value.architecture, { name: system.name, contextName: system.contextName }))
    fail('CLASSIC_TECHNICAL_IDENTITY', 'technical inputs must identify the same complete architecture', source);
  if (typeof value.multiProject !== 'boolean') fail('CLASSIC_TECHNICAL_MODE', 'multiProject must be boolean', source);
  if (value.formalSemantics !== null) {
    const formal = value.formalSemantics;
    object(formal, ['schemaVersion', 'system', 'aggregates'], at(source.document, source.pointer + '/formalSemantics'));
    if (formal.schemaVersion !== 'truthsrc.formal-semantics/v2' || formal.system !== system.name || !Array.isArray(formal.aggregates))
      fail('CLASSIC_FORMAL_INPUT', 'formal semantics must identify the same complete architecture', source);
  }
  // The strict public profile owns independent actual-base and pin admission;
  // the ordinary classic source profile never accepts a caller readiness token.
  if (value.strictInput !== null || value.composition !== null)
    fail('CLASSIC_STRICT_PROFILE', 'strict/composition inputs require their independently admitted public profile', source);
  return { multiProject: value.multiProject, formalSemantics: value.formalSemantics, strictInput: null, composition: null };
}
