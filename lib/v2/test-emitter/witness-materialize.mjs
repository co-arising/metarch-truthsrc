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
      if (raw === null || raw === undefined) return resolvedType.units?.[0] ?? '';
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

function synthValidValue(resolvedType, fieldName = '', idx = 0) {
  if (!resolvedType || typeof resolvedType !== 'object') return `sample_${fieldName || `v_${idx + 1}`}`;
  switch (resolvedType.kind) {
    case 'int':
      return /at$|time$|timestamp$/iu.test(fieldName) ? 1700000000000 : (idx + 1);
    case 'decimal':
      return padDecimal(10 + idx, resolvedType.scale ?? 2);
    case 'bool':
      return true;
    case 'string':
      return resolvedType.enumValues?.[0] ?? resolvedType.units?.[0] ?? `sample_${fieldName || `v_${idx + 1}`}`;
    case 'optional':
      return null;
    case 'sequence':
      return [synthSequenceElement(resolvedType.element, 0)];
    case 'map':
      return {};
    case 'record': {
      const obj = {};
      for (const [fName, fType] of Object.entries(resolvedType.fields ?? {})) {
        obj[fName] = synthValidValue(fType, fName, idx);
      }
      return obj;
    }
    default:
      return `sample_${fieldName || `v_${idx + 1}`}`;
  }
}

function synthSequenceElement(elementType, idx) {
  if (!elementType || typeof elementType !== 'object') return `item_${idx + 1}`;
  switch (elementType.kind) {
    case 'int':
      return idx + 1;
    case 'decimal':
      return padDecimal(idx + 1, elementType.scale ?? 2);
    case 'bool':
      return true;
    case 'string':
      return elementType.enumValues?.[0] ?? elementType.units?.[0] ?? `item_${idx + 1}`;
    case 'optional':
      return synthSequenceElement(elementType.element, idx);
    case 'record': {
      const obj = {};
      for (const [fName, fType] of Object.entries(elementType.fields ?? {})) {
        obj[fName] = synthValidValue(fType, fName, idx);
      }
      return obj;
    }
    default:
      return `item_${idx + 1}`;
  }
}

