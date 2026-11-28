// Algebraic Boolean Simplifier (NNF + De Morgan + Comparison Flip) & Clean Scala Renderer
// for bridging co-arising 2.0 EARS AST -> 1.0 strict-governance Scala emitters.
// Eliminates double negations such as `!((!(A) || B))` or `!((x > 0))` into idiomatic Scala:
//   - `not (not X)`            -> `X`
//   - `not (a > b)`            -> `a <= b` (and all 6 comparison operators)
//   - `not (A and B)`          -> `(not A) or (not B)`
//   - `not (A or B)`           -> `(not A) and (not B)` (turns `!(!A || B)` into `A && !B`)
//   - `not (isEmpty)`          -> `nonEmpty` (and vice versa)

const FLIP_COMPARE_OP = Object.freeze({
  '>': '<=',
  '>=': '<',
  '<': '>=',
  '<=': '>',
  '==': '!=',
  '!=': '==',
});

/**
 * Push negations inward into Negation Normal Form (NNF) and eliminate double negations.
 */
export function simplifyBoolExpr(expr, negate = false) {
  if (!expr || typeof expr !== 'object') return expr;
  switch (expr.kind) {
    case 'boolean':
      return { kind: 'boolean', value: negate ? !expr.value : expr.value };
    case 'not':
      return simplifyBoolExpr(expr.argument, !negate);
    case 'binary': {
      let op = expr.op;
      if (negate) op = expr.op === 'and' ? 'or' : 'and';
      const left = simplifyBoolExpr(expr.left, negate);
      const right = simplifyBoolExpr(expr.right, negate);
      if (op === 'and') {
        if (left.kind === 'boolean' && left.value === true) return right;
        if (right.kind === 'boolean' && right.value === true) return left;
        if ((left.kind === 'boolean' && left.value === false) || (right.kind === 'boolean' && right.value === false)) {
          return { kind: 'boolean', value: false };
        }
      } else {
        if (left.kind === 'boolean' && left.value === false) return right;
        if (right.kind === 'boolean' && right.value === false) return left;
        if ((left.kind === 'boolean' && left.value === true) || (right.kind === 'boolean' && right.value === true)) {
          return { kind: 'boolean', value: true };
        }
      }
      return { kind: 'binary', op, left, right };
    }
    case 'compare': {
      if (negate && Object.hasOwn(FLIP_COMPARE_OP, expr.op)) {
        return { ...expr, op: FLIP_COMPARE_OP[expr.op] };
      }
      return expr;
    }
    case 'emptiness': {
      if (negate) {
        return { ...expr, check: expr.check === 'empty' ? 'nonempty' : 'empty' };
      }
      return expr;
    }
    case 'quantifier': {
      if (negate) {
        return {
          ...expr,
          quantifier: expr.quantifier === 'forall' ? 'exists' : 'forall',
          body: simplifyBoolExpr(expr.body, true),
        };
      }
      return { ...expr, body: simplifyBoolExpr(expr.body, false) };
    }
    case 'in': {
      if (negate && expr.target?.kind === 'interval') {
        const loNeg = {
          kind: 'compare',
          op: expr.target.leftInclusive ? '<' : '<=',
          left: expr.element,
          right: expr.target.min,
        };
        const hiNeg = {
          kind: 'compare',
          op: expr.target.rightInclusive ? '>' : '>=',
          left: expr.element,
          right: expr.target.max,
        };
        return { kind: 'binary', op: 'or', left: loNeg, right: hiNeg };
      }
      return negate ? { kind: 'not', argument: expr } : expr;
    }
    default:
      return negate ? { kind: 'not', argument: expr } : expr;
  }
}

function resolveExprType(expr, env) {
  if (!expr) return null;
  if (expr.kind === 'var') {
    if (env.boundVarTypes?.has(expr.name)) return env.boundVarTypes.get(expr.name);
    return env.paramTypes.get(expr.name) ?? null;
  }
  if (expr.kind === 'member') {
    const segs = [];
    let cur = expr;
    while (cur.kind === 'member') {
      segs.unshift(cur.field);
      cur = cur.object;
    }
    if (cur.kind === 'index') {
      let t = resolveExprType(cur, env);
      for (const f of segs) t = t?.fields?.[f] ?? null;
      return t;
    }
    if (cur.kind !== 'var') return null;
    segs.unshift(cur.name);
    if (env.boundVars?.has(segs[0])) {
      let t = env.boundVarTypes?.get(segs[0]) ?? null;
      for (const f of segs.slice(1)) t = t?.fields?.[f] ?? null;
      return t;
    }
    if (env.aliases.has(segs[0]) && segs.length > 1) {
      let t = env.stateTypes.get(segs[1]) ?? null;
      for (const f of segs.slice(2)) t = t?.fields?.[f] ?? null;
      return t;
    }
    let t = env.paramTypes.get(segs[0]) ?? null;
    for (const f of segs.slice(1)) t = t?.fields?.[f] ?? null;
    return t;
  }
  if (expr.kind === 'call') {
    if (expr.name === 'count' || expr.name === 'len') return { kind: 'int' };
    if (expr.name === 'sum') return { kind: 'decimal', scale: 2 };
    return null;
  }
  if (expr.kind === 'index') {
    const colType = resolveExprType(expr.collection, env);
    return colType?.kind === 'map' ? colType.value : null;
  }
  return null;
}

