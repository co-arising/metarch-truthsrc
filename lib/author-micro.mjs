import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compactMicro, parseMicro, MICRO_VERSION } from './author-micro-codec.mjs';
import { copyImmutableData } from './immutable-data.mjs';

export { MICRO_VERSION };
const directory = fileURLToPath(new URL('../schema/', import.meta.url));
const schemas = new Map(readdirSync(directory).filter(f => f.endsWith('.schema.json')).map(file => {
  const schema = JSON.parse(readFileSync(directory + '/' + file, 'utf8')); return [schema.$id, schema];
}));
const root = (uri, definition) => ({ $ref: uri + '#/$defs/' + definition });
const reference = root('urn:truthsrc:product-compilation:v1','reference');
const valueType = root('urn:truthsrc:product-compilation:v1','valueType');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = key => String(key).replaceAll('~','~0').replaceAll('/','~1');
const schemaAt = (ref, current) => {
  const [uri, pointer] = ref.split('#'), schema = uri ? schemas.get(uri) : current;
  if (!schema) throw new Error('AUTHOR_MICRO: unknown schema '+ref);
  return { schema, value: (pointer || '').split('/').slice(1).reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],schema) };
};
function variants(schema, current, depth=0) {
  if (!object(schema) || depth>48) return [];
  if (schema.$ref) { const next=schemaAt(schema.$ref,current); return variants(next.value,next.schema,depth+1); }
  return [{ value:schema, current }, ...['oneOf','anyOf','allOf'].flatMap(k=>(schema[k]||[]).flatMap(s=>variants(s,current,depth+1)))];
}
function schemaFamily(schema, current, seen=new Set()) {
  if (!object(schema)) return null;
  const ref=schema.$ref;
  if(ref) {
    if(ref==='urn:truthsrc:product-compilation:v1#/$defs/reference') return 'ref';
    if(ref==='urn:truthsrc:product-compilation:v1#/$defs/valueType') return 'type';
    if(seen.has(ref))return null;
    const next=schemaAt(ref,current);return schemaFamily(next.value,next.schema,new Set([...seen,ref]));
  }
  if(schema.type==='object'&&JSON.stringify(Object.keys(schema.properties||{}).sort())===JSON.stringify(['ref','version'])&&schemaFamily(schema.properties.ref,current)==='ref')return 'pin';
  const alternatives=[...(schema.oneOf||[]),...(schema.anyOf||[])];
  if(alternatives.length){const families=alternatives.filter(s=>s.type!=='null').map(s=>schemaFamily(s,current,seen));if(families.length&&families.every(f=>f&&f===families[0]))return families[0];}
  return null;
}
function formalSchema(doc) {
  const roots={
    'technical-port':{type:'object',properties:{inputType:valueType,outputType:valueType}},
    'saga-host':root('urn:truthsrc:saga-host-contract:v1','host'),
    'effect-host':root('urn:truthsrc:effect-host-contract:v1','host'),
    'artifact-contract':root('urn:truthsrc:artifact-contract:v3','artifact'),
    'host-computation':root('urn:truthsrc:domain-dataflow:v2','host'),
    'external-event-producer':{type:'object',properties:{event:reference,port:reference,outputType:valueType,
      stableIdentity:{type:'object',properties:{keys:{type:'array',items:reference}}},
      stableIdentityContract:{type:'object',properties:{keys:{type:'array',items:reference}}},
      slotMappings:{type:'array',items:{type:'object',properties:{slot:reference,member:reference}}}}},
    'product-design':root('urn:truthsrc:product-design:v1','canonicalDesign'),
  };
  return roots[doc.family];
}

