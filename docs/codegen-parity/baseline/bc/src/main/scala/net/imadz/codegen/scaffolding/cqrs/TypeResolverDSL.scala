package net.imadz.codegen.scaffolding.cqrs

import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta._

/** TypeResolverDSL 提供了更具DSL风格的类型解析API 提高代码的可读性和类型安全性
  */
object TypeResolverDSL {
  def apply(ctx: GeneratorContext): TypeResolverDSL = new TypeResolverDSL(ctx)
  /** Independent semantic-product type lowering; no legacy metadata fallback. */
  def productType(value: net.imadz.meta.products.NominalType, packages: Map[String, String]): TypeRef = {
    import net.imadz.meta.products.NominalType._
    value match {
      case Primitive("string") => TypeRef.String
      case Primitive("boolean") => TypeRef.Boolean
      case Primitive("integer") => TypeRef.Long
      case Primitive("decimal") => TypeRef("BigDecimal", "scala.math")
      case Named(ref) => TypeRef(NamingConventions.productSymbol(ref.id), NamingConventions.productPackage(packages(ref.context)) + ".domain.values")
      case Optional(element) => TypeRef("Option", "scala", Seq(productType(element, packages)))
      case Sequence(element) => TypeRef("Vector", "scala.collection.immutable", Seq(productType(element, packages)))
      case Mapping(key, value) => TypeRef("Map", "scala.collection.immutable", Seq(productType(key, packages), productType(value, packages)))
      case _ => throw new IllegalArgumentException("unsupported product target value type")
    }
  }
}

class TypeResolverDSL(private val ctx: GeneratorContext) {

  /** Explicit strict module/nested types, separate from legacy Saga naming. */
  def strictModule(fqn: FullQualifiedName): TypeRef = {
    val parts = fqn.dottedPath.split("\\.", -1)
    require(parts.length > 1, "Strict module requires an explicit package")
    NamingConventions.strictPackagePath(parts.dropRight(1).mkString("."))
    TypeRef(NamingConventions.strictSymbol(parts.last), parts.dropRight(1).mkString("."))
  }
  def strictNested(module: TypeRef, name: String): TypeRef =
    TypeRef(NamingConventions.strictSymbol(name), module.fqn)
  def strictValue(dataType: DataType): TypeRef = {
    val result = resolve(dataType)
    require(result != any && result != TypeRef.Double, "Unsupported strict value type")
    result
  }
  def strictRuntime(name: String): TypeRef = TypeRef(name, "net.imadz.infra.saga.strict")

  /** Strict modules must use an independent explicit namespace, not any legacy output territory. */
  def strictIndependentNamespace(module: TypeRef): Boolean = {
    val reserved = Seq(ctx.layout.domain.root, ctx.layout.application.root, ctx.layout.infrastructure.root,
      ctx.layout.modules.root, ctx.layout.infrastructure.api.root, "net.imadz.infra.saga.strict", "net.imadz.common")
    !reserved.exists(pkg => module.packageName == pkg || module.packageName.startsWith(pkg + "."))
  }

  /** Conservative prewrite collision surface for the old physical output namespaces. */
  def strictReservedOutputs: Set[String] = {
    val domain = ctx.metaRegistry.resolveAll[ValueObjectMetadata].map(m => valueObject(m.name)) ++
      ctx.metaRegistry.resolveAll[DomainEntityMetadata].map(m => entity(m.name))
    val aggregate = ctx.metaRegistry.resolveAll[AggregateRootMetadata].flatMap { m =>
      Seq(aggregateRoot(m.name), aggregateProtocol(m.name), aggregateBehavior(m.name),
        aggregateEventAdapter(m.name), aggregateSnapshotAdapter(m.name), aggregateProtoConverter(m.name),
        aggregateBootstrap(m.name), aggregateFactory(m.name), commandHelper(m), aggregateRepository(m.name))
    }
    val remaining = ctx.metaRegistry.resolveAll[EntityBehaviorMetadata].map(m => entityEventHandler(m.name)) ++
      ctx.metaRegistry.resolveAll[InvariantRuleMetadata].map(m => invariantRule(m.name)) ++
      ctx.metaRegistry.resolveAll[DomainServiceMetadata].map(m => domainService(m.name)) ++
      ctx.metaRegistry.resolveAll[QueryServiceMetadata].map(m => queryService(m.name)) ++
      ctx.metaRegistry.resolveAll[ControllerMetadata].map(m => controller(m.name)) ++
      ctx.metaRegistry.resolveAll[ProjectionMetadata].map(m => projection(m.name))
    (domain ++ aggregate ++ remaining :+ applicationBootstrap).map(_.fqn).toSet
  }

  /** 解析基本类型
    */
  def `string`: TypeRef = TypeRef.String
  def `int`: TypeRef = TypeRef.Int
  def `long`: TypeRef = TypeRef.Long
  def `boolean`: TypeRef = TypeRef.Boolean
  def `unit`: TypeRef = TypeRef.Unit
  def bigDecimal: TypeRef = TypeRef("BigDecimal", "scala.math")
  def optionString: TypeRef = TypeRef("Option", "scala", Seq(TypeRef.String))
  def option[T](innerType: TypeRef): TypeRef =
    TypeRef("Option", "scala", Seq(innerType))

