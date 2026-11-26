// Read-only symbol table loader & binder connecting co-arising EARS 1.0 AST to truthsrc.
import { readFileSync } from 'node:fs';
import { captureProject } from '../project/cli.mjs';
import { formatType, isTypeCompatible } from './type-compat.mjs';

function normalizeAggregateAliases(aggregateName) {
  const lower = aggregateName.toLowerCase();
  const parts = aggregateName.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').split(' ').map(s => s.toLowerCase());
  const aliases = new Set(['state', lower]);
  if (parts.length > 0) aliases.add(parts[parts.length - 1]);
  return [...aliases];
}

function simplifyValueType(vt, exactMap, typeDecls) {
  if (!vt || typeof vt !== 'object') return { kind: 'unknown' };
  if (vt.form === 'primitive') {
    if (vt.name === 'integer') return { kind: 'int' };
    if (vt.name === 'decimal') return { kind: 'decimal', scale: 2 };
    if (vt.name === 'boolean') return { kind: 'bool' };
    if (vt.name === 'string') return { kind: 'string' };
    return { kind: 'unknown' };
  }
  if (vt.form === 'nominal') {
    const typeId = vt.ref.id;
    const exact = exactMap.get(typeId);
    if (exact) {
      if (exact.form === 'unit-decimal') {
        return {
          kind: 'record',
          typeName: typeId,
          exactForm: 'unit-decimal',
          fields: {
            [exact.amountMember.id]: { kind: 'decimal', scale: exact.scale },
            [exact.unitMember.id]: { kind: 'string', units: exact.units },
          },
        };
      }
      return { kind: 'decimal', typeName: typeId, scale: exact.scale };
    }
    const decl = typeDecls.get(typeId);
    if (decl?.valueType?.form === 'record') {
      const fields = {};
      for (const mRef of decl.valueType.members) {
        const memberDecl = typeDecls.get(`${typeId}.${mRef.id}`);
        fields[mRef.id] = simplifyValueType(memberDecl?.valueType, exactMap, typeDecls);
      }
      return { kind: 'record', typeName: typeId, fields };
    }
    if (decl?.valueType) {
      return { ...simplifyValueType(decl.valueType, exactMap, typeDecls), typeName: typeId };
    }
    return { kind: 'string', typeName: typeId, nominal: true };
  }
  if (vt.form === 'optional') {
    return { kind: 'optional', element: simplifyValueType(vt.element, exactMap, typeDecls) };
  }
  if (vt.form === 'map') {
    return {
      kind: 'map',
      key: simplifyValueType(vt.key, exactMap, typeDecls),
      value: simplifyValueType(vt.value, exactMap, typeDecls),
    };
  }
  if (vt.form === 'sequence') {
    return { kind: 'sequence', element: simplifyValueType(vt.element, exactMap, typeDecls) };
  }
  return { kind: 'unknown' };
}

export function buildSymbolTableFromCompiled({ canonical, layout, exactTypes = [] }) {
  const exactMap = new Map();
  for (const ex of exactTypes) {
    if (ex?.domain?.id) exactMap.set(ex.domain.id, ex);
  }

  const typeDecls = new Map();
  for (const decl of layout.declarations) {
    if (decl.ref.kind === 'type') typeDecls.set(decl.ref.id, decl);
    if (decl.ref.kind === 'member') typeDecls.set(`${decl.ref.owner[0]}.${decl.ref.id}`, decl);
  }

  const aggregates = new Map();
  for (const agg of canonical.aggregates ?? []) {
    const stateFields = {};
    const commands = new Map();
    const events = new Set();
    const ruleRefs = new Map();

    for (const ref of agg.aggregateRuleRefs ?? []) {
      if (ref?.ruleId) ruleRefs.set(ref.ruleId, ref.desc ?? ref.errCode ?? '');
      if (ref?.errCode && !ruleRefs.has(ref.errCode)) ruleRefs.set(ref.errCode, ref.desc ?? '');
    }
    for (const ev of agg.events ?? []) {
      if (ev?.name) events.add(ev.name);
    }
    for (const cmd of agg.commands ?? []) {
      if (cmd?.name) commands.set(cmd.name, { name: cmd.name, params: {}, produces: cmd.produces ?? [] });
    }
    aggregates.set(agg.name, {
      name: agg.name,
      aliases: normalizeAggregateAliases(agg.name),
      stateFields,
      commands,
      events,
      ruleRefs,
    });
  }

  for (const decl of layout.declarations) {
    if (decl.ref.kind === 'state-field') {
      const agg = aggregates.get(decl.ref.owner[0]);
      if (agg) agg.stateFields[decl.ref.id] = simplifyValueType(decl.valueType, exactMap, typeDecls);
    } else if (decl.ref.kind === 'parameter') {
      const agg = aggregates.get(decl.ref.owner[0]);
      const cmd = agg?.commands.get(decl.ref.owner[1]);
      if (cmd) cmd.params[decl.ref.id] = simplifyValueType(decl.valueType, exactMap, typeDecls);
    } else if (decl.ref.kind === 'event') {
      const agg = aggregates.get(decl.ref.owner[0]);
      if (agg) agg.events.add(decl.ref.id);
    }
  }

  const stories = new Map();
  for (const story of canonical.stories ?? []) {
    if (story?.name) stories.set(story.name, story);
  }
  const readModels = new Set((canonical.readModels ?? []).map(rm => rm.name || rm.id).filter(Boolean));

  return { aggregates, stories, readModels, exactMap };
}

