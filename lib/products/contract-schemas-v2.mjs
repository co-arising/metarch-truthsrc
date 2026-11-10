import { copyImmutableData } from '../immutable-data.mjs';
import { sagaSchema, executionSchema } from './contract-schemas.mjs';

const saga = structuredClone(sagaSchema);
saga.$id = 'https://madpolaris.dev/contracts/saga-ir-v2.schema.json';
saga.title = 'Saga v2 typed result-port and per-interaction recovery contract';
saga.description = 'Static serial TCC with exact participant receipt dataflow, typed result-port completion and explicit authorized recovery. No automatic phase retries or total transaction deadline. Runtime qualification is separate.';
saga.properties.schemaVersion.const = 'truthsrc.saga-ir/v2';
saga.$defs.payload.properties.schemaVersion.const = 'truthsrc.saga/v2';
saga.$defs.bindingDocument.properties.schemaVersion.const = 'truthsrc.saga-binding/v2';
saga.$defs.codecId = { type: 'string', minLength: 1, maxLength: 128,
  pattern: '^[A-Za-z][A-Za-z0-9_-]*(?:\\.[A-Za-z][A-Za-z0-9_-]*)*(?![\\s\\S])' };
saga.$defs.sagaBinding.properties.codec.properties.id = { $ref: '#/$defs/codecId' };
saga.$defs.payload.properties.argsType = { $ref: '#/$defs/id' };
saga.$defs.ref.pattern = '^(?:args|txid|args:[A-Za-z][A-Za-z0-9_-]*|step:[A-Za-z][A-Za-z0-9_-]*:(?:prepare|commit|compensate):[A-Za-z][A-Za-z0-9_-]*)(?![\\s\\S])';
saga.$defs.completion = {
  type: 'object', required: ['kind', 'portRef', 'bindings'], properties: {
    kind: { $ref: '#/$defs/resultKind' },
    portRef: { type: 'object', required: ['name', 'version'], properties: {
      name: { $ref: '#/$defs/text' }, version: { $ref: '#/$defs/id' },
    }, additionalProperties: false },
    bindings: { $ref: '#/$defs/mappings' },
  }, additionalProperties: false,
};
saga.$defs.resultPort = {
  type: 'object', required: ['schemaVersion', 'name', 'version', 'payloadType', 'delivery', 'query'], properties: {
    schemaVersion: { const: 'truthsrc.saga-result-port/v1' },
    name: { $ref: '#/$defs/text' }, version: { $ref: '#/$defs/id' }, context: { $ref: '#/$defs/text' },
    payloadType: { $ref: '#/$defs/text' }, delivery: { const: 'durable-keyed-terminal' },
    query: { const: 'read-only-original-identity' },
  }, additionalProperties: false,
};
saga.$defs.resilience = {
  description: 'One automatic phase attempt; each execute/query has a finite interaction timeout. Resuming a recovered transaction requires an explicitly authorized bounded Reconcile. There is no total transaction deadline.',
  type: 'object', required: ['mode', 'interactionTimeoutMs', 'automaticPhaseAttempts', 'recovery', 'maxReconcileInteractions', 'totalDeadline'], properties: {
    mode: { const: 'per-interaction' }, interactionTimeoutMs: { $ref: '#/$defs/limit' },
    automaticPhaseAttempts: { const: 1 }, recovery: { const: 'explicit-authorized' },
    maxReconcileInteractions: { type: 'integer', minimum: 1, maximum: 1024 },
    totalDeadline: { const: 'unsupported' },
  }, additionalProperties: false,
};
saga.$defs.phases = {
  type: 'object', required: ['prepare', 'commit', 'compensate'], properties: Object.fromEntries(
    ['prepare', 'commit', 'compensate'].map(phase => [phase, structuredClone(saga.$defs.phase.oneOf[1])])),
  additionalProperties: false,
};
for (const family of ['ports', 'valueObjects', 'types']) saga.$defs.canonical.properties[family] = { type: 'array' };
saga.$defs.compiledSaga.required.push('resultPort');
saga.$defs.compiledSaga.properties.resultPort = {
  type: 'object', required: ['declaration', 'payload'], properties: {
    declaration: { $ref: '#/$defs/resultPort' },
    payload: { type: 'object', required: ['name', 'fields'], properties: {
      name: { $ref: '#/$defs/text' }, fields: { type: 'array', minItems: 1 },
    }, additionalProperties: true },
  }, additionalProperties: false,
};
export const sagaSchemaV2 = copyImmutableData(saga);

