// Shared typed witness materializer converting Z3 First-Hit witnesses into exact target structures.

function padDecimal(raw, scale) {
  if (raw === null || raw === undefined) return scale > 0 ? `0.${'0'.repeat(scale)}` : '0';
  const s = String(raw).trim();
  if (scale <= 0) return s.split('.')[0] || '0';
  const neg = s.startsWith('-');
  const unsigned = neg ? s.slice(1) : s;
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const frac = fracPart.padEnd(scale, '0').slice(0, scale);
  return `${neg ? '-' : ''}${intPart}.${frac}`;
}

export function coerceTypedValue(raw, resolvedType) {
  if (!resolvedType) return raw ?? '';
  switch (resolvedType.kind) {
    case 'int':
      if (raw === null || raw === undefined) return 0;
      return Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : 0;
    case 'bool':
      if (raw === null || raw === undefined) return false;
      return Boolean(raw);
    case 'decimal':
      return padDecimal(raw, resolvedType.scale ?? 2);
    case 'string':
      if (raw === null || raw === undefined) return '';
      return String(raw);
    case 'optional':
      return raw === null || raw === undefined ? null : coerceTypedValue(raw, resolvedType.element);
    case 'sequence':
      return Array.isArray(raw) ? raw : [];
    case 'map':
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    case 'record': {
      const obj = {};
      for (const [fName, fType] of Object.entries(resolvedType.fields ?? {})) {
        const subRaw = raw && typeof raw === 'object' ? raw[fName] : undefined;
        obj[fName] = coerceTypedValue(subRaw, fType);
      }
      return obj;
    }
    default:
      return raw ?? '';
  }
}

export function normalizeWitnessScalars(rawScalars = {}) {
  const presence = new Map();
  for (const [key, val] of Object.entries(rawScalars)) {
    if (key.endsWith('.__present')) {
      presence.set(key.slice(0, -'.__present'.length), Boolean(val));
    }
  }
  const normalized = {};
  for (const [key, val] of Object.entries(rawScalars)) {
    if (key.endsWith('.__present')) continue;
    if (presence.has(key)) {
      normalized[key] = presence.get(key) ? val : null;
    } else {
      normalized[key] = val;
    }
  }
  for (const [basePath, isPresent] of presence) {
    if (!Object.hasOwn(normalized, basePath)) {
      normalized[basePath] = isPresent ? '' : null;
    }
  }
  return normalized;
}

function readWitnessPath(scalars, pathCandidates, resolvedType) {
  if (resolvedType?.kind === 'optional') {
    for (const key of pathCandidates) {
      const presKey = `${key}.__present`;
      if (Object.hasOwn(scalars, presKey)) {
        if (!scalars[presKey]) return null;
        const inner = readWitnessPath(scalars, [key], resolvedType.element);
        return inner !== undefined ? inner : coerceTypedValue(undefined, resolvedType.element);
      }
    }
  }
  for (const key of pathCandidates) {
    if (Object.hasOwn(scalars, key)) {
      return coerceTypedValue(scalars[key], resolvedType);
    }
  }
  if (resolvedType?.kind === 'record') {
    const obj = {};
    let anyFound = false;
    for (const [fName, fType] of Object.entries(resolvedType.fields ?? {})) {
      const subCandidates = pathCandidates.map(p => `${p}.${fName}`);
      const subVal = readWitnessPath(scalars, subCandidates, fType);
      if (subVal !== undefined) anyFound = true;
      obj[fName] = subVal !== undefined ? subVal : coerceTypedValue(undefined, fType);
    }
    if (anyFound) return obj;
  }
  return undefined;
}