function isNumericExpr(expr, env) {
  if (!expr) return false;
  if (expr.kind === 'number' || expr.kind === 'arith' || expr.kind === 'neg') return true;
  const t = resolveExprType(expr, env);
  return t?.kind === 'int' || t?.kind === 'decimal';
}

function isIntExpr(expr, env) {
  if (!expr) return false;
  if (expr.kind === 'number') return !expr.scale || expr.scale === 0;
  if (expr.kind === 'neg') return isIntExpr(expr.argument, env);
  if (expr.kind === 'arith') return isIntExpr(expr.left, env) && isIntExpr(expr.right, env);
  if (expr.kind === 'call') return expr.name === 'count' || expr.name === 'len';
  const t = resolveExprType(expr, env);
  return t?.kind === 'int';
}

function defaultScalaFallbackForType(rt) {
  if (!rt || typeof rt !== 'object') return '""';
  switch (rt.kind) {
    case 'int': return '0L';
    case 'decimal': return 'BigDecimal("0")';
    case 'bool': return 'false';
    case 'string': return '""';
    case 'optional': return 'None';
    case 'sequence': return 'Vector.empty';
    case 'map': return 'Map.empty';
    default: return '""';
  }
}

export function renderPathScala(expr, env) {
  const segs = [];
  let cur = expr;
  while (cur.kind === 'member') {
    segs.unshift(cur.field);
    cur = cur.object;
  }
  if (cur.kind === 'index') {
    const col = renderPathScala(cur.collection, env);
    const key = renderValScala(cur.index, env);
    const leafType = resolveExprType(expr, env);
    const fallback = defaultScalaFallbackForType(leafType);
    return `${col}.get(${key}).map(_.${segs.join('.')}).getOrElse(${fallback})`;
  }
  if (cur.kind !== 'var') return '""';
  segs.unshift(cur.name);
  if (env.boundVars?.has(segs[0])) {
    return segs.join('.');
  }
  if (env.aliases.has(segs[0]) && segs.length > 1) {
    return `state.${segs.slice(1).join('.')}`;
  }
  if (env.paramPrefix) return `${env.paramPrefix}.${segs.join('.')}`;
  return segs.join('.');
}

function renderIntScala(expr, env) {
  if (expr.kind === 'number') return `${expr.value}L`;
  if (expr.kind === 'neg') return `(-${renderIntScala(expr.argument, env)})`;
  if (expr.kind === 'arith') return `(${renderIntScala(expr.left, env)} ${expr.op} ${renderIntScala(expr.right, env)})`;
  if (expr.kind === 'index') {
    return `${renderPathScala(expr.collection, env)}.getOrElse(${renderValScala(expr.index, env)}, 0L)`;
  }
  return renderValScala(expr, env);
}

function renderNumScala(expr, env) {
  if (expr.kind === 'number') return `BigDecimal(${JSON.stringify(String(expr.value))})`;
  if (expr.kind === 'neg') return `(-${renderNumScala(expr.argument, env)})`;
  if (expr.kind === 'arith') return `(${renderNumScala(expr.left, env)} ${expr.op} ${renderNumScala(expr.right, env)})`;
  if (expr.kind === 'index') {
    return `${renderPathScala(expr.collection, env)}.getOrElse(${renderValScala(expr.index, env)}, BigDecimal("0"))`;
  }
  const t = resolveExprType(expr, env);
  const val = renderValScala(expr, env);
  if (t?.kind === 'int') return `BigDecimal(${val})`;
  return val;
}

export function renderValScala(expr, env) {
  if (!expr) return '""';
  switch (expr.kind) {
    case 'boolean': return expr.value ? 'true' : 'false';
    case 'none': return 'None';
    case 'string': return JSON.stringify(expr.value);
    case 'number': return expr.scale > 0 ? `BigDecimal(${JSON.stringify(String(expr.value))})` : `${expr.value}L`;
    case 'var':
      if (env.paramPrefix && env.paramTypes.has(expr.name)) return `${env.paramPrefix}.${expr.name}`;
      return expr.name;
    case 'member': return renderPathScala(expr, env);
    case 'index': {
      const col = renderPathScala(expr.collection, env);
      const key = renderValScala(expr.index, env);
      const colType = resolveExprType(expr.collection, env);
      let fallback = '""';
      if (colType?.value?.kind === 'decimal') fallback = 'BigDecimal("0")';
      else if (colType?.value?.kind === 'int') fallback = '0L';
      return `${col}.getOrElse(${key}, ${fallback})`;
    }
    case 'arith':
    case 'neg':
      return isIntExpr(expr, env) ? renderIntScala(expr, env) : renderNumScala(expr, env);
    case 'call': {
      if (expr.name === 'count' || expr.name === 'len') {
        return `${renderValScala(expr.args[0], env)}.size.toLong`;
      }
      if (expr.name === 'sum') {
        return `${renderValScala(expr.args[0], env)}.foldLeft(BigDecimal("0.00"))((a, b) => a + BigDecimal(b.toString))`;
      }
      return `${expr.name}(${expr.args.map(a => renderValScala(a, env)).join(', ')})`;
    }
    default:
      return renderCleanBoolScala(expr, env);
  }
}