  /** 通用类型解析入口 代理到 TypeResolver.resolve，实现统一入口
    */
  def optionType: TypeRef = TypeRef("Option", "scala")
  def some: TypeRef = TypeRef("Some", "scala")

  /** Scala核心类型
    */
  def either(leftType: TypeRef, rightType: TypeRef): TypeRef =
    TypeRef("Either", "scala", Seq(leftType, rightType))
  def any: TypeRef = TypeRef("Any", "")

  /** 框架类型
    */
  def eventAdapter: TypeRef = TypeRef("EventAdapter", "akka.persistence.typed")
  def eventSeq: TypeRef = TypeRef("EventSeq", "akka.persistence.typed")
  def snapshotAdapter: TypeRef =
    TypeRef("SnapshotAdapter", "akka.persistence.typed")
  def actorRef: TypeRef = TypeRef("ActorRef", "akka.actor.typed")
  def entityRef: TypeRef =
    TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl")
  def entityTypeKey: TypeRef =
    TypeRef("EntityTypeKey", "akka.cluster.sharding.typed.scaladsl")
  def behavior: TypeRef = TypeRef("Behavior", "akka.actor.typed")
  def effect: TypeRef = TypeRef("Effect", "akka.persistence.typed.scaladsl")
  def persistenceId: TypeRef =
    TypeRef("PersistenceId", "akka.persistence.typed")
  def supervisorStrategy: TypeRef =
    TypeRef("SupervisorStrategy", "akka.actor.typed")
  def implementedBy: TypeRef = TypeRef("ImplementedBy", "com.google.inject")
  def eventSourcedBehavior: TypeRef =
    TypeRef("EventSourcedBehavior", "akka.persistence.typed.scaladsl")
  def list: TypeRef = TypeRef("List", "scala.collection.immutable")
  def cborSerializable: TypeRef = ctx.knownFrameworkTypes("CborSerializable")
  def sagaTransactionStep: TypeRef =
    TypeRef("SagaTransactionStep", "net.imadz.infra.saga")
  def sagaTransactionCoordinator: TypeRef =
    TypeRef("SagaTransactionCoordinator", "net.imadz.infra.saga")
  def actorSystem: TypeRef = TypeRef("ActorSystem", "akka.actor")
  def actorSystemTyped: TypeRef =
    TypeRef("ActorSystem", "akka.actor.typed", Seq(TypeRef.Nothing))
  def extendedActorSystem: TypeRef =
    TypeRef("ExtendedActorSystem", "akka.actor")
  def executionContext: TypeRef =
    TypeRef("ExecutionContext", "scala.concurrent")
  def serializationExtension: TypeRef = TypeRef(
    "SerializationExtension",
    s"${ctx.rootPackage}.common.serialization"
  )
  def classicActorSystem: TypeRef = TypeRef("ActorSystem", "akka.actor")
  def applicationPlay: TypeRef = TypeRef("Application", "play.api")

