// expr.mjs — the machineSpec-expression engine, ported verbatim from the production
// patch_core.mjs (knowledge_base/design_docs/field_template/tools/patch_core.mjs): the Node
// Scala-semantics evaluator (scalaEval) backing the Spec case-completeness patcher, and
// exprToScala — the expression → Scala condition translator driving every check/emitWhen/event
// postcondition in <Agg>Rules.scala. One intentional shape difference: canonical rules carry the
// expression FLAT (`rule.expression`), not wrapped in `rule.machineSpec` — patchForCases reads it
// from there. Everything else is byte-faithful to the source.
import { collectVarRefs, inputFieldOf, scalaRef } from './rules.mjs';

// ── evaluation helpers (patch_core lines 14-48) ──
export const MISSING = Symbol('missing');
export const isMissing = (x) => x === MISSING || x === null || x === undefined;
export const get = (env, v) => {
  if (v in env) return env[v];
  const segs = v.split('.');
  let cur = env;
  for (const s of segs) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return MISSING;
    cur = cur[s];
  }
  return cur === undefined ? MISSING : cur;
};
export const str = (x) => (typeof x === 'string' ? x : JSON.stringify(x));
export const isEmpty = (x) => {
  if (x === MISSING || x === null || x === undefined) return true;
  if (typeof x === 'string') return x.length === 0;
  if (Array.isArray(x)) return x.length === 0;
  if (typeof x === 'object') return Object.keys(x).length === 0;
  return false;
};
export const num = (x) => {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '' && !isNaN(Number(x))) return Number(x);
  return NaN;
};
export const cmp = (x) => {
  if (typeof x === 'number') return x;
  if (typeof x === 'string') {
    const n = Number(x);
    if (!isNaN(n)) return n;
    const d = Date.parse(x);
    if (!isNaN(d)) return d;
  }
  return NaN;
};

export const PLACEHOLDER = new Set(['示例值', '示例', 'SAMPLE_VALUE']);

// ── Scala-semantics evaluator (patch_core lines 76-204) ──
export function scalaEval(expr, env) {
  if (typeof expr === 'string') return { ok: true, value: true, note: 'toRefine' };
  if (!expr || typeof expr !== 'object') return { ok: false, value: null, note: '空表达式' };
  const [key, v] = Object.entries(expr)[0];
  try {
    switch (key) {
      case 'notNull': { const val = get(env, v.var); return { ok: true, value: !isMissing(val) && val !== '' }; }
      case 'notEmpty': { const val = get(env, v.var); return { ok: true, value: !isMissing(val) && !(typeof val === 'string' && val === '') && !isEmpty(val) }; }
      case 'empty': { const val = get(env, v.var); return { ok: true, value: isMissing(val) || val === '' || isEmpty(val) }; }
      case 'in': { const val = get(env, v[0].var); return { ok: true, value: !isMissing(val) && v[1].includes(str(val)) }; }
      case 'notIn': { const val = get(env, v[0].var); return { ok: true, value: isMissing(val) || !v[1].includes(str(val)) }; }
      case 'eq': { const val = get(env, v[0].var); return { ok: true, value: !isMissing(val) && str(val) === str(v[1]) }; }
      case 'notEqual': {
        const a = get(env, v[0].var); const b = get(env, v[1].var);
        return { ok: true, value: isMissing(a) || isMissing(b) || str(a) !== str(b) };
      }
      case 'gt': {
        const val = cmp(get(env, v[0].var));
        // now 用真实时间（求值器固定 $now 会漂移；补丁视角须与 Scala 运行时一致）
        const rhs = v[1] && v[1].now === true ? Date.now() : cmp(v[1]);
        return { ok: !isNaN(val) && !isNaN(rhs), value: val > rhs };
      }
      case 'implies': {
        const a = scalaEval(v[0], env);
        if (!a.ok) return a;
        if (!a.value) return { ok: true, value: true };
        return scalaEval(v[1], env);
      }
      case 'and': { for (const sub of v) { const r = scalaEval(sub, env); if (!r.ok) return r; if (!r.value) return { ok: true, value: false }; } return { ok: true, value: true }; }
      case 'or': { for (const sub of v) { const r = scalaEval(sub, env); if (!r.ok) return r; if (r.value) return { ok: true, value: true }; } return { ok: true, value: false }; }
      case 'size': {
        const val = get(env, v.var);
        const len = Array.isArray(val) ? val.length : isMissing(val) ? 0 : String(val).length;
        const n = v.gt ?? v.eq ?? v.n ?? v.count ?? 0;
        return { ok: true, value: v.gt !== undefined ? len > n : len === n };
      }
      case 'forall': {
        const val = get(env, v.var);
        if (!Array.isArray(val)) return { ok: true, value: isEmpty(val) };
        for (const item of val) { const r = scalaEval(v.predicate, { ...env, item }); if (!r.ok) return r; if (!r.value) return { ok: true, value: false }; }
        return { ok: true, value: true };
      }
      case 'unique': {
        // Scala 实现 = 哨兵判定（p.x != "SCOPE_X"）——scope 字段在用例导出时有损（裸键被丢弃），
        // 求值器 scopeVals 语义与运行时不一致；补丁必须以 Scala 哨兵语义判定
        const val = get(env, v.var);
        return { ok: true, value: !isMissing(val) && str(val) !== 'SCOPE_X' };
      }
      case 'uniqueIn': {
        const val = get(env, v.var);
        if (!Array.isArray(val)) return { ok: true, value: true };
        const seen = new Set();
        for (const item of val) {
          const key = (v.keys || []).map((k) => str(item && item[k])).join('\u0000');
          if (seen.has(key)) return { ok: true, value: false };
          seen.add(key);
        }
        return { ok: true, value: true };
      }
      case 'disjoint': {
        const a = get(env, v[0].var); const b = get(env, v[1].var);
        const sa = new Set(Array.isArray(a) ? a.map(str) : []);
        const sb = new Set(Array.isArray(b) ? b.map(str) : []);
        return { ok: true, value: [...sa].every((x) => !sb.has(x)) };
      }
      case 'coexist': {
        const a = get(env, v[0].var); const b = get(env, v[1].var);
        return { ok: true, value: isMissing(a) === isMissing(b) };
      }
      case 'pattern': {
        const val = str(get(env, v.var));
        return { ok: true, value: new RegExp(v.regex).test(val) };
      }
      case 'now': { const val = get(env, v.var); return { ok: true, value: !isMissing(val) }; }
      case 'json': {
        const val = get(env, v.var);
        try {
          if (isMissing(val)) return { ok: true, value: false };
          if (typeof val === 'object') return { ok: true, value: true };
          JSON.parse(val);
          return { ok: true, value: true };
        } catch { return { ok: true, value: false }; }
      }
      case 'compatMatrix': {
        const val = str(get(env, v.var));
        const cell = v.matrix && v.matrix[val];
        return { ok: true, value: !!cell };
      }
      case 'anyNotNull': { return { ok: true, value: (v.vars || []).some((vv) => { const x = get(env, vv); return !isMissing(x) && x !== ''; }) }; }
      case 'refExists': {
        const val = get(env, v.var);
        // Scala isMissingRef：null/MISSING_REF/__OTHER__ → 失败；'' 通过；列表逐元素
        if (isMissing(val)) return { ok: true, value: false };
        if (Array.isArray(val)) return { ok: true, value: val.every((x) => x !== 'MISSING_REF' && x !== '__OTHER__') };
        return { ok: true, value: val !== 'MISSING_REF' && val !== '__OTHER__' };
      }
      case 'memberOf':
      case 'notMemberOf': {
        const item = get(env, v.item.var);
        const colls = Array.isArray(v.collection) ? v.collection : [v.collection];
        const sets = colls.map((c) => {
          const cv = get(env, c.var);
          return new Set(Array.isArray(cv) ? cv.map(str) : isMissing(cv) ? [] : [str(cv)]);
        });
        const inAny = sets.some((s) => s.has(str(item)));
        return { ok: true, value: key === 'memberOf' ? inAny : !inAny };
      }
      case 'updateCheck': {
        const a = get(env, v.var); const b = get(env, v.target);
        return { ok: true, value: isMissing(a) || isMissing(b) || str(a) === str(b) };
      }
      case 'toRefine': return { ok: true, value: true };
      // `expr:` 条件：原始 Scala 布尔直通·求值器不解析（响亮失败·宁红勿判真）
      case 'expr': return { ok: false, value: null, note: 'expr 条件：Node 求值器不解析（生成侧直通·spec 需人工补真值）' };
      default: return { ok: false, value: null, note: `未知操作符 ${key}` };
    }
  } catch (e) {
    return { ok: false, value: null, note: `求值异常 ${e?.message ?? e}` };
  }
}