export function loadSymbolTableFromProject(projectFile) {
  const captured = captureProject(projectFile, { roundtripCheck: false });
  const docs = captured.compilation.result.documents ?? captured.request.documents ?? [];
  const canonicalDoc = docs.find(d => d.id === captured.config.canonicalId);
  const compiledProducts = captured.compilation.result.products ?? [];
  const layoutProduct = Array.isArray(compiledProducts)
    ? compiledProducts.find(p => p.id === 'reference-layout')
    : compiledProducts['reference-layout'];
  const resolvedLayout = layoutProduct?.payload ?? layoutProduct?.layout ?? layoutProduct?.value?.layout ?? null;
  if (!canonicalDoc || !resolvedLayout?.declarations) {
    throw new Error('EARS_SYMBOL_TABLE: failed to extract canonical document or reference-layout from project');
  }
  return buildSymbolTableFromCompiled({
    canonical: canonicalDoc.value,
    layout: resolvedLayout,
    exactTypes: captured.config.exactTypes ?? [],
  });
}

export function loadStandaloneSymbolTable(typesFile) {
  const raw = JSON.parse(readFileSync(typesFile, 'utf8'));
  const aggregates = new Map();
  for (const [name, def] of Object.entries(raw.aggregates ?? {})) {
    const commands = new Map();
    for (const [cmdName, cmdDef] of Object.entries(def.commands ?? {})) {
      commands.set(cmdName, {
        name: cmdName,
        params: cmdDef.params ?? {},
        produces: cmdDef.produces ?? [],
      });
    }
    aggregates.set(name, {
      name,
      aliases: def.aliases ?? normalizeAggregateAliases(name),
      stateFields: def.stateFields ?? {},
      commands,
      events: new Set(def.events ?? []),
      ruleRefs: new Map(Object.entries(def.ruleRefs ?? {})),
    });
  }
  const stories = new Map(Object.entries(raw.stories ?? {}));
  const readModels = new Set(raw.readModels ?? []);
  return { aggregates, stories, readModels, exactMap: new Map() };
}

function collectPathRoots(expr, out = [], boundVars = new Set()) {
  if (!expr || typeof expr !== 'object') return out;
  if (expr.kind === 'var') {
    if (!boundVars.has(expr.name)) out.push([expr.name]);
    return out;
  }
  if (expr.kind === 'member') {
    const chain = [];
    let cur = expr;
    while (cur.kind === 'member') {
      chain.unshift(cur.field);
      cur = cur.object;
    }
    if (cur.kind === 'var') {
      if (!boundVars.has(cur.name)) {
        chain.unshift(cur.name);
        out.push(chain);
      }
    } else {
      collectPathRoots(cur, out, boundVars);
    }
    return out;
  }
  if (expr.kind === 'index') {
    collectPathRoots(expr.collection, out, boundVars);
    collectPathRoots(expr.index, out, boundVars);
    return out;
  }
  if (expr.kind === 'quantifier') {
    collectPathRoots(expr.collection, out, boundVars);
    const innerBound = new Set(boundVars);
    innerBound.add(expr.variable);
    collectPathRoots(expr.body, out, innerBound);
    return out;
  }
  for (const key of ['left', 'right', 'argument', 'element', 'target', 'min', 'max']) {
    if (expr[key]) collectPathRoots(expr[key], out, boundVars);
  }
  for (const key of ['elements', 'args']) {
    if (Array.isArray(expr[key])) {
      for (const item of expr[key]) collectPathRoots(item, out, boundVars);
    }
  }
  return out;
}

function traverseRecordPath(startType, segs, label) {
  let current = startType;
  for (const seg of segs) {
    if (current?.kind === 'record' && current.fields?.[seg]) {
      current = current.fields[seg];
    } else if (current?.kind === 'optional' && current.element?.kind === 'record' && current.element.fields?.[seg]) {
      current = current.element.fields[seg];
    } else {
      return { resolved: false, reason: `unknown member "${seg}" on ${label}`, type: { kind: 'unknown' } };
    }
  }
  return { resolved: true, type: current };
}

function resolveChainType(chain, agg, cmd, stateAliases) {
  if (chain.length === 0) return { resolved: false, type: { kind: 'unknown' } };
  const [head, ...rest] = chain;

  if (stateAliases.has(head) && rest.length > 0 && agg) {
    const start = agg.stateFields[rest[0]];
    if (!start) return { resolved: false, reason: `unknown state field "${rest[0]}" on ${agg.name}`, type: { kind: 'unknown' } };
    const trav = traverseRecordPath(start, rest.slice(1), `path "${chain.join('.')}"`);
    if (!trav.resolved) return trav;
    return { resolved: true, scope: 'state', canonicalPath: ['state', ...rest], type: trav.type };
  }

  if (cmd && Object.hasOwn(cmd.params, head)) {
    const trav = traverseRecordPath(cmd.params[head], rest, `param "${head}"`);
    if (!trav.resolved) return trav;
    return { resolved: true, scope: 'param', canonicalPath: ['param', ...chain], type: trav.type };
  }

  return { resolved: false, reason: `unresolved symbol "${chain.join('.')}"`, type: { kind: 'unknown' } };
}

function isNumericType(t) {
  return t?.kind === 'int' || t?.kind === 'decimal';
}

function closedVocabularyOf(t) {
  if (!t || typeof t !== 'object') return null;
  if (Array.isArray(t.enumValues) && t.enumValues.length > 0) return t.enumValues;
  if (Array.isArray(t.units) && t.units.length > 0) return t.units;
  if (t.kind === 'optional') return closedVocabularyOf(t.element);
  return null;
}

