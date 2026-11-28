// Policy Projection & PolicyMachine Suite Bridge for scala-cqrs-play-service@2:
// Derives reactive Event -> Command policies from application behaviors (`rule.triggerKind === 'event'` + `SHALL dispatch`)
// and emits the complete Akka Projection Policy assembly:
//   - application/projection/policy/FailureVerdict.scala             (pure kernel failure verdict)
//   - application/projection/policy/PolicyEnvelope.scala             (pure envelope & PolicyDlqSink port)
//   - application/projection/policy/PolicyMachine.scala              (4-stage reactive pipeline: decode/decide/execute/dispose+bury)
//   - application/projection/policy/PolicyDlqBury.scala              (ScalikeJDBC DLQ sink implementation)
//   - application/projection/policy/<Policy>.scala                   (pure decide + dispose pair & DefaultSemantics)
//   - application/projection/policy/<Policy>Mechanics.scala          (ClusterSharding entityRefFor.ask adapter)
//   - application/projection/policy/<Policy>Handler.scala            (Akka Projection Handler delegating to PolicyMachine.run)
//   - application/projection/policy/<Policy>Runner.scala             (EventSourcedProvider.eventsByTag factory)
//   - infrastructure/bootstrap/<Policy>Bootstrap.scala               (ShardedDaemonProcess bootstrap trait for ApplicationBootstrap)
import { resolveCanonicalEventFields } from '../structure-loader.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { toPascal } from '../codegen/onion-routes.mjs';

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

function buildNominalIndex(canonicalV2) {
  const exactByName = new Map();
  for (const ex of canonicalV2.structures?.exactTypes ?? []) exactByName.set(ex.name, ex);
  const voByName = new Map();
  for (const vo of canonicalV2.structures?.valueObjects ?? []) voByName.set(vo.name, vo);
  return { exactByName, voByName };
}

function isNominalRecord(rt, nominalIdx) {
  return Boolean(
    rt?.kind === 'record'
    && rt.typeName
    && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName)),
  );
}

function typeUsesNominal(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return false;
  if (isNominalRecord(rt, nominalIdx)) return true;
  if (rt.kind === 'optional' || rt.kind === 'sequence') return typeUsesNominal(rt.element, nominalIdx);
  if (rt.kind === 'map') return typeUsesNominal(rt.value, nominalIdx);
  return false;
}

function scalaTypeOf(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return 'String';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'optional': return `Option[${scalaTypeOf(rt.element, nominalIdx)}]`;
    case 'sequence': return `Vector[${scalaTypeOf(rt.element, nominalIdx)}]`;
    case 'map': return `Map[String, ${scalaTypeOf(rt.value, nominalIdx)}]`;
    case 'record':
      if (isNominalRecord(rt, nominalIdx)) return rt.typeName;
      return 'String';
    default: return 'String';
  }
}

function defaultScalaExpr(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return '""';
  switch (rt.kind) {
    case 'int': return '0L';
    case 'bool': return 'false';
    case 'string': return '""';
    case 'decimal': return 'BigDecimal(0)';
    case 'optional': return 'None';
    case 'sequence': return `Vector.empty[${scalaTypeOf(rt.element, nominalIdx)}]`;
    case 'map': return `Map.empty[String, ${scalaTypeOf(rt.value, nominalIdx)}]`;
    case 'record': {
      if (rt.typeName && nominalIdx.exactByName.has(rt.typeName)) {
        return `${rt.typeName}.Zero`;
      }
      const vo = rt.typeName ? nominalIdx.voByName.get(rt.typeName) : null;
      if (vo) {
        const voFields = (vo.fields ?? []).length > 0
          ? vo.fields
          : [{ name: 'value', resolvedType: { kind: 'string' } }];
        return `${vo.name}(${voFields.map(ff => defaultScalaExpr(ff.resolvedType, nominalIdx)).join(', ')})`;
      }
      return '""';
    }
    default: return '""';
  }
}

function pickEntityIdField(srcEventFields, targetAgg) {
  const aggIdName = `${targetAgg[0].toLowerCase()}${targetAgg.slice(1)}Id`;
  const candidates = [aggIdName, 'orderId', 'id'];
  for (const name of candidates) {
    const hit = srcEventFields.find(f => f.name === name);
    if (hit) return hit.name;
  }
  const anyId = srcEventFields.find(f => f.name.endsWith('Id'));
  return anyId ? anyId.name : null;
}

