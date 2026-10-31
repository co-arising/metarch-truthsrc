import { renderAggregate, renderCommand, renderInvariant } from './render-domain.mjs';
import { renderActors } from './render-actor.mjs';
import { renderValues } from './render-values.mjs';
import { renderProto, renderConverters } from './render-serialization.mjs';
import { renderAdapters } from './render-adapters.mjs';
import { renderScaffold } from './scaffold.mjs';

const footprint = ids => ids.map(id => ({ id, version: id === 'domain-dependencies' || id === 'domain-folds' ? '6' : id === 'domain-decision' ? '4' : '1' }));
const producer = (ids, render) => Object.freeze({ version: '2', produce: context => render(context, footprint(ids)) });
export const producerRegistryV2 = Object.freeze({
  'aggregate-dsl': producer(['reference-layout', 'domain-folds', 'exact-value-types'], (c, f) => [...renderAggregate(c, f), ...renderActors(c, f)]),
  'command-dsl': producer(['reference-layout', 'domain-dependencies', 'exact-value-types'], renderCommand),
  'invariant-dsl': producer(['reference-layout', 'domain-decision', 'domain-folds', 'exact-value-types'], renderInvariant),
  'valueobject-dsl': producer(['reference-layout', 'exact-value-types'], renderValues),
  'proto-dsl': producer(['reference-layout', 'domain-dependencies', 'domain-folds', 'exact-value-types', 'exact-value-codecs'], (c, f) => [...renderProto(c, f), ...renderScaffold(c, f)]),
  'converter-dsl': producer(['reference-layout', 'domain-dependencies', 'domain-folds', 'exact-value-types', 'exact-value-codecs'], (c, f) => [...renderConverters(c, f), ...renderAdapters(c, f)]),
});