export function inferExprType(expr, lookupChainType) {
  if (!expr || typeof expr !== 'object') return { kind: 'unknown' };
  switch (expr.kind) {
    case 'boolean':
    case 'binary':
    case 'not':
    case 'compare':
    case 'in':
    case 'emptiness':
    case 'extern-ref':
    case 'quantifier':
      return { kind: 'bool' };
    case 'call': {
      if (expr.name === 'count' || expr.name === 'len') return { kind: 'int' };
      if (expr.name === 'sum') {
        const argType = inferExprType(expr.args?.[0], lookupChainType);
        if (argType?.kind === 'sequence' && argType.element) {
          if (argType.element.kind === 'int') return { kind: 'int' };
          if (argType.element.kind === 'decimal') return argType.element;
        }
        return { kind: 'decimal', scale: 2 };
      }
      return { kind: 'unknown' };
    }
    case 'string':
      return { kind: 'string' };
    case 'none':
      return { kind: 'none' };
    case 'number':
      return expr.scale > 0 ? { kind: 'decimal', scale: expr.scale } : { kind: 'int' };
    case 'arith': {
      const lt = inferExprType(expr.left, lookupChainType);
      const rt = inferExprType(expr.right, lookupChainType);
      if (lt.kind === 'int' && rt.kind === 'int') return { kind: 'int' };
      if (lt.kind === 'decimal' || rt.kind === 'decimal') {
        const maxScale = Math.max(lt.scale ?? 0, rt.scale ?? 0);
        return maxScale > 0 ? { kind: 'decimal', scale: maxScale } : { kind: 'decimal' };
      }
      return { kind: 'decimal' };
    }
    case 'neg': {
      const argType = inferExprType(expr.argument, lookupChainType);
      if (argType.kind === 'int' || argType.kind === 'decimal') return argType;
      return { kind: 'decimal' };
    }
    case 'var':
      return lookupChainType([expr.name]) ?? { kind: 'unknown' };
    case 'member': {
      const chain = [];
      let cur = expr;
      while (cur.kind === 'member') {
        chain.unshift(cur.field);
        cur = cur.object;
      }
      if (cur.kind === 'var') {
        chain.unshift(cur.name);
        return lookupChainType(chain) ?? { kind: 'unknown' };
      }
      return { kind: 'unknown' };
    }
    case 'index': {
      const colType = inferExprType(expr.collection, lookupChainType);
      if (colType?.kind === 'map') return colType.value;
      if (colType?.kind === 'sequence') return colType.element;
      return { kind: 'unknown' };
    }
    default:
      return { kind: 'unknown' };
  }
}

function isAssignmentCompatible(valType, targetType) {
  if (!valType || !targetType || valType.kind === 'unknown' || targetType.kind === 'unknown') return true;
  if (isTypeCompatible(valType, targetType, { allowOptionalWrap: true, allowNumericPromotion: false, exactScale: false })) {
    return true;
  }
  // Permit lossless int -> decimal (or Optional[Decimal]) widening in post:/transition assignments (e.g. balance' = 0)
  const unwrappedTarget = targetType.kind === 'optional' ? targetType.element : targetType;
  if (valType.kind === 'int' && unwrappedTarget?.kind === 'decimal') {
    return true;
  }
  return false;
}

function checkClosedEnumOnValue(valueExpr, targetType, diagnostics, span, label = 'literal') {
  if (valueExpr?.kind !== 'string') return;
  const vocab = closedVocabularyOf(targetType);
  if (vocab && !vocab.includes(valueExpr.value)) {
    diagnostics.push({
      severity: 'error',
      code: 'EARS_UNKNOWN_ENUM_LITERAL',
      span,
      message: `${label} ${JSON.stringify(valueExpr.value)} is outside declared closed vocabulary [${vocab.join(', ')}]`,
    });
  }
}

