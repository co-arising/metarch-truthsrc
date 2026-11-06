import { parseAuthorDoc } from './author-parse.mjs';
import { compileAuthorEntries, emitAuthorDoc } from './author-surface.mjs';
import { transformMicroDocument, MICRO_VERSION } from './author-micro.mjs';

const escape = key => String(key).replaceAll('~','~0').replaceAll('/','~1');
const at = (root,pointer) => pointer.split('/').slice(1).reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],root);
function jsonSpans(text) {
  let i=0;const spans=new Map(),space=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
  const string=()=>{const begin=i++;let escaped=false;while(i<text.length){const c=text[i++];if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')return JSON.parse(text.slice(begin,i));}throw new Error('AUTHOR_MICRO: unterminated JSON string');};
  function value(pointer){space();const begin=i;
    if(text[i]==='"')string();
    else if(text[i]==='{'){i++;space();if(text[i]!=='}')while(true){space();const key=string();space();if(text[i++]!==':')throw new Error('AUTHOR_MICRO: JSON colon expected');value(pointer+'/'+escape(key));space();if(text[i]!==',')break;i++;}if(text[i++]!=='}')throw new Error('AUTHOR_MICRO: JSON object expected');}
    else if(text[i]==='['){i++;space();let n=0;if(text[i]!==']')while(true){value(pointer+'/'+n++);space();if(text[i]!==',')break;i++;}if(text[i++]!==']')throw new Error('AUTHOR_MICRO: JSON array expected');}
    else {while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;}
    spans.set(pointer,{start:begin,end:i});
  }
  value('');return spans;
}
function replaceJsonNodes(raw,replacements) {
  const lines=raw.match(/[^\n]*(?:\n|$)/g).filter(Boolean), blocks=new Map();let offset=0;
  for(let index=0;index<lines.length;index++){
    const line=lines[index],m=/^(\w+):[ \t]*\n?$/.exec(line);
    if(m){const start=offset+line.length;let end=start,j=index+1;while(j<lines.length&&(lines[j].startsWith('  ')||lines[j].trim()==='')){end+=lines[j].length;j++;}
      const text=raw.slice(start,end);if(text.trimStart().startsWith('{')||text.trimStart().startsWith('['))blocks.set('/'+m[1],{start,spans:jsonSpans(text)});
    }
    const inline=/^(\w+): ([\[{].*)/.exec(line);
    if(inline){const start=offset+line.indexOf(': ')+2;blocks.set('/'+inline[1],{start,spans:jsonSpans(raw.slice(start,offset+line.length))});}
    offset+=line.length;
  }
  const edits=[];
  for(const r of replacements){const slash=r.pointer.indexOf('/',1),block=slash<0?r.pointer:r.pointer.slice(0,slash),pointer=slash<0?'':r.pointer.slice(slash),b=blocks.get(block),span=b?.spans.get(pointer);
    if(!span)throw new Error('AUTHOR_MICRO: no original JSON text position '+r.pointer);
    edits.push({start:b.start+span.start,end:b.start+span.end,text:JSON.stringify(r.value)});
  }
  edits.sort((a,b)=>b.start-a.start);let end=raw.length;
  for(const e of edits){if(e.end>end)throw new Error('AUTHOR_MICRO: overlapping replacements');raw=raw.slice(0,e.start)+e.text+raw.slice(e.end);end=e.start;}
  return raw;
}

export function compactMicroAuthorEntries(entries) {
  const original=compileAuthorEntries(entries);
  if(original.system.authoring?.micro===MICRO_VERSION)return {files:entries,report:[]};
  const prefix='contexts/'+original.context.id+'/',docs=new Map(entries.filter(e=>e.file.endsWith('.yaml')).map(e=>[e.file,parseAuthorDoc(e.content,e.file)]));
  const replacements=new Map(),declined=[];
  for(const atom of original.authorAtoms){
    const full=atom.file.startsWith('inbox/')?atom.file:prefix+atom.file;
    transformMicroDocument(atom.doc,{mode:'compact',file:full,select:(pointer,kind,value,text)=>{
      const candidates=original.representationMappings.filter(m=>m.file===atom.file&&(m.pointer===pointer||pointer.startsWith(m.pointer+'/'))).sort((a,b)=>b.pointer.length-a.pointer.length);
      const mapping=candidates[0];
      const file=mapping?.authorFile||full;
      if(mapping&&mapping.mode!=='subtree'){declined.push({file,pointer,kind,reason:'template-expression'});return false;}
      const authorPointer=mapping?mapping.authorPointer+pointer.slice(mapping.pointer.length):pointer;
      if(JSON.stringify(at(docs.get(file),authorPointer))!==JSON.stringify(value))return false;
      const key=JSON.stringify([file,authorPointer]),prior=replacements.get(key);
      if(prior&&prior.value!==text)throw new Error('AUTHOR_MICRO: conflicting source replacement');
      replacements.set(key,{file,pointer:authorPointer,value:text,kind});return true;
    }});
  }
  const files=entries.map(entry=>{
    if(entry.file==='system.yaml'){const doc=docs.get(entry.file);doc.authoring={...doc.authoring,micro:MICRO_VERSION};return {...entry,content:emitAuthorDoc(doc)};}
    const selected=[...replacements.values()].filter(r=>r.file===entry.file).sort((a,b)=>a.pointer.length-b.pointer.length),roots=[];
    for(const r of selected)if(!roots.some(p=>r.pointer.startsWith(p.pointer+'/')))roots.push(r);
    return roots.length?{...entry,content:replaceJsonNodes(entry.content,roots)}:entry;
  });
  const result=compileAuthorEntries(files),semantic=c=>{const {authoring,...v}=c;return JSON.stringify(v);};
  if(semantic(result.canonical)!==semantic(original.canonical)) {
    const difference=(a,b,p='')=>{
      if(JSON.stringify(a)===JSON.stringify(b))return null;
      if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object')for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(k==='authoring'&&p==='')continue;const found=difference(a[k],b[k],p+'/'+escape(k));if(found)return found;}
      return {pointer:p,before:a,after:b};
    };
    throw new Error('AUTHOR_MICRO: independent semantic projection changed '+JSON.stringify(difference(original.canonical,result.canonical)));
  }
  return {files,report:[{schemaVersion:MICRO_VERSION,replacedLocations:replacements.size,templateExpressionsKept:declined.length,
    families:Object.fromEntries([...new Set([...replacements.values()].map(r=>r.kind))].map(kind=>[kind,[...replacements.values()].filter(r=>r.kind===kind).length]))}]};
}
