import test from 'node:test';
import assert from 'node:assert/strict';
import { domainKernelFixture } from './domain-kernel-fixture.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { refKey } from '../lib/domain-products/references.mjs';
import { buildModels as kernelModels } from '../generators/scala-cqrs-domain-kernel-v1/build-models.mjs';
import { serializationModel } from '../generators/scala-cqrs-domain-kernel-v1/serialization-model.mjs';
import { buildModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import { aggregateCoreFixture, aggregateCoreReference } from './aggregate-core-fixture.mjs';
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregateSourceEntry } from '../generators/scala-cqrs-domain-kernel-v1/entry.mjs';
import { rulesTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/rules.mjs';
import { commandHelpersTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/command-helpers.mjs';
import { eventHandlerTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/event-handler.mjs';
import { expressionSyntax } from '../generators/scala-cqrs-aggregate-core-v1/templates/expressions.mjs';
import { evaluateDecisions } from '../lib/domain-products/decision.mjs';
import { createAggregateCorePredicateVariant, admitAggregateCorePredicateVariant, aggregateCorePredicateCases } from './aggregate-core-predicate-variants.mjs';

// Detached canonical mutations below are synthetic semantic lowerer unit inputs,
// NOT actual-author integration/qualification. Physical-author variants use
// aggregate-core-predicate-variants.mjs and the normal compile/derive path.
function input(change = () => {}) {
  const f = domainKernelFixture(), canonical = structuredClone(f.canonical), config = structuredClone(f.config);
  change(canonical, config);
  let request;
  try { request = deriveProjectRequest(canonical, config, []); }
  catch (error) { error.message += ' ' + JSON.stringify(error.diagnostic); throw error; }
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  assert.ok(compilation.result);
  return { products: Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload])), options: config.options };
}
const declaration = (i, kind, id) => i.products['reference-layout'].declarations.find(d => d.ref.kind === kind && d.ref.id === id);
const bind = (i, kind, id, role, name) => i.options.names.push({ ref: declaration(i, kind, id).ref, role, name });
function frozen(value) {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  return [...(value.op ? [value] : []), ...Object.values(value).flatMap(nodes)];
}
const guard = (cond, index) => ({ kind: 'invariantRef', ref: `variant-${index}`, errCode: 'VARIANT', cond, onFail: 'reject' });
function expressionInput() {
  return input(c => {
    const a = c.aggregates[0], command = a.commands[0];
    c.valueObjects.find(v => v.name === 'WireRatio').context = 'counter';
    a.stateFields.push({ name: 'distances', dataType: 'Map[String, Distance]', default: [] });
    a.stateFields.push({ name: 'distance', dataType: 'Distance', default: { amount: '0', unit: 'm' } });
    command.parameters.push(...[
      ['text', 'WireRatio'], ['ratio', 'Ratio'], ['distance', 'Distance'], ['keys', 'Vector[String]'],
    ].map(([name, type]) => ({ name, type, origin: 'BUSINESS_INPUT' })));
    const expressions = [
      '!false || (true && param.id.nonEmpty)', 'param.id.contains("x")',
      'param.reading.maybe.isEmpty', 'param.reading.samples.nonEmpty',
      'param.reading.ratios.get(param.id).isEmpty', 'param.reading.ratios.keys.forall(_ == param.id)',
      'param.count + state.minimum >= param.count - state.maximum',
      'param.ratio + 0.10000000000000000000000000000000000000 > state.accepted - 0.10000000000000000000000000000000000000',
      'param.distance + state.distance >= param.distance - state.distance',
      'param.distance.amount + 1 >= state.distance.amount - 1',
      'param.reading.distance == state.reading.distance', 'param.reading.ratio == state.accepted',
      'param.distance.amount == state.distance.amount', 'param.ratio != 0.10000000000000000000000000000000000000',
      'param.text.value.nonEmpty', 'param.reading.ratios.contains(param.id)',
      'param.reading.ratios(param.id) >= param.ratio',
    ];
    command.guards = expressions.map(guard);
    command.guards.push(
      { ruleId: 'positive-ratio', errCode: 'P', onFail: 'reject', when: { form: 'money-positive', amount: 'param.reading.ratio' } },
      { ruleId: 'positive-distance', errCode: 'P', onFail: 'reject', when: { form: 'money-positive', amount: 'param.reading.distance' } },
      { ruleId: 'sufficient-ratio', errCode: 'S', onFail: 'reject', when: { form: 'money-sufficient', amount: 'param.reading.ratio', in: 'accepted' } },
      { ruleId: 'sufficient-unit', errCode: 'S', onFail: 'reject', when: { form: 'money-sufficient', amount: 'param.reading.distance', in: 'distances' } },
      { ruleId: 'covered', errCode: 'C', onFail: 'succeed-empty', when: { form: 'collection-covered', map: 'distances', collection: 'param.keys' } },
    );
  });
}
function foldInput() {
  return input(c => {
    const a = c.aggregates[0], event = a.events[0];
    for (const name of ['putMap', 'removeMap', 'putAllMap', 'removeAllMap'])
      a.stateFields.push({ name, dataType: 'Map[String, Ratio]', default: [] });
    a.stateFields.push({ name: 'distance', dataType: 'Distance', default: { amount: '0', unit: 'm' } });
    event.foldAssignments = [
      { slot: 'count', op: 'set', expr: 'state.minimum' },
      { slot: 'putMap', op: 'put', key: 'event.id', value: 'event.accepted' },
      { slot: 'removeMap', op: 'remove', key: 'event.id' },
      { slot: 'putAllMap', op: 'put-all', key: { form: 'literal', value: ['a', 'a', 'b'] }, value: 'event.accepted' },
      { slot: 'removeAllMap', op: 'remove-all', key: { form: 'literal', value: ['a', 'a'] } },
      { slot: 'distance', op: 'money-apply', delta: 'event.reading.distance', sign: -1 },
      { slot: 'minimum', op: 'integer-apply', delta: 'event.count', sign: 1 },
    ];
  });
}

