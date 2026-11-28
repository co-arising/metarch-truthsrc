// DMN First-Hit exact witness & anti-hardcoding secondary witness synthesizer via SMT (get-value).
import { createSmtContext, extractIndexedAccess, nestedSelect, substituteBoundVar } from '../ears/smt-encoder.mjs';
import { runSmtJob } from '../ears/smt-solver.mjs';

function sanitizeId(raw) {
  return raw.replace(/[^A-Za-z0-9_]/gu, '_');
}

function walkExpr(expr, fn) {
  if (!expr || typeof expr !== 'object') return;
  fn(expr);
  for (const k of ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index', 'body']) {
    if (expr[k]) walkExpr(expr[k], fn);
  }
  for (const k of ['elements', 'args']) {
    if (Array.isArray(expr[k])) expr[k].forEach(c => walkExpr(c, fn));
  }
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

function formatScaledInt(intVal, scale) {
  if (scale <= 0) return String(intVal);
  const neg = intVal < 0n;
  const abs = neg ? -intVal : intVal;
  const s = abs.toString().padStart(scale + 1, '0');
  const whole = s.slice(0, s.length - scale);
  const frac = s.slice(s.length - scale);
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

function tokenizeSexp(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/u.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === ';') {
      while (i < input.length && input[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i += 1;
      continue;
    }
    let j = i;
    while (j < input.length && !/[\s()]/u.test(input[j])) j += 1;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

function parseSexps(input) {
  const tokens = tokenizeSexp(input);
  let pos = 0;
  function readOne() {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos];
    pos += 1;
    if (tok === '(') {
      const list = [];
      while (pos < tokens.length && tokens[pos] !== ')') list.push(readOne());
      if (tokens[pos] === ')') pos += 1;
      return list;
    }
    return tok;
  }
  const out = [];
  while (pos < tokens.length) out.push(readOne());
  return out;
}

function evalSexpScalar(node) {
  if (typeof node === 'string') {
    if (node === 'true') return true;
    if (node === 'false') return false;
    if (/^\d+$/u.test(node)) return BigInt(node);
    return node;
  }
  if (Array.isArray(node) && node.length === 2 && node[0] === '-' && typeof node[1] === 'string' && /^\d+$/u.test(node[1])) {
    return -BigInt(node[1]);
  }
  return null;
}

function parseGetValuePairs(rawStdout) {
  const sexps = parseSexps(rawStdout);
  // Expect: sat, then ((term val) (term val) ...)
  for (const item of sexps) {
    if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0]) && item[0].length === 2) {
      return item.map(pair => evalSexpScalar(pair[1]));
    }
  }
  return null;
}

