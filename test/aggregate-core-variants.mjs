import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { domainKernelProject } from './domain-kernel-fixture.mjs';
import { parseAuthorDoc } from '../lib/author-parse.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';

// Integration variants edit physical author atoms, then let the normal compiler
// derive products. There is no parallel editable canonical/request fixture.
export function createAggregateCoreVariant(destination, { guards = null, names = [] } = {}) {
  if (existsSync(destination)) throw new Error('aggregate-core variant requires an absent destination');
  cpSync(dirname(domainKernelProject), destination, { recursive: true, force: false, errorOnExist: true });
  const project = join(destination, 'truthsrc.project.json');
  const config = JSON.parse(readFileSync(project, 'utf8'));
  config.generator = 'scala-cqrs-aggregate-core-v1';
  config.options.names = names;
  config.options.protobuf[0].messages.push({ ref: { context: 'counter', kind: 'event', owner: ['Counter'], id: 'CountRecorded' }, role: 'event', name: 'CounterCountRecorded' });
  writeFileSync(project, JSON.stringify(config, null, 2) + '\n');
  const aggregatePath = join(destination, 'truth/domain-kernel/contexts/counter/aggregates/counter/aggregate.yaml');
  const aggregate = parseAuthorDoc(readFileSync(aggregatePath, 'utf8'), aggregatePath);
  aggregate.order.events.push('CountRecorded');
  aggregate.payload.valueExpressionProfile = 'truthsrc.domain-values/v2';
  aggregate.payload.stateFields.push(
    ...['removed', 'put', 'putAll', 'removeAll'].map(name => ({ name, dataType: 'Map[String, String]', default: [{ key: 'old', value: 'retained' }, { key: 'key', value: 'before' }] })),
    { name: 'oldValue', dataType: 'Option[String]', default: { present: false, value: null } },
    { name: 'ratioTotal', dataType: 'Ratio', default: '0.25000000000000000000000000000000000000' },
    { name: 'distanceTotal', dataType: 'Distance', default: { amount: '12', unit: 'm' } },
    { name: 'left', dataType: 'Long', default: '11' },
    { name: 'right', dataType: 'Long', default: '29' },
  );
  writeFileSync(aggregatePath, emitAuthorDoc(aggregate));
  const slicePath = join(destination, 'truth/domain-kernel/contexts/counter/aggregates/counter/slices/set-count.slice.yaml');
  const slice = parseAuthorDoc(readFileSync(slicePath, 'utf8'), slicePath);
  slice.payload.parameters.push('key: String @BUSINESS_INPUT', 'batch: "Vector[String]" @BUSINESS_INPUT', 'delta: Ratio @BUSINESS_INPUT', 'distance: Distance @BUSINESS_INPUT');
  if (guards !== null) slice.payload.guards = guards;
  slice.payload.produces.push('CountRecorded');
  const event = slice.events.CountSet;
  event.payloads.push('key: String @PROPAGATED', 'batch: "Vector[String]" @PROPAGATED', 'delta: Ratio @PROPAGATED', 'distance: Distance @PROPAGATED');
  for (const slot of ['key', 'batch', 'delta', 'distance']) event.bindings.push({ slot, expr: 'param.' + slot });
  event.foldAssignments.push(
    { slot: 'removed', op: 'remove', key: 'event.key' },
    { slot: 'put', op: 'put', key: 'event.key', value: 'literal:new' },
    { slot: 'putAll', op: 'put-all', key: 'event.batch', value: 'literal:bulk' },
    { slot: 'removeAll', op: 'remove-all', key: 'event.batch' },
    { slot: 'oldValue', expr: 'state.removed[event.key]' },
    { slot: 'ratioTotal', op: 'money-apply', delta: 'event.delta', sign: 1 },
    { slot: 'distanceTotal', op: 'money-apply', delta: 'event.distance', sign: -1 },
    { slot: 'minimum', op: 'integer-apply', delta: 'literal:1', sign: 1 },
    { slot: 'left', expr: 'state.right' },
    { slot: 'right', expr: 'state.left' },
  );
  slice.events.CountRecorded = { name: 'CountRecorded', payloads: ['id: String @PROPAGATED'], bindings: [{ slot: 'id', expr: 'param.id' }], foldAssignments: [] };
  writeFileSync(slicePath, emitAuthorDoc(slice));
  return { project, tree: join(destination, config.tree), aggregatePath, slicePath };
}
