// Locked executable interfaces/ HTTP integration oracle emitter for Canonical Model v2.
// Generates live HTTP server + Controller + Router tests for both TypeScript (node:http + fetch)
// and Scala (BootstrapModule + HttpRouter + Controller via ScalaTest).
import { createHash } from 'node:crypto';
import { materializeApplicationWitness } from './witness-materialize.mjs';
import { deriveStoryHttpRoutes, toCamel, toPascal, toSlug } from '../codegen/onion-routes.mjs';

function mapRejectionStatus(code) {
  const upper = String(code ?? '').toUpperCase();
  if (upper.includes('UNAUTHORIZED') || upper.includes('CSRF') || upper.includes('AUTH')) return 401;
  if (upper.includes('FORBIDDEN')) return 403;
  if (upper.includes('CONFLICT') || upper.includes('ALREADY')) return 409;
  if (upper.includes('NOT_FOUND') || upper.includes('UNKNOWN')) return 404;
  return 400;
}

function scalaAnyLiteral(v) {
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return `${v}L`;
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `Seq(${v.map(scalaAnyLiteral).join(', ')})`;
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(([k, val]) => `${JSON.stringify(k)} -> ${scalaAnyLiteral(val)}`);
    return `Map[String, Any](${entries.join(', ')})`;
  }
  return JSON.stringify(String(v));
}

function pickRepresentativeCases(behavior, routes) {
  const storyRoutes = routes.filter(r => r.storyName === behavior.target);
  const routeByOp = new Map(storyRoutes.map(r => [r.operation, r]));
  const picked = [];
  let hasAccept = false;
  let hasReject = false;

  for (const sc of behavior.testIr?.scenarios ?? []) {
    if (sc.kind === 'bmc') continue;
    const route = routeByOp.get(sc.command);
    if (!route) continue;
    for (const ex of sc.examples ?? []) {
      const rejectAct = (ex.actions ?? []).find(a => a.kind === 'reject' && a.modality === 'SHALL');
      if (rejectAct && !hasReject) {
        picked.push({ route, ex, rejectAct });
        hasReject = true;
      } else if (!rejectAct && !hasAccept) {
        picked.push({ route, ex, rejectAct: null });
        hasAccept = true;
      }
      if (hasAccept && hasReject) break;
    }
    if (hasAccept && hasReject) break;
  }
  return picked;
}

function toUpperSnake(name) {
  return toSlug(name).replaceAll('-', '_').toUpperCase();
}

