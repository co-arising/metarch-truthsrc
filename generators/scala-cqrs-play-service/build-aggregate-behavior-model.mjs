import { typeRef, shouldImport } from '../../lib/classic-architecture/types.mjs';
import {
  AggregateBehaviorModel,
  BehaviorGroupModel,
  CommandHandlerModel,
  PolicyBasedLogic,
  ReadOnlyLogic,
  TransientCommandLogic,
} from './models/aggregate-behavior.mjs';

// NamingConventions.getBaseName: one ordered pass, preserving the last nonempty
// value. In particular, Rule is NOT a suffix here. Do not curate RuleRule away.
const BASE_SUFFIXES = Object.freeze([
  'Aggregate', 'Controller', 'Entity', 'DomainService', 'Service', 'Factory',
  'Behavior', 'Behaviors', 'RepositoryImpl', 'Policy', 'Handler', 'Adapter',
  'Converter', 'Strategy', 'Bootstrap', 'SagaTransactionRepository',
  'SagaTransactor', 'SagaTransaction', 'Repository', 'Query', 'Participant',
  'Participant', 'Event', 'State', 'Context',
]);

function getBaseName(name) {
  let current = name;
  for (const suffix of BASE_SUFFIXES) {
    const next = current.endsWith(suffix) ? current.slice(0, -suffix.length) : current;
    if (next.length === 0) return current;
    current = next;
  }
  return current;
}

function requireProduct(value, expected) {
  if (!value || value._type !== expected) {
    throw new TypeError(`Classic aggregate behavior requires ${expected}, got '${value?._type}'`);
  }
  return value;
}

function requireSequence(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`Classic aggregate behavior requires ${label} as an array`);
  return value;
}

