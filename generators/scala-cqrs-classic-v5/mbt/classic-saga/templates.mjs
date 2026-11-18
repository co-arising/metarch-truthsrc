import { firstUpper, removeSuffix } from '../../../../lib/classic-architecture/naming.mjs';

const distinct = values => [...new Set(values)];
// These Scala templates explicitly interpolate packageName + '.' + name,
// including a leading dot for empty-package deps. Do not substitute signature
// or normalize this to fqn: SagaContextTemplate's raw import quirks are visible.
const dependencyImports = model => model.dependencies.map(ref => `${ref.packageName}.${ref.name}`);
const imports = values => distinct(values).sort().map(value => `import ${value}`).join('\n');
const fieldList = (fields, separator) => fields.map(field => `${field.name}: ${field.typeRef.name}`).join(separator);
const renderDuration = duration => duration.amount === null ? duration.raw : `${duration.amount}.${duration.unit}`;

function renderErrorRules(rules) {
  if (!rules.codes.length)
    return '  private val Rules: ErrorRules[iMadzError] = ErrorRules.none[iMadzError]';
  const action = rules.retryable ? 'ErrorAction.Retryable' : 'ErrorAction.NonRetryable';
  const patterns = distinct(rules.codes).map(code => `"${code}"`).join(' | ');
  return `  private val Rules: ErrorRules[iMadzError] = ErrorRules(
    business = { case ${rules.errorType}(${patterns}, _) => ${action} },
    describe = e => s"\${e.code}: \${e.message}"
  )`;
}

function commandArgument(argument) {
  if (argument.kind === 'transaction-id') return argument.asId ? 'Id.of(txId)' : 'txId';
  if (argument.kind === 'symbol') return argument.symbol;
  throw new TypeError(`Unknown classic command argument variant: ${argument.kind}`);
}

function renderBinding(binding, contextName, aggregateIdField) {
  if (binding === null) return 'None';
  const args = [...binding.commandArgs.map(commandArgument), 'replyTo'].join(', ');
  const result = binding.resultFieldIsString ? `r.${binding.resultField}` : `r.${binding.resultField}.toString`;
  const base = firstUpper(removeSuffix(binding.repositoryFieldName, 'Repository'));
  return `Some(PhaseAsk.ask[${binding.commandType.name}, ${binding.replyType.name}, iMadzError, String, ${contextName}](
      ref = ctx => ctx.${binding.repositoryFieldName}.find${base}ByUserId(${aggregateIdField}),
      command = (txId, replyTo) => ${binding.commandType.name}(${args}),
      mapReply = r => r.error.map(Left(_)).getOrElse(Right(SagaResult(${result})))
    ))`;
}

export function renderClassicSagaParticipant(model) {
  const covered = new Set([
    'net.imadz.common.CommonTypes.Id', 'net.imadz.common.CommonTypes.iMadzError', 'scala.concurrent.ExecutionContext',
  ]);
  const additional = [
    'net.imadz.common.CommonTypes.{Id, iMadzError}',
    'net.imadz.common.Id',
    'net.imadz.infra.saga.SagaParticipant.SagaResult',
    'net.imadz.infra.saga.dsl.{AskParticipant, ErrorAction, ErrorRules, PhaseAsk}',
    'scala.concurrent.ExecutionContext',
    'scala.concurrent.duration._',
  ];
  const importDecl = imports([...distinct(dependencyImports(model)).filter(value => !covered.has(value)), ...additional]);
  const context = model.contextType.name;
  const idField = model.constructorParams[0]?.name ?? 'userId';
  const body = `
  override protected val prepareBinding: Option[PhaseAsk[iMadzError, String, ${context}]] =
    ${renderBinding(model.prepareBinding, context, idField)}

  override protected val commitBinding: Option[PhaseAsk[iMadzError, String, ${context}]] =
    ${renderBinding(model.commitBinding, context, idField)}

  override protected val compensateBinding: Option[PhaseAsk[iMadzError, String, ${context}]] =
    ${renderBinding(model.compensateBinding, context, idField)}
`;
  return `package ${model.selfType.packageName}

${importDecl}

/** saga_v3 TCC participant: pure data, never journaled. */
object ${model.selfType.name} {
${renderErrorRules(model.rules)}
}

case class ${model.selfType.name}(${fieldList(model.constructorParams, ', ')})(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler)
    extends AskParticipant[iMadzError, String, ${context}](
      rules = ${model.selfType.name}.Rules,
      askTimeout = ${renderDuration(model.askTimeout)}
    ) {${body}}
`;
}

