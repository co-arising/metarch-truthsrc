import { artifact, emitClassicArtifacts } from '../../lib/classic-architecture/assembly.mjs';
import { buildSourceArtifacts } from '../scala-cqrs-classic-v2/produce.mjs';
import { buildClassicAggregateRoot } from '../scala-cqrs-play-service/build-classic-aggregate-root-model.mjs';
import { renderClassicAggregateRoot } from '../scala-cqrs-play-service/templates/classic-aggregate-root.mjs';
import { buildClassicAggregateFactory } from '../scala-cqrs-play-service/build-classic-aggregate-factory-model.mjs';
import { renderClassicAggregateFactory } from '../scala-cqrs-play-service/templates/classic-aggregate-factory.mjs';

export const version = '3';
function buildAggregateSourceArtifacts(product, ctx) {
  const { system, source } = product;
  return [...buildSourceArtifacts(product, ctx), ...system.application.aggregates.flatMap((meta, i) => {
    const location = { document: source.document, pointer: source.pointer + '/application/aggregates/' + i };
    const initialCommand = meta.commandFamily.commands.find(command => !command.isReadOnly && command.parameters.length !== 0);
    // The raw factory keeps its ask reply only inside bodyLogic. Record that
    // typed reference for ownership/deps without changing the Scala import list.
    const references = initialCommand ? [ctx.typeResolver.resolve(initialCommand.replyToType)] : [];
    return [artifact(buildClassicAggregateRoot(meta, ctx), renderClassicAggregateRoot, 'aggregate-root', location),
      artifact(buildClassicAggregateFactory(meta, ctx), renderClassicAggregateFactory, 'aggregate-factory', location, references)];
  })];
}

/** Nine source families, with no application bootstrap or runtime certification. */
export function produce({ products, options }) {
  return emitClassicArtifacts(products['classic-architecture'], options, version, buildAggregateSourceArtifacts);
}
