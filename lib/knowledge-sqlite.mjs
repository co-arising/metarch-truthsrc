import { DatabaseSync } from 'node:sqlite';
import { existsSync, lstatSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { KnowledgeGraphStore, knowledgeDigest, validateKnowledgeSnapshot } from './knowledge-graph.mjs';
import { copyImmutableData } from './immutable-data.mjs';

const VERSION='truthsrc.knowledge-store/v1';
const fail=message=>{throw new Error('KNOWLEDGE_STORE: '+message);};
const schema=`
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE snapshots (project TEXT NOT NULL, id TEXT NOT NULL, capture TEXT NOT NULL, PRIMARY KEY(project,id));
CREATE TABLE nodes (project TEXT NOT NULL, snapshot TEXT NOT NULL, ordinal INTEGER NOT NULL, id TEXT NOT NULL, identity TEXT, kind TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(project,snapshot,id));
CREATE TABLE relations (project TEXT NOT NULL, snapshot TEXT NOT NULL, ordinal INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(project,snapshot,ordinal));
CREATE TABLE generations (project TEXT NOT NULL, snapshot TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(project,snapshot,id));
CREATE INDEX nodes_identity ON nodes(project,snapshot,identity);
`;
export class SqliteKnowledgeGraphStore extends KnowledgeGraphStore {
  #db; #readonly; #closed=false;
  constructor(file,{readonly=false}={}) {
    super();this.#readonly=readonly;
    if(file!==':memory:'){
      if(existsSync(file)){const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('plain single-linked database required');}
      else{if(readonly)fail('knowledge graph missing; rebuild explicitly');mkdirSync(dirname(file),{recursive:true});}
    }
    const existing=file!==':memory:'&&existsSync(file);this.#db=new DatabaseSync(file,{readOnly:readonly});
    if(!existing){if(readonly){this.close();fail('missing graph');}this.#db.exec(schema);this.#db.prepare('INSERT INTO metadata VALUES (?,?)').run('version',VERSION);}
    try{if(this.#db.prepare('SELECT value FROM metadata WHERE key=?').get('version')?.value!==VERSION)fail('unsupported knowledge graph version; rebuild explicitly');}
    catch(error){this.close();throw error;}
  }
  #open(write=false){if(this.#closed)fail('store closed');if(write&&this.#readonly)fail('read-only store');}
  #transaction(work){this.#open(true);this.#db.exec('BEGIN IMMEDIATE');try{const result=work();this.#db.exec('COMMIT');return result;}catch(error){this.#db.exec('ROLLBACK');throw error;}}
  publishSnapshot(snapshot){
    this.#open(true);validateKnowledgeSnapshot(snapshot);
    const existing=this.#db.prepare('SELECT id FROM snapshots WHERE project=? AND id=?').get(snapshot.project,snapshot.id);
    if(existing){if(JSON.stringify(this.readSnapshot({project:snapshot.project,id:snapshot.id}))!==JSON.stringify(snapshot))fail('existing snapshot differs');return snapshot.id;}
    return this.#transaction(()=>{
      this.#db.prepare('INSERT INTO snapshots VALUES (?,?,?)').run(snapshot.project,snapshot.id,JSON.stringify(snapshot.capture));
      const insert=this.#db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?,?,?)');
      snapshot.nodes.forEach((n,i)=>insert.run(snapshot.project,snapshot.id,i,n.id,n.identity,n.kind,JSON.stringify(n)));
      const relation=this.#db.prepare('INSERT INTO relations VALUES (?,?,?,?)');snapshot.edges.forEach((e,i)=>relation.run(snapshot.project,snapshot.id,i,JSON.stringify(e)));
      return snapshot.id;
    });
  }
  readSnapshot({project,id}){
    this.#open();this.#db.exec('BEGIN');
    try {
      const row=this.#db.prepare('SELECT capture FROM snapshots WHERE project=? AND id=?').get(project,id);
      if(!row)fail('knowledge snapshot missing; rebuild explicitly');
      const capture=JSON.parse(row.capture),nodes=this.#db.prepare('SELECT value FROM nodes WHERE project=? AND snapshot=? ORDER BY ordinal').all(project,id).map(r=>JSON.parse(r.value));
      const edges=this.#db.prepare('SELECT value FROM relations WHERE project=? AND snapshot=? ORDER BY ordinal').all(project,id).map(r=>JSON.parse(r.value));
      const result={schemaVersion:'truthsrc.knowledge-snapshot/v1',project,capture,nodes,edges,id};validateKnowledgeSnapshot(result);
      this.#db.exec('COMMIT');return copyImmutableData(result);
    } catch(error) {this.#db.exec('ROLLBACK');throw error;}
  }
  queryNodes({project,snapshot,identity,kind,limit=100,offset=0}){
    this.#open();const source=this.readSnapshot({project,id:snapshot});
    if(!Number.isSafeInteger(limit)||limit<1||limit>1000||!Number.isSafeInteger(offset)||offset<0)fail('bounded pagination required');
    const rows=source.nodes.filter(n=>(identity===undefined||n.identity===identity)&&(kind===undefined||n.kind===kind));
    return {rows:rows.slice(offset,offset+limit),total:rows.length,truncated:offset+limit<rows.length};
  }
  queryRelations({project,snapshot,id,limit=100,offset=0}){
    this.#open();if(!Number.isSafeInteger(limit)||limit<1||limit>1000||!Number.isSafeInteger(offset)||offset<0)fail('bounded pagination required');
    const rows=this.readSnapshot({project,id:snapshot}).edges.filter(e=>id===undefined||e.from===id||e.to===id);
    return {rows:rows.slice(offset,offset+limit),total:rows.length,truncated:offset+limit<rows.length};
  }
  publishCodeAnchors({project,snapshot,generation,anchors,receipt,replace=false}){
    this.#open(true);this.readSnapshot({project,id:snapshot});
    if(typeof generation!=='string'||!generation||!anchors||!receipt)fail('complete generation/anchors/receipt required');
    const knowledge = this.readSnapshot({project,id:snapshot});
    const identities = new Set(knowledge.nodes.map(n=>n.identity).filter(Boolean));
    for (const row of receipt.associations || []) {
      if (!Object.hasOwn(anchors.anchors, row.key) || !Array.isArray(row.identities) || row.identities.some(id=>!identities.has(id))) fail('anchor association does not name existing knowledge');
    }
    const value=JSON.stringify({anchors,receipt}),digest=knowledgeDigest({anchors,receipt});
    const existing=this.#db.prepare('SELECT digest FROM generations WHERE project=? AND snapshot=? AND id=?').get(project,snapshot,generation);
    if(existing){
      if(existing.digest===digest)return generation;
      if(!replace)fail('generation identity conflict; explicit update required');
      return this.#transaction(()=>{
        const result=this.#db.prepare('UPDATE generations SET value=?,digest=? WHERE project=? AND snapshot=? AND id=? AND digest=?').run(value,digest,project,snapshot,generation,existing.digest);
        if(result.changes!==1)fail('generation changed during anchor update');
        return generation;
      });
    }
    return this.#transaction(()=>{this.#db.prepare('INSERT INTO generations VALUES (?,?,?,?,?)').run(project,snapshot,generation,value,digest);return generation;});
  }
  queryCodeAnchors({project,snapshot,generation,identity,file}){
    this.#open();this.readSnapshot({project,id:snapshot});
    const row=this.#db.prepare('SELECT value,digest FROM generations WHERE project=? AND snapshot=? AND id=?').get(project,snapshot,generation);
    if(!row)fail('code anchors missing from knowledge graph');
    const value=JSON.parse(row.value);if(knowledgeDigest(value)!==row.digest)fail('code anchor content differs');
    if (identity !== undefined || file !== undefined) {
      const keys = identity === undefined ? Object.keys(value.anchors.anchors) : (value.receipt.associations || []).filter(r=>r.identities.includes(identity)).map(r=>r.key);
      value.anchors.anchors = Object.fromEntries(keys.map(key=>[key,value.anchors.anchors[key].filter(loc=>file===undefined||loc.file===file)]).filter(([,locations])=>locations.length));
    }
    return copyImmutableData(value);
  }
  close(){if(!this.#closed){this.#db?.close();this.#closed=true;}}
}
