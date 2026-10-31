import {designRequest} from './product-design-fixtures.mjs';
import {deriveProductDesigns} from '../lib/products/designs.mjs';
export function largeDesignRequest(count=3){
 const r=structuredClone(designRequest());
 const c=r.documents[0],layout=r.documents.find(d=>d.id==='references').value.layout;
 const base=structuredClone(c.value.productDesigns[0]);
 c.value.productDesigns=[];
 layout.declarations=layout.declarations.filter(d=>!d.source.pointer.startsWith('/productDesigns/'));
 for(let i=0;i<count;i++){
  const design=structuredClone(base);design.id='inspection-review-'+i;design.artifact={...design.artifact,id:'InspectionReview'+i};design.status='proposal';design.approvalSource=null;
  design.relations.forEach(row=>{row.from.artifact=design.artifact;row.to.artifact=design.artifact;});
  c.value.productDesigns.push(design);
  layout.declarations.push({ref:design.artifact,valueType:null,source:{document:'domain',pointer:'/productDesigns/'+i},dependencies:[]});
 }
 r.documents.find(d=>d.id==='designs').value.designs=deriveProductDesigns(c,layout);return r;
}