function collectProbeTerms(spec, ctx) {
  const probes = [];
  const seen = new Set();

  const addProbe = (key, smtTerm, meta) => {
    if (seen.has(key)) return;
    seen.add(key);
    probes.push({ key, smtTerm, ...meta });
  };

  for (const info of ctx.vars.values()) {
    if (info.displayPath.startsWith('@host(')) continue;
    addProbe(`var:${info.displayPath}`, info.smtName, {
      kind: 'var',
      path: info.displayPath,
      sort: info.sort,
      scale: info.scale,
      isEnum: info.isEnum,
      isState: info.isState,
    });
  }

  const intermediateIndexedNodes = new Set();
  const markIntermediateIndexed = expr => walkExpr(expr, node => {
    const acc = extractIndexedAccess(node);
    if (!acc) return;
    let cur = node;
    while (cur?.kind === 'member') {
      if (cur !== node) intermediateIndexedNodes.add(cur);
      cur = cur.object;
    }
    while (cur?.kind === 'index') {
      if (cur !== node) intermediateIndexedNodes.add(cur);
      cur = cur.collection;
    }
  });

  const scanExpr = expr => {
    markIntermediateIndexed(expr);
    walkExpr(expr, node => {
      if (!intermediateIndexedNodes.has(node)) {
        const acc = extractIndexedAccess(node);
        if (acc) {
          const m = ctx.maps.get(acc.mapPath);
          const dm = acc.depth > 1 ? m?.byDepth?.get(acc.depth) : m;
          if (m && dm) {
            const keyExprs = acc.indexExprs.map(e => ctx.encodeExpr(e));
            const keyPaths = acc.indexExprs.map(e => (isSimplePath(e) ? pathToString(e) : ctx.encodeExpr(e)));
            const keySig = keyPaths.map(k => `[${k}]`).join('');
            const presBase = acc.depth > 1 ? `${m.smtBase}__d${acc.depth}__present` : `${m.smtBase}__present`;
            if (acc.fields.length > 0) {
              const sf = dm.subfields?.get(acc.fieldPath);
              if (sf) {
                addProbe(`mapsub:${acc.mapPath}${keySig}.${acc.fieldPath}`, nestedSelect(sf.smtName, keyExprs), {
                  kind: 'map-subfield',
                  mapPath: acc.mapPath,
                  keyPaths,
                  fieldPath: acc.fieldPath,
                  sort: sf.sort,
                  scale: sf.scale,
                  isEnum: sf.isEnum,
                });
                if (m.hasPresence && acc.depth === 1) {
                  addProbe(`mappres:${acc.mapPath}${keySig}`, nestedSelect(presBase, keyExprs), {
                    kind: 'map-present',
                    mapPath: acc.mapPath,
                    keyPaths,
                  });
                }
              }
            } else {
              const valBase = acc.depth > 1 ? `${m.smtBase}__d${acc.depth}__val` : `${m.smtBase}__val`;
              addProbe(`mapval:${acc.mapPath}${keySig}`, nestedSelect(valBase, keyExprs), {
                kind: 'map-entry',
                mapPath: acc.mapPath,
                keyPaths,
                sort: dm.valSort ?? 'Int',
                scale: dm.valScale ?? 0,
                isEnum: dm.valIsEnum ?? false,
                indexedLookup: true,
              });
              if (m.hasPresence && acc.depth === 1) {
                addProbe(`mappres:${acc.mapPath}${keySig}`, nestedSelect(presBase, keyExprs), {
                  kind: 'map-present',
                  mapPath: acc.mapPath,
                  keyPaths,
                });
              }
            }
          }
        }
      }
      if (node.kind === 'in' && isSimplePath(node.target)) {
        const mp = pathToString(node.target);
        const m = ctx.maps.get(mp);
        if (m) {
          const keyExpr = ctx.encodeExpr(node.element);
          const keyPath = isSimplePath(node.element) ? pathToString(node.element) : keyExpr;
          addProbe(`mapval:${mp}[${keyPath}]`, `(select ${m.smtBase}__val ${keyExpr})`, {
            kind: 'map-entry',
            mapPath: mp,
            keyPaths: [keyPath],
            scale: m.valScale,
            isEnum: m.valIsEnum,
            indexedLookup: false,
          });
          addProbe(`mappres:${mp}[${keyPath}]`, `(select ${m.smtBase}__present ${keyExpr})`, {
            kind: 'map-present',
            mapPath: mp,
            keyPaths: [keyPath],
          });
        }
      }
      if (node.kind === 'extern-ref') {
        const extMeta = spec.externs[node.index];
        const name = extMeta?.name ?? node.name ?? `extern_${node.index}`;
        const smtTerm = node.args.length === 0
          ? `ext__${node.index}`
          : `(ext__${node.index} ${node.args.map(a => ctx.encodeExpr(a)).join(' ')})`;
        addProbe(`extern:${name}`, smtTerm, {
          kind: 'extern',
          name,
          index: node.index,
        });
      }
    });
  };

  for (const ax of spec.axioms) {
    if (ax.kind === 'invariant') scanExpr(ax.expandedExpr);
  }
  for (const rule of spec.rules) {
    scanExpr(rule.expandedGuard);
    for (const assign of rule.post) {
      if (assign.expandedIndex) scanExpr(assign.expandedIndex);
      scanExpr(assign.expandedValue);
    }
  }

  return probes;
}

