import { collectDependencies, shouldImport, typeRef } from '../../lib/classic-architecture/types.mjs';
import {
  AggregateProtocolModel,
  CommandFamilyModel,
  CommandModel,
  CommandReplyModel,
  FieldDef
} from './model.mjs';

function reject(path, message) {
  throw new TypeError(`classic aggregate protocol: ${path}: ${message}`);
}

function product(value, expected, path) {
  if (value === null || typeof value !== 'object' || value._type !== expected) {
    reject(path, `expected ${expected}; unsupported or missing raw metadata product`);
  }
  return value;
}

function text(value, path) {
  if (typeof value !== 'string') reject(path, 'expected a string');
  return value;
}

function optionalText(value, path) {
  return value === null ? null : text(value, path);
}

function sequence(value, path) {
  if (!Array.isArray(value)) reject(path, 'expected an explicit sequence');
  return value;
}

function resolved(value, path) {
  if (value === null || typeof value !== 'object') reject(path, 'context did not resolve a TypeRef');
  text(value.name, `${path}.name`);
  text(value.packageName, `${path}.packageName`);
  sequence(value.typeParams, `${path}.typeParams`);
  return value;
}

function assertClassicContext(ctx) {
  if (ctx?.formalSemantics !== null) {
    reject('ctx.formalSemantics', 'only the explicit null classic profile is supported');
  }
  // Scala's default elementHashById is empty. The shared classic context has no
  // hash-rendering interface: do not silently accept a future nonempty option.
  if (ctx.elementHashById !== undefined) {
    const hashes = ctx.elementHashById;
    const plain = hashes !== null && typeof hashes === 'object' &&
      [Object.prototype, null].includes(Object.getPrototypeOf(hashes));
    if (!plain || Object.keys(hashes).length !== 0) {
      reject('ctx.elementHashById', 'nonempty knowledge hash maps are not supported by this profile');
    }
  }
}

function parameterType(parameter, ctx, path) {
  product(parameter, 'ParameterMetadata', path);
  // Nested-owner decisions and unsupported MetaType failures belong to the
  // shared strict resolver. Never catch them and substitute Any/String.
  return resolved(ctx.typeResolver.resolve(parameter.parameterType), `${path}.parameterType`);
}

function replyModel(reply, ctx, path) {
  product(reply, 'SubordinateCommandReplyMetadata', path);
  const fields = sequence(reply.parameters, `${path}.parameters`).map((parameter, index) => {
    const parameterPath = `${path}.parameters[${index}]`;
    const ref = parameterType(parameter, ctx, parameterPath);
    // AggregateProtocolBuilder deliberately ignores reply optional/noteId/
    // description; this is not the command-parameter conversion below.
    return FieldDef({ name: text(parameter.name, `${parameterPath}.name`), typeRef: ref });
  });
  return CommandReplyModel({
    name: text(reply.name, `${path}.name`),
    fields,
    superTypes: [resolved(ctx.knownFrameworkTypes.CborSerializable, 'ctx.knownFrameworkTypes.CborSerializable')]
  });
}

function commandField(parameter, ctx, path) {
  const ref = parameterType(parameter, ctx, path);
  if (typeof parameter.optional !== 'boolean') reject(`${path}.optional`, 'expected an explicit boolean');
  return FieldDef({
    name: text(parameter.name, `${path}.name`),
    // TypeRef.Option in the original has an empty package, unlike a resolved
    // CustomType("Option", ...). Already-optional types are wrapped again.
    typeRef: parameter.optional ? typeRef('Option', '', [ref]) : ref,
    defaultValue: parameter.optional ? 'None' : null,
    noteId: optionalText(parameter.noteId, `${path}.noteId`),
    description: text(parameter.description, `${path}.description`)
  });
}