function readWitnessPath(scalars, pathCandidates, resolvedType) {
  if (resolvedType?.kind === 'sequence') {
    for (const key of pathCandidates) {
      if (Array.isArray(scalars[key]) && scalars[key].length > 0) {
        return coerceTypedValue(scalars[key], resolvedType);
      }
    }
    // Collect active quantifier witnesses (every active exists=true or forall=false gets its own element)
    // plus any default positive sample element (@qdef(col)) for non-empty sequences.
    const activeElements = [];
    let fallbackQuantElement;
    for (const [sk, sv] of Object.entries(scalars)) {
      const qm = sk.match(/^@quant\((forall|exists):([^:]+):(.+)\)$/u);
      if (!qm) continue;
      const [, qKind, qVar, qCol] = qm;
      if (!pathCandidates.includes(qCol)) continue;
      const solvedEl = readWitnessPath(scalars, [qVar], resolvedType.element);
      const isActive = (qKind === 'forall' && sv === false) || (qKind === 'exists' && sv === true);
      if (isActive) {
        activeElements.push(solvedEl !== undefined ? solvedEl : synthSequenceElement(resolvedType.element, activeElements.length));
      } else if (solvedEl !== undefined && fallbackQuantElement === undefined) {
        fallbackQuantElement = solvedEl;
      }
    }
    const defaultElem = readWitnessPath(scalars, pathCandidates.map(c => `@qdef(${c})`), resolvedType.element)
      ?? fallbackQuantElement;

    let targetCount = null;
    for (const key of pathCandidates) {
      for (const fnName of ['len', 'count']) {
        const aggKey = `@agg(${fnName}:${key})`;
        if (Object.hasOwn(scalars, aggKey) && scalars[aggKey] !== null && scalars[aggKey] !== undefined) {
          const n = Number(scalars[aggKey]);
          if (Number.isFinite(n)) {
            targetCount = Math.min(Math.max(0, Math.trunc(n)), 200);
            break;
          }
        }
      }
      if (targetCount !== null) break;
    }

    let targetSum = null;
    for (const key of pathCandidates) {
      const sumKey = `@agg(sum:${key})`;
      if (Object.hasOwn(scalars, sumKey) && scalars[sumKey] !== null && scalars[sumKey] !== undefined) {
        targetSum = scalars[sumKey];
        break;
      }
    }

    if (targetCount === 0) return [];

    // Materialize exact elements summing to targetSum for numeric sequences (Int / Decimal)
    const elKind = resolvedType.element?.kind;
    if (targetSum !== null && (elKind === 'int' || elKind === 'decimal')) {
      const scale = elKind === 'decimal' ? (resolvedType.element.scale ?? 2) : 0;
      const rescaleRaw = d => {
        if (d.scale === scale) return d.raw;
        if (d.scale < scale) return d.raw * pow10BigInt(scale - d.scale);
        return d.raw / pow10BigInt(d.scale - scale);
      };
      const goalDec = parseExactDec(targetSum, scale);
      if (goalDec) {
        const goalRaw = rescaleRaw(goalDec);
        const toRaw = v => {
          const d = parseExactDec(v, scale);
          return d ? rescaleRaw(d) : 0n;
        };
        const fromRaw = r => (elKind === 'int' ? Number(r) : formatExactDec({ raw: r, scale }, scale));
        const activeSumRaw = activeElements.reduce((acc, el) => acc + toRaw(el), 0n);

        let count;
        if (targetCount !== null) {
          count = Math.max(activeElements.length, targetCount);
        } else if (activeElements.length > 0) {
          count = activeSumRaw === goalRaw ? activeElements.length : activeElements.length + 1;
        } else {
          count = goalRaw === 0n ? 0 : 1;
        }
        if (count === 0) return [];
        const result = activeElements.slice(0, count);
        const freeCount = count - result.length;
        if (freeCount > 0) {
          const usedRaw = result.reduce((acc, el) => acc + toRaw(el), 0n);
          const remRaw = goalRaw - usedRaw;
          const denom = BigInt(freeCount);
          const base = remRaw / denom;
          const mod = remRaw - base * denom;
          const step = mod >= 0n ? 1n : -1n;
          const extraCount = Number(mod >= 0n ? mod : -mod);
          for (let i = 0; i < freeCount; i += 1) {
            result.push(fromRaw(base + (i < extraCount ? step : 0n)));
          }
        }
        return result;
      }
    }

    const mkDefault = idx => {
      if (defaultElem !== undefined) return defaultElem;
      if (activeElements[0] !== undefined) return activeElements[0];
      return synthSequenceElement(resolvedType.element, idx);
    };

    if (targetCount !== null) {
      const count = Math.max(targetCount, activeElements.length);
      const out = activeElements.slice(0, count);
      while (out.length < count) out.push(mkDefault(out.length));
      return out;
    }
    if (activeElements.length > 0) {
      if (defaultElem !== undefined) {
        const defSig = JSON.stringify(defaultElem);
        if (!activeElements.some(el => JSON.stringify(el) === defSig)) {
          return [...activeElements, defaultElem];
        }
      }
      return activeElements;
    }
    if (defaultElem !== undefined) return [defaultElem];
    return [];
  }
  if (resolvedType?.kind === 'optional') {
    for (const key of pathCandidates) {
      const presKey = `${key}.__present`;
      if (Object.hasOwn(scalars, presKey)) {
        if (!scalars[presKey]) return null;
        const inner = readWitnessPath(scalars, [key], resolvedType.element);
        return inner !== undefined ? inner : coerceTypedValue(undefined, resolvedType.element);
      }
    }
    // E2-09 fix: when Optional[Record] has no __present flag but child subfield scalars exist,
    // materialize the inner record instead of falling through to a phantom bare-path scalar (0).
    if (resolvedType.element?.kind === 'record') {
      const inner = readWitnessPath(scalars, pathCandidates, resolvedType.element);
      if (inner !== undefined) return inner;
    }
  }
  if (resolvedType?.kind === 'record') {
    for (const key of pathCandidates) {
      if (Object.hasOwn(scalars, key) && scalars[key] && typeof scalars[key] === 'object' && !Array.isArray(scalars[key])) {
        return coerceTypedValue(scalars[key], resolvedType);
      }
    }
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
  for (const key of pathCandidates) {
    if (Object.hasOwn(scalars, key)) {
      return coerceTypedValue(scalars[key], resolvedType);
    }
  }
  return undefined;
}

function resolveMapKeyName(keyPath, cmdData, scalars) {
  if (Object.hasOwn(cmdData, keyPath)) return String(cmdData[keyPath]);
  if (Object.hasOwn(scalars, keyPath)) return String(scalars[keyPath]);
  return keyPath;
}

function hydrateMapObject(entries, valueType, cmdData, scalars) {
  const out = {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return out;
  for (const [keyPath, rawMapVal] of Object.entries(entries)) {
    const resolvedKey = resolveMapKeyName(keyPath, cmdData, scalars);
    if (valueType?.kind === 'map') {
      out[resolvedKey] = hydrateMapObject(rawMapVal, valueType.value, cmdData, scalars);
    } else {
      out[resolvedKey] = coerceTypedValue(rawMapVal, valueType);
    }
  }
  return out;
}

function buildMaterializedMap(candidates, mapEntries, valueType, cmdData, scalars) {
  const builtMap = {};
  for (const cand of candidates) {
    const entries = mapEntries[cand];
    if (!entries) continue;
    const hydrated = hydrateMapObject(entries, valueType, cmdData, scalars);
    for (const [k, v] of Object.entries(hydrated)) {
      builtMap[k] = v;
    }
  }
  return builtMap;
}

export function materializeDomainWitness(agg, cmd, witness) {
  const scalars = witness?.scalars ?? {};
  const mapEntries = witness?.mapEntries ?? {};
  const aliases = [...new Set(['state', ...(agg.aliases ?? []), agg.name.toLowerCase()])];

  // Materialize scalar command parameters first so map keys referencing command params resolve cleanly
  const cmdData = { type: cmd.name };
  for (const p of cmd.parameters) {
    if (p.resolvedType?.kind === 'map') continue;
    const val = readWitnessPath(scalars, [p.name], p.resolvedType);
    cmdData[p.name] = val !== undefined ? val : coerceTypedValue(p.defaultValue, p.resolvedType);
  }
  for (const p of cmd.parameters) {
    if (p.resolvedType?.kind !== 'map') continue;
    cmdData[p.name] = buildMaterializedMap([p.name], mapEntries, p.resolvedType.value, cmdData, scalars);
  }

  // Materialize aggregate state fields
  const stateData = {};
  for (const sf of agg.stateFields) {
    const candidates = aliases.map(a => `${a}.${sf.name}`);
    if (sf.resolvedType?.kind === 'map') {
      stateData[sf.name] = buildMaterializedMap(candidates, mapEntries, sf.resolvedType.value, cmdData, scalars);
      continue;
    }

    const val = readWitnessPath(scalars, candidates, sf.resolvedType);
    stateData[sf.name] = val !== undefined ? val : coerceTypedValue(sf.defaultValue, sf.resolvedType);
  }

  return { state: stateData, command: cmdData };
}

function matchesTypeKind(val, resolvedType) {
  if (!resolvedType || typeof resolvedType !== 'object') return val !== undefined && val !== null;
  switch (resolvedType.kind) {
    case 'int':
      return typeof val === 'number' && Number.isFinite(val);
    case 'decimal':
      return (typeof val === 'string' && /^-?\d+(?:\.\d+)?$/u.test(val.trim()))
        || (typeof val === 'number' && Number.isFinite(val));
    case 'bool':
      return typeof val === 'boolean';
    case 'string':
      return typeof val === 'string';
    case 'optional':
      return val === null || val === undefined || matchesTypeKind(val, resolvedType.element);
    case 'sequence':
      return Array.isArray(val);
    case 'map':
    case 'record':
      return Boolean(val && typeof val === 'object' && !Array.isArray(val));
    default:
      return val !== undefined;
  }
}

function fillTypedValue(existingVal, resolvedType, fieldName, scalars, { allowEmptySeq = false } = {}) {
  if (resolvedType?.kind === 'sequence') {
    if (Array.isArray(existingVal)) {
      if (existingVal.length === 0 && allowEmptySeq) return [];
      if (existingVal.length > 0) {
        return existingVal.map((el, idx) => {
          if (resolvedType.element?.kind === 'record') {
            return fillTypedValue(el, resolvedType.element, fieldName, {});
          }
          return matchesTypeKind(el, resolvedType.element) ? el : synthSequenceElement(resolvedType.element, idx);
        });
      }
    }
    const fromWitness = readWitnessPath(scalars, [fieldName], resolvedType);
    if (Array.isArray(fromWitness)) {
      if (fromWitness.length > 0) return fromWitness;
      if (allowEmptySeq) return [];
    }
    return [synthSequenceElement(resolvedType.element, 0)];
  }
  if (resolvedType?.kind === 'record') {
    const base = existingVal && typeof existingVal === 'object' && !Array.isArray(existingVal)
      ? { ...existingVal }
      : {};
    for (const [fName, fType] of Object.entries(resolvedType.fields ?? {})) {
      if (fType?.kind === 'optional') {
        if (!Object.hasOwn(base, fName)) base[fName] = null;
        continue;
      }
      if (base[fName] === undefined || !matchesTypeKind(base[fName], fType)) {
        base[fName] = fillTypedValue(base[fName], fType, fName, {}, { allowEmptySeq });
      }
    }
    return base;
  }
  if (existingVal !== undefined && matchesTypeKind(existingVal, resolvedType)) {
    return existingVal;
  }
  return synthValidValue(resolvedType, fieldName);
}

export function materializeApplicationWitness(witness, ctx = {}) {
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

  const { canonicalV2 = null, behavior = null, command = null, example = null, route = null } = ctx;

  // Locate port operation & story struct for parameter typing, authz, principal bindings, and caller exclusions
  let portOp = null;
  if (canonicalV2 && command) {
    for (const port of canonicalV2.structures?.ports ?? []) {
      for (const op of port.operations ?? []) {
        if (`${port.name}.${op.name}` === command) {
          portOp = op;
          break;
        }
      }
      if (portOp) break;
    }
  }
  const storyStruct = canonicalV2 && behavior
    ? (canonicalV2.structures?.stories ?? []).find(s => s.name === behavior.target) ?? null
    : null;
  const authz = route?.authz ?? portOp?.authz ?? null;
  const isRejected = Boolean((example?.actions ?? []).some(a => a.kind === 'reject' && a.modality === 'SHALL'));

  const forbiddenFields = new Set();
  for (const ax of behavior?.axioms ?? []) {
    for (const act of ax.actions ?? []) {
      if (act.kind === 'supply' && act.modality === 'SHALL_NOT') {
        for (const f of act.fields ?? []) forbiddenFields.add(f);
      }
    }
  }
  for (const f of storyStruct?.callerContract?.forbiddenUntrustedFields ?? []) {
    forbiddenFields.add(f);
  }

  const bindPrincipal = authz?.bindPrincipal ?? [];
  const bindParamMap = new Map(bindPrincipal.map(b => [b.param, b.from]));

  let principal = null;
  const resolvePrincipalVal = (from) => {
    if (!principal) return 'principal-1';
    if (from === 'id' || from === 'principal.id') return principal.id;
    if (from === 'tenantId' || from === 'principal.tenantId') return principal.tenantId ?? 'tenant-1';
    if (from === 'roles' || from === 'principal.roles') return principal.roles;
    if (from.startsWith('principal.attributes.')) {
      return principal.attributes?.[from.slice('principal.attributes.'.length)] ?? principal.id;
    }
    if (from.startsWith('attributes.')) {
      return principal.attributes?.[from.slice('attributes.'.length)] ?? principal.id;
    }
    return principal.attributes?.[from] ?? principal.id;
  };

  if (authz && authz.mode !== 'public') {
    const allowedRole = (authz.allowedRoles ?? [])[0] ?? 'member';
    const principalId = (typeof payload.principal === 'string' && payload.principal.trim())
      ? payload.principal
      : 'principal-1';
    const attributes = {};
    for (const bp of bindPrincipal) {
      if (bp.from.startsWith('principal.attributes.')) {
        attributes[bp.from.slice('principal.attributes.'.length)] = principalId;
      } else if (bp.from.startsWith('attributes.')) {
        attributes[bp.from.slice('attributes.'.length)] = principalId;
      } else if (!['id', 'principal.id', 'tenantId', 'principal.tenantId', 'roles', 'principal.roles'].includes(bp.from)) {
        attributes[bp.from] = principalId;
      }
    }
    const ownerPKey = authz.resource?.ownerPrincipalKey;
    if (ownerPKey && !['id', 'tenantId'].includes(ownerPKey)) {
      attributes[ownerPKey] = principalId;
    }
    for (const cp of authz.contextParams ?? []) {
      if (cp.from?.startsWith('token.') && cp.from !== 'token.tenantId') {
        attributes[cp.from.slice('token.'.length)] = 'sample-scope';
      }
    }
    const entitlements = (authz.requiresEntitlement ?? []).map(
      ent => (ent.matchParam ? `${ent.code}:sample-scope` : ent.code),
    );
    principal = {
      id: principalId,
      roles: [allowedRole],
      tenantId: 'tenant-1',
      attributes,
      entitlements,
    };
  }

  // Coerce & fill declared client port parameters cleanly (never clobbering valid Z3 rejection witnesses)
  const portParamMap = new Map();
  for (const p of portOp?.parameters ?? []) {
    portParamMap.set(p.name, p);
    if (p.resolvedType?.kind === 'optional') continue;
    if (
      payload[p.name] === undefined
      || !matchesTypeKind(payload[p.name], p.resolvedType)
      || p.resolvedType?.kind === 'record'
      || p.resolvedType?.kind === 'sequence'
    ) {
      payload[p.name] = fillTypedValue(payload[p.name], p.resolvedType, p.name, scalars, { allowEmptySeq: isRejected });
    }
  }

  // Apply bindPrincipal into handler payload (while keeping clientPayload free of bound/server/forbidden fields)
  for (const [param, from] of bindParamMap) {
    payload[param] = resolvePrincipalVal(from);
  }
  const clientPayload = { ...payload };
  delete clientPayload.stateSnapshot;
  for (const f of forbiddenFields) {
    delete clientPayload[f];
    delete payload[f];
  }
  for (const param of bindParamMap.keys()) {
    delete clientPayload[param];
  }

  // Materialize server-trusted aggregate/snapshot parameters required by dispatched commands
  const expectedDispatches = [];
  if (!isRejected && canonicalV2) {
    const aggMap = new Map((canonicalV2.structures?.aggregates ?? []).map(a => [a.name, a]));
    const mustDispatches = (example?.actions ?? []).filter(a => a.kind === 'dispatch' && a.modality === 'SHALL');
    for (const act of mustDispatches) {
      const target = String(act.target ?? '');
      const dot = target.indexOf('.');
      const aggName = dot >= 0 ? target.slice(0, dot) : '';
      const cmdName = dot >= 0 ? target.slice(dot + 1) : target;
      const agg = aggMap.get(aggName);
      const cmdDef = agg?.commands?.find(c => c.name === cmdName) ?? null;
      const requiredFields = [];

      if (cmdDef) {
        const aggKey = aggName ? `${aggName[0].toLowerCase()}${aggName.slice(1)}` : 'aggregate';
        for (const cp of cmdDef.parameters ?? []) {
          if (cp.resolvedType?.kind === 'optional') continue;
          if (bindParamMap.has(cp.name)) {
            const val = resolvePrincipalVal(bindParamMap.get(cp.name));
            payload[cp.name] = val;
            stateSnapshot[cp.name] = val;
            requiredFields.push({ name: cp.name, value: val, source: 'principal', type: cp.resolvedType });
          } else if (portParamMap.has(cp.name) && !forbiddenFields.has(cp.name)) {
            const val = fillTypedValue(payload[cp.name], cp.resolvedType, cp.name, scalars);
            payload[cp.name] = val;
            clientPayload[cp.name] = val;
            requiredFields.push({ name: cp.name, value: val, source: 'payload', type: cp.resolvedType });
          } else {
            // Server-trusted field: omitted from client parameters or prohibited via callerMustNotSupply
            const existingSnap = stateSnapshot[cp.name] ?? stateSnapshot[aggKey]?.[cp.name];
            const val = fillTypedValue(existingSnap, cp.resolvedType, cp.name, scalars);
            stateSnapshot[cp.name] = val;
            if (!stateSnapshot[aggKey] || typeof stateSnapshot[aggKey] !== 'object') stateSnapshot[aggKey] = {};
            stateSnapshot[aggKey][cp.name] = val;
            delete clientPayload[cp.name];
            requiredFields.push({ name: cp.name, value: val, source: 'stateSnapshot', type: cp.resolvedType });
          }
        }
      }
      expectedDispatches.push({ target, requiredFields });
    }
  }

  if (authz?.resource?.ownerField && stateSnapshot[authz.resource.ownerField] === undefined) {
    stateSnapshot[authz.resource.ownerField] = principal?.id ?? 'principal-1';
  }

  return {
    payload,
    clientPayload,
    stateSnapshot,
    principal,
    externs: { ...(witness?.externs ?? {}) },
    expectedDispatches,
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
      if (cur.kind === 'index') {
        const base = evalPostVal(cur, stateData, cmdData, aliases, stateTypes, cmdTypes);
        if (!base.ok) return { ok: false };
        let val = base.value;
        let t = base.type;
        for (const f of segs) {
          if (val === null || val === undefined || typeof val !== 'object') return { ok: false };
          val = val[f];
          t = t?.fields?.[f] ?? null;
        }
        return { ok: true, value: val, type: t };
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
  const aliases = new Set(['state', ...(agg.aliases ?? []), agg.name.toLowerCase()]);
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
