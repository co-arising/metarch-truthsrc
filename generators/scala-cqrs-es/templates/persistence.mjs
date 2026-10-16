// persistence.mjs — Event/SnapshotAdapter + ProtoConverters rendering, byte-mirrors of
// EventAdapterTemplate / SnapshotAdapterTemplate / AggregateConverterTemplate (the s""
// interpolations reproduced literally: case blocks joined with "\n" each carrying leading and
// trailing newlines, classBody framed by single newlines, the converter trait's S2-82-B3
// self-companion tail, and the snapshot adapter's duplicated framework import line).
import { headerOf } from '../builders/models.mjs';

const importLines = (imports) => imports.map((i) => `import ${i}`).join('\n');

export function renderEventAdapter(m, env) {
  const toJournalCases = m.mappings
    .map((n) => `\n      case evt: ${n} =>\n        ${m.protoRoot}.${n}(${n}Conv.toProto(evt))\n`)
    .join('\n');
  const fromJournalCases = m.mappings
    .map((n) => `\n      case ${m.protoRoot}.${n}(po) =>\n        EventSeq.single(${n}Conv.fromProto(po))\n`)
    .join('\n');
  const manifestMethod = `  override def manifest(event: ${m.scalaRoot}): String = event.getClass.getName`;
  const toJournalMethod = `\n  override def toJournal(e: ${m.scalaRoot}): ${m.protoRoot} = {\n    val eventUnion = e match {\n${toJournalCases}\n    }\n    eventUnion\n  }\n`;
  const fromJournalMethod = `\n  override def fromJournal(p: ${m.protoRoot}, manifest: String): EventSeq[${m.scalaRoot}] = {\n    p match {\n${fromJournalCases}\n\n      case ${m.oneOfParent}.Empty =>\n        EventSeq.empty\n    }\n  }\n`;
  const classBody = `\n${manifestMethod}\n\n${toJournalMethod}\n\n${fromJournalMethod}\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: 事件适配器，负责在领域事件和protobuf事件之间进行转换\n */\nclass ${m.name} extends EventAdapter[${m.scalaRoot}, ${m.protoRoot}] with ${m.convTrait} {\n\n${classBody}\n\n}\n`;
}

export function renderSnapshotAdapter(m, env) {
  const toJournalMethod = `\n  override def toJournal(state: ${m.scalaRoot}): Any = {\n    ${m.convObj}.toProto(state)\n  }\n`;
  const fromJournalMethod = `\n  override def fromJournal(from: Any): ${m.scalaRoot} = {\n    val proto = from.asInstanceOf[${m.protoRoot}]\n    ${m.convObj}.fromProto(proto)\n  }\n`;
  const classBody = `\n${toJournalMethod}\n\n${fromJournalMethod}\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: 快照适配器，负责在领域快照和protobuf快照之间进行转换\n */\nclass ${m.name} extends SnapshotAdapter[${m.scalaRoot}] with ${m.convTrait} {\n\n${classBody}\n\n}\n`;
}

const helperConverters = '\n  object ListConv {\n    def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)\n    def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList\n  }\n\n  object InstantConv {\n    def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)\n    def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)\n  }\n';

export function renderConverters(m, env) {
  const renderConverter = (c) => {
    const toArgs = c.fields.map(({ toArg }) => toArg).join(',\n      ');
    const fromArgs = c.fields.map(({ fromArg }) => fromArg).join(',\n      ');
    return `\n  object ${c.objectName} extends ProtoConverter[${c.participantName}, ${c.poName}] {\n    override def toProto(d: ${c.participantName}): ${c.poName} = ${c.poName}(\n      ${toArgs}\n    )\n\n    override def fromProto(p: ${c.poName}): ${c.participantName} = ${c.participantName}(\n      ${fromArgs}\n    )\n  }\n`;
  };
  const convertersCode = m.converters.map(renderConverter).join('\n') + '\n' + helperConverters;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\ntrait ${m.name} extends PrimitiveConverter {\n${convertersCode}\n}\n\n/** S2-82-B3（2026-09-11）：self-companion——trait 嵌套 Conv object 的静态寻址口。\n  * Scala trait 无 term（TraitName.NestedObject 编译红「no companion object」）——\n  * 投影 handler/读端经 ${m.name}.XxxConv.fromProto 静态调用需要本伴生；\n  * EventAdapter/SnapshotAdapter 等 mixin 消费方不受影响（trait 本体原样）。 */\nobject ${m.name} extends ${m.name}\n`;
}

// AggregateRepositoryImplTemplate — @Singleton sharding impl; one entityRef method per
// aggregate (the synthetic sharding contract; query methods are corpus-zero, see builder).
export function renderRepositoryImpl(m, env) {
  const methodsCode = `  override def entityRef(id: String): EntityRef[${m.commandFamilyName}] =\n    sharding.entityRefFor(${m.aggregateName}.entityTypeKey, id.toString)`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: Aggregate Repository Implementation\n * Implementation of ${m.interfaceName} interface\n */\n@Singleton\nclass ${m.name} @Inject() (sharding: ClusterSharding) extends ${m.interfaceName} {\n\n${methodsCode}\n\n}\n`;
}