// gt-now 字段检测（{gt:[var,{now:true}]}）——Spec 需动态时间哨兵（patch_core lines 206-218）
export function gtNowFields(expr, out = new Set()) {
  if (!expr || typeof expr !== 'object') return out;
  if (Array.isArray(expr)) { expr.forEach((x) => gtNowFields(x, out)); return out; }
  for (const [k, v] of Object.entries(expr)) {
    if (k === 'gt' && Array.isArray(v) && v[1] && v[1].now === true && v[0]?.var) {
      const f = String(v[0].var).split('.')[1];
      if (f) out.add(f);
    }
    gtNowFields(v, out);
  }
  return out;
}

// ── 表达式 → Scala 条件翻译器（patch_core lines 220-526，逐字） ──
export function resolveVar(v, ctx) {
  let segs = String(v).split('.');
  if (segs.length === 1 && String(v) === 'input') {
    // 求值器特殊变量：命令输入主值（in 枚举检查）。字段名从 humanDescription 反引号提取（ctx.inputField）
    const f = ctx.inputField;
    if (!f) return null;
    return ctx.cmdName ? { scope: 'param', field: f } : { scope: 'state', field: f };
  }
  if (segs.length === 1) return null;
  const [host, field] = segs;
  if (ctx.eventName && host === ctx.eventName) return { scope: 'event', field: segs.slice(1).join('.') };
  if (host === 'aggregate') return ctx.stateFields.has(field) ? { scope: 'state', field } : null;
  if (host === 'item') return { scope: 'item', field: segs.slice(1).join('.') };
  if (ctx.cmdName && host === ctx.cmdName) return ctx.paramFields.has(field) ? { scope: 'param', field } : null;
  if (ctx.aggName && host === ctx.aggName) return ctx.stateFields.has(field) ? { scope: 'state', field } : null;
  return null;
}

/** 生成 Scala 引用表达式（state.f / p.f / item.f / e.f；关键字字段反引号） */
export function refExpr(r) {
  if (r.scope === 'state') return `state.${scalaRef(r.field)}`;
  if (r.scope === 'param') return `p.${scalaRef(r.field)}`;
  if (r.scope === 'event') return `e.${r.field.split('.').map(scalaRef).join('.')}`;
  return `item.${scalaRef(r.field)}`;
}

