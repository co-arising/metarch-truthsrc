// Legacy adapters retain all versions and the original fixed Saga checker.
import { compileSagas } from './compile.mjs';
import { createRuntimeBindingCompiler } from './runtime-binding-pure.mjs';

export const { lowerSagaRuntimeBinding, lowerSagaRuntimeBindingV2,
  lowerSagaRuntimeBindingV3, validateSagaRuntimeBinding } = createRuntimeBindingCompiler(compileSagas);
