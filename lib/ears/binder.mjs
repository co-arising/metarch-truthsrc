// Read-only symbol table loader & binder connecting co-arising EARS 1.0 AST to truthsrc.
import { readFileSync } from 'node:fs';
import { captureProject } from '../project/cli.mjs';

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
    return { kind: 'string', typeName: typeId };
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

function collectPathRoots(expr, out = []) {
  if (!expr || typeof expr !== 'object') return out;
  if (expr.kind === 'var') {
    out.push([expr.name]);
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
      chain.unshift(cur.name);
      out.push(chain);
    } else {
      collectPathRoots(cur, out);
    }
    return out;
  }
  if (expr.kind === 'index') {
    collectPathRoots(expr.collection, out);
    collectPathRoots(expr.index, out);
    return out;
  }
  for (const key of ['left', 'right', 'argument', 'element', 'target', 'min', 'max']) {
    if (expr[key]) collectPathRoots(expr[key], out);
  }
  for (const key of ['elements', 'args']) {
    if (Array.isArray(expr[key])) {
      for (const item of expr[key]) collectPathRoots(item, out);
    }
  }
  return out;
}

function resolveChainType(chain, agg, cmd, stateAliases) {
  if (chain.length === 0) return { resolved: false, type: { kind: 'unknown' } };
  const [head, ...rest] = chain;

  if (stateAliases.has(head) && rest.length > 0 && agg) {
    let current = agg.stateFields[rest[0]];
    if (!current) return { resolved: false, reason: `unknown state field "${rest[0]}" on ${agg.name}`, type: { kind: 'unknown' } };
    for (const seg of rest.slice(1)) {
      if (current.kind === 'record' && current.fields?.[seg]) current = current.fields[seg];
      else if (current.kind === 'optional' && current.element?.kind === 'record' && current.element.fields?.[seg]) current = current.element.fields[seg];
      else return { resolved: false, reason: `unknown member "${seg}" on path "${chain.join('.')}"`, type: { kind: 'unknown' } };
    }
    return { resolved: true, scope: 'state', canonicalPath: ['state', ...rest], type: current };
  }

  if (cmd && Object.hasOwn(cmd.params, head)) {
    let current = cmd.params[head];
    for (const seg of rest) {
      if (current.kind === 'record' && current.fields?.[seg]) current = current.fields[seg];
      else if (current.kind === 'optional' && current.element?.kind === 'record' && current.element.fields?.[seg]) current = current.element.fields[seg];
      else return { resolved: false, reason: `unknown member "${seg}" on param "${head}"`, type: { kind: 'unknown' } };
    }
    return { resolved: true, scope: 'param', canonicalPath: ['param', ...chain], type: current };
  }

  return { resolved: false, reason: `unresolved symbol "${chain.join('.')}"`, type: { kind: 'unknown' } };
}

export function bindEarsSpec(normalizedSpec, symbolTable, { strictRuleRefs = false } = {}) {
  const diagnostics = [...normalizedSpec.diagnostics];
  const resolvedSymbols = new Map();

  if (!symbolTable) {
    return { ...normalizedSpec, bound: false, aggregate: null, resolvedSymbols, diagnostics };
  }

  if (normalizedSpec.kind === 'story') {
    const story = symbolTable.stories.get(normalizedSpec.target) ?? null;
    if (!story) {
      diagnostics.push({ severity: 'warning', code: 'EARS_UNKNOWN_STORY', message: `story "${normalizedSpec.target}" not found in symbol table` });
    }
    return { ...normalizedSpec, bound: Boolean(story), story, aggregate: null, resolvedSymbols, diagnostics };
  }

  const aggName = normalizedSpec.target.split('.')[0];
  const agg = symbolTable.aggregates.get(aggName) ?? null;
  if (!agg) {
    diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_AGGREGATE', message: `aggregate "${aggName}" not found in symbol table` });
    return { ...normalizedSpec, bound: false, aggregate: null, resolvedSymbols, diagnostics };
  }

  const stateAliases = new Set(agg.aliases);
  const defaultCmdName = normalizedSpec.target.includes('.') ? normalizedSpec.target.split('.').slice(1).join('.') : null;
  const defaultCmd = defaultCmdName ? agg.commands.get(defaultCmdName) ?? null : null;
  const checkExprSymbols = (expr, cmd, { allowFreeIndexVar = false } = {}) => {
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
        diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_SYMBOL', message: res.reason });
      }
    }
  };

  for (const ax of normalizedSpec.axioms) {
    if (ax.kind === 'invariant') checkExprSymbols(ax.expandedExpr, defaultCmd, { allowFreeIndexVar: true });
  }

  for (const rule of normalizedSpec.rules) {
    const cmd = rule.command ? agg.commands.get(rule.command) ?? null : null;
    if (rule.command && !cmd) {
      diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_COMMAND', message: `command "${rule.command}" not declared on aggregate "${agg.name}"` });
    }
    checkExprSymbols(rule.expandedGuard, cmd);
    for (const action of rule.actions) {
      if (action.kind === 'emit' && agg.events.size > 0 && !agg.events.has(action.event)) {
        diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_EVENT', message: `event "${action.event}" not declared on aggregate "${agg.name}"` });
      }
      if (action.kind === 'reject' && agg.ruleRefs.size > 0 && !agg.ruleRefs.has(action.code)) {
        diagnostics.push({
          severity: strictRuleRefs ? 'error' : 'warning',
          code: 'EARS_UNANCHORED_RULE_ID',
          message: `reject code "${action.code}" is not registered in ${agg.name}.aggregateRuleRefs`,
        });
      }
    }
    for (const assign of rule.post) {
      const res = resolveChainType(assign.target.segments, agg, cmd, stateAliases);
      if (!res.resolved) {
        diagnostics.push({ severity: 'error', code: 'EARS_UNKNOWN_SYMBOL', message: `post target ${res.reason}` });
      } else {
        resolvedSymbols.set(`${cmd?.name ?? '*'}::${assign.target.segments.join('.')}`, res);
      }
      if (assign.expandedIndex) checkExprSymbols(assign.expandedIndex, cmd);
      checkExprSymbols(assign.expandedValue, cmd);
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