test('real fixture builds immutable full aggregate model reusing unchanged family1 and serialization', () => {
  const i = input(), before = structuredClone(i), m = buildModels(i), k = kernelModels(i), a = m.aggregates[0];
  assert.deepEqual(i, before); frozen(m);
  assert.deepEqual(Object.keys(m).sort(), ['aggregates', 'artifacts', 'kernel', 'profile', 'serialization']);
  assert.equal(m.profile, 'scala-cqrs-aggregate-core@1');
  assert.deepEqual(m.kernel, k); assert.deepEqual(m.serialization, serializationModel(k));
  assert.deepEqual(a.base, k.aggregates[0]);
  assert.equal(a.rules.fqn, 'example.counter.domain.invariant.CounterRules');
  assert.equal(a.helpers.fqn, 'example.counter.domain.command.CounterCommandHelpers');
  assert.equal(a.eventHandler.fqn, 'example.counter.domain.entities.behaviors.CounterEventHandler');
  assert.equal(a.factory.package, 'example.counter.application.factories');
  const fresh = m.artifacts.filter(x => !k.artifacts.some(y => y.path === x.path));
  assert.equal(fresh.length, 9);
  assert.equal(fresh.filter(x => x.module === 'kernel').length, 3);
  assert.equal(fresh.filter(x => x.module === 'glue').length, 6);
  const all = new Set(m.artifacts.map(x => x.path));
  for (const artifact of fresh) {
    for (const key of ['ref','role','kind','module','name','identifier','package','fqn','path','sources','directDeps']) assert.ok(Object.hasOwn(artifact,key));
    artifact.directDeps.forEach(p => assert.ok(all.has(p), p));
    assert.ok(!artifact.directDeps.includes(artifact.path));
  }
  assert.equal(a.commands[0].ruleMethod.name, 'setCount');
  assert.equal(a.commands[0].emitMethod.name, 'emitSetCount');
  assert.deepEqual(a.commands[0].base, a.base.protocol.commands[0]);
  assert.deepEqual(a.commands[0].params, a.base.ruleParams.params[0]);
  assert.deepEqual(a.commands[0].guards[0].predicate.argument.field, a.base.protocol.commands[0].fields[0]);
  assert.deepEqual(a.events[0].assignments[0].field, a.base.state.fields[0]);
  assert.ok(!JSON.stringify(m).includes('def '));
});

test('all new roles and base field/FQN renames are resolved consistently and override complete affixes', () => {
  const i = input();
  for (const [role, name] of Object.entries({ rules:'Decisions', 'command-helpers':'Emissions', 'event-handler':'Replay', 'actor-protocol':'Envelope', aggregate:'Handler', factory:'Creator', bootstrap:'Start', 'actor-repository':'Directory', 'local-actor-repository':'Cache' })) bind(i,'aggregate','Counter',role,name);
  bind(i,'command','SetCount','rule-method','check'); bind(i,'command','SetCount','emit-method','construct');
  bind(i,'aggregate','Counter','protocol','Messages'); bind(i,'event','CountSet','event','Done');
  bind(i,'parameter','reading','member','p'); bind(i,'state-field','minimum','state-field','s');
  bind(i,'port','AcceptedRatio','host-method','calculate');
  const m = buildModels(i), a=m.aggregates[0], host=a.commands[0].emissions[0].slots[3].producer;
  assert.equal(a.rules.name,'Decisions'); assert.equal(a.repositoryImplementation.name,'Cache');
  assert.equal(a.commands[0].ruleMethod.fqn,a.rules.fqn+'.check');
  assert.equal(a.commands[0].emitMethod.fqn,a.helpers.fqn+'.construct');
  assert.equal(a.events[0].base.fqn,'example.counter.domain.Messages.Done');
  assert.equal(host.method.name,'calculate');
  assert.deepEqual(host.arguments.map(x => [x.root,x.field.accessor]),[['command','p'],['command','count'],['state','s']]);
});

