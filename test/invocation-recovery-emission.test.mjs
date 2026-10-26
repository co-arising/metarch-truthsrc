import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emitInvocationHostFiles } from '../generators/saga-dsl/emit-invocation-host.mjs';
import { emitInvocationSpecFiles } from '../generators/saga-dsl/emit-invocation-spec.mjs';

const model = {
  pipelineId: 'fab-split-child-merge', hostName: 'FabCompositionHost', pkg: 'fixture.composition',
  pidPrefix: 'fab-composition', steps: [{ id: 'split', kind: 'invokeSaga' },
    { id: 'await-child', kind: 'awaitChildRun' }, { id: 'merge', kind: 'invokeSaga' }],
  split: { pkg: 'fixture.split', entryName: 'FabSplitSagaEntry', moduleObj: 'FabSplitSagaModule' },
  merge: { pkg: 'fixture.merge', entryName: 'FabMergeSagaEntry', moduleObj: 'FabMergeSagaModule' },
  child: { planId: 'fab-child-process', planObj: 'FabChildProcessPlan', stateType: 'ChildState',
    stageType: 'ChildStage', pidPrefix: 'fab-child', pkg: 'fixture.composition', stages: ['receive', 'process', 'finalize'],
    stateFields: [{ name: 'wafers', type: 'Vector[String]' }, { name: 'processedCount', type: 'Int' }] },
};

test('merge opens its durable intent and never falls back to the original wafers', () => {
  const host = emitInvocationHostFiles(model).find(f => f.name === 'FabCompositionHost.scala').content;
  const childComplete = host.slice(host.indexOf('case ChildObserved(Some'), host.indexOf('case ChildObserved(None)'));
  assert.ok(childComplete.includes('ctx.self ! OpenStep(MergeStep)'));
  assert.ok(!childComplete.includes('startSagaStep(MergeStep'));
  assert.ok(host.includes('state.checkpoints(AwaitStep).outputs("wafers")'));
  assert.ok(!host.includes('getOrElse(st.wafers)'));
  assert.ok(host.includes('val txid = state.intents(stepId)'));
});

test('test-only local effect gate precedes Start and StartRun without extending the wire', () => {
  const host = emitInvocationHostFiles(model)[0].content;
  assert.ok(host.includes('private[composition] def behaviorForTest'));
  assert.ok(host.includes('occurrence, TestHooks())'));
  assert.ok(host.includes('beforeEffect: (String, String) => Boolean = (_, _) => true'));
  const saga = host.slice(host.indexOf('private def startSagaStep'), host.indexOf('private def pollSaga'));
  assert.ok(saga.indexOf('beforeEffect(stepId, txid)') < saga.indexOf('coordinator ! start'));
  const child = host.slice(host.indexOf('private def startChildStep'), host.indexOf('private def watchChild'));
  assert.ok(child.indexOf('beforeEffect(AwaitStep, runKey)') < child.indexOf('PersistentMonarch.StartRun'));
  const wire = host.slice(host.indexOf('sealed trait Command'), host.indexOf('sealed trait Event'));
  assert.ok(!wire.includes('beforeEffect') && !wire.includes('Gate'));
});

test('recovery tests use actual entry persistence ids and verified cross-batch prefixes', () => {
  const spec = emitInvocationSpecFiles(model)[0].content;
  assert.ok(spec.includes('fixture.split.FabSplitSagaEntry.persistenceId.id'));
  assert.ok(spec.includes('fixture.merge.FabMergeSagaEntry.persistenceId.id'));
  assert.ok(!spec.includes('strict-saga/FabSplitSagaModule'));
  for (const fact of ['whenTerminated.isCompleted', 'batch.from > keep', 'batch.to > keep',
    'getDeletedCount == 1L', 'getMatchedCount == 1L', 'getModifiedCount == 1L',
    'assertPrefix(uri, pid, keep, expected)', 'Some(3)', 'Some(5)', 'Some(2)',
    'P16_FIRST_START_NOT_SENT', 'StrictEvent.Started', 'durableEffects(uri, operation) == before']) {
    assert.ok(spec.includes(fact), `missing ${fact}`);
  }
  assert.ok(!spec.includes('$push') && !spec.includes('$slice') && !spec.includes('total - 2'));
  assert.ok(!/@[A-Z_]+@/.test(spec));
});

test('the recovery resource remains owned by this generator and deterministically emitted', () => {
  const source = readFileSync(new URL('../generators/saga-dsl/templates/composition-recovery.scala.tpl', import.meta.url), 'utf8');
  assert.ok(source.includes('OwnedUris.contains(uri)') && source.includes('snapshot would mask'));
  assert.deepEqual(emitInvocationSpecFiles(model), emitInvocationSpecFiles(model));
});

test('composition ownership uses a stable singleton and remotely serializable replies', () => {
  const host = emitInvocationHostFiles(model)[0].content;
  for (const fact of ['def spawnClusterSingleton(', 'ClusterSingleton(system).init(SingletonActor(',
    'getInstance("SHA-256")', 'extends CborSerializable', 'EventSourcedBehavior.lastSequenceNumber(ctx)',
    'hooks.stopped()', 'childWatch.foreach(_.shutdown())', 'operation does not match this persistence identity']) {
    assert.ok(host.includes(fact), `missing ${fact}`);
  }
  assert.ok(!host.includes('withStopMessage'));
  assert.ok(!host.slice(host.indexOf('sealed trait Command'), host.indexOf('sealed trait Event')).includes('TestHooks'));
});

test('physical migration emission preserves natural prefixes and actual owner observations', () => {
  const files = emitInvocationSpecFiles(model);
  const deployment = files.find(f => f.name === 'FixtureCompositionDeploymentSpec.scala').content;
  for (const fact of ['first-start', 'child-completed', 'successor recovered before old host PostStop',
    'owner.destroy()', 'owner.waitFor(45', 'processPid', 'MemberStatus.Up',
    'freeze(kit, uri, operation, mode, dir)', 'migration repeated completed split/child effects',
    'rawEvents(uri, hostPid(operation, "occ-1")) == prefix']) {
    assert.ok(deployment.includes(fact), `missing ${fact}`);
  }
  assert.ok(!deployment.includes('truncateJournal') && !deployment.includes('updateOne('));
  assert.ok(!/@[A-Z_]+@/.test(deployment));
});
