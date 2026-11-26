// Canonical normalization, macro expansion, positive naming lint, and SMT theory classification.
import { createHash } from 'node:crypto';
import { NEGATIVE_PREDICATE_PREFIX_RE } from './tokens.mjs';

function walkExpr(expr, visitor) {
  if (!expr || typeof expr !== 'object') return;
  visitor(expr);
  switch (expr.kind) {
    case 'binary':
    case 'compare':
    case 'arith':
      walkExpr(expr.left, visitor);
      walkExpr(expr.right, visitor);
      break;
    case 'not':
    case 'neg':
      walkExpr(expr.argument, visitor);
      break;
    case 'in':
      walkExpr(expr.element, visitor);
      walkExpr(expr.target, visitor);
      break;
    case 'set':
      for (const el of expr.elements) walkExpr(el, visitor);
      break;
    case 'interval':
      walkExpr(expr.min, visitor);
      walkExpr(expr.max, visitor);
      break;
    case 'emptiness':
      walkExpr(expr.target, visitor);
      break;
    case 'member':
      walkExpr(expr.object, visitor);
      break;
    case 'index':
      walkExpr(expr.collection, visitor);
      walkExpr(expr.index, visitor);
      break;
    case 'call':
    case 'host':
      for (const arg of expr.args) walkExpr(arg, visitor);
      break;
    case 'quantifier':
      walkExpr(expr.collection, visitor);
      walkExpr(expr.body, visitor);
      break;
    default:
      break;
  }
}

function expandExpr(expr, predMap, externAliases, visiting) {
  if (!expr || typeof expr !== 'object') return expr;
  switch (expr.kind) {
    case 'var': {
      if (predMap.has(expr.name)) {
        if (visiting.has(expr.name)) {
          throw new Error(`EARS_PRED_CYCLE: circular predicate reference involving "${expr.name}"`);
        }
        visiting.add(expr.name);
        const expanded = expandExpr(predMap.get(expr.name).expr, predMap, externAliases, visiting);
        visiting.delete(expr.name);
        return expanded;
      }
      if (externAliases.has(expr.name)) {
        return { kind: 'extern-ref', index: externAliases.get(expr.name).index, name: expr.name, args: [] };
      }
      return expr;
    }
    case 'call': {
      const args = expr.args.map(a => expandExpr(a, predMap, externAliases, visiting));
      if (externAliases.has(expr.name)) {
        return { kind: 'extern-ref', index: externAliases.get(expr.name).index, name: expr.name, args };
      }
      return { kind: 'call', name: expr.name, args };
    }
    case 'binary':
      return { kind: 'binary', op: expr.op, left: expandExpr(expr.left, predMap, externAliases, visiting), right: expandExpr(expr.right, predMap, externAliases, visiting) };
    case 'not':
      return { kind: 'not', argument: expandExpr(expr.argument, predMap, externAliases, visiting) };
    case 'compare':
      return { kind: 'compare', op: expr.op, left: expandExpr(expr.left, predMap, externAliases, visiting), right: expandExpr(expr.right, predMap, externAliases, visiting) };
    case 'arith':
      return { kind: 'arith', op: expr.op, left: expandExpr(expr.left, predMap, externAliases, visiting), right: expandExpr(expr.right, predMap, externAliases, visiting) };
    case 'neg':
      return { kind: 'neg', argument: expandExpr(expr.argument, predMap, externAliases, visiting) };
    case 'in':
      return { kind: 'in', element: expandExpr(expr.element, predMap, externAliases, visiting), target: expandExpr(expr.target, predMap, externAliases, visiting) };
    case 'set':
      return { kind: 'set', elements: expr.elements.map(e => expandExpr(e, predMap, externAliases, visiting)) };
    case 'interval':
      return {
        kind: 'interval',
        min: expandExpr(expr.min, predMap, externAliases, visiting),
        max: expandExpr(expr.max, predMap, externAliases, visiting),
        leftInclusive: expr.leftInclusive,
        rightInclusive: expr.rightInclusive,
      };
    case 'emptiness':
      return {
        kind: 'emptiness',
        target: expandExpr(expr.target, predMap, externAliases, visiting),
        check: expr.check,
        ...(expr.optionSyntax ? { optionSyntax: true } : {}),
      };
    case 'member':
      return { kind: 'member', object: expandExpr(expr.object, predMap, externAliases, visiting), field: expr.field };
    case 'index':
      return { kind: 'index', collection: expandExpr(expr.collection, predMap, externAliases, visiting), index: expandExpr(expr.index, predMap, externAliases, visiting) };
    case 'host':
      return { kind: 'host', name: expr.name, args: expr.args.map(a => expandExpr(a, predMap, externAliases, visiting)) };
    case 'quantifier':
      return {
        kind: 'quantifier',
        quantifier: expr.quantifier,
        variable: expr.variable,
        collection: expandExpr(expr.collection, predMap, externAliases, visiting),
        body: expandExpr(expr.body, predMap, externAliases, visiting),
      };
    default:
      return expr;
  }
}