function collectRulePolicies(beh, storyStruct, aggMap, seen) {
  const collected = [];
  for (const rule of beh.rules ?? []) {
    if (rule.triggerKind !== 'event' || !rule.command) continue;
    const [srcAgg, srcEvent] = String(rule.command).split('.');
    if (!srcAgg || !srcEvent) continue;
    const srcAggStruct = aggMap.get(srcAgg) ?? null;
    const srcEventStruct = (srcAggStruct?.events ?? []).find(e => e.name === srcEvent) ?? null;
    const srcEventFields = srcEventStruct
      ? resolveCanonicalEventFields(srcAggStruct, srcEventStruct)
      : [];

    for (const act of rule.actions ?? []) {
      if (act.kind !== 'dispatch' || act.modality !== 'SHALL' || !act.target) continue;
      const [targetAgg, targetCmd] = String(act.target).split('.');
      if (!targetAgg || !targetCmd) continue;
      const targetAggStruct = aggMap.get(targetAgg) ?? null;
      const targetCmdStruct = (targetAggStruct?.commands ?? []).find(c => c.name === targetCmd) ?? null;
      if (!targetAggStruct || !targetCmdStruct) continue;

      const key = `${beh.target}::${srcAgg}.${srcEvent}->${targetAgg}.${targetCmd}`;
      if (seen.has(key)) continue;
      seen.add(key);

      collected.push({
        storyName: beh.target,
        ruleId: rule.id,
        srcAgg,
        srcEvent,
        srcEventFields,
        targetAgg,
        targetCmd,
        cmdParams: targetCmdStruct.parameters ?? [],
        entityIdField: pickEntityIdField(srcEventFields, targetAgg),
        permanentOn: Array.isArray(storyStruct?.dispose?.permanentOn)
          ? storyStruct.dispose.permanentOn.map(String)
          : [],
        idempotencyKey: String(storyStruct?.callerContract?.idempotencyKey || 'command-level'),
      });
    }
  }
  return collected;
}

/**
 * Derive reactive Event -> Command policy specifications from Canonical Model v2 application behaviors.
 */
export function derivePolicySpecs(canonicalV2) {
  const aggMap = new Map((canonicalV2.structures?.aggregates ?? []).map(a => [a.name, a]));
  const storyMap = new Map((canonicalV2.structures?.stories ?? []).map(s => [s.name, s]));
  const rawPolicies = [];
  const seen = new Set();

  for (const beh of canonicalV2.behaviors ?? []) {
    if (beh.layer !== 'application') continue;
    const storyStruct = storyMap.get(beh.target) ?? null;
    rawPolicies.push(...collectRulePolicies(beh, storyStruct, aggMap, seen));
  }

  // Disambiguate policyName when multiple reactive stories target the same command
  const cmdCounts = new Map();
  for (const p of rawPolicies) {
    cmdCounts.set(p.targetCmd, (cmdCounts.get(p.targetCmd) ?? 0) + 1);
  }
  return rawPolicies.map(p => {
    const policyName = (cmdCounts.get(p.targetCmd) ?? 0) > 1
      ? `PolicyOn${toPascal(p.storyName)}${p.targetCmd}`
      : `PolicyOn${p.targetCmd}`;
    return { ...p, policyName };
  });
}