test('host actual arguments stay ordered and each occurrence is retained, not dependency-memoized', () => {
  const i = input(c => {
    const e=c.aggregates[0].events[0];
    e.payloads.push({name:'again',type:'Ratio'});
    e.bindings.push({slot:'again',expr:structuredClone(e.bindings.find(x=>x.slot==='accepted').expr)});
    const h=c.hostComputations[0]; h.inputDependencies=[h.inputDependencies[2],h.inputDependencies[0],h.inputDependencies[1]];
  });
  const a=buildModels(i).aggregates[0], slots=a.commands[0].emissions[0].slots;
  const hosts=slots.filter(x=>x.producer.op==='host').map(x=>x.producer);
  assert.equal(hosts.length,2); assert.notEqual(hosts[0],hosts[1]);
  assert.deepEqual(hosts[0].arguments.map(x=>x.ref.id),['minimum','reading','count']);
  assert.deepEqual(hosts[0].method,a.base.computations.methods[0]);
  assert.deepEqual(hosts[1].arguments.map(x=>[x.root,x.ref,x.field]),hosts[0].arguments.map(x=>[x.root,x.ref,x.field]));
  assert.notDeepEqual(hosts[1].source,hosts[0].source);
});

test('current scalar/unit predicate admission is not narrowed; structural equality is separate from amount comparison', () => {
  const a=buildModels(expressionInput()).aggregates[0], predicates=a.commands[0].guards.map(g=>g.predicate);
  assert.equal(predicates[6].left.mode,'checked-long');
  assert.equal(predicates[7].mode,'exact-amount'); assert.equal(predicates[7].exact.descriptor.form,'decimal');
  assert.equal(predicates[8].exact.descriptor.form,'unit-decimal');
  assert.equal(predicates[9].left.type.name,'decimal'); assert.equal(predicates[9].left.mode,'exact');
  assert.equal(predicates[10].mode,'structural'); assert.equal(predicates[11].mode,'structural');
  assert.equal(predicates[12].mode,'exact-amount');
  assert.equal(predicates[12].left.numeric.carrier,'amount-member');
  assert.equal(predicates[12].left.numeric.exact.unitField.accessor,'unit');
  assert.equal(predicates[14].argument.field.accessor,'value');
  assert.equal(predicates[17].op,'exact-positive'); assert.equal(predicates[18].exact.descriptor.form,'unit-decimal');
  assert.equal(predicates[19].balance,'nominal'); assert.equal(predicates[20].balance,'unit-map');
  assert.equal(predicates[21].op,'collection-covered');
  assert.deepEqual(a.commands[0].guards.at(-1).onFalse,{kind:'succeed-empty'});
  assert.ok(nodes(predicates).some(n=>n.op==='map-lookup'));
});

test('all seven fold operations keep resolved RHS roots on pre-event state and duplicate keys intact', () => {
  const i=foldInput(), a=buildModels(i).aggregates[0], assignments=a.events[0].assignments;
  assert.deepEqual(assignments.map(x=>x.update.op),['set','put','remove','put-all','remove-all','money-apply','integer-apply']);
  assert.equal(assignments[0].update.value.root,'state'); assert.equal(assignments[0].update.value.field.name,'minimum');
  assert.equal(assignments[5].update.delta.root,undefined); assert.equal(assignments[5].update.delta.argument.root,'event');
  assert.equal(assignments[5].update.exact.descriptor.form,'unit-decimal');
  assert.equal(assignments[6].update.mode,'checked-long');
  assert.deepEqual(assignments[3].update.key.value,['a','a','b']);
  assert.ok(!nodes(assignments).some(n=>n.op==='host'||n.root==='command'));
});

test('guard and fold row order is determined by exact source ordinals, not carrier order', () => {
  const i=structuredClone(expressionInput()), j=structuredClone(foldInput()), expected=buildModels(i).aggregates[0].commands[0].guards;
  const expectedFolds=buildModels(j).aggregates[0].events[0].assignments;
  i.products['domain-decision'].commands[0].decisions.reverse();
  j.products['domain-folds'].events[0].assignments.reverse();
  assert.deepEqual(buildModels(i).aggregates[0].commands[0].guards,expected);
  assert.deepEqual(buildModels(j).aggregates[0].events[0].assignments,expectedFolds);
});