/**
 * exprToScala(expr, ctx) → { cond, degraded } | null（不可译 → 调用方走哨兵降级或 SKIP）。
 * ctx: { stateFields, stateTypes, paramFields, paramTypes, aggName, cmdName, inputField?,
 *        eventName?, eventFields?, eventTypes?, voByName?, itemType? }
 */
export function exprToScala(expr, ctx) {
  if (!expr || typeof expr !== 'object') return null;
  const [key, v] = Object.entries(expr)[0];
  const S = (field) => refExpr({ scope: 'state', field });
  const P = (field) => refExpr({ scope: 'param', field });
  const varRef = (vv) => {
    const r = resolveVar(vv, ctx);
    return r ? refExpr(r) : null;
  };
  const notNullExpr = (x, type) => {
    const t = (type || 'String').trim();
    // J-6/P4 终形：null 直比 → Option 组合子。
    if (t === 'Id' || t.startsWith('Option') || t.startsWith('Instant') || t.endsWith('Instant')) return `Option(${x}).isDefined`;
    // List：notNull = 非 null（占位数组→Nil 时通过，notEmpty 才查 nonEmpty）
    if (t.startsWith('List[') || t === 'List') return `Option(${x}).isDefined`;
    return `notNull(${x})`;
  };
  const typeOf = (r) => {
    if (r.scope === 'state') return ctx.stateTypes[r.field] || 'String';
    if (r.scope === 'param') return ctx.paramTypes[r.field] || 'String';
    if (r.scope === 'event') {
      // 事件字段类型 + 嵌套路径逐段经 VO 签名推导（patchSet.appliedAt → Instant）
      const voByName = ctx.voByName || new Map();
      const segs = r.field.split('.');
      let t = (ctx.eventTypes && ctx.eventTypes[segs[0]]) || 'String';
      for (let i = 1; i < segs.length; i++) {
        const base = t.replace(/^List\[/, '').replace(/\]$/, '').replace(/^Option\[/, '').replace(/\]$/, '');
        const voSig = voByName.get(base);
        if (!voSig) return 'String';
        const p = voSig.params.find((pp) => pp.name === segs[i]);
        if (!p) return 'String';
        t = p.type;
      }
      return t;
    }
    if (r.scope === 'item') {
      if (!ctx.itemType) return 'String';
      const voByName = ctx.voByName || new Map();
      const segs = r.field.split('.');
      let t = String(ctx.itemType);
      for (let i = 0; i < segs.length; i++) {
        const base = t.replace(/^List\[/, '').replace(/\]$/, '').replace(/^Option\[/, '').replace(/\]$/, '');
        const voSig = voByName.get(base);
        if (!voSig) return 'String';
        const p = voSig.params.find((pp) => pp.name === segs[i]);
        if (!p) return 'String';
        t = p.type;
      }
      return t;
    }
    return 'String';
  };
  switch (key) {
    case 'expr':
      // `expr:` 条件逃生舱——原始 Scala 布尔表达式直通（求值器不解析·响亮失败）
      return typeof v === 'string' && v.trim() ? { cond: v, degraded: 'expr 条件直通（Node 求值器不解析）' } : null;
    case 'notNull': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      return { cond: notNullExpr(refExpr(r), typeOf(r)), degraded: null };
    }
    case 'notEmpty': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      const t = typeOf(r);
      if (t.startsWith('List[') || t === 'List') return { cond: `Option(${refExpr(r)}).exists(_.nonEmpty)`, degraded: null };
      return { cond: notNullExpr(refExpr(r), t), degraded: null };
    }
    case 'empty': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      return { cond: `Option(${refExpr(r)}).forall(_.isEmpty)`, degraded: null };
    }
    case 'in': {
      const r = resolveVar(v[0].var, ctx);
      if (!r) return null;
      const list = v[1].map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(', ');
      return { cond: `Option(${refExpr(r)}).exists(x => Set(${list}).contains(x))`, degraded: null };
    }
    case 'notIn': {
      const r = resolveVar(v[0].var, ctx);
      if (!r) return null;
      const list = v[1].map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(', ');
      return { cond: `Option(${refExpr(r)}).forall(x => !Set(${list}).contains(x))`, degraded: null };
    }
    case 'eq': {
      const r = resolveVar(v[0].var, ctx);
      if (!r) return null;
      const rhs = v[1];
      let lit;
      if (rhs === true || rhs === false) lit = String(rhs);
      else if (typeof rhs === 'number') lit = String(rhs);
      else if (typeOf(r) === 'Boolean' && (rhs === 'true' || rhs === 'false')) lit = String(rhs);
      else lit = `"${String(rhs).replace(/"/g, '\\"')}"`;
      return { cond: `Option(${refExpr(r)}).contains(${lit})`, degraded: null };
    }
    case 'notEqual': {
      const a = resolveVar(v[0].var, ctx);
      const b = resolveVar(v[1].var, ctx);
      if (!a || !b) return null;
      return { cond: `Option(${refExpr(a)}).isEmpty || Option(${refExpr(b)}).isEmpty || ${refExpr(a)} != ${refExpr(b)}`, degraded: null };
    }
    case 'gt': {
      const r = resolveVar(v[0].var, ctx);
      if (!r) return null;
      if (v[1] && v[1].now === true) {
        return { cond: `Option(${refExpr(r)}).exists(_.isAfter(Instant.now()))`, degraded: null };
      }
      return { cond: `Option(${refExpr(r)}).exists(_ > ${JSON.stringify(v[1])})`, degraded: null };
    }
    case 'implies': {
      const a = exprToScala(v[0], ctx);
      const b = exprToScala(v[1], ctx);
      if (!a || !b) return null;
      return { cond: `(!(${a.cond}) || (${b.cond}))`, degraded: a.degraded || b.degraded || null };
    }
    case 'and': {
      const parts = v.map((sub) => exprToScala(sub, ctx));
      if (parts.some((x) => !x)) return null;
      return { cond: `(${parts.map((x) => `(${x.cond})`).join(' && ')})`, degraded: parts.map((x) => x.degraded).find(Boolean) || null };
    }
    case 'or': {
      const parts = v.map((sub) => exprToScala(sub, ctx));
      if (parts.some((x) => !x)) return null;
      return { cond: `(${parts.map((x) => `(${x.cond})`).join(' || ')})`, degraded: parts.map((x) => x.degraded).find(Boolean) || null };
    }
    case 'size': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      if (v.gt !== undefined) return { cond: `Option(${refExpr(r)}).exists(_.size > ${v.gt})`, degraded: null };
      if (v.eq === 0) return { cond: `Option(${refExpr(r)}).forall(_.isEmpty)`, degraded: null };
      return { cond: `Option(${refExpr(r)}).exists(_.size == ${v.eq ?? v.n ?? 0})`, degraded: null };
    }
    case 'forall': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      const sub = exprToScala(v.predicate, { ...ctx, paramFields: new Set() });
      if (!sub) return null;
      return { cond: `Option(${refExpr(r)}).exists(_.forall(item => ${sub.cond}))`, degraded: sub.degraded || null };
    }
    case 'disjoint': {
      const a = resolveVar(v[0].var, ctx);
      const b = resolveVar(v[1].var, ctx);
      if (!a || !b) return null;
      return { cond: `Option(${refExpr(a)}).exists(x => Option(${refExpr(b)}).exists(_.intersect(x).isEmpty))`, degraded: null };
    }
    case 'coexist': {
      const a = resolveVar(v[0].var, ctx);
      const b = resolveVar(v[1].var, ctx);
      if (!a || !b) return null;
      return { cond: `((Option(${refExpr(a)}).exists(_.nonEmpty)) == (Option(${refExpr(b)}).exists(_.nonEmpty)))`, degraded: null };
    }
    case 'memberOf': {
      const item = resolveVar(v.item.var, ctx);
      if (!item) return null;
      const itType = item.scope === 'state' ? (ctx.stateTypes?.[item.field] || '') : item.scope === 'param' ? (ctx.paramTypes?.[item.field] || '') : '';
      const collsRaw = Array.isArray(v.collection) ? v.collection : [v.collection];
      const parts = [];
      for (const c of collsRaw) {
        const coll = c && c.var ? resolveVar(c.var, ctx) : null;
        if (!coll) return null;
        const collType = coll.scope === 'state' ? (ctx.stateTypes?.[coll.field] || '') : coll.scope === 'param' ? (ctx.paramTypes?.[coll.field] || '') : '';
        // 标量 collection 守卫：collection 解析到标量字段时 .contains 不存在 → 降级哨兵
        if (collType && !collType.startsWith('List[') && collType !== 'List') return null;
        const itemExpr = (itType === 'Id' && collType.startsWith('List[') && !collType.includes('Id'))
          ? `${refExpr(item)}.toString` : refExpr(item);
        parts.push(`Option(${refExpr(coll)}).exists(_.contains(${itemExpr}))`);
      }
      if (!parts.length) return null;
      return { cond: parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(' || '), degraded: null };
    }
    case 'notMemberOf': {
      const item = resolveVar(v.item.var, ctx);
      if (!item) return null;
      const itType2 = item.scope === 'state' ? (ctx.stateTypes?.[item.field] || '') : item.scope === 'param' ? (ctx.paramTypes?.[item.field] || '') : '';
      const collsRaw2 = Array.isArray(v.collection) ? v.collection : [v.collection];
      const parts2 = [];
      for (const c of collsRaw2) {
        const coll = c && c.var ? resolveVar(c.var, ctx) : null;
        if (!coll) return null;
        const collType2 = coll.scope === 'state' ? (ctx.stateTypes?.[coll.field] || '') : coll.scope === 'param' ? (ctx.paramTypes?.[coll.field] || '') : '';
        if (collType2 && !collType2.startsWith('List[') && collType2 !== 'List') return null;
        const itemExpr2 = (itType2 === 'Id' && collType2.startsWith('List[') && !collType2.includes('Id'))
          ? `${refExpr(item)}.toString` : refExpr(item);
        parts2.push(`Option(${refExpr(coll)}).forall(x => !x.contains(${itemExpr2}))`);
      }
      if (!parts2.length) return null;
      return { cond: parts2.length === 1 ? parts2[0] : parts2.map((p) => `(${p})`).join(' && '), degraded: null };
    }
    case 'uniqueIn': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      return { cond: `Option(${refExpr(r)}).exists(r => r.map(i => (${(v.keys || []).map((k) => `i.${scalaRef(k)}`).join(', ')})).distinct.size == r.size)`, degraded: null };
    }
    case 'unique': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      if (v.scope === 'global') return { cond: 'true', degraded: 'global unique（跨实例，单聚合内跳过）' };
      if (typeOf(r) !== 'String') return null;
      return { cond: `${refExpr(r)} != "SCOPE_X"`, degraded: 'unique scope（哨兵判定 SCOPE_X）' };
    }
    case 'pattern': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      return { cond: `Option(${refExpr(r)}).exists(_.matches("${v.regex.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"))`, degraded: null };
    }
    case 'json': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      return { cond: `Option(${refExpr(r)}).exists(x => x.trim.startsWith("{") && x.trim.endsWith("}"))`, degraded: 'json 简化（括号形态）' };
    }
    case 'compatMatrix': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      const keys = Object.keys(v.matrix || {}).map((x) => `"${x}"`).join(', ');
      return { cond: `Option(${refExpr(r)}).exists(x => Set(${keys}).contains(x))`, degraded: 'compatMatrix 简化（键集检查）' };
    }
    case 'anyNotNull': {
      const refs = (v.vars || []).map((vv) => varRef(vv)).filter(Boolean);
      if (refs.length === 0) return null;
      return { cond: `Seq(${refs.join(', ')}).exists(x => Option(x).exists(_.nonEmpty))`, degraded: null };
    }
    case 'refExists': {
      const r = resolveVar(v.var, ctx);
      if (!r) return null;
      const t = typeOf(r);
      if (t.startsWith('List[') || t === 'List') {
        return { cond: `Option(${refExpr(r)}).getOrElse(Nil).forall(x => !isMissingRef(x))`, degraded: `refExists ${v.target}（列表逐元素哨兵判定）` };
      }
      if (t === 'Id' || t.startsWith('Option')) {
        return { cond: `Option(${refExpr(r)}).isDefined`, degraded: `refExists ${v.target}（Id 非空判定）` };
      }
      return { cond: `Option(${refExpr(r)}).exists(x => !isMissingRef(x))`, degraded: `refExists ${v.target}（哨兵判定 MISSING_REF/__OTHER__）` };
    }
    default:
      return null;
  }
}

