import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { initV2Project } from '../lib/v2/init-v2.mjs';
import { runCheckV2 } from '../lib/v2/check-v2.mjs';
import { checkOnionDipBoundaries } from '../lib/v2/verify-gate.mjs';
import { exportV2WorkshopHtml } from '../lib/v2/view-v2.mjs';

test('v2 Onion 5-layer codegen, scaffold copy, live TS+Scala interfaces HTTP tests, DIP gate, and generic view-v2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coarising-v2-onion-'));
  try {
    const initRes = initV2Project({
      targetDir: dir,
      system: 'order-hub',
      context: 'orders',
      targets: ['typescript', 'scala'],
      packageName: 'example.orders.v2',
    });
    assert.equal(initRes.compiled?.passed, true);

    // 1. Static scaffolds copied for TS and Scala Play
    assert.ok(existsSync(join(dir, 'package.json')));
    assert.ok(existsSync(join(dir, 'tsconfig.json')));
    assert.ok(existsSync(join(dir, 'handwritten/server.ts')));
    assert.ok(existsSync(join(dir, 'play-scaffold/build.sbt')));
    assert.ok(existsSync(join(dir, 'play-scaffold/conf/routes')));
    assert.ok(existsSync(join(dir, 'play-scaffold/app/controllers/PlayHttpBridge.scala')));
    const playRoutes = readFileSync(join(dir, 'play-scaffold/conf/routes'), 'utf8');
    assert.match(playRoutes, /POST\s+\/api\/v1\/orders\/quota-port\/submit/);

    // 2. All 5 Onion layers emitted in both TS and Scala
    for (const rel of [
      'generated-scaffold/ts/domain/index.ts',
      'generated-scaffold/ts/application/connectors.ts',
      'generated-scaffold/ts/application/index.ts',
      'generated-scaffold/ts/interfaces/api/dto.ts',
      'generated-scaffold/ts/interfaces/http/quota-intake.controller.ts',
      'generated-scaffold/ts/interfaces/http/router.ts',
      'generated-scaffold/ts/infrastructure/persistence/in-memory-store.ts',
      'generated-scaffold/ts/infrastructure/connectors/effect-adapters.ts',
      'generated-scaffold/ts/modules/bootstrap.ts',
      'generated-scaffold/scala/example/orders/v2/domain/DomainFacade.scala',
      'generated-scaffold/scala/example/orders/v2/application/Connectors.scala',
      'generated-scaffold/scala/example/orders/v2/interfaces/api/ApiDto.scala',
      'generated-scaffold/scala/example/orders/v2/interfaces/http/QuotaIntakeController.scala',
      'generated-scaffold/scala/example/orders/v2/interfaces/http/HttpRouter.scala',
      'generated-scaffold/scala/example/orders/v2/infrastructure/persistence/InMemoryStore.scala',
      'generated-scaffold/scala/example/orders/v2/infrastructure/connectors/EffectAdapters.scala',
      'generated-scaffold/scala/example/orders/v2/modules/BootstrapModule.scala',
      'generated-tests/ts/interfaces-http.ears.spec.ts',
      'generated-tests/scala/example/orders/v2/InterfacesHttpSpec.scala',
    ]) {
      assert.ok(existsSync(join(dir, rel)), `expected Onion artifact: ${rel}`);
    }

    // 3. Full check-v2 --strict passes (compile + TS domain/app/interfaces HTTP + Scala domain/app/interfaces + Onion DIP + 100% coverage)
    const checkRes = runCheckV2({ rootDir: dir, strict: true });
    assert.equal(checkRes.passed, true, JSON.stringify(checkRes, null, 2));
    assert.equal(checkRes.verify.onionCheck.passed, true);
    assert.ok(checkRes.verify.tsCheck.specFiles.includes('generated-tests/ts/interfaces-http.ears.spec.ts'));
    assert.ok(checkRes.verify.scalaCheck.suiteClasses.includes('example.orders.v2.InterfacesHttpSpec'));
    assert.equal(checkRes.coverage.passed, true);
    assert.equal(checkRes.coverage.classifiedFiles, checkRes.coverage.totalGovernedFiles);

    // 4. Generic view-v2 exports offline strict-CSP workbench for ANY fresh project
    const outHtml = join(dir, 'workshop.html');
    const viewRes = exportV2WorkshopHtml({ rootDir: dir, outFile: outHtml });
    assert.ok(viewRes.nodes > 0);
    assert.equal(viewRes.mappedNodes, viewRes.nodes);
    const html = readFileSync(outHtml, 'utf8');
    assert.doesNotMatch(html, /\/Users\//);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const hash = createHash('sha256').update(script).digest('base64');
    assert.ok(html.includes(`sha256-${hash}`));
    const embedded = JSON.parse(html.match(/<script id="workshop-view" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(embedded.totals.omittedNodes, 0);
    assert.ok(embedded.chapters.length >= 2);

    // 5. Onion DIP negative control: injecting an outer-layer import into domain/ fails boundary check
    const domainFile = join(dir, 'generated-scaffold/ts/domain/index.ts');
    const orig = readFileSync(domainFile, 'utf8');
    writeFileSync(domainFile, `${orig}\nimport { createHttpRouter } from "../interfaces/http/router.ts";\n`, 'utf8');
    const badDip = checkOnionDipBoundaries(dir);
    assert.equal(badDip.passed, false);
    assert.ok(badDip.violations.some(v => v.rule === 'ONION_DOMAIN_NO_OUTER_TS'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
