import { fqn } from '../../../lib/classic-architecture/types.mjs';
import { DEFAULT_RUNTIME_PROFILE } from '../../../lib/runtime-profile.mjs';

// Fixed AggregateBehaviorTemplate + CodeGenerationDSL byte layout, not the
// curated target. Do not trim: leading/trailing blank lines, duplicate imports,
// the single-line orElse chain and the query body's trailing space are raw.
function toCamelCase(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('Classic aggregate behavior group requires a nonempty name');
  }
  // Scala lowers a single Char, not a potentially expanding String prefix.
  return name.charAt(0).toLowerCase().charAt(0) + name.slice(1);
}

function renderImports(model) {
  const baseImports = [...new Set(model.dependencies.map(ref => fqn(ref)).sort())];
  const aggregateImport = model.aggregateType.name.endsWith('SagaTransactor')
    ? `${model.commandType.packageName}._`
    : `${fqn(model.aggregateType).replaceAll('Aggregate', 'Protocol')}._`;
  // The original ImportDeclaration sorts the combined list without deduping.
  return [
    ...baseImports,
    aggregateImport,
    `${DEFAULT_RUNTIME_PROFILE.commonPackage}.application.CommandHandlerReplyingBehavior.runReplyingPolicy`,
    'scala.concurrent.duration._',
  ].sort().map(name => `import ${name}`).join('\n');
}

function dependencyParameter(model) {
  if (model.contextType != null) return `sagaContext: ${model.contextType.name}`;
  const repositories = [...new Set(model.dependencies
    .filter(ref => ref.name.endsWith('Repository')).map(ref => ref.name))];
  if (repositories.length > 1) {
    // Scala Set.find has no portable selection order. Never pick a different
    // repository silently when directly rendering the template-only actor arm.
    throw new TypeError('Unsupported classic aggregate actor behavior: multiple repository dependency names');
  }
  return `repo: ${repositories[0] ?? 'Any'}`;
}

function renderAiPrompt(commandName, stateName, dependencyArg) {
  return `      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '${commandName}'
      State: ${stateName}
      Available: ${dependencyArg}
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */`;
}

function renderHandler(handler, model, dependencyArg) {
  const commandName = handler.commandType.name;
  const logic = handler.logic;
  switch (logic?._type) {
    case 'PolicyBasedLogic':
      return `    case cmd: ${commandName} => runReplyingPolicy(${logic.policy.name}, ${logic.helper.name})(state, cmd).replyWith(cmd.replyTo)`;
    case 'ReadOnlyLogic': {
      const replyName = logic.replyType.name;
      const replyExpr = replyName.startsWith('Get') && replyName.endsWith('StateReply')
        ? `${replyName}(state)`
        : '???';
      const aiPrompt = renderAiPrompt(commandName, model.stateType.name, dependencyArg);
      return `    case cmd: ${commandName} =>\n${aiPrompt}\n      Effect.reply(cmd.replyTo)(${replyExpr}) `;
    }
    case 'TransientCommandLogic': {
      const aiPrompt = renderAiPrompt(commandName, model.stateType.name, dependencyArg);
      return `    case cmd: ${commandName} =>\n${aiPrompt}\n      Effect.persist(${model.eventType.packageName}.${logic.eventName}(${logic.eventArgs})).thenReply(cmd.replyTo)((_: ${model.stateType.name}) => ${commandName}Reply(None))`;
    }
    default:
      // Unlike the Scala catch-all, an unknown JS logic tag must not disappear.
      throw new TypeError(`Unsupported classic aggregate handler logic '${logic?._type}'`);
  }
}

function renderGroups(model, dependencyArg, dependencyParam) {
  return model.behaviorGroups.map(group => {
    const cases = group.handlers.map(handler => renderHandler(handler, model, dependencyArg)).join('\n');
    const params = model.commandHelpers == null
      ? `(state: ${model.stateType.name}, context: akka.actor.typed.scaladsl.ActorContext[${model.commandType.name}], coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[${DEFAULT_RUNTIME_PROFILE.legacySagaPackage}.SagaTransactionCoordinator.Command], ${dependencyParam})`
      : `(state: ${model.stateType.name})`;
    return `  private def ${toCamelCase(group.name)}${params}: PartialFunction[${model.commandType.name}, Effect[${model.eventType.name}, ${model.stateType.name}]] = {\n${cases}\n  }`;
  }).join('\n');
}