function renderSharedPolicyFiles(packageName, commonPackage) {
  const pkgDir = packageName.split('.').join('/');
  const policyPkg = `${packageName}.application.projection.policy`;
  const policyDir = `app/${pkgDir}/application/projection/policy`;
  const files = {};

  files[`${policyDir}/FailureVerdict.scala`] = [
    `package ${policyPkg}`,
    '',
    `import ${commonPackage}.CommonTypes.iMadzError`,
    '',
    '/** Pure policy failure verdict classified by kernel dispose and interpreted by PolicyMachine. */',
    'sealed trait FailureVerdict extends Product with Serializable',
    'object FailureVerdict {',
    '  final case class Retryable(err: iMadzError) extends FailureVerdict',
    '  final case class Permanent(what: String, err: iMadzError) extends FailureVerdict',
    '}',
    '',
  ].join('\n');

  files[`${policyDir}/PolicyEnvelope.scala`] = [
    `package ${policyPkg}`,
    '',
    'import scala.concurrent.Future',
    '',
    '/** Framework-neutral event envelope carried into PolicyMachine so policy runtime can be tested standalone. */',
    'final case class PolicyEnvelope[+E](persistenceId: String, sequenceNr: Long, event: E)',
    '',
    'trait PolicyDlqSink {',
    '  def bury(envelope: PolicyEnvelope[Any], aggType: String, what: String): Future[Unit]',
    '}',
    '',
    'object PolicyDlqSink {',
    '  object Noop extends PolicyDlqSink {',
    '    override def bury(envelope: PolicyEnvelope[Any], aggType: String, what: String): Future[Unit] =',
    '      Future.successful(())',
    '  }',
    '}',
    '',
  ].join('\n');

  files[`${policyDir}/PolicyMachine.scala`] = [
    `package ${policyPkg}`,
    '',
    `import ${commonPackage}.CommonTypes.iMadzError`,
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    '/** Shared 4-stage reactive policy projection pipeline: decode -> decide -> execute -> dispose / bury. */',
    'object PolicyMachine {',
    '  def run[E, C](',
    '    envelope: PolicyEnvelope[Any],',
    '    aggType: String,',
    '    decode: Any => Option[E],',
    '    decide: (PolicyEnvelope[Any], E) => List[C],',
    '    execute: C => Future[Either[iMadzError, Unit]],',
    '    dispose: (E, iMadzError) => FailureVerdict,',
    '    bury: (PolicyEnvelope[Any], String) => Future[Unit]',
    '  )(implicit ec: ExecutionContext): Future[Unit] =',
    '    decode(envelope.event) match {',
    '      case None => Future.successful(())',
    '      case Some(e) =>',
    '        val commands = decide(envelope, e)',
    '        Future',
    '          .traverse(commands)(execute)',
    '          .flatMap { results =>',
    '            val verdicts = results.collect { case Left(err) => dispose(e, err) }',
    '            val permanents = verdicts.collect { case p: FailureVerdict.Permanent => p }',
    '            val retryables = verdicts.collect { case r: FailureVerdict.Retryable => r }',
    '            Future',
    '              .traverse(permanents)(p => bury(envelope, s"$aggType·${p.what}"))',
    '              .flatMap { _ =>',
    '                retryables.headOption match {',
    '                  case Some(FailureVerdict.Retryable(err)) =>',
    '                    Future.failed(new RuntimeException(s"[policy] $aggType retryable failure: err=${err.code}"))',
    '                  case None =>',
    '                    Future.successful(())',
    '                }',
    '              }',
    '          }',
    '          .recoverWith {',
    '            case f: iMadzError =>',
    '              dispose(e, f) match {',
    '                case FailureVerdict.Permanent(what, _) =>',
    '                  bury(envelope, s"$aggType·$what")',
    '                case FailureVerdict.Retryable(err) =>',
    '                  Future.failed(new RuntimeException(s"[policy] $aggType retryable failure: err=${err.code}"))',
    '              }',
    '          }',
    '    }',
    '',
    '  def runSimple[E, C](',
    '    envelope: PolicyEnvelope[Any],',
    '    aggType: String,',
    '    decode: Any => Option[E],',
    '    decide: E => List[C],',
    '    execute: C => Future[Either[iMadzError, Unit]],',
    '    dispose: (E, iMadzError) => FailureVerdict,',
    '    bury: (PolicyEnvelope[Any], String) => Future[Unit]',
    '  )(implicit ec: ExecutionContext): Future[Unit] =',
    '    run(envelope, aggType, decode, (_, e) => decide(e), execute, dispose, bury)',
    '}',
    '',
  ].join('\n');

  files[`${policyDir}/PolicyDlqBury.scala`] = [
    `package ${policyPkg}`,
    '',
    'import javax.inject.{Inject, Singleton}',
    'import scalikejdbc._',
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    '/** ScalikeJDBC dead-letter sink recording permanent policy dispatch failures into kn_projection_dlq. */',
    '@Singleton',
    `final class PolicyDlqBury(clock: () => Long)(implicit ec: ExecutionContext) extends PolicyDlqSink {`,
    '  @Inject() def this()(implicit ec: ExecutionContext) = this(() => java.time.Instant.EPOCH.toEpochMilli)',
    '',
    '  override def bury(envelope: PolicyEnvelope[Any], aggType: String, what: String): Future[Unit] = Future {',
    '    val eventId = s"${envelope.persistenceId}|${envelope.sequenceNr}"',
    '    val nowMs = clock()',
    '    DB.localTx { implicit session =>',
    '      sql"""|INSERT INTO kn_projection_dlq',
    '            |  (event_id, agg_type, event_type, persistence_id, sequence_nr, error, failed_at_millis)',
    '            |VALUES',
    '            |  (${eventId}, ${aggType}, \'PolicyFailure\', ${envelope.persistenceId}, ${envelope.sequenceNr}, ${what.take(1000)}, ${nowMs})',
    '            |ON CONFLICT (event_id) DO NOTHING""".stripMargin.update.apply()',
    '    }',
    '    ()',
    '  }',
    '}',
    '',
  ].join('\n');

  return files;
}