function sagaReferences(value) {
  if (Array.isArray(value)) return value.map(sagaReferences);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    key === '$ref' && typeof entry === 'string' && entry.startsWith('saga-ir-v1.schema.json#/')
      ? entry.replace('saga-ir-v1.schema.json#/', 'saga-ir-v2.schema.json#/') : sagaReferences(entry)]));
  return value;
}
const execution = sagaReferences(executionSchema);
execution.$defs.invocationCodec.properties.id = { $ref: 'saga-ir-v2.schema.json#/$defs/codecId' };
execution.$id = 'https://madpolaris.dev/truthsrc/schema/execution-ir-v2.schema.json';
execution.title = 'Truthsrc versioned Monarch execution IR v2';
execution.description = 'Explicit versioned or managed Monarch R2 runs. Pure calls remain pure; external calls require stable managed-operation bindings. Typed Saga result ports and authorized recovery retain the original identity. Static contract only, not runtime qualification.';
execution.properties.schemaVersion.const = 'truthsrc.execution/v2';
execution.$defs.execution.properties.schemaVersion.const = 'truthsrc.execution/v2';
execution.$defs.bindingDocument.properties.schemaVersion.const = 'truthsrc.execution-binding/v2';
for (const key of ['pipelineBinding', 'bindingIr']) {
  execution.$defs[key].properties.engine.const = 'monarch-persistence/0.3.0-dev.r2-20261106-dc168f96fa62';
  execution.$defs[key].required.push('run');
  execution.$defs[key].properties.run = { $ref: '#/$defs/versionedRun' };
  delete execution.$defs[key].properties.childRuns;
}
execution.$defs.versionedRun = {
  type: 'object', required: ['definitionId', 'definitionVersion', 'codecVersion', 'mode', 'identity', 'operations'], properties: {
    definitionId: { $ref: '#/$defs/text' }, definitionVersion: { $ref: '#/$defs/text' },
    codecVersion: { $ref: '#/$defs/text' }, mode: { enum: ['versioned', 'managed'] },
    identity: { const: 'caller-supplied-exact' },
    operations: { type: 'array', maxItems: 1024, items: { $ref: '#/$defs/managedOperation' } },
  }, additionalProperties: false,
};
execution.$defs.managedOperation = {
  type: 'object', required: ['stepId', 'connectorId', 'connectorVersion', 'ledgerEpoch', 'requestCodec', 'identity', 'query'], properties: {
    stepId: { $ref: '#/$defs/id' }, connectorId: { $ref: '#/$defs/text' },
    connectorVersion: { $ref: '#/$defs/text' }, ledgerEpoch: { $ref: '#/$defs/text' },
    requestCodec: { $ref: '#/$defs/codec' }, identity: { const: 'original-run-step' },
    query: { const: 'read-only-original-request' },
  }, additionalProperties: false,
};
execution.$defs.stepExecution.oneOf = execution.$defs.stepExecution.oneOf.filter(branch => branch.$ref !== '#/$defs/awaitChildRunStepExecution');
execution.$defs.stepIr.oneOf = execution.$defs.stepIr.oneOf.filter(branch => branch.$ref !== '#/$defs/awaitChildRunStepIr');
execution.$defs.sagaResultMapping.description = 'Exact five-result mapping. Only succeeded publishes typed result-port payload fields; unknown and recovery-required never advance a successful checkpoint.';
export const executionSchemaV2 = copyImmutableData(execution);