// BootstrapTemplate (aggregate arm) — the EventSourcedBehavior wiring; port-closed aggregates
// carry the 债④ member threading (init/apply signatures, factory call, command/event handler
// args) rendered directly in final form.
export function renderAggregateBootstrap(m, env) {
  const body = `\n  def ${m.initName}(${m.initSig}): Unit = {\n    val behaviorFactory: EntityContext[${m.cmdType}] => Behavior[${m.cmdType}] = { context =>\n      val i = math.abs(context.entityId.hashCode % ${m.aggName}.tags.size)\n      val selectedTag = ${m.aggName}.tags(i)\n      ${m.factoryCall}\n    }\n\n    sharding.init(Entity(${m.aggName}.entityTypeKey)(behaviorFactory))\n  }\n\n  private def apply(${m.applySig}): Behavior[${m.cmdType}] =\n    Behaviors.logMessages(LogOptions().withLogger(LoggerFactory.getLogger("iMadz")).withLevel(Level.INFO),\n      Behaviors.setup { actorContext =>\n        EventSourcedBehavior(\n          persistenceId = PersistenceId(${m.aggName}.entityTypeKey.name, entityId),\n          emptyState = ${m.entityName}.empty(Id.of(entityId)),\n          commandHandler = ${m.behaviorCall},\n          // [FIX] 使用 EventHandler.apply\n          eventHandler = ${m.eventHandlerCall}\n        ).withTagger(_ => Set(tag))\n          .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))\n          .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))\n          .eventAdapter(new ${m.aggName.replace('Aggregate', '')}EventAdapter)\n          .snapshotAdapter(new ${m.aggName.replace('Aggregate', '')}SnapshotAdapter)\n      })\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: AggregateBootstrapType 引导组件\n */\ntrait ${m.name} {\n\n${body}\n\n}\n`;
}

// BootstrapTemplate (projection arm) — single sourceAggregate form, or the multi-aggregate
// prefix-sum dispatch (arms joined with "\n        else ", per-aggregate createProjectionFor).
export function renderProjectionBootstrap(m, env) {
  const body = m.multi
    ? `\n  def ${m.initName}(system: ActorSystem[_], sharding: ClusterSharding, repository: ${m.repoName}): Unit = {\n    ShardedDaemonProcess(system).init(\n      name = ${m.projName}.projectionName,\n      numberOfInstances = ${m.total},\n      behaviorFactory = index => {\n${m.arms.map((arm) => `        if (index < ${arm.bound})\n          ProjectionBehavior(${m.projName}.createProjectionFor${arm.aggBase}(system, sharding, ${arm.localIndex}, repository))`).join('\n        else ')}\n        else throw new IllegalStateException(s"projection tag index out of range: $index / ${m.total}")\n      },\n      settings = ShardedDaemonProcessSettings(system),\n      stopMessage = Some(ProjectionBehavior.Stop)\n    )\n  }\n`
    : `\n  def ${m.initName}(system: ActorSystem[_], sharding: ClusterSharding, repository: ${m.repoName}): Unit = {\n    ShardedDaemonProcess(system).init(\n      name = ${m.projName}.projectionName,\n      numberOfInstances = ${m.sourceAgg}.tags.size,\n      behaviorFactory = index => ProjectionBehavior(${m.projName}.createProjection(system, sharding, index, repository)),\n      settings = ShardedDaemonProcessSettings(system),\n      stopMessage = Some(ProjectionBehavior.Stop)\n    )\n  }\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: ProjectionBootstrapType 引导组件\n */\ntrait ${m.name} {\n\n${body}\n\n}\n`;
}

// ApplicationBootstrapTemplate — the composite @Singleton wiring everything (71 traits, 43
// repository injections, 70 init calls; 债④ port members tail-appended to the ctor list).
export function renderApplicationBootstrap(m, env) {
  const injections = m.injectedFields.slice(0, -1).join(',\n  ') + (m.injectedFields.length ? `,\n  ${m.injectionsTail}` : '');
  const classBody = `\n  // 隐式转换环境\n  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped\n  private implicit val ec: scala.concurrent.ExecutionContext = system.executionContext\n\n  // Initializations\n  ${m.initCalls.join('\n  ')}\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件\n */\n@Singleton\nclass ApplicationBootstrap @Inject()(${injections}) extends ${m.traits.join(' with ')} {\n\n${classBody}\n\n}\n`;
}

