// rules.mjs — pure helpers ported from the production rules_domain_gen pipeline
// (knowledge_base/design_docs/field_template/tools/{patch_core,emit_when}.mjs). These implement the
// SEMANTIC discovery that shapes the rules face: a command's `toParam` field set+order is a union
// discovered over (1) the machineSpec var-refs of the COMMAND_PRECONDITION rules attributed to the
// command (walked in declared param order), plus triggeredBy, then (2) the ④-layer behaviorModel
// emission bindings and emitWhen cond refs (in binding insertion order). This is NOT the declared
// param order — see EP_Truthsrc_Codegen_V04 V4-3 for the mechanical proof.

// Scala keywords that must be back-quoted when used as a field name (patch_core SCALA_KW).
const SCALA_KW = new Set(['type', 'class', 'object', 'def', 'val', 'var', 'if', 'else', 'for', 'while',
  'import', 'package', 'match', 'case', 'extends', 'trait', 'with', 'return', 'null', 'true', 'false',
  'new', 'this', 'super', 'private', 'protected', 'sealed', 'abstract', 'final', 'implicit', 'lazy',
  'override', 'try', 'catch', 'finally', 'throw', 'yield', 'do', 'then', 'elseif']);
export const scalaRef = (f) => (SCALA_KW.has(f) ? `\`${f}\`` : f);

// collectVarRefs — gather every {var}/{vars}/dotted {target} leaf from a machineSpec expression.
export function collectVarRefs(expr, out = new Set()) {
  if (typeof expr === 'string' || expr === null || expr === undefined) return out;
  if (Array.isArray(expr)) { expr.forEach((x) => collectVarRefs(x, out)); return out; }
  for (const [k, v] of Object.entries(expr)) {
    if (k === 'var') { out.add(v); continue; }
    if (k === 'vars') { v.forEach((x) => out.add(x)); continue; }
    if (k === 'target' && typeof v === 'string' && v.includes('.')) { out.add(v); continue; }
    collectVarRefs(v, out);
  }
  return out;
}

// inputFieldOf — the backtick field named just before 「必须为…之一」 in a rule's humanDescription,
// else the first backtick field (patch_core.inputFieldOf).
export function inputFieldOf(desc) {
  if (!desc) return null;
  const idx = desc.indexOf('必须为');
  if (idx >= 0) {
    const m = desc.slice(0, idx).match(/`([^`]+)`[^`]*$/);
    if (m) return m[1];
  }
  return desc.match(/`([^`]+)`/)?.[1] || null;
}

// normalizeEmitWhen — decision.emitWhen → [{cond, events:[{event,bindings,forEach?}]}] (emit_when).
export function normalizeEmitWhen(decision) {
  if (!decision || decision.emitWhen === undefined) return [];
  if (!Array.isArray(decision.emitWhen)) throw new Error('emitWhen must be an array');
  return decision.emitWhen.map((br, i) => {
    if (!br || typeof br !== 'object' || !br.cond || typeof br.cond !== 'object') {
      throw new Error(`emitWhen[${i}].cond missing`);
    }
    if (!Array.isArray(br.events) || !br.events.length) throw new Error(`emitWhen[${i}].events empty`);
    const events = br.events.map((e) => ({ event: e.event, bindings: e.bindings || {}, ...(e.forEach ? { forEach: e.forEach } : {}) }));
    return { cond: br.cond, events };
  });
}

// condParamRefs — command params referenced by an emitWhen cond (host === cmdName) (emit_when).
export function condParamRefs(branches, cmdName) {
  const out = new Set();
  for (const br of branches || []) {
    for (const v of collectVarRefs(br.cond)) {
      const s = String(v).split('.');
      if (s.length === 2 && s[0] === cmdName) out.add(s[1]);
    }
  }
  return out;
}

// computeParamDefs — the toParam field list for one write command (rules_domain_gen lines 1042-1094,
// loops 1+2). `cmdName` = the command (var/cond host); `params` = command parameters in declared
// order; `rules` = attached preconditionRules [{expression, humanDescription}]; `bm` = attached
// behaviorModel.
// NOTE (inc6 scope): the policy-binding, event-same-name and lineage augmentation loops (lines
// 1096-1133+) are not ported yet — the metarch ModelCatalog corpus does not exercise them (verified:
// loops 1+2 reproduce all 9 CommandHelpers byte-for-byte). They land with the aggregates that need
// them.
export function computeParamDefs(cmdName, params, rules, bm) {
  const paramNames = params.map((p) => p.name);
  const has = (f) => paramNames.includes(f);
  const referenced = new Set();
  for (const rule of rules || []) {
    for (const vv of collectVarRefs(rule.expression)) {
      const s = String(vv).split('.');
      if (s.length === 2 && s[0] === cmdName) referenced.add(s[1]);
    }
    const inputField = inputFieldOf(rule.humanDescription);
    if (inputField) referenced.add(inputField);
  }
  const fields = [];
  for (const name of paramNames) if (referenced.has(name)) fields.push(name);
  if (!fields.includes('triggeredBy') && has('triggeredBy')) fields.push('triggeredBy');

  const add = (f) => { if (f && !fields.includes(f) && has(f)) fields.push(f); };
  const scanEmission = (em) => {
    const m = String(em.forEach || '').match(/^param\.([A-Za-z]\w*)$/);
    if (m) add(m[1]);
    for (const v of Object.values(em.bindings || {})) {
      const s = String(v);
      const pm = s.match(/^param\.([A-Za-z]\w*)/);
      if (pm) add(pm[1]);
      if (s.startsWith('expr:')) for (const mm of s.matchAll(/\bp\.([A-Za-z]\w*)/g)) add(mm[1]);
    }
  };
  if (bm) {
    if (Array.isArray(bm.emissions)) for (const em of bm.emissions) scanEmission(em);
    const ew = normalizeEmitWhen(bm);
    if (ew.length) {
      for (const f of condParamRefs(ew, cmdName)) add(f);
      for (const br of ew) for (const em of br.events) scanEmission(em);
    }
  }
  return fields;
}
