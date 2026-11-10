import { createRequire } from 'node:module';
import { compileSagasV1, compileSagasV2 } from '../saga/compile.mjs';
import { selectBindingCompiler } from '../saga/version-dispatch.mjs';
import { executionSchemaV2, sagaSchemaV2 } from '../products/contract-schemas-v2.mjs';
import { createExecutionCompiler } from './compile-pure.mjs';

// Static schema loading stays in the legacy adapter, never in the pure kernel.
const require = createRequire(import.meta.url);
const compiler = createExecutionCompiler(require('../../schema/execution-ir-v1.schema.json'),
  require('../../schema/saga-ir-v1.schema.json'), compileSagasV1);
const current = createExecutionCompiler(executionSchemaV2, sagaSchemaV2, compileSagasV2);
export function compileExecution(canonical, binding) {
  return selectBindingCompiler(binding, 'truthsrc.execution-binding/v2', compiler.compileExecution, current.compileExecution)(canonical, binding);
}
export function validateExecutionDeclarations(pipeline) {
  return selectBindingCompiler(pipeline?.execution, 'truthsrc.execution/v2', compiler.validateExecutionDeclarations, current.validateExecutionDeclarations)(pipeline);
}