export function materializeDomainWitness(agg, cmd, witness) {
  const scalars = witness?.scalars ?? {};
  const mapEntries = witness?.mapEntries ?? {};
  const aliases = agg.aliases ?? ['state', agg.name.toLowerCase()];

  // Materialize command parameters first so map keys referencing command params resolve cleanly
  const cmdData = { type: cmd.name };
  for (const p of cmd.parameters) {
    const val = readWitnessPath(scalars, [p.name], p.resolvedType);
    cmdData[p.name] = val !== undefined ? val : coerceTypedValue(p.defaultValue, p.resolvedType);
  }

  // Materialize aggregate state fields
  const stateData = {};
  for (const sf of agg.stateFields) {
    const candidates = aliases.map(a => `${a}.${sf.name}`);
    if (sf.resolvedType?.kind === 'map') {
      const builtMap = {};
      for (const cand of candidates) {
        const entries = mapEntries[cand];
        if (!entries) continue;
        for (const [keyPath, rawMapVal] of Object.entries(entries)) {
          let resolvedKey = keyPath;
          if (Object.hasOwn(cmdData, keyPath)) {
            resolvedKey = String(cmdData[keyPath]);
          } else if (Object.hasOwn(scalars, keyPath)) {
            resolvedKey = String(scalars[keyPath]);
          }
          builtMap[resolvedKey] = coerceTypedValue(rawMapVal, sf.resolvedType.value);
        }
      }
      stateData[sf.name] = builtMap;
      continue;
    }

    const val = readWitnessPath(scalars, candidates, sf.resolvedType);
    stateData[sf.name] = val !== undefined ? val : coerceTypedValue(sf.defaultValue, sf.resolvedType);
  }

  return { state: stateData, command: cmdData };
}

export function materializeApplicationWitness(witness) {
  const scalars = normalizeWitnessScalars(witness?.scalars ?? {});
  const payload = {};
  const stateSnapshot = {};

  const nestedRoots = new Set();
  for (const rawKey of Object.keys(scalars)) {
    const dot = rawKey.indexOf('.');
    if (dot > 0) nestedRoots.add(rawKey.slice(0, dot));
  }

  for (const [rawKey, rawVal] of Object.entries(scalars)) {
    const parts = rawKey.split('.');
    if (parts.length === 1) {
      if (!nestedRoots.has(parts[0])) {
        payload[parts[0]] = rawVal;
      }
    } else {
      const root = parts[0];
      if (!stateSnapshot[root] || typeof stateSnapshot[root] !== 'object') stateSnapshot[root] = {};
      stateSnapshot[root][parts.slice(1).join('.')] = rawVal;

      if (!payload[root] || typeof payload[root] !== 'object') payload[root] = {};
      payload[root][parts.slice(1).join('.')] = rawVal;
    }
  }

  return {
    payload,
    stateSnapshot,
    externs: { ...(witness?.externs ?? {}) },
  };
}

function pow10BigInt(n) {
  return 10n ** BigInt(Math.max(0, n));
}

function parseExactDec(val, defaultScale = 0) {
  if (typeof val === 'bigint') return { raw: val * pow10BigInt(defaultScale), scale: defaultScale };
  const rawText = String(val ?? '0').trim();
  const neg = rawText.startsWith('-');
  const unsigned = neg ? rawText.slice(1) : rawText;
  const parts = unsigned.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts[1] ?? '';
  if (!/^\d+$/u.test(intPart) || (fracPart && !/^\d+$/u.test(fracPart))) return null;
  const scale = Math.max(defaultScale, fracPart.length);
  const padded = fracPart.padEnd(scale, '0');
  const combined = BigInt(intPart + padded);
  return { raw: neg ? -combined : combined, scale };
}

