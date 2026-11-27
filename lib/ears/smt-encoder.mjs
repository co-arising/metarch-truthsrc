// Single-hop deterministic compiler from normalized/bound EARS AST to standard SMT-LIB 2 (.smt2).

function sanitizeId(raw) {
  return raw.replace(/[^A-Za-z0-9_]/gu, '_');
}

function pathToString(expr) {
  if (!expr) return '';
  if (expr.kind === 'var') return expr.name;
  if (expr.kind === 'member') return `${pathToString(expr.object)}.${expr.field}`;
  return '';
}

function isSimplePath(expr) {
  return expr?.kind === 'var' || (expr?.kind === 'member' && isSimplePath(expr.object));
}

function scaleInt(numStr, targetScale) {
  const neg = numStr.startsWith('-');
  const unsigned = neg ? numStr.slice(1) : numStr;
  const [intPart, fracPart = ''] = unsigned.split('.');
  const padded = fracPart.padEnd(targetScale, '0').slice(0, targetScale);
  const combined = BigInt((intPart || '0') + padded);
  return neg ? `(- ${combined.toString()})` : combined.toString();
}

function formatScaledInt(intVal, scale) {
  if (scale <= 0) return String(intVal);
  const neg = intVal < 0n;
  const abs = neg ? -intVal : intVal;
  const s = abs.toString().padStart(scale + 1, '0');
  const whole = s.slice(0, s.length - scale);
  const frac = s.slice(s.length - scale);
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

function pow10(n) {
  return (10n ** BigInt(n)).toString();
}

function walkNode(expr, fn) {
  if (!expr || typeof expr !== 'object') return;
  fn(expr);
  for (const k of ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index', 'body']) {
    if (expr[k]) walkNode(expr[k], fn);
  }
  for (const k of ['elements', 'args']) {
    if (Array.isArray(expr[k])) expr[k].forEach(c => walkNode(c, fn));
  }
}

const AGG_FUNCS = new Set(['sum', 'count', 'len']);

function aggCallKey(node) {
  const argPath = node.args?.[0] ? pathToString(node.args[0]) : 'arg';
  return `@agg(${node.name}:${argPath || 'expr'})`;
}

function quantWitnessKey(node) {
  const colPath = pathToString(node.collection) || 'col';
  return `@quant(${node.quantifier}:${node.variable}:${colPath})`;
}

export function createSmtContext(spec) {
  const stateAliases = new Set(spec.stateAliases ?? ['state']);
  if (spec.kind === 'slice' && spec.target) {
    const aggName = spec.target.split('.')[0];
    const parts = aggName.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').split(' ').map(s => s.toLowerCase());
    stateAliases.add(aggName.toLowerCase());
    if (parts.length > 0) stateAliases.add(parts[parts.length - 1]);
  }

  const stringPool = new Map([['', 0]]);
  const stringReverse = [''];
  const internString = str => {
    if (!stringPool.has(str)) {
      stringPool.set(str, stringReverse.length);
      stringReverse.push(str);
    }
    return stringPool.get(str);
  };

  // Track scalar variables, maps, optional flags, externs, quantifiers, and numeric scales
  const vars = new Map(); // smtName -> { smtName, displayPath, sort, scale, isEnum, isState, basePath }
  const maps = new Map(); // mapPath -> { smtBase, displayPath, keySort, valSort, valScale, valIsEnum, isState, subfields: Map }
  const externs = new Map(); // index -> { smtName, arity, argSorts }
  const recordMembers = new Map(); // parentPath -> Set<fieldName>
  const quantifiers = new Map(); // quantKey -> { key, smtName, quantifier, variable, colPath, body }

  const isStatePath = p => {
    const head = p.split('.')[0];
    return stateAliases.has(head);
  };

  const lookupBoundType = p => {
    if (!spec.resolvedSymbols) return null;
    for (const [k, v] of spec.resolvedSymbols) {
      if (k.endsWith(`::${p}`)) return v.type;
    }
    return null;
  };

  const registerScalar = (displayPath, hints = {}) => {
    const smtName = `v__${sanitizeId(displayPath)}`;
    const existing = vars.get(smtName);
    const bt = lookupBoundType(displayPath);
    const effBt = bt?.kind === 'optional' ? bt.element : bt;
    const boundSort = effBt?.kind === 'bool' ? 'Bool' : 'Int';
    const boundScale = effBt?.kind === 'decimal' ? (effBt.scale ?? 2) : 0;
    const boundEnum = effBt?.kind === 'string';

    if (!existing) {
      vars.set(smtName, {
        smtName,
        displayPath,
        sort: hints.sort ?? boundSort,
        scale: hints.scale ?? boundScale,
        isEnum: hints.isEnum ?? boundEnum,
        isState: isStatePath(displayPath),
        nonNegative: Boolean(hints.nonNegative),
      });
    } else {
      if (hints.sort === 'Bool') existing.sort = 'Bool';
      if (typeof hints.scale === 'number' && hints.scale > existing.scale) existing.scale = hints.scale;
      if (hints.isEnum) existing.isEnum = true;
      if (hints.nonNegative) existing.nonNegative = true;
    }
    const dotIdx = displayPath.lastIndexOf('.');
    if (dotIdx > 0) {
      const parent = displayPath.slice(0, dotIdx);
      const field = displayPath.slice(dotIdx + 1);
      if (field !== '__present' && !stateAliases.has(parent)) {
        if (!recordMembers.has(parent)) recordMembers.set(parent, new Set());
        recordMembers.get(parent).add(field);
      }
    }
    return vars.get(smtName);
  };

  const registerMap = (displayPath, hints = {}) => {
    const smtBase = `m__${sanitizeId(displayPath)}`;
    const bt = lookupBoundType(displayPath);
    if (!maps.has(displayPath)) {
      maps.set(displayPath, {
        smtBase,
        displayPath,
        keySort: 'Int',
        valSort: hints.valSort ?? 'Int',
        valScale: hints.valScale ?? (bt?.value?.kind === 'decimal' ? (bt.value.scale ?? 2) : 0),
        valIsEnum: hints.valIsEnum ?? (bt?.value?.kind === 'string'),
        isState: isStatePath(displayPath),
        subfields: new Map(),
      });
    } else {
      const m = maps.get(displayPath);
      if (hints.valIsEnum) m.valIsEnum = true;
      if (typeof hints.valScale === 'number' && hints.valScale > m.valScale) m.valScale = hints.valScale;
    }
    return maps.get(displayPath);
  };

  const scanExpr = expr => {
    walkNode(expr, node => {
      if (node.kind === 'string') internString(node.value);
      if (node.kind === 'extern-ref') {
        if (!externs.has(node.index)) {
          externs.set(node.index, {
            smtName: `ext__${node.index}`,
            arity: node.args.length,
            argSorts: node.args.map(() => 'Int'),
          });
        }
      }
      if (node.kind === 'in') {
        if (isSimplePath(node.target)) {
          registerMap(pathToString(node.target));
        }
        if (node.target.kind === 'set') {
          const allStr = node.target.elements.every(e => e.kind === 'string');
          if (allStr && isSimplePath(node.element)) registerScalar(pathToString(node.element), { isEnum: true });
        }
        if (node.target.kind === 'interval' && isSimplePath(node.element)) {
          registerScalar(pathToString(node.element), { sort: 'Int' });
        }
      }
      if (node.kind === 'index' && isSimplePath(node.collection)) {
        registerMap(pathToString(node.collection));
      }
      if (node.kind === 'member' && node.object?.kind === 'index' && isSimplePath(node.object.collection)) {
        const m = registerMap(pathToString(node.object.collection));
        if (!m.subfields.has(node.field)) {
          m.subfields.set(node.field, { smtName: `${m.smtBase}__f_${sanitizeId(node.field)}`, sort: 'Int', isEnum: false, scale: 0 });
        }
      }
      if (node.kind === 'compare') {
        const lStr = node.left.kind === 'string';
        const rStr = node.right.kind === 'string';
        const lBool = node.left.kind === 'boolean';
        const rBool = node.right.kind === 'boolean';
        const lNum = node.left.kind === 'number';
        const rNum = node.right.kind === 'number';
        if (lStr || rStr) {
          const other = lStr ? node.right : node.left;
          if (isSimplePath(other)) registerScalar(pathToString(other), { isEnum: true });
          if (other.kind === 'index' && isSimplePath(other.collection)) registerMap(pathToString(other.collection), { valIsEnum: true });
        }
        if (lBool || rBool) {
          const other = lBool ? node.right : node.left;
          if (isSimplePath(other)) registerScalar(pathToString(other), { sort: 'Bool' });
        }
        if (lNum && node.left.scale > 0 && isSimplePath(node.right)) {
          registerScalar(pathToString(node.right), { sort: 'Int', scale: node.left.scale });
        }
        if (rNum && node.right.scale > 0 && isSimplePath(node.left)) {
          registerScalar(pathToString(node.left), { sort: 'Int', scale: node.right.scale });
        }
      }
      if (node.kind === 'emptiness' && isSimplePath(node.target)) {
        const p = pathToString(node.target);
        const bt = lookupBoundType(p);
        if (bt?.kind === 'optional' || node.optionSyntax) {
          registerScalar(`${p}.__present`, { sort: 'Bool' });
        } else {
          registerScalar(p, { isEnum: true });
        }
      }
      if (node.kind === 'not' && isSimplePath(node.argument)) {
        registerScalar(pathToString(node.argument), { sort: 'Bool' });
      }
      if (node.kind === 'binary') {
        if (isSimplePath(node.left)) registerScalar(pathToString(node.left), { sort: 'Bool' });
        if (isSimplePath(node.right)) registerScalar(pathToString(node.right), { sort: 'Bool' });
      }
      if (node.kind === 'host') {
        registerScalar(`@host(${node.name})`, { sort: 'Int' });
      }
      if (node.kind === 'call' && AGG_FUNCS.has(node.name)) {
        const key = aggCallKey(node);
        const colType = node.args?.[0] && isSimplePath(node.args[0]) ? lookupBoundType(pathToString(node.args[0])) : null;
        const sumScale = colType?.element?.kind === 'decimal' ? (colType.element.scale ?? 2) : 0;
        registerScalar(key, {
          sort: 'Int',
          scale: node.name === 'sum' ? sumScale : 0,
          nonNegative: node.name === 'len' || node.name === 'count',
        });
      }
      if (node.kind === 'quantifier') {
        const qKey = quantWitnessKey(node);
        const qInfo = registerScalar(qKey, { sort: 'Bool' });
        if (!quantifiers.has(qKey)) {
          quantifiers.set(qKey, {
            key: qKey,
            smtName: qInfo.smtName,
            quantifier: node.quantifier,
            variable: node.variable,
            colPath: pathToString(node.collection) || 'col',
            body: node.body,
          });
        }
      }
    });
  };

  for (const ax of spec.axioms) {
    if (ax.kind === 'invariant') scanExpr(ax.expandedExpr);
  }
  for (const rule of spec.rules) {
    scanExpr(rule.expandedGuard);
    if (isSimplePath(rule.expandedGuard)) registerScalar(pathToString(rule.expandedGuard), { sort: 'Bool' });
    for (const assign of rule.post) {
      const lhs = assign.target.segments.join('.');
      if (assign.expandedIndex) {
        registerMap(lhs, { valIsEnum: assign.expandedValue.kind === 'string' });
        scanExpr(assign.expandedIndex);
      } else {
        registerScalar(lhs, { isEnum: assign.expandedValue.kind === 'string' });
        const bt = lookupBoundType(lhs);
        if (bt?.kind === 'optional' && assign.expandedValue.kind === 'none') {
          registerScalar(`${lhs}.__present`, { sort: 'Bool' });
        }
      }
      scanExpr(assign.expandedValue);
    }
  }

  // Register any remaining bare paths as Int scalars (skipping state receiver aliases)
  const ensurePaths = expr => {
    walkNode(expr, node => {
      if (node.kind === 'var') {
        if (!maps.has(node.name) && !stateAliases.has(node.name)) registerScalar(node.name);
      } else if (node.kind === 'member' && isSimplePath(node)) {
        const p = pathToString(node);
        if (!maps.has(p)) registerScalar(p);
      }
    });
  };
  for (const ax of spec.axioms) {
    if (ax.kind === 'invariant') ensurePaths(ax.expandedExpr);
  }
  for (const rule of spec.rules) {
    ensurePaths(rule.expandedGuard);
    for (const assign of rule.post) {
      if (assign.expandedIndex) ensurePaths(assign.expandedIndex);
      ensurePaths(assign.expandedValue);
    }
  }

  // Propagate decimal scales across arithmetic & comparisons (2 fixed-point passes)
  const exprScale = expr => {
    if (!expr) return 0;
    if (expr.kind === 'number') return expr.scale ?? 0;
    if (isSimplePath(expr)) return vars.get(`v__${sanitizeId(pathToString(expr))}`)?.scale ?? 0;
    if (expr.kind === 'index' && isSimplePath(expr.collection)) return maps.get(pathToString(expr.collection))?.valScale ?? 0;
    if (expr.kind === 'arith') {
      if (expr.op === '*') return exprScale(expr.left) + exprScale(expr.right);
      return Math.max(exprScale(expr.left), exprScale(expr.right));
    }
    if (expr.kind === 'neg') return exprScale(expr.argument);
    return 0;
  };

  const exprIsEnum = expr => {
    if (!expr) return false;
    if (expr.kind === 'string') return true;
    if (isSimplePath(expr)) {
      const p = pathToString(expr);
      return Boolean(vars.get(`v__${sanitizeId(p)}`)?.isEnum || lookupBoundType(p)?.kind === 'string');
    }
    if (expr.kind === 'index' && isSimplePath(expr.collection)) {
      const mp = pathToString(expr.collection);
      return Boolean(maps.get(mp)?.valIsEnum || lookupBoundType(mp)?.value?.kind === 'string');
    }
    return false;
  };
  const markPathEnum = expr => {
    if (isSimplePath(expr)) registerScalar(pathToString(expr), { isEnum: true });
    else if (expr?.kind === 'index' && isSimplePath(expr.collection)) registerMap(pathToString(expr.collection), { valIsEnum: true });
  };

  for (let pass = 0; pass < 3; pass += 1) {
    const propagate = expr => walkNode(expr, node => {
      if (node.kind === 'arith' && (node.op === '+' || node.op === '-')) {
        const s = Math.max(exprScale(node.left), exprScale(node.right));
        if (s > 0) {
          if (isSimplePath(node.left)) registerScalar(pathToString(node.left), { scale: s });
          if (isSimplePath(node.right)) registerScalar(pathToString(node.right), { scale: s });
        }
      }
      if (node.kind === 'compare') {
        const ls = exprScale(node.left);
        const rs = exprScale(node.right);
        const hasMul = node.left.kind === 'arith' && node.left.op === '*' || node.right.kind === 'arith' && node.right.op === '*';
        if (!hasMul && ls !== rs) {
          const maxS = Math.max(ls, rs);
          if (isSimplePath(node.left)) registerScalar(pathToString(node.left), { scale: maxS });
          if (isSimplePath(node.right)) registerScalar(pathToString(node.right), { scale: maxS });
        }
        if (exprIsEnum(node.left) || exprIsEnum(node.right)) {
          markPathEnum(node.left);
          markPathEnum(node.right);
        }
      }
      if (node.kind === 'in' && node.target.kind === 'interval') {
        const s = Math.max(exprScale(node.element), exprScale(node.target.min), exprScale(node.target.max));
        if (s > 0) {
          if (isSimplePath(node.element)) registerScalar(pathToString(node.element), { scale: s });
          if (isSimplePath(node.target.min)) registerScalar(pathToString(node.target.min), { scale: s });
          if (isSimplePath(node.target.max)) registerScalar(pathToString(node.target.max), { scale: s });
        }
      }
    });
    for (const ax of spec.axioms) if (ax.kind === 'invariant') propagate(ax.expandedExpr);
    for (const r of spec.rules) {
      propagate(r.expandedGuard);
      for (const assign of r.post) {
        propagate(assign.expandedValue);
        const lhs = assign.target.segments.join('.');
        const lhsEnum = assign.expandedIndex
          ? Boolean(maps.get(lhs)?.valIsEnum || lookupBoundType(lhs)?.value?.kind === 'string')
          : Boolean(vars.get(`v__${sanitizeId(lhs)}`)?.isEnum || lookupBoundType(lhs)?.kind === 'string');
        const rhsEnum = exprIsEnum(assign.expandedValue);
        if (lhsEnum || rhsEnum) {
          if (assign.expandedIndex) registerMap(lhs, { valIsEnum: true });
          else registerScalar(lhs, { isEnum: true });
          markPathEnum(assign.expandedValue);
        }
      }
    }
  }

  // Reserve sentinel for unknown string outside known literals
  internString('__OTHER__');

  function encodeExpr(expr, { suffix = '', paramSuffix = '' } = {}) {
    const varName = p => {
      const info = vars.get(`v__${sanitizeId(p)}`);
      const base = info ? info.smtName : `v__${sanitizeId(p)}`;
      if (info?.isState) return suffix ? `${base}${suffix}` : base;
      return paramSuffix ? `${base}${paramSuffix}` : base;
    };
    const mapName = (p, part) => {
      const info = maps.get(p);
      const base = info ? info.smtBase : `m__${sanitizeId(p)}`;
      if (info?.isState) return suffix ? `${base}${suffix}__${part}` : `${base}__${part}`;
      return paramSuffix ? `${base}${paramSuffix}__${part}` : `${base}__${part}`;
    };

    const encVal = (node, targetScale = null) => {
      if (node.kind === 'boolean') return node.value ? 'true' : 'false';
      if (node.kind === 'none') return '0';
      if (node.kind === 'string') return String(internString(node.value));
      if (node.kind === 'number') {
        const s = targetScale ?? node.scale ?? 0;
        return scaleInt(node.value, s);
      }
      if (node.kind === 'neg') return `(- ${encVal(node.argument, targetScale)})`;
      if (node.kind === 'host') return varName(`@host(${node.name})`);
      if (node.kind === 'call' && AGG_FUNCS.has(node.name)) {
        const key = aggCallKey(node);
        const raw = varName(key);
        const curScale = vars.get(`v__${sanitizeId(key)}`)?.scale ?? 0;
        if (targetScale !== null && targetScale > curScale) {
          return `(* ${raw} ${pow10(targetScale - curScale)})`;
        }
        return raw;
      }
      if (node.kind === 'extern-ref') {
        const ext = externs.get(node.index);
        if (!ext || node.args.length === 0) return `ext__${node.index}`;
        return `(ext__${node.index} ${node.args.map(a => encVal(a)).join(' ')})`;
      }
      if (node.kind === 'member' && node.object?.kind === 'index' && isSimplePath(node.object.collection)) {
        const mp = pathToString(node.object.collection);
        const keySmt = encVal(node.object.index);
        const fieldPart = `f_${sanitizeId(node.field)}`;
        return `(select ${mapName(mp, fieldPart)} ${keySmt})`;
      }
      if (node.kind === 'index' && isSimplePath(node.collection)) {
        const mp = pathToString(node.collection);
        const keySmt = encVal(node.index);
        const raw = `(select ${mapName(mp, 'val')} ${keySmt})`;
        const curScale = maps.get(mp)?.valScale ?? 0;
        if (targetScale !== null && targetScale > curScale) {
          return `(* ${raw} ${pow10(targetScale - curScale)})`;
        }
        return raw;
      }
      if (isSimplePath(node)) {
        const p = pathToString(node);
        const raw = varName(p);
        const curScale = vars.get(`v__${sanitizeId(p)}`)?.scale ?? 0;
        if (targetScale !== null && targetScale > curScale) {
          return `(* ${raw} ${pow10(targetScale - curScale)})`;
        }
        return raw;
      }
      if (node.kind === 'arith') {
        if (node.op === '*') {
          const lSmt = encVal(node.left);
          const rSmt = encVal(node.right);
          const prodScale = exprScale(node.left) + exprScale(node.right);
          const prod = `(* ${lSmt} ${rSmt})`;
          if (targetScale !== null && targetScale > prodScale) {
            return `(* ${prod} ${pow10(targetScale - prodScale)})`;
          }
          return prod;
        }
        const s = targetScale ?? Math.max(exprScale(node.left), exprScale(node.right));
        return `(${node.op} ${encVal(node.left, s)} ${encVal(node.right, s)})`;
      }
      return encBool(node);
    };

    const encBool = node => {
      if (!node) return 'true';
      if (node.kind === 'boolean') return node.value ? 'true' : 'false';
      if (node.kind === 'not') return `(not ${encBool(node.argument)})`;
      if (node.kind === 'binary') {
        return `(${node.op} ${encBool(node.left)} ${encBool(node.right)})`;
      }
      if (node.kind === 'compare') {
        // Composite record equality (e.g. amount == order.amount when subfields exist)
        if ((node.op === '==' || node.op === '!=') && isSimplePath(node.left) && isSimplePath(node.right)) {
          const lp = pathToString(node.left);
          const rp = pathToString(node.right);
          const lFields = recordMembers.get(lp);
          if (lFields && lFields.size > 0) {
            const parts = [...lFields].sort().map(f => {
              const lSub = `${lp}.${f}`;
              const rSub = `${rp}.${f}`;
              registerScalar(rSub, { scale: vars.get(`v__${sanitizeId(lSub)}`)?.scale ?? 0, isEnum: vars.get(`v__${sanitizeId(lSub)}`)?.isEnum ?? false });
              return `(= ${varName(lSub)} ${varName(rSub)})`;
            });
            const eq = parts.length === 1 ? parts[0] : `(and ${parts.join(' ')})`;
            return node.op === '==' ? eq : `(not ${eq})`;
          }
        }
        const s = Math.max(exprScale(node.left), exprScale(node.right));
        const lSmt = encVal(node.left, s);
        const rSmt = encVal(node.right, s);
        if (node.op === '==') return `(= ${lSmt} ${rSmt})`;
        if (node.op === '!=') return `(not (= ${lSmt} ${rSmt}))`;
        return `(${node.op} ${lSmt} ${rSmt})`;
      }
      if (node.kind === 'in') {
        if (node.target.kind === 'set') {
          const elSmt = encVal(node.element);
          const opts = node.target.elements.map(e => `(= ${elSmt} ${encVal(e)})`);
          return opts.length === 1 ? opts[0] : `(or ${opts.join(' ')})`;
        }
        if (node.target.kind === 'interval') {
          const s = Math.max(exprScale(node.element), exprScale(node.target.min), exprScale(node.target.max));
          const elSmt = encVal(node.element, s);
          const minSmt = encVal(node.target.min, s);
          const maxSmt = encVal(node.target.max, s);
          const loOp = node.target.leftInclusive ? '>=' : '>';
          const hiOp = node.target.rightInclusive ? '<=' : '<';
          return `(and (${loOp} ${elSmt} ${minSmt}) (${hiOp} ${elSmt} ${maxSmt}))`;
        }
        if (isSimplePath(node.target)) {
          const mp = pathToString(node.target);
          return `(select ${mapName(mp, 'present')} ${encVal(node.element)})`;
        }
      }
      if (node.kind === 'quantifier') {
        return varName(quantWitnessKey(node));
      }
      if (node.kind === 'emptiness' && isSimplePath(node.target)) {
        const p = pathToString(node.target);
        const presKey = `v__${sanitizeId(`${p}.__present`)}`;
        if (vars.has(presKey)) {
          const sym = varName(`${p}.__present`);
          return node.check === 'empty' ? `(not ${sym})` : sym;
        }
        const sym = varName(p);
        return node.check === 'empty' ? `(= ${sym} 0)` : `(not (= ${sym} 0))`;
      }
      return encVal(node);
    };

    return encBool(expr);
  }

  function emitDeclarations({ suffixes = [''], paramSuffixes = [''] } = {}) {
    const lines = [];
    for (const suffix of suffixes) {
      for (const info of vars.values()) {
        if (!info.isState) continue;
        lines.push(`(declare-const ${info.smtName}${suffix} ${info.sort})`);
        if (info.nonNegative && info.sort === 'Int') {
          lines.push(`(assert (>= ${info.smtName}${suffix} 0))`);
        }
      }
      for (const m of maps.values()) {
        if (!m.isState) continue;
        lines.push(`(declare-const ${m.smtBase}${suffix}__present (Array ${m.keySort} Bool))`);
        lines.push(`(declare-const ${m.smtBase}${suffix}__val (Array ${m.keySort} ${m.valSort}))`);
        for (const sf of m.subfields.values()) {
          const name = suffix ? `${m.smtBase}${suffix}__f_${sf.smtName.split('__f_')[1]}` : sf.smtName;
          lines.push(`(declare-const ${name} (Array ${m.keySort} ${sf.sort}))`);
        }
      }
    }
    for (const pSuffix of paramSuffixes) {
      for (const info of vars.values()) {
        if (info.isState) continue;
        lines.push(`(declare-const ${info.smtName}${pSuffix} ${info.sort})`);
        if (info.nonNegative && info.sort === 'Int') {
          lines.push(`(assert (>= ${info.smtName}${pSuffix} 0))`);
        }
      }
      for (const m of maps.values()) {
        if (m.isState) continue;
        lines.push(`(declare-const ${m.smtBase}${pSuffix}__present (Array ${m.keySort} Bool))`);
        lines.push(`(declare-const ${m.smtBase}${pSuffix}__val (Array ${m.keySort} ${m.valSort}))`);
      }
    }
    for (const ext of externs.values()) {
      if (ext.arity === 0) {
        lines.push(`(declare-const ${ext.smtName} Bool)`);
      } else {
        lines.push(`(declare-fun ${ext.smtName} (${ext.argSorts.join(' ')}) Bool)`);
      }
    }
    const baseStateSuffix = suffixes[0] ?? '';
    for (const pSuffix of paramSuffixes) {
      for (const q of quantifiers.values()) {
        if (!q.body) continue;
        const bodySmt = encodeExpr(q.body, { suffix: baseStateSuffix, paramSuffix: pSuffix });
        lines.push(`(assert (= ${q.smtName}${pSuffix} ${bodySmt}))`);
      }
    }
    return lines;
  }

  function encodePostTransition(postAssignments, fromSuffix, toSuffix, { paramSuffix = '' } = {}) {
    const modifiedScalars = new Set();
    const modifiedMaps = new Set();
    const assertions = [];

    for (const assign of postAssignments) {
      const lhsPath = assign.target.segments.join('.');
      if (assign.expandedIndex) {
        modifiedMaps.add(lhsPath);
        const m = maps.get(lhsPath);
        const fromPres = `${m.smtBase}${fromSuffix}__present`;
        const toPres = `${m.smtBase}${toSuffix}__present`;
        const fromVal = `${m.smtBase}${fromSuffix}__val`;
        const toVal = `${m.smtBase}${toSuffix}__val`;
        const keySmt = encodeExpr(assign.expandedIndex, { suffix: fromSuffix, paramSuffix });
        const valSmt = encodeExpr(assign.expandedValue, { suffix: fromSuffix, paramSuffix });
        assertions.push(`(= ${toPres} (store ${fromPres} ${keySmt} true))`);
        assertions.push(`(= ${toVal} (store ${fromVal} ${keySmt} ${valSmt}))`);
      } else {
        modifiedScalars.add(lhsPath);
        const info = vars.get(`v__${sanitizeId(lhsPath)}`);
        const lFields = recordMembers.get(lhsPath);
        if (lFields && lFields.size > 0 && isSimplePath(assign.expandedValue)) {
          const rhsBase = pathToString(assign.expandedValue);
          for (const f of [...lFields].sort()) {
            const subLhs = `${lhsPath}.${f}`;
            modifiedScalars.add(subLhs);
            const subRhs = `${rhsBase}.${f}`;
            const subInfo = vars.get(`v__${sanitizeId(subLhs)}`);
            const rhsInfo = vars.get(`v__${sanitizeId(subRhs)}`);
            if (subInfo && rhsInfo) {
              let rhsSym = rhsInfo.smtName;
              if (rhsInfo.isState && fromSuffix) rhsSym = `${rhsInfo.smtName}${fromSuffix}`;
              else if (!rhsInfo.isState && paramSuffix) rhsSym = `${rhsInfo.smtName}${paramSuffix}`;
              assertions.push(`(= ${subInfo.smtName}${toSuffix} ${rhsSym})`);
            }
          }
        } else if (info) {
          const presInfo = vars.get(`v__${sanitizeId(`${lhsPath}.__present`)}`);
          if (assign.expandedValue.kind === 'none') {
            if (presInfo) {
              modifiedScalars.add(presInfo.displayPath);
              assertions.push(`(= ${presInfo.smtName}${toSuffix} false)`);
            }
            const zeroVal = info.sort === 'Bool' ? 'false' : '0';
            assertions.push(`(= ${info.smtName}${toSuffix} ${zeroVal})`);
          } else {
            if (presInfo) {
              modifiedScalars.add(presInfo.displayPath);
              const rhsPres = isSimplePath(assign.expandedValue)
                ? vars.get(`v__${sanitizeId(`${pathToString(assign.expandedValue)}.__present`)}`)
                : null;
              if (rhsPres) {
                let rhsPresSym = rhsPres.smtName;
                if (rhsPres.isState && fromSuffix) rhsPresSym = `${rhsPres.smtName}${fromSuffix}`;
                else if (!rhsPres.isState && paramSuffix) rhsPresSym = `${rhsPres.smtName}${paramSuffix}`;
                assertions.push(`(= ${presInfo.smtName}${toSuffix} ${rhsPresSym})`);
              } else {
                assertions.push(`(= ${presInfo.smtName}${toSuffix} true)`);
              }
            }
            const valSmt = encodeExpr(assign.expandedValue, { suffix: fromSuffix, paramSuffix });
            assertions.push(`(= ${info.smtName}${toSuffix} ${valSmt})`);
          }
        }
      }
    }

    // Frame conditions for unmodified state variables & maps
    for (const info of vars.values()) {
      if (!info.isState || modifiedScalars.has(info.displayPath)) continue;
      assertions.push(`(= ${info.smtName}${toSuffix} ${info.smtName}${fromSuffix})`);
    }
    for (const m of maps.values()) {
      if (!m.isState || modifiedMaps.has(m.displayPath)) continue;
      assertions.push(`(= ${m.smtBase}${toSuffix}__present ${m.smtBase}${fromSuffix}__present)`);
      assertions.push(`(= ${m.smtBase}${toSuffix}__val ${m.smtBase}${fromSuffix}__val)`);
      for (const fieldName of m.subfields.keys()) {
        const fId = sanitizeId(fieldName);
        assertions.push(`(= ${m.smtBase}${toSuffix}__f_${fId} ${m.smtBase}${fromSuffix}__f_${fId})`);
      }
    }
    return assertions;
  }

  function decodeModel(rawModel) {
    const decoded = {};
    for (const [smtName, rawVal] of Object.entries(rawModel)) {
      const info = vars.get(smtName);
      if (!info) continue;
      if (info.sort === 'Bool') {
        decoded[info.displayPath] = rawVal === 'true' || rawVal === true;
      } else if (info.isEnum) {
        const idx = Number(rawVal);
        decoded[info.displayPath] = stringReverse[idx] ?? `enum#${idx}`;
      } else if (typeof rawVal === 'bigint' || /^-?\d+$/u.test(String(rawVal))) {
        const bi = BigInt(rawVal);
        decoded[info.displayPath] = info.scale > 0 ? formatScaledInt(bi, info.scale) : Number(bi);
      } else {
        decoded[info.displayPath] = rawVal;
      }
    }
    return decoded;
  }

  return {
    vars,
    maps,
    externs,
    stringPool,
    stringReverse,
    encodeExpr,
    emitDeclarations,
    encodePostTransition,
    decodeModel,
  };
}

function classifyRuleOutcome(rule) {
  const kinds = new Set(rule.actions.map(a => a.kind));
  const hasReject = rule.actions.some(a => a.kind === 'reject' && a.modality === 'SHALL');
  const hasPositive = rule.actions.some(a => ['emit', 'transition', 'dispatch', 'pin', 'respond', 'expose'].includes(a.kind) && a.modality === 'SHALL');
  const hasSucceedEmpty = rule.actions.some(a => a.kind === 'succeed-empty' && a.modality === 'SHALL');
  return { kinds, hasReject, hasPositive, hasSucceedEmpty };
}

function actionsConflict(r1, r2) {
  const o1 = classifyRuleOutcome(r1);
  const o2 = classifyRuleOutcome(r2);
  if ((o1.hasPositive && o2.hasReject) || (o2.hasPositive && o1.hasReject)) return true;
  if ((o1.hasPositive && o2.hasSucceedEmpty) || (o2.hasPositive && o1.hasSucceedEmpty)) return true;
  // Direct SHALL X vs SHALL NOT X conflict
  for (const a1 of r1.actions) {
    for (const a2 of r2.actions) {
      if (a1.kind === a2.kind && a1.modality !== a2.modality) {
        const t1 = a1.event ?? a1.target ?? a1.code ?? '';
        const t2 = a2.event ?? a2.target ?? a2.code ?? '';
        if (t1 === t2) return true;
      }
    }
  }
  return false;
}

export function buildVerificationScripts(spec) {
  const ctx = createSmtContext(spec);
  const logic = spec.theory?.logic ?? 'QF_AUFLIA';
  const invariantAxioms = spec.axioms.filter(a => a.kind === 'invariant');

  // Group rules by command
  const commandGroups = new Map();
  for (const rule of spec.rules) {
    const cmd = rule.command ?? '*';
    if (!commandGroups.has(cmd)) commandGroups.set(cmd, []);
    commandGroups.get(cmd).push(rule);
  }

  const jobs = [];
  const headerLines = [
    `; co-arising EARS 1.0 -> SMT-LIB 2 (${spec.target})`,
    '(set-option :produce-models true)',
    '(set-option :produce-unsat-cores true)',
    `(set-logic ${logic})`,
  ];

  const baseDecls = ctx.emitDeclarations({ suffixes: [''] });
  const nextDecls = ctx.emitDeclarations({ suffixes: ['', '__next'] });
  const axiomAsserts = invariantAxioms.map(ax => `(assert (! ${ctx.encodeExpr(ax.expandedExpr)} :named ${sanitizeId(ax.id)}))`);

  for (const [command, rules] of commandGroups) {
    // 1. Mutual exclusion conflict checks
    for (let i = 0; i < rules.length; i += 1) {
      for (let j = i + 1; j < rules.length; j += 1) {
        if (!actionsConflict(rules[i], rules[j])) continue;
        const g1 = ctx.encodeExpr(rules[i].expandedGuard);
        const g2 = ctx.encodeExpr(rules[j].expandedGuard);
        const smt2 = [
          ...headerLines,
          ...baseDecls,
          ...axiomAsserts,
          '(push 1)',
          `  (assert (! ${g1} :named ${sanitizeId(rules[i].id)}))`,
          `  (assert (! ${g2} :named ${sanitizeId(rules[j].id)}))`,
          '  (check-sat)',
          '  (get-model)',
          '(pop 1)',
        ].join('\n');
        jobs.push({
          kind: 'conflict',
          command,
          ruleIds: [rules[i].id, rules[j].id],
          expect: 'unsat',
          smt2,
        });
      }
    }

    // 2. Logic gap (completeness) check
    if (rules.length > 0) {
      const guards = rules.map(r => ctx.encodeExpr(r.expandedGuard));
      const disj = guards.length === 1 ? guards[0] : `(or ${guards.join(' ')})`;
      const smt2 = [
        ...headerLines,
        ...baseDecls,
        ...axiomAsserts,
        '(push 1)',
        `  (assert (not ${disj}))`,
        '  (check-sat)',
        '  (get-model)',
        '(pop 1)',
      ].join('\n');
      jobs.push({
        kind: 'gap',
        command,
        ruleIds: rules.map(r => r.id),
        expect: 'unsat',
        smt2,
      });
    }

    // 3. Invariant inductive proof for rules with post:
    if (invariantAxioms.length > 0) {
      for (const rule of rules) {
        if (rule.post.length === 0) continue;
        const postAsserts = ctx.encodePostTransition(rule.post, '', '__next');
        const nextInvs = invariantAxioms.map(ax => ctx.encodeExpr(ax.expandedExpr, { suffix: '__next' }));
        const nextConj = nextInvs.length === 1 ? nextInvs[0] : `(and ${nextInvs.join(' ')})`;
        const smt2 = [
          ...headerLines,
          ...nextDecls,
          ...axiomAsserts,
          '(push 1)',
          `  (assert (! ${ctx.encodeExpr(rule.expandedGuard)} :named ${sanitizeId(rule.id)}))`,
          ...postAsserts.map(a => `  (assert ${a})`),
          `  (assert (not ${nextConj}))`,
          '  (check-sat)',
          '  (get-model)',
          '(pop 1)',
        ].join('\n');
        jobs.push({
          kind: 'invariant',
          command,
          ruleIds: [rule.id],
          axiomIds: invariantAxioms.map(a => a.id),
          expect: 'unsat',
          smt2,
        });
      }
    }

    // 4. Dead rule detection + 5. Boundary witness synthesis per rule
    for (const rule of rules) {
      const g = ctx.encodeExpr(rule.expandedGuard);
      const smt2 = [
        ...headerLines,
        ...baseDecls,
        ...axiomAsserts,
        '(push 1)',
        `  (assert (! ${g} :named ${sanitizeId(rule.id)}))`,
        '  (check-sat)',
        '  (get-model)',
        '  (get-unsat-core)',
        '(pop 1)',
      ].join('\n');
      jobs.push({
        kind: 'reachability-and-witness',
        command,
        ruleIds: [rule.id],
        expect: 'sat',
        smt2,
      });
    }
  }

  // Combined reference .smt2 script for inspection & bilingual equivalence checking
  const combinedSmt2 = [
    ...headerLines,
    ...nextDecls,
    ...axiomAsserts,
    ...spec.rules.map(r => `; rule [${r.id}] (${r.command ?? '*'}): ${ctx.encodeExpr(r.expandedGuard)}`),
  ].join('\n');

  return { ctx, logic, jobs, combinedSmt2 };
}
