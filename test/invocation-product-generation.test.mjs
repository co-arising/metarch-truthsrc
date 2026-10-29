import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-application/generate.mjs';
const root=new URL('./fixtures/inventory-invocation-products/',import.meta.url);
const request=()=>readProductRequest(new URL('files.json',root).pathname);
const options=()=>JSON.parse(readFileSync(new URL('options.json',root)));
const manifest=JSON.parse(readFileSync(new URL('../generators/scala-cqrs-application/generator.json',import.meta.url)));
test('pipeline owner consumes compiled step shape and emits durable invocation without direct start',()=>{
 const compilation=compileProductSet(request());assert.deepEqual(compilation.diagnostics,[]);
 const result=generate({compilation,manifest,options:options()});assert.deepEqual(result.diagnostics,[]);
 const host=result.plan.entries.find(e=>e.kind==='invocation-host').content;
 assert.ok(host.includes('Effect.persist(Associated(original, args, operation))'));
 assert.ok(host.includes('StrictSagaCoordinator.Attach(identity, adapter)'));
 assert.ok(host.includes('completed(s, kind)'));
 assert.ok(!host.includes('final case class Submit('));
 const plan=result.plan.entries.find(e=>e.kind==='execution-plan').content;
 assert.ok(plan.includes('private[allocation_workflowExecution]'));
 assert.ok(plan.includes('inventory_allocation_hostHost.Invoke(call.state, replyContext.self)'));
 assert.ok(plan.includes('bridgeContext.spawnAnonymous'));
 assert.ok(plan.includes('PersistentMonarch.behavior[String, State]'));
 assert.deepEqual(generate({compilation,manifest,options:options()}),result);
});
test('pipeline owner rejects wrong exact invocation instead of canonical fallback',()=>{
 const input=structuredClone(request());input.documents.find(d=>d.id==='domain').value.sagaHosts[0].entry.startOwner.stepId='missing';
 const result=compileProductSet(input);assert.equal(result.result,null);assert.ok(result.diagnostics.some(d=>d.code==='HOST_START_OWNER'));
});
