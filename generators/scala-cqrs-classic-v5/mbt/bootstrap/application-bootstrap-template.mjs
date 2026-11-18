import { stripMargin } from '../../../../lib/classic-architecture/text.mjs';

export function renderClassicStartup(call) {
  switch (call.kind) {
    case 'saga-registration': return `init${call.sagaName}(ec, system.scheduler)`;
    case 'saga-engine': return `initSagaEngine(sharding, ${call.contextName}(${call.repositoryParam}), system)`;
    case 'aggregate': return `${call.methodName}(sharding)`;
    case 'projection': return `${call.methodName}(system, sharding, ${call.repositoryParam})`;
    default: throw new TypeError(`unknown bootstrap startup kind: ${call.kind}`);
  }
}

/** Frozen ApplicationBootstrapTemplate, including raw empty extends and LF. */
export function renderClassicApplicationBootstrap(model) {
  const baseImports = [...new Set(model.dependencies.filter(ref => ref.name !== 'ActorSystem')
    .map(ref => `${ref.packageName}.${ref.name}`).sort())];
  const akkaImports = [
    'akka.actor.typed.scaladsl.adapter._',
    'akka.actor.ExtendedActorSystem',
    'akka.actor.ActorSystem',
    'akka.actor.typed.{ActorSystem => TypedActorSystem}',
    'javax.inject.{Inject, Singleton}',
  ];
  const imports = [...new Set([...baseImports, ...akkaImports])].sort()
    .map(name => `import ${name}`).join('\n');
  const traitsExtends = model.traits.map(ref => ref.name).join(' with ');
  // Original uses name, not signature: do not repair generic injection types.
  const injections = model.injectedFields.map(field => `${field.name}: ${field.typeRef.name}`).join(',\n  ');
  const initBlock = model.initCalls.map(renderClassicStartup).join('\n  ');
  const strictWiring = model.strictEntries.map((entryFqn, i) => {
    const valName = model.strictEntries.length === 1 ? 'strictSagaCoordinator' : `strictSagaCoordinator${i}`;
    return stripMargin(`  // strict saga coordinator (independent namespace; explicit deployment reconcile token)
  private val ${valName}: akka.actor.typed.ActorRef[net.imadz.infra.saga.strict.StrictSagaCoordinator.Command] =
    ${entryFqn}.spawnClusterSingleton(system, sharding,
      classicSystem.settings.config.getString("net.imadz.strict-saga.reconcile-token"))

  // deployment-face event-stream source: the shared journal's live event stream
  // triggers the saga from persisted events and owns the terminal result publication
  ${entryFqn}.installEventSource(system, sharding, ${valName})`);
  }).join('\n\n');
  const classBody = `
  // 隐式转换环境
  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: scala.concurrent.ExecutionContext = system.executionContext

  // Initializations
  ${initBlock}
${strictWiring}
`;
  // The source template fixes ApplicationBootstrap rather than selfType.name.
  // Nothing is trimmed: strictEntries=[] leaves its original blank line too.
  return `package ${model.selfType.packageName}

${imports}

/**
 * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件
 */
@Singleton
class ApplicationBootstrap @Inject()(${injections}) extends ${traitsExtends} {

${classBody}

}
`;
}