function decodeProbeValue(probe, rawVal, stringReverse) {
  if (rawVal === null || rawVal === undefined) return null;
  if (probe.kind === 'extern' || probe.kind === 'map-present' || probe.sort === 'Bool') {
    return rawVal === true || rawVal === 'true';
  }
  if (probe.isEnum) {
    const idx = Number(rawVal);
    if (idx >= 0 && idx < stringReverse.length && stringReverse[idx] !== '__OTHER__') {
      return stringReverse[idx];
    }
    return `id_${Math.abs(idx) + 1}`;
  }
  if (typeof rawVal === 'bigint') {
    return probe.scale > 0 ? formatScaledInt(rawVal, probe.scale) : Number(rawVal);
  }
  return rawVal;
}

function setNestedField(target, fieldPath, value) {
  const parts = fieldPath.split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function ensureNestedMapSlot(rootMap, keyPaths) {
  let cur = rootMap;
  for (let i = 0; i < keyPaths.length - 1; i += 1) {
    const k = keyPaths[i];
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k];
  }
  return { parent: cur, leafKey: keyPaths[keyPaths.length - 1] };
}

function assembleWitness(probes, values, stringReverse) {
  const scalars = {};
  const mapEntries = {};
  const mapPresence = {};
  const pendingIndexedEntries = [];
  const pendingMembershipEntries = [];
  const pendingSubfieldEntries = [];
  const externs = {};
  const rawTerms = [];

  const pendingRawTerms = [];

  for (let i = 0; i < probes.length; i += 1) {
    const probe = probes[i];
    const rawVal = values[i];
    if (rawVal === null || rawVal === undefined) continue;
    const decoded = decodeProbeValue(probe, rawVal, stringReverse);
    const keyPaths = probe.keyPaths ?? (probe.keyPath !== undefined ? [probe.keyPath] : []);
    const keySig = keyPaths.join('\0');
    if (probe.kind === 'var') {
      scalars[probe.path] = decoded;
      if (probe.sort === 'Int' && !probe.isEnum && typeof rawVal === 'bigint') {
        pendingRawTerms.push({
          path: probe.path,
          smtTerm: probe.smtTerm,
          smtVal: rawVal < 0n ? `(- ${(-rawVal).toString()})` : rawVal.toString(),
        });
      }
    } else if (probe.kind === 'map-present') {
      if (!mapPresence[probe.mapPath]) mapPresence[probe.mapPath] = {};
      mapPresence[probe.mapPath][keySig] = Boolean(decoded);
    } else if (probe.kind === 'map-entry') {
      if (probe.indexedLookup) {
        pendingIndexedEntries.push({ mapPath: probe.mapPath, keyPaths, keySig, decoded });
        if (probe.sort === 'Int' && !probe.isEnum && typeof rawVal === 'bigint') {
          pendingRawTerms.push({
            path: `${probe.mapPath}${keyPaths.map(k => `[${k}]`).join('')}`,
            smtTerm: probe.smtTerm,
            smtVal: rawVal < 0n ? `(- ${(-rawVal).toString()})` : rawVal.toString(),
          });
        }
      } else {
        pendingMembershipEntries.push({ mapPath: probe.mapPath, keyPaths, keySig, decoded });
      }
    } else if (probe.kind === 'map-subfield') {
      pendingSubfieldEntries.push({
        mapPath: probe.mapPath,
        keyPaths,
        keySig,
        fieldPath: probe.fieldPath,
        decoded,
      });
      if (probe.sort === 'Int' && !probe.isEnum && typeof rawVal === 'bigint') {
        pendingRawTerms.push({
          path: `${probe.mapPath}${keyPaths.map(k => `[${k}]`).join('')}.${probe.fieldPath}`,
          smtTerm: probe.smtTerm,
          smtVal: rawVal < 0n ? `(- ${(-rawVal).toString()})` : rawVal.toString(),
        });
      }
    } else if (probe.kind === 'extern') {
      externs[probe.name] = Boolean(decoded);
    }
  }

  for (const term of pendingRawTerms) {
    // Skip dead payload variables of absent Optional[T] fields (.__present === false)
    // so secondary witness synthesis cannot trivially flip an ignored inner value.
    if (scalars[`${term.path}.__present`] === false) continue;
    rawTerms.push({ smtTerm: term.smtTerm, smtVal: term.smtVal });
  }

  // Assemble record subfields for present (or unconstrained-presence) map entries
  const subfieldsSeen = new Set();
  for (const sf of pendingSubfieldEntries) {
    if (mapPresence[sf.mapPath]?.[sf.keySig] === false) continue;
    if (!mapEntries[sf.mapPath]) mapEntries[sf.mapPath] = {};
    const { parent, leafKey } = ensureNestedMapSlot(mapEntries[sf.mapPath], sf.keyPaths);
    if (!parent[leafKey] || typeof parent[leafKey] !== 'object' || Array.isArray(parent[leafKey])) {
      parent[leafKey] = {};
    }
    setNestedField(parent[leafKey], sf.fieldPath, sf.decoded);
    subfieldsSeen.add(`${sf.mapPath}::${sf.keySig}`);
  }

  for (const item of pendingIndexedEntries) {
    if (mapPresence[item.mapPath]?.[item.keySig] === false) continue;
    if (subfieldsSeen.has(`${item.mapPath}::${item.keySig}`)) continue;
    if (!mapEntries[item.mapPath]) mapEntries[item.mapPath] = {};
    const { parent, leafKey } = ensureNestedMapSlot(mapEntries[item.mapPath], item.keyPaths);
    parent[leafKey] = item.decoded;
  }

  for (const item of pendingMembershipEntries) {
    if (mapPresence[item.mapPath]?.[item.keySig] === true) {
      if (subfieldsSeen.has(`${item.mapPath}::${item.keySig}`)) continue;
      if (!mapEntries[item.mapPath]) mapEntries[item.mapPath] = {};
      const { parent, leafKey } = ensureNestedMapSlot(mapEntries[item.mapPath], item.keyPaths);
      if (!Object.hasOwn(parent, leafKey)) {
        parent[leafKey] = item.decoded;
      }
    }
  }

  return { scalars, mapEntries, externs, rawTerms };
}

