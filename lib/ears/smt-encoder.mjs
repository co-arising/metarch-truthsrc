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

function walkNode(expr, fn, { skipQuantBody = false } = {}) {
  if (!expr || typeof expr !== 'object') return;
  fn(expr);
  const childKeys = skipQuantBody && expr.kind === 'quantifier'
    ? ['collection']
    : ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index', 'body'];
  for (const k of childKeys) {
    if (expr[k]) walkNode(expr[k], fn, { skipQuantBody });
  }
  for (const k of ['elements', 'args']) {
    if (Array.isArray(expr[k])) expr[k].forEach(c => walkNode(c, fn, { skipQuantBody }));
  }
}

function extractIndexMemberChain(node) {
  if (!node || node.kind !== 'member') return null;
  const fields = [];
  let cur = node;
  while (cur?.kind === 'member') {
    fields.unshift(cur.field);
    cur = cur.object;
  }
  if (cur?.kind === 'index' && isSimplePath(cur.collection) && fields.length > 0) {
    return {
      mapPath: pathToString(cur.collection),
      indexExpr: cur.index,
      fields,
      fieldPath: fields.join('.'),
    };
  }
  return null;
}

function alphaExprKey(expr, boundVar) {
  if (!expr || typeof expr !== 'object') return String(expr);
  switch (expr.kind) {
    case 'var': return expr.name === boundVar ? 'var($0)' : `var(${expr.name})`;
    case 'number': return `num(${expr.value}:${expr.scale ?? 0})`;
    case 'string': return `str(${JSON.stringify(expr.value)})`;
    case 'boolean': return `bool(${expr.value})`;
    case 'none': return 'none';
    case 'member': return `mem(${alphaExprKey(expr.object, boundVar)},${expr.field})`;
    case 'index': return `idx(${alphaExprKey(expr.collection, boundVar)},${alphaExprKey(expr.index, boundVar)})`;
    case 'not': return `not(${alphaExprKey(expr.argument, boundVar)})`;
    case 'neg': return `neg(${alphaExprKey(expr.argument, boundVar)})`;
    case 'binary': return `bin(${expr.op},${alphaExprKey(expr.left, boundVar)},${alphaExprKey(expr.right, boundVar)})`;
    case 'compare': return `cmp(${expr.op},${alphaExprKey(expr.left, boundVar)},${alphaExprKey(expr.right, boundVar)})`;
    case 'arith': return `arith(${expr.op},${alphaExprKey(expr.left, boundVar)},${alphaExprKey(expr.right, boundVar)})`;
    case 'in': return `in(${alphaExprKey(expr.element, boundVar)},${alphaExprKey(expr.target, boundVar)})`;
    case 'set': return `set(${(expr.elements ?? []).map(e => alphaExprKey(e, boundVar)).join(',')})`;
    case 'interval': return `iv(${expr.leftInclusive ? '[' : '('}${alphaExprKey(expr.min, boundVar)},${alphaExprKey(expr.max, boundVar)}${expr.rightInclusive ? ']' : ')'})`;
    case 'emptiness': return `emp(${expr.check},${alphaExprKey(expr.target, boundVar)})`;
    case 'call': return `call(${expr.name},${(expr.args ?? []).map(a => alphaExprKey(a, boundVar)).join(',')})`;
    case 'host': return `host(${expr.name})`;
    case 'extern-ref': return `ext(${expr.index},${(expr.args ?? []).map(a => alphaExprKey(a, boundVar)).join(',')})`;
    case 'quantifier': {
      const innerVar = expr.variable === boundVar ? null : boundVar;
      return `q(${expr.quantifier},${alphaExprKey(expr.collection, boundVar)},${alphaExprKey(expr.body, innerVar ?? expr.variable)})`;
    }
    default: return JSON.stringify(expr);
  }
}