function commandModel(command, familyType, ctx, path) {
  product(command, 'SubordinateCommandMetadata', path);
  const fields = sequence(command.parameters, `${path}.parameters`)
    .map((parameter, index) => commandField(parameter, ctx, `${path}.parameters[${index}]`));
  if (command.replyToType !== null) {
    product(command.replyToType, 'CommandReplyRef', `${path}.replyToType`);
    const replyType = resolved(ctx.typeResolver.resolve(command.replyToType), `${path}.replyToType`);
    const actorRef = resolved(ctx.knownFrameworkTypes.ActorRef, 'ctx.knownFrameworkTypes.ActorRef');
    fields.push(FieldDef({
      name: 'replyTo',
      typeRef: typeRef(actorRef.name, actorRef.packageName, [replyType])
    }));
  }
  // isReadOnly does not filter protocol declarations. The command's own
  // description/noteId are not FieldDef documentation in the original builder.
  return CommandModel({
    name: text(command.name, `${path}.name`),
    fields,
    superTypes: [familyType]
  });
}

function typeKey(ref) {
  return JSON.stringify([ref.name, ref.packageName, ref.typeParams.map(typeKey)]);
}

function distinctTypes(refs) {
  return [...new Map(refs.map(ref => [typeKey(ref), ref])).values()];
}

/** Direct port of fixed AggregateProtocolBuilder.build(AggregateRootMetadata, ctx). */
export function buildAggregateProtocol(meta, ctx) {
  assertClassicContext(ctx);
  product(meta, 'AggregateRootMetadata', 'aggregate');
  text(meta.name, 'aggregate.name');
  const pkg = text(ctx.layout.application.aggregates.root, 'ctx.layout.application.aggregates.root');
  // TypeResolverDSL.aggregateProtocol uses the very same getBaseName + Protocol
  // and aggregates.root as the original builder, without a second naming layer.
  const selfType = resolved(ctx.typeResolver.aggregateProtocol(meta.name), 'aggregate.selfType');

  product(meta.replyFamily, 'CommandReplyFamilyMetadata', 'aggregate.replyFamily');
  const replies = sequence(meta.replyFamily.replies, 'aggregate.replyFamily.replies')
    .map((reply, index) => replyModel(reply, ctx, `aggregate.replyFamily.replies[${index}]`));

  product(meta.commandFamily, 'CommandFamilyMetadata', 'aggregate.commandFamily');
  const familyName = text(meta.commandFamily.name, 'aggregate.commandFamily.name');
  const familyType = resolved(ctx.typeResolver.commandFamily(familyName), 'aggregate.commandFamily.type');
  const commands = sequence(meta.commandFamily.commands, 'aggregate.commandFamily.commands')
    .map((command, index) => commandModel(command, familyType, ctx, `aggregate.commandFamily.commands[${index}]`));
  const commandFamily = CommandFamilyModel({
    name: familyName,
    commands,
    superTypes: [resolved(ctx.knownFrameworkTypes.CborSerializable, 'ctx.knownFrameworkTypes.CborSerializable')]
  });

  const deps = [
    ...replies.flatMap(reply => collectDependencies(reply.fields.map(field => field.typeRef))),
    ...replies.flatMap(reply => reply.superTypes),
    ...commands.flatMap(command => collectDependencies(command.fields.map(field => field.typeRef))),
    ...commands.flatMap(command => command.superTypes),
    ...commandFamily.superTypes
  ];
  product(meta.stateRef, 'EntityStateRef', 'aggregate.stateRef');
  product(meta.eventFamilyRef, 'EventFamilyRef', 'aggregate.eventFamilyRef');
  const stateType = resolved(ctx.typeResolver.entityState(meta.stateRef), 'aggregate.stateRef');
  const eventType = resolved(ctx.typeResolver.eventFamily(meta.eventFamilyRef), 'aggregate.eventFamilyRef');
  // Only field types recurse. Supertypes and the handler state/event contribute
  // themselves, not their type parameters. Do not suppress nested self imports.
  const dependencies = distinctTypes([...deps, stateType, eventType].filter(ref => shouldImport(ref, pkg)));
  const noteId = optionalText(meta.noteId, 'aggregate.noteId');

  return AggregateProtocolModel({
    selfType,
    commandFamily,
    replies,
    state: null,
    stateType,
    eventType,
    dependencies,
    noteIds: noteId === null ? [] : [noteId]
  });
}
