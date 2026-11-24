// Orthogonal PackageLayoutStrategy vs FileLayoutStrategy tests.
// Verifies that switching FileLayoutStrategy (e.g. single-module Play `app/...`
// vs multi-module `domain/src/main/scala/...`, `application/src/main/scala/...`,
// `infrastructure/src/main/scala/...`, `bootstrap/src/main/scala/...`) changes
// physical module paths and remaps internal `deps` while keeping every Scala
// `package` declaration and file content 100% identical.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SINGLE_MODULE_PLAY_LAYOUT,
  MULTI_MODULE_LAYERED_LAYOUT,
  createMultiModuleLayout,
  resolveFileLayout,
  resolvePackage,
  scalaSourcePath,
  scalaSubpackagePath,
  protoSchemaPath,
  remapPlanEntries,
} from '../lib/layout/layout-strategy.mjs';

test('single-module Play layout and multi-module layered layout separate package from path', () => {
  const domainPkg = resolvePackage('example.wealth', 'domain.entities');
  const appPkg = resolvePackage('example.wealth', 'application.aggregates');
  const infraPkg = resolvePackage('example.wealth', 'infrastructure.persistence');
  const bootPkg = resolvePackage('example.wealth', 'infrastructure.bootstrap');

  assert.equal(domainPkg, 'example.wealth.domain.entities');
  assert.equal(appPkg, 'example.wealth.application.aggregates');
  assert.equal(infraPkg, 'example.wealth.infrastructure.persistence');
  assert.equal(bootPkg, 'example.wealth.infrastructure.bootstrap');

  // Default single-module Play layout
  assert.equal(
    scalaSubpackagePath('example.wealth', 'domain.entities', 'AccountEntity.scala'),
    'app/example/wealth/domain/entities/AccountEntity.scala',
  );
  assert.equal(
    protoSchemaPath('account.proto'),
    'app/protobuf/account.proto',
  );

  // Multi-module layered layout — identical logical package, distinct module directories
  assert.equal(
    scalaSourcePath(domainPkg, 'AccountEntity.scala', { layout: MULTI_MODULE_LAYERED_LAYOUT }),
    'domain/src/main/scala/example/wealth/domain/entities/AccountEntity.scala',
  );
  assert.equal(
    scalaSourcePath(appPkg, 'AccountProtocol.scala', { layout: MULTI_MODULE_LAYERED_LAYOUT }),
    'application/src/main/scala/example/wealth/application/aggregates/AccountProtocol.scala',
  );
  assert.equal(
    scalaSourcePath(infraPkg, 'AccountAdapters.scala', { layout: MULTI_MODULE_LAYERED_LAYOUT }),
    'infrastructure/src/main/scala/example/wealth/infrastructure/persistence/AccountAdapters.scala',
  );
  assert.equal(
    scalaSourcePath(bootPkg, 'AccountBootstrap.scala', { layout: MULTI_MODULE_LAYERED_LAYOUT }),
    'bootstrap/src/main/scala/example/wealth/infrastructure/bootstrap/AccountBootstrap.scala',
  );
  assert.equal(
    protoSchemaPath('account.proto', { layout: MULTI_MODULE_LAYERED_LAYOUT }),
    'infrastructure/src/main/protobuf/account.proto',
  );
});

test('custom multi-module layout supports custom module roots without changing package names', () => {
  const custom = createMultiModuleLayout({
    id: 'di-poc-style',
    modules: {
      domain: 'modules/core-domain',
      application: 'modules/app-service',
      infrastructure: 'modules/infra-akka',
      bootstrap: 'modules/app-bootstrap',
    },
  });
  assert.equal(
    scalaSubpackagePath('net.demo', 'domain.values', 'Money.scala', { layout: custom }),
    'modules/core-domain/src/main/scala/net/demo/domain/values/Money.scala',
  );
  assert.equal(
    scalaSubpackagePath('net.demo', 'infrastructure.bootstrap', 'ApplicationBootstrap.scala', { layout: custom }),
    'modules/app-bootstrap/src/main/scala/net/demo/infrastructure/bootstrap/ApplicationBootstrap.scala',
  );
});

test('remapPlanEntries projects physical paths and deps while keeping Scala content byte-identical', () => {
  const singleModulePlan = [
    {
      path: 'app/example/wealth/domain/entities/AccountEntity.scala',
      content: 'package example.wealth.domain.entities\n\nobject AccountEntity {}\n',
      kind: 'entity',
      deps: [],
    },
    {
      path: 'app/example/wealth/application/aggregates/AccountProtocol.scala',
      content: 'package example.wealth.application.aggregates\n\nimport example.wealth.domain.entities.AccountEntity\n',
      kind: 'application-protocol',
      deps: ['app/example/wealth/domain/entities/AccountEntity.scala'],
    },
    {
      path: 'app/example/wealth/infrastructure/persistence/AccountAdapters.scala',
      content: 'package example.wealth.infrastructure.persistence\n',
      kind: 'serialization-adapter',
      deps: ['app/protobuf/account.proto', 'app/example/wealth/domain/entities/AccountEntity.scala'],
    },
    {
      path: 'app/example/wealth/infrastructure/bootstrap/AccountBootstrap.scala',
      content: 'package example.wealth.infrastructure.bootstrap\n',
      kind: 'aggregate-bootstrap',
      deps: [
        'app/example/wealth/application/aggregates/AccountProtocol.scala',
        'app/example/wealth/infrastructure/persistence/AccountAdapters.scala',
      ],
    },
    {
      path: 'app/protobuf/account.proto',
      content: 'syntax = "proto3";\n',
      kind: 'proto',
      deps: [],
    },
  ];

  const multiModulePlan = remapPlanEntries(singleModulePlan, 'multi-module-layered');
  assert.equal(multiModulePlan.length, singleModulePlan.length);

  // Content (including Scala `package` and `import`) is 100% byte-identical
  for (let i = 0; i < singleModulePlan.length; i++) {
    assert.equal(multiModulePlan[i].content, singleModulePlan[i].content);
  }

  // Physical paths moved into layered modules
  assert.deepEqual(
    multiModulePlan.map(e => e.path),
    [
      'domain/src/main/scala/example/wealth/domain/entities/AccountEntity.scala',
      'application/src/main/scala/example/wealth/application/aggregates/AccountProtocol.scala',
      'infrastructure/src/main/scala/example/wealth/infrastructure/persistence/AccountAdapters.scala',
      'bootstrap/src/main/scala/example/wealth/infrastructure/bootstrap/AccountBootstrap.scala',
      'infrastructure/src/main/protobuf/account.proto',
    ],
  );

  // Every dep resolves to the remapped physical path
  const knownPaths = new Set(multiModulePlan.map(e => e.path));
  for (const entry of multiModulePlan) {
    for (const dep of entry.deps) {
      assert.ok(knownPaths.has(dep), `remapped dep must exist in plan: ${dep}`);
    }
  }

  // Single-module preset is an exact no-op
  assert.strictEqual(remapPlanEntries(singleModulePlan, SINGLE_MODULE_PLAY_LAYOUT), singleModulePlan);
  assert.throws(() => resolveFileLayout('unknown-preset'), /LAYOUT_STRATEGY/);
});
