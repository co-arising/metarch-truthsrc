import * as aggregate from '../aggregate-dsl/produce.mjs';
import * as command from '../command-dsl/produce.mjs';
import * as invariant from '../invariant-dsl/produce.mjs';
import * as valueobject from '../valueobject-dsl/produce.mjs';
import * as proto from '../proto-dsl/produce.mjs';
import * as converter from '../converter-dsl/produce.mjs';
import { planProductSet } from '../../src/core/product-plan.mjs';

const implementation = module => Object.freeze({ version: module.version, produce: module.produce });
export const producerRegistry = Object.freeze({
  'aggregate-dsl': implementation(aggregate),
  'command-dsl': implementation(command),
  'invariant-dsl': implementation(invariant),
  'valueobject-dsl': implementation(valueobject),
  'proto-dsl': implementation(proto),
  'converter-dsl': implementation(converter),
});
export function generate({ compilation, manifest, options }) {
  return planProductSet({ compilation, manifest, options }, producerRegistry);
}