export function substituteBoundVar(expr, varName, targetName) {
  if (!expr || typeof expr !== 'object') return expr;
  switch (expr.kind) {
    case 'var':
      return expr.name === varName ? { kind: 'var', name: targetName } : expr;
    case 'member':
      return { ...expr, object: substituteBoundVar(expr.object, varName, targetName) };
    case 'index':
      return {
        ...expr,
        collection: substituteBoundVar(expr.collection, varName, targetName),
        index: substituteBoundVar(expr.index, varName, targetName),
      };
    case 'not':
    case 'neg':
      return { ...expr, argument: substituteBoundVar(expr.argument, varName, targetName) };
    case 'binary':
    case 'compare':
    case 'arith':
      return {
        ...expr,
        left: substituteBoundVar(expr.left, varName, targetName),
        right: substituteBoundVar(expr.right, varName, targetName),
      };
    case 'in':
      return {
        ...expr,
        element: substituteBoundVar(expr.element, varName, targetName),
        target: substituteBoundVar(expr.target, varName, targetName),
      };
    case 'set':
      return { ...expr, elements: expr.elements.map(e => substituteBoundVar(e, varName, targetName)) };
    case 'interval':
      return {
        ...expr,
        min: substituteBoundVar(expr.min, varName, targetName),
        max: substituteBoundVar(expr.max, varName, targetName),
      };
    case 'emptiness':
      return { ...expr, target: substituteBoundVar(expr.target, varName, targetName) };
    case 'call':
    case 'host':
    case 'extern-ref':
      return { ...expr, args: (expr.args ?? []).map(a => substituteBoundVar(a, varName, targetName)) };
    case 'quantifier':
      return {
        ...expr,
        collection: substituteBoundVar(expr.collection, varName, targetName),
        body: expr.variable === varName ? expr.body : substituteBoundVar(expr.body, varName, targetName),
      };
    default:
      return expr;
  }
}

const AGG_FUNCS = new Set(['sum', 'count', 'len']);

function aggCallKey(node) {
  const argPath = node.args?.[0] ? pathToString(node.args[0]) : 'arg';
  return `@agg(${node.name}:${argPath || 'expr'})`;
}

