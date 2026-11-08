// Fixed mutation expectations for the shared oracle; never accept arbitrary exit 1.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';

const suite = 'example.inventory.persistencereadside.reference.PersistenceReadsideSpec';
const prefix = 'modules/glue/src/main/scala/example/inventory/infrastructure/';
const registrationTest = 'real SerializationExtension selects the finite registry and rejects versions roles manifests and malformed frames';
const controls = [
  { id: 'skip-version', file: prefix + 'persistence/WarehousePersistence.scala',
    from: 'frame.envelopeVersion == envelopeVersion', to: 'frame.envelopeVersion >= envelopeVersion',
    test: registrationTest, diagnostic: /ORACLE_VERSION_DISPATCH/ },
  { id: 'omit-index', file: prefix + 'readside/WarehouseReadsideHandler.scala',
    from: 'session.replaceReceipts(fixed.pid, fixed.resource, next.receipts)', to: '()',
    test: 'direct SQL proves event state receipt checkpoint atomicity and reserve progress', diagnostic: /ORACLE_INDEX_ATOMIC/ },
  { id: 'duplicate-write', file: prefix + 'readside/WarehouseReadsideHandler.scala',
    from: 'ProjectResult(fixed.sequenceNr, duplicate = true)',
    to: 'session.replaceReceipts(fixed.pid, fixed.resource, session.state(fixed.pid).get.state.receipts)\n        ProjectResult(fixed.sequenceNr, duplicate = true)',
    test: 'precommit failure rolls back all four tables and postcommit lost acknowledgement retries without writes', diagnostic: /ORACLE_DUPLICATE_NO_WRITE/ },
  { id: 'early-drain', file: prefix + 'readside/WarehouseReadsideRunner.scala',
    from: 'if (closed && pending == 0) shutdownResult.foreach', to: 'if (closed) shutdownResult.foreach',
    test: 'coalesced catchup drains already accepted later pages and preserves caller resources', diagnostic: /ORACLE_DRAIN_WAIT/ },
  // A single skipped handler guard is still rejected by the repository. Relax
  // all THREE continuity guards, not unrelated identity/transaction checks, so
  // the independent oracle must observe an actually accepted sequence 1 -> 3.
  { id: 'skip-gap', edits: [
    { file: prefix + 'readside/WarehouseReadsideHandler.scala',
      from: 'fixed.sequenceNr == Math.addExact(last, 1L)', to: 'fixed.sequenceNr >= Math.addExact(last, 1L)' },
    { file: prefix + 'readside/WarehouseReadsideRepository.scala',
      from: 'envelope.sequenceNr == Math.addExact(lastSequenceNr(envelope.pid), 1L)',
      to: 'envelope.sequenceNr >= Math.addExact(lastSequenceNr(envelope.pid), 1L)' },
    { file: prefix + 'readside/WarehouseReadsideRepository.scala',
      from: 'sequenceNr == Math.addExact(lastSequenceNr(pid), 1L)',
      to: 'sequenceNr >= Math.addExact(lastSequenceNr(pid), 1L)' },
  ], test: 'exact duplicate conflict gap and resource reassociation reject without advancing', diagnostic: /ORACLE_SEQUENCE_GAP/ },
];