function checkExprTypesAndEnums(expr, lookupChainType, diagnostics, span = null, ctx = {}) {
  if (!expr || typeof expr !== 'object') return;
  if (expr.kind === 'quantifier') {
    const colType = inferExprType(expr.collection, lookupChainType);
    let elemType = { kind: 'unknown' };
    if (colType?.kind === 'sequence') elemType = colType.element;
    else if (colType?.kind === 'map') elemType = colType.value;
    const innerLookup = chain => {
      if (chain[0] === expr.variable) {
        let cur = elemType;
        for (const seg of chain.slice(1)) {
          if (cur?.kind === 'record' && cur.fields?.[seg]) cur = cur.fields[seg];
          else return null;
        }
        return cur;
      }
      return lookupChainType(chain);
    };
    checkExprTypesAndEnums(expr.collection, lookupChainType, diagnostics, span, ctx);
    checkExprTypesAndEnums(expr.body, innerLookup, diagnostics, span, ctx);
    return;
  }

  if (expr.kind === 'compare') {
    const lt = inferExprType(expr.left, lookupChainType);
    const rt = inferExprType(expr.right, lookupChainType);
    if (['<', '<=', '>', '>='].includes(expr.op)) {
      if ((lt.kind !== 'unknown' && !isNumericType(lt)) || (rt.kind !== 'unknown' && !isNumericType(rt))) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `ordering comparison "${expr.op}" requires numeric operands, got ${formatType(lt)} and ${formatType(rt)}`,
        });
      }
    } else if (lt.kind !== 'unknown' && rt.kind !== 'unknown') {
      const compat = isTypeCompatible(lt, rt, { allowNumericPromotion: true, exactScale: false })
        || isTypeCompatible(rt, lt, { allowNumericPromotion: true, exactScale: false });
      if (!compat) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `incompatible comparison "${expr.op}" between ${formatType(lt)} and ${formatType(rt)}`,
        });
      }
    }
    checkClosedEnumOnValue(expr.right, lt, diagnostics, span, 'literal');
    checkClosedEnumOnValue(expr.left, rt, diagnostics, span, 'literal');
  } else if (expr.kind === 'arith') {
    const lt = inferExprType(expr.left, lookupChainType);
    const rt = inferExprType(expr.right, lookupChainType);
    if ((lt.kind !== 'unknown' && !isNumericType(lt)) || (rt.kind !== 'unknown' && !isNumericType(rt))) {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_TYPE_MISMATCH',
        span,
        message: `arithmetic operator "${expr.op}" requires numeric operands, got ${formatType(lt)} and ${formatType(rt)}`,
      });
    }
  } else if (expr.kind === 'index') {
    const colType = inferExprType(expr.collection, lookupChainType);
    const idxType = inferExprType(expr.index, lookupChainType);
    if (colType.kind !== 'unknown' && colType.kind !== 'map' && colType.kind !== 'sequence') {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_TYPE_MISMATCH',
        span,
        message: `indexing requires a Map or Seq collection, got ${formatType(colType)}`,
      });
    } else if (colType.kind === 'map' && idxType.kind !== 'unknown') {
      if (!isTypeCompatible(idxType, colType.key, { allowNumericPromotion: false })) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `map index type ${formatType(idxType)} is incompatible with map key type ${formatType(colType.key)}`,
        });
      }
    } else if (colType.kind === 'sequence' && idxType.kind !== 'unknown' && idxType.kind !== 'int') {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_TYPE_MISMATCH',
        span,
        message: `sequence index must be Int, got ${formatType(idxType)}`,
      });
    }
  } else if (expr.kind === 'in') {
    const et = inferExprType(expr.element, lookupChainType);
    if (expr.target?.kind === 'set') {
      const vocab = closedVocabularyOf(et);
      for (const item of expr.target.elements) {
        const it = inferExprType(item, lookupChainType);
        if (et.kind !== 'unknown' && it.kind !== 'unknown') {
          const compat = isTypeCompatible(it, et, { allowNumericPromotion: true, exactScale: false })
            || isTypeCompatible(et, it, { allowNumericPromotion: true, exactScale: false });
          if (!compat) {
            diagnostics.push({
              severity: 'error',
              code: 'EARS_TYPE_MISMATCH',
              span,
              message: `set member of type ${formatType(it)} is incompatible with element type ${formatType(et)}`,
            });
          }
        }
        if (vocab && item.kind === 'string' && !vocab.includes(item.value)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_ENUM_LITERAL',
            span,
            message: `set member ${JSON.stringify(item.value)} is outside declared closed vocabulary [${vocab.join(', ')}]`,
          });
        }
      }
    } else if (expr.target?.kind === 'interval') {
      const minT = inferExprType(expr.target.min, lookupChainType);
      const maxT = inferExprType(expr.target.max, lookupChainType);
      if ((et.kind !== 'unknown' && !isNumericType(et))
        || (minT.kind !== 'unknown' && !isNumericType(minT))
        || (maxT.kind !== 'unknown' && !isNumericType(maxT))) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `interval membership requires numeric element and bounds, got ${formatType(et)} in [${formatType(minT)}..${formatType(maxT)}]`,
        });
      }
    } else if (expr.target) {
      const colT = inferExprType(expr.target, lookupChainType);
      if (colT.kind === 'map' && et.kind !== 'unknown' && !isTypeCompatible(et, colT.key, { allowNumericPromotion: false })) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `membership check element type ${formatType(et)} is incompatible with map key type ${formatType(colT.key)}`,
        });
      } else if (colT.kind === 'sequence' && et.kind !== 'unknown' && !isTypeCompatible(et, colT.element, { allowNumericPromotion: false })) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `membership check element type ${formatType(et)} is incompatible with sequence element type ${formatType(colT.element)}`,
        });
      }
    }
  } else if (expr.kind === 'extern-ref' && ctx.externDefs) {
    const decl = ctx.externDefs.get(expr.name);
    if (decl) {
      const expectedParams = decl.params ?? [];
      const actualArgs = expr.args ?? [];
      if (actualArgs.length !== expectedParams.length) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_EXTERN_ARITY_MISMATCH',
          span,
          message: `extern call "${expr.name}" passes ${actualArgs.length} argument(s), expected ${expectedParams.length}`,
        });
      } else {
        for (let i = 0; i < expectedParams.length; i += 1) {
          const argType = inferExprType(actualArgs[i], lookupChainType);
          const paramType = expectedParams[i].resolvedType;
          if (argType.kind !== 'unknown' && paramType && !isTypeCompatible(argType, paramType, { allowNumericPromotion: false })) {
            diagnostics.push({
              severity: 'error',
              code: 'EARS_EXTERN_ARG_TYPE_MISMATCH',
              span,
              message: `extern call "${expr.name}" argument #${i + 1} (${expectedParams[i].name}) has type ${formatType(argType)}, expected ${formatType(paramType)}`,
            });
          }
        }
      }
    }
  }

  for (const key of ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index']) {
    if (expr[key]) checkExprTypesAndEnums(expr[key], lookupChainType, diagnostics, span, ctx);
  }
  for (const key of ['elements', 'args']) {
    if (Array.isArray(expr[key])) {
      for (const item of expr[key]) checkExprTypesAndEnums(item, lookupChainType, diagnostics, span, ctx);
    }
  }
}

function checkExternContracts(normalizedSpec, symbolTable, diagnostics) {
  const externDefs = symbolTable.externDefs;
  if (!externDefs || externDefs.size === 0) {
    if (normalizedSpec.externs.length > 0) {
      for (const ext of normalizedSpec.externs) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_UNDECLARED_EXTERN',
          span: ext.span,
          message: `extern "${ext.name}" is not registered in structure externContracts (anti-escape boundary gate)`,
        });
      }
    }
    return;
  }
  for (const ext of normalizedSpec.externs) {
    const decl = externDefs.get(ext.name);
    if (!decl) {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_UNDECLARED_EXTERN',
        span: ext.span,
        message: `extern "${ext.name}" is not registered in structure externContracts (anti-escape boundary gate)`,
      });
      continue;
    }
    const actualArity = (ext.params ?? []).length;
    const expectedArity = (decl.params ?? []).length;
    if (actualArity !== expectedArity) {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_EXTERN_ARITY_MISMATCH',
        span: ext.span,
        message: `extern "${ext.name}" declares ${actualArity} parameter(s), expected ${expectedArity}`,
      });
    }
  }
}

