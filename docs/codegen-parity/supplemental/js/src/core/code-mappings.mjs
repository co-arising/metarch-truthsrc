const fail = message => { throw new Error('CODE_MAPPING: ' + message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function exactSpan(value, bytes) {
  if (!object(value) || Object.keys(value).some(k => !['start','end','text'].includes(k)) || !Number.isSafeInteger(value.start)
    || !Number.isSafeInteger(value.end) || value.start < 0 || value.end <= value.start || typeof value.text !== 'string'
    || value.end > bytes.length || !bytes.subarray(value.start,value.end).equals(Buffer.from(value.text))) fail('span does not match generated UTF-8 bytes');
}
export function validateCodeMappings(entry) {
  if (entry.codeMappings === undefined) return [];
  if (!Array.isArray(entry.codeMappings)) fail('array required');
  const bytes = Buffer.from(entry.content), seen = new Set();
  for (const mapping of entry.codeMappings) {
    if (!object(mapping) || Object.keys(mapping).some(k => !['knowledgeKey','span','scope'].includes(k))
      || !entry.knowledgeIds?.includes(mapping.knowledgeKey)) fail('unknown mapping field or knowledge association');
    exactSpan(mapping.span,bytes);exactSpan(mapping.scope,bytes);
    if (mapping.span.start < mapping.scope.start || mapping.span.end > mapping.scope.end) fail('span outside generated scope');
    const key = JSON.stringify([mapping.knowledgeKey,mapping.span.start,mapping.span.end]);
    if(seen.has(key))fail('duplicate mapping');seen.add(key);
  }
  return entry.codeMappings;
}
export function finalMappingSpan(mapping, generated, finalBytes) {
  if (finalBytes.equals(Buffer.from(generated))) return mapping.span;
  const scope = Buffer.from(mapping.scope.text), first = finalBytes.indexOf(scope);
  if (first < 0 || finalBytes.indexOf(scope,first+1) !== -1) return null;
  const start = first + mapping.span.start - mapping.scope.start, end = start + Buffer.byteLength(mapping.span.text);
  return finalBytes.subarray(start,end).equals(Buffer.from(mapping.span.text)) ? {start,end,text:mapping.span.text} : null;
}