function formatExactDec(d, targetScale) {
  const diff = targetScale - d.scale;
  let scaledRaw = d.raw;
  if (diff > 0) scaledRaw = d.raw * pow10BigInt(diff);
  else if (diff < 0) scaledRaw = d.raw / pow10BigInt(-diff);
  if (targetScale <= 0) return scaledRaw.toString();
  const neg = scaledRaw < 0n;
  const abs = neg ? -scaledRaw : scaledRaw;
  const digits = abs.toString().padStart(targetScale + 1, '0');
  const whole = digits.slice(0, digits.length - targetScale);
  const frac = digits.slice(digits.length - targetScale);
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

function evalDecArith(expr, stateData, cmdData, aliases, stateTypes, cmdTypes) {
  if (!expr || typeof expr !== 'object') return null;
  if (expr.kind === 'number') return parseExactDec(expr.value, expr.scale ?? 0);
  if (expr.kind === 'neg') {
    const inner = evalDecArith(expr.argument, stateData, cmdData, aliases, stateTypes, cmdTypes);
    return inner ? { raw: -inner.raw, scale: inner.scale } : null;
  }
  if (expr.kind === 'arith') {
    const l = evalDecArith(expr.left, stateData, cmdData, aliases, stateTypes, cmdTypes);
    const r = evalDecArith(expr.right, stateData, cmdData, aliases, stateTypes, cmdTypes);
    if (!l || !r) return null;
    if (expr.op === '*') return { raw: l.raw * r.raw, scale: l.scale + r.scale };
    const scale = Math.max(l.scale, r.scale);
    const ar = l.raw * pow10BigInt(scale - l.scale);
    const br = r.raw * pow10BigInt(scale - r.scale);
    if (expr.op === '+') return { raw: ar + br, scale };
    if (expr.op === '-') return { raw: ar - br, scale };
    return null;
  }
  const ev = evalPostVal(expr, stateData, cmdData, aliases, stateTypes, cmdTypes);
  if (!ev.ok) return null;
  const scale = ev.type?.kind === 'decimal' ? (ev.type.scale ?? 2) : 0;
  return parseExactDec(ev.value, scale);
}

function evalPostVal(expr, stateData, cmdData, aliases, stateTypes, cmdTypes) {
  if (!expr || typeof expr !== 'object') return { ok: false };
  switch (expr.kind) {
    case 'none': return { ok: true, value: null, type: { kind: 'none' } };
    case 'boolean': return { ok: true, value: Boolean(expr.value), type: { kind: 'bool' } };
    case 'string': return { ok: true, value: String(expr.value), type: { kind: 'string' } };
    case 'number':
      return expr.scale > 0
        ? { ok: true, value: String(expr.value), type: { kind: 'decimal', scale: expr.scale } }
        : { ok: true, value: Number(expr.value), type: { kind: 'int' } };
    case 'var': {
      if (Object.hasOwn(cmdData, expr.name)) {
        return { ok: true, value: cmdData[expr.name], type: cmdTypes.get(expr.name) ?? null };
      }
      return { ok: false };
    }
    case 'member': {
      const segs = [];
      let cur = expr;
      while (cur.kind === 'member') {
        segs.unshift(cur.field);
        cur = cur.object;
      }
      if (cur.kind !== 'var') return { ok: false };
      segs.unshift(cur.name);
      if (aliases.has(segs[0]) && segs.length > 1) {
        let val = stateData[segs[1]];
        let t = stateTypes.get(segs[1]) ?? null;
        for (const f of segs.slice(2)) {
          if (val === null || val === undefined || typeof val !== 'object') return { ok: false };
          val = val[f];
          t = t?.fields?.[f] ?? null;
        }
        return { ok: true, value: val, type: t };
      }
      if (Object.hasOwn(cmdData, segs[0])) {
        let val = cmdData[segs[0]];
        let t = cmdTypes.get(segs[0]) ?? null;
        for (const f of segs.slice(1)) {
          if (val === null || val === undefined || typeof val !== 'object') return { ok: false };
          val = val[f];
          t = t?.fields?.[f] ?? null;
        }
        return { ok: true, value: val, type: t };
      }
      return { ok: false };
    }
    case 'index': {
      const col = evalPostVal(expr.collection, stateData, cmdData, aliases, stateTypes, cmdTypes);
      const key = evalPostVal(expr.index, stateData, cmdData, aliases, stateTypes, cmdTypes);
      if (!col.ok || !key.ok || !col.value || typeof col.value !== 'object') return { ok: false };
      const kStr = String(key.value);
      const valType = col.type?.kind === 'map' ? col.type.value : null;
      if (Object.hasOwn(col.value, kStr)) {
        return { ok: true, value: col.value[kStr], type: valType };
      }
      return { ok: true, value: coerceTypedValue(undefined, valType), type: valType };
    }
    case 'arith':
    case 'neg': {
      const decRes = evalDecArith(expr, stateData, cmdData, aliases, stateTypes, cmdTypes);
      if (!decRes) return { ok: false };
      return { ok: true, value: decRes, type: { kind: 'exact-dec' } };
    }
    default:
      return { ok: false };
  }
}

function finalizeEvaluatedPostValue(ev, targetType) {
  if (!ev.ok) return { ok: false };
  if (ev.value === null) {
    return targetType?.kind === 'optional' ? { ok: true, value: null } : { ok: false };
  }
  const baseType = targetType?.kind === 'optional' ? targetType.element : targetType;
  if (ev.type?.kind === 'exact-dec') {
    if (baseType?.kind === 'int') {
      const intStr = formatExactDec(ev.value, 0);
      const num = Number(intStr);
      if (!Number.isSafeInteger(num)) return { ok: false };
      return { ok: true, value: num };
    }
    if (baseType?.kind === 'decimal') {
      return { ok: true, value: formatExactDec(ev.value, baseType.scale ?? 2) };
    }
    return { ok: false };
  }
  if (baseType?.kind === 'decimal') {
    const parsed = parseExactDec(ev.value, baseType.scale ?? 2);
    if (!parsed) return { ok: false };
    return { ok: true, value: formatExactDec(parsed, baseType.scale ?? 2) };
  }
  if (baseType?.kind === 'int') {
    const num = Math.trunc(Number(ev.value));
    if (!Number.isSafeInteger(num)) return { ok: false };
    return { ok: true, value: num };
  }
  return { ok: true, value: coerceTypedValue(ev.value, targetType) };
}

/**
 * Evaluate deterministic `post:` / `transition` assignments against a materialized domain witness
 * so locked ScalaTest & TS node:test oracles assert exact post-replay state fields.
 */
export function evaluateDomainPostAssertions(agg, cmd, postAssignments, mat) {
  if (!Array.isArray(postAssignments) || postAssignments.length === 0) return [];
  const aliases = new Set(agg.aliases ?? ['state', agg.name.toLowerCase()]);
  const stateTypes = new Map(agg.stateFields.map(sf => [sf.name, sf.resolvedType]));
  const cmdTypes = new Map(cmd.parameters.map(p => [p.name, p.resolvedType]));
  const assertions = [];

  for (const assign of postAssignments) {
    const segs = assign.target?.segments ?? [];
    const pathSegs = segs.length > 1 && aliases.has(segs[0]) ? segs.slice(1) : segs;
    if (pathSegs.length === 0) continue;

    let targetType = stateTypes.get(pathSegs[0]) ?? null;
    for (const f of pathSegs.slice(1)) {
      targetType = targetType?.kind === 'record' ? targetType.fields?.[f] ?? null : null;
    }
    if (!targetType) continue;

    if (assign.target.index) {
      if (targetType.kind !== 'map') continue;
      const keyEv = evalPostVal(assign.target.index, mat.state, mat.command, aliases, stateTypes, cmdTypes);
      const valEv = evalPostVal(assign.value, mat.state, mat.command, aliases, stateTypes, cmdTypes);
      if (!keyEv.ok) continue;
      const fin = finalizeEvaluatedPostValue(valEv, targetType.value);
      if (!fin.ok) continue;
      assertions.push({
        fieldPath: pathSegs.join('.'),
        indexKey: String(keyEv.value),
        targetType: targetType.value,
        expectedValue: fin.value,
      });
    } else {
      const valEv = evalPostVal(assign.value, mat.state, mat.command, aliases, stateTypes, cmdTypes);
      const fin = finalizeEvaluatedPostValue(valEv, targetType);
      if (!fin.ok) continue;
      assertions.push({
        fieldPath: pathSegs.join('.'),
        indexKey: null,
        targetType,
        expectedValue: fin.value,
      });
    }
  }

  return assertions;
}
