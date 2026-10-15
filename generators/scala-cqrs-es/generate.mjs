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
import { valueObjectModel } from './builders/valueObjects.mjs';
import {
  renderProtocol, renderRoot, renderEntity, renderEventHandler, renderRepository,
  renderFactory, renderBehaviors, renderHelpers,
} from './templates/scala.mjs';
import { renderValueObject } from './templates/valueObject.mjs';

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
// meta.schemaNode/deps feed the concerns ledger (live GenerationLedger row parity): schemaNode
// is the domain node the row materializes (aggregate name, or the file's own class), deps are
// the generated-artifact identifiers this file compiles against (class names = file stems;
// external library types are not listed — they resolve to no ledger row and drop out of the
// closure harmlessly, exactly like the live ledger). schemaCategory follows live: the two
// state-carrier kinds are 'entity', the rest 'aggregate'.
const emit = (a, file, kind, content, meta = {}) => {
  const pkgPath = `${a.pkg ?? 'net.imadz'}${a.ctxPackage ? `.${a.ctxPackage}` : ''}`.replaceAll('.', '/');
  return {
    path: `${MODULE_OF[kind] ?? 'modules/kernel'}/src/main/scala/${pkgPath}/${file}`,
    content, kind,
    schemaCategory: kind === 'entity' || kind === 'event-handler' ? 'entity' : 'aggregate',
    schemaNode: meta.schemaNode,
    families: [a.name],
    deps: meta.deps ?? [],
  };
};

// env: cross-cutting generation facts, mirroring internal semantics —
//   frameworkBase   = canonical.framework.base (knowledge-side: where the framework lives)
//   knowledgeRelease= canonical.knowledgeRelease (knowledge-side; line omitted when absent)
//   generatorVersion= options.generatorVersion (generator-side: host repo id at generate time;
//                     date fallback mirrors internal GeneratorVersion — never compared)
//   anchor(noteId)  = `@<hash16>` looked up from options.elementHashes (knowledge-side sidecar,
//                     keyed by noteId, exactly like the internal elementHashes map); miss → ''.
//   excludedStateFieldNatures = canonical slot (concern-anchored nature exclusion —
//                     GeneratorContext.isStateFieldExcluded port; empty/absent = no exclusion).
export function generate({ canonical, options = {} }) {
  const hashes = options.elementHashes ?? {};
  const env = {
    frameworkBase: canonical.framework?.base ?? 'net.imadz.framework.common',
    knowledgeRelease: canonical.knowledgeRelease,
    generatorVersion: options.generatorVersion ?? new Date().toISOString().slice(0, 10),
    anchor: (noteId) => (hashes[noteId] ? `@${hashes[noteId]}` : ''),
    excludedStateFieldNatures: canonical.excludedStateFieldNatures ?? [],
  };
  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    entries.push(emit(a, `application/aggregates/${a.name}Protocol.scala`, 'protocol', renderProtocol(protocolModel(a, env)),
      { schemaNode: a.name, deps: [a.name, `${a.name}Entity`] }));
    entries.push(emit(a, `application/aggregates/${a.name}Aggregate.scala`, 'aggregate-root', renderRoot(rootModel(a, env)),
      { schemaNode: a.name, deps: [a.name, `${a.name}Behaviors`, `${a.name}Entity`] }));
    entries.push(emit(a, `domain/entities/${a.name}Entity.scala`, 'entity', renderEntity(entityModel(a, env)),
      { schemaNode: `${a.name}Entity` }));
    entries.push(emit(a, `domain/entities/behaviors/${a.name}EventHandler.scala`, 'event-handler', renderEventHandler(eventHandlerModel(a, env)),
      { schemaNode: `${a.name}EventHandler`, deps: [`${a.name}Entity`] }));
    entries.push(emit(a, `application/aggregates/repository/${a.name}Repository.scala`, 'repository', renderRepository(repositoryModel(a, env)),
      { schemaNode: a.name, deps: [a.name, `${a.name}Aggregate`, `${a.name}RepositoryImpl`] }));
    entries.push(emit(a, `application/aggregates/factories/${a.name}AggregateFactory.scala`, 'factory', renderFactory(factoryModel(a, env)),
      { schemaNode: a.name, deps: [a.name] }));
    entries.push(emit(a, `application/aggregates/behaviors/${a.name}Behaviors.scala`, 'behaviors', renderBehaviors(behaviorsModel(a, env)),
      { schemaNode: a.name, deps: [a.name, `${a.name}Entity`, `${a.name}Protocol`] }));
    entries.push(emit(a, `application/aggregates/behaviors/${a.name}CommandHelpers.scala`, 'command-helpers', renderHelpers(helpersModel(a, env)),
      { schemaNode: a.name, deps: [a.name, `${a.name}Entity`] }));
  }
  // Shared value-object face (V4-16): canonical.voCatalog is the engine's VO metadata list
  // (AssemblyEngine assembles it from fieldModel.valueObjects verbatim — a fresh tree emits
  // every entry). UcStep is skipped as a disclosed relic: the live tree's handwritten copy
  // landed in the same batch as its truth-source declaration and the incremental gate never
  // rewrote it, so the live file is not engine output (PauseProject family; options.relics).
  const voBase = canonical.aggregates?.[0] ?? {};
  const voPkgPath = `${voBase.pkg ?? 'net.imadz'}${voBase.ctxPackage ? `.${voBase.ctxPackage}` : ''}`.replaceAll('.', '/');
  const skipVos = new Set(options.relics?.skipValueObjects ?? []);
  for (const vo of canonical.voCatalog ?? []) {
    if (skipVos.has(vo.name)) continue;
    const model = valueObjectModel(vo, env);
    entries.push({
      path: `modules/kernel/src/main/scala/${voPkgPath}/domain/values/${vo.name}.scala`,
      content: renderValueObject(model, env),
      kind: 'value-object',
      schemaCategory: 'global',
      schemaNode: vo.name,
      families: [],
      deps: model.referencedVos,
      noteIds: model.noteIds,
    });
  }
  return entries;
}