function emitTsAuthzMatrixTests(canonicalV2, routes, lines) {
  if (canonicalV2.testing?.layers?.interfaces?.verifyAuthzMatrix === false) return;
  const authzRoutes = routes.filter(r => r.authz);
  if (authzRoutes.length === 0) return;

  for (const r of authzRoutes) {
    const prefix = `AUTHZ_${toUpperSnake(r.portName)}_${toUpperSnake(r.opName)}`;
    const mode = r.authz.mode;
    const reqInit = r.method === 'POST'
      ? '{ method: "POST", headers: { "content-type": "application/json" }, body: "{}" }'
      : `{ method: ${JSON.stringify(r.method)} }`;

    if (mode === 'public') {
      lines.push(`// @CoArisingSpec(id="${prefix}_PUBLIC", witness="http-authz-public")`);
      lines.push(`test(${JSON.stringify(`[${prefix}_PUBLIC] ${r.method} ${r.path} public route bypasses auth`)}, async () => {`);
      lines.push('  const auth = createRoleBasedAuthority(() => null);');
      lines.push('  await withBareRouter(async baseUrl => {');
      lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
      lines.push('    assert.notEqual(res.status, 401);');
      lines.push('    assert.notEqual(res.status, 403);');
      lines.push('  }, auth);');
      lines.push('});');
      lines.push('');
      continue;
    }

    // 401 Unauthenticated
    lines.push(`// @CoArisingSpec(id="${prefix}_401", witness="http-authz-401")`);
    lines.push(`test(${JSON.stringify(`[${prefix}_401] ${r.method} ${r.path} unauthenticated -> 401`)}, async () => {`);
    lines.push('  const auth = createRoleBasedAuthority(() => null);');
    lines.push('  await withBareRouter(async baseUrl => {');
    lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
    lines.push('    assert.equal(res.status, 401);');
    lines.push('    const json = await res.json() as Record<string, unknown>;');
    lines.push('    assert.equal(json.code, "NOT_AUTHENTICATED");');
    lines.push('  }, auth);');
    lines.push('});');
    lines.push('');

    if (mode === 'external-pdp') {
      const expectedAction = r.authz.action ?? r.operation;
      const expectedPolicy = r.authz.policyRef ?? null;
      lines.push(`// @CoArisingSpec(id="${prefix}_403_PDP_DENY", witness="http-authz-pdp-deny")`);
      lines.push(`test(${JSON.stringify(`[${prefix}_403_PDP_DENY] ${r.method} ${r.path} external PDP deny -> 403`)}, async () => {`);
      lines.push('  const auth = createRoleBasedAuthority(() => ({ id: "pdp-user", roles: ["member"], tenantId: "t-1" }), { decide: () => false });');
      lines.push('  await withBareRouter(async baseUrl => {');
      lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
      lines.push('    assert.equal(res.status, 403);');
      lines.push('    const json = await res.json() as Record<string, unknown>;');
      lines.push('    assert.equal(json.code, "NOT_AUTHORIZED");');
      lines.push('  }, auth);');
      lines.push('});');
      lines.push('');

      lines.push(`// @CoArisingSpec(id="${prefix}_ALLOW_PDP", witness="http-authz-pdp-allow")`);
      lines.push(`test(${JSON.stringify(`[${prefix}_ALLOW_PDP] ${r.method} ${r.path} external PDP allow passes PEP`)}, async () => {`);
      lines.push('  let seenAction = "";');
      lines.push('  let seenPolicy: string | undefined;');
      lines.push('  const auth = createRoleBasedAuthority(');
      lines.push('    () => ({ id: "pdp-user", roles: ["member"], tenantId: "t-1" }),');
      lines.push('    { decide: q => { seenAction = q.action; seenPolicy = q.policyRef; return true; } },');
      lines.push('  );');
      lines.push('  await withBareRouter(async baseUrl => {');
      lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
      lines.push('    assert.notEqual(res.status, 401);');
      lines.push('    assert.notEqual(res.status, 403);');
      lines.push(`    assert.equal(seenAction, ${JSON.stringify(expectedAction)});`);
      if (expectedPolicy) {
        lines.push(`    assert.equal(seenPolicy, ${JSON.stringify(expectedPolicy)});`);
      }
      lines.push('  }, auth);');
      lines.push('});');
      lines.push('');
    } else if ((r.authz.allowedRoles ?? []).length > 0) {
      const allowedRole = r.authz.allowedRoles[0];
      lines.push(`// @CoArisingSpec(id="${prefix}_403_ROLE", witness="http-authz-403-role")`);
      lines.push(`test(${JSON.stringify(`[${prefix}_403_ROLE] ${r.method} ${r.path} forbidden role -> 403`)}, async () => {`);
      lines.push('  const auth = createRoleBasedAuthority(() => ({ id: "denied-user", roles: ["__forbidden_role__"] }));');
      lines.push('  await withBareRouter(async baseUrl => {');
      lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
      lines.push('    assert.equal(res.status, 403);');
      lines.push('    const json = await res.json() as Record<string, unknown>;');
      lines.push('    assert.equal(json.code, "NOT_AUTHORIZED");');
      lines.push('  }, auth);');
      lines.push('});');
      lines.push('');

      lines.push(`// @CoArisingSpec(id="${prefix}_ALLOW_ROLE", witness="http-authz-allow-role")`);
      lines.push(`test(${JSON.stringify(`[${prefix}_ALLOW_ROLE] ${r.method} ${r.path} allowed role ${allowedRole} passes PEP`)}, async () => {`);
      lines.push(`  const auth = createRoleBasedAuthority(() => ({ id: "ok-user", roles: [${JSON.stringify(allowedRole)}] }));`);
      lines.push('  await withBareRouter(async baseUrl => {');
      lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
      lines.push('    assert.notEqual(res.status, 401);');
      lines.push('    assert.notEqual(res.status, 403);');
      lines.push('  }, auth);');
      lines.push('});');
      lines.push('');
    }

    if (r.method === 'POST') {
      const csrfRole = (r.authz.allowedRoles ?? [])[0] ?? '*';
      const pdpArg = mode === 'external-pdp' ? '{ decide: () => true }' : 'undefined';
      lines.push(`// @CoArisingSpec(id="${prefix}_403_CSRF", witness="http-authz-csrf")`);
      lines.push(`test(${JSON.stringify(`[${prefix}_403_CSRF] POST ${r.path} invalid CSRF -> 403 CSRF_INVALID`)}, async () => {`);
      lines.push(`  const auth = createRoleBasedAuthority(() => ({ id: "csrf-user", roles: [${JSON.stringify(csrfRole)}] }), ${pdpArg}, () => false);`);
      lines.push('  await withBareRouter(async baseUrl => {');
      lines.push(`    const res = await fetch(\`\${baseUrl}${r.path}\`, ${reqInit});`);
      lines.push('    assert.equal(res.status, 403);');
      lines.push('    const json = await res.json() as Record<string, unknown>;');
      lines.push('    assert.equal(json.code, "CSRF_INVALID");');
      lines.push('  }, auth);');
      lines.push('});');
      lines.push('');
    }
  }
}

