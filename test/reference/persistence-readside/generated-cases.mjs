// External test harness. Every production API is loaded from the selected tool
// root (the installed package for installed receipts), never a checkout fallback.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, relative, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { files, snapshot } from '../compiler-tools.mjs';
import { warehouseClasspaths } from '../aggregate-core/toolchain.mjs';

const testRoot = 'modules/glue/src/test/scala/';
// Fixed sample contracts, not test names/counts learned from candidate output.
export const generatedShapeSuites = [
  { file: testRoot + 'example/inventory/infrastructure/serialization/WarehouseStateRoundTripSpec.scala',
    suite: 'example.inventory.infrastructure.serialization.WarehouseStateRoundTripSpec',
    testNames: ['WarehouseState serialization should round-trip the declared empty state through protobuf bytes'],
    reporterNames: ['should round-trip the declared empty state through protobuf bytes'] },
  { file: testRoot + 'example/inventory/domain/invariant/WarehouseAggregateReplaySpec.scala',
    suite: 'example.inventory.domain.invariant.WarehouseAggregateReplaySpec',
    testNames: ['empty event history preserves the explicitly declared initial state'] },
  { file: testRoot + 'example/inventory/infrastructure/persistence/WarehousePersistenceRoundTripSpec.scala',
    suite: 'example.inventory.infrastructure.persistence.WarehousePersistenceRoundTripSpec',
    testNames: ['declared empty state traverses the versioned persistence frame',
      'unknown envelope version is rejected rather than treated as compatible'] },
];

export async function runGeneratedShapes({ io, session, source, entries, cp, h2, resources, label = 'generated-shapes' }) {
  const declared = generatedShapeSuites.map(row => row.file);
  assert.deepEqual(entries.filter(entry => entry.kind === 'generated-test').map(entry => entry.path).sort(), [...declared].sort(),
    'Complete generated shape suite inventory differs from the fixed sample contract');
  assert.deepEqual(files(join(source, testRoot)).map(path => relative(source, path)).sort(), [...declared].sort());
  const output = io.directory(label + '/classes');
  const testClasspath = [...cp.tests, h2, resources];
  await session.compile(label + '-compile', declared.map(path => join(source, path)), testClasspath, output);
  for (const [index, row] of generatedShapeSuites.entries()) {
    await session.jvm(label + '-' + (index + 1), ['-cp', [...testClasspath, output].join(delimiter),
      'org.scalatest.tools.Runner', '-R', output, '-oW', '-s', row.suite],
    { kind: 'suites', suites: [row.suite], tests: row.testNames.length, testNames: row.reporterNames ?? row.testNames });
  }
  return { passed: true, source, classOutput: output, suites: generatedShapeSuites,
    tests: generatedShapeSuites.reduce((total, row) => total + row.testNames.length, 0),
    qualification: 'generated shape smoke tests; not independent business/JDBC oracle' };
}

