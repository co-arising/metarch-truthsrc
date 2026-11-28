// Orchestration, Saga, Effect Host, ToolGate Connector, and External Event Bridge for scala-cqrs-play-service@2:
//   - #46 external-event-bridge     -> application/aggregates/behaviors/<Agg>ExternalEvents.scala (via real 1.0 emitter)
//   - #13 external-connector-port   -> application/toolgates/<Port>ConnectorPort.scala
//   - #25 connector-implementation  -> infrastructure/connectors/<Port>ConnectorImpl.scala
//   - #40 strict-saga-module        -> application/process/<Flow>SagaModule.scala
//   - #41 strict-fixture-host       -> application/process/<Flow>FixtureHost.scala
//   - #42 composition-invocation    -> application/process/<Flow>CompositionHost.scala
//   - #43 pipeline-invocation-face  -> application/process/<Flow>InvocationFace.scala
//   - #44 effect-face               -> application/process/<Eff>EffectFace.scala
//   - #38c saga-coordinator-boot    -> infrastructure/bootstrap/SagaCoordinatorBootstrap.scala
//   - #38d process/effect-boot      -> infrastructure/bootstrap/<Flow>ProcessBootstrap.scala + <Eff>EffectBootstrap.scala
//   - host/effect protobufs         -> protobuf/<flow>_host.proto + protobuf/<eff>_effect.proto
import { family as externalEventBridgeFamily } from '../../../emitter/families/external-event-bridge.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { toCamel, toPascal } from '../codegen/onion-routes.mjs';

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

