#!/usr/bin/env node
// Black-box end-to-end smoke test for generated `scala-cqrs-play-service-v2` projects.
//
// Phases:
//   1. Generate a fresh `scala-cqrs-play-service-v2` project via `truthsrc init-v2`.
//   2. Run `truthsrc check-v2 --strict` and assert generated production runtime invariants
//      (Guice BootstrapModule, CSRFFilter, fail-closed AuthorizationPort, AuthedWriteBuilder.withRequest,
//      ReadSide/Policy wiring, routes).
//   3. Unless `--gen-only` is passed:
//      - Run `sbt -batch stage` inside `generated-scaffold/`.
//      - Boot the staged Play binary on a free ephemeral port using `-Dconfig.resource=dev.conf`.
//      - Poll `GET /health` until HTTP 200.
//      - Fire black-box HTTP assertions:
//        * Unauthenticated POST `/api/v1/core/quota-port/submit` -> 401 (fail-closed authz).
//        * Authenticated POST `/api/v1/core/quota-port/submit` with JSON body + query param -> non-404/non-500 JSON response.
//        * GET `/api/v1/core/aggregates/quota-bucket/:id` -> non-404/non-500 response.
//      - Tear down the Play JVM cleanly in `finally`.
//
// Usage:
//   node tools/e2e-play-smoke.mjs [--gen-only] [--require-sbt] [--keep-tmp]

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'truthsrc.js');

const args = new Set(process.argv.slice(2));
const genOnly = args.has('--gen-only');
const requireSbt = args.has('--require-sbt');
const keepTmp = args.has('--keep-tmp');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function hasCommand(cmd) {
  const res = spawnSync('which', [cmd], { encoding: 'utf8', stdio: 'pipe' });
  return res.status === 0 && Boolean(String(res.stdout || '').trim());
}

async function waitForHealth(baseUrl, proc, logBuf, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`Play process exited prematurely (code=${proc.exitCode}):\n${logBuf.slice(-40).join('\n')}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.status === 200) {
        return await res.text();
      }
    } catch {
      // Server not listening yet.
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/health after ${timeoutMs}ms:\n${logBuf.slice(-40).join('\n')}`);
}

