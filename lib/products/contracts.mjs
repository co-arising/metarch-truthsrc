import { createSagaCompiler } from '../saga/compile-pure.mjs';
import { createExecutionCompiler } from '../execution/compile-pure.mjs';
import { createRuntimeBindingCompiler } from '../saga/runtime-binding-pure.mjs';
import { sagaSchema, executionSchema } from './contract-schemas.mjs';
import { sagaSchemaV2, executionSchemaV2 } from './contract-schemas-v2.mjs';
import { at, equal, fail, ProductError } from './request.mjs';

const compileSagas = createSagaCompiler(sagaSchema);
const compileSagasV2 = createSagaCompiler(sagaSchemaV2);
const { compileExecution } = createExecutionCompiler(executionSchema, sagaSchema, compileSagas);
const { compileExecution: compileExecutionV2 } = createExecutionCompiler(executionSchemaV2, sagaSchemaV2, compileSagasV2);
const { lowerSagaRuntimeBindingV3, lowerSagaRuntimeBindingV4 } = createRuntimeBindingCompiler(compileSagas, compileSagasV2);

function checked(result, roles, runtime = false) {
  if (result.diagnostics.length) {
    const source = value => {
      if (!runtime) return at(roles[value.document], value.pointer);
      const match = value.match(/^\/(canonical|binding|runtimeBinding)(?=\/|$)/u);
      return match ? at(roles[match[1]], value.slice(match[0].length)) : at('request', value);
    };
    const diagnostics = result.diagnostics.map(d => ({ code: d.code, message: d.message,
      source: source(runtime ? d.pointer : d.source),
      related: (d.related ?? []).map(source),
    })).sort((a, b) => {
      const x = JSON.stringify([a.source.document, a.source.pointer, a.code, a.message]);
      const y = JSON.stringify([b.source.document, b.source.pointer, b.code, b.message]);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    const first = diagnostics[0], error = new ProductError(first.code, first.message, first.source, first.related);
    error.diagnostics = diagnostics;
    throw error;
  }
  if (!result.ir) fail('PRODUCT_COMPILER', 'the complete checker did not return a contract');
  return result.ir;
}

/** All formal dispatch uses the existing entire checker, not asserted payloads. */
export function compileContract(id, requirement, documents, products, requirements) {
  const roles = requirement.inputRoles, canonical = documents.get(roles.canonical), binding = documents.get(roles.sagaBinding);
  const current = requirement.version === '2';
  if (id === 'saga-contract') return checked((current ? compileSagasV2 : compileSagas)(canonical.value, binding.value),
    { canonical: canonical.id, binding: binding.id });
  const sagaRequirement = requirements.get('saga-contract');
  if (!sagaRequirement || sagaRequirement.inputRoles.canonical !== canonical.id || sagaRequirement.inputRoles.sagaBinding !== binding.id)
    fail('PRODUCT_ROLE', 'execution and runtime must consume the same explicit canonical and full Saga binding as their required Saga product');
  const compiledSagas = products.get('saga-contract');
  if (id === 'execution-contract') {
    const execution = documents.get(roles.executionBinding);
    if (!Object.hasOwn(execution.value, 'sagaBindings') || !equal(execution.value.sagaBindings, binding.value))
      fail('PRODUCT_NESTED_BINDING', 'execution embedded Saga binding must entirely equal its explicit Saga role', at(execution.id, '/sagaBindings'), [at(binding.id)]);
    const result = checked((current ? compileExecutionV2 : compileExecution)(canonical.value, execution.value), { canonical: canonical.id, binding: execution.id });
    if (!equal(result.sagas ?? [], compiledSagas.sagas)) fail('PRODUCT_PAYLOAD_MISMATCH', 'execution full Saga closure differs from its required product');
    if (current) return { ...result, sourceMap: Object.fromEntries(Object.entries(result.sourceMap).map(([pointer, source]) => [pointer,
      { ...source, document: source.document === 'canonical' ? canonical.id : source.document === 'binding' ? execution.id : source.document }])) };
    return result;
  }
  const runtime = documents.get(roles.runtimeBinding);
  return checked((current ? lowerSagaRuntimeBindingV4 : lowerSagaRuntimeBindingV3)({ canonical: canonical.value, binding: binding.value,
    runtimeBinding: runtime.value, ir: compiledSagas }),
  { canonical: canonical.id, binding: binding.id, runtimeBinding: runtime.id }, true);
}
