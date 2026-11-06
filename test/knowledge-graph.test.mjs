import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { initProject } from '../lib/project/init.mjs';
import { captureProject, projectCli } from '../lib/project/cli.mjs';
import { buildKnowledgeSnapshot, exportKnowledgeAst, KnowledgeGraphStore } from '../lib/knowledge-graph.mjs';
import { SqliteKnowledgeGraphStore } from '../lib/knowledge-sqlite.mjs';
import { projectKnowledgeAst, projectGraphFile } from '../lib/project/graph.mjs';
import { statusProject } from '../lib/project/query.mjs';
function fixture(t) {
  const root=mkdtempSync(join(realpathSync(tmpdir()),'knowledge-graph-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const f=initProject([join(root,'project')]);return{root,...f,capture:captureProject(f.project),database:join(root,'knowledge.sqlite')};
}
test('complete source and product knowledge survives persistent close/reopen and independent process',t=>{
  const f=fixture(t),snapshot=buildKnowledgeSnapshot(f.capture);let store=new SqliteKnowledgeGraphStore(f.database);
  store.publishSnapshot(snapshot);store.close();store=new SqliteKnowledgeGraphStore(f.database,{readonly:true});
  const ast=exportKnowledgeAst(store,{project:f.project,snapshot:snapshot.id,expectedSources:f.capture.sources});
  assert.deepEqual(ast.canonical,f.capture.canonical);assert.deepEqual(ast.compilation,f.capture.compilation);
  assert.ok(store.queryNodes({project:f.project,snapshot:snapshot.id,kind:'fold'}).rows.length>0);
  assert.ok(store.queryNodes({project:f.project,snapshot:snapshot.id,kind:'event-slot'}).rows.length>0);
  assert.ok(store.queryRelations({project:f.project,snapshot:snapshot.id}).rows.length>0);
  assert.throws(()=>store.publishSnapshot(snapshot),/read-only/);
  assert.throws(()=>exportKnowledgeAst(store,{project:f.project,snapshot:snapshot.id,expectedSources:[]}),/stale/);
  store.close();assert.throws(()=>store.readSnapshot({project:f.project,id:snapshot.id}),/closed/);
  const script=`import {SqliteKnowledgeGraphStore} from ${JSON.stringify(new URL('../lib/knowledge-sqlite.mjs',import.meta.url).href)};const s=new SqliteKnowledgeGraphStore(process.argv[1],{readonly:true});console.log(s.readSnapshot({project:process.argv[2],id:process.argv[3]}).id);s.close();`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script,f.database,f.project,snapshot.id],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),snapshot.id);
});
test('graph AST is read from the domain port and does not require SQLite methods',t=>{
  const f=fixture(t);class Memory extends KnowledgeGraphStore{value;published=0;reads=0;publishSnapshot(s){this.value=structuredClone(s);this.published++;}readSnapshot(){this.reads++;return structuredClone(this.value);}}
  const store=new Memory(),ast=projectKnowledgeAst(f.capture,{store});assert.equal(store.published,1);assert.equal(store.reads,1);assert.deepEqual(ast.compilation,f.capture.compilation);
});
test('tampered graph members, missing products and wrong project are refused',t=>{
  const f=fixture(t),snapshot=buildKnowledgeSnapshot(f.capture),store=new SqliteKnowledgeGraphStore(f.database);
  store.publishSnapshot(snapshot);assert.throws(()=>store.readSnapshot({project:'other',id:snapshot.id}),/missing/);store.close();
  const db=new DatabaseSync(f.database);db.prepare('DELETE FROM nodes WHERE project=? AND snapshot=? AND id=?').run(f.project,snapshot.id,'product:domain-folds');db.close();
  const read=new SqliteKnowledgeGraphStore(f.database,{readonly:true});assert.throws(()=>read.readSnapshot({project:f.project,id:snapshot.id}),/digest differs/);read.close();
  const absent=join(f.root,'absent.sqlite');assert.throws(()=>new SqliteKnowledgeGraphStore(absent,{readonly:true}),/missing/);assert.equal(existsSync(absent),false);
});
test('same-snapshot anchor refresh requires an explicit update and does not change the knowledge AST',t=>{
  const f=fixture(t),snapshot=buildKnowledgeSnapshot(f.capture),store=new SqliteKnowledgeGraphStore(f.database);
  store.publishSnapshot(snapshot);
  const before=exportKnowledgeAst(store,{project:f.project,snapshot:snapshot.id});
  const first={project:f.project,snapshot:snapshot.id,generation:'same-generation',anchors:{version:'truthsrc.anchors/v1',anchors:{}},receipt:{output:'example'}};
  store.publishCodeAnchors(first);
  const second={...first,receipt:{output:'example',manualRevision:'second'}};
  assert.throws(()=>store.publishCodeAnchors(second),/explicit update/);
  store.publishCodeAnchors({...second,replace:true});
  assert.equal(store.queryCodeAnchors(first).receipt.manualRevision,'second');
  assert.deepEqual(exportKnowledgeAst(store,{project:f.project,snapshot:snapshot.id}),before);
  store.close();
});

test('code anchors are separate from knowledge AST and missing graph prevents synchronized query',async t=>{
  const f=fixture(t),out=join(f.root,'output');const result=await projectCli('generate-project',['--project',f.project,'--out',out]);
  assert.equal(statusProject({project:f.project,out}).synchronized,true);
  const store=new SqliteKnowledgeGraphStore(projectGraphFile(f.project),{readonly:true});
  const before=exportKnowledgeAst(store,{project:f.project,snapshot:result.graph.snapshot});
  const anchors=store.queryCodeAnchors({project:f.project,snapshot:result.graph.snapshot,generation:result.graph.generation});
  assert.ok(Object.keys(anchors.anchors.anchors).length);assert.deepEqual(exportKnowledgeAst(store,{project:f.project,snapshot:result.graph.snapshot}),before);store.close();
  rmSync(projectGraphFile(f.project));assert.equal(statusProject({project:f.project,out}).synchronized,false);
});
