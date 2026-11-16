import { artifact, emitClassicArtifacts } from '../../lib/classic-architecture/assembly.mjs';
import { buildAggregateArtifacts } from '../scala-cqrs-classic/produce.mjs';
import { buildValueObject } from '../scala-cqrs-domain/builders/value-object.mjs';
import { renderValueObject } from '../scala-cqrs-domain/templates/value-object.mjs';
import { buildInvariantRule } from '../scala-cqrs-domain/builders/invariant-rule.mjs';
import { renderInvariantRule } from '../scala-cqrs-domain/templates/invariant-rule.mjs';
import { buildEntityBehavior } from '../scala-cqrs-domain/builders/entity-behavior.mjs';
import { renderEntityBehavior } from '../scala-cqrs-domain/templates/entity-behavior.mjs';

export const version = '2';
export function buildSourceArtifacts(product, ctx) {
  const { system, source } = product;
  const family = (key, build, render, kind) => system.domain[key].map((meta, i) => artifact(build(meta, ctx), render, kind,
    { document: source.document, pointer: source.pointer + '/domain/' + key + '/' + i }));
  return [...buildAggregateArtifacts(product, ctx),
    ...family('valueObjects', buildValueObject, renderValueObject, 'value-object'),
    ...family('invariants', buildInvariantRule, renderInvariantRule, 'invariant-rule'),
    ...family('behaviors', buildEntityBehavior, renderEntityBehavior, 'event-handler')];
}

/** Seven declared source families, not a complete runnable application. */
export function produce({ products, options }) {
  return emitClassicArtifacts(products['classic-architecture'], options, version, buildSourceArtifacts);
}