function participantArgument(argument) {
  if (argument.kind === 'money') return 'money';
  if (argument.kind === 'id-from-args') return `Id.of(args.${argument.symbol})`;
  if (argument.kind === 'args-field') return `args.${argument.symbol}`;
  throw new TypeError(`Unknown classic participant argument variant: ${argument.kind}`);
}

function renderResilience(resilience) {
  const breaker = resilience.circuitBreaker;
  const circuitBreaker = breaker === null ? 'None' :
    `Some(CircuitBreakerSettings(${breaker.maxFailures}, ${renderDuration(breaker.callTimeout)}, ${renderDuration(breaker.resetTimeout)}))`;
  return `ResiliencePolicy(maxRetries = ${resilience.maxRetries}, timeoutPerAttempt = ${renderDuration(resilience.timeoutPerAttempt)}, recovery = RecoveryBehavior.${resilience.recovery}, circuitBreaker = ${circuitBreaker})`;
}

function renderDefinitionStep(step) {
  return `          SagaStep("${step.stepId}",
            ${step.participantType.name}(${step.participantArgs.map(participantArgument).join(', ')}),
            ${renderResilience(step.resilience)},
            stepGroup = ${step.stepGroup})`;
}

export function renderClassicSagaDefinition(model) {
  const additional = [
    'akka.actor.typed.ActorSystem',
    'akka.actor.typed.Scheduler',
    'akka.cluster.sharding.typed.scaladsl.EntityRef',
    'net.imadz.common.CommonTypes.iMadzError',
    'net.imadz.infra.saga.SagaTransactionCoordinator',
    'net.imadz.infra.saga.StepExecutor.CircuitBreakerSettings',
    'net.imadz.infra.saga.dsl.{ArgsCodec, RecoveryBehavior, ResiliencePolicy, SagaDefinition, SagaRegistry, SagaRunner, SagaStep}',
    'net.imadz.common.Id',
    'scala.concurrent.duration._',
    'scala.concurrent.ExecutionContext',
  ];
  const importDecl = imports([...dependencyImports(model), ...additional]);
  const args = model.argsType.name;
  const context = model.contextType.name;
  const moneyHelper = model.needsMoneyHelper
    ? '        val money = Money(args.amount, java.util.Currency.getInstance(args.currency))\n' : '';
  const steps = model.steps.map(renderDefinitionStep).join(',\n');
  return `package ${model.selfType.packageName}

${importDecl}

/** saga_v3 declarative saga — participants are pure functions of (definition, args);
  * the journal never stores them. */
object ${model.selfType.name} {

  val Name = "${model.sagaName}"
  val Version = ${model.version}

  final case class ${args}(${fieldList(model.argsFields, ', ')})
  object ${args} {
    implicit val format: play.api.libs.json.Format[${args}] = play.api.libs.json.Json.format[${args}]
  }

  def definition(implicit ec: ExecutionContext, scheduler: Scheduler): SagaDefinition[iMadzError, ${context}, ${args}] =
    SagaDefinition[iMadzError, ${context}, ${args}](
      name = Name,
      version = Version,
      argsCodec = ArgsCodec.playJson[${args}],
      steps = args => {
${moneyHelper}        Seq(
${steps})
      },
      preCheck = args => Right(args),
      errorText = e => (e.code, e.message),
      onResult = (args, result) => Nil,
      defaultResilience = ResiliencePolicy.defaults
    )

  /** Registers the definition on this node — must run before sharding recovers any entity. */
  def register(implicit ec: ExecutionContext, scheduler: Scheduler): SagaDefinition[iMadzError, ${context}, ${args}] = {
    val defn = definition
    SagaRegistry.register(defn)
    defn
  }

  /** One runner per node for this saga. \`coordinatorRef\` resolves the sharded coordinator by txId. */
  def runner(system: ActorSystem[_], coordinatorRef: String => EntityRef[SagaTransactionCoordinator.Command])(
      implicit ec: ExecutionContext, scheduler: Scheduler): SagaRunner[iMadzError, ${args}] =
    new SagaRunner(definition, coordinatorRef, system)
}
`;
}

export function renderClassicSagaContext(model) {
  // CodeGenerationDSL.SourceFile + caseClass(..., body = ""): retain empty
  // import sections, the braces' empty line, two-space continuation and EOF LF.
  return `package ${model.selfType.packageName}

${imports(dependencyImports(model))}

case class ${model.selfType.name}(${fieldList(model.fields, ',\n  ')}) {

}
`;
}