export function renderAssignValScala(expr, targetType, env) {
  if (expr?.kind === 'none') return 'None';
  if (!targetType) return renderValScala(expr, env);
  if (targetType.kind === 'optional') {
    const exprType = resolveExprType(expr, env);
    if (exprType?.kind === 'optional') return renderValScala(expr, env);
    return `Some(${renderAssignValScala(expr, targetType.element, env)})`;
  }
  if (targetType.kind === 'int') {
    if (isIntExpr(expr, env)) return renderIntScala(expr, env);
    const exprType = resolveExprType(expr, env);
    if (expr.kind === 'arith' || expr.kind === 'neg' || exprType?.kind === 'decimal') {
      return `(${renderNumScala(expr, env)}).toLong`;
    }
    return renderValScala(expr, env);
  }
  if (targetType.kind === 'decimal') return renderNumScala(expr, env);
  return renderValScala(expr, env);
}

/**
 * Render an already-simplified boolean EARS AST to clean, idiomatic Scala with minimal parentheses.
 */
function renderSimplifiedBool(expr, env, parentPrec = 0) {
  if (!expr) return 'true';
  switch (expr.kind) {
    case 'boolean': return expr.value ? 'true' : 'false';
    case 'not': {
      const inner = renderSimplifiedBool(expr.argument, env, 3);
      return expr.argument.kind === 'binary' || expr.argument.kind === 'compare'
        ? `!(${inner})`
        : `!${inner}`;
    }
    case 'binary': {
      const prec = expr.op === 'and' ? 2 : 1;
      const op = expr.op === 'and' ? '&&' : '||';
      const l = renderSimplifiedBool(expr.left, env, prec);
      const r = renderSimplifiedBool(expr.right, env, prec);
      const combined = `${l} ${op} ${r}`;
      return prec < parentPrec ? `(${combined})` : combined;
    }
    case 'compare': {
      let rendered;
      if (isIntExpr(expr.left, env) && isIntExpr(expr.right, env)) {
        rendered = `${renderIntScala(expr.left, env)} ${expr.op} ${renderIntScala(expr.right, env)}`;
      } else if (isNumericExpr(expr.left, env) || isNumericExpr(expr.right, env)) {
        rendered = `${renderNumScala(expr.left, env)} ${expr.op} ${renderNumScala(expr.right, env)}`;
      } else {
        rendered = `${renderValScala(expr.left, env)} ${expr.op} ${renderValScala(expr.right, env)}`;
      }
      return parentPrec > 2 ? `(${rendered})` : rendered;
    }
    case 'in': {
      if (expr.target.kind === 'interval') {
        const el = renderNumScala(expr.element, env);
        const min = renderNumScala(expr.target.min, env);
        const max = renderNumScala(expr.target.max, env);
        const loOp = expr.target.leftInclusive ? '>=' : '>';
        const hiOp = expr.target.rightInclusive ? '<=' : '<';
        const combined = `${el} ${loOp} ${min} && ${el} ${hiOp} ${max}`;
        return parentPrec > 2 ? `(${combined})` : combined;
      }
      if (expr.target.kind === 'set') {
        const el = renderValScala(expr.element, env);
        const items = expr.target.elements.map(e => renderValScala(e, env)).join(', ');
        return `Set(${items}).contains(${el})`;
      }
      return `${renderPathScala(expr.target, env)}.contains(${renderValScala(expr.element, env)})`;
    }
    case 'emptiness': {
      const target = renderValScala(expr.target, env);
      return expr.check === 'empty' ? `${target}.isEmpty` : `${target}.nonEmpty`;
    }
    case 'quantifier': {
      const col = renderValScala(expr.collection, env);
      const colType = resolveExprType(expr.collection, env);
      const boundVars = new Set(env.boundVars ?? []);
      boundVars.add(expr.variable);
      const boundVarTypes = new Map(env.boundVarTypes ?? []);
      if (colType?.element) boundVarTypes.set(expr.variable, colType.element);
      const innerEnv = { ...env, paramTypes: new Map(env.paramTypes), boundVars, boundVarTypes };
      innerEnv.paramTypes.delete(expr.variable);
      const body = renderSimplifiedBool(expr.body, innerEnv, 0);
      const method = expr.quantifier === 'forall' ? 'forall' : 'exists';
      return `${col}.${method}(${expr.variable} => ${body})`;
    }
    default:
      return renderValScala(expr, env);
  }
}

export function renderCleanBoolScala(expr, env) {
  return renderSimplifiedBool(simplifyBoolExpr(expr, false), env, 0);
}
