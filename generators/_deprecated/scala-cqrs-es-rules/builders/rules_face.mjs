// rules_face.mjs — the Rules + RulesSpec model builders (V4-3 inc9), ported from the production
// rules_domain_gen per-aggregate pipeline (lines 972-1920 + assembly 2670-2761). Inputs come from
// the canonical's rules-face slots (Fork A raw): per-command preconditionRules + the raw ④-layer
// behaviorModel decisions, aggregateRules / eventPostconditions / executableCases attached by
// tools/augment-rules-canonical.mjs. V4-6: the event-same-name (1116-1129) and lineage (1131-1152)
// param-supply loops are ported (payload lineageHint is derived onto the canonical at augment
// time, source lines 444-462). NOT ported (unexercised by the corpus): the cem command→event
// fallback legs (④-layer emissions are authoritative here) and the statusEnum metaJson fallback
// of statusFallback (the aggregate-status `in` rule covers it).
import { scalaSig, sigOf } from './datatype.mjs';
import { PLACEHOLDER, gtNowFields, exprToScala, patchForCases } from './expr.mjs';
import {
  computeParamDefs, normalizeEmitWhen, emitWhenEventNames, condGuaranteedParams, nonNullGuaranteed,
  exprGuaranteesNonEmpty, p4NormalizeCond, idempotencyExprOf, RULING5_INITIAL, RULING5_TS_FIELD, scalaRef, inputFieldOf,
  cmdEventsOf, supplyEventSameName, supplyLineage,
} from './rules.mjs';
import { makeLiterals } from './literals.mjs';