function buildRealisticHints(ctx) {
  const hints = [];
  for (const info of ctx.vars.values()) {
    if (info.sort !== 'Int') continue;
    if (info.isEnum) {
      hints.push(`(>= ${info.smtName} 0)`);
      hints.push(`(<= ${info.smtName} ${Math.max(0, ctx.stringReverse.length - 1)})`);
    } else {
      hints.push(`(>= ${info.smtName} 0)`);
      hints.push(`(<= ${info.smtName} 1000000)`);
    }
  }
  return hints;
}

function solveSingleWitness(baseLines, probes, extraAsserts, { solver, timeoutSec }, stringReverse) {
  if (probes.length === 0) {
    return { sat: true, witness: { scalars: {}, mapEntries: {}, externs: {}, rawTerms: [] } };
  }
  const getValTerms = probes.map(p => p.smtTerm).join(' ');
  const smt2 = [
    ...baseLines,
    '(push 1)',
    ...extraAsserts.map(a => `  (assert ${a})`),
    '  (check-sat)',
    `  (get-value (${getValTerms}))`,
    '(pop 1)',
  ].join('\n');

  const res = runSmtJob(smt2, { solver, timeoutSec });
  if (res.status !== 'sat') return { sat: false, status: res.status };
  const vals = parseGetValuePairs(res.rawStdout);
  if (!vals || vals.length !== probes.length) {
    return { sat: false, status: 'error' };
  }
  return { sat: true, witness: assembleWitness(probes, vals, stringReverse) };
}

function collectOptionalPresenceTerms(expr, ctx, out = new Set()) {
  if (!expr || typeof expr !== 'object') return out;
  if (isSimplePath(expr)) {
    const segs = pathToString(expr).split('.');
    for (let i = segs.length; i >= 1; i -= 1) {
      const prefix = segs.slice(0, i).join('.');
      const presInfo = ctx.vars.get(`v__${sanitizeId(`${prefix}.__present`)}`);
      if (presInfo) out.add(presInfo.smtName);
    }
    return out;
  }
  for (const k of ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index']) {
    if (expr[k]) collectOptionalPresenceTerms(expr[k], ctx, out);
  }
  for (const k of ['elements', 'args']) {
    if (Array.isArray(expr[k])) expr[k].forEach(c => collectOptionalPresenceTerms(c, ctx, out));
  }
  return out;
}

