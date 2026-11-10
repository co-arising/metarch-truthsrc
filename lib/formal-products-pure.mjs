import { slug } from './shared-pure.mjs';

/** Explicit authored product residence; projection does not select, approve or normalize the payload. */
export const FORMAL_PRODUCT_SCHEMA = 'truthsrc.formal-product/v1';
export const FORMAL_PRODUCT_FAMILIES = Object.freeze({
 'module-seams-contract':'moduleSeamsContracts',
 'api-contract':'apiContracts',
 'artifact-contract':'artifactContracts',
 'technical-port':'ports',
 'saga-host':'sagaHosts',
 'workflow':'workflows',
 'effect-host':'effectHosts',
 'host-computation':'hostComputations',
 'external-event-producer':'externalEventProducers',
 'product-design':'productDesigns',
 'product-design-decision':'designDecisions',
});
export function formalIdentity(family,payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('formal product requires a complete object payload');
 if(family==='host-computation') {
  const r=payload.id;
  if(!r||typeof r!=='object'||r.kind!=='port'||!Array.isArray(r.owner)||r.owner.length||typeof r.context!=='string'||!r.context||typeof r.id!=='string'||!r.id)throw new Error('host computation requires its exact qualified port identity');
  return JSON.stringify([r.context,r.id]);
 }
 const id=family==='technical-port'?payload.name:payload.id;
 if(typeof id!=='string'||!id.trim())throw new Error('formal product requires its authored scalar identity');
 return id;
}
export function formalProductFile(family,id) {
 if(!Object.hasOwn(FORMAL_PRODUCT_FAMILIES,family)||typeof id!=='string'||!id.trim())throw new Error('unknown formal product family or missing identity');
 const stem=slug(id);if(!stem)throw new Error('formal product identity has an empty filename');
 return 'formal-products/'+family+'/'+stem+'.formal.yaml';
}
export function checkFormalProduct(doc,file) {
 if(!doc||typeof doc!=='object'||Array.isArray(doc)||doc.kind!=='formal-product')throw new Error('formal product atom kind required');
 const {kind,schemaVersion,family,id,version,payload,...headers}=doc;
 if(schemaVersion!==FORMAL_PRODUCT_SCHEMA)throw new Error('explicit supported formal product schemaVersion required');
 if(!Object.hasOwn(FORMAL_PRODUCT_FAMILIES,family)||typeof version!=='string'||!version.trim()||typeof id!=='string'||!id.trim())throw new Error('explicit formal product family/id/version required');
 if(formalIdentity(family,payload)!==id||payload.version!==version)throw new Error('formal product header identity/version differs from complete authored payload');
 if(formalProductFile(family,id)!==file)throw new Error('formal product filename differs from its declared family and identity');
 for(const [key,value]of Object.entries(headers))if(!/^\w+$/u.test(key)||!['string','number'].includes(typeof value)||(typeof value==='number'&&!Number.isSafeInteger(value)))throw new Error('formal product extra headers must be scalar authored facts');
 return {root:FORMAL_PRODUCT_FAMILIES[family],headers:{schemaVersion,family,id,version,...headers},payload};
}
