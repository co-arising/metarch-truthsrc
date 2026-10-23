import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileSagas } from '../lib/saga/compile.mjs';
import { lowerSagaRuntimeBinding, lowerSagaRuntimeBindingV2 } from '../lib/saga/runtime-binding.mjs';
import { sagaContract, REQUIRED_CAPABILITIES } from './fixtures/saga-contract.mjs';
const PHASES = ['prepare', 'commit', 'compensate'];
const TARGET = {
  artifact: 'net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT',
  artifactStatus: 'unpublished-candidate', apiMode: 'strict',
  definitionApi: 'net.imadz.infra.saga.strict.StrictSagaDefinition',
  coordinatorApi: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
  executionMode: 'static-serial-allTCC',
  capabilities: ['positive-int-definition-version', 'static-participants', 'serial-all-tcc',
    'fresh-canonical-args', 'pinned-args-codec', 'pinned-phase-receipt-codecs', 'minor-unit-string-money'],
};
function runtimeDocument(canonical, binding, runtimeVersion = 17) {
  return { schemaVersion: 'truthsrc.saga-runtime-binding/v1', target: structuredClone(TARGET),
    sagas: canonical.sagas.map(definition => {
      const technical = binding.sagas.find(row => row.sagaId === definition.id);
      return { sagaId: definition.id, definitionVersion: definition.version, runtimeVersion,
        argsCodec: { id: technical.codec.id, version: technical.codec.version, runtimeVersion: 23 },
        receiptCodecs: technical.steps.flatMap(step => PHASES.filter(phase => step.phases[phase].kind === 'command')
          .map((phase, ordinal) => ({ stepId: step.stepId, phase, id: `Explicit-${phase}-receipt`,
            version: step.phases[phase].receipt.version, runtimeVersion: 31 + ordinal }))) };
    }) };
}
// Original independent one-resource synthetic producer. Not the real transfer
// with a resource or receipt flow removed. Only test-owned plain JSON data.
function minimal() {
  const field = (name, dataType) => ({ name, dataType, origin: 'BUSINESS_INPUT' });
  const ref = name => ({ aggregate: 'Account', name });
  const resultKinds = ['succeeded', 'rejected-before-effects', 'compensated', 'recovery-required', 'outcome-unknown'];
  const args = [{ slot: 'from', type: 'AccountId' }, { slot: 'amount', type: 'Money' }];
  const commands = [], events = [], phases = {}, technicalPhases = {};
  const receiptIdentity = ['txid', 'definition-version', 'args-digest', 'participant', 'resource', 'step', 'phase'];
  for (const phase of PHASES) {
    const name = `${phase}-source`;
    const bindings = [{ slot: 'txid', ref: 'txid', type: 'TxId' }, { slot: 'resource', ref: 'args:from', type: 'AccountId' },
      ...(phase === 'prepare' ? [{ slot: 'amount', ref: 'args:amount', type: 'Money' }] : [])];
    const outputs = phase === 'prepare' ? [{ slot: 'reservation', type: 'ReservationId' }]
      : phase === 'commit' ? [{ slot: 'receiptId', type: 'TxId' }] : [];
    commands.push({ name, parameters: bindings.map(({ slot, type }) => field(slot, type)), produces: [`${name}-confirmed`] });
    events.push({ name: `${name}-confirmed`, payloads: outputs.map(({ slot, type }) => field(slot, type)) });
    phases[phase] = { kind: 'command', commandRef: ref(name), bindings, outputs };
    technicalPhases[phase] = { kind: 'command', port: 'fixture.PhasePort', commandMapper: 'fixture.CommandMapper',
      confirmation: { kind: 'durable-receipt', eventRef: ref(`${name}-confirmed`), mapper: 'fixture.ConfirmationMapper',
        outputs: outputs.map(({ slot, type }) => ({ slot, ref: `receipt:${slot}`, type })) },
      query: { mapper: 'fixture.QueryMapper', mode: 'read-only', identity: [...receiptIdentity], resultKinds: ['confirmed', 'not-executed', 'unknown'] },
      receipt: { mapper: 'fixture.ReceiptMapper', version: 'receipt-v1', durable: true, identity: [...receiptIdentity],
        payloadCompatibility: 'exact', evidence: 'reservation-decision-effect-reconciliation' },
      idempotency: { mapper: 'fixture.IdempotencyMapper', identity: ['txid', 'definition-version', 'participant', 'resource', 'step', 'phase'],
        payloadConflict: 'reject', attemptIdentity: 'excluded' } };
  }
  const sourceFields = [field('operationId', 'OperationId'), ...args.map(({ slot, type }) => field(slot, type))];
  commands.push({ name: 'StartSingleResource', parameters: sourceFields, produces: ['SingleResourceRequested'] });
  events.push({ name: 'SingleResourceRequested', payloads: sourceFields });
  for (const kind of resultKinds) events.push({ name: `result-${kind}`, payloads: [field('txid', 'TxId')] });
  const payload = { schemaVersion: 'truthsrc.saga/v1', purpose: 'Synthetic one-resource adapter shape only',
    invariants: ['Exact minor units retained; business invariant enforcement remains unverified'], transactionIdType: 'TxId', args,
    participants: [{ id: 'source', aggregate: 'Account', resourceRef: { ref: 'args:from', type: 'AccountId' } }],
    groups: [{ id: 1, dependsOn: [] }], steps: [{ id: 'reserve-source', participant: 'source', group: 1, phases }],
    resilience: { maxAttempts: 1, phaseTimeoutMs: 1000, queryTimeoutMs: 1000, backoffMs: 0, totalTimeoutMs: 5000 },
    safety: { commitDecision: 'durable-before-commit', abortDecision: 'durable-before-compensate', afterCommit: 'forward-recovery',
      unknown: 'reconcile-before-resume', compensation: 'confirmed-reservations', cancelBeforePrepare: 'empty-release-and-fence',
      retryIdentity: 'stable-operation', manualRecovery: 'authorized-reconciliation-evidence' },
    admission: { maxParticipants: 1, maxInFlight: 1, maxItemsPerChunk: 64, manifest: { mode: 'static', durable: true } },
    triggers: ['command', 'event'].map(kind => ({ id: `from-${kind}`, kind,
      sourceRef: ref(kind === 'command' ? 'StartSingleResource' : 'SingleResourceRequested'),
      argsMapping: args.map(({ slot, type }) => ({ slot, ref: `source:${slot}`, type })),
      idempotency: { ref: 'source:operationId', type: 'OperationId', scope: 'saga-version', conflict: 'reject-different-args' } })),
    resultKinds, completions: resultKinds.map(kind => ({ kind, eventRef: ref(`result-${kind}`), bindings: [{ slot: 'txid', ref: 'txid', type: 'TxId' }] })) };
  const canonical = { schemaVersion: 'truthsrc/v1', workshop: 'Independent one-resource synthetic contract', sessions: [],
    aggregates: [{ name: 'Account', identifier: field('id', 'AccountId'), commands, events }],
    sagas: [{ id: 'single-resource-contract', name: 'Synthetic one resource', seq: 0, version: 'v1', payload }] };
  const binding = { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [{ sagaId: 'single-resource-contract', version: 'v1',
    module: 'fixture.SagaModule', engine: { artifact: TARGET.artifact, apiMode: 'strict', entrypoint: 'fixture.StrictSagaEntry', capabilities: { required: [...REQUIRED_CAPABILITIES] } },
    codec: { id: 'ArgsCodec', version: 'codec-v1', compatibleVersions: ['codec-v1'], mapper: 'fixture.ArgsCodec' },
    types: ['TxId', 'OperationId', 'AccountId', 'ReservationId'].map(id => ({ id, canonicalType: id, implementation: `fixture.types.${id}`, kind: 'id', minLength: 1, maxLength: 128 }))
      .concat([{ id: 'Money', canonicalType: 'Money', implementation: 'fixture.types.Money', kind: 'money', currency: 'ISO-4217', amountEncoding: 'minor-unit-string', scale: 2, precision: 38, codec: 'fixture.ExactMoneyCodec' }]),
    participants: [{ participantId: 'source', addressing: { resolver: 'fixture.sourceResolver', aggregate: 'Account', resourceType: 'AccountId', mode: 'exact-resource' } }],
    steps: [{ stepId: 'reserve-source', phases: technicalPhases }],
    triggerMappers: payload.triggers.map(({ id }) => ({ triggerId: id, argsMapper: 'fixture.TriggerArgsMapper', idempotencyMapper: 'fixture.TriggerIdempotencyMapper' })),
    completionMappers: resultKinds.map(kind => ({ kind, mapper: 'fixture.CompletionMapper' })) }] };
  return { canonical, binding, runtimeBinding: runtimeDocument(canonical, binding) };
}
const stable = x => Array.isArray(x) ? x.map(stable) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
const semanticDigest = x => 'sha256:' + createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function success(input) {
  const actual = compileSagas(input.canonical, input.binding);
  assert.deepEqual(actual.diagnostics, []); assert.ok(actual.ir);
  const result = lowerSagaRuntimeBindingV2({ ...input, ir: actual.ir });
  assert.deepEqual(result.diagnostics, []); assert.ok(result.ir); return result;
}
function failure(input, code) {
  const r = lowerSagaRuntimeBindingV2(input);
  assert.equal(r.ir, null); assert.equal(r.plan, null); assert.ok(r.diagnostics.length);
  if (code) assert.ok(r.diagnostics.some(x => x.code === code), JSON.stringify(r.diagnostics));
}
test('v2 live closure exact material and projections retain all independent pins without certification', () => {
  const input = minimal(), original = structuredClone(input), { ir, plan } = success(input), s = ir.sagas[0];
  assert.deepEqual(input, original); assert.notEqual(ir, plan); assert.deepEqual(ir, plan);
  assert.equal(ir.schemaVersion, 'truthsrc.saga-runtime-contract/v2');
  assert.deepEqual(s.runtimeBinding, { target: input.runtimeBinding.target, saga: input.runtimeBinding.sagas[0] });
  assert.equal(s.definitionDigest, semanticDigest({ ...s.contract, runtimeBinding: s.runtimeBinding }));
  assert.equal(s.runnable, false); assert.equal(ir.runnable, false); assert.equal(s.runtimeBindingVerified, false);
  assert.ok(s.blocked.includes('scala-ast-adapter-missing'));
});
test('three original receipt orders carry exact distinct digests, never permutation fallback', () => {
  const a = minimal(), b = minimal(), c = minimal(); b.runtimeBinding.sagas[0].receiptCodecs.reverse();
  c.runtimeBinding.sagas[0].receiptCodecs.push(c.runtimeBinding.sagas[0].receiptCodecs.shift());
  const results = [a,b,c].map(x => success(x).ir.sagas[0]);
  assert.equal(new Set(results.map(x => x.definitionDigest)).size,3);
  results.forEach((s,i) => assert.deepEqual(s.runtimeBinding.saga.receiptCodecs,[a,b,c][i].runtimeBinding.sagas[0].receiptCodecs));
  assert.deepEqual(results[0].participants,results[1].participants);
});
test('second actual compiler-closed receipt pin set retains independent names and runtime versions', () => {
  const a=minimal(), b=minimal(), p=b.runtimeBinding.sagas[0];
  p.runtimeVersion=107;p.argsCodec.runtimeVersion=109;
  p.receiptCodecs.forEach((c,i)=>{c.id=`Different-${c.phase}-codec`;c.runtimeVersion=113+i;});
  const original=success(a).ir.sagas[0], second=success(b).ir.sagas[0];
  assert.deepEqual(second.runtimeBinding.saga,p);assert.notEqual(original.definitionDigest,second.definitionDigest);
  assert.deepEqual(PHASES.map(ph=>second.participants[0].phases[ph].runtimeCodec.version),[113,114,115]);
});
test('v1 result shape and digest and ir-plan identity stay compatible', () => {
  const input = minimal(), old = lowerSagaRuntimeBinding(input), fresh = success(input);
  assert.equal(old.ir,old.plan); assert.equal(old.ir.schemaVersion,'truthsrc.saga-runtime-contract/v1');
  assert.equal(Object.hasOwn(old.ir.sagas[0],'runtimeBinding'),false);
  assert.equal(old.ir.sagas[0].definitionDigest,fresh.ir.sagas[0].definitionDigest);
});
test('v2 output has no mutable JSON aliases with inputs, plan or another output field', () => {
  const input = minimal(), {ir,plan}=success(input), snapshot=structuredClone(ir), planSnapshot=structuredClone(plan);
  input.canonical.sagas[0].payload.purpose='changed';input.binding.sagas[0].codec.mapper='changed';
  input.runtimeBinding.target.capabilities.reverse();input.runtimeBinding.sagas[0].receiptCodecs.reverse();
  assert.deepEqual(ir,snapshot); const s=ir.sagas[0];
  s.runtimeBinding.saga.receiptCodecs[0].runtimeVersion=999;
  s.contract.definition.payload.args[0].type='Other';
  s.contract.binding.codec.mapper='Other';s.runtimeBinding.target.capabilities.reverse();
  assert.deepEqual(s.args,snapshot.sagas[0].args);assert.deepEqual(ir.target,snapshot.target);assert.deepEqual(plan,planSnapshot);
});
test('original target capability order is retained and covered, not defaulted', () => {
  const a=minimal(), b=minimal();b.runtimeBinding.target.capabilities.reverse();
  const one=success(a).ir,two=success(b).ir;
  assert.deepEqual(two.target,b.runtimeBinding.target);assert.deepEqual(two.sagas[0].runtimeBinding.target,b.runtimeBinding.target);
  assert.notEqual(one.sagas[0].definitionDigest,two.sagas[0].definitionDigest);
});
for(const [name,mutate] of [
 ['unknown context',x=>{x.plan={};}],['unknown mapping',x=>{x.runtimeBinding.sagas[0].extra=true;}],
 ['document version',x=>{x.runtimeBinding.schemaVersion='truthsrc.saga-runtime-binding/v2';}],
 ['runtime string',x=>{x.runtimeBinding.sagas[0].runtimeVersion='17';}],
 ['runtime zero',x=>{x.runtimeBinding.sagas[0].runtimeVersion=0;}],
 ['runtime overflow',x=>{x.runtimeBinding.sagas[0].runtimeVersion=2147483648;}],
 ['missing args pin',x=>{delete x.runtimeBinding.sagas[0].argsCodec;}],
 ['wrong saga ID',x=>{x.runtimeBinding.sagas[0].sagaId='Other';}],
 ['wrong definition version',x=>{x.runtimeBinding.sagas[0].definitionVersion='v2';}],
 ['numeric business version',x=>{x.canonical.sagas[0].version=1;}],
 ['args ID drift',x=>{x.runtimeBinding.sagas[0].argsCodec.id='Other';}],
 ['args version drift',x=>{x.runtimeBinding.sagas[0].argsCodec.version='codec-v2';}],
 ['args runtime float',x=>{x.runtimeBinding.sagas[0].argsCodec.runtimeVersion=2.5;}],
 ['missing receipt',x=>{x.runtimeBinding.sagas[0].receiptCodecs.pop();}],
 ['duplicate receipt',x=>{x.runtimeBinding.sagas[0].receiptCodecs.push(structuredClone(x.runtimeBinding.sagas[0].receiptCodecs[0]));}],
 ['orphan receipt',x=>{x.runtimeBinding.sagas[0].receiptCodecs[0].stepId='Missing';}],
 ['receipt version drift',x=>{x.runtimeBinding.sagas[0].receiptCodecs[0].version='receipt-v2';}],
 ['receipt runtime type',x=>{x.runtimeBinding.sagas[0].receiptCodecs[0].runtimeVersion='31';}],
 ['unknown receipt phase',x=>{x.runtimeBinding.sagas[0].receiptCodecs[0].phase='other';}],
 ['invalid receipt ID',x=>{x.runtimeBinding.sagas[0].receiptCodecs[0].id='bad id';}],
 ['target wrong',x=>{x.runtimeBinding.target.artifact='net.imadz:saga-core:0.2';}],
 ['target unknown',x=>{x.runtimeBinding.target.extra=true;}],
 ['unknown definition',x=>{x.canonical.sagas[0].payload.extra=true;}],
 ['unknown binding',x=>{x.binding.sagas[0].extra=true;}],
 ['barrier groups',x=>{x.canonical.sagas[0].payload.groups.push({id:2,dependsOn:[1]});}],
 ['completion dataflow',x=>{x.canonical.sagas[0].payload.completions[0].bindings[0].ref='step:reserve-source:prepare:reservation';}],
]) test('v2 failclosed '+name,()=>{const x=minimal();mutate(x);failure(x);});
for(const [name,mutate] of [
 ['digest',x=>{x.ir.digest='0'.repeat(64);}],['sourceMap',x=>{x.ir.sourceMap=[];}],
 ['full contract',x=>{x.ir.sagas[0].definition.payload.purpose='tamper';}],
 ['readiness',x=>{x.ir.runnable=true;}],['missing field',x=>{delete x.ir.sagas[0].binding.codec;}],
]) test('v2 optional actual compiler IR mismatch '+name,()=>{const x=minimal();x.ir=compileSagas(x.canonical,x.binding).ir;mutate(x);failure(x,'RUNTIME_IR_MISMATCH');});
test('real two-account transfer remains intact and blocked for groups/dataflow in v2',()=>{
  const x=sagaContract();x.binding.sagas[0].engine.artifact=TARGET.artifact;
  const before=structuredClone(x);const runtimeBinding=runtimeDocument(x.canonical,x.binding);
  failure({...x,runtimeBinding},'RUNTIME_PARALLEL_UNSUPPORTED');assert.deepEqual(x,before);
  assert.equal(x.canonical.sagas[0].payload.participants.length,2);
});
test('accessors proxies cycles and toJSON are rejected without invocation',()=>{
  let calls=0;const x=minimal();Object.defineProperty(x,'extra',{enumerable:true,get(){calls++;return 1;}});failure(x,'RUNTIME_JSON');
  failure(new Proxy(minimal(),{get(){calls++;throw Error();}}),'RUNTIME_JSON');
  const cycle=minimal();cycle.extra=cycle;failure(cycle,'RUNTIME_JSON');
  const callback=minimal();callback.extra={toJSON(){calls++;return 1;}};failure(callback,'RUNTIME_JSON');assert.equal(calls,0);
});
