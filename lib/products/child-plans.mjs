import { createExecutionCompiler } from '../execution/compile-pure.mjs';
import { createSagaCompiler } from '../saga/compile-pure.mjs';
import { executionSchema, sagaSchema } from './contract-schemas.mjs';
import { array, at, equal, fail, object, resolve, text, unique } from './request.mjs';
import { declaration } from '../domain-products/values.mjs';
const {compileExecution}=createExecutionCompiler(executionSchema,sagaSchema,createSagaCompiler(sagaSchema));

/** Explicit child whole plans, separately versioned from the unchanged execution@1 product. */
export function compileChildPlans(binding,canonical,layout,execution) {
 object(binding.value,['schemaVersion','plans'],at(binding.id));
 if(binding.value.schemaVersion!=='truthsrc.child-plan-binding/v1')fail('CHILD_PLAN_VERSION','explicit child binding version required',at(binding.id));
 const plans=array(binding.value.plans,at(binding.id,'/plans')).map((row,index)=>{
  const source=at(binding.id,'/plans/'+index);object(row,['ref','version','binding'],source);text(row.version,source);
  const d=declaration(row.ref,layout,source);
  if(d.ref.kind!=='pipeline'||d.source.document!==canonical.id)fail('CHILD_PLAN_SOURCE','child must identify its exact canonical pipeline',source);
  const body=resolve(canonical.value,d.source.pointer,d.source),monarch=body.monarch,typed=monarch?.typedPlan;
  if(body.id!==row.ref.id||Object.hasOwn(body,'execution')||!typed)fail('CHILD_PLAN_SOURCE','separate full typed monarch plan required, not a narrative ID',source);
  object(typed,['schemaVersion','version','inputs','outputs','steps','recovery','admission'],d.source);
  if(typed.schemaVersion!=='truthsrc.child-plan/v1'||typed.version!==row.version||typed.recovery.planVersion!==row.version||row.binding.codec.version!==row.version)fail('CHILD_PLAN_VERSION','exact child plan, checkpoint and codec version required',source);
  if(monarch.engine!==row.binding.engine||!equal(body.steps.map(s=>s.id),typed.steps.map(s=>s.id))||!equal(monarch.stages.map(s=>s.cursor),typed.steps.map(s=>s.id)))fail('CHILD_PLAN_ORDER','full declared child stage order must match, without insertion',source);
  if(row.binding.pipelineId!==body.id||Object.hasOwn(row.binding,'invocations')||Object.hasOwn(row.binding,'childRuns')||typed.steps.some(s=>!s.execution?.port)||row.binding.ports.some(p=>p.effect!=='pure'))fail('CHILD_PLAN_FINITE','child profile is finite typed pure ports only, not implicit nested effects',source);
  const input={schemaVersion:'truthsrc/v1',workshop:canonical.value.workshop,pipelines:[{id:body.id,name:body.name,steps:typed.steps,execution:{schemaVersion:'truthsrc.execution/v1',inputs:typed.inputs,outputs:typed.outputs,recovery:typed.recovery,admission:typed.admission}}]};
  const result=compileExecution(input,{schemaVersion:'truthsrc.execution-binding/v1',pipelines:[row.binding]});
  if(result.diagnostics.length)fail('CHILD_PLAN_SEMANTICS',JSON.stringify(result.diagnostics),source);
  const pipeline=result.ir.pipelines[0];
  for(const pin of pipeline.binding.types){
   const types=layout.declarations.filter(d=>d.ref.context===row.ref.context&&d.ref.kind==='type'&&d.ref.id===pin.id);
   if(types.length!==1)fail('CHILD_PLAN_TYPE','every child value requires one exact qualified nominal type',source);
  }
  if(pipeline.admission.maxConcurrentRuns!==1||pipeline.admission.maxInFlightChunks!==1)fail('CHILD_PLAN_FINITE','single run/chunk admission required',source);
  return {ref:row.ref,version:row.version,source:d.source,bindingSource:source,pipeline};
 });
 unique(plans.map(p=>JSON.stringify(p.ref)),'CHILD_PLAN_DUPLICATE',at(binding.id,'/plans'));
 const children=execution.pipelines.flatMap(p=>p.steps.filter(s=>s.awaitChildRun).map(s=>({p,s})));
 for(const {p,s}of children){
  const op=s.awaitChildRun,rows=plans.filter(c=>c.ref.id===op.childRun.planRef.pipelineId),pin=p.binding.childRuns.find(c=>c.stepId===s.id);
  if(rows.length!==1||!pin)fail('CHILD_PLAN_REQUIRED','each await must have exactly one full admitted child plan',at(binding.id,'/plans'));
  const child=rows[0].pipeline;
  if(!equal(op.childRun.payload.map(m=>({id:m.slot,type:m.type})),child.inputs.map(i=>({id:i.id,type:i.type}))))fail('CHILD_PLAN_PAYLOAD','whole ordered child input signature must equal exact await payload',rows[0].source);
  const outputs=op.results.find(r=>r.resultKind==='succeeded').outputs;
  if(!equal(outputs.map(o=>({id:o.ref.slice(7),type:o.type})),child.outputs.map(o=>({id:o.id,type:o.type}))))fail('CHILD_PLAN_RESULT','whole child typed outputs must equal succeeded result field lineage',rows[0].source);
  for(const t of child.binding.types){const parent=p.binding.types.find(x=>x.id===t.id);if(!parent||parent.implementation!==t.implementation)fail('CHILD_PLAN_TYPE','exact parent/child implementation pins required',rows[0].source);}
 }
 if(plans.some(c=>!children.some(({s})=>s.awaitChildRun.childRun.planRef.pipelineId===c.ref.id)))fail('CHILD_PLAN_UNUSED','child plan must be explicitly consumed, not hidden extra input',at(binding.id,'/plans'));
 return {plans};
}