for (const [label, mutate] of [
  ['unknown option',i=>{i.options.impl=[];}],
  ['unknown role',i=>bind(i,'aggregate','Counter','mystery','Mystery')],
  ['wrong-kind new role',i=>bind(i,'command','SetCount','rules','Rules')],
  ['dangling role',i=>{bind(i,'aggregate','Counter','rules','Rules');i.options.names[0].ref.id='Missing';}],
  ['duplicate binding',i=>{bind(i,'aggregate','Counter','rules','Rules');i.options.names.push(i.options.names[0]);}],
  ['unused old port',i=>{i.options.names.push({ref:{context:'counter',kind:'port',owner:[],id:'Unused'},role:'host-method',name:'unused'});}],
  ['method decide collision',i=>bind(i,'command','SetCount','rule-method','decide')],
  ['method dispatch local shadow',i=>bind(i,'command','SetCount','rule-method','hosts')],
  ['method Object collision',i=>bind(i,'command','SetCount','emit-method','wait')],
  ['glue type collision',i=>{bind(i,'aggregate','Counter','aggregate','Same');bind(i,'aggregate','Counter','actor-protocol','Same');}],
  ['cross PB class collision',i=>{i.options.protobuf[0].package='example.counter.application.aggregates';i.options.protobuf[0].messages[0].name='CounterAggregate';}],
  ['PB generated container collision',i=>{i.options.protobuf[0].package='example.counter.application.aggregates';bind(i,'aggregate','Counter','aggregate','ReadingValueField4');}],
  ['PB descriptor collision',i=>{i.options.protobuf[0].package='example.counter.application.aggregates';bind(i,'aggregate','Counter','aggregate','CounterDomainProto');}],
  ['standard declaration shadow',i=>bind(i,'aggregate','Counter','rules','Either')],
  ['package root shadow',i=>bind(i,'command','SetCount','rule-method','example')],
  ['nonempty external',i=>{i.products['domain-dependencies'].externalProducers.push({event:i.products['domain-dependencies'].events[0].event});i.products['domain-external-events'].producers.push({event:i.products['domain-dependencies'].events[0].event});}],
  ['external mismatch',i=>{i.products['domain-external-events'].producers.push({});}],
  ['unproduced event',i=>{i.products['domain-dependencies'].commands[0].events=[];}],
  ['duplicate fold target',i=>{i.products['domain-folds'].events[0].assignments[1].target=i.products['domain-folds'].events[0].assignments[0].target;}],
  ['bad fold sign',i=>{const a=i.products['domain-folds'].events[0].assignments[1];a.update={op:'integer-apply',delta:a.update.value,sign:0};}],
  ['unsafe lookup',i=>{const d=i.products['domain-decision'].commands[0].decisions[0];d.predicate={op:'map-lookup',left:{op:'member',argument:{op:'ref',ref:declaration(i,'parameter','reading').ref},member:declaration(i,'member','ratios').ref},right:{op:'ref',ref:declaration(i,'parameter','id').ref}};}],
  ['wrong predicate type',i=>{i.products['domain-decision'].commands[0].decisions[0].predicate={op:'integer',value:'1'};}],
  ['raw predicate field',i=>{i.products['domain-decision'].commands[0].decisions[0].predicate.scala='true';}],
  ['missing guard dependencies',i=>{i.products['domain-decision'].commands[0].decisions[0].dependencies=[];}],
  ['missing used dependencies',i=>{i.products['domain-dependencies'].commands[0].usedDependencies=[];}],
  ['wrong event slot producer type',i=>{i.products['domain-dependencies'].commands[0].events[0].slots[0].producer={op:'literal',valueType:{form:'primitive',name:'integer'},value:'0'};}],
  ['missing fold coverage',i=>{i.products['domain-folds'].events=[];}],
  ['wrong guard ordinal',i=>{i.products['domain-decision'].commands[0].decisions[0].sourceOrdinal=2;}],
  ['wrong source ordinal pointer',i=>{i.products['domain-decision'].commands[0].decisions[0].source.pointer+='/fiction';}],
  ['null guard row',i=>{i.products['domain-decision'].commands[0].decisions[0]=null;}],
  ['extra assignment field',i=>{i.products['domain-folds'].events[0].assignments[0].implementation='raw';}],
  ['command in fold',i=>{i.products['domain-folds'].events[0].assignments[0].update.value.ref=declaration(i,'parameter','id').ref;}],
  ['host in fold',i=>{i.products['domain-folds'].events[0].assignments[3].update.value={op:'host',id:declaration(i,'port','AcceptedRatio').ref,version:'1'};}],
]) test(`reject ${label}`,()=>{
  const i=structuredClone(input());mutate(i);
  assert.throws(()=>buildModels(i),e=>typeof e.diagnostic?.code==='string');
});