  /** Proto 和 Scala 根类型（用于 Adapter/Converter）
    */
  def protoType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def scalaRootType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析实体状态类型
    */
  def entityState(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析实体状态类型（直接通过名称） [FIX] 使用完整名称，不进行 getBaseName 去除后缀，保留 "State"
    */
  def entityState(name: String): TypeRef = {
    // [FIX] User request: State should be resolved to the Entity's FQN
    // This implies State is a nested type within the Domain Entity
    val entityName = NamingConventions.getEntityNameFromStateName(name)
    val entityPkg = ctx.layout.domain.entities.root
    TypeRef(name, s"$entityPkg.$entityName")
  }

  /** 解析事件家族类型
    */
  def eventFamily(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析事件家族类型（通过名称）
    */
  def eventFamily(name: String): TypeRef =
    TypeRef(name, ctx.layout.domain.entities.root)

  /** 解析事件类型
    */
  def event(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析命令族类型
    */
  def commandFamily(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析命令族类型（通过名称）
    */
  def commandFamily(name: String): TypeRef = {
    ctx.symbolTable.resolve(NestedTypeName(name)) match {
      case Some(OwnerEntityName(ownerName)) =>
        val ownerMeta =
          ctx.metaRegistry.resolveByName[DomainDrivenMetadata](ownerName)
        ownerMeta match {
          case Some(_: AggregateRootMetadata) =>
            val protocolRef = ctx.typeResolver.aggregateProtocol(ownerName)
            TypeRef(name, protocolRef.fqn)
          case Some(_: SagaTransactorMetadata) =>
            val protocolRef = ctx.typeResolver.sagaProtocol(ownerName)
            TypeRef(name, protocolRef.fqn)
          case Some(_: DomainEntityMetadata) =>
            val pkg = ctx.layout.domain.entities.root
            TypeRef(name, s"$pkg.$ownerName")
          case Some(_: QueryServiceMetadata) =>
            val pkg = ctx.layout.application.queries.root
            TypeRef(name, s"$pkg.$ownerName")
          case _ =>
            val pkg = ctx.layout.application.aggregates.root
            TypeRef(name, s"$pkg.$ownerName")
        }
      case None =>
        TypeRef(name, ctx.layout.application.aggregates.root)
    }
  }

  /** 解析命令回复类型
    */
  def commandReply(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析命令类型
    */
  def command(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析命令族类型（通过CommandRef）
    */
  def commandFamily(ref: CommandRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析命令类型（通过CommandRef）
    */
  def command(ref: CommandRef): TypeRef = TypeResolver.resolve(ref, ctx)

  def sagaContext(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析实体行为类型
    */
  def entityBehavior(ref: MetaRef): TypeRef = TypeResolver.resolve(ref, ctx)

  /** 解析实体行为自身类型（用于EntityBehaviorBuilder的selfType）
    */
  def entityBehaviorSelf(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  /** 解析Saga实体类型（用于SagaEntityBuilder的selfType）
    */
  def sagaEntity(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析ByteString类型（用于SagaStrategyBuilder的frameworkDeps）
    */
  def byteString: TypeRef = TypeRef("ByteString", "com.google.protobuf")

  /** 解析聚合根类型 Builder 调用: ctx.typeResolver.aggregateRoot("Order") 结果:
    * TypeRef("OrderAggregate", "pkg.aggregates.root")
    */
  def aggregateRoot(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.aggregateRootName(baseName), // 1. 显式应用命名规则
      ctx.layout.application.aggregates.root // 2. 显式绑定包路径
    )
  }

  /** 解析聚合协议类型 调用: ctx.typeResolver.aggregateProtocol("Order") 结果:
    * TypeRef("OrderProtocol", "pkg.aggregates.root")
    */
  def aggregateProtocol(conceptName: String): TypeRef = {
    // 先获取基础名称
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      s"${baseName}Protocol",
      ctx.layout.application.aggregates.root
    )
  }

  /** 解析聚合协议类型（从元数据）
    */
  def aggregateProtocol(meta: AggregateRootMetadata): TypeRef =
    aggregateProtocol(
      meta.name
    )

  /** 解析 Saga 协议类型
    */
  def sagaProtocol(conceptName: String): TypeRef = {
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      s"${baseName}Protocol",
      ctx.layout.application.services.transactor.root
    )
  }

  /** 解析 Saga 协议类型（从元数据）
    */
  def sagaProtocol(meta: SagaTransactorMetadata): TypeRef = sagaProtocol(
    meta.name
  )

  /** 解析聚合根类型（从元数据）
    */
  def aggregateRoot(meta: AggregateRootMetadata): TypeRef = aggregateRoot(
    meta.name
  )

  /** 解析聚合事件适配器类型 封装命名规则和包路径，调用者只需传聚合名称
    */
  def aggregateEventAdapter(aggregateName: String): TypeRef = {
    val baseName = NamingConventions.getAggregateBaseName(aggregateName)
    TypeRef(
      NamingConventions.eventAdapterName(baseName),
      ctx.layout.infrastructure.persistence.root
    )
  }

  /** 解析聚合事件适配器类型（从元数据）
    */
  def aggregateEventAdapter(meta: AggregateRootMetadata): TypeRef =
    aggregateEventAdapter(meta.name)

  /** 解析聚合快照适配器类型 封装命名规则和包路径，调用者只需传聚合名称
    */
  def aggregateSnapshotAdapter(aggregateName: String): TypeRef = {
    val baseName = NamingConventions.getAggregateBaseName(aggregateName)
    TypeRef(
      NamingConventions.snapshotAdapterName(baseName),
      ctx.layout.infrastructure.persistence.root
    )
  }

  /** 解析聚合快照适配器类型（从元数据）
    */
  def aggregateSnapshotAdapter(meta: AggregateRootMetadata): TypeRef =
    aggregateSnapshotAdapter(meta.name)

  /** 解析聚合 Bootstrap 类型 封装命名规则和包路径
    */
  def aggregateBootstrap(aggregateName: String): TypeRef = {
    val baseName = NamingConventions.getAggregateBaseName(aggregateName)
    TypeRef(
      NamingConventions.bootstrapName(baseName),
      ctx.layout.infrastructure.bootstrap
    )
  }

  /** 解析聚合 Bootstrap 类型（从元数据）
    */
  def aggregateBootstrap(meta: AggregateRootMetadata): TypeRef =
    aggregateBootstrap(meta.name)

  /** 解析实体事件处理器类型 封装命名规则和包路径
    */
  def entityEventHandler(entityName: String): TypeRef = {
    val handlerName =
      NamingConventions.getEventHandlerNameFromEntityName(entityName)
    TypeRef(handlerName, ctx.layout.domain.entities.behaviors)
  }

  /** 解析聚合 Proto 转换器类型 封装命名规则和包路径
    */
  def aggregateProtoConverter(aggregateName: String): TypeRef = {
    val baseName = NamingConventions.getAggregateBaseName(aggregateName)
    TypeRef(
      NamingConventions.converterName(baseName),
      ctx.layout.infrastructure.persistence.converters
    )
  }

  /** 解析聚合 Proto 转换器类型（从元数据）
    */
  def aggregateProtoConverter(meta: AggregateRootMetadata): TypeRef =
    aggregateProtoConverter(meta.name)

  /** 解析聚合类型（用于AggregateBehaviorBuilder的aggregateType）
    */
  def aggregateType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析实体类型
    */
  def entity(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.domainEntityName(baseName),
      ctx.layout.domain.entities.root
    )
  }

  /** 解析不变规则类型
    */
  def invariantRule(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀，包括"Rule"）
    val baseName = NamingConventions.getBaseName(conceptName)
    // 然后统一添加"Rule"后缀，确保一致性
    val ruleName = NamingConventions.invariantRuleName(baseName)
    TypeRef(
      ruleName,
      ctx.layout.domain.invariants.root
    )
  }

  /** 解析反应式策略（Policy）类型：名称原样使用，包固定为 domain.policy */
  def policy(name: String): TypeRef =
    TypeRef(name, ctx.layout.domain.policies.root)

  /** 解析不变规则内部类型（用于InvariantRuleBuilder的subjectType和outputType）
    */
  def invariantRuleInnerType(targetName: String): TypeRef = {
    // [FIX] Check if it is a ValueObject first
    if (
      ctx.metaRegistry.resolveByName[ValueObjectMetadata](targetName).isDefined
    ) {
      return valueObject(targetName)
    }

    // [FIX] If checking for State, force it to be a ValueObject
    // This supports Implicit State Artifacts generated by ArtifactCollector
    if (targetName.endsWith("State")) {
      return valueObject(targetName)
    }

    val ownerEntityName =
      ctx.symbolTable.resolve(NestedTypeName(targetName)) match {
        case Some(owner) => owner.name
        case None        =>
          val baseName = NamingConventions.removeSuffix(targetName, "State")
          NamingConventions.getEntityNameFromEventName(baseName)
      }
    val entityPkg = ctx.layout.domain.entities.root
    TypeRef(targetName, s"$entityPkg.$ownerEntityName")
  }

  /** 解析领域服务类型
    */
  def domainService(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.domainServiceName(baseName),
      ctx.layout.domain.services.root
    )
  }

  /** 解析值对象类型
    */
  def valueObject(conceptName: String): TypeRef = {
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.domainValueObjectName(baseName),
      ctx.layout.domain.values.root
    )
  }

  /** 解析控制器类型
    */
  def controller(conceptName: String): TypeRef = {
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.controllerName(baseName),
      ctx.layout.infrastructure.api.root
    )
  }

  /** 解析聚合行为类型
    */
  def aggregateBehavior(conceptName: String): TypeRef = {
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.aggregateBehaviorName(baseName),
      ctx.layout.application.aggregates.behaviors
    )
  }

  /** 解析聚合行为类型（直接从聚合根元数据生成）
    */
  def aggregateBehavior(meta: AggregateRootMetadata): TypeRef = {
    val baseName = NamingConventions.getAggregateBaseName(meta.name)
    aggregateBehavior(baseName)
  }

  /** 解析聚合仓库接口
    */
  def aggregateRepository(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.aggregateRepositoryInterfaceName(baseName),
      ctx.layout.application.aggregates.repository
    )
  }

  /** 解析投影仓库类型
    */
  def projectionRepository(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.projectionRepositoryInterfaceName(baseName),
      ctx.layout.application.projection.repository.root
    )
  }