function emitScalaAuthzMatrixTests(canonicalV2, routes, packageName, lines) {
  if (canonicalV2.testing?.layers?.interfaces?.verifyAuthzMatrix === false) return;
  const authzRoutes = routes.filter(r => r.authz);
  if (authzRoutes.length === 0) return;

  for (const r of authzRoutes) {
    const prefix = `AUTHZ_${toUpperSnake(r.portName)}_${toUpperSnake(r.opName)}`;
    const mode = r.authz.mode;
    const reqExpr = `HttpRequest(${JSON.stringify(r.method)}, ${JSON.stringify(r.path)})`;

    if (mode === 'public') {
      lines.push(
        `  // @CoArisingSpec(id="${prefix}_PUBLIC", witness="http-authz-public")`,
        `  test(${JSON.stringify(`[${prefix}_PUBLIC] ${r.method} ${r.path} public route bypasses auth`)}) {`,
        '    val auth = new RoleBasedAuthority(_ => None)',
        '    val rt = BootstrapModule.createRuntime(authority = auth)',
        `    val res = rt.router.route(${reqExpr})`,
        '    assert(res.status != 401 && res.status != 403)',
        '  }',
        '',
      );
      continue;
    }

    lines.push(
      `  // @CoArisingSpec(id="${prefix}_401", witness="http-authz-401")`,
      `  test(${JSON.stringify(`[${prefix}_401] ${r.method} ${r.path} unauthenticated -> 401`)}) {`,
      '    val auth = new RoleBasedAuthority(_ => None)',
      '    val rt = BootstrapModule.createRuntime(authority = auth)',
      `    val res = rt.router.route(${reqExpr})`,
      '    assert(res.status == 401)',
      '    assert(res.body.get("code").contains("NOT_AUTHENTICATED"))',
      '  }',
      '',
    );

    if (mode === 'external-pdp') {
      const expectedAction = r.authz.action ?? r.operation;
      const expectedPolicy = r.authz.policyRef ?? null;
      lines.push(
        `  // @CoArisingSpec(id="${prefix}_403_PDP_DENY", witness="http-authz-pdp-deny")`,
        `  test(${JSON.stringify(`[${prefix}_403_PDP_DENY] ${r.method} ${r.path} external PDP deny -> 403`)}) {`,
        '    val denyPdp = new AuthorizationPort { override def decide(q: AuthzDecisionQuery): Boolean = false }',
        '    val auth = new RoleBasedAuthority(_ => Some(Principal("pdp-user", Set("member"), Some("t-1"))), pdp = Some(denyPdp))',
        '    val rt = BootstrapModule.createRuntime(authority = auth)',
        `    val res = rt.router.route(${reqExpr})`,
        '    assert(res.status == 403)',
        '    assert(res.body.get("code").contains("NOT_AUTHORIZED"))',
        '  }',
        '',
        `  // @CoArisingSpec(id="${prefix}_ALLOW_PDP", witness="http-authz-pdp-allow")`,
        `  test(${JSON.stringify(`[${prefix}_ALLOW_PDP] ${r.method} ${r.path} external PDP allow passes PEP`)}) {`,
        '    var seenAction = ""',
        '    var seenPolicy: Option[String] = None',
        '    val allowPdp = new AuthorizationPort {',
        '      override def decide(q: AuthzDecisionQuery): Boolean = { seenAction = q.action; seenPolicy = q.policyRef; true }',
        '    }',
        '    val auth = new RoleBasedAuthority(_ => Some(Principal("pdp-user", Set("member"), Some("t-1"))), pdp = Some(allowPdp))',
        '    val rt = BootstrapModule.createRuntime(authority = auth)',
        `    val res = rt.router.route(${reqExpr})`,
        '    assert(res.status != 401 && res.status != 403)',
        `    assert(seenAction == ${JSON.stringify(expectedAction)})`,
      );
      if (expectedPolicy) {
        lines.push(`    assert(seenPolicy.contains(${JSON.stringify(expectedPolicy)}))`);
      }
      lines.push('  }', '');
    } else if ((r.authz.allowedRoles ?? []).length > 0) {
      const allowedRole = r.authz.allowedRoles[0];
      lines.push(
        `  // @CoArisingSpec(id="${prefix}_403_ROLE", witness="http-authz-403-role")`,
        `  test(${JSON.stringify(`[${prefix}_403_ROLE] ${r.method} ${r.path} forbidden role -> 403`)}) {`,
        '    val auth = new RoleBasedAuthority(_ => Some(Principal("denied-user", Set("__forbidden_role__"))))',
        '    val rt = BootstrapModule.createRuntime(authority = auth)',
        `    val res = rt.router.route(${reqExpr})`,
        '    assert(res.status == 403)',
        '    assert(res.body.get("code").contains("NOT_AUTHORIZED"))',
        '  }',
        '',
        `  // @CoArisingSpec(id="${prefix}_ALLOW_ROLE", witness="http-authz-allow-role")`,
        `  test(${JSON.stringify(`[${prefix}_ALLOW_ROLE] ${r.method} ${r.path} allowed role ${allowedRole} passes PEP`)}) {`,
        `    val auth = new RoleBasedAuthority(_ => Some(Principal("ok-user", Set(${JSON.stringify(allowedRole)}))))`,
        '    val rt = BootstrapModule.createRuntime(authority = auth)',
        `    val res = rt.router.route(${reqExpr})`,
        '    assert(res.status != 401 && res.status != 403)',
        '  }',
        '',
      );
    }

    if (r.method === 'POST') {
      const csrfRole = (r.authz.allowedRoles ?? [])[0] ?? '*';
      const pdpPart = mode === 'external-pdp'
        ? ', pdp = Some(new AuthorizationPort { override def decide(q: AuthzDecisionQuery): Boolean = true })'
        : '';
      lines.push(
        `  // @CoArisingSpec(id="${prefix}_403_CSRF", witness="http-authz-csrf")`,
        `  test(${JSON.stringify(`[${prefix}_403_CSRF] POST ${r.path} invalid CSRF -> 403 CSRF_INVALID`)}) {`,
        `    val auth = new RoleBasedAuthority(_ => Some(Principal("csrf-user", Set(${JSON.stringify(csrfRole)})))${pdpPart}, csrfFn = _ => false)`,
        '    val rt = BootstrapModule.createRuntime(authority = auth)',
        `    val res = rt.router.route(${reqExpr})`,
        '    assert(res.status == 403)',
        '    assert(res.body.get("code").contains("CSRF_INVALID"))',
        '  }',
        '',
      );
    }
  }
}

