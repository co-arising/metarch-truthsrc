package net.imadz.codegen.structure

import net.imadz.codegen.scaffolding.cqrs.TypeRef

/**
 * [The Anatomy]
 * 定义 DDD 组件及其关联的所有从属组件类型。
 */

// 1. 聚合根原型
case class AggregateArchetype(baseName: String, layout: PackageLayout) {
  // Application
  val root = TypeRef(s"${baseName}Aggregate", layout.application.aggregates.root)
  val behavior = TypeRef(s"${baseName}Behaviors", layout.application.aggregates.behaviors)
  val commandHelper = TypeRef(s"${baseName}CommandHelpers", layout.application.aggregates.behaviors)
  val factory = TypeRef(s"${baseName}AggregateFactory", layout.application.aggregates.factories)
  val repositoryInterface = TypeRef(s"${baseName}Repository", layout.application.aggregates.repository)

  // Domain
  val state = TypeRef(s"${baseName}Entity", layout.domain.entities.root)
  val event = TypeRef(s"${baseName}Event", layout.domain.entities.root)
  val eventHandler = TypeRef(s"${baseName}EventHandler", layout.domain.entities.behaviors)
  val command = TypeRef(s"${baseName}Command", root.packageName) // Protocol usually in Aggregate Object

  // Infra
  val repositoryImpl = TypeRef(s"${baseName}RepositoryImpl", layout.infrastructure.persistence.repositories.aggregate)
  val bootstrap = TypeRef(s"${baseName}Bootstrap", layout.infrastructure.bootstrap)
  val eventAdapter = TypeRef(s"${baseName}EventAdapter", layout.infrastructure.persistence.root)
  val snapshotAdapter = TypeRef(s"${baseName}SnapshotAdapter", layout.infrastructure.persistence.root)
  val converter = TypeRef(s"${baseName}ProtoConverters", layout.infrastructure.persistence.converters)
  
  // Proto
  val protoState = TypeRef(s"${baseName}State", layout.infrastructure.proto.root)
}

// 2. Value Object 原型
case class ValueObjectArchetype(baseName: String, layout: PackageLayout) {
  // Value Object 通常在 Domain Layer 的 values 包下
  val root = TypeRef(baseName, layout.domain.values.root)
}

// 3. Saga 原型
case class SagaArchetype(baseName: String, layout: PackageLayout) {
  // App
  val transactor = TypeRef(s"${baseName}SagaTransactor", layout.application.services.transactor.root)
  val context = TypeRef(s"${baseName}Context", layout.application.services.transactor.context)
  val repositoryInterface = TypeRef(s"${baseName}TransactionRepository", layout.application.services.transactor.repository)
  
  // Infra
  val repositoryImpl = TypeRef(s"${baseName}TransactionRepositoryImpl", layout.infrastructure.persistence.repositories.saga)
  val bootstrap = TypeRef(s"${baseName}Bootstrap", layout.infrastructure.bootstrap)
  val strategy = TypeRef(s"${baseName}TransactionSerializationStrategies", layout.infrastructure.persistence.strategies)
}

// 3. Domain Service 原型
case class DomainServiceArchetype(baseName: String, layout: PackageLayout) {
  // Domain Service 通常在 Domain Layer 的 services 包下
  val root = TypeRef(baseName, layout.domain.services.root)
}

// 4. Invariant Rule 原型
case class InvariantRuleArchetype(baseName: String, layout: PackageLayout) {
  // Invariant Rule 通常在 Domain Layer 的 invariants 包下
  val root = TypeRef(s"${baseName}Rule", layout.domain.invariants.root)
}

// 5. Entity Behavior 原型
case class EntityBehaviorArchetype(baseName: String, layout: PackageLayout) {
  // Entity Behavior 通常在 Domain Layer 的 entities.behaviors 包下
  val root = TypeRef(s"${baseName}EventHandler", layout.domain.entities.behaviors)
}

// 6. Projection 原型
case class ProjectionArchetype(baseName: String, layout: PackageLayout) {
  val projection = TypeRef(s"${baseName}Projection", layout.application.projection.root)
  val handler = TypeRef(s"${baseName}ProjectionHandler", layout.application.projection.root)
  val repositoryInterface = TypeRef(s"${baseName}Repository", layout.application.projection.repository.root)
  val repositoryImpl = TypeRef(s"${baseName}RepositoryImpl", layout.infrastructure.persistence.repositories.projection)
  val bootstrap = TypeRef(s"${baseName}Bootstrap", layout.infrastructure.bootstrap)
  val dto = TypeRef(baseName, layout.application.projection.root)
}

// 4. Controller 原型
case class ControllerArchetype(baseName: String, layout: PackageLayout) {
  val controller = TypeRef(s"${baseName}Controller", layout.infrastructure.api.root)
}
