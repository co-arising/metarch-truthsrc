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

// computeParamDefs — the toParam field list for one write command (rules_domain_gen lines 1042-1108,
// loops 1+2 + the policy-binding loop). `cmdName` = the command (var/cond host); `params` = command
// parameters in declared order; `rules` = attached preconditionRules [{expression,
// humanDescription}]; `bm` = attached behaviorModel; `policyBound` = the command's policy-note
// `info.bindings` keys (the inc10 augment slot — the policy side of the paramDefs supply, source
// lines 1096-1108). The event-same-name and lineage loops (source lines 1116-1152) are separate
// whole-map passes — apply them via supplyEventSameName / supplyLineage after this map is built.
export function computeParamDefs(cmdName, params, rules, bm, policyBound) {
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
  // —— 策略 bindings 参数补给（#32 缺口①·策略侧对偶）：声明即权威——policy 便签 info.bindings
  //    引用的命令参数必须进 Params VO（否则策略 Runner 逐条投命令时拿不到分片键——
  //    `EstablishConcept.conceptId` 即此例）。
  for (const f of policyBound ?? []) add(f);
  return fields;
}

// cmdEventsOf — rules_domain_gen cmdEvents (lines 3249-3297), corpus-exercised legs: ④层
// emissions∪emitWhen authoritative (declared order, constant leg first), positive-case then.event
// fallback, FATAL otherwise. The CEM legs (L1 → 平行语义边救援 → L2) are not ported — the canonical
// carries no command→event-map face (Fork A); every corpus command resolves on the two ported legs.
export function cmdEventsOf(cmdName, { bmOf, aggCases, agg }) {
  const bm = bmOf(cmdName);
  const bmEw = bm ? normalizeEmitWhen(bm) : [];
  if (bm && ((Array.isArray(bm.emissions) && bm.emissions.length) || bmEw.length)) {
    return [...(Array.isArray(bm.emissions) ? bm.emissions.map((e) => e.event) : []), ...emitWhenEventNames(bmEw)];
  }
  const te = (aggCases ?? []).find((c) => c.command === cmdName && c.type === 'positive' && c.then?.event)?.then.event;
  if (te) return [te];
  throw new Error(`[FATAL] ${agg}.${cmdName}：缺 PRODUCES 绑定（无 ④层 emissions∪emitWhen 也无正例 then.event）`);
}

// supplyEventSameName — rules_domain_gen lines 1116-1129 verbatim（立项A·2026-09-28）：命令参数与
// **本命令产出事件**的载荷同名且类型一致时必须进 Params VO——否则 eventArgs 启发式落
// 「状态字段同名 → state.<f>」（factory 首 declare 时 state 恒空 ⇒ 载荷恒空）。ActorRef 参数不进
// 类型表（source filter）；查询碎片不进（无 Params VO——source 的 `queryFragments.has` continue，
// 等价面＝paramDefs 缺席即跳过）。`commands` = 类型判定视图（{name, params:[{name, type-sig}]}）。
export function supplyEventSameName(paramDefs, commands, eventsOf, eventByName) {
  for (const cmd of commands) {
    if (!paramDefs.has(cmd.name)) continue;
    const fields = paramDefs.get(cmd.name) || [];
    const cmdTypeOf = new Map(cmd.params.filter((p) => !String(p.type).startsWith('ActorRef[')).map((p) => [p.name, p.type]));
    for (const n of eventsOf(cmd.name)) {
      const ev = eventByName.get(n);
      if (!ev) continue;
      for (const ep of ev.params) {
        const pt = cmdTypeOf.get(ep.name);
        if (pt && pt === String(ep.type).trim() && !fields.includes(ep.name)) fields.push(ep.name);
      }
    }
    paramDefs.set(cmd.name, fields);
  }
}

// supplyLineage — rules_domain_gen lines 1131-1152 verbatim（2026-08-22）：事件载荷 lineageHint
// （`Cmd.field`，augment 阶段从 ④层 bindings 推导）把该命令参数拉进 Params VO——非标识符字段事件
// 构造用 p.<f>（启发式此前丢弃 → ""/state 默认）；标识符字段保持 state 构造。无查询碎片守卫——
// 碎片命令的提示算进 `paramDefs.get(cmd) || []` 的新数组且从不 set 回（源语义·字节级保真）。
export function supplyLineage(paramDefs, events, cmdByName, identifier) {
  for (const ev of events ?? []) {
    for (const p of ev.payloads ?? []) {
      const m = String(p.lineageHint ?? '').match(/^([A-Za-z]+)\.([A-Za-z]+)$/);
      if (!m) continue;
      const cmd = m[1], field = m[2];
      const cmdSig = cmdByName.get(cmd);
      if (!cmdSig) continue;
      const param = cmdSig.params.find((x) => x.name === field);
      if (!param || String(param.type).startsWith('ActorRef[')) continue;
      if (field === identifier) continue; // 标识符等价形态（state.<id> 构造）
      const fields = paramDefs.get(cmd) ?? [];
      if (!fields.includes(field)) fields.push(field);
    }
  }
}