function renderPolicyKernelFile(p, { packageName, commonPackage, docId, nominalIdx }) {
  const policyPkg = `${packageName}.application.projection.policy`;
  const evFieldMap = new Map(p.srcEventFields.map(f => [f.name, f]));
  const usesValues = p.cmdParams.some(cp => typeUsesNominal(cp.resolvedType, nominalIdx));
  const valuesImport = usesValues ? [`import ${packageName}.domain.values._`] : [];

  const paramArgs = p.cmdParams.map((cp) => {
    const srcField = evFieldMap.get(cp.name);
    if (srcField && scalaTypeOf(srcField.resolvedType, nominalIdx) === scalaTypeOf(cp.resolvedType, nominalIdx)) {
      return `${cp.name} = event.${srcField.name}`;
    }
    return `${cp.name} = ${defaultScalaExpr(cp.resolvedType, nominalIdx)}`;
  });

  const paramsExpr = paramArgs.length > 0
    ? `${p.targetCmd}Params(${paramArgs.join(', ')})`
    : `${p.targetCmd}Params()`;

  const entityIdExpr = p.entityIdField
    ? `event.${p.entityIdField}.toString`
    : 'envelope.persistenceId';

  const disposeLines = p.permanentOn.length > 0
    ? [
        `      if (${p.permanentOn.map(c => `err.code == ${JSON.stringify(c)}`).join(' || ')})`,
        `        FailureVerdict.Permanent(s"${p.policyName}: \${err.code}", err)`,
        '      else',
        '        FailureVerdict.Retryable(err)',
      ]
    : ['      FailureVerdict.Retryable(err)'];

  return [
    `// @knowledge source:${docId}#/stories/${p.storyName}`,
    `package ${policyPkg}`,
    '',
    ...valuesImport,
    `import ${commonPackage}.CommonTypes.iMadzError`,
    `import ${packageName}.domain.entities.${p.srcAgg}Entity.${p.srcEvent}`,
    `import ${packageName}.domain.invariants.params.${p.targetAgg}RuleParams.${p.targetCmd}Params`,
    '',
    `final case class ${p.policyName}Command(entityId: String, params: ${p.targetCmd}Params)`,
    '',
    `trait ${p.policyName}Semantics {`,
    `  def decide(envelope: PolicyEnvelope[Any], event: ${p.srcEvent}): List[${p.policyName}Command]`,
    `  def dispose(event: ${p.srcEvent}, err: iMadzError): FailureVerdict`,
    '}',
    '',
    `object ${p.policyName} {`,
    `  val policyName: String = ${JSON.stringify(p.policyName)}`,
    `  val idempotencyKey: String = ${JSON.stringify(p.idempotencyKey)}`,
    '',
    `  object DefaultSemantics extends ${p.policyName}Semantics {`,
    `    override def decide(envelope: PolicyEnvelope[Any], event: ${p.srcEvent}): List[${p.policyName}Command] =`,
    `      List(${p.policyName}Command(entityId = ${entityIdExpr}, params = ${paramsExpr}))`,
    '',
    `    override def dispose(event: ${p.srcEvent}, err: iMadzError): FailureVerdict =`,
    ...disposeLines,
    '  }',
    '}',
    '',
  ].join('\n');
}