function validateActionConstraint({
  expr,
  fieldMap,
  resolveRuleChain,
  ruleLookupType,
  diagnostics,
  span,
  missingFieldCode,
  targetLabel,
}) {
  if (!expr || typeof expr !== 'object') return;
  if (expr.kind === 'binary') {
    validateActionConstraint({ expr: expr.left, fieldMap, resolveRuleChain, ruleLookupType, diagnostics, span, missingFieldCode, targetLabel });
    validateActionConstraint({ expr: expr.right, fieldMap, resolveRuleChain, ruleLookupType, diagnostics, span, missingFieldCode, targetLabel });
    return;
  }
  if (expr.kind === 'not') {
    validateActionConstraint({ expr: expr.argument, fieldMap, resolveRuleChain, ruleLookupType, diagnostics, span, missingFieldCode, targetLabel });
    return;
  }
  if (expr.kind === 'compare') {
    let fieldName = null;
    if (expr.left?.kind === 'member') fieldName = expr.left.field;
    else if (expr.left?.kind === 'var') fieldName = expr.left.name;

    const fieldDef = fieldName ? fieldMap.get(fieldName) : null;
    if (fieldName && !fieldDef) {
      diagnostics.push({
        severity: 'error',
        code: missingFieldCode,
        span,
        message: `${targetLabel} has no declared field "${fieldName}"`,
      });
    }

    // Validate RHS symbol references in the rule scope
    for (const chain of collectPathRoots(expr.right)) {
      const res = resolveRuleChain(chain);
      if (!res.resolved) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_UNKNOWN_SYMBOL',
          span,
          message: `${targetLabel} constraint RHS: ${res.reason}`,
        });
      }
    }

    if (fieldDef?.resolvedType) {
      const rhsType = inferExprType(expr.right, ruleLookupType);
      if (rhsType.kind !== 'unknown' && !isAssignmentCompatible(rhsType, fieldDef.resolvedType)) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_TYPE_MISMATCH',
          span,
          message: `${targetLabel} field "${fieldName}" expects ${formatType(fieldDef.resolvedType)}, got ${formatType(rhsType)}`,
        });
      }
      checkClosedEnumOnValue(expr.right, fieldDef.resolvedType, diagnostics, span, `${targetLabel}.${fieldName} literal`);
    }
  }
}

