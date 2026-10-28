import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { compileSagaHosts } from '../lib/products/saga-hosts.mjs';
const captured = readProductRequest(fileURLToPath(new URL('./fixtures/saga-host-products/files.json', import.meta.url)));
const clone = v => structuredClone(v);
const fixture = () => clone(captured);
const document = (r, id) => r.documents.find(d => d.id === id).value;
const host = r => document(r, 'domain').sagaHosts[0];
const asserted = r => document(r, 'hosts').hosts.hosts[0];
const phase = r => host(r).participants[0].phases[0];
const succeed = r => { const o=compileProductSet(r); assert.deepEqual(o.diagnostics,[]);assert.ok(o.result);return o.result; };
const reject = (r, code) => { const before=clone(r),o=compileProductSet(r);assert.equal(o.result,null);if(code)assert.ok(o.diagnostics.some(d=>d.code===code),JSON.stringify(o.diagnostics));assert.deepEqual(r,before);assert.deepEqual(compileProductSet(r),o);return o; };
function reassert(r) { document(r,'hosts').hosts.hosts = document(r,'domain').sagaHosts.map((h,i)=>({...clone(h),source:{document:'domain',pointer:'/sagaHosts/'+i}})); }

test('formal host product preserves event entry, entire phases, five independent destinations and before-effects original association',()=>{
 const r=fixture(),before=clone(r),o=succeed(r),p=o.products.find(p=>p.id==='saga-host-contract');
 assert.deepEqual(r,before);assert.deepEqual(p.payload.hosts,[asserted(r)]);assert.ok(Object.isFrozen(p.payload.hosts[0]));
 assert.equal(p.payload.hosts[0].entry.kind,'event');assert.equal(p.payload.hosts[0].participants.length,2);
 assert.equal(p.payload.hosts[0].results.length,5);assert.equal(p.payload.hosts[0].results[1].destination.resourceInput.id,'to');
 assert.equal(p.payload.hosts[0].association.before,'phase-effects');assert.equal(p.payload.hosts[0].association.originalInputs.length,4);
 assert.deepEqual(o.readiness,{level:'static-contract-only',runnable:false,runtimeBindingVerified:false});
});
test('phase host reconstruction refuses forged payload and forged source without modifying inputs',()=>{
 let r=fixture();asserted(r).participants[0].phases[0].command.id='not-the-command';reject(r,'PRODUCT_PAYLOAD_MISMATCH');
 r=fixture();asserted(r).source.pointer='/sagas/0';reject(r,'PRODUCT_PAYLOAD_MISMATCH');
});
test('whole source phase signatures, ordering and input lineage are checked, not just references',()=>{
 for(const change of [r=>phase(r).parameters.pop(),r=>phase(r).parameters.reverse(),r=>phase(r).parameters[0].input={kind:'args',slot:'to'},r=>phase(r).confirmation.outputs.pop(),r=>phase(r).confirmation.outputs[0].output='wrong']){
  const r=fixture();change(r);reassert(r);reject(r);
 }
});
test('marker-only evidence, wrong resource nominal type, codec version and incomplete identity are refused',()=>{
 for(const change of [r=>phase(r).evidence.kind='marker',r=>phase(r).evidence.identity.pop(),r=>phase(r).evidence.payload=[],r=>phase(r).evidence.codec.runtime.version=99,r=>phase(r).query.identity.pop(),r=>phase(r).query.mode='execute']){
  const r=fixture();change(r);reassert(r);reject(r);
 }
});
test('every static step and all phases/results are required; no first-step route fallback',()=>{
 for(const change of [r=>host(r).participants.pop(),r=>host(r).participants.reverse(),r=>host(r).participants[0].phases.pop(),r=>host(r).results.pop(),r=>host(r).results[0].authorityPort=host(r).entry.port]){
  const r=fixture();change(r);reassert(r);reject(r);
 }
 const r=fixture();host(r).results[1].destination.resourceInput=host(r).participants[0].resourceInput;reassert(r);
 succeed(r); // an explicitly authored other original destination is legal, never automatically selected
});
test('early association retains whole original input and exact identity, never attempts or clocks',()=>{
 for(const change of [r=>host(r).association.originalInputs.pop(),r=>host(r).association.inputKeys=[],r=>host(r).association.before='last-commit',r=>host(r).association.encoding='csv',r=>host(r).association.conflict='last-writer-wins',r=>host(r).results[1].associationVersion='later',r=>host(r).results[1].destination.resourceInput={context:'accounts',kind:'parameter',owner:['CreditBalance','ReserveFunds'],id:'resource'}]){
  const r=fixture();change(r);reassert(r);reject(r);
 }
});
test('one explicit start owner and matching entry kind are mandatory',()=>{
 let r=fixture();host(r).entry.kind='command';reassert(r);reject(r,'HOST_ENTRY');
 r=fixture();host(r).entry.startOwner.ref={context:'accounts',kind:'pipeline',owner:[],id:'formal-source-plan'};reassert(r);reject(r,'HOST_START_OWNER');
 r=fixture();host(r).entry.startOwner={kind:'pipeline',ref:{context:'accounts',kind:'pipeline',owner:[],id:'formal-source-plan'},stepId:'not-invoke'};reassert(r);reject(r);
});
test('technical implementation obligations must match selected artifact versions; not installed certificates',()=>{
 let r=fixture();host(r).technicalPorts.pop();reassert(r);reject(r,'HOST_IMPLEMENTATION');
 r=fixture();host(r).technicalPorts[0].implementation.version='wrong';reassert(r);reject(r,'HOST_IMPLEMENTATION');
 r=fixture();host(r).technicalPorts[0].implementation.secret='unsafe';reassert(r);reject(r,'PRODUCT_FIELD_UNKNOWN');
});
test('v2 external nominal textual identity is opt-in and original v1 remains strict',()=>{
 const r=fixture();const d=r.documents.find(d=>d.id==='external');d.schemaVersion=d.value.schemaVersion='truthsrc.domain-external-event-binding/v1';
 const requirement=r.requirements.find(p=>p.id==='domain-external-events');requirement.version='1';requirement.payloadSchemaVersion='truthsrc.domain-external-events/v1';requirement.capabilities=[{id:'external-event-producers',version:'1'}];
 r.requirements=r.requirements.filter(p=>p.id!=='saga-host-contract');r.documents=r.documents.filter(d=>d.id!=='hosts');
 reject(r,'EXTERNAL_IDENTITY');
});
test('v2 canonical port spelling resolves exact nominal types while artifact v1 does not silently gain it',()=>{
 const r=fixture();const d=r.documents.find(d=>d.id==='artifacts');d.schemaVersion=d.value.schemaVersion='truthsrc.artifact-binding/v1';
 const requirement=r.requirements.find(p=>p.id==='artifact-contract');requirement.version='1';requirement.payloadSchemaVersion='truthsrc.artifact-contract/v1';requirement.capabilities=[{id:'artifact-static-contract',version:'1'}];
 r.requirements=r.requirements.filter(p=>p.id!=='saga-host-contract');r.documents=r.documents.filter(d=>d.id!=='hosts');reject(r,'ARTIFACT_PORT');
});
test('null and malformed nested host fields produce stable product diagnostics rather than incidental exceptions',()=>{
 for(const change of [r=>host(r).entry=null,r=>host(r).association=null,r=>phase(r).evidence.identity[0]=null,r=>phase(r).query=null,r=>host(r).results[0].destination=null,r=>host(r).technicalPorts[0].port=null,r=>host(r).participants[0]=null,r=>host(r).participants[0].phases[0]=null,r=>phase(r).parameters[0]=null,r=>phase(r).confirmation.outputs[0]=null,r=>host(r).results[0]=null]){
  const r=fixture();change(r);reassert(r);reject(r);
 }
});