export function emitExecutableTsInterfacesSpec(canonicalV2) {
  const routes = deriveStoryHttpRoutes(canonicalV2);
  const appBehaviors = (canonicalV2.behaviors ?? []).filter(b => b.layer === 'application');

  const lines = [
    '// LOCKED EXECUTABLE INTERFACES HTTP ORACLE — GENERATED BY co-arising 2.0 (DO NOT MODIFY)',
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    '// layer: interfaces | tests live HTTP router, controllers, Authz PEP/PDP matrix, and DI bootstrap',
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'import { createHttpServer } from "../../generated-scaffold/ts/modules/bootstrap.ts";',
    'import { createRoleBasedAuthority } from "../../generated-scaffold/ts/interfaces/api/dto.ts";',
  ];

  for (const beh of appBehaviors) {
    const slug = toSlug(beh.target);
    const handlerVar = `${toCamel(toPascal(beh.target))}Handler`;
    lines.push(`import { ${handlerVar} } from "../../handwritten/${slug}.cloze.ts";`);
  }

  lines.push('');
  lines.push('async function withServer<T>(externOverrides: Record<string, Record<string, () => boolean>>, fn: (baseUrl: string) => Promise<T>, authority?: unknown): Promise<T> {');
  lines.push('  const handlers = {');
  for (const beh of appBehaviors) {
    lines.push(`    ${JSON.stringify(beh.target)}: ${toCamel(toPascal(beh.target))}Handler,`);
  }
  lines.push('  };');
  lines.push('  const { server } = createHttpServer({ handlers, externOverrides: externOverrides as never, authority: authority as never });');
  lines.push('  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));');
  lines.push('  const addr = server.address();');
  lines.push('  const port = typeof addr === "object" && addr ? addr.port : 0;');
  lines.push('  try {');
  lines.push('    return await fn(`http://127.0.0.1:${port}`);');
  lines.push('  } finally {');
  lines.push('    await new Promise<void>(resolve => server.close(() => resolve()));');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  lines.push('async function withBareRouter<T>(fn: (baseUrl: string) => Promise<T>, authority?: unknown): Promise<T> {');
  lines.push('  const { server } = createHttpServer({ handlers: {}, authority: authority as never });');
  lines.push('  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));');
  lines.push('  const addr = server.address();');
  lines.push('  const port = typeof addr === "object" && addr ? addr.port : 0;');
  lines.push('  try {');
  lines.push('    return await fn(`http://127.0.0.1:${port}`);');
  lines.push('  } finally {');
  lines.push('    await new Promise<void>(resolve => server.close(() => resolve()));');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  lines.push('// @CoArisingSpec(id="INTERFACES_HEALTH", witness="http-health")');
  lines.push('test("[INTERFACES_HEALTH] GET /health -> 200 ok", async () => {');
  lines.push('  await withServer({}, async baseUrl => {');
  lines.push('    const res = await fetch(`${baseUrl}/health`);');
  lines.push('    assert.equal(res.status, 200);');
  lines.push('    const json = await res.json() as Record<string, unknown>;');
  lines.push('    assert.equal(json.status, "ok");');
  lines.push(`    assert.equal(json.system, ${JSON.stringify(canonicalV2.system)});`);
  lines.push(`    assert.equal(json.context, ${JSON.stringify(canonicalV2.context)});`);
  lines.push('  });');
  lines.push('});');
  lines.push('');

  lines.push('// @CoArisingSpec(id="INTERFACES_NOT_FOUND", witness="http-404")');
  lines.push('test("[INTERFACES_NOT_FOUND] GET /api/v1/__unknown__ -> 404 ROUTE_NOT_FOUND", async () => {');
  lines.push('  await withServer({}, async baseUrl => {');
  lines.push('    const res = await fetch(`${baseUrl}/api/v1/__unknown__`);');
  lines.push('    assert.equal(res.status, 404);');
  lines.push('    const json = await res.json() as Record<string, unknown>;');
  lines.push('    assert.equal(json.code, "ROUTE_NOT_FOUND");');
  lines.push('  });');
  lines.push('});');
  lines.push('');

  if (routes.length > 0) {
    const first = routes[0];
    lines.push('// @CoArisingSpec(id="INTERFACES_AUTH_401", witness="http-authority-401")');
    lines.push(`test(${JSON.stringify(`[INTERFACES_AUTH_401] ${first.method} ${first.path} without auth -> 401 NOT_AUTHENTICATED`)}, async () => {`);
    lines.push('  await withServer({}, async baseUrl => {');
    lines.push(`    const res = await fetch(\`\${baseUrl}${first.path}\`, { method: ${JSON.stringify(first.method)} });`);
    lines.push('    assert.equal(res.status, 401);');
    lines.push('    const json = await res.json() as Record<string, unknown>;');
    lines.push('    assert.equal(json.code, "NOT_AUTHENTICATED");');
    lines.push('  }, { authenticate: () => null, authorize: () => false });');
    lines.push('});');
    lines.push('');

    lines.push('// @CoArisingSpec(id="INTERFACES_AUTH_403", witness="http-authority-403")');
    lines.push(`test(${JSON.stringify(`[INTERFACES_AUTH_403] ${first.method} ${first.path} forbidden role -> 403 NOT_AUTHORIZED`)}, async () => {`);
    lines.push('  await withServer({}, async baseUrl => {');
    lines.push(`    const res = await fetch(\`\${baseUrl}${first.path}\`, { method: ${JSON.stringify(first.method)} });`);
    lines.push('    assert.equal(res.status, 403);');
    lines.push('    const json = await res.json() as Record<string, unknown>;');
    lines.push('    assert.equal(json.code, "NOT_AUTHORIZED");');
    lines.push('  }, { authenticate: () => ({ id: "guest", roles: ["viewer"] }), authorize: () => false });');
    lines.push('});');
    lines.push('');
  }

  emitTsAuthzMatrixTests(canonicalV2, routes, lines);

  for (const beh of appBehaviors) {
    const camel = toCamel(toPascal(beh.target));
    const cases = pickRepresentativeCases(beh, routes);
    for (const { route, ex, rejectAct } of cases) {
      const mat = materializeApplicationWitness(ex.witness);
      const externMap = {};
      for (const ext of beh.externs ?? []) {
        externMap[ext.name] = Object.hasOwn(mat.externs, ext.name) ? Boolean(mat.externs[ext.name]) : true;
      }
      const expectedStatus = rejectAct ? mapRejectionStatus(rejectAct.code) : 200;
      const specId = `HTTP_${ex.ruleId}`;

      lines.push(`// @CoArisingSpec(id="${specId}", witness="interfaces-http-${ex.ruleId.toLowerCase()}")`);
      lines.push(`test(${JSON.stringify(`[${specId}] ${route.method} ${route.path} -> HTTP ${expectedStatus}`)}, async () => {`);
      lines.push(`  const externValues = ${JSON.stringify(externMap)};`);
      lines.push('  const externOverrides = {');
      lines.push(`    ${JSON.stringify(camel)}: Object.fromEntries(Object.entries(externValues).map(([k, v]) => [k, () => v])),`);
      lines.push('  };');
      lines.push('  await withServer(externOverrides, async baseUrl => {');
      if (route.method === 'GET') {
        const qs = Object.entries(mat.payload ?? {})
          .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        const suffix = qs ? `?${qs}` : '';
        lines.push(`    const res = await fetch(\`\${baseUrl}${route.path}${suffix}\`);`);
      } else {
        const bodyObj = { ...(mat.payload ?? {}), ...(Object.keys(mat.stateSnapshot ?? {}).length ? { stateSnapshot: mat.stateSnapshot } : {}) };
        lines.push(`    const res = await fetch(\`\${baseUrl}${route.path}\`, {`);
        lines.push('      method: "POST",');
        lines.push('      headers: { "content-type": "application/json" },');
        lines.push(`      body: JSON.stringify(${JSON.stringify(bodyObj)}),`);
        lines.push('    });');
      }
      lines.push(`    assert.equal(res.status, ${expectedStatus});`);
      lines.push('    const json = await res.json() as Record<string, unknown>;');
      if (rejectAct) {
        lines.push('    assert.equal(json.ok, false);');
        lines.push(`    assert.equal(json.code, ${JSON.stringify(rejectAct.code)});`);
      } else {
        lines.push('    assert.equal(json.ok, true);');
      }
      lines.push('  });');
      lines.push('});');
      lines.push('');
    }
  }

  const content = lines.join('\n');
  return {
    path: 'ts/interfaces-http.ears.spec.ts',
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

export function emitExecutableScalaInterfacesSpec(canonicalV2, { packageName = 'example.v2' } = {}) {
  const routes = deriveStoryHttpRoutes(canonicalV2);
  const appBehaviors = (canonicalV2.behaviors ?? []).filter(b => b.layer === 'application');
  const pkgDir = packageName.split('.').join('/');
  const className = 'InterfacesHttpSpec';

  const lines = [
    '// LOCKED EXECUTABLE INTERFACES HTTP ORACLE — GENERATED BY co-arising 2.0 (DO NOT MODIFY)',
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    '// layer: interfaces | tests HttpRouter, Controllers, and BootstrapModule DI composition',
    `package ${packageName}`,
    '',
    'import org.scalatest.funsuite.AnyFunSuite',
    `import ${packageName}.interfaces.api.{AuthorizationPort, AuthzDecisionQuery, HttpRequest, Principal, RoleBasedAuthority}`,
    `import ${packageName}.modules.BootstrapModule`,
    '',
    `final class ${className} extends AnyFunSuite {`,
    '  // @CoArisingSpec(id="INTERFACES_HEALTH", witness="http-health")',
    '  test("[INTERFACES_HEALTH] GET /health -> 200 ok") {',
    '    val rt = BootstrapModule.createRuntime()',
    '    val res = rt.router.route(HttpRequest("GET", "/health"))',
    '    assert(res.status == 200)',
    '    assert(res.body.get("status").contains("ok"))',
    `    assert(res.body.get("system").contains(${JSON.stringify(canonicalV2.system)}))`,
    `    assert(res.body.get("context").contains(${JSON.stringify(canonicalV2.context)}))`,
    '  }',
    '',
    '  // @CoArisingSpec(id="INTERFACES_NOT_FOUND", witness="http-404")',
    '  test("[INTERFACES_NOT_FOUND] GET /api/v1/__unknown__ -> 404 ROUTE_NOT_FOUND") {',
    '    val rt = BootstrapModule.createRuntime()',
    '    val res = rt.router.route(HttpRequest("GET", "/api/v1/__unknown__"))',
    '    assert(res.status == 404)',
    '    assert(res.body.get("code").contains("ROUTE_NOT_FOUND"))',
    '  }',
    '',
  ];

  if (routes.length > 0) {
    const first = routes[0];
    lines.push(
      '  // @CoArisingSpec(id="INTERFACES_AUTH_401", witness="http-authority-401")',
      `  test(${JSON.stringify(`[INTERFACES_AUTH_401] ${first.method} ${first.path} without auth -> 401 NOT_AUTHENTICATED`)}) {`,
      `    val denyAuth = new ${packageName}.interfaces.api.HttpAuthority {`,
      '      override def authenticate(req: HttpRequest) = None',
      `      override def authorize(principal: ${packageName}.interfaces.api.Principal, route: ${packageName}.interfaces.api.RouteDescriptor) = false`,
      '    }',
      '    val rt = BootstrapModule.createRuntime(authority = denyAuth)',
      `    val res = rt.router.route(HttpRequest(${JSON.stringify(first.method)}, ${JSON.stringify(first.path)}))`,
      '    assert(res.status == 401)',
      '    assert(res.body.get("code").contains("NOT_AUTHENTICATED"))',
      '  }',
      '',
      '  // @CoArisingSpec(id="INTERFACES_AUTH_403", witness="http-authority-403")',
      `  test(${JSON.stringify(`[INTERFACES_AUTH_403] ${first.method} ${first.path} forbidden role -> 403 NOT_AUTHORIZED`)}) {`,
      `    val forbidAuth = new ${packageName}.interfaces.api.HttpAuthority {`,
      `      override def authenticate(req: HttpRequest) = Some(${packageName}.interfaces.api.Principal("guest", Set("viewer")))`,
      `      override def authorize(principal: ${packageName}.interfaces.api.Principal, route: ${packageName}.interfaces.api.RouteDescriptor) = false`,
      '    }',
      '    val rt = BootstrapModule.createRuntime(authority = forbidAuth)',
      `    val res = rt.router.route(HttpRequest(${JSON.stringify(first.method)}, ${JSON.stringify(first.path)}))`,
      '    assert(res.status == 403)',
      '    assert(res.body.get("code").contains("NOT_AUTHORIZED"))',
      '  }',
      '',
    );
  }

  emitScalaAuthzMatrixTests(canonicalV2, routes, packageName, lines);

  for (const beh of appBehaviors) {
    const pascal = toPascal(beh.target);
    const camel = toCamel(pascal);
    const cases = pickRepresentativeCases(beh, routes);
    for (const { route, ex, rejectAct } of cases) {
      const mat = materializeApplicationWitness(ex.witness);
      const expectedStatus = rejectAct ? mapRejectionStatus(rejectAct.code) : 200;
      const specId = `HTTP_${ex.ruleId}`;

      lines.push(`  // @CoArisingSpec(id="${specId}", witness="interfaces-http-${ex.ruleId.toLowerCase()}")`);
      lines.push(`  test(${JSON.stringify(`[${specId}] ${route.method} ${route.path} -> HTTP ${expectedStatus}`)}) {`);
      lines.push(`    val externs = new ${pascal}ExternPorts {`);
      for (const ext of beh.externs ?? []) {
        const val = Object.hasOwn(mat.externs, ext.name) ? Boolean(mat.externs[ext.name]) : true;
        const sig = (ext.params ?? []).map(p => `${p}: Any`).join(', ');
        lines.push(`      override def ${ext.name}(${sig}): Boolean = ${val ? 'true' : 'false'}`);
      }
      lines.push('    }');
      lines.push(`    val rt = BootstrapModule.createRuntime(${camel}Handler = Some(${pascal}Cloze), ${camel}Externs = Some(externs))`);
      lines.push(`    val req = HttpRequest(method = ${JSON.stringify(route.method)}, path = ${JSON.stringify(route.path)}, body = ${scalaAnyLiteral(mat.payload)}, stateSnapshot = ${scalaAnyLiteral(mat.stateSnapshot)})`);
      lines.push('    val res = rt.router.route(req)');
      lines.push(`    assert(res.status == ${expectedStatus})`);
      if (rejectAct) {
        lines.push('    assert(res.body.get("ok").contains(false))');
        lines.push(`    assert(res.body.get("code").contains(${JSON.stringify(rejectAct.code)}))`);
      } else {
        lines.push('    assert(res.body.get("ok").contains(true))');
      }
      lines.push('  }');
      lines.push('');
    }
  }

  lines.push('}');
  lines.push('');

  const content = lines.join('\n');
  return {
    path: `scala/${pkgDir}/${className}.scala`,
    className,
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}