function combineRuleGuard(clauses) {
  const parts = [];
  if (clauses.whereOpt) parts.push(clauses.whereOpt);
  if (clauses.whileExpr) parts.push(clauses.whileExpr);
  if (clauses.ifExpr) parts.push(clauses.ifExpr);
  if (clauses.whenCond) parts.push(clauses.whenCond);
  if (parts.length === 0) return { kind: 'boolean', value: true };
  return parts.reduce((left, right) => ({ kind: 'binary', op: 'and', left, right }));
}

function flattenAnd(expr, out = []) {
  if (expr?.kind === 'binary' && expr.op === 'and') {
    flattenAnd(expr.left, out);
    flattenAnd(expr.right, out);
  } else if (expr) {
    out.push(expr);
  }
  return out;
}

function canonicalizeExpr(expr) {
  if (!expr || typeof expr !== 'object') return expr;
  switch (expr.kind) {
    case 'extern-ref':
      return { kind: 'extern-ref', index: expr.index, args: expr.args.map(canonicalizeExpr) };
    case 'binary': {
      if (expr.op === 'and') {
        const terms = flattenAnd(expr).map(canonicalizeExpr);
        terms.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        return terms.reduce((left, right) => ({ kind: 'binary', op: 'and', left, right }));
      }
      return { kind: 'binary', op: expr.op, left: canonicalizeExpr(expr.left), right: canonicalizeExpr(expr.right) };
    }
    case 'not': {
      const inner = canonicalizeExpr(expr.argument);
      if (inner.kind === 'not') return inner.argument;
      return { kind: 'not', argument: inner };
    }
    case 'compare':
      return { kind: 'compare', op: expr.op, left: canonicalizeExpr(expr.left), right: canonicalizeExpr(expr.right) };
    case 'arith':
      return { kind: 'arith', op: expr.op, left: canonicalizeExpr(expr.left), right: canonicalizeExpr(expr.right) };
    case 'neg':
      return { kind: 'neg', argument: canonicalizeExpr(expr.argument) };
    case 'in':
      return { kind: 'in', element: canonicalizeExpr(expr.element), target: canonicalizeExpr(expr.target) };
    case 'set':
      return { kind: 'set', elements: expr.elements.map(canonicalizeExpr) };
    case 'interval':
      return {
        kind: 'interval',
        min: canonicalizeExpr(expr.min),
        max: canonicalizeExpr(expr.max),
        leftInclusive: expr.leftInclusive,
        rightInclusive: expr.rightInclusive,
      };
    case 'emptiness':
      return { kind: 'emptiness', target: canonicalizeExpr(expr.target), check: expr.check };
    case 'member':
      return { kind: 'member', object: canonicalizeExpr(expr.object), field: expr.field };
    case 'index':
      return { kind: 'index', collection: canonicalizeExpr(expr.collection), index: canonicalizeExpr(expr.index) };
    case 'call':
      return { kind: 'call', name: expr.name, args: expr.args.map(canonicalizeExpr) };
    case 'host':
      return { kind: 'host', name: expr.name, args: expr.args.map(canonicalizeExpr) };
    case 'quantifier':
      return {
        kind: 'quantifier',
        quantifier: expr.quantifier,
        variable: expr.variable,
        collection: canonicalizeExpr(expr.collection),
        body: canonicalizeExpr(expr.body),
      };
    default:
      return expr;
  }
}