test('malformed immutable input rejects without invoking getters',()=>{
  const i=input();let called=false;
  Object.defineProperty(i.options,'evil',{enumerable:true,get(){called=true;return 'evil';}});
  assert.throws(()=>buildModels(i));assert.equal(called,false);
});

function entry(a, model, artifact, template) {
  return aggregateSourceEntry({path:artifact.path,kind:artifact.kind,sources:artifact.sources,footprint:[],deps:artifact.directDeps},out=>template(a,model,out));
}
for (const [key, template] of [['rules',rulesTemplate],['helpers',commandHelpersTemplate],['eventHandler',eventHandlerTemplate]]) {
  test(`independent Warehouse ${key} body is reproduced, including ordered behavior and mapped UTF-8 source spans`,()=>{
    const f=aggregateCoreFixture(), model=buildModels({products:f.products,options:f.config.options}), a=model.aggregates[0];
    const result=entry(a,model,a[key],template);
    const body=result.content.slice(result.content.indexOf('\n')+1);
    assert.equal(body,readFileSync(join(aggregateCoreReference,a[key].path),'utf8'));
    assert.ok(result.codeMappings.length>0);
    for(const mapping of result.codeMappings) assert.equal(Buffer.from(result.content).subarray(mapping.span.start,mapping.span.end).toString('utf8'),mapping.span.text);
    if(key==='rules') assert.ok(result.codeMappings.some(m=>m.knowledgeKey.includes('/guards/')));
    if(key==='helpers') assert.ok(result.codeMappings.some(m=>m.knowledgeKey.includes('/bindings/')));
    if(key==='eventHandler') assert.ok(result.codeMappings.some(m=>m.knowledgeKey.includes('/foldAssignments/')));
    assert.ok(!result.content.includes('akka.'));assert.ok(!result.content.includes('@knowledge'));
  });
}

test('rendered admitted scalar/unit expressions are checked, unit-aware, structural where declared, and occurrence-safe',()=>{
  const model=buildModels(expressionInput()), a=model.aggregates[0], text=entry(a,model,a.rules,rulesTemplate).content;
  assert.ok(text.includes('java.lang.Math.addExact('));assert.ok(text.includes('java.lang.Math.subtractExact('));
  assert.ok(text.includes('checkedAmount('));assert.ok(text.includes('"exact units differ"'));
  assert.ok(text.includes('.distance == '));assert.ok(text.includes('.ratio == '));
  assert.ok(text.includes('&&'));assert.ok(text.includes('||'));assert.ok(text.includes('.forall('));
  assert.ok(!text.includes('toDouble'));assert.ok(!text.includes('Double'));assert.ok(!text.includes('catch'));
});

test('all fold syntax uses one final copy with pre-event state and evaluates put-all value once',()=>{
  const model=buildModels(foldInput()),a=model.aggregates[0],text=entry(a,model,a.eventHandler,eventHandlerTemplate).content;
  assert.equal(text.split('state.copy(').length-1,1);
  assert.ok(text.includes('count = state.minimum'));
  assert.ok(text.includes('java.lang.Math.addExact(state.minimum, value.count)'));
  assert.ok(text.includes('.minus(value.reading.distance)'));
  assert.ok(text.includes('.foldLeft('));assert.ok(text.includes('Vector("a", "a", "b")'));
  assert.ok(!text.includes('hosts'));assert.ok(!text.includes('command'));
});

test('value arithmetic scalar/unit, map-get, member and multi-event emission are admitted from the real author',()=>{
  const i=input((c,config)=>{
    const a=c.aggregates[0],e=a.events[0],command=a.commands[0];
    e.bindings.find(x=>x.slot==='count').expr={form:'add',left:'param.count',right:'state.minimum'};
    e.bindings.find(x=>x.slot==='accepted').expr={form:'subtract',left:e.bindings.find(x=>x.slot==='accepted').expr,right:'state.accepted'};
    e.payloads.push({name:'distance',type:'Distance'},{name:'maybeRatio',type:'Option[Ratio]'});
    e.bindings.push({slot:'distance',expr:{form:'add',left:'param.reading.distance',right:'state.reading.distance'}},
      {slot:'maybeRatio',expr:'param.reading.ratios[param.id]'});
    e.foldAssignments.find(x=>x.slot==='accepted').op='money-apply';
    e.foldAssignments.find(x=>x.slot==='accepted').delta='event.accepted';
    e.foldAssignments.find(x=>x.slot==='accepted').sign=1;
    delete e.foldAssignments.find(x=>x.slot==='accepted').expr;
    const next=structuredClone(e);next.name='CountEcho';next.foldAssignments=[];
    a.events.push(next);command.produces.push('CountEcho');
    config.options.protobuf[0].messages.push({ref:{context:'counter',kind:'event',owner:['Counter'],id:'CountEcho'},role:'event',name:'CounterCountEcho'});
  });
  const m=buildModels(i),a=m.aggregates[0],slots=a.commands[0].emissions[0].slots;
  assert.equal(a.commands[0].emissions.length,2);
  assert.equal(slots[1].producer.mode,'checked-long');
  assert.equal(slots[3].producer.exact.descriptor.form,'decimal');
  assert.equal(slots[4].producer.exact.descriptor.form,'unit-decimal');
  assert.equal(slots[5].producer.op,'map-get');
  assert.equal(a.events[0].assignments[3].update.exact.descriptor.form,'decimal');
  const text=entry(a,m,a.helpers,commandHelpersTemplate).content;
  assert.equal(text.split('hosts.acceptedRatio(').length-1,2);
  assert.ok(text.indexOf('CountSet(')<text.indexOf('CountEcho('));
  assert.ok(text.includes('.plus(state.reading.distance)'));assert.ok(text.includes('.minus(state.accepted)'));
  assert.ok(text.includes('command.reading.ratios.get(command.id)'));
});

