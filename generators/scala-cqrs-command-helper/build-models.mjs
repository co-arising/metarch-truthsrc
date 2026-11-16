import { collectDependencies, shouldImport } from '../../lib/classic-architecture/types.mjs';
import { commandHelperModel, commandHelpersModel } from './model.mjs';

function frameworkType(ctx, name) {
  if (!Object.hasOwn(ctx.knownFrameworkTypes, name)) {
    throw new Error(`CommandHelpersBuilder: missing framework type ${name}`);
  }
  return ctx.knownFrameworkTypes[name];
}

function buildCommandReplyMap(meta, ctx) {
  const behavior = ctx.metaRegistry.resolveByName('AggregateBehaviorMetadata', meta.behaviorRef.targetName);
  if (behavior === null) return new Map();
  // Resolve every flow before filtering commands. Later duplicate keys win,
  // and failureReplyRef does not participate in the raw reply-type selection.
  return new Map(behavior.behaviors.flatMap(group => group.flows).map(flow => [
    flow.commandRef.targetName,
    ctx.typeResolver.resolve(flow.replyMapping.successReplyRef),
  ]));
}

function resolveReplyType(command, commandReplyMap, ctx) {
  if (commandReplyMap.has(command.name)) return commandReplyMap.get(command.name);
  const replyTo = command.parameters.find(parameter => parameter.name === 'replyTo');
  const parameterType = replyTo?.parameterType;
  if (parameterType?._type !== 'CustomType' || parameterType.typeParameters.length === 0) {
    return ctx.typeResolver.unit;
  }
  // Raw CustomType(_, _, args) does not require ActorRef. Its first argument
  // is cast to MetaRef, then deliberately re-resolved as StructRef, not ReplyRef.
  // All exported MetaRef variants expose targetName; a non-ref must fail here.
  const rawName = parameterType.typeParameters[0]?.targetName;
  if (typeof rawName !== 'string') {
    throw new TypeError(`CommandHelpersBuilder: ${command.name}.replyTo first type argument must be a MetaRef`);
  }
  return ctx.typeResolver.resolve({ _type: 'StructRef', targetName: rawName });
}

function buildParam(command, ctx) {
  const payloadParams = command.parameters.filter(parameter => parameter.name !== 'replyTo');
  if (payloadParams.length === 0) {
    return { paramType: ctx.typeResolver.unit, toParamLogic: '()' };
  }
  if (payloadParams.length === 1) {
    const parameter = payloadParams[0];
    return {
      paramType: ctx.typeResolver.parameterType(parameter.parameterType),
      toParamLogic: `command.${parameter.name}`,
    };
  }
  // Match the raw builder: preserve order and do not interpret optional flags
  // or escape parameter names that the Scala source interpolates verbatim.
  return {
    paramType: ctx.typeResolver.tuple(payloadParams.map(parameter => ctx.typeResolver.parameterType(parameter.parameterType))),
    toParamLogic: `(${payloadParams.map(parameter => `command.${parameter.name}`).join(', ')})`,
  };
}

function buildReplyLogic(paramType, replyType) {
  // These are name-only checks in Scala, not FQN or constructor-shape checks.
  if (replyType.name === 'Unit') {
    return { successReplyLogic: '()', failureReplyLogic: '()' };
  }
  const param = paramType.name.startsWith('Tuple') ? 'param._1' : 'param';
  return {
    successReplyLogic: `${replyType.name}(${param}, None)`,
    failureReplyLogic: `${replyType.name}(${param}, Some(error))`,
  };
}

function buildHelper(command, stateType, errorType, commandReplyMap, ctx) {
  const commandType = ctx.typeResolver.command({ _type: 'CommandRef', targetName: command.name });
  const replyType = resolveReplyType(command, commandReplyMap, ctx);
  const { paramType, toParamLogic } = buildParam(command, ctx);
  const { successReplyLogic, failureReplyLogic } = buildReplyLogic(paramType, replyType);
  return commandHelperModel({
    name: `${command.name}Helper`,
    commandType,
    stateType,
    paramType,
    replyType,
    errorType,
    toParamLogic,
    failureReplyLogic,
    successReplyLogic,
  });
}

/**
 * Build one fixed classic CommandHelpersModel from raw AggregateRootMetadata.
 * The caller owns admission and transactor suppression. Read-only-only input
 * still produces an empty trait model, as in the original Scala builder.
 * No formal-side-attachment branch is implemented by this profile.
 * @returns {import('./model.mjs').CommandHelpersModel}
 */
export function buildCommandHelpers(meta, ctx) {
  if (ctx.formalSemantics !== null) {
    throw new Error('CommandHelpersBuilder: this classic profile requires formalSemantics = null; formal helpers are unsupported');
  }
  const pkg = ctx.layout.application.aggregates.behaviors;
  // The AggregateRootMetadata overload applies the same NamingConventions
  // call as the fixed builder, with central type/package choices in context.
  const selfType = ctx.typeResolver.commandHelper(meta);
  const stateType = ctx.typeResolver.entityState(meta.stateRef);
  const errorType = frameworkType(ctx, 'iMadzError');
  const commandReplyMap = buildCommandReplyMap(meta, ctx);
  const helpers = meta.commandFamily.commands
    .filter(command => !command.isReadOnly)
    .map(command => buildHelper(command, stateType, errorType, commandReplyMap, ctx));
  // Only parameter/reply dependencies recurse. Command, state and error types
  // are direct entries; CommandHelper is added after shouldImport filtering.
  const dependencies = helpers.flatMap(helper => [
    helper.commandType,
    helper.stateType,
    helper.errorType,
    ...collectDependencies([helper.paramType, helper.replyType]),
  ]).filter(ref => shouldImport(ref, pkg));
  dependencies.push(frameworkType(ctx, 'CommandHelper'));
  return commandHelpersModel({
    selfType,
    helpers,
    dependencies,
    noteIds: meta.noteId === null ? [] : [meta.noteId],
  });
}
