import { MODULAR_CANDIDATE } from '../lib/scala-target/profiles.mjs';

export const ref = (id, kind = 'type') => ({ context: 'Parcel', kind, owner: [], id });
export const nominal = id => ({ form: 'nominal', ref: ref(id) });
const primitive = name => ({ form: 'primitive', name });
const field = (name, valueType) => ({ id: name, spelling: name, binding: null, valueType });
const result = (valueType, effect = 'pure') => ({ effect, valueType });
const method = (name, parameters, returns) => ({ id: name, spelling: name, binding: null, parameters, result: returns });
const value = (id, fields, variants = []) => ({ ref: ref(id), spelling: id, binding: null, module: 'kernel',
  shape: variants.length ? 'sum' : 'record', fileStem: variants.length ? 'QuoteError' : 'ParcelValues', fields, variants });
const variant = (id, fields = []) => ({ id, spelling: id, binding: null, fields });
const port = (id, role, methods) => ({ ref: ref(id, 'port'), spelling: id, binding: null, module: 'kernel', role, methods });
const component = (id, spelling, module, role, implementsPort = null, dependencies = [], requires = []) =>
  ({ id, spelling, binding: null, context: 'Parcel', module, role, implements: implementsPort && ref(implementsPort, 'port'), dependencies, requires });

export function parcelTargetInput() {
  return {
    schemaVersion: 'truthsrc.scala-target-model/v1', profile: MODULAR_CANDIDATE,
    contexts: [{ id: 'Parcel', packageName: 'example.parcel' }],
    values: [
      value('RouteId', [field('value', primitive('string'))]),
      value('ParcelId', [field('value', primitive('string'))]),
      value('Parcel', [field('id', nominal('ParcelId')), field('grams', primitive('integer'))]),
      value('Route', [field('id', nominal('RouteId')), field('capacityGrams', primitive('integer'))]),
      value('Load', [field('totalGrams', primitive('integer'))]),
      value('QuoteRequest', [field('routeId', nominal('RouteId')), field('parcels', { form: 'sequence', element: nominal('Parcel') })]),
      value('Quote', [field('routeId', nominal('RouteId')), field('load', nominal('Load'))]),
      value('QuoteError', [], [
        variant('EmptyParcels'),
        variant('InvalidCapacity', [field('routeId', nominal('RouteId')), field('capacityGrams', primitive('integer'))]),
        variant('InvalidWeight', [field('parcelId', nominal('ParcelId')), field('grams', primitive('integer'))]),
        variant('DuplicateParcel', [field('parcelId', nominal('ParcelId'))]),
        variant('OverCapacity', [field('routeId', nominal('RouteId')), field('totalGrams', primitive('integer')), field('capacityGrams', primitive('integer'))]),
        variant('WeightOverflow'), variant('UnknownRoute', [field('routeId', nominal('RouteId'))])
      ])
    ],
    ports: [
      port('CapacityPolicy', 'computation', [method('assess', [field('route', nominal('Route')), field('parcels', { form: 'sequence', element: nominal('Parcel') })],
        result({ form: 'either', left: nominal('QuoteError'), right: nominal('Load') }))]),
      port('RouteRepository', 'repository', [method('find', [field('id', nominal('RouteId'))], result({ form: 'optional', element: nominal('Route') }, 'future'))]),
      port('QuoteFlow', 'flow', [method('quote', [field('request', nominal('QuoteRequest'))], result({ form: 'either', left: nominal('QuoteError'), right: nominal('Quote') }, 'future'))])
    ],
    components: [
      component('capacity-rule', 'CapacityRule', 'kernel', 'pure-implementation'),
      component('capacity-bridge', 'CapacityPolicyBridge', 'kernel', 'bridge', 'CapacityPolicy', ['capacity-rule']),
      component('route-repository', 'InMemoryRouteRepository', 'glue', 'adapter', 'RouteRepository'),
      component('quote-flow', 'DefaultQuoteFlow', 'ext', 'extension', 'QuoteFlow', [], [ref('RouteRepository', 'port'), ref('CapacityPolicy', 'port')]),
      component('parcel-module', 'ParcelModule', 'root', 'composition', null, ['capacity-bridge', 'route-repository', 'quote-flow'])
    ],
    bindings: [
      { port: ref('CapacityPolicy', 'port'), component: 'capacity-bridge', module: 'root' },
      { port: ref('RouteRepository', 'port'), component: 'route-repository', module: 'root' },
      { port: ref('QuoteFlow', 'port'), component: 'quote-flow', module: 'root' }
    ]
  };
}