test('presence dominance within short-circuit expressions remains product-controlled',()=>{
  const i=input(c=>{
    const command=c.aggregates[0].commands[0];
    command.parameters.push({name:'ratio',type:'Ratio',origin:'BUSINESS_INPUT'});
    command.guards=[guard('!param.reading.ratios.contains(param.id) || param.reading.ratios(param.id) >= param.ratio',0)];
  });
  const m=buildModels(i),a=m.aggregates[0],text=entry(a,m,a.rules,rulesTemplate).content;
  assert.equal(a.commands[0].guards[0].predicate.op,'or');
  assert.ok(text.indexOf('||')<text.indexOf('params.command.reading.ratios(params.command.id)'));
});

test('synthetic semantic unit: nested comparisons preserve their typed operand grouping', () => {
  const i = input(c => {
    c.aggregates[0].commands[0].guards = [
      '(true == false) == false', 'true == (false == false)',
      '(param.count < state.maximum) == true', 'true == (param.count < state.maximum)',
      'true == (true || false)', '(false || true) && true',
    ].map(guard);
  });
  const m = buildModels(i), predicates = m.aggregates[0].commands[0].guards.map(g => g.predicate);
  const syntax = expressionSyntax(m);
  assert.deepEqual(predicates.map(syntax.predicate), [
    '(true == false) == false', 'true == (false == false)',
    '(command.count < state.maximum) == true', 'true == (command.count < state.maximum)',
    'true == (true || false)', '((false || true) && true)',
  ]);
  const row = i.products['domain-decision'].commands[0];
  const values = new Map([[declaration(i, 'parameter', 'count').ref, '1'], [declaration(i, 'state-field', 'maximum').ref, '2']]);
  assert.deepEqual(evaluateDecisions(row, values, i.products['reference-layout'], { types: i.products['exact-value-types'] }, '4'), { kind: 'continue' });
});