  /** 解析投影DTO类型（用于ProjectionRepositoryBuilder的dtoType）
    */
  def projectionDtoType(
      dtoName: String,
      dtoCompanionName: String,
      pkg: String
  ): TypeRef = {
    // DTO 类型定义在 Companion Object 中，所以路径是 Package.Companion.DTO
    TypeRef(dtoName, s"$pkg.$dtoCompanionName")
  }

  /** 解析自定义数据类型（用于ProjectionRepositoryBuilder的c.dataType）
    */
  def customDataType(dataType: String): TypeRef = {
    val t = dataType.trim
    val low = t.toLowerCase
    // 摄入侧形态 → Scala 类型（2026-08-21 生成器形态适配：Enum/UUID/JSON/List<String> 等）
    low match {
      case "string" | "string (enum)" | "json" => TypeRef.String
      case "integer" | "int"                   => TypeRef.Int
      case "long"                              => TypeRef.Long
      case "boolean" | "bool"                  => TypeRef.Boolean
      case "double"                            => TypeRef.Double
      case "decimal" | "bigdecimal"            => TypeRef("BigDecimal", "scala.math")
      case "instant" | "datetime"              => TypeRef("Instant", "java.time")
      case "string (uuid)"                     => ctx.types.Id
      case _ =>
        val (wrap, inner) =
          if ((t.startsWith("List<") || t.startsWith("List[")) && (t.endsWith(">") || t.endsWith("]"))) ("List", t.slice(5, t.length - 1))
          else if (t.startsWith("Array<") && t.endsWith(">")) ("List", t.slice(6, t.length - 1))
          else if (t.startsWith("Seq<") && t.endsWith(">")) ("List", t.slice(4, t.length - 1))
          else if (t.startsWith("Option<") && t.endsWith(">")) ("Option", t.slice(7, t.length - 1))
          else (null, null)
        if (wrap != null) TypeRef(wrap, "scala.collection.immutable", Seq(customDataType(inner)))
        else TypeRef(t, "")
    }
  }

