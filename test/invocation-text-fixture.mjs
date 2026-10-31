import { readProductRequest } from '../lib/products/cli.mjs';

export function invocationTextFixture() {
  const request = structuredClone(readProductRequest(new URL('./fixtures/inventory-invocation-products/files.json', import.meta.url).pathname));
  const document = id => request.documents.find(d => d.id === id).value;
  const pipeline = document('domain').pipelines[0];
  pipeline.execution.inputs.push({ id: 'memo', type: 'Memo', durability: 'start-record' });
  pipeline.execution.recovery.inputs.push('input:memo');
  document('sagas').sagas[0].types.push({ id: 'Memo', canonicalType: 'String', implementation: 'java.lang.String', kind: 'string', minLength: 1, maxLength: 65536 });
  document('execution').sagaBindings = structuredClone(document('sagas'));
  document('execution').pipelines[0].types.push({ id: 'Memo', implementation: 'java.lang.String' });
  return request;
}
