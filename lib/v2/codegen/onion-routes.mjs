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

export function deriveStoryHttpRoutes(canonicalV2) {
  const ctxSlug = toSlug(canonicalV2.context || 'core');
  const routes = [];
  const seen = new Set();

  for (const beh of canonicalV2.behaviors ?? []) {
    if (beh.layer !== 'application') continue;
    const storyName = beh.target;
    const storySlug = toSlug(storyName);
    const storyPascal = toPascal(storyName);
    const ops = [];
    for (const rule of beh.rules ?? []) {
      const op = rule.command || rule.when;
      if (op && !ops.includes(op)) ops.push(op);
    }
    if (ops.length === 0) ops.push(`${storyPascal}Port.execute`);

    for (const operation of ops) {
      const dotIdx = operation.indexOf('.');
      const portName = dotIdx >= 0 ? operation.slice(0, dotIdx) : `${storyPascal}Port`;
      const opName = dotIdx >= 0 ? operation.slice(dotIdx + 1) : operation;
      const method = inferHttpMethod(portName, opName);
      const path = `/api/v1/${ctxSlug}/${toSlug(portName)}/${toSlug(opName)}`;
      const key = `${method} ${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      routes.push({
        storyName,
        storySlug,
        storyPascal,
        operation,
        portName,
        opName,
        method,
        path,
      });
    }
  }
  return routes;
}
