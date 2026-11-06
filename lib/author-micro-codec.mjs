import { parseStrictJson } from './strict-json.mjs';

export const MICRO_VERSION = 'truthsrc.micro/v1';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, expected) => object(v) && JSON.stringify(Object.keys(v)) === JSON.stringify(expected);
const fail = message => { throw new Error('AUTHOR_MICRO: ' + message); };
const atom = v => typeof v === 'string' && /^[A-Za-z0-9_.+\-]+$/.test(v) ? v : JSON.stringify(v);
const string = raw => {
  if (raw.startsWith('"')) { let v; try { v = JSON.parse(raw); } catch { fail('invalid quoted string'); } if (typeof v !== 'string') fail('string required'); return v; }
  if (!/^[A-Za-z0-9_.+\-]+$/.test(raw)) fail('quote text containing punctuation or whitespace');
  return raw;
};
const enc = v => encodeURIComponent(v).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const dec = v => { try { if (!v || /%(?![0-9a-fA-F]{2})/.test(v)) fail('invalid encoded segment'); return decodeURIComponent(v); } catch { fail('invalid encoded segment'); } };
const prefix = (text, start, end = ')') => {
  if (!text.startsWith(start) || !text.endsWith(end)) fail('expected ' + start + '…' + end);
  return text.slice(start.length, -end.length);
};
function split(text, separator) {
  const result = []; let start = 0, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { depth--; if (depth < 0) fail('unbalanced delimiter'); }
    if (depth === 0 && text.startsWith(separator, i)) { result.push(text.slice(start, i)); i += separator.length - 1; start = i + 1; }
  }
  if (quoted || depth !== 0) fail('unclosed string or delimiter');
  result.push(text.slice(start)); return result;
}
const pair = (text, separator) => { const parts = split(text, separator); if (parts.length !== 2) fail('expected one ' + separator); return parts; };
function refBody(ref) { return enc(ref.context) + ':' + ref.kind + ref.owner.map(v => '/' + enc(v)).join('') + '#' + enc(ref.id); }
function parseRef(body) {
  const [left, id] = pair(body, '#'), [context, rest] = pair(left, ':');
  const [kind, ...owner] = rest.split('/');
  if (!['type','aggregate','artifact','port','saga','pipeline','state-field','command','event','member','parameter','event-slot'].includes(kind)) fail('unknown reference kind');
  return { context: dec(context), kind, owner: owner.map(dec), id: dec(id) };
}
const qualified = v => keys(v,['context','kind','owner','id']) && typeof v.context === 'string' && typeof v.kind === 'string' && Array.isArray(v.owner) && v.owner.every(x=>typeof x==='string') && typeof v.id==='string';
function typeBody(v, depth=0) {
  if (depth > 64) fail('type nesting exceeds 64');
  if (keys(v,['form','name']) && v.form === 'primitive') return 'primitive:' + enc(v.name);
  if (keys(v,['form','ref']) && v.form === 'nominal' && qualified(v.ref)) return 'nominal:' + refBody(v.ref);
  if (keys(v,['form','element']) && ['optional','sequence'].includes(v.form)) return v.form + ':' + typeBody(v.element,depth+1);
  if (keys(v,['form','key','value']) && v.form === 'map') return 'map(' + typeBody(v.key,depth+1) + ',' + typeBody(v.value,depth+1) + ')';
  if (keys(v,['form','members']) && v.form === 'record' && Array.isArray(v.members) && v.members.length && v.members.every(qualified)) return 'record(' + v.members.map(refBody).join(';') + ')';
  fail('unsupported type shape');
}
function parseType(raw, depth=0) {
  if (depth > 64) fail('type nesting exceeds 64');
  if (raw.startsWith('primitive:')) { const name=dec(raw.slice(10)); if(!['string','boolean','integer','decimal'].includes(name)) fail('unknown primitive'); return {form:'primitive',name}; }
  if (raw.startsWith('nominal:')) return {form:'nominal',ref:parseRef(raw.slice(8))};
  for(const form of ['optional','sequence']) if(raw.startsWith(form+':')) return {form,element:parseType(raw.slice(form.length+1),depth+1)};
  if(raw.startsWith('map(')) { const parts=split(prefix(raw,'map('),','); if(parts.length!==2)fail('map requires two types');return {form:'map',key:parseType(parts[0],depth+1),value:parseType(parts[1],depth+1)}; }
  if(raw.startsWith('record(')){const body=prefix(raw,'record(');if(!body)fail('record requires members');return {form:'record',members:split(body,';').map(parseRef)};}
  fail('unsupported type');
}
function kwargs(text, expected, numeric=[]) {
  const result = {};
  for (const part of split(text, ', ')) {
    const [key, raw] = pair(part, '=');
    if (!expected.includes(key) || Object.hasOwn(result,key)) fail('unknown or duplicate argument ' + key);
    const value = numeric.includes(key) ? (raw === '+1' || raw === '1' ? 1 : raw === '-1' ? -1 : fail('sign must be +1 or -1')) : string(raw);
    Object.defineProperty(result,key,{value,enumerable:true});
  }
  if(expected.some(k=>!Object.hasOwn(result,k)))fail('missing argument');
  return result;
}
const guardArgs = { 'money-positive':['amount'], 'money-sufficient':['amount','in'], 'map-absent':['map','key'], 'map-contains':['map','key'], 'collection-covered':['map','collection'] };
const foldArgs = { put:['key','value'], 'put-all':['key','value'], remove:['key'], 'remove-all':['key'], set:['value'], 'integer-apply':['delta','sign'], 'money-apply':['delta','sign'] };
function call(raw, heads) { const m=/^([a-z-]+)\((.*)\)$/s.exec(raw);if(!m||!Object.hasOwn(heads,m[1]))fail('unknown operation');return [m[1],kwargs(m[2],heads[m[1]],['sign'])]; }
const argumentsText = (v, fields) => fields.map(k=>k+'='+(k==='sign' ? v[k]===1?'+1':'-1' : atom(v[k]))).join(', ');