export async function runFrameNamingControl({ io, session, tools, h2, toolRoot, verifyProject }) {
  const label = 'frame-same-name', base = 'controls/' + label;
  const scaffold = join(toolRoot, 'scaffold/persistence-readside-project');
  const scaffoldFiles = files(scaffold), before = snapshot(scaffoldFiles);
  const config = JSON.parse(readFileSync(join(scaffold, 'truthsrc.project.json'), 'utf8'));
  const originalConfig = structuredClone(config);
  assert(!config.options.names.some(row => row.role === 'persistence-frame'), 'Scaffold must retain its unrenamed Frame baseline');
  const override = { ref: { context: 'inventory', kind: 'aggregate', owner: [], id: 'Warehouse' },
    role: 'persistence-frame', name: 'WarehousePersistence' };
  config.options.names.push(override);
  const restored = structuredClone(config); restored.options.names.pop();
  assert.deepEqual(restored, originalConfig, 'Only the technical persistence-frame naming option may change');
  // io is the verifier's already admitted, exclusive, outside-Git output. The
  // author and binding are byte copies; even the copied binding is never edited.
  for (const file of scaffoldFiles) {
    const name = relative(scaffold, file);
    io.write(base + '/author/' + name, name === 'truthsrc.project.json' ? JSON.stringify(config, null, 2) + '\n' : readFileSync(file));
  }
  const author = join(io.out, base, 'author'), project = join(author, 'truthsrc.project.json');
  const source = join(io.out, base, 'generated');
  const copiedInputs = files(author), copiedBefore = snapshot(copiedInputs);
  for (const file of scaffoldFiles.filter(path => path !== join(scaffold, 'truthsrc.project.json')))
    assert(readFileSync(file).equals(readFileSync(join(author, relative(scaffold, file)))), 'Author/binding copy must be byte-identical');
  const cliPath = join(toolRoot, 'lib/project/cli.mjs');
  const { captureProject, projectCli } = await import(pathToFileURL(cliPath).href);
  const captured = captureProject(project);
  assert.equal(captured.validation.hard.length, 0);
  assert.equal(captured.validation.roundtrip.ok, true);
  const compiled = await projectCli('compile-project', ['--project', project]);
  assert.equal(compiled.validation.hard.length, 0);
  assert.equal(compiled.validation.roundtrip.ok, true);
  const args = ['--project', project, '--out', source];
  const planned = await projectCli('generate-project', [...args, '--plan']);
  assert.equal(planned.applied, false);
  assert.equal(planned.plan.targetProfile, 'scala-cqrs-persistence-readside@1');
  const applied = await projectCli('generate-project', args);
  assert.equal(applied.applied, true);
  for (const entry of planned.plan.entries) assert.equal(readFileSync(join(source, entry.path), 'utf8'), entry.content);
  const verification = verifyProject({ project, out: source });
  assert.equal(verification.passed, true, JSON.stringify(verification.diagnostics));
  assert.equal((await projectCli('generate-project', [...args, '--update'])).result.written, 0);
  assert.deepEqual(snapshot(copiedInputs), copiedBefore, 'Renaming control changed its copied author or binding');
  assert.deepEqual(snapshot(files(scaffold)), before, 'Renaming control changed the original scaffold');
  const framePath = 'modules/glue/src/main/protobuf/warehouse_persistence_frame.proto';
  const frame = planned.plan.entries.find(entry => entry.path === framePath);
  assert(frame && /^message WarehousePersistence \{/m.test(frame.content), 'Public writer did not apply the persistence-frame naming role');
  assert.match(readFileSync(join(source, 'modules/glue/src/main/scala/example/inventory/infrastructure/persistence/WarehousePersistence.scala'), 'utf8'),
    /^object WarehousePersistence \{/m, 'The persistence object must keep the SAME simple name');
  io.json(base + '/writer-plan.json', planned.plan);
  io.json(base + '/source-inputs.json', { original: before, copied: copiedBefore, override });
  const generatedBefore = snapshot(files(source));
  // Separate outputs/classpaths: the default Frame/PB/glue/oracle classes cannot
  // rescue this compile. Both names must resolve from the renamed public output.
  const classes = Object.fromEntries(['kernel', 'pb', 'glue', 'oracle'].map(key => [key, io.directory(base + '/classes/' + key)]));
  const cp = warehouseClasspaths(tools, classes);
  const proto = join(source, 'modules/glue/src/main/protobuf');
  const managed = io.directory(base + '/managed');
  await session.generate(label + '-proto', proto, files(proto), managed);
  await session.compile(label + '-kernel', files(join(source, 'modules/kernel/src/main/scala')), cp.kernel, classes.kernel);
  await session.compile(label + '-protobuf', files(managed).filter(path => path.endsWith('.scala')), cp.pb, classes.pb);
  await session.compile(label + '-glue', files(join(source, 'modules/glue/src/main/scala')), [...cp.glue, h2], classes.glue);
  const witness = io.write(base + '/RenamedFrameWitness.scala', `package positive
object RenamedFrameWitness {
  val state = example.inventory.domain.WarehouseState.empty
  val frame: example.inventory.persistence.protobuf.WarehousePersistence =
    example.inventory.infrastructure.persistence.WarehousePersistence.encodeState(state)
  val parsed: example.inventory.persistence.protobuf.WarehousePersistence =
    example.inventory.persistence.protobuf.WarehousePersistence.parseFrom(frame.toByteArray)
  val adapter: akka.persistence.typed.EventAdapter[example.inventory.domain.WarehouseProtocol.Event, example.inventory.persistence.protobuf.WarehousePersistence] =
    new example.inventory.infrastructure.persistence.WarehouseEventAdapter
}
`);
  await session.compile(label + '-abi-positive', [witness], [...cp.production, h2], io.directory(base + '/abi-classes'));
  const resources = join(source, 'modules/glue/src/main/resources');
  const shapes = await runGeneratedShapes({ io, session, source, entries: planned.plan.entries, cp, h2, resources, label: label + '-shapes' });
  assert.deepEqual(snapshot(files(source)), generatedBefore, 'Publicly generated rename output was modified');
  assert.deepEqual(snapshot(files(scaffold)), before, 'Original scaffold drifted during naming control');
  assert.deepEqual(snapshot(copiedInputs), copiedBefore, 'Copied author/binding drifted during naming control');
  const result = { passed: true, override, project, source, toolRoot, publicEntry: cliPath,
    validation: captured.validation, verification, writerPlan: join(io.out, base, 'writer-plan.json'),
    generatedFiles: generatedBefore, generatedShapes: shapes, freshClasspaths: true,
    authorAndBindingByteCopies: true, postprocessedGeneratedSources: false };
  io.json(base + '/result.json', result);
  return result;
}