export async function runPersistenceControls({ io, session, generated, cp, h2, resources, classes }) {
  const testClasspath = [...cp.tests, h2, resources, classes.oracle];
  const runOracle = (label, classpath, test, diagnostic) => session.jvm(label,
    ['-cp', classpath.join(delimiter), 'org.scalatest.tools.Runner', '-R', classes.oracle, '-oW', '-s', suite, '-t', test],
    diagnostic ? { kind: 'suite-rejection', suite, testNames: [test], failedTestName: test, diagnostic } :
      { kind: 'suites', suites: [suite], tests: 1, testNames: [test] });
  for (const control of controls) {
    await runOracle(control.id + '-positive', testClasspath, control.test);
    const changed = new Map();
    for (const edit of control.edits ?? [control]) {
      const original = changed.get(edit.file) ?? readFileSync(join(generated.out, edit.file), 'utf8');
      assert.equal(original.split(edit.from).length - 1, 1, 'one exact mutation site: ' + control.id + '/' + edit.file);
      changed.set(edit.file, original.replace(edit.from, edit.to));
    }
    const sources = [...changed].map(([file, text]) => io.write('controls/' + control.id + '/' + file, text));
    const output = io.directory('controls/' + control.id + '/classes');
    await session.compile(control.id + '-compile', sources, [...cp.production, h2], output);
    await runOracle(control.id + '-negative', [output, ...testClasspath], control.test, control.diagnostic);
  }

  // Config is a runtime registration contract, not a Scala type. Keep every
  // production class and oracle unchanged; omit only the candidate resource root.
  // Try + the explicit registration assertion in the SAME original test makes
  // an unbound Frame a precise oracle failure, not an arbitrary Akka exception.
  await runOracle('missing-serializer-positive', testClasspath, registrationTest);
  const unregisteredClasspath = [...cp.tests, h2, classes.oracle];
  assert(!unregisteredClasspath.includes(resources));
  await runOracle('missing-serializer-negative', unregisteredClasspath, registrationTest, /ORACLE_SERIALIZER_REGISTRATION/);

  // Constructive companion of the wrong-adapter rejection. No ???, null,
  // unchecked casts or missing implementation can make this positive compile.
  const adapterSource = eventType => `package negative
object WrongAdapter {
  val adapter: akka.persistence.typed.EventAdapter[example.inventory.domain.WarehouseProtocol.${eventType}, example.inventory.persistence.protobuf.Frame] =
    new example.inventory.infrastructure.persistence.WarehouseEventAdapter
  val snapshot: akka.persistence.typed.SnapshotAdapter[example.inventory.domain.WarehouseState] =
    new example.inventory.infrastructure.persistence.WarehouseSnapshotAdapter
  val hosts = new example.inventory.domain.ports.WarehouseComputations {
    def reservationIdentity(tx: example.inventory.domain.values.TxId, warehouse: example.inventory.domain.values.WarehouseId,
        sku: example.inventory.domain.values.SkuId, quantity: Long): example.inventory.domain.values.ReservationId =
      example.inventory.domain.values.ReservationId("explicit-compiler-host")
  }
  def behavior(pid: akka.persistence.typed.PersistenceId): akka.actor.typed.Behavior[example.inventory.application.aggregates.WarehouseActorProtocol.Command] =
    example.inventory.infrastructure.persistence.WarehousePersistenceFactory.create(pid, example.inventory.domain.WarehouseState.empty, hosts)
}
`;
  const validAdapter = io.write('controls/wrong-adapter/positive/WrongAdapter.scala', adapterSource('Event'));
  await session.compile('wrong-adapter-positive', [validAdapter], [...cp.production, h2], io.directory('controls/wrong-adapter/positive/classes'));
  const wrongAdapter = io.write('controls/wrong-adapter/negative/WrongAdapter.scala', adapterSource('Command'));
  await session.compile('wrong-adapter-negative', [wrongAdapter], [...cp.production, h2], io.directory('controls/wrong-adapter/negative/classes'),
    { kind: 'compiler-rejection', file: 'WrongAdapter.scala', symbol: 'EventAdapter', diagnostics: [/type mismatch/, /WarehouseEventAdapter/] });

  const kernelOnly = io.write('controls/kernel-leak/KernelOnly.scala', `package positive
object KernelOnly {
  val state: example.inventory.domain.WarehouseState = example.inventory.domain.WarehouseState(
    Map(example.inventory.domain.values.TxId("kernel-only") -> "retained"))
}
`);
  const kernelClasspath = [...cp.kernel, classes.kernel];
  await session.compile('kernel-only-positive', [kernelOnly], kernelClasspath, io.directory('controls/kernel-leak/kernel-positive/classes'));
  const kernelLeak = io.write('controls/kernel-leak/KernelLeak.scala', `package negative
object KernelLeak {
  val adapter = new example.inventory.infrastructure.persistence.WarehouseEventAdapter
}
`);
  // Identical source compiles with the glue role but must fail in the kernel
  // role. Thus a typo or absent candidate adapter cannot count as seam isolation.
  await session.compile('kernel-leak-positive', [kernelLeak], [...cp.production, h2], io.directory('controls/kernel-leak/glue-positive/classes'));
  await session.compile('kernel-leak-negative', [kernelLeak], kernelClasspath, io.directory('controls/kernel-leak/negative/classes'),
    { kind: 'compiler-rejection', file: 'KernelLeak.scala', symbol: 'infrastructure', diagnostics: [/object infrastructure is not a member of package example.inventory/] });
  return { passed: true, runtimeMutationControls: controls.map(control => control.id),
    runtimeExpectations: controls.map(control => ({ id: control.id, suite, test: control.test, diagnostic: control.diagnostic.source })),
    registrationControl: { id: 'missing-serializer', suite, test: registrationTest, diagnostic: 'ORACLE_SERIALIZER_REGISTRATION', omittedResourceRoot: resources },
    compilerPositiveControls: ['wrong-adapter', 'kernel-only', 'kernel-leak'], compilerControls: ['wrong-adapter', 'kernel-leak'],
    positiveRuntimeTests: controls.length + 1, expectedRuntimeRejections: controls.length + 1,
    coverage: { versionDispatch: 'skip-version', gap: 'skip-gap', checkpointWithoutIndex: 'omit-index',
      duplicateSideEffects: 'duplicate-write', shutdownDrain: 'early-drain', serializerRegistration: 'missing-serializer' } };
}
