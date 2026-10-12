// scala-cqrs-es — reference generator (V4-2: protocol + aggregate-root, Builder→Model→Template).
// Ported from the production CodegenMain triad; golden-master byte-verified.
// Canonical input slots (payload pass-through, see EP_Truthsrc_Codegen_V04):
//   aggregate.pkg/ctxPackage/entity/aggregateReply/persistence, command.reply, parameter.typeImport
import { protocolModel, rootModel, entityModel, eventHandlerModel, repositoryModel } from './builders/models.mjs';
import { renderProtocol, renderRoot, renderEntity, renderEventHandler, renderRepository } from './templates/scala.mjs';

// di-poc multi-module layout (user ruling 2026-10-12): kind → module router.
// kernel = domain core (akka-persistence/sharding/guice deps live there); ext = repo impls +
// application flows (future kinds); glue = IO mechanism (converters/adapters, future kinds);
// root app/ = Play controllers (future kinds). File CONTENT is layout-independent (byte-stable
// vs the internal corpus); only the on-disk prefix follows the module structure.
const MODULE_OF = {
  'protocol': 'modules/kernel',
  'aggregate-root': 'modules/kernel',
  'entity': 'modules/kernel',
  'event-handler': 'modules/kernel',
  'repository': 'modules/kernel',
};
const emit = (a, file, kind, content) => ({
  path: `${MODULE_OF[kind] ?? 'modules/kernel'}/src/main/scala/${(a.pkg ?? 'net.imadz').replaceAll('.', '/')}/${file}`,
  content, kind, schemaCategory: 'aggregate', families: [a.name], deps: [],
});

export function generate({ canonical }) {
  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    entries.push(emit(a, `application/aggregates/${a.name}Protocol.scala`, 'protocol', renderProtocol(protocolModel(a))));
    entries.push(emit(a, `application/aggregates/${a.name}Aggregate.scala`, 'aggregate-root', renderRoot(rootModel(a))));
    entries.push(emit(a, `domain/entities/${a.name}Entity.scala`, 'entity', renderEntity(entityModel(a))));
    entries.push(emit(a, `domain/entities/behaviors/${a.name}EventHandler.scala`, 'event-handler', renderEventHandler(eventHandlerModel(a))));
    entries.push(emit(a, `application/aggregates/repository/${a.name}Repository.scala`, 'repository', renderRepository(repositoryModel(a))));
  }
  return entries;
}
