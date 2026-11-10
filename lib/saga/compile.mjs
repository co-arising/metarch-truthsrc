import { createRequire } from 'node:module';
import { createSagaCompiler } from './compile-pure.mjs';
import { sagaSchemaV2 } from '../products/contract-schemas-v2.mjs';
import { selectBindingCompiler } from './version-dispatch.mjs';

// Legacy filesystem-facing schema adapter. Preserve synchronous calls and the
// original contract, including omitted bindings and detached mutable results.
const schema = createRequire(import.meta.url)('../../schema/saga-ir-v1.schema.json');
export const compileSagasV1 = createSagaCompiler(schema);
export const compileSagasV2 = createSagaCompiler(sagaSchemaV2);
export function compileSagas(canonical, binding) {
  return selectBindingCompiler(binding, 'truthsrc.saga-binding/v2', compileSagasV1, compileSagasV2)(canonical, binding);
}