function quantSignature(node) {
  const colPath = pathToString(node.collection) || 'col';
  return `${node.quantifier}:${colPath}:${alphaExprKey(node.body, node.variable)}`;
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
  const quantifiers = new Map(); // quantKey -> { id, sig, key, smtName, quantifier, variable, elVar, colPath, body }
  const quantBySig = new Map(); // sig -> quantEntry
  const qelColMap = new Map(); // '@qel_0' | '@qdef(col)' -> colPath
  const aggCollections = new Set(); // colPath referenced by len/count/sum/quantifier

  const isStatePath = p => {
    const head = p.split('.')[0];
    return stateAliases.has(head);
  };

  const traverseBoundRecord = (baseType, fields) => {
    let cur = baseType?.kind === 'optional' ? baseType.element : baseType;
    for (const f of fields) {
      if (cur?.kind === 'record' && cur.fields?.[f]) cur = cur.fields[f];
      else if (cur?.kind === 'optional' && cur.element?.kind === 'record' && cur.element.fields?.[f]) cur = cur.element.fields[f];
      else return null;
    }
    return cur;
  };

  const lookupBoundType = p => {
    if (!p) return null;
    // Resolve synthetic quantifier element paths (@qel_0, @qel_0.score, @qdef(items), @qdef(items).score)
    const dot = p.indexOf('.');
    const head = dot >= 0 ? p.slice(0, dot) : p;
    if (qelColMap.has(head)) {
      const colType = lookupBoundType(qelColMap.get(head));
      let elemType = null;
      if (colType?.kind === 'sequence') elemType = colType.element;
      else if (colType?.kind === 'map') elemType = colType.value;
      if (!elemType) return null;
      if (dot < 0) return elemType;
      return traverseBoundRecord(elemType, p.slice(dot + 1).split('.'));
    }
    if (!spec.resolvedSymbols) return null;
    for (const [k, v] of spec.resolvedSymbols) {
      if (k.endsWith(`::${p}`)) return v.type;
    }
    return null;
  };

  const lookupMapSubfieldType = (mapPath, fields) => {
    const bt = lookupBoundType(mapPath);
    if (bt?.kind !== 'map') return null;
    return traverseBoundRecord(bt.value, fields);
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

  const registerMapSubfield = (mapPath, fields, hints = {}) => {
    const m = registerMap(mapPath);
    const fieldPath = fields.join('.');
    const sfType = lookupMapSubfieldType(mapPath, fields);
    const effType = sfType?.kind === 'optional' ? sfType.element : sfType;
    const boundSort = effType?.kind === 'bool' ? 'Bool' : 'Int';
    const boundScale = effType?.kind === 'decimal' ? (effType.scale ?? 2) : 0;
    const boundEnum = effType?.kind === 'string';
    if (!m.subfields.has(fieldPath)) {
      m.subfields.set(fieldPath, {
        fieldPath,
        smtName: `${m.smtBase}__f_${sanitizeId(fieldPath)}`,
        sort: hints.sort ?? boundSort,
        isEnum: hints.isEnum ?? boundEnum,
        scale: hints.scale ?? boundScale,
      });
    } else {
      const sf = m.subfields.get(fieldPath);
      if (hints.sort === 'Bool') sf.sort = 'Bool';
      if (hints.isEnum) sf.isEnum = true;
      if (typeof hints.scale === 'number' && hints.scale > sf.scale) sf.scale = hints.scale;
    }
    return m.subfields.get(fieldPath);
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
          const idxMem = extractIndexMemberChain(node.element);
          if (allStr && idxMem) registerMapSubfield(idxMem.mapPath, idxMem.fields, { isEnum: true });
        }
        if (node.target.kind === 'interval' && isSimplePath(node.element)) {
          registerScalar(pathToString(node.element), { sort: 'Int' });
        }
      }
      if (node.kind === 'index' && isSimplePath(node.collection)) {
        registerMap(pathToString(node.collection));
      }
      const idxMember = extractIndexMemberChain(node);
      if (idxMember) {
        registerMapSubfield(idxMember.mapPath, idxMember.fields);
      }
      if (node.kind === 'compare') {
        const lStr = node.left.kind === 'string';
        const rStr = node.right.kind === 'string';
        const lBool = node.left.kind === 'boolean';
        const rBool = node.right.kind === 'boolean';
        const lNum = node.left.kind === 'number';
        const rNum = node.right.kind === 'number';
        const markOther = (other, hints) => {
          if (isSimplePath(other)) registerScalar(pathToString(other), hints);
          else if (other.kind === 'index' && isSimplePath(other.collection)) {
            registerMap(pathToString(other.collection), {
              ...(hints.isEnum ? { valIsEnum: true } : {}),
              ...(typeof hints.scale === 'number' ? { valScale: hints.scale } : {}),
            });
          } else {
            const im = extractIndexMemberChain(other);
            if (im) registerMapSubfield(im.mapPath, im.fields, hints);
          }
        };
        if (lStr || rStr) {
          markOther(lStr ? node.right : node.left, { isEnum: true });
        }
        if (lBool || rBool) {
          markOther(lBool ? node.right : node.left, { sort: 'Bool' });
        }
        if (lNum && node.left.scale > 0) {
          markOther(node.right, { sort: 'Int', scale: node.left.scale });
        }
        if (rNum && node.right.scale > 0) {
          markOther(node.left, { sort: 'Int', scale: node.right.scale });
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
        const colPath = node.args?.[0] && isSimplePath(node.args[0]) ? pathToString(node.args[0]) : null;
        if (colPath) aggCollections.add(colPath);
        const colType = colPath ? lookupBoundType(colPath) : null;
        const sumScale = colType?.element?.kind === 'decimal' ? (colType.element.scale ?? 2) : 0;
        registerScalar(key, {
          sort: 'Int',
          scale: node.name === 'sum' ? sumScale : 0,
          nonNegative: node.name === 'len' || node.name === 'count',
        });
      }
      if (node.kind === 'quantifier') {
        const colPath = pathToString(node.collection) || 'col';
        aggCollections.add(colPath);
        const sig = quantSignature(node);
        if (!quantBySig.has(sig)) {
          const id = quantBySig.size;
          const elVar = `@qel_${id}`;
          const qKey = `@quant(${node.quantifier}:${elVar}:${colPath})`;
          qelColMap.set(elVar, colPath);
          qelColMap.set(`@qdef(${colPath})`, colPath);
          const qInfo = registerScalar(qKey, { sort: 'Bool' });
          const entry = {
            id,
            sig,
            key: qKey,
            smtName: qInfo.smtName,
            quantifier: node.quantifier,
            variable: node.variable,
            elVar,
            colPath,
            body: node.body,
          };
          quantBySig.set(sig, entry);
          quantifiers.set(qKey, entry);
        }
      }
    }, { skipQuantBody: true });
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

  // Build substituted quantifier body expressions per distinct quantifier & default element
  const quantDerivedExprs = [];
  const quantsByCol = new Map();
  for (const q of quantifiers.values()) {
    if (!quantsByCol.has(q.colPath)) quantsByCol.set(q.colPath, []);
    quantsByCol.get(q.colPath).push(q);
  }
  for (const [colPath, qs] of quantsByCol) {
    const defVar = `@qdef(${colPath})`;
    for (const q of qs) {
      if (!q.body) continue;
      quantDerivedExprs.push(substituteBoundVar(q.body, q.variable, q.elVar));
      quantDerivedExprs.push(substituteBoundVar(q.body, q.variable, defVar));
      for (const other of qs) {
        if (other !== q) {
          quantDerivedExprs.push(substituteBoundVar(q.body, q.variable, other.elVar));
        }
      }
    }
  }
  for (const qExpr of quantDerivedExprs) {
    scanExpr(qExpr);
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
    }, { skipQuantBody: true });
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
  for (const qExpr of quantDerivedExprs) {
    ensurePaths(qExpr);
  }

  // Propagate decimal scales across arithmetic & comparisons (3 fixed-point passes)
  const exprScale = expr => {
    if (!expr) return 0;
    if (expr.kind === 'number') return expr.scale ?? 0;
    if (isSimplePath(expr)) return vars.get(`v__${sanitizeId(pathToString(expr))}`)?.scale ?? 0;
    const im = extractIndexMemberChain(expr);
    if (im) return maps.get(im.mapPath)?.subfields.get(im.fieldPath)?.scale ?? 0;
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
    const im = extractIndexMemberChain(expr);
    if (im) {
      return Boolean(
        maps.get(im.mapPath)?.subfields.get(im.fieldPath)?.isEnum
        || lookupMapSubfieldType(im.mapPath, im.fields)?.kind === 'string',
      );
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
    else {
      const im = extractIndexMemberChain(expr);
      if (im) registerMapSubfield(im.mapPath, im.fields, { isEnum: true });
    }
  };
  const markPathScale = (expr, s) => {
    if (isSimplePath(expr)) registerScalar(pathToString(expr), { scale: s });
    else {
      const im = extractIndexMemberChain(expr);
      if (im) registerMapSubfield(im.mapPath, im.fields, { scale: s });
    }
  };

  for (let pass = 0; pass < 3; pass += 1) {
    const propagate = expr => walkNode(expr, node => {
      if (node.kind === 'arith' && (node.op === '+' || node.op === '-')) {
        const s = Math.max(exprScale(node.left), exprScale(node.right));
        if (s > 0) {
          markPathScale(node.left, s);
          markPathScale(node.right, s);
        }
      }
      if (node.kind === 'compare') {
        const ls = exprScale(node.left);
        const rs = exprScale(node.right);
        const hasMul = node.left.kind === 'arith' && node.left.op === '*' || node.right.kind === 'arith' && node.right.op === '*';
        if (!hasMul && ls !== rs) {
          const maxS = Math.max(ls, rs);
          markPathScale(node.left, maxS);
          markPathScale(node.right, maxS);
        }
        if (exprIsEnum(node.left) || exprIsEnum(node.right)) {
          markPathEnum(node.left);
          markPathEnum(node.right);
        }
      }
      if (node.kind === 'in' && node.target.kind === 'interval') {
        const s = Math.max(exprScale(node.element), exprScale(node.target.min), exprScale(node.target.max));
        if (s > 0) {
          markPathScale(node.element, s);
          markPathScale(node.target.min, s);
          markPathScale(node.target.max, s);
        }
      }
    }, { skipQuantBody: true });
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
    for (const qExpr of quantDerivedExprs) propagate(qExpr);
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
      const idxMem = extractIndexMemberChain(node);
      if (idxMem) {
        const keySmt = encVal(idxMem.indexExpr);
        const fieldPart = `f_${sanitizeId(idxMem.fieldPath)}`;
        const raw = `(select ${mapName(idxMem.mapPath, fieldPart)} ${keySmt})`;
        const curScale = maps.get(idxMem.mapPath)?.subfields.get(idxMem.fieldPath)?.scale ?? 0;
        if (targetScale !== null && targetScale > curScale) {
          return `(* ${raw} ${pow10(targetScale - curScale)})`;
        }
        return raw;
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
        const q = quantBySig.get(quantSignature(node));
        return varName(q ? q.key : `@quant(${node.quantifier}:${node.variable}:${pathToString(node.collection) || 'col'})`);
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
        for (const sf of m.subfields.values()) {
          const name = pSuffix ? `${m.smtBase}${pSuffix}__f_${sf.smtName.split('__f_')[1]}` : sf.smtName;
          lines.push(`(declare-const ${name} (Array ${m.keySort} ${sf.sort}))`);
        }
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
    const symOf = (info, pSuffix) => (info.isState ? `${info.smtName}${baseStateSuffix}` : `${info.smtName}${pSuffix}`);
    for (const pSuffix of paramSuffixes) {
      // Collection-level coupled axioms: len == count, len == 0 => sum == 0, vacuous truth & multi-quantifier soundness
      for (const colPath of aggCollections) {
        const lenInfo = vars.get(`v__${sanitizeId(`@agg(len:${colPath})`)}`);
        const countInfo = vars.get(`v__${sanitizeId(`@agg(count:${colPath})`)}`);
        const sumInfo = vars.get(`v__${sanitizeId(`@agg(sum:${colPath})`)}`);
        const lenSym = lenInfo ? symOf(lenInfo, pSuffix) : null;
        const countSym = countInfo ? symOf(countInfo, pSuffix) : null;
        const sumSym = sumInfo ? symOf(sumInfo, pSuffix) : null;
        if (lenSym && countSym) {
          lines.push(`(assert (= ${lenSym} ${countSym}))`);
        }
        const sizeSym = lenSym ?? countSym;
        if (sizeSym && sumSym) {
          lines.push(`(assert (=> (= ${sizeSym} 0) (= ${sumSym} 0)))`);
        }

        const qs = quantsByCol.get(colPath) ?? [];
        if (qs.length === 0) continue;
        const defVar = `@qdef(${colPath})`;
        const activeSmt = q => {
          const qSym = `${q.smtName}${pSuffix}`;
          return q.quantifier === 'exists' ? qSym : `(not ${qSym})`;
        };

        for (const q of qs) {
          if (!q.body) continue;
          const qSym = `${q.smtName}${pSuffix}`;
          const ownBody = encodeExpr(substituteBoundVar(q.body, q.variable, q.elVar), { suffix: baseStateSuffix, paramSuffix: pSuffix });
          const defBody = encodeExpr(substituteBoundVar(q.body, q.variable, defVar), { suffix: baseStateSuffix, paramSuffix: pSuffix });

          if (q.quantifier === 'forall') {
            if (sizeSym) {
              lines.push(`(assert (=> (= ${sizeSym} 0) ${qSym}))`);
              lines.push(`(assert (=> (not ${qSym}) (>= ${sizeSym} 1)))`);
              lines.push(`(assert (=> (and (> ${sizeSym} 0) ${qSym}) ${defBody}))`);
            } else {
              lines.push(`(assert (=> ${qSym} ${defBody}))`);
            }
            lines.push(`(assert (=> (not ${qSym}) (not ${ownBody})))`);
          } else {
            if (sizeSym) {
              lines.push(`(assert (=> (= ${sizeSym} 0) (not ${qSym})))`);
              lines.push(`(assert (=> ${qSym} (>= ${sizeSym} 1)))`);
              lines.push(`(assert (=> (and (> ${sizeSym} 0) (not ${qSym})) (not ${defBody})))`);
            } else {
              lines.push(`(assert (=> (not ${qSym}) (not ${defBody})))`);
            }
            lines.push(`(assert (=> ${qSym} ${ownBody}))`);
          }

          // Cross-quantifier universal soundness over every active witness element on the same collection
          for (const other of qs) {
            if (other === q) continue;
            const bodyOnOther = encodeExpr(substituteBoundVar(q.body, q.variable, other.elVar), { suffix: baseStateSuffix, paramSuffix: pSuffix });
            if (q.quantifier === 'forall') {
              lines.push(`(assert (=> (and ${qSym} ${activeSmt(other)}) ${bodyOnOther}))`);
            } else {
              lines.push(`(assert (=> (and (not ${qSym}) ${activeSmt(other)}) (not ${bodyOnOther})))`);
            }
          }
        }

        // Distinct active scalar witnesses imply cardinality >= 2 when size is tracked
        if (sizeSym && qs.length > 1) {
          for (let i = 0; i < qs.length; i += 1) {
            const elInfoI = vars.get(`v__${sanitizeId(qs[i].elVar)}`);
            if (!elInfoI) continue;
            for (let j = i + 1; j < qs.length; j += 1) {
              const elInfoJ = vars.get(`v__${sanitizeId(qs[j].elVar)}`);
              if (!elInfoJ) continue;
              lines.push(`(assert (=> (and ${activeSmt(qs[i])} ${activeSmt(qs[j])} (not (= ${symOf(elInfoI, pSuffix)} ${symOf(elInfoJ, pSuffix)}))) (>= ${sizeSym} 2)))`);
            }
          }
        }
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
    quantifiers,
    getQuantifier: node => quantBySig.get(quantSignature(node)) ?? null,
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