test('synthetic semantic unit: empty all-equal skips the RHS as in the JS oracle', () => {
  const i = input(c => { c.aggregates[0].commands[0].guards = [guard('param.reading.ratios.keys.forall(_ == param.id)', 0)]; });
  const row = i.products['domain-decision'].commands[0], layout = i.products['reference-layout'];
  const values = new Map([[declaration(i, 'parameter', 'reading').ref, { ratios: new Map() }]]);
  assert.deepEqual(evaluateDecisions(row, values, layout, { types: i.products['exact-value-types'] }, '4'), { kind: 'continue' });
  values.set(declaration(i, 'parameter', 'reading').ref, { ratios: new Map([['x', '0.5']]) });
  assert.throws(() => evaluateDecisions(row, values, layout, { types: i.products['exact-value-types'] }, '4'), e => e.diagnostic?.code === 'DECISION_VALUE');
  const m = buildModels(i), text = expressionSyntax(m).predicate(m.aggregates[0].commands[0].guards[0].predicate);
  assert.match(text, /if \(coreItems\d+\.isEmpty\) true else \{ val coreExpected\d+ = command\.id;/);
  assert.equal(text.split('command.id').length - 1, 1);
});

test('synthetic semantic unit: admitted package-root shadow stays rooted in exact syntax', () => {
  const i = expressionInput();
  i.options.packages[0].package = 'params.counter';
  const m = buildModels(i), a = m.aggregates[0];
  const rules = entry(a, m, a.rules, rulesTemplate).content;
  assert.ok(rules.includes('_root_.params.counter.domain.values.Ratio.checkedAmount('));
  assert.ok(rules.includes('_root_.params.counter.domain.values.Distance.checkedAmount('));
});

test('synthetic semantic unit: uppercase methods and lowercase types remain outside admission', () => {
  for (const [kind, id, role, name] of [
    ['command', 'SetCount', 'rule-method', 'BigDecimal'],
    ['command', 'SetCount', 'emit-method', 'Vector'],
    ['aggregate', 'Counter', 'rules', 'example'],
  ]) {
    const i = input(); bind(i, kind, id, role, name);
    assert.throws(() => buildModels(i), e => e.diagnostic?.code === 'TARGET_SCALA_NAME');
  }
});

test('synthetic semantic unit: exact generated locals cannot capture an expression root', () => {
  const m = buildModels(expressionInput()), p = m.aggregates[0].commands[0].guards[12].predicate;
  const text = expressionSyntax(m, { command: 'coreLeft1', state: 'coreExact3' }).predicate(p);
  assert.ok(text.includes('coreLeft1.distance'));
  assert.ok(text.includes('coreExact3.distance'));
  assert.doesNotMatch(text, /val (coreLeft1|coreExact3) =/);
  assert.equal(text.split('coreLeft1.distance').length - 1, 1);
  assert.equal(text.split('coreExact3.distance').length - 1, 1);
});

test('synthetic semantic unit: nominal literals in helper/fold syntax use resolved rooted FQNs', () => {
  const i = input(c => {
    const e = c.aggregates[0].events[0];
    e.payloads.push({ name: 'literalRatio', type: 'Ratio' });
    e.bindings.push({ slot: 'literalRatio', expr: { form: 'literal', value: '0.12500000000000000000000000000000000000' } });
  });
  i.options.packages[0].package = 'state.counter';
  const m = buildModels(i), a = m.aggregates[0], text = entry(a, m, a.helpers, commandHelpersTemplate).content;
  assert.ok(text.includes('_root_.state.counter.domain.values.Ratio(BigDecimal('));
});

test('synthetic semantic unit: nested exact amount arithmetic checks each occurrence without re-reading a projection', () => {
  const i = input(c => {
    const a = c.aggregates[0];
    a.stateFields.push({ name: 'distance', dataType: 'Distance', default: { amount: '0', unit: 'm' } });
    a.commands[0].parameters.push({ name: 'distance', type: 'Distance', origin: 'BUSINESS_INPUT' });
    a.commands[0].guards = [guard('(param.distance.amount + 1) - 1 >= state.distance.amount', 0)];
  });
  const m = buildModels(i), p = m.aggregates[0].commands[0].guards[0].predicate;
  assert.equal(p.left.numeric.carrier, 'arithmetic');
  assert.equal(p.left.left.numeric.carrier, 'arithmetic');
  const text = expressionSyntax(m).predicate(p);
  assert.equal(text.split('command.distance').length - 1, 1);
  assert.equal(text.split('state.distance').length - 1, 1);
  assert.equal(text.split('.checkedAmount(').length - 1, 6);
  assert.equal(text.split('exact units differ').length - 1, 3);
  assert.ok(!text.includes('toDouble'));
});

test('physical predicate author copy validates, roundtrips, derives and models every fixed Scala probe without JVM', () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'aggregate-predicates-node-'));
  // Intentionally retained: this finite handoff forbids cleanup.
  const variant = createAggregateCorePredicateVariant(join(root, 'author'));
  const admitted = admitAggregateCorePredicateVariant(variant, join(root, 'roundtrip/domain-kernel'));
  assert.equal(admitted.roundtrip.ok, true);
  const f = admitted.fixture, m = buildModels({ products: f.products, options: f.config.options }), a = m.aggregates[0];
  assert.deepEqual(a.commands.map(c => c.base.name), ['SetCount', ...aggregateCorePredicateCases.map(c => c.name)]);
  assert.equal(a.commands.length, 17);
  assert.deepEqual(a.commands[0].guards[0].onFalse, { kind: 'succeed-empty' });
  const byName = name => a.commands.find(c => c.base.name === name);
  assert.equal(byName('CheckStructural').guards[0].predicate.mode, 'structural');
  assert.equal(byName('CheckAmountEquality').guards[0].predicate.mode, 'exact-amount');
  assert.equal(byName('CheckAmount').guards[0].predicate.left.left.numeric.exact.amountField.accessor, 'measure');
  assert.equal(byName('CheckText').guards[0].predicate.left.argument.argument.type.name, 'Text');
  assert.equal(byName('CheckNestedOptional').guards[0].predicate.left.type.element.form, 'optional');
  const rules = entry(a, m, a.rules, rulesTemplate).content;
  assert.ok(rules.includes('_root_.params.counter.domain.values.Ratio.checkedAmount('));
  assert.ok(rules.includes('params.command.expected == (params.command.count < params.state.maximum)'));
  assert.ok(rules.includes('params.command.reading.index(params.command.id)'));
  assert.ok(rules.includes('.measure'));
  assert.ok(!rules.includes('toDouble') && !rules.includes('catch'));
  const row = name => f.products['domain-decision'].commands.find(c => c.command.id === name);
  const valueMap = (name, state, command) => new Map([
    ...Object.entries(state).map(([id, value]) => [{ context: 'counter', kind: 'state-field', owner: ['Counter'], id }, value]),
    ...Object.entries(command).map(([id, value]) => [{ context: 'counter', kind: 'parameter', owner: ['Counter', name], id }, value]),
  ]);
  const oracle = (name, state, command) => evaluateDecisions(row(name), valueMap(name, state, command), f.products['reference-layout'], { types: f.products['exact-value-types'] }, '4');
  assert.deepEqual(oracle('CheckBoolean', {}, { first: true, second: false, third: false }), { kind: 'continue' });
  assert.deepEqual(oracle('CheckBoolean', {}, { first: false, second: true, third: false }), { kind: 'reject', errCode: 'BOOLEAN_PRECEDENCE' });
  assert.deepEqual(oracle('CheckLong', { left: '0', right: '0' }, { count: '-9223372036854775808' }), { kind: 'continue' });
  assert.deepEqual(oracle('CheckScalar', { ratioTotal: '0.32345678901234567890123456789012345678' }, { delta: '0.12345678901234567890123456789012345678' }), { kind: 'continue' });
  assert.deepEqual(oracle('CheckScalar', { ratioTotal: '0.32345678901234567890123456789012345679' }, { delta: '0.12345678901234567890123456789012345678' }), { kind: 'reject', errCode: 'SCALAR_MATH' });
  assert.deepEqual(oracle('CheckAllEqual', { guardKeys: new Map() }, {}), { kind: 'succeed-empty' });
  assert.throws(() => oracle('CheckAllEqual', { guardKeys: new Map([['x', 'v']]) }, {}), e => e.diagnostic?.code === 'DECISION_VALUE');
  assert.deepEqual(oracle('CheckMap', {}, { id: 'absent', reading: { ratios: new Map() } }), { kind: 'continue' });
});

