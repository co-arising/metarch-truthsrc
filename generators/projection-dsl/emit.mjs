#!/usr/bin/env node
// === projection-dsl emitter — DecisionView + per-event handlers ===
// Generates:
//   <Name>DecisionView.scala — Akka Projection with composite handler
//   handlers/<Name>On<Event>Handler.scala — per-event handler with MANUAL block
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "handlers"), { recursive: true });

const pkg = spec.package || "net.imadz.metarch.application.projection";
const basePkg = spec.basePkg || "net.imadz.metarch";
const viewName = spec.viewName; // e.g. AcceptTenantInvitationDecisionView
const aggregateName = spec.aggregateName; // e.g. OrganizationMemberAggregate
const entityName = spec.entityName; // e.g. OrganizationMemberEntity
const protoPkg = spec.protoPackage; // e.g. organization_member
const protoEventType = spec.protoEventType; // e.g. OrganizationMemberEventPO.Event
const events = spec.events || []; // [{name: "TenantMemberInvited", ...}]
const repositoryName = `${viewName}Repository`;
const projectionId = spec.projectionId || viewName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

// ── Handler imports ──
const handlerImports = events.map(e =>
  `import ${pkg}.handlers.${viewName}On${e.name}Handler`
).join("\n");
const eventImports = events.map(e =>
  `import ${basePkg}.domain.entities.${entityName}.${e.name}`
).join("\n");

// ── Handler instantiations for composite ──
const handlerNews = events.map(e =>
  `        new ${viewName}On${e.name}Handler(repository)`
).join(",\n");

// ── Composite handler constructor params ──
const compositeParams = events.map(e => {
  const varName = e.name.charAt(0).toLowerCase() + e.name.slice(1);
  return `    ${varName}: ${viewName}On${e.name}Handler`;
}).join(",\n");

// ── Composite handler match cases ──
const matchCases = events.map(e => {
  const varName = e.name.charAt(0).toLowerCase() + e.name.slice(1);
  return `        case ${protoEventType.split(".").pop()}.${e.name}(_) => ${varName}.process(session, envelope)`;
}).join("\n");

// ── DecisionView ──
const decisionView = `package ${pkg}

import akka.actor.typed.ActorSystem
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.contrib.persistence.mongodb.MongoReadJournal
import akka.persistence.query.Offset
import akka.projection.Projection
import akka.projection.ProjectionId
import akka.projection.eventsourced.EventEnvelope
import akka.projection.eventsourced.scaladsl.EventSourcedProvider
import akka.projection.jdbc.scaladsl.JdbcHandler
import akka.projection.jdbc.scaladsl.JdbcProjection
import akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}
import javax.inject.Inject
import javax.inject.Singleton
import net.imadz.common.application.projection.ScalikeJdbcSession
import net.imadz.common.application.projection.ScalikeJdbcSetup
import ${basePkg}.application.aggregates.${aggregateName}
${handlerImports}
import ${pkg}.repository.${repositoryName}
${eventImports}
import ${basePkg}.infrastructure.proto.${protoPkg}.${protoEventType.split(".")[0]}
import ${basePkg}.infrastructure.proto.${protoPkg}._

/**
 * ${viewName}: Akka Projection 定义。
 * 负责从事件源 (${aggregateName}) 读取事件并协调给 Handler。
 */
@Singleton
object ${viewName} {


  val projectionName = "${viewName}"


  // Akka Persistence Query Source Provider
  private def sourceProvider(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[${protoEventType}]] = {
    EventSourcedProvider.eventsByTag[${protoEventType}](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }


  /**
   * 创建 Projection 实例，使用 ExactlyOnce 语义。
   * @param index 分片索引，用于计算 Tag (e.g. tag-0, tag-1)
   */
  def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ${pkg}.repository.${repositoryName}): ExactlyOnceProjection[Offset, EventEnvelope[${protoEventType}]] = {
    implicit val sys: ActorSystem[_] = system
    val tag = s"${aggregateName.replace("Aggregate", "")}Tag$$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("${projectionId}", tag),
      sourceProvider = sourceProvider(tag),
      handler = () => new ${viewName}CompositeHandler(
${handlerNews}
      ),
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }


  /**
   * ${viewName} 组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件优雅跳过（不抛异常、不打日志），保证投影流不中断。
   */
  private class ${viewName}CompositeHandler(
${compositeParams}
  ) extends JdbcHandler[EventEnvelope[${protoEventType}], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${protoEventType}]): Unit =
      envelope.event match {
${matchCases}
        case _ => ()
      }
  }




}
`;

writeFileSync(join(outDir, `${viewName}.scala`), decisionView);

// ── Per-event handlers ──
for (const e of events) {
  const handlerName = `${viewName}On${e.name}Handler`;
  const handler = `package ${pkg}.handlers

import akka.projection.eventsourced.EventEnvelope
import akka.projection.jdbc.scaladsl.JdbcHandler
import javax.inject.Inject
import net.imadz.common.application.projection.ScalikeJdbcSession
import ${pkg}.repository.${repositoryName}
import ${basePkg}.domain.entities.${entityName}.${e.name}
import ${basePkg}.infrastructure.proto.${protoPkg}.${protoEventType.split(".")[0]}
import scala.concurrent.ExecutionContext
import scala.concurrent.Future

/**
 * ${handlerName}: 投影处理器，负责处理${handlerName}相关事件
 */
class ${handlerName} @Inject() (${viewName.charAt(0).toLowerCase() + viewName.slice(1)}Repository: ${repositoryName}) extends JdbcHandler[EventEnvelope[${protoEventType}], ScalikeJdbcSession] {


  override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${protoEventType}]): Unit = {
    envelope.event match {
      case event: ${protoEventType} =>
        // ==== BEGIN MANUAL ====
        ???
        // ==== END MANUAL ====

      case _ =>
        ()
    }

  }



}
`;
  writeFileSync(join(outDir, "handlers", `${handlerName}.scala`), handler);
}

console.log(`emitted ${viewName}.scala + ${events.length} handlers`);
