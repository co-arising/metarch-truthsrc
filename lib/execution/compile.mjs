import { createRequire } from 'node:module';
import { compileSagas } from '../saga/compile.mjs';
import { createExecutionCompiler } from './compile-pure.mjs';

// Static schema loading stays in the legacy adapter, never in the pure kernel.
const require = createRequire(import.meta.url);
const compiler = createExecutionCompiler(require('../../schema/execution-ir-v1.schema.json'),
  require('../../schema/saga-ir-v1.schema.json'), compileSagas);
export const { compileExecution, validateExecutionDeclarations } = compiler;
