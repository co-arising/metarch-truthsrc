import { createHash } from 'node:crypto';
import { copyImmutableData } from './immutable-data.mjs';
import { compileProductSet } from './products/compile.mjs';
import { validateSourceIndex, snapshotDigest, knowledgeIdentity } from './source-index.mjs';

export const KNOWLEDGE_SNAPSHOT_VERSION = 'truthsrc.knowledge-snapshot/v1';
export const KNOWLEDGE_AST_VERSION = 'truthsrc.knowledge-ast/v1';
const exportedAsts = new WeakSet();
export function assertKnowledgeAst(ast) {
  if (!exportedAsts.has(ast)) throw new Error('KNOWLEDGE_GRAPH: AST must be exported from an integrity-checked knowledge store');
}
export const knowledgeDigest = value => 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex');
const at = (value, pointer) => pointer.split('/').slice(1).reduce((v, k) => v !== null && typeof v === 'object' && Object.hasOwn(v, k.replaceAll('~1','/').replaceAll('~0','~')) ? v[k.replaceAll('~1','/').replaceAll('~0','~')] : undefined, value);
const fail = message => { throw new Error('KNOWLEDGE_GRAPH: ' + message); };

export function buildKnowledgeSnapshot(capture) {
  const value = copyImmutableData(capture);
  validateSourceIndex(value.sourceIndex);
  if (value.sourceIndex.snapshot !== snapshotDigest(value.canonical)) fail('source index snapshot differs');
  if (!value.compilation?.result || value.compilation.diagnostics.length || !Array.isArray(value.sources) || !value.file) fail('complete capture required');
  if (value.rawInputs) for (const input of value.rawInputs) {
    const source = value.sources.find(s => s.file === input.file);
    if (!source || source.sha256 !== createHash('sha256').update(input.text).digest('hex') || Buffer.byteLength(input.text) !== source.bytes)
      fail('original input text differs from captured fingerprint');
  }
  const nodes = [], edges = [], ids = new Set();
  const node = (id, kind, identity, pointer, payload, source = null) => {
    if (ids.has(id)) fail('duplicate node occurrence');
    ids.add(id);nodes.push({id,kind,identity,pointer,payload,source});return id;
  };
  const canonicalNode = node('canonical','canonical',null,'',value.canonical);
  for (const [i, record] of value.sourceIndex.records.entries()) {
    const payload = at(value.canonical,record.pointer);
    if(payload===undefined)fail('source pointer is missing: '+record.pointer);
    node('source:'+i,record.kind,record.identity,record.pointer,payload,record);
    edges.push({from:canonicalNode,to:'source:'+i,relation:'contains',ordinal:i});
  }
  const recordByPointer = new Map(value.sourceIndex.records.map((r,i)=>[r.pointer,'source:'+i]));
  for(const [i,r]of value.sourceIndex.records.entries()){
    let pointer=r.pointer;
    while(pointer.includes('/')){pointer=pointer.slice(0,pointer.lastIndexOf('/'));if(recordByPointer.has(pointer)){edges.push({from:recordByPointer.get(pointer),to:'source:'+i,relation:'owns',ordinal:i});break;}}
  }
  const supplement=(pointer,kind,owner,id)=>{
    if(recordByPointer.has(pointer))return;
    const identity=knowledgeIdentity(value.sourceIndex.system,value.sourceIndex.context,kind,owner,id);
    node('member:'+pointer,kind,identity,pointer,at(value.canonical,pointer));
    let parent=pointer.slice(0,pointer.lastIndexOf('/'));
    while(parent&&!recordByPointer.has(parent))parent=parent.slice(0,parent.lastIndexOf('/'));
    edges.push({from:recordByPointer.get(parent)||canonicalNode,to:'member:'+pointer,relation:'owns',ordinal:nodes.length-1});
  };
  for(const[ai,a]of(value.canonical.aggregates||[]).entries())for(const[family,slots,kind]of[['commands','parameters','parameter'],['events','payloads','event-slot']])
    for(const[ci,c]of a[family].entries())for(const[si,s]of(c[slots]||[]).entries())supplement(`/aggregates/${ai}/${family}/${ci}/${slots}/${si}`,kind,[a.name,c.name],s.name);
  for(const[i,p]of value.compilation.result.products.entries()){
    const id=node('product:'+p.id,'semantic-product',p.id+'@'+p.version,'/products/'+i,p);
    edges.push({from:canonicalNode,to:id,relation:'compiles-to',ordinal:i});
    for(const[ordinal,dep]of p.requires.entries())edges.push({from:id,to:'product:'+dep.id,relation:'requires',ordinal});
  }
  for(const e of edges)if(!ids.has(e.from)||!ids.has(e.to))fail('dangling knowledge relation');
  const body={schemaVersion:KNOWLEDGE_SNAPSHOT_VERSION,project:value.file,capture:value,nodes,edges};
  return copyImmutableData({...body,id:knowledgeDigest(body)});
}
export function validateKnowledgeSnapshot(snapshot) {
  const {id,...body}=snapshot;
  if(snapshot.schemaVersion!==KNOWLEDGE_SNAPSHOT_VERSION||knowledgeDigest(body)!==id)fail('snapshot content digest differs');
  const expected=buildKnowledgeSnapshot(snapshot.capture);
  if(JSON.stringify(expected)!==JSON.stringify(snapshot))fail('graph and complete capture disagree');
  return snapshot;
}
export function exportKnowledgeAst(store,{project,snapshot,expectedSources}={}) {
  const stored=store.readSnapshot({project,id:snapshot});
  validateKnowledgeSnapshot(stored);
  if(expectedSources&&JSON.stringify(stored.capture.sources)!==JSON.stringify(expectedSources))fail('stale knowledge snapshot; rebuild explicitly');
  const c=stored.capture;
  const compilation=compileProductSet(c.request);
  if(JSON.stringify(compilation)!==JSON.stringify(c.compilation))fail('stored product compilation does not reproduce');
  const ast = copyImmutableData({schemaVersion:KNOWLEDGE_AST_VERSION,snapshot:stored.id,project:stored.project,
    config:c.config,generatorDir:c.generatorDir,canonical:c.canonical,request:c.request,compilation:c.compilation,sourceIndex:c.sourceIndex,sources:c.sources,validation:c.validation,
    ...(c.implementations ? {implementations:c.implementations} : {})});
  exportedAsts.add(ast);
  return ast;
}

export class KnowledgeGraphStore {
  publishSnapshot() { fail('publishSnapshot adapter not implemented'); }
  readSnapshot() { fail('readSnapshot adapter not implemented'); }
  queryNodes() { fail('queryNodes adapter not implemented'); }
  queryRelations() { fail('queryRelations adapter not implemented'); }
  publishCodeAnchors() { fail('publishCodeAnchors adapter not implemented'); }
  queryCodeAnchors() { fail('queryCodeAnchors adapter not implemented'); }
  close() {}
}