// ── 用例完整性补丁（patch_for_cases，patch_core lines 528-873 逐字·expression 平铺读） ──
export function patchForCases(aggRules, cmdRuleList, stateMap, paramMap, aggName, cmdName, targetRuleId, isPositive, stateTypes = {}, paramTypes = {}) {
  const target = [...aggRules, ...cmdRuleList].find((r) => r.id === targetRuleId) || null;
  const others = [...aggRules, ...cmdRuleList].filter((r) => r.id !== targetRuleId);
  const isPatchable = (r) => {
    const vars = [...collectVarRefs(r.expression || {})].map(String);
    return vars.every((vv) => {
      const [h] = vv.split('.');
      return h === aggName || h === cmdName || h === 'aggregate' || h === 'item' || h === 'input';
    });
  };
  const targetP0 = target && isPatchable(target) ? target : null;
  const othersP0 = others.map((r) => r);
  const cmdRuleIds = new Set(cmdRuleList.map((r) => r.id));
  const prepRule = (r) => {
    const expr = r.expression;
    if (!expr || typeof expr !== 'object') return r;
    const f = inputFieldOf(r.humanDescription);
    if (!f) return r;
    const host = cmdRuleIds.has(r.id) ? cmdName : aggName;
    const repl = (e) => {
      if (Array.isArray(e)) return e.map(repl);
      if (e && typeof e === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(e)) {
          if (k === 'var' && String(v) === 'input') out[k] = `${host}.${f}`;
          else out[k] = repl(v);
        }
        return out;
      }
      return e;
    };
    return { ...r, expression: repl(expr) };
  };
  const targetP = targetP0 ? prepRule(targetP0) : null;
  const protectedState = new Set();
  if (targetP && aggRules.some((r) => r.id === targetRuleId)) {
    for (const vv of collectVarRefs(targetP.expression || {})) {
      const segs = String(vv).split('.');
      if (segs.length === 2 && (segs[0] === 'aggregate' || segs[0] === aggName)) protectedState.add(segs[1]);
    }
  }
  const othersP = othersP0.map(prepRule).filter(isPatchable);
  const origState = new Map(Object.entries(stateMap));
  const origParam = new Map(Object.entries(paramMap));
  const fieldEnumMap = new Map();
  for (const r of [...othersP, ...(targetP ? [targetP] : [])]) {
    const e = r.expression;
    if (!e || typeof e !== 'object') continue;
    const walk = (x) => {
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (!x || typeof x !== 'object') return;
      for (const [k, v] of Object.entries(x)) {
        if (k === 'in' && Array.isArray(v) && v[1] && typeof v[0]?.var === 'string') {
          const f = v[0].var.split('.')[1];
          if (f) fieldEnumMap.set(f, [...new Set([...(fieldEnumMap.get(f) || []), ...v[1].map(String)])]);
        } else walk(v);
      }
    };
    walk(e);
  }
  const buildEnv = () => {
    const env = { $now: '2026-01-02T00:00:00Z' };
    const norm = (val, field, isParam) => {
      if (val === undefined || val === null) return val;
      if (val === '__FUTURE__') return new Date(Date.now() + 86400000).toISOString();
      if (val === '__PAST__') return new Date(Date.now() - 86400000).toISOString();
      const t = (isParam ? paramTypes[field] : stateTypes[field]) || 'String';
      if (Array.isArray(val)) return val.every((x) => PLACEHOLDER.has(String(x))) ? [] : val;
      if (typeof val === 'string' && PLACEHOLDER.has(val)) return t.startsWith('List[') ? [] : '';
      if (t.startsWith('List[') || t === 'List') return [val];
      return val;
    };
    for (const [k, val] of Object.entries(stateMap)) {
      const field = k.slice(aggName.length + 1);
      const nv = norm(val, field, false);
      env[`${aggName}.${field}`] = nv;
      env[`aggregate.${field}`] = nv;
    }
    for (const [k, val] of Object.entries(paramMap)) {
      const field = k.slice(cmdName.length + 1);
      env[k] = norm(val, field, true);
    }
    return env;
  };
  let changed = 0;
  const repairList = [
    ...othersP.map((r) => ({ rule: r, goal: true })),
    ...(targetP ? [{ rule: targetP, goal: isPositive }] : []),
  ];
  for (let iter = 0; iter < 8; iter++) {
    let dirty = false;
    for (const { rule, goal } of repairList) {
      const expr = rule.expression;
      if (!expr || typeof expr !== 'object') continue;
      let fixed = false;
      const env = buildEnv();
      const res = scalaEval(expr, env);
      if (res.ok && res.value === goal) continue;
      const varNames = [...collectVarRefs(expr)];
      const memExpr = expr.memberOf || expr.notMemberOf;
      if (memExpr) {
        const isNot = !!expr.notMemberOf;
        const itemVar = String(memExpr.item.var || '');
        const collVars = (Array.isArray(memExpr.collection) ? memExpr.collection : [memExpr.collection]).filter(Boolean);
        const itemField = itemVar.split('.')[1];
        const itemKey = itemVar.startsWith(aggName + '.') || itemVar.startsWith('aggregate.') ? `${aggName}.${itemField}` : `${cmdName}.${itemField}`;
        const itemMap = itemKey.startsWith(aggName + '.') ? stateMap : paramMap;
        const collKeys = collVars.map((cv) => {
          const collField = String(cv.var || '').split('.')[1];
          const collVar = String(cv.var || '');
          const collKey = collVar.startsWith(aggName + '.') || collVar.startsWith('aggregate.') ? `${aggName}.${collField}` : `${cmdName}.${collField}`;
          return { collKey, collMap: collKey.startsWith(aggName + '.') ? stateMap : paramMap };
        });
        const candIdxs = [];
        if (!isNot) { for (let ci = 0; ci < collKeys.length; ci++) candIdxs.push([ci]); if (collKeys.length > 1) candIdxs.push(collKeys.map((_, ci) => ci)); }
        else candIdxs.push(collKeys.map((_, ci) => ci));
        for (const idxs of candIdxs) {
          const [iv, cv] = [[isNot ? 'NOT_IN_SET' : 'IN_SET', ['IN_SET']]][0];
          const origColls = collKeys.map(({ collKey, collMap }) => ({ collKey, collMap, orig: collMap[collKey] !== undefined ? collMap[collKey] : undefined }));
          itemMap[itemKey] = iv;
          for (const ci of idxs) collKeys[ci].collMap[collKeys[ci].collKey] = cv;
          const envM = buildEnv();
          const ruleOk = scalaEval(expr, envM).ok && scalaEval(expr, envM).value === goal;
          const tRes = targetP && targetP !== rule ? scalaEval(targetP.expression, envM) : null;
          const targetOk = !tRes || (tRes.ok && tRes.value === (isPositive ? true : false));
          if (ruleOk && targetOk) { fixed = true; changed++; break; }
          for (const { collKey, collMap, orig } of origColls) {
            if (orig === undefined) delete collMap[collKey]; else collMap[collKey] = orig;
          }
        }
        if (fixed) { dirty = true; continue; }
        if (itemMap[itemKey] !== undefined) itemMap[itemKey] = (itemMap === stateMap ? origState : origParam).get(itemKey);
      }
      let lastField = null;
      let lastKey = null;
      let lastCands = [];
      for (const vv of varNames) {
        const segs = String(vv).split('.');
        if (segs.length !== 2) continue;
        const [host, field] = segs;
        let map = null;
        let key = null;
        if (host === 'aggregate' || host === aggName) { map = stateMap; key = `${aggName}.${field}`; }
        else if (host === cmdName) { map = paramMap; key = `${cmdName}.${field}`; }
        else continue;
        const cands = neutralCandidates(expr, field, map, aggName, fieldEnumMap);
        let candsP = cands;
        if (rule !== targetP && map === stateMap && protectedState.has(field)) {
          candsP = cands.filter((cv) => cv !== null && cv !== '' && !(Array.isArray(cv) && cv.length === 0));
          if (!candsP.length) continue;
        }
        lastField = field; lastKey = key; lastCands = cands;
        const scored = candsP.map((c) => ({ c, score: candidateScore(c, key, map, targetP, isPositive, buildEnv) }));
        scored.sort((a, b) => b.score - a.score);
        const prevVal = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
        let varFixed = false;
        for (const { c } of scored) {
          const fType = map === stateMap ? stateTypes[field] : paramTypes[field];
          map[key] = (c === 'X' && fType === 'Instant') ? ['X'] : c;
          const env2 = buildEnv();
          const ruleOk = scalaEval(expr, env2).ok && scalaEval(expr, env2).value === goal;
          let targetOk = true;
          if (targetP && targetP !== rule) {
            const tExpr = targetP.expression;
            const tVars = [...collectVarRefs(tExpr)].map(String).filter((x) => !x.startsWith('item'));
            const resolvable = tVars.length === 0 || tVars.some((vv) => vv in env2);
            const tRes = scalaEval(tExpr, env2);
            targetOk = !resolvable || (tRes.ok && tRes.value === (isPositive ? true : false));
          }
          if (ruleOk && targetOk) { varFixed = true; fixed = true; changed++; break; }
        }
        if (!varFixed) {
          if (prevVal === undefined) delete map[key];
          else map[key] = prevVal;
        }
        if (fixed) break;
      }
      // 多变量 AND 规则联合修复（patch_core 744-802）
      if (!fixed) {
        const jointVars = [];
        for (const vv of varNames) {
          const segs = String(vv).split('.');
          if (segs.length !== 2) continue;
          const [host, field] = segs;
          let map = null;
          let key = null;
          if (host === 'aggregate' || host === aggName) { map = stateMap; key = `${aggName}.${field}`; }
          else if (host === cmdName) { map = paramMap; key = `${cmdName}.${field}`; }
          else continue;
          const cur = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
          const curBad = cur === undefined || cur === null
            || (typeof cur === 'string' && PLACEHOLDER.has(cur))
            || (Array.isArray(cur) && cur.every((x) => PLACEHOLDER.has(String(x))));
          if (!curBad) continue;
          const protect = rule !== targetP && map === stateMap && protectedState.has(field);
          if (protect) continue;
          const cands = neutralCandidates(expr, field, map, aggName, fieldEnumMap)
            .filter((cv) => cv !== null && cv !== '' && !(Array.isArray(cv) && cv.length === 0)).slice(0, 3);
          if (cands.length) jointVars.push({ map, key, field, cands, instant: (map === stateMap ? stateTypes[field] : paramTypes[field]) === 'Instant' });
        }
        if (jointVars.length >= 2) {
          const combos = [[]];
          for (const jv of jointVars) {
            const next = [];
            for (const base of combos) for (const c of jv.cands) { if (next.length < 81) next.push([...base, c]); }
            combos.length = 0; combos.push(...next);
          }
          const saved = jointVars.map((jv) => ({ v: Object.prototype.hasOwnProperty.call(jv.map, jv.key) ? jv.map[jv.key] : undefined, has: Object.prototype.hasOwnProperty.call(jv.map, jv.key) }));
          for (const combo of combos) {
            jointVars.forEach((jv, i) => { jv.map[jv.key] = (jv.instant && combo[i] === 'X') ? ['X'] : combo[i]; });
            const envJ = buildEnv();
            const ruleOk = scalaEval(expr, envJ).ok && scalaEval(expr, envJ).value === goal;
            let targetOk = true;
            if (targetP && targetP !== rule) {
              const tExprJ = targetP.expression;
              const tVarsJ = [...collectVarRefs(tExprJ)].map(String).filter((x) => !x.startsWith('item'));
              const resolvableJ = tVarsJ.length === 0 || tVarsJ.some((x) => x in envJ);
              const tResJ = scalaEval(tExprJ, envJ);
              targetOk = !resolvableJ || (tResJ.ok && tResJ.value === (isPositive ? true : false));
            }
            if (ruleOk && targetOk) {
              fixed = true; dirty = true; changed++;
              break;
            }
          }
          if (!fixed) jointVars.forEach((jv, i) => { const s = saved[i]; if (s.has) jv.map[jv.key] = s.v; else delete jv.map[jv.key]; });
        }
      }
      if (!fixed && targetP && targetP !== rule) {
        // implies 前件压制（patch_core 803-846）
        const tExpr = targetP.expression;
        const ante = tExpr?.implies?.[0];
        const applyAnte = (targetKey, targetVal) => {
          if (targetKey.startsWith(aggName + '.')) stateMap[targetKey] = targetVal;
          else if (targetKey.startsWith(cmdName + '.')) paramMap[targetKey] = targetVal;
        };
        if (ante && typeof ante === 'object') {
          const aEnt = Object.entries(ante)[0];
          const [aKey, aVal] = aEnt || [];
          const aVar = aKey === 'eq' ? String(aVal?.[0]?.var || '') : String(aVal?.var || '');
          const aField = aVar ? aVar.split('.')[1] : null;
          const aTargetKey = aVar && (aVar.startsWith(aggName + '.') || aVar.startsWith('aggregate.'))
            ? `${aggName}.${aField}` : (aVar ? `${cmdName}.${aField}` : null);
          const aOrig = aTargetKey ? (origState.get(aTargetKey) ?? origParam.get(aTargetKey)) : undefined;
          if (aTargetKey && (stateMap[aTargetKey] !== undefined || paramMap[aTargetKey] !== undefined)) {
            let anteVal = null;
            if (aKey === 'eq' && (aVal[1] === 'true' || aVal[1] === 'false')) anteVal = aVal[1] === 'true' ? false : true;
            else if (aKey === 'notEmpty' || aKey === 'notNull') anteVal = null;
            if (anteVal !== null || aKey === 'notEmpty' || aKey === 'notNull') {
              applyAnte(aTargetKey, anteVal);
              const envA = buildEnv();
              const tOkA = scalaEval(tExpr, envA).ok && scalaEval(tExpr, envA).value === (isPositive ? true : false);
              if (tOkA) {
                const scoredA = lastCands.map((c) => ({ c, score: candidateScore(c, lastKey, lastKey.startsWith(aggName + '.') ? stateMap : paramMap, targetP, isPositive, buildEnv) }));
                scoredA.sort((a, b) => b.score - a.score);
                for (const { c } of scoredA) {
                  if (lastKey.startsWith(aggName + '.')) stateMap[lastKey] = c; else paramMap[lastKey] = c;
                  const env3 = buildEnv();
                  const rOk = scalaEval(expr, env3).ok && scalaEval(expr, env3).value === goal;
                  const tOk = scalaEval(tExpr, env3).ok && scalaEval(tExpr, env3).value === (isPositive ? true : false);
                  if (rOk && tOk) { fixed = true; changed++; break; }
                }
              }
              if (!fixed) applyAnte(aTargetKey, aOrig);
            }
          }
        }
      }
      if (!fixed) {
        // 全候选失败：恢复原值（按 host 选快照——同名字段 state/param 并存时取当前 map 的快照）
        for (const vv of varNames) {
          const segs = String(vv).split('.');
          if (segs.length !== 2) continue;
          const [host, field] = segs;
          const paramOrig = origParam.get(`${cmdName}.${field}`);
          const stateOrig = origState.get(`${aggName}.${field}`);
          const orig = (host === 'aggregate' || host === aggName)
            ? (stateOrig !== undefined ? stateOrig : paramOrig)
            : (paramOrig !== undefined ? paramOrig : stateOrig);
          if (host === 'aggregate' || host === aggName) {
            if (stateMap[`${aggName}.${field}`] !== undefined) stateMap[`${aggName}.${field}`] = orig;
          } else if (host === cmdName) {
            if (paramMap[`${cmdName}.${field}`] !== undefined) paramMap[`${cmdName}.${field}`] = orig;
          }
        }
      }
      dirty = true;
    }
    if (!dirty) break;
  }
  return changed;
}