// ── inc9 additions (rules_domain_gen / emit_when ports) ──────────────────────────────────────

// emitWhenEventNames — the conditional-leg event set in declaration order (emit_when.mjs).
export function emitWhenEventNames(branches) {
  return (branches || []).flatMap((b) => b.events.map((e) => e.event));
}

// condGuaranteedParams — params whose emitWhen conds carry notNull/notEmpty/in(/notIn) constraints
// (emit_when.mjs): the conditional leg only fires when the param is present, so the EVT
// conflict-detection counts it as guaranteed-non-null.
export function condGuaranteedParams(branches, cmdName) {
  const out = new Set();
  for (const br of branches || []) walkGuarantee(br.cond, cmdName, out);
  return out;
}
function walkGuarantee(expr, cmdName, out) {
  if (!expr || typeof expr !== 'object') return;
  if (Array.isArray(expr)) { expr.forEach((x) => walkGuarantee(x, cmdName, out)); return; }
  for (const [k, v] of Object.entries(expr)) {
    if (k === 'notNull' || k === 'notEmpty') {
      if (v && typeof v === 'object' && typeof v.var === 'string') addHosted(v.var, cmdName, out);
      continue;
    }
    if (k === 'in' || k === 'notIn') {
      if (Array.isArray(v) && v[0] && typeof v[0].var === 'string') addHosted(v[0].var, cmdName, out);
      continue;
    }
    walkGuarantee(v, cmdName, out);
  }
}
function addHosted(v, cmdName, out) {
  const s = String(v).split('.');
  if (s.length === 2 && s[0] === cmdName) out.add(s[1]);
}

// nonNullGuaranteed — rules-level guaranteed-non-null var set (rules_domain_gen lines 3311-3329):
// notNull/notEmpty/in/notIn constrained vars of the given rules (positive-case patching fills them
// with satisfying values, so event fields sourced from them are decidable non-null).
export function nonNullGuaranteed(rules) {
  const out = new Set();
  const walk = (expr) => {
    if (!expr || typeof expr !== 'object') return;
    if (Array.isArray(expr)) { expr.forEach(walk); return; }
    for (const [k, v] of Object.entries(expr)) {
      if (k === 'notNull' || k === 'notEmpty') {
        if (v && typeof v === 'object' && typeof v.var === 'string') out.add(v.var);
        continue;
      }
      if (k === 'in' || k === 'notIn') {
        if (Array.isArray(v) && v[0] && typeof v[0].var === 'string') out.add(v[0].var);
        continue;
      }
      walk(v);
    }
  };
  (rules || []).forEach((r) => walk(r.expression));
  return out;
}

// exprGuaranteesNonEmpty — event-construction arg expressions that are non-null by construction
// (rules_domain_gen lines 3300-3309): Instant.now() / non-empty literals; p.<f>/state.<f> refs are
// judged by the caller via the guarantee sets.
export function exprGuaranteesNonEmpty(expr) {
  if (!expr) return false;
  if (/^p\./.test(expr) || /^state\./.test(expr)) return true;
  if (/Instant\.now\(\)/.test(expr)) return true;
  if (/^"[^"]+"$/.test(expr) || /^-?\d+(\.\d+)?[Ld]?$/.test(expr) || /^Id\.of\(/.test(expr) || /^BigDecimal\(/.test(expr) || /^true$/.test(expr) || /^false$/.test(expr)) return true;
  return false;
}