function bindApplicationStory(normalizedSpec, symbolTable, { strictDomainBoundary = false } = {}) {
  const diagnostics = [...normalizedSpec.diagnostics];
  const resolvedSymbols = new Map();
  const story = symbolTable.stories.get(normalizedSpec.target) ?? null;

  if (!story) {
    diagnostics.push({
      severity: strictDomainBoundary ? 'error' : 'warning',
      code: 'EARS_UNKNOWN_STORY',
      message: `story "${normalizedSpec.target}" not found in symbol table`,
    });
    return { ...normalizedSpec, bound: false, story: null, aggregate: null, resolvedSymbols, diagnostics };
  }

  if (!strictDomainBoundary) {
    return { ...normalizedSpec, bound: true, story, aggregate: null, resolvedSymbols, diagnostics };
  }

  checkExternContracts(normalizedSpec, symbolTable, diagnostics);

  // Story's own parameters
  const storyOwnParams = new Map();
  for (const p of story.parameters ?? []) {
    if (p?.name && p.resolvedType) storyOwnParams.set(p.name, p.resolvedType);
  }

  // Per-operation parameter table (prevents cross-operation scope pollution!)
  const portOpParams = new Map();
  const fallbackPortParams = new Map();
  const portOpSet = new Set();
  const portDefs = symbolTable.portDefs ?? new Map();
  for (const [portName, portDef] of portDefs) {
    for (const op of portDef.operations ?? []) {
      const opKey = `${portName}.${op.name}`;
      portOpSet.add(opKey);
      const paramMap = new Map();
      for (const p of op.parameters ?? []) {
        if (p?.name && p.resolvedType) {
          paramMap.set(p.name, p.resolvedType);
          if (!fallbackPortParams.has(p.name)) fallbackPortParams.set(p.name, p.resolvedType);
        }
      }
      portOpParams.set(opKey, paramMap);
    }
  }

  // Validate story-level metadata declarations against ports & aggregates
  if (story.entryPort && portDefs.size > 0 && !portDefs.has(story.entryPort)) {
    diagnostics.push({
      severity: 'error',
      code: 'EARS_UNKNOWN_PORT_OP',
      span: normalizedSpec.span,
      message: `story "${story.name}" declares undeclared entryPort "${story.entryPort}"`,
    });
  }
  if (story.entryPort && story.entryOperation && portDefs.size > 0 && !portOpSet.has(`${story.entryPort}.${story.entryOperation}`)) {
    diagnostics.push({
      severity: 'error',
      code: 'EARS_UNKNOWN_PORT_OP',
      span: normalizedSpec.span,
      message: `story "${story.name}" declares undeclared entryOperation "${story.entryPort}.${story.entryOperation}"`,
    });
  }
  if (story.queryPort && portDefs.size > 0 && !portDefs.has(story.queryPort)) {
    diagnostics.push({
      severity: 'error',
      code: 'EARS_UNKNOWN_PORT_OP',
      span: normalizedSpec.span,
      message: `story "${story.name}" declares undeclared queryPort "${story.queryPort}"`,
    });
  }
  for (const disp of story.dispatches ?? []) {
    if (typeof disp === 'string' && disp.includes('.')) {
      const [aggName, cmdName] = disp.split('.');
      const agg = symbolTable.aggregates.get(aggName);
      if (!agg || !cmdName || !agg.commands.has(cmdName)) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_UNKNOWN_DISPATCH_TARGET',
          span: normalizedSpec.span,
          message: `story "${story.name}" metadata dispatches undeclared target "${disp}"`,
        });
      }
    }
  }

  // Build aggregate alias lookup for story state references (e.g. order.paymentOutcome)
  const aggByAlias = new Map();
  for (const agg of symbolTable.aggregates.values()) {
    for (const al of agg.aliases ?? []) {
      if (al !== 'state') aggByAlias.set(al, agg);
    }
  }

  const pinsSet = new Set(story.pins ?? []);
  const responsesSet = new Set(story.responses ?? []);
  const readModelDefs = symbolTable.readModelDefs ?? new Map();
  const valueObjectDefs = symbolTable.valueObjectDefs ?? new Map();
  const externDefs = symbolTable.externDefs ?? new Map();
  const triggeredPortOps = new Set();

  for (const rule of normalizedSpec.rules) {
    const isEventTrigger = rule.triggerKind === 'event' || rule.clauses?.whenTriggerKind === 'event';
    const ruleLocalParams = new Map();

    if (isEventTrigger && rule.command) {
      const [evAggName, evName] = rule.command.split('.');
      const evAgg = symbolTable.aggregates.get(evAggName);
      if (!evAgg || !evName || !evAgg.events.has(evName)) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_UNKNOWN_TRIGGER_EVENT',
          span: rule.span,
          message: `story "${story.name}" rule [${rule.id}] triggers on undeclared event "${rule.command}"`,
        });
      } else {
        const fields = evAgg.eventFields?.get(evName) ?? {};
        for (const [fn, ft] of Object.entries(fields)) ruleLocalParams.set(fn, ft);
      }
    } else if (rule.command) {
      if (portOpSet.size > 0 && !portOpSet.has(rule.command)) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_UNKNOWN_PORT_OP',
          span: rule.span,
          message: `story "${story.name}" rule [${rule.id}] references undeclared port operation "${rule.command}"`,
        });
      } else if (portOpParams.has(rule.command)) {
        triggeredPortOps.add(rule.command);
        for (const [fn, ft] of portOpParams.get(rule.command)) {
          ruleLocalParams.set(fn, ft);
        }
      }
    }

    const resolveRuleChain = chain => {
      if (chain.length === 0) return { resolved: false, reason: 'empty path', type: { kind: 'unknown' } };
      const [head, ...rest] = chain;
      if (ruleLocalParams.has(head)) {
        const trav = traverseRecordPath(ruleLocalParams.get(head), rest, `trigger parameter "${head}"`);
        if (!trav.resolved) return trav;
        return { resolved: true, scope: 'param', canonicalPath: ['param', ...chain], type: trav.type };
      }
      if (storyOwnParams.has(head)) {
        const trav = traverseRecordPath(storyOwnParams.get(head), rest, `story param "${head}"`);
        if (!trav.resolved) return trav;
        return { resolved: true, scope: 'param', canonicalPath: ['param', ...chain], type: trav.type };
      }
      if (aggByAlias.has(head) && rest.length > 0) {
        const agg = aggByAlias.get(head);
        const start = agg.stateFields[rest[0]];
        if (!start) return { resolved: false, reason: `unknown state field "${rest[0]}" on aggregate "${agg.name}"`, type: { kind: 'unknown' } };
        const trav = traverseRecordPath(start, rest.slice(1), `"${chain.join('.')}"`);
        if (!trav.resolved) return trav;
        return { resolved: true, scope: 'state', canonicalPath: ['state', ...rest], type: trav.type };
      }
      return { resolved: false, reason: `unresolved story symbol "${chain.join('.')}" in scope of "${rule.command ?? story.name}"`, type: { kind: 'unknown' } };
    };
    const hasUnknownPortOp = !isEventTrigger && Boolean(rule.command) && portOpSet.size > 0 && !portOpSet.has(rule.command);
    const ruleLookupType = chain => {
      const r = resolveRuleChain(chain);
      if (r.resolved) return r.type;
      // When the rule's WHEN Port.op is itself undeclared (already reported as EARS_UNKNOWN_PORT_OP),
      // still infer secondary type/enum diagnostics against known port parameters.
      if (hasUnknownPortOp && chain.length > 0 && fallbackPortParams.has(chain[0])) {
        const trav = traverseRecordPath(fallbackPortParams.get(chain[0]), chain.slice(1), chain[0]);
        return trav.resolved ? trav.type : null;
      }
      return null;
    };

    for (const chain of collectPathRoots(rule.expandedGuard)) {
      const res = resolveRuleChain(chain);
      const key = `${rule.command ?? '*'}::${chain.join('.')}`;
      if (res.resolved) resolvedSymbols.set(key, res);
      else diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_SYMBOL', span: rule.span, message: res.reason });
    }
    checkExprTypesAndEnums(rule.expandedGuard, ruleLookupType, diagnostics, rule.span, { externDefs });

    for (const act of rule.actions) {
      if (act.kind === 'dispatch' && act.target) {
        const [aggName, cmdName] = act.target.split('.');
        const agg = symbolTable.aggregates.get(aggName);
        if (!agg || !cmdName || !agg.commands.has(cmdName)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_DISPATCH_TARGET',
            span: rule.span,
            message: `story "${story.name}" rule [${rule.id}] dispatches undeclared target "${act.target}"`,
          });
        }
      } else if (act.kind === 'pin') {
        if (pinsSet.size > 0 && !pinsSet.has(act.artifact)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_PIN_ARTIFACT',
            span: rule.span,
            message: `story "${story.name}" rule [${rule.id}] pins undeclared artifact "${act.artifact}"`,
          });
        }
        for (const inputName of act.inputs ?? []) {
          const res = resolveRuleChain([inputName]);
          if (!res.resolved) {
            diagnostics.push({
              severity: 'error',
              code: 'EARS_UNKNOWN_PIN_INPUT',
              span: rule.span,
              message: `story "${story.name}" rule [${rule.id}] pin "${act.artifact}" references undeclared input "${inputName}"`,
            });
          }
        }
      } else if (act.kind === 'respond') {
        if (responsesSet.size > 0 && !responsesSet.has(act.response)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_RESPONSE',
            span: rule.span,
            message: `story "${story.name}" rule [${rule.id}] responds with undeclared type "${act.response}"`,
          });
        }
        const vo = valueObjectDefs.get(act.response);
        if (!vo && act.constraint && valueObjectDefs.size > 0) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_RESPONSE',
            span: rule.span,
            message: `story "${story.name}" rule [${rule.id}] constrains undeclared response valueObject "${act.response}"`,
          });
        } else if (vo && act.constraint) {
          const fieldMap = new Map((vo.fields ?? []).map(f => [f.name, f]));
          validateActionConstraint({
            expr: act.constraint,
            fieldMap,
            resolveRuleChain,
            ruleLookupType,
            diagnostics,
            span: rule.span,
            missingFieldCode: 'EARS_UNKNOWN_RESPONSE_FIELD',
            targetLabel: `response "${act.response}"`,
          });
        }
      } else if (act.kind === 'expose') {
        const rm = readModelDefs.get(act.view);
        if (!rm && !symbolTable.readModels.has(act.view)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_READ_MODEL',
            span: rule.span,
            message: `story "${story.name}" rule [${rule.id}] exposes undeclared read model "${act.view}"`,
          });
        } else if (rm && act.constraint) {
          const fieldMap = new Map((rm.fields ?? []).map(f => [f.name, f]));
          validateActionConstraint({
            expr: act.constraint,
            fieldMap,
            resolveRuleChain,
            ruleLookupType,
            diagnostics,
            span: rule.span,
            missingFieldCode: 'EARS_UNKNOWN_VIEW_FIELD',
            targetLabel: `read model "${act.view}"`,
          });
        }
      }
    }
  }

  // Static security check: ALWAYS <Input> SHALL NOT supply <fields> must not appear in story or triggered port inputs
  const forbiddenSupplyFields = new Map(); // fieldName -> axiomId
  for (const ax of normalizedSpec.axioms ?? []) {
    if (ax.kind !== 'action') continue;
    for (const act of ax.actions ?? []) {
      if (act.kind === 'supply' && act.modality === 'SHALL_NOT') {
        for (const fn of act.fields ?? []) {
          forbiddenSupplyFields.set(fn, ax);
        }
      }
    }
  }
  if (forbiddenSupplyFields.size > 0) {
    for (const [fn, ax] of forbiddenSupplyFields) {
      if (storyOwnParams.has(fn)) {
        diagnostics.push({
          severity: 'error',
          code: 'EARS_FORBIDDEN_SUPPLY_DECLARED',
          span: ax.span,
          message: `axiom [${ax.id}] forbids untrusted supply of "${fn}", but story "${story.name}" declares "${fn}" as an input parameter`,
        });
      }
      for (const opKey of triggeredPortOps) {
        const opParams = portOpParams.get(opKey);
        if (opParams?.has(fn)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_FORBIDDEN_SUPPLY_DECLARED',
            span: ax.span,
            message: `axiom [${ax.id}] forbids untrusted supply of "${fn}", but inbound port operation "${opKey}" declares "${fn}" as a parameter`,
          });
        }
      }
    }
  }

  return { ...normalizedSpec, bound: true, story, aggregate: null, resolvedSymbols, diagnostics };
}

