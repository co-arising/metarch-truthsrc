// Deterministic HTTP route derivation from Canonical Model v2 application stories & ports.
// Shared across TypeScript interfaces, Scala interfaces, Play conf/routes, and HTTP oracle tests.

export function toSlug(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

export function toCamel(name) {
  if (!name) return '';
  return name[0].toLowerCase() + name.slice(1);
}

export function toPascal(name) {
  return String(name ?? '')
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('');
}

export function inferHttpMethod(portName, opName) {
  const lowerOp = String(opName ?? '').toLowerCase();
  const lowerPort = String(portName ?? '').toLowerCase();
  if (/^(?:get|list|find|query|read|fetch|describe|lookup|check)/u.test(lowerOp) || lowerPort.endsWith('query')) {
    return 'GET';
  }
  return 'POST';
}

const NON_HTTP_CALLER_KINDS = new Set(['system', 'scheduler']);

export function deriveStoryHttpRoutes(canonicalV2) {
  const ctxSlug = toSlug(canonicalV2.context || 'core');
  const routes = [];
  const seen = new Map();

  const portOpMap = new Map();
  for (const port of canonicalV2.structures?.ports ?? []) {
    for (const op of port.operations ?? []) {
      portOpMap.set(`${port.name}.${op.name}`, op);
    }
  }
  const readModelMap = new Map((canonicalV2.structures?.readModels ?? []).map(rm => [rm.name, rm]));

  for (const beh of canonicalV2.behaviors ?? []) {
    if (beh.layer !== 'application') continue;
    const storyName = beh.target;
    const storySlug = toSlug(storyName);
    const storyPascal = toPascal(storyName);
    const ops = [];
    let hasEventTrigger = false;
    for (const rule of beh.rules ?? []) {
      if (rule.triggerKind === 'event') {
        hasEventTrigger = true;
        continue;
      }
      const op = rule.command || rule.when;
      if (op && !ops.includes(op)) ops.push(op);
    }
    if (ops.length === 0) {
      // Pure event-choreography integration stories do not expose public HTTP routes
      if (hasEventTrigger) continue;
      ops.push(`${storyPascal}Port.execute`);
    }

    for (const operation of ops) {
      const opDef = portOpMap.get(operation) ?? null;
      const callerKind = opDef?.callerKind ?? null;
      const authz = opDef?.authz ?? null;

      // Internal-only / system / scheduler operations are never exposed as public HTTP routes
      if (authz?.mode === 'internal-only' || (callerKind && NON_HTTP_CALLER_KINDS.has(callerKind))) {
        continue;
      }

      const dotIdx = operation.indexOf('.');
      const portName = dotIdx >= 0 ? operation.slice(0, dotIdx) : `${storyPascal}Port`;
      const opName = dotIdx >= 0 ? operation.slice(dotIdx + 1) : operation;
      const method = inferHttpMethod(portName, opName);
      let path = `/api/v1/${ctxSlug}/${toSlug(portName)}/${toSlug(opName)}`;
      let key = `${method} ${path}`;
      if (seen.has(key)) {
        if (seen.get(key) === operation) continue;
        let suffix = 2;
        while (seen.has(`${method} ${path}-${suffix}`)) suffix += 1;
        path = `${path}-${suffix}`;
        key = `${method} ${path}`;
      }
      seen.set(key, operation);

      const returnedRm = opDef?.returns ? readModelMap.get(opDef.returns) ?? null : null;
      const rowScope = returnedRm?.rowScopeSpec ?? null;

      const queryParamTypes = {};
      for (const p of opDef?.parameters ?? []) {
        const base = p?.resolvedType?.kind === 'optional' ? p.resolvedType.element : p?.resolvedType;
        if (base?.kind === 'int' || base?.kind === 'bool' || base?.kind === 'decimal') {
          queryParamTypes[p.name] = base.kind;
        }
      }

      routes.push({
        storyName,
        storySlug,
        storyPascal,
        operation,
        portName,
        opName,
        method,
        path,
        callerKind: callerKind ?? (authz?.mode === 'public' ? 'anonymous' : 'human'),
        ...(Object.keys(queryParamTypes).length > 0 ? { queryParamTypes } : {}),
        ...(rowScope ? { rowScope } : {}),
        authz: authz
          ? {
              mode: authz.mode,
              action: authz.action,
              scope: authz.scope ?? null,
              allowedRoles: authz.allowedRoles ?? [],
              policyRef: authz.policyRef ?? null,
              contextParams: authz.contextParams ?? [],
              ...(authz.resource ? { resource: authz.resource } : {}),
              ...(authz.bindPrincipal?.length ? { bindPrincipal: authz.bindPrincipal } : {}),
              ...(authz.requiresEntitlement?.length ? { requiresEntitlement: authz.requiresEntitlement } : {}),
            }
          : null,
      });
    }
  }
  return routes;
}