function noteAnchor(noteId, elementHashes, indent = '') {
  if (!noteId) return '';
  const clean = String(noteId).replace(/["'\n\r]/g, '');
  const h = elementHashes?.[clean];
  return `${indent}// @knowledge ${clean}${h ? '@' + h : ''}\n`;
}

// S2-98 PORT_VALUE_TYPES — delegation signatures FQ-qualify these domain values (rules_domain_gen line 350).
const PORT_VALUE_TYPES = ['ConceptDelta', 'ConceptIndexEntry', 'CatalogConflict', 'RelationDelta'];
const fqQualifySig = (s) => String(s).replace(/(?<![\w.])(ConceptDelta|ConceptIndexEntry|CatalogConflict|RelationDelta)\b/g, 'net.imadz.metarch.domain.values.$1');

export function rulesFaceModel(a, env) {
  const agg = a.name;
  const elementHashes = env.elementHashes;
  const voByName = new Map((env.voSigs ?? []).map((s) => [s.name, s]));
  const { UUID_RE, defaultLiteral, optionInnerDefault, nonNullLiteral, literalFor } = makeLiterals(voByName);

  // —— signatures from the canonical (rules_domain_gen parses the target repo; here the canonical
  //    IS the signature source — dataType → scalaSig mirrors AssemblyEngine's DataTypeMapper) ——
  // State authority = the EMITTED state, not the raw canonical: rules_domain_gen reads its
  // stateFields set from the skeleton pass's generated Entity signature (rules_domain_gen.mjs
  // 974-992), so a nature-excluded field (credential → not in the emitted UserState) is
  // unresolved for rule translation (coexist on it → untranslatable → rule skipped). Applying
  // the same exclusion here is the truthsrc equivalent of that cross-face file coupling.
  const excludedNatures = new Set(env.excludedStateFieldNatures ?? []);
  const stateParams = (a.stateFields ?? [])
    .filter((f) => !(f.nature && excludedNatures.has(f.nature)))
    .map((f) => ({ name: f.name, type: scalaSig(f.dataType ?? 'String') }));
  const stateFields = new Set(stateParams.map((p) => p.name));
  const stateTypes = Object.fromEntries(stateParams.map((p) => [p.name, p.type]));
  const eventSigs = (a.events ?? []).map((e) => ({
    name: e.name,
    params: (e.payloads ?? []).map((p) => ({ name: p.name, type: sigOf(p), lineageHint: p.lineageHint })),
  }));
  const eventByName = new Map(eventSigs.map((e) => [e.name, e]));
  const commands = (a.commands ?? []).map((c) => ({
    name: c.name,
    noteId: c.noteId ?? null,
    readOnly: c.readOnly === true,
    params: (c.parameters ?? []).map((p) => ({ name: p.name, type: sigOf(p) })),
    behaviorModel: c.behaviorModel ?? null,
    preconditionRules: c.preconditionRules ?? [],
  }));
  const cmdByName = new Map(commands.map((c) => [c.name, c]));

  const aggCases = a.executableCases ?? [];
  const aggRules = (a.aggregateRules ?? []).slice();
  const cmdRules = new Map();
  for (const c of commands) if (c.preconditionRules.length) cmdRules.set(c.name, c.preconditionRules);
  const evtRules = (a.eventPostconditions ?? []).slice();

  // ruleTargetId — rule id → note anchor noteId (raw `noteId` slot = definedIn.targetId). The
  // attributed rules seed it; the library-wide slice (augment ruleAnchor.ids) completes it — the
  // source registers ruleTargetId for EVERY library rule with target+id (line 99), so a rule
  // rendered through a ④层 guard ref without cases (IR-USER-CMD-002) still anchors inline.
  const ruleTargetId = new Map();
  for (const [rid, nid] of Object.entries(a.ruleAnchor?.ids ?? {})) ruleTargetId.set(rid, nid);
  for (const r of [...aggRules, ...evtRules, ...[...cmdRules.values()].flat()]) {
    if (r.noteId) ruleTargetId.set(r.id, r.noteId);
  }

  // —— ext-port registry (canonical.ports carries the full declaration face from functions.yaml) ——
  const portByMember = new Map((a.ports ?? []).map((p) => [p.member, p]));
  const portByTraitFq = new Map((a.ports ?? []).map((p) => [`${p.fqPkg}.${p.trait}`, p]));
  const portImplVal = (mem) => {
    const pb = portByMember.get(mem);
    const traitFq = `${pb.fqPkg}.${pb.trait}`;
    const pd = pb.methods ? { methods: pb.methods, bridge: pb.bridgeFq ? { fq: pb.bridgeFq } : null } : null;
    if (pd && pd.bridge && pd.bridge.fq === pb.implFq) {
      return `  private val ${mem}Impl: ${traitFq} = ${pb.implFq}`;
    }
    if (pd && Array.isArray(pd.methods) && pd.methods.length) {
      const implKind = pb.implKind;
      if (implKind === 'class') {
        return `  // ${pb.implFq.split('.').pop()} 是 class（ext 手写区·implements port trait）——直接实例化（真源 implKind 声明·批次 3 判例）
  private val ${mem}Impl: ${traitFq} = new ${pb.implFq}`;
      }
      const implShort = pb.implFq.split('.').pop();
      const delegations = pd.methods.map((m) => {
        const sig = String(m.sig);
        const nm = (sig.match(/def (\w+)\(/) || [])[1];
        const body = (sig.match(/\((.*)\)\s*:/) || [])[1] || '';
        const args = body.split(',').map((x) => (x.split(':')[0] || '').trim()).filter(Boolean);
        const ret = sig.slice(sig.lastIndexOf(':') + 1).trim();
        return `      def ${nm}(${fqQualifySig(body)}): ${fqQualifySig(ret)} =\n        ${pb.implFq}.${nm}(${args.join(', ')})`;
      }).join('\n');
      return `  // ${implShort} 是 object（纯函数域服务）——适配 port trait（债④闭包形·测试直供）
  private val ${mem}Impl: ${traitFq} =
    new ${traitFq} {
${delegations}
    }`;
    }
    return `  private val ${mem}Impl = new ${pb.implFq}`; // ports: 声明缺失——旧形（fail-closed·编译错可见）
  };

  // bmDecision — the command's raw ④-layer decision (attached on the command by augment)
  const bmDecision = (cmdName) => cmdByName.get(cmdName)?.behaviorModel ?? null;

  // —— 查询碎片识别（rules_domain_gen lines 1032-1039；cem 腿缺省＝canonical 无 command→event 边面） ——
  const queryFragments = new Set();
  for (const cmd of commands) {
    const bm = bmDecision(cmd.name);
    const bmEm = ((bm?.emissions ?? []).length > 0) || normalizeEmitWhen(bm ?? {}).length > 0;
    if (!bmEm && !aggCases.some((c) => c.command === cmd.name) && !(cmdRules.get(cmd.name) || []).length) {
      queryFragments.add(cmd.name);
    }
  }

  // —— Params VO 字段（loops 1+2+④层＋policy 绑定腿 via computeParamDefs；再接事件同名（1116-1129）
  //    ＋血缘（1131-1152）两补给环——血缘提示由 augment 从 ④层 bindings 推导落 canonical 载荷） ——
  const policyBound = new Map();
  for (const p of a.policies ?? []) {
    const set = policyBound.get(p.cmdName) || new Set();
    for (const k of Object.keys(p.bindings ?? {})) set.add(k);
    policyBound.set(p.cmdName, set);
  }
  const paramDefs = new Map();
  for (const cmd of commands) {
    if (queryFragments.has(cmd.name)) continue;
    paramDefs.set(cmd.name, computeParamDefs(cmd.name, cmd.params, cmdRules.get(cmd.name) || [], cmd.behaviorModel, policyBound.get(cmd.name)));
  }
  supplyEventSameName(paramDefs, commands, (n) => cmdEvents(n), eventByName);
  supplyLineage(paramDefs, eventSigs, cmdByName, a.identifier);

  // —— cmd→event 边（rules_domain_gen cmdEvents：④层权威腿＋正例 then.event 兜底；CEM 三腿未移植） ——
  function cmdEvents(cmdName) {
    return cmdEventsOf(cmdName, { bmOf: bmDecision, aggCases, agg });
  }

  // —— 事件构造参数映射（rules_domain_gen eventArgs，lines 1155-1263 逐字） ——
  function eventArgs(evName, cmdName) {
    const ev = eventByName.get(evName);
    if (!ev) return { args: [], ok: false, why: `事件 ${evName} 签名缺失` };
    const paramsFields = new Set(paramDefs.get(cmdName) || []);
    const bm = bmDecision(cmdName);
    const bmAllEmissions = bm ? [
      ...(Array.isArray(bm.emissions) ? bm.emissions : []),
      ...normalizeEmitWhen(bm).flatMap((b) => b.events),
    ] : [];
    const bmEmission = bmAllEmissions.length ? (bmAllEmissions.find((e) => e.event === evName) || null) : null;
    const bmBindings = bmEmission ? bmEmission.bindings : null;
    const args = ev.params.map((ep) => {
      const t = ep.type.trim();
      // 版本参数优先：state.version 计数器凌驾 ④层 literal（回填占位非作者意图）
      if (stateTypes.version !== undefined && (t === 'Int' || t === 'Long') && (ep.name === 'lastVersion' || ep.name === 'newVersion')) {
        return { expr: ep.name === 'lastVersion' ? 'state.version' : 'state.version + 1', type: t, name: ep.name, via: '版本参数（state.version 计数）' };
      }
      // ④层 bindings 四源标注（param/state/system/literal/expr/item）——保守精确模式
      if (bmBindings && bmBindings[ep.name] !== undefined) {
        const b = String(bmBindings[ep.name]).trim();
        const pure = (s) => { const i = s.search(/[\u4e00-\u9fff（）]/); return i < 0 ? s : s.slice(0, i).trim(); };
        if (b === 'item') return { expr: 'item', type: t, name: ep.name, via: '④层forEach' };
        if (b.startsWith('item.')) { const f = pure(b.slice(5)); if (f) return { expr: `item.${scalaRef(f)}`, type: t, name: ep.name, via: '④层forEach' }; }
        if (b.startsWith('expr:')) {
          const raw = pure(b.slice(5));
          if (raw) {
            const sm = raw.match(/^p\.([A-Za-z]\w*)(\.toString)?$/);
            if (sm) return { expr: `p.${scalaRef(sm[1])}${sm[2] || ''}`, type: t, name: ep.name, via: '④层expr' };
            return { expr: raw, type: t, name: ep.name, via: '④层expr' };
          }
        }
        if (b.startsWith('param.')) {
          const f = pure(b.slice(6));
          if (f) {
            const pt0 = (cmdByName.get(cmdName)?.params.find((x) => x.name === f)?.type || '').trim();
            const om = pt0.match(/^Option\[(.+)\]$/);
            if (om && t === om[1]) return { expr: `p.${scalaRef(f)}.getOrElse(${optionInnerDefault(om[1])})`, type: t, name: ep.name, via: '④层param·Option交叉' };
            if (t === `Option[${pt0}]`) return { expr: `Some(p.${scalaRef(f)})`, type: t, name: ep.name, via: '④层param·Option交叉' };
            return { expr: `p.${scalaRef(f)}`, type: t, name: ep.name, via: '④层' };
          }
        }
        else if (b.startsWith('state.')) { const f = pure(b.slice(6)); if (f) return { expr: `state.${scalaRef(f)}`, type: t, name: ep.name, via: '④层' }; }
        else if (/^system:/.test(b) && b.includes('now')) return { expr: 'Instant.now()', type: t, name: ep.name, via: '④层' };
        else if (b.startsWith('literal:')) {
          let raw = pure(b.slice(8));
          if (b === 'literal:""') raw = '';
          if (raw !== undefined && (raw !== '' || b === 'literal:""')) {
            if (raw === '' && t === 'String') return { expr: '""', type: t, name: ep.name, via: '④层' };
            if (raw === 'MISSING_REF' && (t === 'Id' || t.startsWith('Id'))) return { expr: 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")', type: t, name: ep.name, via: '④层' };
            if (raw === 'Nil' && (t.startsWith('List[') || t === 'List')) return { expr: 'Nil', type: t, name: ep.name, via: '④层' };
            if (/^-?\d+$/.test(raw) && (t === 'Int' || t === 'Long' || t === 'Integer')) return { expr: raw, type: t, name: ep.name, via: '④层' };
            if (/^(true|false)$/.test(raw) && (t === 'Boolean')) return { expr: raw, type: t, name: ep.name, via: '④层' };
            if (t === 'String') return { expr: `"${raw}"`, type: t, name: ep.name, via: '④层' };
          }
        }
      }
      if (ep.name === 'triggeredBy') return { expr: 'p.triggeredBy', type: t, name: ep.name };
      if (paramsFields.has(ep.name)) {
        const pt = (cmdByName.get(cmdName)?.params.find((x) => x.name === ep.name)?.type || '').trim();
        if (pt === t) return { expr: `p.${scalaRef(ep.name)}`, type: t, name: ep.name };
        {
          const om = pt.match(/^Option\[(.+)\]$/);
          if (om && t === om[1]) return { expr: `p.${scalaRef(ep.name)}.getOrElse(${optionInnerDefault(om[1])})`, type: t, name: ep.name, via: 'Option交叉' };
          if (t === `Option[${pt}]`) return { expr: `Some(p.${scalaRef(ep.name)})`, type: t, name: ep.name, via: 'Option交叉' };
        }
        if (t === 'String' && pt === 'Id') return { expr: `p.${scalaRef(ep.name)}.toString`, type: t, name: ep.name };
        if (t.startsWith('List[') && pt === t.replace(/^List\[/, '').replace(/\]$/, '')) return { expr: `List(p.${scalaRef(ep.name)})`, type: t, name: ep.name };
      }
      if (t.startsWith('Instant') || t.endsWith('Instant')) return { expr: 'Instant.now()', type: t, name: ep.name };
      if (stateTypes[ep.name] !== undefined) {
        const st = stateTypes[ep.name];
        if (st === t) return { expr: `state.${scalaRef(ep.name)}`, type: t, name: ep.name };
        if (t === 'String' && st === 'Id') return { expr: `state.${scalaRef(ep.name)}.toString`, type: t, name: ep.name };
        return { expr: `state.${scalaRef(ep.name)}`, type: t, name: ep.name };
      }
      if (ep.name === 'changedFields' && (t === 'List[String]' || t === 'List' || t === 'List<...>')) {
        if (stateTypes.changedFields !== undefined) return { expr: 'state.changedFields', type: 'List[String]', name: ep.name, via: '变更字段（state.changedFields）' };
        return { expr: 'Nil', type: 'List[String]', name: ep.name, via: '变更字段（无消费方·空表）' };
      }
      return { expr: defaultLiteral(t), type: t, name: ep.name };
    });
    return { args, ok: true, why: '', forEach: (bmEmission && bmEmission.forEach) || null };
  }

  // —— 哨兵降级（不可翻译规则 → 负例哨兵判定；rules_domain_gen lines 1268-1286） ——
  function sentinelFallback(rule, cmdName, paramTypes) {
    const negs = aggCases.filter((c) => c.ruleId === rule.id && c.type === 'negative');
    const sents = [];
    for (const neg of negs) {
      for (const vv of collectRefsOf(rule)) {
        const s = String(vv).split('.');
        if (s.length !== 2 || s[0] !== cmdName) continue;
        const val = neg.when?.params?.[`${cmdName}.${s[1]}`];
        if (val !== undefined && !PLACEHOLDER.has(String(val)) && val !== null) sents.push({ field: s[1], val });
      }
    }
    if (!sents.length) return null;
    const validSents = sents.filter((x) => (paramDefs.get(cmdName) || []).includes(x.field));
    if (!validSents.length) return null;
    const failCond = validSents.map((x) => `p.${scalaRef(x.field)} == ${literalFor(x.val, paramTypes[x.field] || 'String')}`).join(' || ');
    return `!(${failCond})`;
  }
  function collectRefsOf(rule) {
    const out = new Set();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node.var === 'string') out.add(node.var);
      for (const v of Object.values(node)) walk(v);
    };
    walk(rule.expression);
    return out;
  }

  // —— 规则失败条件（命令级；rules_domain_gen cmdFailChecks lines 1287-1403） ——
  function cmdFailChecks(cmdName) {
    const cmd = cmdByName.get(cmdName);
    const paramTypes = Object.fromEntries((cmd?.params || []).map((p) => [p.name, p.type]));
    const bm = bmDecision(cmdName);
    if (bm && Array.isArray(bm.guards)) {
      if (bm.noCommandRules) {
        return { checks: [], skippedChecks: (cmdRules.get(cmdName) || []).map((r) => r.id) };
      }
      const guardRefs = bm.guards.filter((g) => g.kind === 'invariantRef' || g.errCode);
      if (guardRefs.length) {
        const checks = [];
        const skippedChecks = [];
        const matchedRuleIds = new Set();
        const sentinelUsed = new Set();
        for (const g of bm.guards) {
          if (g.kind === 'initialized') continue;
          if (g.kind === 'statusTransition') {
            const notList = Array.isArray(g.notStatus) ? g.notStatus : (g.notStatus ? [g.notStatus] : []);
            if (notList.length) {
              const errCode = g.errCode || `${agg.toUpperCase()}_TERMINAL`;
              if (!checks.some((c) => c.errCode === errCode)) {
                const cond = `Option(state.status).forall(x => !Set(${notList.map((f) => `"${f}"`).join(', ')}).contains(x))`;
                checks.push({ cond, errCode, desc: (g.note || `终态不可变更（${notList.join('/')}）`).replace(/\\/g, '\\\\').replace(/"/g, "'"), id: g.invariantRef || g.ref || `bm:st:not-${notList.join('-')}`, via: '④层' });
              }
            }
            if (g.from && g.from.length) {
              const cond = `Option(state.status).exists(x => Set(${g.from.map((f) => `"${f}"`).join(', ')}).contains(x))`;
              checks.push({ cond, errCode: g.errCode || `${agg.toUpperCase()}_STATUS_INVALID`, desc: (g.note || `状态须为 ${g.from.join('/')}`).replace(/\\/g, '\\\\').replace(/"/g, "'"), id: g.invariantRef || g.ref || `bm:st:${g.toStatus || g.to}`, via: '④层' });
            }
            continue;
          }
          if (!g.errCode) continue;
          const rulesOf = (cmdRules.get(cmdName) || []);
          const rule = rulesOf.find((r) => r.id === g.ref) || rulesOf.find((r) => r.errorCode === g.errCode);
          if (rule) matchedRuleIds.add(rule.id);
          let cond = null;
          let desc = g.desc || '';
          if (rule) {
            const ctx0 = { stateFields, paramFields: new Set(paramDefs.get(cmdName) || []), stateTypes, paramTypes, aggName: agg, cmdName };
            const tr = exprToScala(rule.expression, { ...ctx0, inputField: inputFieldOf(rule.humanDescription) });
            if (tr) cond = tr.cond;
            const humanDesc = (rule.humanDescription || rule.name || rule.id).replace(/\\/g, '\\\\').replace(/"/g, "'");
            if (humanDesc) desc = humanDesc;
          }
          if (!cond && g.cond) cond = g.cond;
          if (cond) cond = p4NormalizeCond(cond);
          if (!cond) {
            if (rule) {
              cond = sentinelFallback(rule, cmdName, paramTypes);
              if (cond) sentinelUsed.add(`${agg}.${cmdName}:${rule.id}`);
            }
          }
          if (!cond) { skippedChecks.push(g.ref || g.errCode); continue; }
          if (!desc) desc = (g.desc || g.ref || g.errCode).replace(/\\/g, '\\\\').replace(/"/g, "'");
          checks.push({ cond, errCode: g.errCode, desc, id: g.ref || `bm:${g.errCode}`, via: '④层', degraded: sentinelUsed.has(`${agg}.${cmdName}:${rule?.id}`) ? '哨兵判定（不可翻译·④层降级）' : null });
        }
        for (const r of (cmdRules.get(cmdName) || [])) {
          if (!matchedRuleIds.has(r.id)) skippedChecks.push(r.id);
        }
        return { checks, skippedChecks };
      }
    }
    // 降级：规则库启发式推导（sorted by id·localeCompare）
    const rules = (cmdRules.get(cmdName) || []).slice().sort((x, y) => x.id.localeCompare(y.id));
    const ctx = { stateFields, paramFields: new Set(paramDefs.get(cmdName) || []), stateTypes, paramTypes, aggName: agg, cmdName };
    const checks = [];
    const skippedChecks = [];
    for (const rule of rules) {
      const inputField = inputFieldOf(rule.humanDescription);
      const tr = exprToScala(rule.expression, { ...ctx, inputField });
      const errCode = rule.errorCode || 'RULE_VIOLATED';
      const desc = (rule.humanDescription || rule.name || rule.id).replace(/\\/g, '\\\\').replace(/"/g, "'");
      if (!tr) {
        const cond = sentinelFallback(rule, cmdName, paramTypes);
        if (cond) {
          checks.push({ cond, errCode, desc, id: rule.id, degraded: '哨兵判定（不可翻译）' });
        } else {
          skippedChecks.push(rule.id);
        }
        continue;
      }
      checks.push({ cond: tr.cond, errCode, desc, id: rule.id, degraded: tr.degraded });
    }
    return { checks, skippedChecks };
  }

  // —— 聚合级失败条件（rules_domain_gen aggFailChecks lines 1406-1423） ——
  function aggFailChecks() {
    const ctx = { stateFields, paramFields: new Set(), stateTypes, paramTypes: {}, aggName: agg, cmdName: null };
    const checks = [];
    const skippedChecks = [];
    for (const rule of aggRules) {
      const inputField = inputFieldOf(rule.humanDescription);
      const tr = exprToScala(rule.expression, { ...ctx, inputField });
      const errCode = rule.errorCode || 'RULE_VIOLATED';
      const desc = (rule.humanDescription || rule.name || rule.id).replace(/\\/g, '\\\\').replace(/"/g, "'");
      if (!tr) {
        skippedChecks.push(rule.id);
        continue;
      }
      checks.push({ cond: tr.cond, errCode, desc, id: rule.id, degraded: tr.degraded });
    }
    return { checks, skippedChecks };
  }

  // —— 裁决⑤门卫表 ——
  const r5Initial = RULING5_INITIAL[agg] || [];
  const r5Gate = stateFields.has('status')
    ? 'Option(state.status).forall(_.isEmpty)'
    : (RULING5_TS_FIELD[agg] ? `Option(state.${RULING5_TS_FIELD[agg]}).isEmpty` : 'Option(state.status).forall(_.isEmpty)');

  // —— rulesBody（rules_domain_gen lines 1515-1758 逐字） ——
  const aggPortTraits = new Set();
  // fold-face ports (EventHandler fn: verbs with Access-gate callExprs) join the IMPORT face only
  // — rulesPortTraits (Rule class constructors / Behaviors apply / Spec Impl vals) stays
  // expression-driven (rules_domain_gen's second aggPortTraits.add at the fold fn: branch).
  for (const p of a.foldPorts ?? []) aggPortTraits.add(`${p.fqPkg}.${p.trait}`);
  const rulesPortTraits = new Set();
  const portRuleCmds = new Set();
  const portMembersOfAgg = () => [...aggPortTraits].sort().map((fq) => portByTraitFq.get(fq)?.member).filter(Boolean);
  const portMembersOfRules = () => [...rulesPortTraits].sort().map((fq) => portByTraitFq.get(fq)?.member).filter(Boolean);
  const rulesBody = [];
  rulesBody.push(`  private def err(code: String, msg: String): Left[iMadzError, List[${agg}Event]] =`);
  rulesBody.push(`    Left(iMadzError(code, msg))`);
  rulesBody.push('');
  rulesBody.push(`  private def notNull(v: String): Boolean = Option(v).exists(_.nonEmpty)`);
  rulesBody.push(`  private def isMissingRef(v: String): Boolean = Option(v).isEmpty || v == "MISSING_REF" || v == "__OTHER__"`);
  rulesBody.push(`  private def isMissingRef(v: Any): Boolean = Option(v).isEmpty`);
  rulesBody.push('');
  rulesBody.push('  // 聚合级共享校验（AGGREGATE_INVARIANT，先于命令级执行）');
  rulesBody.push('  // 创建族白名单（裁决⑤）：仅这些命令可作用于未初始化实体');
  rulesBody.push(`  private val InitialCommands: Set[String] = Set(${r5Initial.map((x) => `"${x}"`).join(', ')})`);
  rulesBody.push(`  private def checkAggregate(state: ${agg}State, cmd: String): Option[Left[iMadzError, List[${agg}Event]]] =`);
  rulesBody.push('    // S2-8 初始化门卫（2026-08-23 拍板）+ 裁决⑤(2026-08-24)：非创建族拒绝空实体');
  rulesBody.push(`    if (${r5Gate})`);
  rulesBody.push('      if (InitialCommands.contains(cmd)) None else Some(err("AGG_NOT_INITIALIZED", cmd + " 拒绝：聚合尚未初始化"))');
  const aggCtx = aggFailChecks();
  for (const c of aggCtx.checks) {
    rulesBody.push(`${noteAnchor(ruleTargetId.get(c.id), elementHashes, '    ')}    // ${c.id}${c.degraded ? `（${c.degraded}）` : ''}`);
    rulesBody.push(`    else if (!(${c.cond})) Some(err("${c.errCode}", "${c.desc}"))`);
  }
  if (!aggCtx.checks.length) rulesBody.push(`    // （无聚合级规则）`);
  rulesBody.push('    else None');
  rulesBody.push('');

  for (const cmd of commands) {
    if (queryFragments.has(cmd.name)) continue;
    const { checks } = cmdFailChecks(cmd.name);
    const paramsName = `${cmd.name}Params`;
    const evNames = cmdEvents(cmd.name);
    const evs = evNames.map((n) => ({ name: n, ...eventArgs(n, cmd.name) }));
    const bmDec = bmDecision(cmd.name);
    const ewBranches0 = bmDec ? normalizeEmitWhen(bmDec) : [];
    const portRefs = new Set();
    {
      const walkNode = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walkNode); return; }
        if (typeof node.expr === 'string') scanExpr(node.expr);
        for (const v of Object.values(node)) walkNode(v);
      };
      const scanExpr = (s) => { for (const pb of portByMember.values()) if (String(s).includes(`${pb.member}.`)) portRefs.add(pb.member); };
      for (const br of ewBranches0) { walkNode(br.cond); for (const em of br.events) for (const v of Object.values(em.bindings || {})) if (String(v).startsWith('expr:')) scanExpr(String(v).slice(5)); }
      if (bmDec && Array.isArray(bmDec.emissions)) for (const em of bmDec.emissions) for (const v of Object.values(em.bindings || {})) if (String(v).startsWith('expr:')) scanExpr(String(v).slice(5));
    }
    const portParams = [...portRefs].sort().map((mem) => { const pb = portByMember.get(mem); return { member: mem, trait: pb.trait, fqPkg: pb.fqPkg }; });
    if (portParams.length) portParams.forEach((p) => { const fq = `${p.fqPkg}.${p.trait}`; aggPortTraits.add(fq); rulesPortTraits.add(fq); });
    if (portParams.length) portRuleCmds.add(cmd.name);
    const ruleDecl = portParams.length
      ? `class ${cmd.name}Rule(${portParams.map((p) => `${p.member}: ${p.trait}`).join(', ')}) extends InvariantRule[${agg}Event, ${agg}State, ${paramsName}] {`
      : `object ${cmd.name}Rule extends InvariantRule[${agg}Event, ${agg}State, ${paramsName}] {`;
    rulesBody.push(`${noteAnchor(cmd.noteId, elementHashes, '  ')}  ${ruleDecl}`);
    rulesBody.push(`    def apply(state: ${agg}State, p: ${paramsName}): Either[iMadzError, List[${agg}Event]] =`);
    rulesBody.push(`      checkAggregate(state, "${cmd.name}").getOrElse {`);
    let firstCmd = true;
    for (const c of checks) {
      rulesBody.push(`${noteAnchor(ruleTargetId.get(c.id), elementHashes, '      ')}      // ${c.id}${c.degraded ? `（${c.degraded}）` : ''}`);
      rulesBody.push(`      ${firstCmd ? '' : 'else '}if (!(${c.cond})) err("${c.errCode}", "${c.desc}")`);
      firstCmd = false;
    }
    if (!checks.length) rulesBody.push(`      // （无命令级规则）`);
    const idem = idempotencyExprOf(agg, cmd.name, paramsName, stateTypes, new Map((cmd.params || []).map((p) => [p.name, p])), bmDecision);
    if (idem) rulesBody.push(`      // 幂等（④层 idempotentOn）：载荷与 state 全等 ⇒ 无事件（外部系统重复同步同键同实体）`);
    if (idem) rulesBody.push(`      else ${idem.replace(/^if \((.*)\) return Right\(Nil\)$/, 'if ($1) Right(Nil)')}`);
    const evFail = evs.filter((e) => !e.ok);
    if (!evs.length || evFail.length) {
      rulesBody.push(`      // [GEN-SKIP] 事件构造失败：${[...evFail.map((e) => `${e.name}（${e.why}）`), ...(!evs.length ? ['无事件绑定'] : [])].join('；')}`);
      rulesBody.push(`      else Left(iMadzError("GEN_SKIPPED", "${cmd.name} 事件构造未生成"))`);
    } else {
      const ewBranches = ewBranches0;
      const evCall = (e) => `${e.name}(${e.args.map((x) => x.expr).join(', ')})`;
      const listExprOf = (evsList) => {
        const fe = evsList.filter((e) => !e.forEach);
        const fev = evsList.filter((e) => e.forEach);
        if (!fev.length) return `List(${evsList.map(evCall).join(', ')})`;
        const eachParts = fev.map((e) => {
          const fm = String(e.forEach).match(/^param\.([A-Za-z]\w*)$/);
          const listRef = fm ? `p.${scalaRef(fm[1])}` : 'Nil';
          return `${listRef}.map { item => ${evCall(e)} }`;
        });
        return `${fe.length ? `List(${fe.map(evCall).join(', ')})` : 'Nil'} ::: ${eachParts.join(' ::: ')}`;
      };
      if (!ewBranches.length) {
        const forEachEvs = evs.filter((e) => e.forEach);
        if (!forEachEvs.length) {
          rulesBody.push(`      ${firstCmd ? '' : 'else '}Right(List(${evs.map(evCall).join(', ')}))`);
        } else {
          rulesBody.push(`      // ④层 forEach（${forEachEvs.map((e) => e.forEach).join(', ')}）：批量发射`);
          rulesBody.push(`      ${firstCmd ? '' : 'else '}Right(${listExprOf(evs)})`);
        }
      } else {
        const ewNames = new Set(emitWhenEventNames(ewBranches));
        const fixedEvs = evs.filter((e) => !ewNames.has(e.name));
        const condCtx = {
          stateFields, paramFields: new Set(paramDefs.get(cmd.name) || []), stateTypes,
          paramTypes: Object.fromEntries((cmd.params || []).map((p) => [p.name, p.type])),
          aggName: agg, cmdName: cmd.name,
        };
        const branchParts = ewBranches.map((br) => {
          const tr = exprToScala(br.cond, condCtx);
          if (!tr || !tr.cond) throw new Error(`[FATAL] ${agg}.${cmd.name}：emitWhen cond 不可翻译（${JSON.stringify(br.cond).slice(0, 120)}）——宁红勿猜·请用 patch_core machineSpec.expression 词法`);
          const brEvs = br.events.map((e) => ({ name: e.event, ...eventArgs(e.event, cmd.name) }));
          const brFail = brEvs.filter((e) => !e.ok);
          if (brFail.length) throw new Error(`[FATAL] ${agg}.${cmd.name}：emitWhen 事件构造失败 ${brFail.map((e) => `${e.name}（${e.why}）`).join('；')}`);
          return `(if (${tr.cond}) ${listExprOf(brEvs)} else Nil)`;
        });
        rulesBody.push(`      // ④层 emitWhen（条件发射·S2-89 WP0）：${ewBranches.map((b) => JSON.stringify(b.cond).slice(0, 60)).join(' | ')}`);
        rulesBody.push(`      ${firstCmd ? '' : 'else '}Right(${fixedEvs.length ? listExprOf(fixedEvs) : 'Nil'} ::: ${branchParts.join(' ::: ')})`);
      }
    }
    rulesBody.push(`      }`);
    rulesBody.push(`  }`);
    rulesBody.push('');
  }

  // —— 事件后置校验（rules_domain_gen lines 1658-1757 逐字） ——
  const evtByEvent = new Map();
  const evtSkipped = [];
  for (const rule of evtRules) {
    const expr = rule.expression;
    const id = rule.id;
    if (!expr || typeof expr === 'string') { evtSkipped.push({ id, why: '无表达式' }); continue; }
    const refs = new Set();
    collectRefsOf2(expr, refs);
    const evHost = [...refs].map((x) => String(x).split('.')[0]).find((h) => eventByName.has(h));
    if (!evHost) { evtSkipped.push({ id, why: '宿主非本聚合事件' }); continue; }
    const evSig = eventByName.get(evHost);
    const ctx = {
      eventName: evHost,
      eventFields: new Set(evSig.params.map((p) => p.name)),
      eventTypes: Object.fromEntries(evSig.params.map((p) => [p.name, p.type])),
      stateFields: new Set(), stateTypes: {}, aggName: null, cmdName: null,
      voByName,
    };
    const tr = exprToScala(expr, ctx);
    const errCode = rule.errorCode || 'RULE_VIOLATED';
    const desc = (rule.humanDescription || rule.name || rule.id).replace(/\\/g, '\\\\').replace(/"/g, "'");
    if (!tr) { evtSkipped.push({ id, why: '不可翻译' }); continue; }
    if (!evtByEvent.has(evHost)) evtByEvent.set(evHost, []);
    const fields = [...refs].map((x) => String(x).split('.').slice(1).join('.'));
    evtByEvent.get(evHost).push({ cond: tr.cond, errCode, desc, id, degraded: tr.degraded, fields });
  }
  // Verbatim patch_core.collectVarRefs: `var` singular / `vars` array / `target` dotted. A lossy
  // walk drops IR-USER-EVT-003 (anyNotNull.vars) → its UserProfileUpdated key inserts late → the
  // checkEventPostconditions dispatch order diverges from the chain (UserRules 判例).
  function collectRefsOf2(expr, out) {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node.var === 'string') out.add(node.var);
      if (Array.isArray(node.vars)) for (const x of node.vars) if (typeof x === 'string') out.add(x);
      if (typeof node.target === 'string' && node.target.includes('.')) out.add(node.target);
      for (const v of Object.values(node)) walk(v);
    };
    walk(expr);
  }
  const paramGuar = new Map();
  for (const cmd of commands) paramGuar.set(cmd.name, new Set([
    ...nonNullGuaranteed(cmdRules.get(cmd.name) || []),
    ...(() => { const bmDec = bmDecision(cmd.name); return bmDec ? condGuaranteedParams(normalizeEmitWhen(bmDec), cmd.name) : new Set(); })(),
  ]));
  const aggGuar = nonNullGuaranteed(aggRules);
  const evtFinal = new Map();
  for (const [evName, checks] of evtByEvent) {
    const producers = commands.filter((c) => !queryFragments.has(c.name) && cmdEvents(c.name).includes(evName));
    const keep = [];
    for (const c of checks) {
      const conflicted = producers.some((cmd) => {
        const ev = eventArgs(evName, cmd.name);
        if (!ev.ok) return false;
        return c.fields.some((f) => {
          const first = f.split('.')[0];
          const arg = ev.args.find((x) => x.name === first);
          const argExpr = arg?.expr;
          if (!argExpr) return false;
          const argT = (arg.type || 'String').trim();
          const nullSemantics = argT === 'Id' || argT.startsWith('Option') || argT.startsWith('Instant') || argT.endsWith('Instant') || argT.startsWith('List[') || argT === 'List';
          const m1 = /^p\.([\w`]+)$/.exec(argExpr);
          if (m1) return nullSemantics ? false : !paramGuar.get(cmd.name)?.has(m1[1]);
          const m2 = /^state\.([\w`]+)$/.exec(argExpr);
          if (m2) return nullSemantics ? false : !aggGuar.has(m2[1]);
          return !exprGuaranteesNonEmpty(argExpr);
        });
      });
      if (conflicted) { evtSkipped.push({ id: c.id, why: '事件构造不保证（默认值冲突）' }); continue; }
      keep.push(c);
    }
    if (keep.length) evtFinal.set(evName, keep);
  }
  if (evtFinal.size) {
    const fnOf = (evName) => `firstBad${evName}`;
    rulesBody.push('  /** 事件后置校验（EVENT_POSTCONDITION）：命令产生的事件必须满足（Behaviors 经 withPost 挂点调用，2026-08-22） */');
    rulesBody.push(`  def checkEventPostconditions(events: List[${agg}Event]): Option[iMadzError] =`);
    rulesBody.push('    events.collect {');
    for (const [evName] of evtFinal) {
      rulesBody.push(`      case e: ${evName} => ${fnOf(evName)}(e)`);
    }
    rulesBody.push('    }.collectFirst { case Some(bad) => bad }');
    for (const [evName, checks] of evtFinal) {
      rulesBody.push('');
      rulesBody.push(`  private def ${fnOf(evName)}(e: ${evName}): Option[iMadzError] =`);
      let first = true;
      for (const c of checks) {
        rulesBody.push(`${noteAnchor(ruleTargetId.get(c.id), elementHashes, '    ')}    // ${c.id}${c.degraded ? `（${c.degraded}）` : ''}`);
        rulesBody.push(`    ${first ? '' : 'else '}if (!(${c.cond})) Some(iMadzError("${c.errCode}", "${c.desc}"))`);
        first = false;
      }
      rulesBody.push('    else None');
    }
    rulesBody.push('');
  }

  // —— 输出面（usedEvents / usedVOs / evImportList / valuesImport；rules_domain_gen lines 2670-2696） ——
  const usedEvents = new Set();
  for (const tc of aggCases) if (tc.then?.event) usedEvents.add(tc.then.event);
  for (const cmd of commands) {
    if (queryFragments.has(cmd.name)) continue;
    for (const ev of cmdEvents(cmd.name)) usedEvents.add(ev);
  }
  for (const evName of evtFinal.keys()) usedEvents.add(evName);
  const usedVOs = new Set();
  for (const ev of usedEvents) {
    const sig = eventByName.get(ev);
    for (const p of sig?.params || []) {
      const base = p.type.trim().replace(/^List\[/, '').replace(/\]$/, '').replace(/^Option\[/, '').replace(/\]$/, '');
      if (voByName.has(base)) usedVOs.add(base);
    }
  }
  for (const p of stateParams) {
    const base = String(p.type).trim().replace(/^List\[/, '').replace(/\]$/, '');
    if (voByName.has(base)) usedVOs.add(base);
  }
  const valuesImport = usedVOs.size ? 'import net.imadz.metarch.domain.values._\n' : '';
  const evImportList = [...usedEvents].sort().join(', ');

  // —— Spec（rules_domain_gen lines 1763-1920 逐字） ——
  const specTests = [];
  const usedTestNames = new Map();
  const cmdRuleIds = new Set([...cmdRules.values()].flat().map((r) => r.id));
  const aggRuleIds = new Set(aggRules.map((r) => r.id));
  const implRuleIds = new Set([...cmdRuleIds, ...aggRuleIds]);
  for (const tc of aggCases) {
    if (!implRuleIds.has(tc.ruleId)) {
      specTests.push(`    // [SKIP] ${tc.ruleId}（未实现规则，用例 ${tc.type}）`);
      continue;
    }
    const aggSkipped = aggFailChecks().skippedChecks;
    if (cmdFailChecks(tc.command).skippedChecks.includes(tc.ruleId) || aggSkipped.includes(tc.ruleId)) {
      specTests.push(`    // [SKIP] ${tc.ruleId}（规则检查未生成，用例 ${tc.type}）`);
      continue;
    }
    const cmd = cmdByName.get(tc.command);
    if (!cmd) { specTests.push(`    // [SKIP] 命令 ${tc.command} 签名缺失`); continue; }
    const paramsName = `${tc.command}Params`;
    const fields = paramDefs.get(tc.command) || [];
    const paramTypes = Object.fromEntries(cmd.params.filter((p) => !p.type.startsWith('ActorRef[')).map((p) => [p.name, p.type]));
    const stateMap = {};
    for (const p of stateParams) {
      stateMap[`${agg}.${p.name}`] = tc.given?.state?.[`${agg}.${p.name}`];
    }
    const paramMap = {};
    for (const f of fields) {
      paramMap[`${tc.command}.${f}`] = tc.when?.params?.[`${tc.command}.${f}`];
    }
    const gtNowFieldsSet = new Set();
    for (const r of [...aggRules, ...(cmdRules.get(tc.command) || [])]) {
      for (const f of gtNowFields(r.expression)) gtNowFieldsSet.add(f);
    }
    for (const f of gtNowFieldsSet) {
      const raw = tc.when?.params?.[`${tc.command}.${f}`];
      if (typeof raw === 'string') {
        const t = Date.parse(raw);
        if (!isNaN(t)) {
          paramMap[`${tc.command}.${f}`] = t >= Date.parse('2026-01-02T00:00:00Z') ? '__FUTURE__' : '__PAST__';
        }
      }
    }
    patchForCases(aggRules, cmdRules.get(tc.command) || [], stateMap, paramMap, agg, tc.command, tc.ruleId, tc.type === 'positive', stateTypes, paramTypes);
    const r5InitialHere = RULING5_INITIAL[agg] || [];
    const r5TsField = RULING5_TS_FIELD[agg];
    const statusFallback = () => {
      const enumRule = aggRules.find((r) => {
        const e = r.expression;
        return e && e.in && e.in[0] && String(e.in[0].var).endsWith('.status');
      });
      if (enumRule) return `"${enumRule.expression.in[1][0]}"`;
      return null; // metaJson.statusEnum fallback unported — canonical carries no statusEnum slot (unexercised)
    };
    const stateArgs = stateParams.map((p) => {
      let v = stateMap[`${agg}.${p.name}`];
      if (v === '' && p.type === 'Id') return 'null';
      if (p.name === 'status' && (v === undefined || v === null || v === '')) {
        const fb = statusFallback();
        if (fb) return fb;
      }
      if (r5TsField && p.name === r5TsField && (v === undefined || v === null || v === '')) {
        return 'Instant.parse("2026-01-02T00:00:00Z")';
      }
      if (v === undefined) {
        if (p.name === 'status') {
          const fb = statusFallback();
          if (fb) return fb;
        }
        return defaultLiteral(p.type);
      }
      return literalFor(v, p.type);
    });
    const stateExpr = `${agg}State(${stateArgs.join(', ')})`;
    const paramArgs = fields.map((f) => {
      let v = paramMap[`${tc.command}.${f}`];
      if (f === 'triggeredBy') {
        if (v === undefined) v = '00000000-0000-0000-0000-000000000009';
        else if (v !== null && !UUID_RE.test(String(v))) v = '00000000-0000-0000-0000-000000000009';
      }
      if (v === '' && (paramTypes[f] || '') === 'Id') return 'null';
      if (v === '__FUTURE__') return 'Instant.now().plusSeconds(86400)';
      if (v === '__PAST__') return 'Instant.now().minusSeconds(86400)';
      if (v === undefined) return nonNullLiteral(paramTypes[f] || 'String');
      return literalFor(v, paramTypes[f] || 'String');
    });
    const paramsExpr = `${paramsName}(${paramArgs.join(', ')})`;
    const baseTestName = `${tc.command} ${tc.type} ${tc.ruleId}`.replace(/"/g, "'");
    const seen = usedTestNames.get(baseTestName) || 0;
    usedTestNames.set(baseTestName, seen + 1);
    const testName = seen === 0 ? baseTestName : `${baseTestName} #${seen + 1}`;
    const ruleRef = portRuleCmds.has(tc.command)
      ? `new ${agg}Rules.${tc.command}Rule(${portMembersOfAgg().map((mem) => `${mem}Impl`).join(', ')})`
      : `${agg}Rules.${tc.command}Rule`;
    const testAnchor = noteAnchor(cmdByName.get(tc.command)?.noteId, elementHashes, '    ');
    if (tc.type === 'positive') {
      const evName = tc.then?.event || '';
      const evtGuard = evtFinal.size ? `\n      ${agg}Rules.checkEventPostconditions(r.toOption.get) shouldBe None` : '';
      if (evName) {
        specTests.push(`${testAnchor}    "${testName}" in {
      val r = ${ruleRef}(${stateExpr}, ${paramsExpr})
      withClue(s"[actual=\${r.left.toOption.map(_.code)}] ") { r.isRight shouldBe true }
      r.toOption.get.map(_.getClass.getSimpleName) should contain ("${evName}")${evtGuard}
    }`);
      } else {
        specTests.push(`${testAnchor}    "${testName}" in {
      val r = ${ruleRef}(${stateExpr}, ${paramsExpr})
      withClue(s"[actual=\${r.left.toOption.map(_.code)}] ") { r.isRight shouldBe true }
    }`);
      }
    } else {
      const errCode = tc.errorCode || tc.then?.errorCode;
      specTests.push(`${testAnchor}    "${testName}" in {
      val r = ${ruleRef}(${stateExpr}, ${paramsExpr})
      r.left.toOption.get.code shouldBe "${errCode}"
    }`);
    }
  }

  // —— Spec 头注锚：三挂号点并集排序（rules_domain_gen paramsNoteIds lines 1433-1438） ——
  // 号源＝库级号桶（augment 落 canonical 的 ruleAnchor 切片·按 definedIn.target 裸名分桶），
  // 非 cases 归属规则面——登记与渲染不对称（CemEdge 两条不渲染的聚合规则仍进 spec 头）。
  const aggEventNames = new Set(eventSigs.map((e) => e.name));
  const ra = a.ruleAnchor ?? { cmd: {}, evt: {}, agg: [] };
  const paramsNoteIds = [...new Set([
    ...[...cmdRules.keys()].flatMap((c) => ra.cmd[c] ?? []),
    ...Object.keys(ra.evt).filter((e) => aggEventNames.has(e)).flatMap((e) => ra.evt[e] ?? []),
    ...(ra.agg ?? []),
  ])].sort();

  return {
    rules: {
      header: env.header, pkg: a.pkg ?? 'net.imadz', ctx: a.ctxPackage, agg,
      evImportList, valuesImport,
      portTraits: [...aggPortTraits].sort(),
      body: rulesBody.join('\n'),
    },
    spec: {
      header: env.header, pkg: a.pkg ?? 'net.imadz', ctx: a.ctxPackage, agg,
      valuesImport,
      anchors: paramsNoteIds.map((id) => noteAnchor(id, elementHashes, '').trimEnd()),
      portVals: portMembersOfRules(),
      portImplVal,
      stateDefaults: stateParams.map((p) => `      ${scalaRef(p.name)}: ${p.type} = ${defaultLiteral(p.type)}`),
      stateCtorArgs: stateParams.map((p) => `    ${scalaRef(p.name)}`),
      tests: specTests,
    },
  };
}