function renderPolicyRuntimeFiles(p, { packageName, commonPackage, context, docId }) {
  const pkgDir = packageName.split('.').join('/');
  const policyPkg = `${packageName}.application.projection.policy`;
  const policyDir = `app/${pkgDir}/application/projection/policy`;
  const bootDir = `app/${pkgDir}/infrastructure/bootstrap`;
  const anchor = `// @knowledge source:${docId}#/stories/${p.storyName}`;
  const files = {};

  const forwardArgs = p.cmdParams.map(cp => `cmd.params.${cp.name}`);
  const askArgs = [...forwardArgs, 'replyTo'].join(', ');

  files[`${policyDir}/${p.policyName}Mechanics.scala`] = [
    anchor,
    `package ${policyPkg}`,
    '',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import akka.util.Timeout',
    `import ${commonPackage}.CommonTypes.iMadzError`,
    `import ${packageName}.application.aggregates.${p.targetAgg}Aggregate`,
    `import ${packageName}.application.aggregates.${p.targetAgg}Protocol.{${p.targetCmd}, Accepted, Refused, Reply}`,
    'import scala.concurrent.duration._',
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    `object ${p.policyName}Mechanics {`,
    '  private implicit val askTimeout: Timeout = Timeout(10.seconds)',
    '',
    `  def execute(sharding: ClusterSharding)(implicit ec: ExecutionContext): ${p.policyName}Command => Future[Either[iMadzError, Unit]] =`,
    '    cmd =>',
    '      sharding',
    `        .entityRefFor(${p.targetAgg}Aggregate.EntityKey, cmd.entityId)`,
    `        .ask[Reply](replyTo => ${p.targetCmd}(${askArgs}))`,
    '        .map {',
    '          case Accepted(_) => Right(())',
    '          case Refused(err) => Left(err)',
    '        }',
    '}',
    '',
  ].join('\n');

  files[`${policyDir}/${p.policyName}Handler.scala`] = [
    anchor,
    `package ${policyPkg}`,
    '',
    'import akka.Done',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import akka.projection.eventsourced.EventEnvelope',
    'import akka.projection.scaladsl.Handler',
    `import ${packageName}.domain.entities.${p.srcAgg}Entity`,
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    `final class ${p.policyName}Handler(`,
    '  sharding: ClusterSharding,',
    `  semantics: ${p.policyName}Semantics = ${p.policyName}.DefaultSemantics,`,
    '  dlqSink: PolicyDlqSink = PolicyDlqSink.Noop',
    ')(implicit ec: ExecutionContext) extends Handler[EventEnvelope[Any]] {',
    '  override def process(envelope: EventEnvelope[Any]): Future[Done] =',
    '    PolicyMachine',
    `      .run[${p.srcAgg}Entity.${p.srcEvent}, ${p.policyName}Command](`,
    '        envelope = PolicyEnvelope(envelope.persistenceId, envelope.sequenceNr, envelope.event),',
    `        aggType = ${JSON.stringify(p.srcAgg)},`,
    '        decode = {',
    `          case event: ${p.srcAgg}Entity.${p.srcEvent} => Some(event)`,
    '          case _ => None',
    '        },',
    '        decide = semantics.decide,',
    `        execute = ${p.policyName}Mechanics.execute(sharding),`,
    '        dispose = semantics.dispose,',
    `        bury = (env, what) => dlqSink.bury(env, ${JSON.stringify(p.srcAgg)}, what)`,
    '      )',
    '      .map(_ => Done)',
    '}',
    '',
  ].join('\n');

  files[`${policyDir}/${p.policyName}Runner.scala`] = [
    anchor,
    `package ${policyPkg}`,
    '',
    'import akka.actor.typed.ActorSystem',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import akka.persistence.query.Offset',
    'import akka.projection.ProjectionId',
    'import akka.projection.eventsourced.EventEnvelope',
    'import akka.projection.eventsourced.scaladsl.EventSourcedProvider',
    'import akka.projection.jdbc.JdbcSession',
    'import akka.projection.jdbc.scaladsl.JdbcProjection',
    'import akka.projection.scaladsl.{AtLeastOnceProjection, SourceProvider}',
    'import scala.concurrent.ExecutionContext',
    '',
    `object ${p.policyName}Runner {`,
    `  val ProjectionName: String = ${JSON.stringify(`${toSnake(context)}-${toSnake(p.policyName)}`)};`,
    '',
    '  def sourceProvider(',
    '    system: ActorSystem[Nothing],',
    '    readJournalPluginId: String,',
    '    tag: String',
    '  ): SourceProvider[Offset, EventEnvelope[Any]] =',
    '    EventSourcedProvider.eventsByTag[Any](system, readJournalPluginId, tag)',
    '',
    '  def createHandler(',
    '    sharding: ClusterSharding,',
    `    semantics: ${p.policyName}Semantics = ${p.policyName}.DefaultSemantics,`,
    '    dlqSink: PolicyDlqSink = PolicyDlqSink.Noop',
    `  )(implicit ec: ExecutionContext): ${p.policyName}Handler =`,
    `    new ${p.policyName}Handler(sharding, semantics, dlqSink)`,
    '',
    '  def projectionId(tag: String): ProjectionId =',
    '    ProjectionId(ProjectionName, tag)',
    '',
    '  def createProjection(',
    '    system: ActorSystem[Nothing],',
    '    sharding: ClusterSharding,',
    '    readJournalPluginId: String,',
    '    tag: String,',
    `    semantics: ${p.policyName}Semantics = ${p.policyName}.DefaultSemantics,`,
    '    dlqSink: PolicyDlqSink = PolicyDlqSink.Noop,',
    '    sessionFactory: () => JdbcSession',
    '  )(implicit ec: ExecutionContext): AtLeastOnceProjection[Offset, EventEnvelope[Any]] =',
    '    JdbcProjection.atLeastOnceAsync(',
    '      projectionId = projectionId(tag),',
    '      sourceProvider = sourceProvider(system, readJournalPluginId, tag),',
    '      sessionFactory = sessionFactory,',
    '      handler = () => createHandler(sharding, semantics, dlqSink)',
    '    )(system)',
    '}',
    '',
  ].join('\n');

  files[`${bootDir}/${p.policyName}Bootstrap.scala`] = [
    anchor,
    `package ${packageName}.infrastructure.bootstrap`,
    '',
    'import akka.actor.typed.ActorSystem',
    'import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, ShardedDaemonProcess}',
    'import akka.projection.ProjectionBehavior',
    `import ${policyPkg}.{PolicyDlqSink, ${p.policyName}Runner, ${p.policyName}Semantics}`,
    `import ${packageName}.infrastructure.persistence.ScalikeJdbcProjectionSession`,
    'import scala.concurrent.ExecutionContext',
    '',
    `trait ${p.policyName}Bootstrap {`,
    `  protected def init${p.policyName}Projection(`,
    '    system: ActorSystem[Nothing],',
    '    sharding: ClusterSharding,',
    '    readJournalPluginId: String,',
    '    tags: Vector[String],',
    `    semantics: ${p.policyName}Semantics,`,
    '    dlqSink: PolicyDlqSink',
    '  )(implicit ec: ExecutionContext): Unit = {',
    '    if (tags.nonEmpty && readJournalPluginId.nonEmpty && readJournalPluginId != "disabled") {',
    '      ShardedDaemonProcess(system).init[ProjectionBehavior.Command](',
    `        name = ${p.policyName}Runner.ProjectionName,`,
    '        numberOfInstances = tags.size,',
    '        behaviorFactory = idx =>',
    '          ProjectionBehavior(',
    `            ${p.policyName}Runner.createProjection(system, sharding, readJournalPluginId, tags(idx), semantics, dlqSink, () => new ScalikeJdbcProjectionSession())`,
    '          ),',
    '        stopMessage = ProjectionBehavior.Stop',
    '      )',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');

  return files;
}

/**
 * Emit PolicyMachine runtime + reactive Event->Command policy projections for scala-cqrs-play-service@2.
 */
export function emitV1PolicySuite(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const rp = resolveRuntimeProfile({ runtimeProfile });
  const pkgDir = packageName.split('.').join('/');
  const nominalIdx = buildNominalIndex(canonicalV2);
  const policies = derivePolicySpecs(canonicalV2);

  if (policies.length === 0) {
    return {
      files: {},
      handwrittenFiles: {},
      policyProjections: [],
      familiesUsed: [],
    };
  }

  const files = renderSharedPolicyFiles(packageName, rp.commonPackage);
  for (const p of policies) {
    files[`app/${pkgDir}/application/projection/policy/${p.policyName}.scala`] = renderPolicyKernelFile(p, {
      packageName,
      commonPackage: rp.commonPackage,
      docId,
      nominalIdx,
    });
    Object.assign(files, renderPolicyRuntimeFiles(p, {
      packageName,
      commonPackage: rp.commonPackage,
      context,
      docId,
    }));
  }

  return {
    files,
    handwrittenFiles: {},
    policyProjections: policies.map(p => ({
      name: p.policyName,
      sourceAggregate: p.srcAgg,
    })),
    familiesUsed: [
      'policy-decision',
      'policy-mechanics',
      'policy-handler',
      'policy-runner',
      'policy-bootstrap',
      'projection-runtime-mechanism',
    ],
  };
}