  /** 解析Saga事务仓库类型
    */
  def sagaTransactionRepository(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.sagaTransactionRepositoryName(baseName),
      ctx.layout.application.services.transactor.repository
    )
  }

  /** 解析应用服务类型
    */
  def applicationService(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.applicationServiceName(baseName),
      ctx.layout.application.services.root
    )
  }

  /** 解析查询服务类型
    */
  def queryService(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.queryServiceName(baseName),
      ctx.layout.application.queries.root
    )
  }

  /** 解析命令类型（通过名称）
    */
  def command(conceptName: String): TypeRef = {
    ctx.symbolTable.resolve(NestedTypeName(conceptName)) match {
      case Some(OwnerEntityName(ownerName)) =>
        val ownerMeta =
          ctx.metaRegistry.resolveByName[DomainDrivenMetadata](ownerName)
        ownerMeta match {
          case Some(_: AggregateRootMetadata) =>
            val protocolRef = ctx.typeResolver.aggregateProtocol(ownerName)
            TypeRef(conceptName, protocolRef.fqn)
          case Some(_: SagaTransactorMetadata) =>
            val protocolRef = ctx.typeResolver.sagaProtocol(ownerName)
            TypeRef(conceptName, protocolRef.fqn)
          case Some(_: DomainEntityMetadata) =>
            val pkg = ctx.layout.domain.entities.root
            TypeRef(conceptName, s"$pkg.$ownerName")
          case Some(_: QueryServiceMetadata) =>
            val pkg = ctx.layout.application.queries.root
            TypeRef(conceptName, s"$pkg.$ownerName")
          case _ =>
            val pkg = ctx.layout.application.aggregates.root
            TypeRef(conceptName, s"$pkg.$ownerName")
        }
      case None =>
        TypeRef(conceptName, ctx.layout.application.aggregates.root)
    }
  }

  /** 解析命令回复类型（通过名称）
    */
  def commandReply(name: String): TypeRef = {
    ctx.symbolTable.resolve(NestedTypeName(name)) match {
      case Some(OwnerEntityName(ownerName)) =>
        val ownerMeta =
          ctx.metaRegistry.resolveByName[DomainDrivenMetadata](ownerName)
        ownerMeta match {
          case Some(_: AggregateRootMetadata) =>
            val protocolRef = ctx.typeResolver.aggregateProtocol(ownerName)
            TypeRef(name, protocolRef.fqn)
          case Some(_: SagaTransactorMetadata) =>
            val protocolRef = ctx.typeResolver.sagaProtocol(ownerName)
            TypeRef(name, protocolRef.fqn)
          case Some(_: DomainEntityMetadata) =>
            val pkg = ctx.layout.domain.entities.root
            TypeRef(name, s"$pkg.$ownerName")
          case Some(_: QueryServiceMetadata) =>
            val pkg = ctx.layout.application.queries.root
            TypeRef(name, s"$pkg.$ownerName")
          case _ =>
            val pkg = ctx.layout.application.aggregates.root
            TypeRef(name, s"$pkg.$ownerName")
        }
      case None =>
        TypeRef(name, ctx.layout.application.aggregates.root)
    }
  }

  /** 解析命令辅助类型
    */
  def commandHelper(name: String): TypeRef = {
    // 命令辅助类型（如CreditBalanceCommandHelpers）始终在聚合行为包中
    TypeRef(name, ctx.layout.application.aggregates.behaviors)
  }

  /** 解析命令辅助类型（直接从聚合根元数据生成）
    */
  def commandHelper(meta: AggregateRootMetadata): TypeRef = {
    val helperName =
      NamingConventions.getCommandHelperNameFromAggregateName(meta.name)
    commandHelper(helperName)
  }

  /** 解析命令辅助类型（重载版本，支持自定义包路径）
    */
  def commandHelper(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析聚合工厂类型
    */
  def aggregateFactory(name: String): TypeRef =
    TypeRef(name, ctx.layout.application.aggregates.factories)

  /** 解析聚合工厂类型（重载版本，直接从聚合根元数据生成）
    */
  def aggregateFactory(meta: AggregateRootMetadata): TypeRef = {
    val factoryName =
      NamingConventions.getFactoryNameFromAggregateName(meta.name)
    TypeRef(factoryName, ctx.layout.application.aggregates.factories)
  }

  /** 解析聚合工厂类型（重载版本，支持自定义包路径）
    */
  def aggregateFactory(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析聚合仓库类型（重载版本，支持自定义包路径）
    */
  def aggregateRepository(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  /** 解析投影类型
    */
  def projection(name: String): TypeRef =
    TypeRef(name, ctx.layout.application.projection.root)

  /** 解析投影类型（重载版本，支持自定义包路径）
    */
  def projection(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析投影处理程序类型 根据概念名称自动生成规范的处理器名称
    */
  def projectionHandler(conceptName: String): TypeRef = {
    // 获取基础名称并应用命名规范
    val baseName = NamingConventions.getBaseName(conceptName)
    val handlerName = NamingConventions.projectionHandlerName(baseName)
    TypeRef(handlerName, ctx.layout.application.projection.handlers)
  }

  /** 解析投影处理程序类型 使用指定的处理器名称
    */
  def projectionHandlerByName(name: String): TypeRef =
    TypeRef(name, ctx.layout.application.projection.handlers)

  /** 解析投影处理程序类型（重载版本，支持自定义包路径）
    */
  def projectionHandler(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析Saga上下文类型
    */
  def sagaContext(name: String): TypeRef = {
    val contextName =
      NamingConventions.getSagaContextName(NamingConventions.getBaseName(name))
    TypeRef(contextName, ctx.layout.application.services.transactor.root)
  }

  /** 解析Saga参与者类型
    */
  def sagaParticipant(name: String): TypeRef =
    TypeRef(name, ctx.layout.application.services.transactor.root)

  /** 解析Saga参与者类型（重载版本，支持自定义包路径）
    */
  def sagaParticipant(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析Saga事务类型
    */
  def sagaTransaction(name: String): TypeRef =
    TypeRef(name, ctx.layout.application.services.transactor.root)

  /** 解析Saga事务类型（重载版本，支持自定义包路径）
    */
  def sagaTransaction(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析Saga事务状态类型
    */
  def sagaTransactionState(name: String): TypeRef = {
    val entityPkg = ctx.layout.domain.entities.root
    val entityObjectName = NamingConventions.getSagaTransactionEntityName(name)
    TypeRef(
      NamingConventions.getSagaTransactionStateName(name),
      s"$entityPkg.$entityObjectName"
    )
  }

  /** 解析Saga事务事件类型
    */
  def sagaTransactionEvent(name: String): TypeRef = {
    val entityPkg = ctx.layout.domain.entities.root
    val entityObjectName = NamingConventions.getSagaTransactionEntityName(name)
    TypeRef(
      NamingConventions.getSagaTransactionEventName(name),
      s"$entityPkg.$entityObjectName"
    )
  }

  /** 解析Saga事务事件类型（当前包版本）
    */
  def sagaTransactionEventInCurrentPkg(name: String, pkg: String): TypeRef = {
    TypeRef(NamingConventions.getSagaTransactionEventName(name), pkg)
  }

  /** 解析聚合仓库实现 优势：Builder 不需要知道实现类叫 "Impl" 还是 "Default"，只传业务名即可
    */
  def aggregateRepositoryImpl(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.aggregateRepositoryImplName(baseName),
      ctx.layout.infrastructure.persistence.repositories.aggregate
    )
  }

  /** 解析聚合仓库实现（直接从仓库元数据生成）
    */
  def aggregateRepositoryImpl(meta: RepositoryMetadata): TypeRef = {
    val baseName = NamingConventions.getBaseName(meta.name)
    aggregateRepositoryImpl(baseName)
  }

  /** 解析聚合仓库实现类类型（重载版本，支持自定义包路径）
    */
  def aggregateRepositoryImpl(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  /** 解析投影仓库实现类类型（通过概念名称）
    */
  def projectionRepositoryImpl(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.aggregateRepositoryImplName(baseName),
      ctx.layout.infrastructure.persistence.repositories.projection
    )
  }

  /** 解析投影仓库实现类类型（直接从仓库元数据生成）
    */
  def projectionRepositoryImpl(meta: RepositoryMetadata): TypeRef = {
    val baseName = NamingConventions.getBaseName(meta.name)
    projectionRepositoryImpl(baseName)
  }

  /** 解析投影仓库实现类类型（直接从仓库元数据生成，支持自定义包路径）
    */
  def projectionRepositoryImpl(
      meta: RepositoryMetadata,
      pkg: String
  ): TypeRef = {
    val baseName = NamingConventions.getBaseName(meta.name)
    val implName = NamingConventions.aggregateRepositoryImplName(baseName)
    projectionRepositoryImpl(implName, pkg)
  }

  /** 解析投影仓库实现类类型（重载版本，支持自定义包路径）
    */
  def projectionRepositoryImpl(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  /** 解析Saga仓库实现类类型
    */
  def sagaRepositoryImpl(conceptName: String): TypeRef = {
    // 先获取基础名称（移除任何可能的后缀）
    val baseName = NamingConventions.getBaseName(conceptName)
    TypeRef(
      NamingConventions.sagaTransactionRepositoryImplName(baseName),
      ctx.layout.infrastructure.persistence.repositories.saga
    )
  }

  /** 解析Saga仓库实现类类型（重载版本，支持自定义包路径）
    */
  def sagaRepositoryImpl(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  /** 解析元组类型
    */
  def tuple(types: Seq[TypeRef]): TypeRef = {
    if (types.isEmpty) {
      TypeRef("Unit", "scala")
    } else {
      TypeRef(s"Tuple${types.size}", "scala", types)
    }
  }

  /** 解析protobuf事件类型（用于AggregateRootProtoBuilder）
    */
  def protoEvent(aggregateName: String, ctx: GeneratorContext): TypeRef = {
    val protoPackage =
      ctx.layout.infrastructure.proto.eventPackage(aggregateName)
    TypeRef(NamingConventions.getProtoEventPOName(aggregateName), protoPackage)
  }

  /** 解析protobuf事件家族类型（用于AggregateRootProtoBuilder）
    */
  def protoEventFamily(
      aggregateName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    val protoPackage =
      ctx.layout.infrastructure.proto.eventPackage(aggregateName)
    TypeRef(
      NamingConventions.getProtoEventFamilyName(aggregateName),
      protoPackage
    )
  }

  /** 解析protobuf状态类型（用于AggregateAdapterBuilder）
    */
  def protoState(aggregateName: String, ctx: GeneratorContext): TypeRef = {
    val protoPackage =
      ctx.layout.infrastructure.proto.eventPackage(aggregateName)
    TypeRef(NamingConventions.getProtoStatePOName(aggregateName), protoPackage)
  }

  /** 解析Saga Protobuf事件类型（用于SagaAdapterBuilder）
    */
  def sagaProtoEvent(sagaName: String, ctx: GeneratorContext): TypeRef = {
    val protoPackage = ctx.layout.infrastructure.proto.transactions
    TypeRef(
      NamingConventions.getSagaTransactionEventPOName(sagaName),
      protoPackage
    )
  }

  /** 解析Saga Protobuf事件Family类型（用于SagaAdapterBuilder）
    */
  def sagaProtoEventFamily(sagaName: String, ctx: GeneratorContext): TypeRef = {
    val protoPackage = ctx.layout.infrastructure.proto.transactions
    TypeRef(
      NamingConventions.getSagaTransactionEventFamilyName(sagaName),
      protoPackage
    )
  }

  /** 解析Saga Protobuf状态类型（用于SagaAdapterBuilder）
    */
  def sagaProtoState(sagaName: String, ctx: GeneratorContext): TypeRef = {
    val protoPackage = ctx.layout.infrastructure.proto.transactions
    TypeRef(
      NamingConventions.getSagaProtoStatePOName(sagaName),
      protoPackage
    )
  }

  /** 解析Saga Scala状态根类型（用于SagaAdapterBuilder）
    */
  def sagaTransactionStateRootType(sagaName: String, ctx: GeneratorContext): TypeRef = {
    val entityPkg = ctx.layout.domain.entities.root
    val entityObjectName = NamingConventions.getSagaTransactionEntityName(sagaName)
    val stateName = NamingConventions.getSagaTransactionStateName(sagaName)
    TypeRef(stateName, s"$entityPkg.$entityObjectName")
  }

  /** 解析Saga Scala事件根类型（用于SagaAdapterBuilder）
    */
  def sagaTransactionEventRootType(eventName: String, sagaName: String, ctx: GeneratorContext): TypeRef = {
    val entityPkg = ctx.layout.domain.entities.root
    val entityObjectName = NamingConventions.getSagaTransactionEntityName(sagaName)
    TypeRef(eventName, s"$entityPkg.$entityObjectName")
  }

  /** 解析Saga参与者引用类型
    */
  def sagaParticipant(
      participantName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    TypeRef(participantName, ctx.layout.application.services.transactor.root)
  }

  /** 解析Saga参与者Proto类型
    */
  def sagaParticipantProto(
      participantName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    TypeRef(
      s"${participantName}PO",
      ctx.layout.infrastructure.proto.sagaParticipant
    )
  }

  /** 解析Saga Initiated Proto类型
    */
  def sagaProtoInitiated(sagaName: String, ctx: GeneratorContext): TypeRef = {
    TypeRef(
      NamingConventions.getSagaProtoInitiatedPOName(sagaName),
      ctx.layout.infrastructure.proto.transactions
    )
  }

  /** 解析Saga Prepared Proto类型
    */
  def sagaProtoPrepared(sagaName: String, ctx: GeneratorContext): TypeRef = {
    TypeRef(
      NamingConventions.getSagaProtoPreparedPOName(sagaName),
      ctx.layout.infrastructure.proto.transactions
    )
  }

  /** 解析Saga Completed Proto类型
    */
  def sagaProtoCompleted(sagaName: String, ctx: GeneratorContext): TypeRef = {
    TypeRef(
      NamingConventions.getSagaProtoCompletedPOName(sagaName),
      ctx.layout.infrastructure.proto.transactions
    )
  }

  /** 解析Saga Failed Proto类型
    */
  def sagaProtoFailed(sagaName: String, ctx: GeneratorContext): TypeRef = {
    TypeRef(
      NamingConventions.getSagaProtoFailedPOName(sagaName),
      ctx.layout.infrastructure.proto.transactions
    )
  }

  /** 解析Saga事务实体类型
    */
  def sagaTransactionEntity(
      sagaName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    TypeRef(
      NamingConventions.getSagaTransactionEntityName(sagaName),
      ctx.layout.domain.entities.root
    )
  }

  /** 获取实体对象路径（作为包名使用）
    */
  def entityObjectPath(entityName: String, ctx: GeneratorContext): String = {
    s"${ctx.layout.domain.entities.root}.$entityName"
  }

  /** 解析投影仓库接口类型（用于ProjectionRepositoryImplBuilder）
    */
  def projectionRepositoryInterface(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  // [Legacy] Simple wrappers kept for backward compatibility with Builders
  def projectionDto(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def sagaEventAdapter(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def sagaConverter(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def aggregateAdapter(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def aggregateConverter(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)
  def bootstrap(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def entity(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def eventHandler(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def eventAdapter(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def snapshotAdapter(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def sagaEvent(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def domainEvent(name: String, pkg: String): TypeRef = TypeRef(name, pkg)
  def sagaState(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析ScalikeJDBC会话类型
    */
  def scalikeJdbcSession: TypeRef =
    TypeRef("ScalikeJdbcSession", "net.imadz.common.application.projection")

  /** 解析ScalikeJDBC设置类型
    */
  def scalikeJdbcSetup: TypeRef =
    TypeRef("ScalikeJdbcSetup", "net.imadz.common.application.projection")

  /** 解析MongoDB读日志类型
    */
  def mongoReadJournal: TypeRef =
    TypeRef("MongoReadJournal", "akka.contrib.persistence.mongodb")

  /** 解析ApplicationBootstrap类型
    */
  def applicationBootstrap: TypeRef =
    TypeRef("ApplicationBootstrap", ctx.layout.infrastructure.bootstrap)

  /** 解析SagaCoordinatorBootstrap类型
    */
  def sagaCoordinatorBootstrap: TypeRef = TypeRef(
    "SagaTransactionCoordinatorBootstrap",
    ctx.layout.infrastructure.bootstrap
  )

  /** 解析指定名称的Bootstrap类型
    */
  def bootstrap(name: String): TypeRef =
    TypeRef(name, ctx.layout.infrastructure.bootstrap)

  /** 解析序列化策略类型
    */
  def serializationStrategy(name: String, pkg: String): TypeRef =
    TypeRef(name, pkg)

  /** 解析分片守护进程类型（用于BootstrapBuilder）
    */
  def shardedDaemonProcess: TypeRef =
    TypeRef("ShardedDaemonProcess", "akka.cluster.sharding.typed.scaladsl")

  /** 解析分片守护进程设置类型（用于BootstrapBuilder）
    */
  def shardedDaemonProcessSettings: TypeRef =
    TypeRef("ShardedDaemonProcessSettings", "akka.cluster.sharding.typed")

  /** 解析投影行为类型（用于BootstrapBuilder）
    */
  def projectionBehavior: TypeRef =
    TypeRef("ProjectionBehavior", "akka.projection")

  /** 解析ForSaga类型（用于BootstrapBuilder）
    */
  def forSaga: TypeRef = TypeRef("ForSaga", s"${ctx.rootPackage}.infra.saga")

  /** 解析StepExecutor类型（用于BootstrapBuilder）
    */
  def stepExecutor: TypeRef =
    TypeRef("StepExecutor", s"${ctx.rootPackage}.infra.saga")

  /** 解析Saga事务协调器事件适配器类型（用于BootstrapBuilder）
    */
  def sagaCoordinatorEventAdapter: TypeRef = TypeRef(
    "SagaTransactionCoordinatorEventAdapter",
    s"${ctx.rootPackage}.infra.saga.persistence"
  )

  /** 解析Saga事务器类型（用于BootstrapBuilder）
    */
  def transactor(name: String): TypeRef =
    TypeRef(name, ctx.layout.application.services.transactor.root)

  /** 解析Saga事务器上下文类型（用于BootstrapBuilder）
    */
  def transactorContext(name: String, transactorName: String): TypeRef =
    TypeRef(
      name,
      s"${ctx.layout.application.services.transactor.root}.$transactorName"
    )

  /** 解析原始类型转换器（用于AggregateConverterBuilder）
    */
  def primitiveConverter: TypeRef = TypeRef(
    "PrimitiveConverter",
    s"${ctx.frameworkPackage}.common.serialization"
  )

  /** 解析领域状态的Scala类型（用于AggregateAdapterBuilder）
    */
  def scalaStateType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析领域状态的Proto类型（用于AggregateAdapterBuilder）
    */
  def protoStateType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析Proto文件类型（用于ProtoFileModel）
    */
  def protoFile(fileName: String, packageName: String): TypeRef =
    TypeRef(fileName, packageName)

  /** 解析域类型（用于AggregateConverterBuilder）
    */
  def domainType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析PO类型（用于AggregateConverterBuilder）
    */
  def poType(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析聚合行为类型（重载版本，支持自定义包路径）
    */
  def aggregateBehavior(name: String, pkg: String): TypeRef = TypeRef(name, pkg)

  /** 解析自定义类型
    */
  def customType(name: String, pkg: String, typeArgs: MetaType*): TypeRef = {
    TypeResolver.resolve(CustomType(name, pkg, typeArgs), ctx)
  }

  /** 解析结构体/值对象类型
    */
  def struct(name: String): TypeRef = TypeResolver.resolve(StructRef(name), ctx)

  /** 解析任意元类型
    */
  def resolve(metaType: MetaType): TypeRef = TypeResolver.resolve(metaType, ctx)

  /** 拦截通用的 resolve 调用，确保通过 Ref 解析的类型与通过 String 解析的一致
    */
  def resolve(ref: MetaRef): TypeRef = ref match {
    // 1. String-based DSL methods (Standardized Naming)
    case AggregateRef(name)                 => aggregateRoot(name)
    case EntityRef(name)                    => entity(name)
    case InvariantRuleRef(name)             => invariantRule(name)
    case DomainServiceRef(name)             => domainService(name)
    case ValueObjectRef(name)               => valueObject(name)
    case ControllerRef(name)                => controller(name)
    case AggregateBehaviorRef(name)         => aggregateBehavior(name)
    case AggregateRepositoryRef(name)       => aggregateRepository(name)
    case ProjectionRepositoryRef(name)      => projectionRepository(name)
    case ApplicationServiceRef(name)        => applicationService(name)
    case QueryServiceRef(name)              => queryService(name)
    case StructRef(name)                    => struct(name)

    // 2. Ref-based DSL delegates (Resolving nested types via partial metadata)
    case r: CommandRef        => command(r)
    case r: CommandFamilyRef  => commandFamily(r)
    case r: CommandReplyRef   => commandReply(r)
    case r: EventRef          => event(r)
    case r: EventFamilyRef    => eventFamily(r)
    case r: EntityStateRef    => entityState(r)
    case r: EntityBehaviorRef => entityBehavior(r)
    case r: SagaContextRef    => ??? // sagaContext(r)

    // 3. Fallback
    case _ => TypeResolver.resolve(ref, ctx)
  }

  /** 解析方法参数类型
    */
  def parameterType(paramType: MetaType): TypeRef =
    TypeResolver.resolve(paramType, ctx)
}