export function transformMicroDocument(input, { mode='expand', file='<atom>', select }={}) {
  if(!['expand','compact'].includes(mode))throw new Error('AUTHOR_MICRO: unknown transform mode');
  const doc=copyImmutableData(input), mappings=[];
  const transform=(value,kind,pointer)=>{
    if(mode==='expand') {
      if(typeof value!=='string')return value;
      if(['ref','pin','type'].includes(kind) && !value.startsWith('@')) return value;
      try { const result=parseMicro(value,kind); mappings.push({pointer,kind}); return result; }
      catch(error){throw new Error(`AUTHOR_MICRO: ${file}#${pointer}: ${error.message}`);}
    }
    const compact=compactMicro(value,kind);
    if(compact===null||select&&!select(pointer,kind,value,compact))return value;
    mappings.push({pointer,kind});return compact;
  };
  const schemaWalk=(value,schema,current,pointer)=>{
    if(!schema)return value;
    const family=schemaFamily(schema,current);
    if(family){const result=transform(value,family,pointer);if(result!==value)return result;}
    const choices=variants(schema,current).filter(({value:shape})=>!object(value)||Object.entries(shape.properties||{}).every(([key,property])=>
      !Object.hasOwn(value,key)||!Object.hasOwn(property,'const')||value[key]===property.const));
    if(Array.isArray(value))return value.map((v,i)=>{
      const candidate=choices.find(s=>object(s.value.items));return candidate?schemaWalk(v,candidate.value.items,candidate.current,pointer+'/'+i):v;
    });
    if(object(value))return Object.fromEntries(Object.entries(value).map(([k,v])=>{
      const candidate=choices.find(s=>s.value.properties&&Object.hasOwn(s.value.properties,k));
      return [k,candidate?schemaWalk(v,candidate.value.properties[k],candidate.current,pointer+'/'+escape(k)):v];
    }));
    return value;
  };
  const rows=(value,kind,pointer)=>Array.isArray(value)?value.map((v,i)=>transform(v,kind,pointer+'/'+i)):value;
  const event=(value,pointer)=>{
    if(!object(value))return value;
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='payloads'?rows(v,'origin-field',pointer+'/payloads')
      :k==='bindings'?rows(v,'binding',pointer+'/bindings'):k==='foldAssignments'?rows(v,'fold',pointer+'/foldAssignments'):v]));
  };
  const command=(value,pointer)=>object(value)?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,
    k==='parameters'?rows(v,'origin-field',pointer+'/parameters'):k==='guards'?rows(v,'guard',pointer+'/guards'):v])):value;
  let result=structuredClone(doc);
  if(doc.kind==='formal-product') result.payload=schemaWalk(doc.payload,formalSchema(doc),null,'/payload');
  else if(doc.kind==='slice'){
    result.payload=command(doc.payload,'/payload');
    if(doc.events)result.events=Object.fromEntries(Object.entries(doc.events).map(([k,v])=>[k,event(v,'/events/'+escape(k))]));
  }else if(doc.kind==='aggregate'){
    result.payload=Object.fromEntries(Object.entries(doc.payload).map(([k,v])=>[k,k==='identifier'?transform(v,'origin-field','/payload/identifier')
      :k==='stateFields'?rows(v,'state-field','/payload/stateFields'):k==='aggregateRuleRefs'?rows(v,'rule','/payload/aggregateRuleRefs'):v]));
    if(doc.extraEvents)result.extraEvents=doc.extraEvents.map((v,i)=>event(v,'/extraEvents/'+i));
  }else if(doc.kind==='value-object'&&Object.hasOwn(doc.payload,'fields'))result.payload={...doc.payload,fields:rows(doc.payload.fields,'field','/payload/fields')};
  else if(doc.kind==='saga'||doc.kind==='pipeline'){
    const visit=(value,pointer)=>{
      if(Array.isArray(value))return value.map((v,i)=>visit(v,pointer+'/'+i));
      if(!object(value))return value;
      return Object.fromEntries(Object.entries(value).map(([k,v])=>{
        const p=pointer+'/'+escape(k);
        if(['description','purpose','invariants','provenance','script'].includes(k))return [k,v];
        if(['args','outputs'].includes(k)&&Array.isArray(v))return [k,v.map((row,i)=>{
          if(object(row)&&Object.hasOwn(row,'ref')||typeof row==='string'&&row.includes(' <- '))return transform(row,'typed-binding',p+'/'+i);
          return transform(row,'slot',p+'/'+i);
        })];
        if(['bindings','argsMapping'].includes(k)&&Array.isArray(v))return [k,rows(v,'typed-binding',p)];
        return [k,visit(v,p)];
      }));
    };
    if(doc.kind==='saga')result.payload=visit(doc.payload,'/payload');
    else for(const k of ['steps','execution'])if(doc[k])result[k]=visit(doc[k],'/'+k);
  }
  return {doc:copyImmutableData(result),mappings};
}

export function expandMicroDocuments(documents,{enabled=false,representationMappings=[]}={}) {
  if(!enabled)return {documents, mappings:representationMappings};
  const merged=new Map(representationMappings.map(m=>[JSON.stringify([m.file,m.pointer]),m]));
  const transformed=documents.map(({file,doc})=>{
    const result=transformMicroDocument(doc,{file});
    for(const m of result.mappings){
      const candidates=representationMappings.filter(r=>r.file===file&&(r.pointer===m.pointer||m.pointer.startsWith(r.pointer+'/'))).sort((a,b)=>b.pointer.length-a.pointer.length);
      const source=candidates[0];
      const authorPointer=source?source.authorPointer+(source.mode==='subtree'?m.pointer.slice(source.pointer.length):''):m.pointer;
      for(const [key,row] of merged)if(row.file===file&&row.pointer.startsWith(m.pointer+'/'))merged.delete(key);
      merged.set(JSON.stringify([file,m.pointer]),{file,pointer:m.pointer,authorFile:source?.authorFile||file,authorPointer,mode:'declaration',label:(source?.label||doc.id||doc.name||doc.command||doc.kind)+':'+m.kind,...(source?.template?{template:source.template}:{})});
    }
    return {file,doc:result.doc};
  });
  return {documents:transformed,mappings:[...merged.values()]};
}