// p4NormalizeCond — ③-layer cond-string null handling → Option combinators (rules_domain_gen
// lines 260-272). Only three exact shapes are rewritten; everything else passes through verbatim.
export function p4NormalizeCond(cond) {
  if (!cond || !cond.includes('null')) return cond;
  let out = cond;
  out = out.replace(/([A-Za-z][\w.`]*)\s*!=\s*null\s*&&\s*\1\.nonEmpty\b/g, 'Option($1).exists(_.nonEmpty)');
  out = out.replace(/([A-Za-z][\w.`]*)\s*!=\s*null/g, 'Option($1).isDefined');
  out = out.replace(/([A-Za-z][\w.`]*)\s*==\s*null/g, 'Option($1).isEmpty');
  return out;
}

// idempotencyExprOf — the ④-layer decision.idempotentOn payload/state equality short-circuit
// (rules_domain_gen lines 274-296). FATALs on真源 drift (field missing from params or state).
export function idempotencyExprOf(agg, cmdName, paramsName, stateTypes, evParams, bmDecision) {
  const d = bmDecision(cmdName); // truthsrc bmDecision is the one-arg closure (live's takes (agg, cmd))
  const fields = d && Array.isArray(d.idempotentOn) ? d.idempotentOn : null;
  if (!fields || !fields.length) return null;
  const conds = [];
  for (const f of fields) {
    if (!evParams.has(f)) throw new Error(`idempotentOn 字段 ${agg}.${cmdName}.${f} 不在命令参数（真源漂移·FATAL）`);
    if (stateTypes[f] === undefined) throw new Error(`idempotentOn 字段 ${agg}.${cmdName}.${f} 不在聚合状态（真源漂移·FATAL）`);
    const st = stateTypes[f];
    const pt = evParams.get(f).type;
    const pIsId = pt === 'Id' || String(pt).startsWith('Id');
    const sIsId = st === 'Id' || String(st).startsWith('Id');
    const pRef = `p.${scalaRef(f)}${(!sIsId && pIsId) ? '.toString' : ''}`;
    const sRef = `state.${scalaRef(f)}${(sIsId && !pIsId) ? '.toString' : ''}`;
    if (/^List\[/.test(st)) conds.push(`Option(p.${scalaRef(f)}).getOrElse(Nil) == Option(state.${scalaRef(f)}).getOrElse(Nil)`);
    else conds.push(`${pRef} == ${sRef}`);
  }
  return `if (Option(state.status).exists(_.nonEmpty) && ${conds.join(' && ')}) return Right(Nil)`;
}

// 裁决⑤（2026-08-24）创建族白名单 + 时间戳门字段 — generator-side authority tables (rules_domain_gen
// lines 1471-1510, mirrored verbatim from the ingested-app hand-patch configs). Aggregates absent
// from INITIAL get an empty whitelist; the TS-field table backs aggregates without a status field.
export const RULING5_INITIAL = {
  Concept: ['EstablishConcept'], Context: ['DiscoverContext'], ContextRelation: ['DefineContextRelation'],
  DoR: ['RequestDoR'], KnowledgePatch: ['SubmitKnowledgePatch'], ModelCatalog: ['CreateCatalogVersion'],
  Note: ['CaptureNote'], OrganizationMember: ['InviteTenantMember'], Project: ['InitiateProject'],
  Question: ['RaiseQuestion'], Relation: ['RelateConcept'], Session: ['OpenSession'],
  Stage: ['ActivateStage'], Subdomain: ['ClassifySubdomain'], Tenant: ['OnboardTenant'],
  User: ['RegisterUser'], Workshop: ['ScheduleWorkshop'], Workgroup: ['CreateWorkgroup'],
  FieldModelDefinition: ['DeclareFieldModel', 'DeclareStateField', 'AddWrittenBy', 'ReplaceWrittenBy', 'CutWrittenBy',
    'DeclareCommand', 'AddCommandParameter', 'DeclareEvent', 'AddEventPayload', 'PatchAggregateStatus',
    'DeclareRelation', 'DeclareStateGate', 'RenameDescription',
    'RemoveStateField', 'RemoveCommand', 'RemoveEvent', 'RemoveRelation', 'RemoveStateGate', 'RemoveFieldModel'],
  CemEdge: ['DeclareEdge', 'PatchEdge', 'RetireEdge'],
  ReadModelDefinition: ['DeclareReadModel', 'PatchReadModelField', 'RemoveReadModel'],
  RoleCommandBinding: ['BindCommand', 'UnbindCommand'],
  ValueObjectDefinition: ['DeclareValueObject', 'RemoveValueObject'],
  TruthSourceProvenance: ['RecordTruthProvenance'],
  UseCaseDefinition: ['DeclareUseCaseDefinition', 'RemoveUseCaseDefinition'],
  FsmDefinition: ['ProposeFsmDefinition'],
};
export const RULING5_TS_FIELD = { Context: 'discoveredAt', Relation: 'createdAt', ContextRelation: 'createdAt', Subdomain: 'classifiedAt',
  FieldModelDefinition: 'declaredAt', ReadModelDefinition: 'declaredAt', ValueObjectDefinition: 'declaredAt', TruthSourceProvenance: 'recordedAt', UseCaseDefinition: 'declaredAt' };
