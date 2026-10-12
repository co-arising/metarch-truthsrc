// scala-cqrs-es — reference generator (V4-2/inc3: eight aggregate-skeleton kinds,
// Builder→Model→Template). Ported from the production CodegenMain triad; golden-master
// byte-verified against LIVE generator output (CodegenMain fresh run, 2026-10-12 —
// the checked-in golden_master snapshot predates the MANUAL-skeleton rework and is stale).
// Canonical input slots (payload pass-through, see EP_Truthsrc_Codegen_V04):
//   aggregate.pkg/ctxPackage/entity/aggregateReply/persistence, command.reply/readOnly,
//   parameter.typeImport, behaviors[].flows (command/rule/successReply),
//   factoryMethods[], canonical.framework.base, canonical.knowledgeRelease
import {
  protocolModel, rootModel, entityModel, eventHandlerModel, repositoryModel,
  factoryModel, behaviorsModel, helpersModel,
} from './builders/models.mjs';
import {
  renderProtocol, renderRoot, renderEntity, renderEventHandler, renderRepository,
  renderFactory, renderBehaviors, renderHelpers,
} from './templates/scala.mjs';

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
  'factory': 'modules/kernel',
  'behaviors': 'modules/kernel',
  'command-helpers': 'modules/kernel',
};
const emit = (a, file, kind, content) => ({
  path: `${MODULE_OF[kind] ?? 'modules/kernel'}/src/main/scala/${(a.pkg ?? 'net.imadz').replaceAll('.', '/')}/${file}`,
  content, kind, schemaCategory: 'aggregate', families: [a.name], deps: [],
});

// env: cross-cutting generation facts, mirroring internal semantics —
//   frameworkBase   = canonical.framework.base (knowledge-side: where the framework lives)
//   knowledgeRelease= canonical.knowledgeRelease (knowledge-side; line omitted when absent)
//   generatorVersion= options.generatorVersion (generator-side: host repo id at generate time;
//                     date fallback mirrors internal GeneratorVersion — never compared)
export function generate({ canonical, options = {} }) {
  const env = {
    frameworkBase: canonical.framework?.base ?? 'net.imadz.framework.common',
    knowledgeRelease: canonical.knowledgeRelease,
    generatorVersion: options.generatorVersion ?? new Date().toISOString().slice(0, 10),
  };
  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    entries.push(emit(a, `application/aggregates/${a.name}Protocol.scala`, 'protocol', renderProtocol(protocolModel(a, env))));
    entries.push(emit(a, `application/aggregates/${a.name}Aggregate.scala`, 'aggregate-root', renderRoot(rootModel(a, env))));
    entries.push(emit(a, `domain/entities/${a.name}Entity.scala`, 'entity', renderEntity(entityModel(a, env))));
    entries.push(emit(a, `domain/entities/behaviors/${a.name}EventHandler.scala`, 'event-handler', renderEventHandler(eventHandlerModel(a, env))));
    entries.push(emit(a, `application/aggregates/repository/${a.name}Repository.scala`, 'repository', renderRepository(repositoryModel(a, env))));
    entries.push(emit(a, `application/aggregates/factories/${a.name}AggregateFactory.scala`, 'factory', renderFactory(factoryModel(a, env))));
    entries.push(emit(a, `application/aggregates/behaviors/${a.name}Behaviors.scala`, 'behaviors', renderBehaviors(behaviorsModel(a, env))));
    entries.push(emit(a, `application/aggregates/behaviors/${a.name}CommandHelpers.scala`, 'command-helpers', renderHelpers(helpersModel(a, env))));
  }
  return entries;
}