function requireName(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Classic aggregate behavior requires a nonempty ${label}`);
  }
  return value;
}

const commandRef = targetName => ({ _type: 'CommandRef', targetName });

function resolveBehaviorMetadata(meta, ctx) {
  const name = meta.behaviorRef.targetName;
  const behavior = ctx.metaRegistry.resolveByName('AggregateBehaviorMetadata', name);
  if (behavior == null) {
    // Preserve the original builder's missing-behavior diagnostic.
    throw new Error(`Failed to resolve behavior metadata for aggregate '${meta.name}'. `
      + `Expected behavior metadata '${name}' not found in registry.`);
  }
  return requireProduct(behavior, 'AggregateBehaviorMetadata');
}

function buildCommandHandler(flow, mutatingCommands, ctx) {
  requireProduct(flow, 'CommandHandlingFlow');
  requireProduct(flow.commandRef, 'CommandRef');
  // This filter is the Scala flatMap rule, including flows for read-only or
  // out-of-family commands. Reply mapping belongs to CommandHelpersBuilder.
  if (!mutatingCommands.some(command => command.name === flow.commandRef.targetName)) return [];
  requireProduct(flow.invariantRef, 'InvariantRuleRef');
  return [CommandHandlerModel(
    ctx.typeResolver.command(flow.commandRef),
    PolicyBasedLogic(
      ctx.typeResolver.invariantRule(flow.invariantRef.targetName),
      ctx.typeResolver.commandHelper(`${flow.commandRef.targetName}Helper`),
    ),
    flow.commandRef.targetName,
  )];
}

function buildTransientHandlers(meta, mutatingCommands, ctx) {
  const base = getBaseName(meta.name).replace(/Aggregate$/, '');
  // Original verb order, not metadata order; no requirement for a full trio.
  return [['Run', 'RunStarted'], ['Complete', 'RunCompleted'], ['Fail', 'RunFailed']]
    .flatMap(([verb, eventSuffix]) => {
      const name = `${verb}${base}`;
      if (!mutatingCommands.some(command => command.name === name)) return [];
      // The original explicit source slot uses cmd.result, NOT state.result.
      const eventArgs = verb === 'Run'
        ? 'cmd.id, "", cmd.triggeredBy, java.time.Instant.now()'
        : 'cmd.id, cmd.result, cmd.triggeredBy, java.time.Instant.now()';
      return [CommandHandlerModel(
        ctx.typeResolver.command(commandRef(name)),
        TransientCommandLogic(`${base}${eventSuffix}`, eventArgs),
        name,
      )];
    });
}

function buildWriteBehaviorGroups(meta, behavior, mutatingCommands, ctx) {
  const groups = requireSequence(behavior.behaviors, 'behavior.behaviors').map(group => {
    requireProduct(group, 'AggregateCommandHandlersMetadata');
    requireName(group.name, 'behavior group name');
    const handlers = requireSequence(group.flows, 'behavior group flows')
      .flatMap(flow => buildCommandHandler(flow, mutatingCommands, ctx));
    return BehaviorGroupModel(group.name, handlers);
  });
  // Empty groups remain in place when any policy handler exists. Only when
  // every write group is empty may the transient group replace all of them.
  if (groups.some(group => group.handlers.length !== 0)) return groups;
  const transient = buildTransientHandlers(meta, mutatingCommands, ctx);
  return transient.length !== 0
    ? [BehaviorGroupModel(`${getBaseName(meta.name)}TransientBehaviors`, transient)]
    : groups;
}

function buildQueryBehaviorGroup(readOnlyCommands, ctx) {
  const handlers = readOnlyCommands.map(command => {
    const commandType = ctx.typeResolver.command(commandRef(command.name));
    if (command.replyToType == null) {
      throw new Error(`Read-only command '${command.name}' must define a reply type`);
    }
    requireProduct(command.replyToType, 'CommandReplyRef');
    return CommandHandlerModel(
      commandType,
      ReadOnlyLogic(ctx.typeResolver.resolve(command.replyToType)),
      'QueryBehaviors',
    );
  });
  return BehaviorGroupModel('QueryBehaviors', handlers);
}

function requireCommandCoverage(meta, groups) {
  const covered = new Set(groups.flatMap(group => group.handlers.map(handler => handler.commandType.name)));
  const unhandled = meta.commandFamily.commands.filter(command => !covered.has(command.name));
  if (unhandled.length !== 0) {
    // Explicit profile admission restriction, NOT an invented formal fallback
    // or a change to an admitted command's raw Scala body. Query ??? remains.
    throw new TypeError(`Unsupported classic aggregate behavior for '${meta.name}': unhandled commands `
      + `${unhandled.map(command => `'${command.name}'`).join(', ')}; `
      + 'no classic policy/query/transient handler and no formal attachment in this profile');
  }
}

function frameworkType(ctx, name) {
  const ref = ctx.knownFrameworkTypes[name];
  if (ref == null) throw new TypeError(`Missing classic framework type '${name}'`);
  return ref;
}

function structuralTypeKey(ref) {
  return JSON.stringify([ref.name, ref.packageName, ref.typeParams.map(structuralTypeKey)]);
}

function collectBehaviorDependencies(meta, groups, stateType, eventType, entityType, ctx, pkg) {
  const logicDeps = groups.flatMap(group => group.handlers.flatMap(handler => {
    switch (handler.logic._type) {
      case 'PolicyBasedLogic': return [handler.logic.policy, handler.logic.helper];
      case 'ReadOnlyLogic': return [handler.logic.replyType];
      case 'TransientCommandLogic': return [];
      default: throw new TypeError(`Unsupported classic aggregate handler logic '${handler.logic._type}'`);
    }
  }));
  const refs = [
    ctx.typeResolver.aggregateProtocol(meta),
    stateType,
    eventType,
    frameworkType(ctx, 'runReplyingPolicy'),
    frameworkType(ctx, 'Effect'),
    entityType,
    ...meta.commandFamily.commands.map(command => ctx.typeResolver.command(commandRef(command.name))),
    ctx.typeResolver.commandFamily(commandRef(meta.commandFamily.name)),
    ...logicDeps,
  ];
  // Scala's Set[TypeRef], deliberately NOT shared collectDependencies(): the
  // original builder does not recursively import generic parameters.
  return [...new Map(refs.map(ref => [structuralTypeKey(ref), ref])).values()]
    .filter(ref => shouldImport(ref, pkg));
}

/**
 * Build only the original, no-formal-attachment classic profile. Successful
 * construction is a scaffold model, not runtime readiness (raw query ??? and
 * transient reply/time quirks are preserved). Uncovered commands are rejected.
 */
export function buildAggregateBehavior(meta, ctx) {
  if (ctx?.formalSemantics !== null) {
    throw new TypeError('Classic aggregate behavior requires ctx.formalSemantics = null; formal attachments are unsupported');
  }
  requireProduct(meta, 'AggregateRootMetadata');
  requireName(meta.name, 'aggregate name');
  requireProduct(meta.commandFamily, 'CommandFamilyMetadata');
  requireProduct(meta.entityRef, 'EntityRef');
  requireProduct(meta.stateRef, 'EntityStateRef');
  requireProduct(meta.eventFamilyRef, 'EventFamilyRef');
  requireProduct(meta.behaviorRef, 'AggregateBehaviorRef');
  const commands = requireSequence(meta.commandFamily.commands, 'commandFamily.commands');
  for (const command of commands) {
    requireProduct(command, 'SubordinateCommandMetadata');
    requireName(command.name, 'command name');
    if (typeof command.isReadOnly !== 'boolean') {
      throw new TypeError(`Classic command '${command.name}' requires explicit isReadOnly`);
    }
  }

  const pkg = ctx.layout.application.aggregates.behaviors;
  const selfType = ctx.typeResolver.aggregateBehavior(meta);
  // aggregateType(name, pkg) in Scala is exactly TypeRef(name, pkg).
  const aggregateType = typeRef(`${getBaseName(meta.name)}Aggregate`, ctx.layout.application.aggregates.root);
  const commandHelpers = ctx.typeResolver.commandHelper(meta);
  const stateType = ctx.typeResolver.entityState(meta.stateRef);
  const eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef);
  const entityType = ctx.typeResolver.entity(meta.entityRef.targetName);
  const behavior = resolveBehaviorMetadata(meta, ctx);
  const behaviorGroups = buildWriteBehaviorGroups(meta, behavior, commands.filter(command => !command.isReadOnly), ctx);
  const readOnlyCommands = commands.filter(command => command.isReadOnly);
  if (readOnlyCommands.length !== 0) behaviorGroups.push(buildQueryBehaviorGroup(readOnlyCommands, ctx));
  requireCommandCoverage(meta, behaviorGroups);

  const dependencies = collectBehaviorDependencies(meta, behaviorGroups, stateType, eventType, entityType, ctx, pkg);
  return AggregateBehaviorModel({
    selfType,
    aggregateType,
    stateType,
    eventType,
    commandType: ctx.typeResolver.commandFamily(commandRef(meta.commandFamily.name)),
    commandHelpers,
    behaviorGroups,
    dependencies,
    noteIds: meta.noteId == null ? [] : [meta.noteId],
  });
}
