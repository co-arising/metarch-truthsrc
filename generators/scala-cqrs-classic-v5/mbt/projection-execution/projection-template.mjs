import { fail } from '../../../../lib/products/request.mjs';
import { fqn } from '../../../../lib/classic-architecture/types.mjs';
import { firstLower } from '../../../../lib/classic-architecture/naming.mjs';

const decap = name => name.length ? firstLower(name) : 'handler';

function projectionImports(model) {
  const base = [...new Set(model.dependencies.map(fqn).sort()
    .filter(name => !name.startsWith('scala') && !name.startsWith('java.lang')))];
  const additional = [
    'akka.actor.typed.ActorSystem',
    'akka.projection.eventsourced.EventEnvelope',
    'akka.projection.eventsourced.scaladsl.EventSourcedProvider',
    'akka.projection.jdbc.scaladsl.JdbcProjection',
    'akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}',
    'akka.projection.ProjectionId',
    'akka.persistence.query.Offset',
    'akka.contrib.persistence.mongodb.MongoReadJournal',
    'net.imadz.common.application.projection.{ScalikeJdbcSession, ScalikeJdbcSetup}',
    'akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'javax.inject.Singleton',
    model.sourceProtoEventType.packageName + '._',
  ];
  if (model.handlers.length > 1 || model.aggregateSources.length)
    additional.push('akka.projection.jdbc.scaladsl.JdbcHandler');
  // CodeGenerationDSL.ImportDeclaration sorts WITHOUT cross-list distinct.
  // In particular ActorSystem/MongoReadJournal duplicates are raw output bytes.
  return [...base, ...additional].sort().map(name => 'import ' + name).join('\n');
}

function sourceProvider(model) {
  const eventProtoType = model.sourceProtoEventType.name;
  return `
  // Akka Persistence Query Source Provider
  private def sourceProvider(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[${eventProtoType}]] = {
    EventSourcedProvider.eventsByTag[${eventProtoType}](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }
`;
}

function handlerWiring(model) {
  if (model.handlers.length === 1) return 'new ' + model.handlers[0].selfType.name + '(repository)';
  return `new ${model.selfType.name}CompositeHandler(
        ${model.handlers.map(handler => 'new ' + handler.selfType.name + '(repository)').join(',\n        ')}
      )`;
}

function projectionFactory(model, projectionIdName) {
  const eventProtoType = model.sourceProtoEventType.name;
  const repoTypeName = fqn(model.repository);
  const tagBaseName = model.sourceAggregate.name.replaceAll('Aggregate', '') + 'Tag';
  const wiringComment = model.handlers.length > 1
    ? ' // [FIX 挂账⑥(a) BUG-014] 组合分发器：修复单 handler 装配缺陷（原仅接线单事件 handler，其余事件落入 ??? 兜底中断投影流）'
    : ' // [FIX] Instantiate Handler with Repo';
  return `
  /**
   * 创建 Projection 实例，使用 ExactlyOnce 语义。
   * @param index 分片索引，用于计算 Tag (e.g. tag-0, tag-1)
   */
  def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ${repoTypeName}): ExactlyOnceProjection[Offset, EventEnvelope[${eventProtoType}]] = {
    implicit val sys: ActorSystem[_] = system
    // [FIX] 计算 Tag: baseName + index (需要与 Aggregate Bootstrap 保持一致)
    val tag = s"${tagBaseName}$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("${projectionIdName}", tag),
      sourceProvider = sourceProvider(tag),
      handler = () => ${handlerWiring(model)},${wiringComment}
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }
`;
}

function compositeHandler(model) {
  if (model.handlers.length === 1) return '';
  const eventProtoType = model.sourceProtoEventType.name;
  const routable = model.handlers.filter(handler => handler.routable);
  const nonRoutable = model.handlers.filter(handler => !handler.routable);
  const parameters = model.handlers.map(handler => decap(handler.eventCaseName) + ': ' + handler.selfType.name).join(',\n    ');
  const arms = routable.map(handler => `case ${eventProtoType}.${handler.eventCaseName}(_) => ${decap(handler.eventCaseName)}.process(session, envelope)`).join('\n        ');
  const skipped = nonRoutable.length
    ? `        // 跨聚合事件（${nonRoutable.map(handler => handler.eventCaseName).join(' / ')}）属其他聚合 tag 流，本流不可达，对应 Handler 仅装配不路由
` : '';
  return `
  /**
   * ${model.selfType.name} 组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件优雅跳过（不抛异常、不打日志），保证投影流不中断。
   */
  private class ${model.selfType.name}CompositeHandler(
    ${parameters}
  ) extends JdbcHandler[EventEnvelope[${eventProtoType}], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${eventProtoType}]): Unit =
      envelope.event match {
        ${arms}
${skipped}        case _ => ()
      }
  }
`;
}