function renderHelperApply(model) {
  const handlerTypeName = `${model.aggregateType.name}CommandHandler`;
  const funcCalls = model.behaviorGroups.map(group => `${toCamelCase(group.name)}(state)`);
  const hasHandlers = model.behaviorGroups.some(group => group.handlers.length !== 0);
  if (funcCalls.length !== 0 && hasHandlers) {
    const logicChain = funcCalls.slice(1).map(call => `.orElse(${call})`).join('');
    return `
  type ${handlerTypeName} = (${model.stateType.name}, ${model.commandType.name}) => Effect[${model.eventType.name}, ${model.stateType.name}]
  def apply: ${handlerTypeName} = (state, command) => {
    // ==== BEGIN MANUAL ====
    ${funcCalls[0]}${logicChain}.apply(command)
    // ==== END MANUAL ====
  }
`;
  }
  // This is the raw template's empty model scaffold, NOT a ready handler. The
  // public builder separately rejects commands lacking a classic handler.
  return `
  type ${handlerTypeName} = (${model.stateType.name}, ${model.commandType.name}) => Effect[${model.eventType.name}, ${model.stateType.name}]
  def apply: ${handlerTypeName} = (state, command) => {
    // ==== BEGIN MANUAL ====
    // TODO: 行为流未接线（无 invariant→命令流，且无只读命令）——行为侧补全；
    //        典型体：runReplyingPolicy(<Rule>, <Cmd>Helper)(state, cmd).replyWith(cmd.replyTo)
    ???
    // ==== END MANUAL ====
  }
`;
}

// Original template-only arm: buildAggregateBehavior always supplies Helpers
// and contextType = null. This is not a new Saga builder or public profile.
function renderActorApply(model, dependencyArg, dependencyParam) {
  if (model.behaviorGroups.length === 0) {
    throw new TypeError('Classic aggregate actor behavior requires a first behavior group');
  }
  const firstGroup = toCamelCase(model.behaviorGroups[0].name);
  const persistenceName = model.aggregateType.name.replaceAll('SagaTransactor', '');
  return `
  def apply(id: String, coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[${DEFAULT_RUNTIME_PROFILE.legacySagaPackage}.SagaTransactionCoordinator.Command], ${dependencyParam}): akka.actor.typed.Behavior[${model.commandType.name}] = {
    akka.actor.typed.scaladsl.Behaviors.setup { context =>
      implicit val ec: scala.concurrent.ExecutionContext = context.executionContext
      akka.persistence.typed.scaladsl.EventSourcedBehavior[${model.commandType.name}, ${model.eventType.name}, ${model.stateType.name}](
        persistenceId = akka.persistence.typed.PersistenceId("${persistenceName}Transaction", id),
        emptyState = ${model.stateType.name}(id = Some(id)),
        commandHandler = (state, cmd) => ${firstGroup}(state, context, coordinator, ${dependencyArg}).apply(cmd),
        eventHandler = (state, event) => state.applyEvent(event)
      )
      .onPersistFailure(akka.actor.typed.SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1))
    }
  }
`;
}

/** Return the original template's Scala source string, without writer stamp. */
export function renderAggregateBehavior(model) {
  const imports = renderImports(model);
  const dependencyArg = model.contextType != null ? 'sagaContext' : 'repo';
  const dependencyParam = model.commandHelpers == null ? dependencyParameter(model) : null;
  const groupsCode = renderGroups(model, dependencyArg, dependencyParam);
  const applyMethod = model.commandHelpers == null
    ? renderActorApply(model, dependencyArg, dependencyParam)
    : renderHelperApply(model);
  const extendsName = model.commandHelpers?.name ?? '';
  const extendsPart = extendsName.length !== 0 ? ` extends ${extendsName}` : '';
  // ObjectDefinition.body = applyMethod + "\n" + groupsCode; SourceFile joins
  // package/imports/definitions with two newlines, then adds its final newline.
  const objectDefinition = `object ${model.selfType.name}${extendsPart} {\n${applyMethod}\n${groupsCode}\n}`;
  return [`package ${model.selfType.packageName}`, imports, objectDefinition].join('\n\n') + '\n';
}