function collectBoundaryEqualityAssertions(expr, ctx) {
  const entries = [];
  const seen = new Set();
  const addEntry = (eqSmt, pathConds, extraConds = []) => {
    const conds = [...pathConds, ...extraConds];
    const key = `${eqSmt}@@${conds.join('&')}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ eqSmt, conds });
  };

  const visit = (node, pathConds) => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'binary' && node.op === 'or') {
      const leftSmt = ctx.encodeExpr(node.left);
      const rightSmt = ctx.encodeExpr(node.right);
      visit(node.left, [...pathConds, `(not ${rightSmt})`]);
      visit(node.right, [...pathConds, `(not ${leftSmt})`]);
      return;
    }
    if (node.kind === 'quantifier') {
      const q = ctx.getQuantifier?.(node);
      if (q && node.body) {
        visit(substituteBoundVar(node.body, node.variable, q.elVar), pathConds);
        visit(substituteBoundVar(node.body, node.variable, `@qdef(${q.colPath})`), pathConds);
      }
      return;
    }
    if (node.kind === 'compare' && ['<', '<=', '>', '>='].includes(node.op)) {
      const eqExpr = { kind: 'compare', op: '==', left: node.left, right: node.right };
      const eqSmt = ctx.encodeExpr(eqExpr);
      const pres = [...collectOptionalPresenceTerms(node.left, ctx), ...collectOptionalPresenceTerms(node.right, ctx)];
      addEntry(eqSmt, pathConds, pres);
    }
    if (node.kind === 'in' && node.target?.kind === 'interval') {
      for (const bound of [node.target.min, node.target.max]) {
        const eqSmt = ctx.encodeExpr({ kind: 'compare', op: '==', left: node.element, right: bound });
        const pres = [...collectOptionalPresenceTerms(node.element, ctx), ...collectOptionalPresenceTerms(bound, ctx)];
        addEntry(eqSmt, pathConds, pres);
      }
    }
    for (const k of ['left', 'right', 'argument', 'element', 'target', 'min', 'max', 'object', 'collection', 'index']) {
      if (node[k]) visit(node[k], pathConds);
    }
    for (const k of ['elements', 'args']) {
      if (Array.isArray(node[k])) node[k].forEach(c => visit(c, pathConds));
    }
  };
  visit(expr, []);
  return entries;
}

export function synthesizeFirstHitWitnesses(spec, { solver = 'z3', timeoutSec } = {}) {
  const effectiveTimeout = timeoutSec ?? spec.theory?.timeoutSec ?? 5;
  const ctx = createSmtContext(spec);
  const logic = spec.theory?.logic ?? 'QF_AUFLIA';
  const invariantAxioms = spec.axioms.filter(a => a.kind === 'invariant');
  const baseDecls = ctx.emitDeclarations({ suffixes: [''] });
  const axiomAsserts = invariantAxioms.map(ax => `(assert (! ${ctx.encodeExpr(ax.expandedExpr)} :named ${sanitizeId(ax.id)}))`);
  const baseLines = [
    `(set-option :produce-models true)`,
    `(set-logic ${logic})`,
    ...baseDecls,
    ...axiomAsserts,
  ];
  const probes = collectProbeTerms(spec, ctx);
  const realisticHints = buildRealisticHints(ctx);

  const commandGroups = new Map();
  for (const rule of spec.rules) {
    const cmd = rule.command ?? '*';
    if (!commandGroups.has(cmd)) commandGroups.set(cmd, []);
    commandGroups.get(cmd).push(rule);
  }

  const byRuleId = new Map();
  const shadowedRules = [];
  const solverErrors = [];

  for (const [command, rules] of commandGroups) {
    const priorNegations = [];
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      const guardSmt = ctx.encodeExpr(rule.expandedGuard);
      const exactAsserts = [...priorNegations, guardSmt];

      // Try with realistic non-negative hints first so generated tests are readable and realistic
      let primary = solveSingleWitness(
        baseLines,
        probes,
        [...exactAsserts, ...realisticHints],
        { solver, timeoutSec: effectiveTimeout },
        ctx.stringReverse,
      );
      if (!primary.sat) {
        primary = solveSingleWitness(
          baseLines,
          probes,
          exactAsserts,
          { solver, timeoutSec: effectiveTimeout },
          ctx.stringReverse,
        );
      }

      if (!primary.sat) {
        const st = primary.status ?? 'unsat';
        if (st === 'unsat') {
          shadowedRules.push({
            command,
            ruleId: rule.id,
            firstHitOrder: i,
            status: st,
          });
        } else {
          solverErrors.push({
            command,
            ruleId: rule.id,
            firstHitOrder: i,
            status: st,
          });
        }
      } else {
        // Synthesize a distinct secondary witness to defeat single-witness hardcoding
        let secondary = null;
        if (primary.witness.rawTerms.length > 0) {
          const diffClauses = primary.witness.rawTerms.map(t => `(not (= ${t.smtTerm} ${t.smtVal}))`);
          const diffAssert = diffClauses.length === 1 ? diffClauses[0] : `(or ${diffClauses.join(' ')})`;
          const secAttempt = solveSingleWitness(
            baseLines,
            probes,
            [...exactAsserts, ...realisticHints, diffAssert],
            { solver, timeoutSec: effectiveTimeout },
            ctx.stringReverse,
          );
          if (secAttempt.sat) {
            secondary = {
              scalars: secAttempt.witness.scalars,
              mapEntries: secAttempt.witness.mapEntries,
              externs: secAttempt.witness.externs,
            };
          }
        }

        // Synthesize exact boundary-equality witnesses to kill off-by-one (< vs <=, > vs >=) mutants
        const boundaries = [];
        const seenBoundSig = new Set([
          JSON.stringify(primary.witness.scalars),
          secondary ? JSON.stringify(secondary.scalars) : '',
        ]);
        const eqEntries = collectBoundaryEqualityAssertions(rule.expandedGuard, ctx);
        for (const { eqSmt, conds } of eqEntries) {
          let bAttempt = solveSingleWitness(
            baseLines,
            probes,
            [...exactAsserts, ...realisticHints, ...conds, eqSmt],
            { solver, timeoutSec: effectiveTimeout },
            ctx.stringReverse,
          );
          if (!bAttempt.sat && conds.length > 0) {
            bAttempt = solveSingleWitness(
              baseLines,
              probes,
              [...exactAsserts, ...conds, eqSmt],
              { solver, timeoutSec: effectiveTimeout },
              ctx.stringReverse,
            );
          }
          if (!bAttempt.sat) {
            bAttempt = solveSingleWitness(
              baseLines,
              probes,
              [...exactAsserts, ...realisticHints, eqSmt],
              { solver, timeoutSec: effectiveTimeout },
              ctx.stringReverse,
            );
          }
          if (!bAttempt.sat) {
            bAttempt = solveSingleWitness(
              baseLines,
              probes,
              [...exactAsserts, eqSmt],
              { solver, timeoutSec: effectiveTimeout },
              ctx.stringReverse,
            );
          }
          if (bAttempt.sat) {
            const sig = JSON.stringify(bAttempt.witness.scalars);
            if (!seenBoundSig.has(sig)) {
              seenBoundSig.add(sig);
              boundaries.push({
                scalars: bAttempt.witness.scalars,
                mapEntries: bAttempt.witness.mapEntries,
                externs: bAttempt.witness.externs,
              });
            }
          }
        }

        byRuleId.set(rule.id, {
          ruleId: rule.id,
          firstHitOrder: i,
          primary: {
            scalars: primary.witness.scalars,
            mapEntries: primary.witness.mapEntries,
            externs: primary.witness.externs,
          },
          secondary,
          boundaries,
        });
      }

      priorNegations.push(`(not ${guardSmt})`);
    }
  }

  return { byRuleId, shadowedRules, solverErrors };
}