function aggregateSection(model, source, projectionIdName) {
  const aggBase = source.aggregate.name.replaceAll('Aggregate', '');
  const eventProtoType = source.protoEventType.name;
  const compositeName = model.selfType.name + aggBase + 'CompositeHandler';
  const handlerArgs = source.handlers.map(handler => 'new ' + handler.selfType.name + '(repository)').join(',\n        ');
  const routeArms = source.handlers.map(handler => `case ${eventProtoType}.${handler.eventCaseName}(_) => ${decap(handler.eventCaseName)}.process(session, envelope)`).join('\n        ');
  const parameters = source.handlers.map(handler => decap(handler.eventCaseName) + ': ' + handler.selfType.name).join(',\n    ');
  return `
  /** [M3 多聚合投影] ${aggBase} 源聚合的事件流（信封 ${eventProtoType}，与本视图其他聚合流互不混流） */
  private def sourceProvider${aggBase}(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[${eventProtoType}]] = {
    EventSourcedProvider.eventsByTag[${eventProtoType}](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }

  /**
   * [M3 多聚合投影] ${aggBase} 流投影实例（ExactlyOnce·tag=<${aggBase}Tag><index>·offset 独立）。
   * @param index 该聚合 tag 分片索引（由 Bootstrap 按聚合顺序偏移后传入）
   */
  def createProjectionFor${aggBase}(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ${fqn(model.repository)}): ExactlyOnceProjection[Offset, EventEnvelope[${eventProtoType}]] = {
    implicit val sys: ActorSystem[_] = system
    val tag = s"${aggBase}Tag$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("${projectionIdName}", tag),
      sourceProvider = sourceProvider${aggBase}(tag),
      handler = () => new ${compositeName}(
        ${handlerArgs}),
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }

  /**
   * ${model.selfType.name} ${aggBase} 流组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件（其他聚合 tag 流不可达，防御性）优雅跳过，保证投影流不中断。
   */
  private class ${compositeName}(
    ${parameters}
  ) extends JdbcHandler[EventEnvelope[${eventProtoType}], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${eventProtoType}]): Unit =
      envelope.event match {
        ${routeArms}
        case _ => ()
      }
  }
`;
}

/** Literal ProjectionTemplate layout, including leading blank lines and spaces.
 * No generated header, expected payload, normalization, writer or ctx lookup.
 */
export function renderClassicProjection(model) {
  if (!model.handlers.length)
    fail('CLASSIC_PROJECTION_EMPTY', 'the raw ProjectionTemplate requires handlers.head');
  if (model.multiProject || model.applyEvents.length)
    fail('CLASSIC_PROJECTION_APPLY_EVENT_UNSEALED', 'nonempty ApplyEvent remains outside this sealed owner implementation');
  // This is the ORIGINAL template operation, not a generic snake-case resolver:
  // all uppercase chars are underscored, then exactly one leading _ is removed.
  const projectionIdName = model.selfType.name.replace(/([A-Z])/gu, '_$1').toLowerCase().replace(/^_/u, '');
  const singleAggregateCode = model.aggregateSources.length ? '' : `
  ${sourceProvider(model)}

  ${projectionFactory(model, projectionIdName)}
${compositeHandler(model)}
`;
  const multiAggregateSection = model.aggregateSources.map(source => aggregateSection(model, source, projectionIdName)).join('\n');
  const body = `
  val projectionName = "${model.selfType.name.replaceAll('Projection', '')}"

${singleAggregateCode}${multiAggregateSection}
`;
  return `package ${model.selfType.packageName}

${projectionImports(model)}

/**
 * ${model.selfType.name}: Akka Projection 定义。
 * 负责从事件源 (${model.sourceAggregate.name}) 读取事件并协调给 Handler。
 */
@Singleton
object ${model.selfType.name} {

${body}

}
`;
}
