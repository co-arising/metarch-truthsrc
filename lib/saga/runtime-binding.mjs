// Legacy lowering versions retain the fixed v1 Saga checker; v4 opts into v2.
import { compileSagasV1, compileSagasV2 } from './compile.mjs';
import { createRuntimeBindingCompiler } from './runtime-binding-pure.mjs';

export const { lowerSagaRuntimeBinding, lowerSagaRuntimeBindingV2,
  lowerSagaRuntimeBindingV3, lowerSagaRuntimeBindingV4, validateSagaRuntimeBinding } = createRuntimeBindingCompiler(compileSagasV1, compileSagasV2);