export function bindEarsSpec(normalizedSpec, symbolTable, { strictRuleRefs = false, strictDomainBoundary = false } = {}) {
  const diagnostics = [...normalizedSpec.diagnostics];
  const resolvedSymbols = new Map();

  if (!symbolTable) {
    return { ...normalizedSpec, bound: false, aggregate: null, resolvedSymbols, diagnostics };
  }

  if (normalizedSpec.kind === 'story') {
    return bindApplicationStory(normalizedSpec, symbolTable, { strictDomainBoundary });
  }

  const aggName = normalizedSpec.target.split('.')[0];
  const agg = symbolTable.aggregates.get(aggName) ?? null;
  if (!agg) {
    diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_AGGREGATE', message: `aggregate "${aggName}" not found in symbol table` });
    return { ...normalizedSpec, bound: false, aggregate: null, resolvedSymbols, diagnostics };
  }

  if (strictDomainBoundary) {
    checkExternContracts(normalizedSpec, symbolTable, diagnostics);
  }

  const stateAliases = new Set(agg.aliases);
  const externDefs = symbolTable.externDefs ?? new Map();
  const defaultCmdName = normalizedSpec.target.includes('.') ? normalizedSpec.target.split('.').slice(1).join('.') : null;
  const defaultCmd = defaultCmdName ? agg.commands.get(defaultCmdName) ?? null : null;

  const makeLookup = cmd => chain => {
    const res = resolveChainType(chain, agg, cmd, stateAliases);
    return res.resolved ? res.type : null;
  };

  const checkExprSymbols = (expr, cmd, { allowFreeIndexVar = false, span = null } = {}) => {
    const indexVars = new Set();
    if (allowFreeIndexVar) {
      const collectIndexVars = node => {
        if (!node || typeof node !== 'object') return;
        if (node.kind === 'index' && node.index?.kind === 'var') indexVars.add(node.index.name);
        for (const key of ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index']) {
          if (node[key]) collectIndexVars(node[key]);
        }
        for (const key of ['elements', 'args']) {
          if (Array.isArray(node[key])) node[key].forEach(collectIndexVars);
        }
      };
      collectIndexVars(expr);
    }
    for (const chain of collectPathRoots(expr)) {
      if (chain.length === 1 && indexVars.has(chain[0])) continue;
      const key = `${cmd?.name ?? '*'}::${chain.join('.')}`;
      if (resolvedSymbols.has(key)) continue;
      const res = resolveChainType(chain, agg, cmd, stateAliases);
      if (res.resolved) {
        resolvedSymbols.set(key, res);
      } else {
        diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_SYMBOL', span, message: res.reason });
      }
    }
    if (strictDomainBoundary) {
      checkExprTypesAndEnums(expr, makeLookup(cmd), diagnostics, span, { externDefs });
    }
  };

  for (const ax of normalizedSpec.axioms) {
    if (ax.kind === 'invariant') checkExprSymbols(ax.expandedExpr, defaultCmd, { allowFreeIndexVar: true, span: ax.span });
  }

  for (const rule of normalizedSpec.rules) {
    const cmd = rule.command ? agg.commands.get(rule.command) ?? null : null;
    if (rule.command && !cmd) {
      diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_COMMAND', span: rule.span, message: `command "${rule.command}" not declared on aggregate "${agg.name}"` });
    }
    const lookupType = makeLookup(cmd);
    checkExprSymbols(rule.expandedGuard, cmd, { span: rule.span });

    for (const action of rule.actions) {
      if (action.kind === 'emit' && agg.events.size > 0 && !agg.events.has(action.event)) {
        diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_EVENT', span: rule.span, message: `event "${action.event}" not declared on aggregate "${agg.name}"` });
      }
      if (strictDomainBoundary && action.kind === 'transition' && action.path) {
        const segs = [];
        let cur = action.path;
        while (cur.kind === 'member') {
          segs.unshift(cur.field);
          cur = cur.object;
        }
        if (cur.kind === 'var') segs.unshift(cur.name);
        const targetRes = resolveChainType(segs, agg, cmd, stateAliases);
        if (!targetRes.resolved) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_UNKNOWN_SYMBOL',
            span: rule.span,
            message: `transition target ${targetRes.reason}`,
          });
        } else if (action.value) {
          checkExprSymbols(action.value, cmd, { span: rule.span });
          const valType = inferExprType(action.value, lookupType);
          if (!isAssignmentCompatible(valType, targetRes.type)) {
            diagnostics.push({
              severity: 'error',
              code: 'EARS_TYPE_MISMATCH',
              span: rule.span,
              message: `cannot transition "${segs.join('.')}" (${formatType(targetRes.type)}) to value of type ${formatType(valType)}`,
            });
          }
          checkClosedEnumOnValue(action.value, targetRes.type, diagnostics, rule.span, 'transition literal');
        }
      }
      if (action.kind === 'reject' && agg.ruleRefs.size > 0 && !agg.ruleRefs.has(action.code)) {
        diagnostics.push({
          severity: strictRuleRefs ? 'error' : 'warning',
          code: 'EARS_UNANCHORED_RULE_ID',
          span: rule.span,
          message: `reject code "${action.code}" is not registered in ${agg.name}.aggregateRuleRefs`,
        });
      }
    }

    for (const assign of rule.post) {
      const span = assign.target.span ?? rule.span;
      const res = resolveChainType(assign.target.segments, agg, cmd, stateAliases);
      if (!res.resolved) {
        diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_SYMBOL', span, message: `post target ${res.reason}` });
      } else {
        resolvedSymbols.set(`${cmd?.name ?? '*'}::${assign.target.segments.join('.')}`, res);
      }

      if (assign.expandedIndex) checkExprSymbols(assign.expandedIndex, cmd, { span });
      checkExprSymbols(assign.expandedValue, cmd, { span });

      if (strictDomainBoundary && res.resolved) {
        let effectiveTargetType = res.type;
        if (assign.expandedIndex) {
          if (res.type?.kind !== 'unknown' && res.type?.kind !== 'map') {
            diagnostics.push({
              severity: 'error',
              code: 'EARS_TYPE_MISMATCH',
              span,
              message: `indexed post target "${assign.target.segments.join('.')}" must be a Map, got ${formatType(res.type)}`,
            });
          } else if (res.type?.kind === 'map') {
            const idxType = inferExprType(assign.expandedIndex, lookupType);
            if (idxType.kind !== 'unknown' && !isTypeCompatible(idxType, res.type.key, { allowNumericPromotion: false })) {
              diagnostics.push({
                severity: 'error',
                code: 'EARS_TYPE_MISMATCH',
                span,
                message: `post map index type ${formatType(idxType)} is incompatible with key type ${formatType(res.type.key)} of "${assign.target.segments.join('.')}"`,
              });
            }
            effectiveTargetType = res.type.value;
          }
        }

        const valType = inferExprType(assign.expandedValue, lookupType);
        if (assign.expandedValue?.kind === 'none') {
          if (effectiveTargetType && effectiveTargetType.kind !== 'unknown' && effectiveTargetType.kind !== 'optional') {
            diagnostics.push({
              severity: 'error',
              code: 'EARS_TYPE_MISMATCH',
              span,
              message: `cannot assign none to non-optional field "${assign.target.segments.join('.')}" (type: ${formatType(effectiveTargetType)})`,
            });
          }
        } else if (!isAssignmentCompatible(valType, effectiveTargetType)) {
          diagnostics.push({
            severity: 'error',
            code: 'EARS_TYPE_MISMATCH',
            span,
            message: `cannot assign value of type ${formatType(valType)} to "${assign.target.segments.join('.')}" (${formatType(effectiveTargetType)})`,
          });
        }
        checkClosedEnumOnValue(assign.expandedValue, effectiveTargetType, diagnostics, span, 'post assignment literal');
      }
    }
  }

  return {
    ...normalizedSpec,
    bound: true,
    aggregate: agg,
    stateAliases: [...stateAliases],
    resolvedSymbols,
    diagnostics,
  };
}
