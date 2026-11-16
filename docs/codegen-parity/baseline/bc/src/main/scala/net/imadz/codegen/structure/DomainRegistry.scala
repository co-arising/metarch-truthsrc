package net.imadz.codegen.structure

import net.imadz.meta.SystemMetadata

class DomainRegistry(val system: SystemMetadata, val layout: PackageLayout) {

  import NamingConventions._

  // --- Indexes ---
  val aggregates: Map[String, AggregateArchetype] = system.application.aggregates.map {
    meta => meta.name -> AggregateArchetype(getBaseName(meta.name), layout)
  }.toMap

  val sagas: Map[String, SagaArchetype] = system.application.sagas.map {
    meta => meta.name -> SagaArchetype(getBaseName(meta.name), layout)
  }.toMap
  
  val projections: Map[String, ProjectionArchetype] = system.infrastructure.projections.map {
    meta => meta.name -> ProjectionArchetype(getBaseName(meta.name), layout)
  }.toMap

  // --- Reverse Index: Command -> Aggregate ---
  // 用于 ApplicationService 自动推断副作用
  private val commandToAggregateMap: Map[String, AggregateArchetype] = {
    system.application.aggregates.flatMap {
      aggMeta => aggMeta.commandFamily.commands.map(cmd => cmd.name -> aggregates(aggMeta.name))
    }.toMap
  }

  // --- Lookups ---
  def findAggregate(name: String): AggregateArchetype = resolve(aggregates, name, "Aggregate")
  def findSaga(name: String): SagaArchetype = resolve(sagas, name, "Saga")
  def findProjection(name: String): ProjectionArchetype = resolve(projections, name, "Projection")

  def resolveAggregateByCommand(commandName: String): Option[AggregateArchetype] = 
    commandToAggregateMap.get(commandName)

  private def resolve[T](map: Map[String, T], key: String, typeName: String): T = {
    map.get(key)
      .orElse(map.find(_._1.startsWith(key)).map(_._2))
      .getOrElse(throw new RuntimeException(s"Unknown $typeName: $key"))
  }
}