export function parseMicro(text, kind) {
  if(typeof text!=='string'||text.length>65536)fail('bounded micro string required');
  if(kind==='ref') return parseRef(prefix(text,'@ref('));
  if(kind==='pin'){const [ref,version]=pair(prefix(text,'@pin('),'@');return {ref:parseRef(ref),version:dec(version)};}
  if(kind==='type')return parseType(prefix(text,'@type('));
  if(['origin-field','field','slot','state-field'].includes(kind)) {
    const [rawName,rhs]=pair(text,': '), name=string(rawName);
    if(kind==='origin-field'){const [dataType,origin]=pair(rhs,' @');return {name,dataType:string(dataType),origin:string(origin)};}
    if(kind==='state-field'){const [dataType,value]=pair(rhs,' = ');let def;try{def=parseStrictJson(value);}catch{fail('invalid or non-exact default JSON');}return {name,dataType:string(dataType),default:def};}
    return kind==='slot'?{slot:name,type:string(rhs)}:{name,dataType:string(rhs)};
  }
  if(kind==='rule'){const [ids,desc]=pair(prefix(text,'@rule('),' | '),[ruleId,errCode]=pair(ids,'/');return {ruleId:dec(ruleId),errCode:dec(errCode),desc:string(desc)};}
  if(kind==='guard'){
    const m=/^@guard\[(invariantRef|when)\]\((.*)\)$/s.exec(text);if(!m)fail('invalid guard');
    const [head,body]=pair(m[2],': '), space=head.indexOf(' ');if(space<0)fail('missing guard outcome');
    const onFail=head.slice(0,space);if(!['reject','succeed-empty'].includes(onFail))fail('unknown guard outcome');
    const [id,code]=pair(head.slice(space+1),'/');
    if(m[1]==='invariantRef')return {kind:'invariantRef',ref:dec(id),errCode:dec(code),cond:string(body),onFail};
    const [form,args]=call(body,guardArgs);return {ruleId:dec(id),errCode:dec(code),onFail,when:{form,...args}};
  }
  if(kind==='binding'){
    const [left,right]=pair(text,' <- '),slot=string(left);
    if(right.startsWith('@host(')){const [ref,version]=pair(prefix(right,'@host('),'@');return {slot,expr:{form:'host',id:parseRef(ref),version:dec(version)}};}
    return {slot,expr:string(right)};
  }
  if(kind==='typed-binding'){
    const [left,right]=pair(text,' <- '),[ref,type]=pair(right,' : ');return {slot:string(left),ref:string(ref),type:string(type)};
  }
  if(kind==='fold'){
    const [left,right]=pair(text,' := '),slot=string(left);
    if(!right.startsWith('@fold['))return {slot,expr:string(right)};
    const m=/^@fold\[([a-z-]+)\]\((.*)\)$/s.exec(right);if(!m||!Object.hasOwn(foldArgs,m[1]))fail('unknown fold');
    return {slot,op:m[1],...kwargs(m[2],foldArgs[m[1]],['sign'])};
  }
  fail('unknown micro family '+kind);
}
export function compactMicro(value, kind) {
  let text;
  try {
    if(kind==='ref'&&qualified(value))text='@ref('+refBody(value)+')';
    else if(kind==='pin'&&keys(value,['ref','version'])&&qualified(value.ref)&&typeof value.version==='string')text='@pin('+refBody(value.ref)+'@'+enc(value.version)+')';
    else if(kind==='type')text='@type('+typeBody(value)+')';
    else if(kind==='origin-field'&&keys(value,['name','dataType','origin']))text=atom(value.name)+': '+atom(value.dataType)+' @'+atom(value.origin);
    else if(kind==='field'&&keys(value,['name','dataType']))text=atom(value.name)+': '+atom(value.dataType);
    else if(kind==='slot'&&keys(value,['slot','type']))text=atom(value.slot)+': '+atom(value.type);
    else if(kind==='state-field'&&keys(value,['name','dataType','default']))text=atom(value.name)+': '+atom(value.dataType)+' = '+JSON.stringify(value.default);
    else if(kind==='rule'&&keys(value,['ruleId','errCode','desc']))text='@rule('+enc(value.ruleId)+'/'+enc(value.errCode)+' | '+atom(value.desc)+')';
    else if(kind==='guard'){
      if(keys(value,['kind','ref','errCode','cond','onFail'])&&value.kind==='invariantRef')text='@guard[invariantRef]('+value.onFail+' '+enc(value.ref)+'/'+enc(value.errCode)+': '+atom(value.cond)+')';
      else if(keys(value,['ruleId','errCode','onFail','when'])&&Object.hasOwn(guardArgs,value.when?.form)&&keys(value.when,['form',...guardArgs[value.when.form]]))text='@guard[when]('+value.onFail+' '+enc(value.ruleId)+'/'+enc(value.errCode)+': '+value.when.form+'('+argumentsText(value.when,guardArgs[value.when.form])+'))';
    } else if(kind==='binding'&&keys(value,['slot','expr'])){
      if(typeof value.expr==='string')text=atom(value.slot)+' <- '+atom(value.expr);
      else if(keys(value.expr,['form','id','version'])&&value.expr.form==='host'&&qualified(value.expr.id)&&typeof value.expr.version==='string')text=atom(value.slot)+' <- @host('+refBody(value.expr.id)+'@'+enc(value.expr.version)+')';
    } else if(kind==='typed-binding'&&keys(value,['slot','ref','type']))text=atom(value.slot)+' <- '+atom(value.ref)+' : '+atom(value.type);
    else if(kind==='fold'){
      if(keys(value,['slot','expr']))text=atom(value.slot)+' := '+atom(value.expr);
      else if(Object.hasOwn(foldArgs,value.op)&&keys(value,['slot','op',...foldArgs[value.op]])&&(!foldArgs[value.op].includes('sign')||value.sign===1||value.sign===-1))text=atom(value.slot)+' := @fold['+value.op+']('+argumentsText(value,foldArgs[value.op])+')';
    }
    if(text!==undefined&&JSON.stringify(parseMicro(text,kind))===JSON.stringify(value))return text;
  } catch {}
  return null;
}
