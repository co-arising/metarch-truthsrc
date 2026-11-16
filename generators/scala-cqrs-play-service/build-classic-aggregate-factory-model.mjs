import { typeRef, collectDependencies, shouldImport } from '../../lib/classic-architecture/types.mjs';
import { stripMargin } from '../../lib/classic-architecture/text.mjs';
import { FieldDef } from '../scala-cqrs-domain/models/domain-entity.mjs';
import { ClassicAggregateFactoryModel, FactoryMethodModel } from './models/classic-aggregate-factory.mjs';

const commandRef = targetName => ({ _type: 'CommandRef', targetName });
const commandReplyRef = targetName => ({ _type: 'CommandReplyRef', targetName });

function resolveIdField(meta, ctx) {
  return FieldDef(
    meta.identifier.name,
    ctx.typeResolver.parameterType(meta.identifier.fieldType),
    null,
    null,
    meta.identifier.noteId ?? null,
    meta.identifier.description ?? '',
  );
}

function entityRefType(commandFamily, ctx) {
  const ref = ctx.knownFrameworkTypes.EntityRef;
  return typeRef(ref.name, ref.packageName, [commandFamily]);
}

function buildCreateRefMethod(meta, idField, commandFamily, entityTypeKey, ctx) {
  const returnType = entityRefType(commandFamily, ctx);
  const aggregateBase = ctx.conventions.getBaseName(meta.name);
  return FactoryMethodModel(
    `create${aggregateBase}WithoutBalance`,
    [idField],
    returnType,
    `clusterSharding.entityRefFor(${entityTypeKey}, ${idField.name}.toString)`,
  );
}

function determineInitializationMethodName(meta, ctx) {
  // This is the single Aggregate suffix operation, not getBaseName. A metadata
  // name may deliberately equal the bare-ref method's name (an overload).
  const aggregateBase = ctx.conventions.getAggregateBaseName(meta.name);
  const method = meta.factoryMethods.find(candidate => candidate.parameters.length !== 0);
  return method == null ? `create${aggregateBase}WithInitialValue` : method.name;
}

function generateInitializationMethodBody(commandFamily, entityTypeKey, idArgName, cmdName, paramDefs, replyType, ctx) {
  const askArgs = [...paramDefs.map(param => ctx.conventions.scalaIdentifier(param.name)), '_'].join(', ');
  // The fixed builder strips margins only here, after interpolation. Retain
  // raw idArgName and type .name spelling, even where signature/escaping differs.
  return stripMargin(`|val entityRef: EntityRef[${commandFamily.name}] = clusterSharding
         |      .entityRefFor[${commandFamily.name}](${entityTypeKey}, ${idArgName}.toString)
         |    for {
         |      confirmation <- entityRef.ask[${replyType.name}](${cmdName}(${askArgs}))
         |    } yield {
         |      confirmation.error
         |        .map(Left.apply[iMadzError, EntityRef[${commandFamily.name}]])
         |        .getOrElse(Right(entityRef))
         |    }`);
}

function buildInitializationMethodOption(meta, idField, commandFamily, entityTypeKey, ctx) {
  // Selection includes replyTo; it is removed only from the business parameters.
  const command = meta.commandFamily.commands.find(candidate =>
    !candidate.isReadOnly && candidate.parameters.length !== 0);
  if (command == null) return null;

  const methodName = determineInitializationMethodName(meta, ctx);
  const businessParams = command.parameters.filter(param => param.name !== 'replyTo');
  const hasIdParam = businessParams.some(param => param.name === idField.name);
  const paramDefs = businessParams.map(param => {
    const resolvedType = ctx.typeResolver.parameterType(param.parameterType);
    return FieldDef(
      param.name,
      param.optional ? typeRef('Option', 'scala', [resolvedType]) : resolvedType,
      param.optional ? 'None' : null,
      null,
      param.noteId ?? null,
      param.description ?? '',
    );
  });
  const methodParams = hasIdParam ? paramDefs : [idField, ...paramDefs];

  if (command.replyToType == null) {
    throw new Error(`Command ${command.name} must specify a reply type for factory initialization.`);
  }
  const replyType = ctx.typeResolver.resolve(commandReplyRef(command.replyToType.targetName));
  const entityRef = entityRefType(commandFamily, ctx);
  const eitherType = ctx.typeResolver.either(ctx.knownFrameworkTypes.iMadzError, entityRef);
  const future = ctx.knownFrameworkTypes.Future;
  const returnType = typeRef(future.name, future.packageName, [eitherType]);
  // A prepended aggregate identifier locates the entity, but never enters ask.
  const askParams = hasIdParam ? methodParams : paramDefs;
  const body = generateInitializationMethodBody(
    commandFamily, entityTypeKey, idField.name, command.name, askParams, replyType, ctx,
  );
  return FactoryMethodModel(methodName, methodParams, returnType, body, true);
}

function structuralTypeKey(ref) {
  return JSON.stringify([ref.name, ref.packageName, ref.typeParams.map(structuralTypeKey)]);
}

function collectFactoryDependencies(commandTypes, replyTypes, initMethod, refMethod, ctx, pkg) {
  const initDeps = initMethod == null ? [] : [
    ...collectDependencies([
      ...initMethod.parameters.map(param => param.typeRef),
      initMethod.returnType,
    ]),
    ctx.knownFrameworkTypes.Future,
    ctx.knownFrameworkTypes.Either,
    ctx.knownFrameworkTypes.iMadzError,
  ];
  const refDeps = collectDependencies([
    ...refMethod.parameters.map(param => param.typeRef),
    refMethod.returnType,
  ]);
  // Command/reply refs enter directly, NOT through recursive collectDependencies.
  // Union is a structural Set[TypeRef]: Future[T] and Future[] remain distinct,
  // and the template consequently emits both identical Future import lines.
  const refs = [...commandTypes, ...replyTypes, ...initDeps, ...refDeps];
  return [...new Map(refs.map(ref => [structuralTypeKey(ref), ref])).values()]
    .filter(ref => shouldImport(ref, pkg));
}

/** Build the fixed classic factory model using the agreed context-v3 API. */
export function buildClassicAggregateFactory(meta, ctx) {
  const pkg = ctx.layout.application.aggregates.factories;
  // Root metadata and name overloads are intentionally distinct resolver calls.
  const selfType = ctx.typeResolver.aggregateFactory(meta);
  const aggregateType = ctx.typeResolver.aggregateRoot(meta.name);
  const commandFamily = ctx.typeResolver.commandFamily(meta.commandFamily.name);
  const entityTypeKey = 'entityTypeKey';

  const idField = resolveIdField(meta, ctx);
  // Resolve every reply and command before choosing the initialization command.
  const replyTypes = meta.replyFamily.replies.map(reply =>
    ctx.typeResolver.resolve(commandReplyRef(reply.name)));
  const commandTypes = [commandFamily, ...meta.commandFamily.commands.map(command =>
    ctx.typeResolver.command(commandRef(command.name)))];
  const refMethod = buildCreateRefMethod(meta, idField, commandFamily, entityTypeKey, ctx);
  const initMethod = buildInitializationMethodOption(meta, idField, commandFamily, entityTypeKey, ctx);
  const factoryMethods = initMethod == null ? [refMethod] : [refMethod, initMethod];
  const dependencies = collectFactoryDependencies(commandTypes, replyTypes, initMethod, refMethod, ctx, pkg);

  return ClassicAggregateFactoryModel({
    selfType,
    aggregateType,
    entityTypeKey,
    commandFamily,
    factoryMethods,
    dependencies,
    noteIds: meta.noteId == null ? [] : [meta.noteId],
  });
}
