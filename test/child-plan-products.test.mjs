import test from 'node:test';
import assert from 'node:assert/strict';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
const request=()=>structuredClone(readProductRequest(new URL('./fixtures/inventory-child-products/files.json',import.meta.url).pathname));
const document=(r,id)=>r.documents.find(d=>d.id===id).value;
test('explicit child product contains the entire typed ordered plan, not document-only identity',()=>{
 const r=request(),before=structuredClone(r),c=compileProductSet(r);assert.deepEqual(c.diagnostics,[]);assert.deepEqual(r,before);
 const child=c.result.products.find(p=>p.id==='child-plan-contract').payload.plans[0];assert.equal(child.version,'child-v1');assert.deepEqual(child.pipeline.steps.map(s=>s.id),['inspect','verify']);assert.equal(child.pipeline.inputs[0].type,'AllocationId');assert.equal(child.pipeline.outputs[0].ref,'step:verify:allocation');assert.deepEqual(compileProductSet(r),c);
 assert.equal(c.result.products.find(p=>p.id==='execution-contract').version,'1');
});
for(const [title,mutate,code]of [
 ['exact child version',(r)=>{document(r,'children').plans[0].version='wrong';},'CHILD_PLAN_VERSION'],
 ['whole stage order',(r)=>{document(r,'domain').pipelines[1].monarch.typedPlan.steps.reverse();},'CHILD_PLAN_ORDER'],
 ['whole payload signature',(r)=>{document(r,'domain').pipelines[1].monarch.typedPlan.inputs[0].id='different';document(r,'domain').pipelines[1].monarch.typedPlan.steps[0].execution.reads[0].ref='input:different';document(r,'domain').pipelines[1].monarch.typedPlan.recovery.inputs=['input:different'];},'CHILD_PLAN_PAYLOAD'],
 ['exact nominal implementations',(r)=>{document(r,'children').plans[0].binding.types[0].implementation='different.Type';},'CHILD_PLAN_TYPE'],
 ['no narrative fallback',(r)=>{delete document(r,'domain').pipelines[1].monarch.typedPlan;},'CHILD_PLAN_SOURCE'],
 ['no external masquerade',(r)=>{document(r,'children').plans[0].binding.ports[0].effect='external';},'CHILD_PLAN_FINITE']
])test(title,()=>{const r=request();mutate(r);const c=compileProductSet(r);assert.equal(c.result,null);assert.ok(c.diagnostics.some(d=>d.code===code),JSON.stringify(c.diagnostics));});