function toKebab(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
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

function scalaTypeOf(rt, nominalIdx = { exactByName: new Map(), voByName: new Map() }) {
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

function toV1PrimitiveName(rt) {
  switch (rt?.kind) {
    case 'int': return 'integer';
    case 'bool': return 'boolean';
    case 'decimal': return 'decimal';
    default: return 'string';
  }
}

/**
 * Derive normalized pipeline specs from canonicalV2.structures.pipelines / canonicalV2.pipelines.
 */
function derivePipelineSpecs(canonicalV2) {
  const raw = canonicalV2.structures?.pipelines ?? canonicalV2.pipelines ?? [];
  return raw.map(pl => {
    const rawName = String(pl.name || pl.id || 'Pipeline');
    let stageList = [];
    if (Array.isArray(pl.stages) && pl.stages.length > 0) stageList = pl.stages;
    else if (Array.isArray(pl.steps)) stageList = pl.steps;
    return {
      name: toPascal(rawName),
      rawName,
      kind: 'pipeline',
      description: pl.description || `Durable execution pipeline for ${rawName}`,
      triggerEvent: pl.trigger || pl.triggerEvent || `${toPascal(rawName)}Triggered`,
      admission: pl.admission ? String(typeof pl.admission === 'string' ? pl.admission : JSON.stringify(pl.admission)) : null,
      steps: stageList.map((st, idx) => ({
        name: toPascal(typeof st === 'string' ? st : (st.name || st.id || `Stage${idx + 1}`)),
        target: typeof st === 'string' ? st : (st.target || st.command || st.name || st.id || `Stage${idx + 1}`),
        compensation: typeof st === 'object' ? (st.compensation || st.compensate || null) : null,
      })),
    };
  });
}

/**
 * Derive normalized saga & pipeline specs from canonicalV2.structures.sagas, canonicalV2.structures.pipelines,
 * or multi-dispatch application stories.
 */
function deriveSagaSpecs(canonicalV2) {
  const pipelines = derivePipelineSpecs(canonicalV2);
  const explicit = canonicalV2.structures?.sagas ?? canonicalV2.sagas ?? [];
  const sagas = explicit.length > 0
    ? explicit.map(s => ({
        name: toPascal(s.name),
        rawName: s.name,
        kind: 'saga',
        description: s.description || `Strict saga orchestration for ${s.name}`,
        triggerEvent: s.triggerEvent || s.trigger || `${toPascal(s.name)}Started`,
        admission: null,
        steps: (s.steps ?? []).map((st, idx) => ({
          name: toPascal(typeof st === 'string' ? st : (st.name || `Step${idx + 1}`)),
          target: typeof st === 'string' ? st : (st.target || st.command || st.name || `Step${idx + 1}`),
          compensation: typeof st === 'object' ? (st.compensation || st.compensate || null) : null,
        })),
      }))
    : (canonicalV2.structures?.stories ?? [])
        .filter(st => (st.dispatches ?? []).length >= 2)
        .map(st => ({
          name: `${toPascal(st.name)}Saga`,
          rawName: st.name,
          kind: 'saga',
          description: st.description || `Coordinated multi-step orchestration for ${st.name}`,
          triggerEvent: `${toPascal(st.name)}Initiated`,
          admission: null,
          steps: (st.dispatches ?? []).map((d, idx) => ({
            name: toPascal(String(d).split('.').pop() || `Step${idx + 1}`),
            target: String(d),
            compensation: null,
          })),
        }));

  const seen = new Set();
  const combined = [];
  for (const item of [...pipelines, ...sagas]) {
    const key = item.name.replace(/Saga$/u, '');
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(item);
  }
  return combined;
}

/**
 * Derive effect boundary specs from canonicalV2.effects / canonicalV2.structures.effects
 * or stories declaring external pins / bridge effects.
 */
export function deriveEffectSpecs(canonicalV2) {
  const explicit = canonicalV2.structures?.effects ?? canonicalV2.effects ?? [];
  if (explicit.length > 0) {
    return explicit.map(e => ({
      name: toPascal(e.name),
      rawName: e.name,
      protocol: e.protocol || 'at-least-once',
      operations: (e.operations ?? ['execute', 'reconcile']).map(String),
    }));
  }
  const stories = canonicalV2.structures?.stories ?? [];
  const derived = [];
  for (const st of stories) {
    if ((st.pins ?? []).length > 0) {
      derived.push({
        name: `${toPascal(st.name)}Effect`,
        rawName: st.name,
        protocol: st.callerContract?.retryPolicy?.includes('three-phase') ? 'three-phase-reconcile' : 'idempotent-pin',
        operations: ['pin', 'dispatch', 'reconcile'],
      });
    }
  }
  return derived;
}

/**
 * Emit Orchestration, Saga, Effect Host, ToolGate Connectors, and External Event Bridges.
 */
export function emitV1OrchestrationSuite(canonicalV2, {
  packageName = 'example.v2',
  runtimeProfile = null,
  externalIntegrations = [],
} = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const rp = resolveRuntimeProfile({ runtimeProfile });
  const pkgDir = packageName.split('.').join('/');
  const aggregates = canonicalV2.structures?.aggregates ?? [];
  const files = {};
  const handwrittenFiles = {};
  const handwrittenMethodSpecs = {};
  const familiesUsed = [];
  const authorityAggs = new Set();
  const externalProducersByAgg = new Map();
  const hostSerializers = [];
  const effectSerializers = [];
  const sagaBootstraps = [];
  const effectBootstraps = [];
  const effectPorts = [];

  // 1. #46 external-event-bridge (from aggregate.externalProducers or cross-BC domainMap externalIntegrations)
  const bridges = [];
  for (const agg of aggregates) {
    const aggProducers = [
      ...(agg.externalProducers ?? []),
      ...externalIntegrations.filter(intg => intg.targetAggregate === agg.name || intg.aggregate === agg.name),
    ];
    if (aggProducers.length === 0) continue;

    const producers = [];
    for (const p of aggProducers) {
      const id = toKebab(p.id || p.name || `${p.fromContext || 'ext'}-${p.event || 'event'}`).replace(/[^a-z0-9_-]/gu, '');
      const evName = toPascal(p.event || p.targetEvent || (agg.events?.[0]?.name ?? 'ExternalEventReceived'));
      const matchedEv = (agg.events ?? []).find(e => e.name === evName);
      const evFields = matchedEv?.fields ?? [];
      const firstField = evFields[0]?.name || 'id';
      const slotMembers = Array.isArray(p.slotMembers) ? p.slotMembers : [];
      const outputType = p.outputType ?? { form: 'primitive', name: toV1PrimitiveName(evFields[0]?.resolvedType) };
      const identityKeys = Array.isArray(p.identityKeys) && p.identityKeys.length > 0
        ? p.identityKeys
        : [{ member: firstField, unwrapDepth: 0 }];
      producers.push({
        id: id || 'external-event',
        event: evName,
        outputType,
        slotMembers,
        identityKeys,
        source: { document: docId, pointer: `/aggregates/${agg.name}/externalProducers/${id || 'external-event'}` },
      });
    }

    if (producers.length > 0) {
      bridges.push({
        context,
        aggregate: agg.name,
        producers,
      });
      authorityAggs.add(agg.name);
      externalProducersByAgg.set(agg.name, producers);
    }
  }

  if (bridges.length > 0) {
    try {
      const eebOut = externalEventBridgeFamily.renderAll({
        schemaVersion: 'truthsrc.external-event-bridge-input/v1',
        packages: [{ context, package: packageName }],
        bridges,
      });
      Object.assign(files, eebOut);
      familiesUsed.push('external-event-bridge');
    } catch {
      // Fail-open if external producer descriptors lack full nominal types; clear authority flags to stay consistent.
      authorityAggs.clear();
      externalProducersByAgg.clear();
    }
  }

  // 2. #13 external-connector-port & #25 connector-implementation (grouped by ownerPort from externContracts)
  const nominalIdx = buildNominalIndex(canonicalV2);
  const externContracts = canonicalV2.structures?.externContracts ?? [];
  const contractsByPort = new Map();
  for (const ec of externContracts) {
    const portKey = toPascal(ec.ownerPort || `${context}ToolGate`);
    if (!contractsByPort.has(portKey)) contractsByPort.set(portKey, []);
    contractsByPort.get(portKey).push(ec);
  }
  for (const [portName, contracts] of contractsByPort) {
    const anchor = `// @knowledge source:${docId}#/externContracts/${portName}`;
    const portTrait = `${portName}ConnectorPort`;
    const implClass = `${portName}ConnectorImpl`;
    const usesValues = contracts.some(ec => (ec.params ?? []).some(p => typeUsesNominal(p.resolvedType, nominalIdx)));
    const valuesImport = usesValues ? [`import ${packageName}.domain.values._`] : [];
    const methods = contracts.map(ec => {
      const params = (ec.params ?? []).map(p => `${p.name}: ${scalaTypeOf(p.resolvedType, nominalIdx)}`).join(', ');
      return { name: ec.name, params, ec };
    });

    files[`app/${pkgDir}/application/toolgates/${portTrait}.scala`] = [
      anchor,
      `package ${packageName}.application.toolgates`,
      '',
      ...valuesImport,
      'import scala.concurrent.Future',
      '',
      `/** Business-only external connector port for ${portName} (family #13). */`,
      `trait ${portTrait} {`,
      ...methods.map(m => `  def ${m.name}(${m.params}): Future[Boolean]`),
      '}',
      '',
    ].join('\n');

    const connMethodEntries = methods.map(m => {
      const defVal = /exists|recorded|already|absent/iu.test(m.name) ? 'false' : 'true';
      return {
        name: m.name,
        snippet: `  override def ${m.name}(${m.params}): Future[Boolean] = Future.successful(${defVal})`,
      };
    });
    const connHwRel = `handwritten/scala/${pkgDir}/infrastructure/connectors/${implClass}.scala`;
    handwrittenMethodSpecs[connHwRel] = connMethodEntries;

    // #25 Connector implementation lives in the handwritten isolation zone (never overwritten once created;
    // bound in GeneratedBindingsModule and overrideable in HandwrittenBindingsModule).
    handwrittenFiles[connHwRel] = [
      `// Handwritten external ToolGate connector isolation zone for ${portTrait} (family #25).`,
      '// Replace default stub responses with real external client integrations; truthsrc generate-v2 will never overwrite this file.',
      anchor,
      `package ${packageName}.infrastructure.connectors`,
      '',
      `import ${packageName}.application.toolgates.${portTrait}`,
      ...valuesImport,
      'import scala.concurrent.Future',
      '',
      `final class ${implClass} extends ${portTrait} {`,
      ...connMethodEntries.map(m => m.snippet),
      '}',
      '',
    ].join('\n');
  }
  if (contractsByPort.size > 0) {
    familiesUsed.push('external-connector-port', 'connector-implementation');
  }

  // 3. #40 strict-saga-module, #41 strict-fixture-host, #42 composition-invocation-host, #43 pipeline-invocation-face, #38d ProcessBootstrap, host proto
  const sagas = deriveSagaSpecs(canonicalV2);
  let sagaSerIdx = 0;
  for (const saga of sagas) {
    sagaSerIdx += 1;
    const flowStem = saga.name.replace(/Saga$/u, '');
    const flow = flowStem || saga.name;
    const flowSnake = toSnake(flow);
    const anchorSection = saga.kind === 'pipeline' ? 'pipelines' : 'sagas';
    const anchor = `// @knowledge source:${docId}#/${anchorSection}/${saga.rawName}`;

    // #43 pipeline-invocation-face
    files[`app/${pkgDir}/application/process/${flow}InvocationFace.scala`] = [
      anchor,
      `package ${packageName}.application.process`,
      '',
      `import ${rp.commonPackage}.CommonTypes.iMadzError`,
      'import scala.concurrent.Future',
      '',
      `object ${flow}InvocationFace {`,
      `  final case class StartRequest(correlationId: String, payload: Map[String, Any] = Map.empty)`,
      `  final case class StepOutcome(step: String, succeeded: Boolean, detail: String = "")`,
      `  final case class ExecutionResult(correlationId: String, completed: Boolean, outcomes: Seq[StepOutcome])`,
      '',
      '  trait Client {',
      '    def start(req: StartRequest): Future[Either[iMadzError, ExecutionResult]]',
      '  }',
      '}',
      '',
    ].join('\n');

    // #40 strict-saga-module
    const stepNames = saga.steps.map(s => JSON.stringify(s.target)).join(', ');
    files[`app/${pkgDir}/application/process/${flow}SagaModule.scala`] = [
      anchor,
      `package ${packageName}.application.process`,
      '',
      `import ${rp.commonPackage}.CborSerializable`,
      '',
      `object ${flow}SagaModule {`,
      `  val FlowName: String = ${JSON.stringify(flow)}`,
      `  val TriggerEvent: String = ${JSON.stringify(saga.triggerEvent)}`,
      `  val OrderedSteps: Vector[String] = Vector(${stepNames})`,
      '',
      '  sealed trait SagaEvent extends CborSerializable',
      `  final case class Started(correlationId: String) extends SagaEvent`,
      `  final case class StepCompleted(correlationId: String, step: String) extends SagaEvent`,
      `  final case class Compensated(correlationId: String, failedStep: String, reason: String) extends SagaEvent`,
      `  final case class Completed(correlationId: String) extends SagaEvent`,
      '',
      '  final case class SagaState(',
      '    correlationId: String = "",',
      '    completedSteps: Vector[String] = Vector.empty,',
      '    status: String = "pending"',
      '  ) {',
      '    def applyEvent(ev: SagaEvent): SagaState = ev match {',
      '      case Started(cid)                => copy(correlationId = cid, status = "running")',
      '      case StepCompleted(_, step)      => copy(completedSteps = completedSteps :+ step)',
      '      case Compensated(_, _, _)        => copy(status = "compensated")',
      '      case Completed(_)                => copy(status = "completed")',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    // #41 strict-fixture-host
    files[`app/${pkgDir}/application/process/${flow}FixtureHost.scala`] = [
      anchor,
      `package ${packageName}.application.process`,
      '',
      `import ${packageName}.application.process.${flow}SagaModule._`,
      '',
      `/** Deterministic fixture host for testing ${flow} replay and compensation paths (family #41). */`,
      `object ${flow}FixtureHost {`,
      '  def replay(events: Seq[SagaEvent]): SagaState =',
      '    events.foldLeft(SagaState())(_.applyEvent(_))',
      '',
      '  def nextPendingStep(state: SagaState): Option[String] =',
      '    OrderedSteps.find(step => !state.completedSteps.contains(step))',
      '}',
      '',
    ].join('\n');

    // #42 composition-invocation-host
    files[`app/${pkgDir}/application/process/${flow}CompositionHost.scala`] = [
      anchor,
      `package ${packageName}.application.process`,
      '',
      'import akka.actor.typed.{ActorRef, Behavior}',
      'import akka.actor.typed.scaladsl.Behaviors',
      'import akka.cluster.sharding.typed.scaladsl.EntityTypeKey',
      `import ${packageName}.application.process.${flow}InvocationFace._`,
      `import ${packageName}.application.process.${flow}SagaModule._`,
      '',
      `object ${flow}CompositionHost {`,
      '  sealed trait Command',
      '  final case class Start(req: StartRequest, replyTo: ActorRef[ExecutionResult]) extends Command',
      '',
      `  val TypeKey: EntityTypeKey[Command] = EntityTypeKey[Command](${JSON.stringify(`${flow}Host`)})`,
      '',
      '  def apply(entityId: String): Behavior[Command] =',
      '    Behaviors.receiveMessage {',
      '      case Start(req, replyTo) =>',
      '        val outcomes = OrderedSteps.map(s => StepOutcome(s, succeeded = true))',
      '        replyTo ! ExecutionResult(req.correlationId, completed = true, outcomes = outcomes)',
      '        Behaviors.same',
      '    }',
      '}',
      '',
    ].join('\n');

    // #38d ProcessBootstrap
    files[`app/${pkgDir}/infrastructure/bootstrap/${flow}ProcessBootstrap.scala`] = [
      anchor,
      `package ${packageName}.infrastructure.bootstrap`,
      '',
      'import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity}',
      `import ${packageName}.application.process.${flow}CompositionHost`,
      '',
      `trait ${flow}ProcessBootstrap {`,
      `  protected def init${flow}Process(sharding: ClusterSharding): Unit = {`,
      `    sharding.init(Entity(${flow}CompositionHost.TypeKey)(ctx => ${flow}CompositionHost(ctx.entityId)))`,
      '  }',
      '}',
      '',
    ].join('\n');

    // Host Protobuf schema
    files[`app/protobuf/${flowSnake}_host.proto`] = [
      'syntax = "proto3";',
      '',
      `package ${packageName}.infrastructure.proto;`,
      '',
      `message ${flow}StartedPO {`,
      '  string correlation_id = 1;',
      '}',
      '',
      `message ${flow}StepCompletedPO {`,
      '  string correlation_id = 1;',
      '  string step = 2;',
      '}',
      '',
      `message ${flow}CompletedPO {`,
      '  string correlation_id = 1;',
      '}',
      '',
    ].join('\n');

    files[`app/${pkgDir}/infrastructure/persistence/${flow}HostSerializer.scala`] = [
      anchor,
      `package ${packageName}.infrastructure.persistence`,
      '',
      'import akka.serialization.SerializerWithStringManifest',
      `import ${packageName}.application.process.${flow}SagaModule._`,
      'import java.nio.charset.StandardCharsets',
      'import play.api.libs.json.{Format, Json}',
      '',
      `final class ${flow}HostSerializer extends SerializerWithStringManifest {`,
      '  private implicit val startedFmt: Format[Started] = Json.format[Started]',
      '  private implicit val stepCompletedFmt: Format[StepCompleted] = Json.format[StepCompleted]',
      '  private implicit val compensatedFmt: Format[Compensated] = Json.format[Compensated]',
      '  private implicit val completedFmt: Format[Completed] = Json.format[Completed]',
      '',
      `  override def identifier: Int = ${741100 + sagaSerIdx}`,
      '',
      '  override def manifest(o: AnyRef): String = o match {',
      '    case _: Started       => "Started"',
      '    case _: StepCompleted => "StepCompleted"',
      '    case _: Compensated   => "Compensated"',
      '    case _: Completed     => "Completed"',
      `    case other => throw new IllegalArgumentException(s"Unsupported ${flow}Host event: \${other.getClass.getName}")`,
      '  }',
      '',
      '  override def toBinary(o: AnyRef): Array[Byte] = {',
      '    val js = o match {',
      '      case e: Started       => Json.toJson(e)',
      '      case e: StepCompleted => Json.toJson(e)',
      '      case e: Compensated   => Json.toJson(e)',
      '      case e: Completed     => Json.toJson(e)',
      `      case other => throw new IllegalArgumentException(s"Unsupported ${flow}Host event: \${other.getClass.getName}")`,
      '    }',
      '    Json.stringify(js).getBytes(StandardCharsets.UTF_8)',
      '  }',
      '',
      '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {',
      '    val js = Json.parse(new String(bytes, StandardCharsets.UTF_8))',
      '    manifest match {',
      '      case "Started"       => js.as[Started]',
      '      case "StepCompleted" => js.as[StepCompleted]',
      '      case "Compensated"   => js.as[Compensated]',
      '      case "Completed"     => js.as[Completed]',
      `      case other => throw new IllegalArgumentException(s"Unknown ${flow}Host manifest: $other")`,
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    hostSerializers.push({
      key: `${toKebab(flow)}-host`,
      serializerClass: `${packageName}.infrastructure.persistence.${flow}HostSerializer`,
      eventClass: `${packageName}.application.process.${flow}SagaModule$SagaEvent`,
    });
    sagaBootstraps.push({ flow, method: `init${flow}Process`, traitName: `${flow}ProcessBootstrap` });
  }

  if (sagas.length > 0) {
    familiesUsed.push(
      'strict-saga-module',
      'strict-fixture-host',
      'composition-invocation-host',
      'pipeline-invocation-face',
      'process-bootstrap',
    );
  }

  // 4. #44 effect-face + #38d EffectBootstrap + effect proto
  const effects = deriveEffectSpecs(canonicalV2);
  let effectSerIdx = 0;
  for (const eff of effects) {
    effectSerIdx += 1;
    const effStem = eff.name.replace(/Effect$/u, '');
    const effName = effStem || eff.name;
    const effSnake = toSnake(effName);
    const anchor = `// @knowledge source:${docId}#/effects/${eff.rawName}`;

    files[`app/${pkgDir}/application/process/${effName}EffectFace.scala`] = [
      anchor,
      `package ${packageName}.application.process`,
      '',
      `import ${rp.commonPackage}.CborSerializable`,
      'import scala.concurrent.Future',
      '',
      `object ${effName}EffectFace {`,
      `  val Protocol: String = ${JSON.stringify(eff.protocol)}`,
      '',
      '  sealed trait EffectEvent extends CborSerializable',
      '  final case class EffectRequested(idempotencyKey: String, operation: String) extends EffectEvent',
      '  final case class EffectConfirmed(idempotencyKey: String, externalRef: String) extends EffectEvent',
      '  final case class EffectReconciled(idempotencyKey: String, status: String) extends EffectEvent',
      '',
      '  trait Port {',
      ...eff.operations.map(op => `    def ${toCamel(toPascal(op))}(idempotencyKey: String, payload: Map[String, Any]): Future[EffectEvent]`),
      '  }',
      '}',
      '',
    ].join('\n');

    files[`app/${pkgDir}/infrastructure/bootstrap/${effName}EffectBootstrap.scala`] = [
      anchor,
      `package ${packageName}.infrastructure.bootstrap`,
      '',
      'import akka.actor.typed.ActorSystem',
      `import ${packageName}.application.process.${effName}EffectFace`,
      '',
      `trait ${effName}EffectBootstrap {`,
      `  protected def init${effName}Effect(system: ActorSystem[Nothing]): Unit = {`,
      `    val _ = (${effName}EffectFace.Protocol, system.name)`,
      '  }',
      '}',
      '',
    ].join('\n');

    files[`app/protobuf/${effSnake}_effect.proto`] = [
      'syntax = "proto3";',
      '',
      `package ${packageName}.infrastructure.proto;`,
      '',
      `message ${effName}RequestedPO {`,
      '  string idempotency_key = 1;',
      '  string operation = 2;',
      '}',
      '',
      `message ${effName}ConfirmedPO {`,
      '  string idempotency_key = 1;',
      '  string external_ref = 2;',
      '}',
      '',
    ].join('\n');

    files[`app/${pkgDir}/infrastructure/persistence/${effName}EffectSerializer.scala`] = [
      anchor,
      `package ${packageName}.infrastructure.persistence`,
      '',
      'import akka.serialization.SerializerWithStringManifest',
      `import ${packageName}.application.process.${effName}EffectFace._`,
      'import java.nio.charset.StandardCharsets',
      'import play.api.libs.json.{Format, Json}',
      '',
      `final class ${effName}EffectSerializer extends SerializerWithStringManifest {`,
      '  private implicit val requestedFmt: Format[EffectRequested] = Json.format[EffectRequested]',
      '  private implicit val confirmedFmt: Format[EffectConfirmed] = Json.format[EffectConfirmed]',
      '  private implicit val reconciledFmt: Format[EffectReconciled] = Json.format[EffectReconciled]',
      '',
      `  override def identifier: Int = ${741200 + effectSerIdx}`,
      '',
      '  override def manifest(o: AnyRef): String = o match {',
      '    case _: EffectRequested  => "EffectRequested"',
      '    case _: EffectConfirmed  => "EffectConfirmed"',
      '    case _: EffectReconciled => "EffectReconciled"',
      `    case other => throw new IllegalArgumentException(s"Unsupported ${effName}Effect event: \${other.getClass.getName}")`,
      '  }',
      '',
      '  override def toBinary(o: AnyRef): Array[Byte] = {',
      '    val js = o match {',
      '      case e: EffectRequested  => Json.toJson(e)',
      '      case e: EffectConfirmed  => Json.toJson(e)',
      '      case e: EffectReconciled => Json.toJson(e)',
      `      case other => throw new IllegalArgumentException(s"Unsupported ${effName}Effect event: \${other.getClass.getName}")`,
      '    }',
      '    Json.stringify(js).getBytes(StandardCharsets.UTF_8)',
      '  }',
      '',
      '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {',
      '    val js = Json.parse(new String(bytes, StandardCharsets.UTF_8))',
      '    manifest match {',
      '      case "EffectRequested"  => js.as[EffectRequested]',
      '      case "EffectConfirmed"  => js.as[EffectConfirmed]',
      '      case "EffectReconciled" => js.as[EffectReconciled]',
      `      case other => throw new IllegalArgumentException(s"Unknown ${effName}Effect manifest: $other")`,
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    effectSerializers.push({
      key: `${toKebab(effName)}-effect`,
      serializerClass: `${packageName}.infrastructure.persistence.${effName}EffectSerializer`,
      eventClass: `${packageName}.application.process.${effName}EffectFace$EffectEvent`,
    });
    effectBootstraps.push({ effName, method: `init${effName}Effect`, traitName: `${effName}EffectBootstrap` });
    effectPorts.push(effName);

    // Handwritten isolation zone implementation for #44 <Eff>EffectFace.Port (verified via truthsrc run-tck-v2)
    handwrittenFiles[`handwritten/scala/${pkgDir}/infrastructure/effects/${effName}EffectPortImpl.scala`] = [
      `// Handwritten S1 side-effect adapter isolation zone for ${effName}EffectFace.Port (protocol: ${eff.protocol}).`,
      '// Replace default stub responses with real external gateway/reconcile calls; truthsrc generate-v2 will never overwrite this file.',
      anchor,
      `package ${packageName}.infrastructure.effects`,
      '',
      `import ${packageName}.application.process.${effName}EffectFace`,
      `import ${packageName}.application.process.${effName}EffectFace.{EffectEvent, EffectRequested}`,
      'import scala.concurrent.Future',
      '',
      `final class ${effName}EffectPortImpl extends ${effName}EffectFace.Port {`,
      ...eff.operations.map(op => {
        const method = toCamel(toPascal(op));
        return `  override def ${method}(idempotencyKey: String, payload: Map[String, Any]): Future[EffectEvent] = Future.successful(EffectRequested(idempotencyKey, ${JSON.stringify(op)}))`;
      }),
      '}',
      '',
    ].join('\n');
  }

  if (effects.length > 0) {
    familiesUsed.push('effect-face', 'effect-bootstrap');
  }

  // 5. #38c SagaCoordinatorBootstrap (eager Guice singleton mounting all Saga/Process & Effect engines alongside ApplicationBootstrap!)
  if (sagaBootstraps.length > 0 || effectBootstraps.length > 0) {
    const allTraits = [
      ...sagaBootstraps.map(b => b.traitName),
      ...effectBootstraps.map(b => b.traitName),
    ];
    const initLines = [
      ...sagaBootstraps.map(b => `  ${b.method}(sharding)`),
      ...effectBootstraps.map(b => `  ${b.method}(system)`),
    ];

    files[`app/${pkgDir}/infrastructure/bootstrap/SagaCoordinatorBootstrap.scala`] = [
      `// @knowledge source:${docId}#/service/orchestration`,
      `package ${packageName}.infrastructure.bootstrap`,
      '',
      'import akka.actor.typed.ActorSystem',
      'import akka.actor.typed.scaladsl.adapter._',
      'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
      'import javax.inject.{Inject, Singleton}',
      '',
      '/** Guice eager-singleton orchestration bootstrap mounting all Saga Process & Effect engines. */',
      '@Singleton',
      'final class SagaCoordinatorBootstrap @Inject()(',
      '  classicSystem: akka.actor.ActorSystem,',
      '  sharding: ClusterSharding',
      `) extends ${allTraits.join('\n  with ')} {`,
      '  private val system: ActorSystem[Nothing] = classicSystem.toTyped',
      '',
      ...initLines,
      '}',
      '',
    ].join('\n');
    familiesUsed.push('saga-coordinator-bootstrap');
  }

  return {
    files,
    handwrittenFiles,
    handwrittenMethodSpecs,
    authorityAggs,
    externalProducersByAgg,
    hostSerializers,
    effectSerializers,
    connectorPorts: [...contractsByPort.keys()],
    effectPorts,
    hasSagaCoordinator: sagaBootstraps.length > 0 || effectBootstraps.length > 0,
    familiesUsed,
  };
}
