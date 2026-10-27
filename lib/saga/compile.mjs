import { createRequire } from 'node:module';
import { createSagaCompiler } from './compile-pure.mjs';

// Legacy filesystem-facing schema adapter. Preserve synchronous calls and the
// original contract, including omitted bindings and detached mutable results.
const schema = createRequire(import.meta.url)('../../schema/saga-ir-v1.schema.json');
export const compileSagas = createSagaCompiler(schema);