/** 候选评分：目标规则命中用例期望 +2，其余 +0；无目标规则一律 +1（patch_core 876-882） */
export function candidateScore(cand, key, map, target, isPositive, buildEnv) {
  if (!target) return 1;
  const env = buildEnv();
  env[key] = cand;
  const r = scalaEval(target.expression, env);
  return r.ok && r.value === (isPositive ? true : false) ? 2 : 0;
}

/** 中性候选值（patch_core 885-956 逐字） */
export function neutralCandidates(expr, field, stateMap, aggName, fieldEnumMap = new Map()) {
  if (!expr || typeof expr !== 'object') return [null, 'X', []];
  const [key, v] = Object.entries(expr)[0];
  switch (key) {
    case 'notNull': case 'notEmpty': return ['X', 'ID-0001', 1, true];
    case 'in': return [...v[1].slice(), '__OTHER__', ''];
    case 'notIn': {
      const enums = fieldEnumMap.get(field) || [];
      const excluded = new Set(v[1].map(String));
      const inside = enums.filter((x) => !excluded.has(x));
      return [...inside, ...enums, '__OTHER__', 'X'];
    }
    case 'eq': return [v[1]];
    case 'notEqual': {
      const other = v[1]?.var ? String(stateMap[`${aggName}.${String(v[1].var).split('.')[1]}`] ?? '') : '';
      return [other ? `${other}_DIFF` : 'A', 'A'];
    }
    case 'implies': {
      const a = v[0];
      if (a && typeof a === 'object' && a.notEmpty && a.notEmpty.var === `${aggName}.${field}`) return [null, []];
      if (a && typeof a === 'object' && a.notNull && a.notNull.var === `${aggName}.${field}`) return [null];
      return [null, 'X', []];
    }
    case 'size': return v.eq === 0 ? [[]] : [['x']];
    case 'disjoint': {
      const otherVar = v[0]?.var === `${aggName}.${field}` ? v[1] : v[0];
      const otherVal = otherVar?.var ? stateMap[`${aggName}.${String(otherVar.var).split('.')[1]}`] : null;
      const otherArr = Array.isArray(otherVal) ? otherVal : [];
      return [['DIFF'], otherArr.length ? [otherArr[0] + '_DIFF'] : ['A1']];
    }
    case 'coexist': {
      const otherVar = v[0]?.var === `${aggName}.${field}` ? v[1] : v[0];
      const otherVal = otherVar?.var ? stateMap[`${aggName}.${String(otherVar.var).split('.')[1]}`] : null;
      return isMissing(otherVal) ? [null] : ['X'];
    }
    case 'memberOf': {
      const collVar = v.collection?.var;
      const collVal = collVar ? stateMap[`${aggName}.${String(collVar).split('.')[1]}`] : null;
      return [Array.isArray(collVal) && collVal.length ? collVal[0] : 'IN_SET'];
    }
    case 'notMemberOf': return ['NOT_IN_SET', 'X'];
    case 'uniqueIn': return [[{ [v.keys?.[0] || 'k']: 'U1' }]];
    case 'unique': return ['U1'];
    case 'refExists': return ['ID-0001', 'MISSING_REF', ''];
    case 'pattern': {
      try {
        const rx = new RegExp(v.regex);
        const cands = ['a1', 'abc', '123', '1.2.3', 'a@b.c', 'x.y.z', 'v1.0.0', '2026', 'a-b_c.d', 'A1', 'a.b@c.d'];
        const hit = cands.filter((c) => rx.test(c));
        return [...hit, ...cands, 'X'];
      } catch { return ['X']; }
    }
    case 'json': return ['{}', '{"a":1}'];
    case 'gt': return ['__FUTURE__', '__PAST__'];
    case 'compatMatrix': return Object.keys(v.matrix || {}).slice(0, 1);
    case 'and': {
      for (const sub of v) {
        const subVars = [...collectVarRefs(sub)].map(String);
        if (subVars.some((vv) => vv.split('.')[1] === field)) {
          const subCands = neutralCandidates(sub, field, stateMap, aggName, fieldEnumMap);
          if (subCands.length) return subCands;
        }
      }
      return [null, 'X', []];
    }
    default: return [null, 'X', []];
  }
}