function canonicalizeAction(action, predMap, externAliases) {
  const expand = e => canonicalizeExpr(expandExpr(e, predMap, externAliases, new Set()));
  switch (action.kind) {
    case 'reject':
      return { kind: 'reject', modality: action.modality, code: action.code };
    case 'emit':
      return { kind: 'emit', modality: action.modality, event: action.event };
    case 'transition':
      return { kind: 'transition', modality: action.modality, path: expand(action.path), value: expand(action.value) };
    case 'succeed-empty':
      return { kind: 'succeed-empty', modality: action.modality };
    case 'keep':
      return { kind: 'keep', modality: action.modality, expr: expand(action.expr) };
    case 'pin':
      return { kind: 'pin', modality: action.modality, artifact: action.artifact, inputs: action.inputs };
    case 'dispatch':
      return { kind: 'dispatch', modality: action.modality, target: action.target };
    case 'respond':
      return { kind: 'respond', modality: action.modality, response: action.response, constraint: action.constraint ? expand(action.constraint) : null };
    case 'expose':
      return { kind: 'expose', modality: action.modality, view: action.view, constraint: expand(action.constraint) };
    case 'supply':
      return { kind: 'supply', modality: action.modality, subject: action.subject, fields: action.fields };
    default:
      return action;
  }
}

export function classifyTheory(normalizedSpec) {
  let hasNonlinearMul = false;
  const externs = new Set();
  const hosts = new Set();
  const commands = new Set();

  const inspect = expr => walkExpr(expr, node => {
    if (node.kind === 'arith' && node.op === '*') {
      const leftConst = node.left.kind === 'number';
      const rightConst = node.right.kind === 'number';
      if (!leftConst && !rightConst) hasNonlinearMul = true;
    }
    if (node.kind === 'extern-ref') externs.add(node.name ?? `extern#${node.index}`);
    if (node.kind === 'host') hosts.add(node.name);
  });

  for (const ax of normalizedSpec.axioms) {
    if (ax.kind === 'invariant') inspect(ax.expandedExpr);
  }
  for (const rule of normalizedSpec.rules) {
    if (rule.command) commands.add(rule.command);
    inspect(rule.expandedGuard);
    for (const assign of rule.post) inspect(assign.expandedValue);
  }

  const hasMultiStepBmc = commands.size > 1 && normalizedSpec.rules.some(r => r.post.length > 0);
  const logic = hasNonlinearMul ? 'QF_NIA' : 'QF_AUFLIA';
  const tier = hasNonlinearMul || hasMultiStepBmc ? 'L2' : 'L1';
  return {
    tier,
    logic,
    timeoutSec: hasNonlinearMul ? 2 : 5,
    hasNonlinearMul,
    hasMultiStepBmc,
    commands: [...commands],
    externCount: externs.size,
    hosts: [...hosts],
  };
}

