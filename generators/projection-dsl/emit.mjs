#!/usr/bin/env node
// === projection-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>Projection (Akka Projection with JdbcProjection.exactlyOnce)
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const pkg = spec.package || "net.imadz.application.projection";
const name = spec.name;
const objectName = `${name}Projection`;
const eventType = spec.eventType || "CreditBalanceEventPO.Event";
const aggregateName = spec.aggregateName || "CreditBalanceAggregate";
const handlerName = `${name}ProjectionHandler`;
const repositoryName = `${name}Repository`;

const out = `package ${pkg}

import akka.actor.typed.ActorSystem
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.contrib.persistence.mongodb.MongoReadJournal
import akka.persistence.query.Offset
import akka.projection.ProjectionId
import akka.projection.eventsourced.EventEnvelope
import akka.projection.eventsourced.scaladsl.EventSourcedProvider
import akka.projection.jdbc.scaladsl.JdbcProjection
import akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}
import javax.inject.Singleton
import net.imadz.common.application.projection.{ScalikeJdbcSession, ScalikeJdbcSetup}

/**
 * ${objectName}: Akka Projection 定义。
 * 负责从事件源 (${aggregateName}) 读取事件并协调给 Handler。
 */
@Singleton
object ${objectName} {

  val projectionName = "${name}"

  // Akka Persistence Query Source Provider
  private def sourceProvider(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[${eventType}]] = {
    EventSourcedProvider.eventsByTag[${eventType}](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }

  /**
   * 创建 Projection 实例，使用 ExactlyOnce 语义。
   * @param index 分片索引，用于计算 Tag (e.g. tag-0, tag-1)
   */
  def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ${repositoryName}): ExactlyOnceProjection[Offset, EventEnvelope[${eventType}]] = {
    implicit val sys: ActorSystem[_] = system
    val tag = s"${spec.tagBase || aggregateName.replace("Aggregate", "")}Tag$$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("${spec.projectionId || name.toLowerCase + "_projection"}", tag),
      sourceProvider = sourceProvider(tag),
      handler = () => new ${handlerName}(repository),
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }

}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath}`);
