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

function readWitnessPath(scalars, pathCandidates, resolvedType) {
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
      for (const sc of subCandidates) {
        if (Object.hasOwn(scalars, sc)) anyFound = true;
      }
      obj[fName] = readWitnessPath(scalars, subCandidates, fType);
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
  const scalars = witness?.scalars ?? {};
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
