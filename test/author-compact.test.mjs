import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compactAuthorStructures } from '../lib/author-compact.mjs';
import { compileAuthorEntries, emitAuthorDoc, restoreAuthorEntries } from '../lib/author-surface.mjs';
import { planAuthorTransform, applyAuthorTransform } from '../lib/author-transform.mjs';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { validateTree } from '../lib/validate.mjs';
import { resolveSourcePointer } from '../lib/source-index.mjs';

function fixture() {
  const prefix = 'contexts/example/';
  const docs = [
    ['system.yaml', {kind:'system',schemaVersion:'truthsrc.author/v1',id:'example',name:'Example',workshop:'example',sessionOrder:['refining'],contexts:['example']}],
    [prefix+'context.yaml',{kind:'context',schemaVersion:'truthsrc.context/v1',id:'example',name:'Example',responsibility:'Own exact protocol values.'}],
    ...['First','Second','Third'].map((name,i)=>[prefix+'value-objects/'+name.toLowerCase()+'.vo.yaml',{
      kind:'value-object',name,seq:i,payload:{name,description:'A protocol record with explicit shared identity fields.',fields:[
        {name:'transaction',dataType:'String'},{name:'definitionVersion',dataType:'String'},
        {name:'argsDigest',dataType:'String'},{name:'resource',dataType:'String'},
      ]}
    }]),
  ];
  return docs.map(([file,doc])=>({file,content:emitAuthorDoc(doc)})).sort((a,b)=>a.file.localeCompare(b.file));
}
const groups = entries => [{id:'protocol',files:entries.filter(e=>e.file.endsWith('.vo.yaml')).map(e=>e.file)}];
function disk(t) {
  const parent=mkdtempSync(join(realpathSync(tmpdir()),'author-compact-'));
  t.after(()=>rmSync(parent,{recursive:true,force:true}));
  const tree=join(parent,'source','example');
  const entries=fixture();
  for(const e of entries){mkdirSync(dirname(join(tree,e.file)),{recursive:true});writeFileSync(join(tree,e.file),e.content);}
  return {tree,parent,entries};
}

test('explicit structural compression retains every semantic field and original numeric sequence',()=>{
  const input=fixture(), before=compileAuthorEntries(input), result=compactAuthorStructures(input,{groups:groups(input)}), after=compileAuthorEntries(result.files);
  const {authoring:old,...a}=before.canonical, {authoring:next,...b}=after.canonical;
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.deepEqual(restoreAuthorEntries(after.canonical),result.files);
  assert.deepEqual(after.canonical.valueObjects.map(v=>v.seq),[0,1,2]);
  assert.ok(result.report.every(r=>r.afterBytes<r.beforeBytes));
  assert.deepEqual(input,fixture());
  const altered=structuredClone(after.canonical);altered.valueObjects[0].fields[0].dataType='Long';
  assert.throws(()=>restoreAuthorEntries(altered),/disagrees/);
});

test('controlled writer supports new candidate and exact in-place apply with real source mappings',t=>{
  const f=disk(t), plan=planAuthorTransform(f.tree,entries=>compactAuthorStructures(entries,{groups:groups(entries)}));
  const out=join(f.parent,'candidate','example');
  applyAuthorTransform(plan,{out});
  assert.equal(validateTree(out).hard.length,0);
  assert.equal(roundtrip(out).ok,true);
  const compiled=compileTreeWithSources(out), sources=resolveSourcePointer(compiled.sourceIndex,'/valueObjects/0/fields/0/dataType');
  assert.equal(sources.length,1);assert.match(sources[0].file,/structures\/protocol/);
  assert.equal(existsSync(join(f.tree,'contexts/example/value-objects/first.vo.yaml')),true);
  applyAuthorTransform(plan,{inPlace:true});
  assert.equal(existsSync(join(f.tree,'contexts/example/value-objects/first.vo.yaml')),false);
  assert.equal(validateTree(f.tree).hard.length,0);assert.equal(roundtrip(f.tree).ok,true);
  assert.throws(()=>applyAuthorTransform(plan,{inPlace:true}),/source changed/);
});

test('writer refuses stale input, unknown plans, conflicting destination and changed semantics',t=>{
  const f=disk(t), make=()=>planAuthorTransform(f.tree,entries=>compactAuthorStructures(entries,{groups:groups(entries)}));
  const plan=make();
  assert.throws(()=>applyAuthorTransform({...plan},{inPlace:true}),/live source-bound/);
  assert.throws(()=>applyAuthorTransform(plan,{out:f.tree}),/overlap/);
  writeFileSync(join(f.tree,'README.md'),'new author evidence\n');
  assert.throws(()=>applyAuthorTransform(plan,{inPlace:true}),/source changed/);
  assert.throws(()=>planAuthorTransform(f.tree,entries=>({files:entries.map(e=>e.file.endsWith('first.vo.yaml')?{...e,content:e.content.replace('"String"','"Long"')}:e)})),/semantic projection/);
});

test('macro selection cannot infer unrelated paths, duplicate members, or hide no-savings choices',()=>{
  const input=fixture();
  assert.throws(()=>compactAuthorStructures(input,{groups:[]}),/explicit/);
  for(const files of [['system.yaml'],['missing.yaml'],[groups(input)[0].files[0],groups(input)[0].files[0]]])
    assert.throws(()=>compactAuthorStructures(input,{groups:[{id:'bad',files}]}),/unknown|duplicate/);
});
