import { fail } from '../../../../lib/products/request.mjs';
import { fqn } from '../../../../lib/classic-architecture/types.mjs';
import { firstLower } from '../../../../lib/classic-architecture/naming.mjs';

function handlerImports(model) {
  const base = [...new Set(model.dependencies.map(fqn).sort().filter(name =>
    name !== 'javax.inject.Inject' && !name.startsWith('scala') && !name.startsWith('java.lang')))];
  const additional = [
    'akka.projection.eventsourced.EventEnvelope',
    'akka.projection.jdbc.scaladsl.JdbcHandler',
    'net.imadz.common.application.projection.ScalikeJdbcSession',
    'scala.concurrent.Future',
    'scala.concurrent.ExecutionContext',
    'javax.inject.Inject',
  ];
  return [...base, ...additional].sort().map(name => 'import ' + name).join('\n');
}

function handleEvent(model) {
  return `
  override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${model.event.name}]): Unit = {
    envelope.event match {
      case event: ${model.event.name} =>
        // Logic for protobuf event: ${model.event.name}
        // 投影意图（元数据 referenceCode）：${model.logicCode}
        // ==== BEGIN MANUAL ====
        ??? // 行为侧实现：repository.upsert(view.copy(...))（手写实现留在本区块，重生成自动保留）
        // ==== END MANUAL ====

      case _ =>
        () // 非本投影事件流：显式跳过。原 ??? 会使未预期事件（跨聚合 tag 串流实证）打爆投影流——Squad-C/BUG-012 家族教训，2026-08-26 模板根治
    }

  }
`;
}

/** Single-project ProjectionHandlerTemplate, including its fixed MANUAL ???
 * body. referenceCode is documentation here, not a repository implementation.
 * Multi-project ViewMachine/ApplyEvent branches await their own oracle seal.
 */
export function renderClassicProjectionHandler(model) {
  if (model.multiProject)
    fail('CLASSIC_PROJECTION_APPLY_EVENT_UNSEALED', 'multi-project handler wiring has no qualifying sealed ApplyEvent oracle');
  const actualHandlerName = model.selfType.name.endsWith('Handler')
    ? model.selfType.name : model.selfType.name + 'Handler';
  const repositoryParameter = firstLower(model.repository.name);
  const classDef = `/**
 * ${actualHandlerName}: 投影处理器，负责处理${model.selfType.name.replaceAll('Handler', '')}相关事件
 */// @Singleton
class ${actualHandlerName} @Inject() (${repositoryParameter}: ${model.repository.name}) extends JdbcHandler[EventEnvelope[${model.event.name}], ScalikeJdbcSession] {


  ${handleEvent(model)}


}
`;
  return `package ${model.selfType.packageName}

${handlerImports(model)}

${classDef}
`;
}
