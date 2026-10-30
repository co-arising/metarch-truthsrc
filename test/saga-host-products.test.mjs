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

const extendedCaptured = readProductRequest(fileURLToPath(new URL('./fixtures/inventory-host-products/files.json', import.meta.url)));
const extFixture = () => clone(extendedCaptured);
const extHost = r => document(r, 'domain').sagaHosts[0];
const extRole = (r, role) => extHost(r).technicalPorts.find(p => p.role === role);
const swapPorts = (r, first, second) => { const a = extRole(r, first), b = extRole(r, second); const port = a.port, impl = a.implementation; a.port = clone(b.port); a.implementation = clone(b.implementation); b.port = port; b.implementation = impl; };
test('extended technical port roles require exact typed shapes, one declaration per host and cross-role agreement',()=>{
 // The inventory fixture declares all seven extended roles with legal shapes; repointing a row to another
 // declared port keeps the artifact obligation satisfied so only the typed shape gates can reject.
 const mutations=[
  r=>swapPorts(r,'resource-policy','external-submission'),   // record output instead of boolean admission
  r=>swapPorts(r,'external-query','external-event'),         // non-optional receipt output
  r=>swapPorts(r,'occurrence-source','readside'),            // envelope without producer/authorization members
  r=>swapPorts(r,'deployment','occurrence-source'),          // target record without endpoint/route/secretRef
  r=>swapPorts(r,'external-query','readside'),               // query consumes a different record than submission
  r=>{extRole(r,'readside').role='deployment';},              // duplicate extended role declaration
 ];
 for(const change of mutations){const r=extFixture();change(r);reassert(r);reject(r,'HOST_PORT');}
});
const extendedRoles=['resource-policy','external-submission','external-query','external-event','occurrence-source','readside','deployment'];
function optIn(r,role){extHost(r).technicalPorts=extHost(r).technicalPorts.filter(p=>!extendedRoles.includes(p.role)||p.role===role);reassert(r);return r;}
function reassertArtifacts(r){document(r,'artifacts').artifacts.artifacts=document(r,'domain').artifactContracts.map((a,i)=>({...clone(a),source:{document:'domain',pointer:'/artifactContracts/'+i}}));}
test('all seven extended roles opt in alone without requiring unrelated declarations',()=>{
 for(const role of extendedRoles){const r=optIn(extFixture(),role),o=succeed(r),h=o.products.find(p=>p.id==='saga-host-contract').payload.hosts[0];assert.equal(h.technicalPorts.length,31);assert.deepEqual(h.technicalPorts.filter(p=>extendedRoles.includes(p.role)).map(p=>p.role),[role]);}
});
test('core roles cannot be relabelled to evade required completion and operation callbacks',()=>{
 for(const role of ['authority','result-delivery','phase-execute','phase-query']){const r=extFixture();extRole(r,role).role='entry';reassert(r);reject(r,'HOST_PORT');}
});
test('deployment uses only its unique selected owner and declared symbolic secret references',()=>{
 for(const change of [
  a=>{a.deployment.secretRefs=[];},
  a=>{a.deployment.secretRefs=[{id:'inline=not-a-real-secret',provider:'environment'}];},
  a=>{a.deployment.secretRefs=[{id:'../inline-token',provider:'keystore'}];},
 ]){const r=optIn(extFixture(),'deployment');change(document(r,'domain').artifactContracts[0]);reassertArtifacts(r);reject(r,'HOST_SECRET');}
 const r=optIn(extFixture(),'deployment');document(r,'domain').artifactContracts[0].deployment.secretRefs[0].value='not-a-real-secret';reassertArtifacts(r);reject(r,'PRODUCT_FIELD_UNKNOWN');
});
test('all declared extended implementations must remain in the selected artifact',()=>{
 for(const role of extendedRoles){const r=optIn(extFixture(),role),p=extRole(r,role).port.ref,a=document(r,'domain').artifactContracts[0];a.implementations=a.implementations.filter(i=>JSON.stringify(i.port)!==JSON.stringify(p));reassertArtifacts(r);reject(r,'ARTIFACT_IMPLEMENTATION');}
});
