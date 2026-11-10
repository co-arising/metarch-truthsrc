import { createSagaCompiler } from './compile-pure.mjs';
import { sagaSchemaV2 } from '../products/contract-schemas-v2.mjs';
import { selectBindingCompiler } from './version-dispatch.mjs';

// Fixed package dependency, not a request-supplied schema or validator. JSON
// loading belongs to the module loader; the initialized compiler is synchronous.
const { default: schema } = await import('../../schema/saga-ir-v1.schema.json', {
  assert: { type: 'json' }, with: { type: 'json' },
});
const compile = createSagaCompiler(schema);
const compileV2 = createSagaCompiler(sagaSchemaV2);

const source = value => value.document === 'binding'
  ? { ...value, document: 'bindings', pointer: `/0${value.pointer}` } : { ...value };

// The caller supplies an already detached JSON canonical and one explicit
// binding. Keep the IR's native binding-relative sourceMap unchanged.
export function compileSagaProduct(canonical, binding) {
  const result = selectBindingCompiler(binding, 'truthsrc.saga-binding/v2', compile, compileV2)(canonical, binding);
  return { ir: result.ir, diagnostics: result.diagnostics.map(entry => ({
    ...entry, source: source(entry.source),
    ...(entry.related ? { related: entry.related.map(source) } : {}),
  })) };
}