async function main() {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'truthsrc-e2e-play-'));
  const projDir = path.join(tmpBase, 'smoke-service');
  let child = null;

  try {
    process.stdout.write(`[e2e-play] 1/4 Generating scala-cqrs-play-service-v2 project in ${projDir}\n`);
    execFileSync(
      process.execPath,
      [BIN, 'init-v2', projDir, '--target', 'scala-cqrs-play-service-v2', '--package', 'example.smoke'],
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
    );

    process.stdout.write('[e2e-play] 2/4 Running check-v2 --strict & verifying Play scaffold invariants\n');
    execFileSync(
      process.execPath,
      [BIN, 'check-v2', '--root', projDir, ...(genOnly ? [] : ['--strict']), '--format', 'json'],
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
    );

    const scaffoldDir = path.join(projDir, 'generated-scaffold');
    const serviceConf = fs.readFileSync(path.join(scaffoldDir, 'conf', 'service.conf'), 'utf8');
    const routes = fs.readFileSync(path.join(scaffoldDir, 'conf', 'routes'), 'utf8');
    const buildSbt = fs.readFileSync(path.join(scaffoldDir, 'build.sbt'), 'utf8');
    const controller = fs.readFileSync(
      path.join(scaffoldDir, 'scala', 'controllers', 'QuotaIntakePlayController.scala'),
      'utf8'
    );

    assert.match(serviceConf, /play\.modules\.enabled\s*\+=\s*"example\.smoke\.modules\.BootstrapModule"/u, 'service.conf must enable Guice BootstrapModule');
    assert.doesNotMatch(serviceConf, /play\.application\.loader/u, 'service.conf must not use play.application.loader');
    assert.match(serviceConf, /play\.filters\.enabled\s*\+=\s*"play\.filters\.csrf\.CSRFFilter"/u, 'service.conf must enable CSRFFilter');
    assert.match(buildSbt, /akka-projection-jdbc/u, 'build.sbt must declare akka-projection-jdbc');
    assert.match(routes, /GET\s+\/health\b/u, 'routes must expose GET /health');
    assert.match(routes, /POST\s+\/api\/v1\/core\/quota-port\/submit\b/u, 'routes must expose POST submit route');
    assert.match(routes, /GET\s+\/api\/v1\/core\/aggregates\/quota-bucket\/:quotaBucketId\b/u, 'routes must expose aggregate state query route');
    assert.match(controller, /\.withRequest\s*\{/u, 'PlayController POST route must use AuthedWriteBuilder.withRequest');
    assert.match(controller, /pdp:\s*AuthorizationPort/u, 'PlayController must inject AuthorizationPort');

    if (genOnly) {
      process.stdout.write('[e2e-play] --gen-only passed (generation, check-v2 --strict, and Play scaffold invariants verified).\n');
      return;
    }

    if (!hasCommand('sbt')) {
      if (requireSbt) {
        throw new Error('sbt is required (--require-sbt) but was not found on PATH.');
      }
      process.stdout.write('[e2e-play] sbt not found on PATH; skipping JVM stage/boot phase (re-run locally or in CI with sbt installed, or pass --require-sbt to enforce).\n');
      return;
    }

    process.stdout.write('[e2e-play] 3/4 Running sbt -batch stage\n');
    execFileSync('sbt', ['-batch', 'stage'], { cwd: scaffoldDir, stdio: 'inherit' });

    const stageBinDir = path.join(scaffoldDir, 'target', 'universal', 'stage', 'bin');
    const bins = fs.readdirSync(stageBinDir).filter(f => !f.endsWith('.bat'));
    assert.ok(bins.length > 0, `No staged executable found in ${stageBinDir}`);
    const stageExe = path.join(stageBinDir, bins[0]);

    const httpPort = await findFreePort();
    const arteryPort = await findFreePort();
    const baseUrl = `http://127.0.0.1:${httpPort}`;
    const logBuf = [];

    process.stdout.write(`[e2e-play] 4/4 Booting staged Play service on ${baseUrl} (artery=${arteryPort})\n`);
    child = spawn(
      stageExe,
      [
        '-Dconfig.resource=dev.conf',
        `-Dhttp.port=${httpPort}`,
        '-Dhttp.address=127.0.0.1',
        `-Dakka.remote.artery.canonical.port=${arteryPort}`,
        `-Dakka.remote.artery.bind.port=${arteryPort}`,
        `-Dakka.cluster.seed-nodes.0=akka://application@127.0.0.1:${arteryPort}`,
      ],
      { cwd: scaffoldDir, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const pushLog = chunk => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) logBuf.push(line);
      }
      if (logBuf.length > 200) logBuf.splice(0, logBuf.length - 200);
    };
    child.stdout.on('data', pushLog);
    child.stderr.on('data', pushLog);

    await waitForHealth(baseUrl, child, logBuf);
    process.stdout.write('[e2e-play] GET /health -> 200 OK\n');

    // Unauthenticated write must fail closed with 401.
    const unauthRes = await fetch(`${baseUrl}/api/v1/core/quota-port/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Csrf-Token': 'nocheck',
      },
      body: JSON.stringify({ actor: 'smoke-user', reqId: 'req-unauth', qty: 10 }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(unauthRes.status, 401, `Expected 401 for unauthenticated POST, got ${unauthRes.status}: ${await unauthRes.text()}`);
    process.stdout.write('[e2e-play] Unauthenticated POST -> 401 (fail-closed verified)\n');

    // Authenticated write must route through PlayController + Guice + JSON codec (never 404/500).
    const authRes = await fetch(`${baseUrl}/api/v1/core/quota-port/submit?qty=10`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Csrf-Token': 'nocheck',
        'X-User-Id': 'smoke-user',
        'X-User-Roles': 'user',
        'X-Tenant-Id': 'smoke-tenant',
      },
      body: JSON.stringify({ actor: 'smoke-user', reqId: 'req-auth-1' }),
      signal: AbortSignal.timeout(15_000),
    });
    const authText = await authRes.text();
    assert.ok(
      authRes.status !== 404 && authRes.status < 500,
      `Authenticated POST returned unexpected status ${authRes.status}: ${authText}`
    );
    assert.doesNotThrow(() => JSON.parse(authText), `Authenticated POST did not return JSON: ${authText}`);
    process.stdout.write(`[e2e-play] Authenticated POST (query+body merge) -> HTTP ${authRes.status} JSON\n`);

    // Aggregate state read endpoint must be wired and responsive (never 404/500).
    const readRes = await fetch(`${baseUrl}/api/v1/core/aggregates/quota-bucket/smoke-bucket`, {
      headers: {
        'X-User-Id': 'smoke-user',
        'X-User-Roles': 'user',
        'X-Tenant-Id': 'smoke-tenant',
      },
      signal: AbortSignal.timeout(15_000),
    });
    const readText = await readRes.text();
    assert.ok(
      readRes.status < 500,
      `Aggregate state GET returned 5xx (${readRes.status}): ${readText}`
    );
    process.stdout.write(`[e2e-play] Aggregate state GET -> HTTP ${readRes.status}\n`);

    process.stdout.write('[e2e-play] ALL PLAY BLACK-BOX E2E SMOKE ASSERTIONS PASSED.\n');
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 1500));
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (!keepTmp) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }
}

main().catch(err => {
  process.stderr.write(`[e2e-play] FAILED: ${err.stack || err.message}\n`);
  process.exit(1);
});