test('independent predicate Scala oracle keeps sixteen fixed literal names; source is not execution evidence', () => {
  const text = readFileSync(new URL('./reference/aggregate-core-ops/AggregatePredicatesSpec.scala', import.meta.url), 'utf8');
  assert.deepEqual([...text.matchAll(/^  test\("([^"\n]+)"\) \{/gm)].map(m => m[1]), [
    'early empty precedes overflowing guards and all host inputs',
    'nested Boolean equality and mixed and-or keep their authored grouping',
    'Long comparison operands of Boolean equality remain parenthesized',
    'signed-64 endpoints succeed and intermediate overflow is not a business refusal',
    'scalar exact arithmetic preserves the thirty-eighth digit and checks precision',
    'unit nominal arithmetic checks both units and every intermediate precision',
    'amount projections retain containing units and checked intermediate amounts',
    'nominal structural equality is distinct from unit-aware amount equality',
    'dominating map guards skip absent lookups and optional comparisons',
    'map-get preserves Some-None instead of collapsing a nested optional',
    'nominal Text extraction uses its admitted scalar accessor',
    'empty all-equal skips the null command while nonempty reads its RHS',
    'collection coverage accepts duplicates and empty input but evaluates both operands',
    'exact positivity short-circuits later nominal operands',
    'sufficient balances reject absence but mismatched present units remain technical failures',
    'successful host occurrence and nominal literal emission use fixed independent values',
  ]);
  assert.match(text, /^final class AggregatePredicatesSpec extends AnyFunSuite/m);
});

test('renamed types/local-shadow fields render resolved accessors without raw ids or duplicated hosts',()=>{
  const i=input();bind(i,'parameter','reading','member','p');bind(i,'state-field','minimum','state-field','s');
  bind(i,'aggregate','Counter','protocol','Messages');bind(i,'event','CountSet','event','Done');
  bind(i,'aggregate','Counter','rules','CounterState');bind(i,'aggregate','Counter','command-helpers','Messages');
  const m=buildModels(i),a=m.aggregates[0],r=entry(a,m,a.rules,rulesTemplate).content,h=entry(a,m,a.helpers,commandHelpersTemplate).content;
  assert.ok(r.includes('example.counter.domain.CounterState'));
  assert.ok(h.includes('hosts.acceptedRatio(command.p, command.count, state.s)'));
  assert.equal(h.split('hosts.acceptedRatio(').length-1,1);
  assert.ok(h.includes('example.counter.domain.Messages.Done'));
});