export function normalizeEars(ast) {
  const diagnostics = [];
  const predMap = new Map();
  const externAliases = new Map();

  for (const pred of ast.where) {
    if (predMap.has(pred.name)) {
      diagnostics.push({ severity: 'error', code: 'EARS_DUP_PRED', message: `duplicate predicate "${pred.name}"`, span: pred.span });
    }
    if (NEGATIVE_PREDICATE_PREFIX_RE.test(pred.name)) {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_NEG_PRED_NAME',
        message: `predicate "${pred.name}" violates positive-affirmative naming (must not start with negative prefix)`,
        span: pred.span,
      });
    }
    predMap.set(pred.name, pred);
  }

  ast.externs.forEach((ext, index) => {
    if (externAliases.has(ext.name)) {
      diagnostics.push({ severity: 'error', code: 'EARS_DUP_EXTERN', message: `duplicate extern "${ext.name}"`, span: ext.span });
    }
    if (NEGATIVE_PREDICATE_PREFIX_RE.test(ext.name)) {
      diagnostics.push({
        severity: 'error',
        code: 'EARS_NEG_PRED_NAME',
        message: `extern predicate "${ext.name}" violates positive-affirmative naming`,
        span: ext.span,
      });
    }
    externAliases.set(ext.name, { ...ext, index });
  });

  const defaultCommand = ast.kind === 'slice' && ast.target.includes('.')
    ? ast.target.split('.').slice(1).join('.')
    : null;

  const axioms = ast.axioms.map(ax => {
    if (ax.kind === 'invariant') {
      const expandedExpr = expandExpr(ax.expr, predMap, externAliases, new Set());
      return { ...ax, expandedExpr, canonicalExpr: canonicalizeExpr(expandedExpr) };
    }
    const canonicalActions = ax.actions.map(a => canonicalizeAction(a, predMap, externAliases));
    return { ...ax, canonicalActions };
  });

  const seenRuleIds = new Set();
  const rules = ast.rules.map(rule => {
    if (seenRuleIds.has(rule.id)) {
      diagnostics.push({ severity: 'error', code: 'EARS_DUP_RULE_ID', message: `duplicate rule ID [${rule.id}]`, span: rule.span });
    }
    seenRuleIds.add(rule.id);

    const rawGuard = combineRuleGuard(rule.clauses);
    const expandedGuard = expandExpr(rawGuard, predMap, externAliases, new Set());
    const canonicalGuard = canonicalizeExpr(expandedGuard);
    const command = rule.clauses.whenEvent ?? defaultCommand;
    const canonicalActions = rule.actions.map(a => canonicalizeAction(a, predMap, externAliases));
    const post = rule.post.map(assign => {
      const expandedValue = expandExpr(assign.value, predMap, externAliases, new Set());
      const expandedIndex = assign.target.index ? expandExpr(assign.target.index, predMap, externAliases, new Set()) : null;
      return {
        ...assign,
        expandedIndex,
        expandedValue,
        canonicalTarget: { segments: assign.target.segments, index: expandedIndex ? canonicalizeExpr(expandedIndex) : null },
        canonicalValue: canonicalizeExpr(expandedValue),
      };
    });

    return {
      ...rule,
      command,
      triggerKind: rule.clauses?.whenTriggerKind ?? 'command',
      rawGuard,
      expandedGuard,
      canonicalGuard,
      canonicalActions,
      post,
    };
  });

  const normalized = {
    ...ast,
    axioms,
    rules,
    diagnostics,
  };
  normalized.theory = classifyTheory(normalized);

  const canonicalForm = {
    kind: normalized.kind,
    target: normalized.target,
    layer: normalized.layer,
    externCount: ast.externs.length,
    axioms: axioms.map(ax => (
      ax.kind === 'invariant'
        ? { id: ax.id, kind: ax.kind, expr: ax.canonicalExpr }
        : { id: ax.id, kind: ax.kind, actions: ax.canonicalActions }
    )),
    rules: rules.map(r => ({
      id: r.id,
      command: r.command,
      ...(r.triggerKind === 'event' ? { triggerKind: 'event' } : {}),
      guard: r.canonicalGuard,
      actions: r.canonicalActions,
      post: r.post.map(p => ({ target: p.canonicalTarget, value: p.canonicalValue })),
    })),
  };

  normalized.canonicalForm = canonicalForm;
  normalized.canonicalSha256 = createHash('sha256').update(JSON.stringify(canonicalForm)).digest('hex');
  return normalized;
}
