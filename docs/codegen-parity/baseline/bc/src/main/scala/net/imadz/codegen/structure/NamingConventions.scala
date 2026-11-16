package net.imadz.codegen.structure

/** 统一命名规范管理 集中管理所有命名计算逻辑，消除分散在各处的信息熵
  */
object NamingConventions {

  /** Strict v3 symbols retain the ingress hyphen-to-underscore mapping. No suffix stripping. */
  def strictSymbol(value: String): String = {
    val normalized = value.replace('-', '_')
    require(normalized.matches("[A-Za-z_][A-Za-z0-9_]*") && !SCALA_KEYWORDS(normalized), "Unsafe strict symbol")
    normalized
  }
  def strictPhaseStem(step: String, phase: String): String =
    firstUpper(strictSymbol(step)) + firstUpper(strictSymbol(phase))
  def strictNestedName(stem: String, role: String): String = stem + role
  def strictPascal(value: String): String = value.split("[-_]", -1).filter(_.nonEmpty).map(firstUpper).mkString
  def strictKebab(value: String): String = value.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase
  def strictSiblingPackage(pkg: String, member: String): String = {
    strictPackagePath(pkg)
    pkg + "." + strictSymbol(member)
  }
  def strictMember(stem: String, role: String): String = firstLower(stem) + role
  def strictFileName(name: String): String = strictSymbol(name) + ".scala"
  def strictPackagePath(pkg: String): String = {
    require(pkg.nonEmpty && pkg.split("\\.", -1).forall(p => strictSymbol(p) == p), "Unsafe strict package")
    pkg.replace('.', '/')
  }

  /** Product target names retain identity; Scala keywords are escaped, never renamed. */
  def productSymbol(value: String): String = {
    require(value != null && value.matches("[A-Za-z_][A-Za-z0-9_]*"), "Unsafe product symbol")
    if (SCALA_KEYWORDS(value)) "`" + value + "`" else value
  }
  def productPackage(value: String): String = {
    require(value != null && value.split("\\.", -1).forall(p => p.matches("[a-z][a-z0-9_]*") && !SCALA_KEYWORDS(p)), "Unsafe product package")
    value
  }
  def productPackagePath(value: String, segment: String): String = {
    productPackage(value)
    require(segment.split("/", -1).forall(p => p.nonEmpty && p != "." && p != ".."), "Unsafe product source segment")
    "app/" + value.replace('.', '/') + "/" + segment
  }

  // === 类名规范 ===

  // 聚合根类名规范
  def aggregateRootName(baseName: String): String = baseName + "Aggregate"

  // 聚合行为类名规范
  def aggregateBehaviorName(baseName: String): String = baseName + "Behaviors"

  // 聚合工厂类名规范
  def aggregateFactoryName(baseName: String): String =
    baseName + "AggregateFactory"

  // 聚合仓库接口类名规范
  def aggregateRepositoryInterfaceName(baseName: String): String =
    baseName + "Repository"

  // 聚合仓库实现类名规范
  def aggregateRepositoryImplName(baseName: String): String =
    baseName + "RepositoryImpl"

  // 从仓库接口名称获取仓库实现名称
  def getRepositoryImplNameFromInterfaceName(interfaceName: String): String = {
    interfaceName + "Impl"
  }

  // 2026-09-20 EP_Improvement_Engine：Connector 实现类名规范
  def connectorImplName(connectorName: String): String = connectorName + "Impl"

  // 生成Akka Sharding EntityTypeKey名称
  def entityTypeKeyName(baseName: String): String = {
    s"${baseName}EntityTypeKey"
  }

  // 应用服务类名规范
  def applicationServiceName(baseName: String): String = baseName + "Service"

  // 命令辅助类名规范
  def commandHelperName(commandName: String): String = commandName + "Helper"

  // Saga事务类名规范
  def sagaTransactorName(baseName: String): String = baseName + "SagaTransactor"

  // Saga事务仓库类名规范
  def sagaTransactionRepositoryName(baseName: String): String =
    baseName + "SagaTransactionRepository"

  // Saga事务仓库实现类名规范
  def sagaTransactionRepositoryImplName(baseName: String): String =
    baseName + "SagaTransactionRepositoryImpl"

  // Saga参与者类名规范
  def sagaParticipantName(baseName: String): String = baseName + "Participant"

  // 投影类名规范
  def projectionName(baseName: String): String = baseName + "Projection"

  // 投影处理器类名规范
  def projectionHandlerName(baseName: String): String = baseName + "Handler"

  // 投影仓库接口类名规范
  def projectionRepositoryInterfaceName(baseName: String): String =
    baseName + "Repository"

  // 投影仓库实现类名规范
  def projectionRepositoryImplName(baseName: String): String =
    baseName + "RepositoryImpl"

  // 领域事件处理器类名规范
  def domainEventHandlerName(baseName: String): String =
    baseName + "EventHandler"

  // 查询服务类名规范
  def queryServiceName(baseName: String): String = baseName + "Query"

  // 领域实体类名规范
  def domainEntityName(baseName: String): String = baseName + "Entity"

  // 领域值对象类名规范
  def domainValueObjectName(baseName: String): String = baseName

  // 不变规则类名规范
  def invariantRuleName(baseName: String): String = baseName + "Rule"

  // 领域服务类名规范
  def domainServiceName(baseName: String): String = baseName + "DomainService"

  // 快照适配器类名规范
  def snapshotAdapterName(baseName: String): String =
    baseName + "SnapshotAdapter"

  // 事件适配器类名规范
  def eventAdapterName(baseName: String): String = baseName + "EventAdapter"

  // 转换器类名规范
  def converterName(baseName: String): String = baseName + "ProtoConverters"

  // 转换器特质类名规范
  def converterTraitName(baseName: String): String = baseName + "Converter"

  // 序列化策略类名规范
  def serializationStrategyName(baseName: String): String =
    baseName + "SerializationStrategies"

  // Bootstrap类名规范
  def bootstrapName(baseName: String): String = baseName + "Bootstrap"

  // === 包名规范 ===

  // 统一使用PackageLayout管理包名，不再在这里定义

  // === 命名转换工具 ===

  // 首字母小写（用于参数名）
  def firstLower(name: String): String =
    if (name.isEmpty) name
    else name.head.toLower + name.tail

  // 首字母大写
  def firstUpper(name: String): String =
    if (name.isEmpty) name
    else name.head.toUpper + name.tail

  // 移除后缀
  def removeSuffix(name: String, suffix: String): String =
    if (name.endsWith(suffix)) name.dropRight(suffix.length)
    else name

  /** Scala 关键字集合（摄入侧字段名可能撞关键字，如 'type'） */
  val SCALA_KEYWORDS: Set[String] = Set(
    "type", "object", "class", "trait", "def", "val", "var", "for", "while", "if", "else",
    "match", "case", "import", "package", "extends", "with", "new", "return", "throw",
    "try", "catch", "finally", "null", "true", "false", "this", "super", "sealed",
    "implicit", "lazy", "override", "private", "protected", "abstract", "final", "yield", "do"
  )

  /** 字段/参数名 → 合法 Scala 标识符（关键字加反引号，2026-08-21 摄入侧形态适配） */
  def scalaIdentifier(name: String): String =
    if (SCALA_KEYWORDS.contains(name)) s"`$name`" else name

  // 获取基础名称（移除常见后缀）
  // 2026-08-21 修复：① 聚合名恰等于后缀（如 Context）时剥空 → 回退原名；
  //   ② 剥空发生在中间步骤时（ContextEntity 剥 Entity→Context 再剥 Context→空），回退「最后非空中间值」
  //   ——否则下游再拼后缀产生双重后缀（ContextEntityEntity）
  def getBaseName(name: String): String = {
    val suffixes = List(
      "Aggregate",
      "Controller",
      "Entity",
      "DomainService",
      "Service",
      "Factory",
      "Behavior",
      "Behaviors",
      "RepositoryImpl",
      "Policy",
      "Handler",
      "Adapter",
      "Converter",
      "Strategy",
      "Bootstrap",
      "SagaTransactionRepository",
      "SagaTransactor",
      "SagaTransaction",
      "Repository",
      "Query",
      "Participant",
      "Participant",
      "Event",
      "State",
      "Context"
    )
    var current = name
    var lastNonEmpty = name
    for (suffix <- suffixes) {
      val next = removeSuffix(current, suffix)
      if (next.isEmpty) return lastNonEmpty
      lastNonEmpty = next
      current = next
    }
    current
  }

  // === 转换方法 ===

  // 从SagaTransactor名称获取基础名称
  def getSagaBaseName(sagaTransactorName: String): String = {
    removeSuffix(sagaTransactorName, "SagaTransactor")
  }

  def getSagaTransactorProtocol(sagaTransactorName: String): String = {
    s"${getSagaBaseName(sagaTransactorName)}Protocol"
  }

  // 从SagaTransactor名称获取上下文名称
  def getSagaContextName(sagaTransactorName: String): String = {
    s"${getSagaBaseName(sagaTransactorName)}Context"
  }

  // 从SagaTransactor名称获取事务状态名称
  def getSagaTransactionStateName(sagaTransactorName: String): String = {
    s"${getSagaBaseName(sagaTransactorName)}TransactionState"
  }

  // 从SagaTransactor名称获取事务事件名称
  def getSagaTransactionEventName(sagaTransactorName: String): String = {
    s"${getSagaBaseName(sagaTransactorName)}TransactionEvent"
  }

  // 从SagaTransactor名称获取事务实体名称
  def getSagaTransactionEntityName(sagaTransactorName: String): String = {
    s"${getSagaBaseName(sagaTransactorName)}TransactionEntity"
  }

  // 从聚合名称获取基础名称
  def getAggregateBaseName(aggregateName: String): String = {
    removeSuffix(aggregateName, "Aggregate")
  }

  // 从聚合根名称获取工厂名称
  def getFactoryNameFromAggregateName(aggregateName: String): String = {
    aggregateFactoryName(getAggregateBaseName(aggregateName))
  }

  // ====================== 业务概念到技术名称的转换 ======================
  // 这些方法支持从纯粹的业务概念名称生成技术实现名称

  // 从业务概念名称生成聚合根名称
  def getAggregateNameFromBusinessConcept(businessName: String): String = {
    aggregateRootName(businessName)
  }

  // 从业务概念名称生成领域实体名称
  def getEntityNameFromBusinessConcept(businessName: String): String = {
    domainEntityName(businessName)
  }

  // 从业务概念名称生成应用服务名称
  def getServiceNameFromBusinessConcept(businessName: String): String = {
    applicationServiceName(businessName)
  }

  // 从业务概念名称生成查询服务名称
  def getQueryServiceNameFromBusinessConcept(businessName: String): String = {
    queryServiceName(businessName)
  }

  // 从业务概念名称生成 Saga 参与者名称
  def getSagaParticipantNameFromBusinessConcept(
      businessName: String
  ): String = {
    sagaParticipantName(businessName)
  }

  // 从业务概念名称生成投影名称
  def getProjectionNameFromBusinessConcept(businessName: String): String = {
    projectionName(businessName)
  }

  // 从业务概念名称生成 Saga 事务仓库名称
  def getSagaTransactionRepositoryNameFromBusinessConcept(
      businessName: String
  ): String = {
    sagaTransactionRepositoryName(businessName)
  }

  // 从业务概念名称生成 Saga 事务仓库实现名称
  def getSagaTransactionRepositoryImplNameFromBusinessConcept(
      businessName: String
  ): String = {
    sagaTransactionRepositoryImplName(businessName)
  }

  // 从业务概念名称生成投影仓库接口名称
  def getProjectionRepositoryInterfaceNameFromBusinessConcept(
      businessName: String
  ): String = {
    projectionRepositoryInterfaceName(businessName)
  }

  // 从业务概念名称生成投影仓库实现名称
  def getProjectionRepositoryImplNameFromBusinessConcept(
      businessName: String
  ): String = {
    projectionRepositoryImplName(businessName)
  }

  // 从业务概念名称生成不变规则名称
  def getRuleNameFromBusinessConcept(businessName: String): String = {
    invariantRuleName(businessName)
  }

  // 从业务概念名称生成领域服务名称
  def getDomainServiceNameFromBusinessConcept(businessName: String): String = {
    domainServiceName(businessName)
  }

  // 从业务概念名称生成转换器特质名称
  def getConverterNameFromBusinessConcept(businessName: String): String = {
    converterTraitName(businessName)
  }

  // 从业务概念名称生成序列化策略名称
  def getSerializationStrategyNameFromBusinessConcept(
      businessName: String
  ): String = {
    serializationStrategyName(businessName)
  }

  // 从聚合根名称获取应用服务名称
  def getApplicationServiceNameFromAggregateName(
      aggregateName: String
  ): String = {
    applicationServiceName(getAggregateBaseName(aggregateName))
  }

  // 从聚合根名称获取仓库接口名称
  def getRepositoryInterfaceNameFromAggregateName(
      aggregateName: String
  ): String = {
    aggregateRepositoryInterfaceName(getAggregateBaseName(aggregateName))
  }

  // 从聚合根名称获取仓库实现名称
  def getRepositoryImplNameFromAggregateName(aggregateName: String): String = {
    aggregateRepositoryImplName(getAggregateBaseName(aggregateName))
  }

  // 从事件名称获取事件处理器名称
  def getEventHandlerNameFromEventName(eventName: String): String = {
    eventName + "Handler"
  }

  // 从实体名称获取事件处理器名称
  def getEventHandlerNameFromEntityName(entityName: String): String = {
    getEventHandlerNameFromEventName(getEventNameFromEntityName(entityName))
  }

  // 从投影名称生成投影处理器名称
  def getProjectionHandlerNameFromProjectionName(
      projectionName: String
  ): String = {
    projectionHandlerName(getBaseName(projectionName))
  }

  // ====================== Proto相关命名 ======================
  // 从聚合名称生成Proto事件PO名称
  def getProtoEventPOName(aggregateName: String): String = {
    s"${getBaseName(aggregateName)}EventPO"
  }

  // 从聚合名称生成Proto事件内部类Event名称
  def getProtoEventFamilyName(aggregateName: String): String = {
    s"${getProtoEventPOName(aggregateName)}.Event"
  }

  // 从聚合名称生成Proto状态PO名称
  def getProtoStatePOName(aggregateName: String): String = {
    s"${getAggregateBaseName(aggregateName)}StatePO"
  }

  // 从聚合名称生成Proto值对象PO名称
  def getProtoValueObjectPOName(voName: String): String = {
    s"${voName}PO"
  }

  // 从事件名称生成Proto Item PO名称
  def getProtoEventItemPOName(eventName: String): String = {
    s"${eventName}PO"
  }

  // 从聚合名称生成Proto文件名（小写蛇形）
  def getProtoFileName(aggregateName: String): String = {
    toSnakeCase(getAggregateBaseName(aggregateName)) + ".proto"
  }

  // 从Saga名称生成Proto事件PO名称
  def getSagaProtoEventPOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionEventPO"
  }

  // 从Saga名称生成Proto初始事件PO名称
  def getSagaProtoInitiatedPOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionInitiatedPO"
  }

  // 从Saga名称生成Proto失败事件PO名称
  def getSagaProtoFailedPOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionFailedPO"
  }

  // 从Saga名称生成Proto准备完成事件PO名称
  def getSagaProtoPreparedPOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionPreparedPO"
  }

  // 从Saga名称生成Proto完成事件PO名称
  def getSagaProtoCompletedPOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionCompletedPO"
  }

  // 从Saga名称生成Proto状态PO名称
  def getSagaProtoStatePOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionStatePO"
  }

  // ====================== Saga组件命名 ======================
  // 从Saga名称生成事件适配器名称
  def getSagaEventAdapterName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}EventAdapter"
  }

  // 从Saga名称生成快照适配器名称
  def getSagaSnapshotAdapterName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}SnapshotAdapter"
  }

  // 从Saga名称生成Proto转换器名称
  def getSagaProtoConvertersName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}SagaProtoConverters"
  }

  // 从Saga名称生成事务事件PO包装器名称
  def getSagaTransactionEventPOName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}TransactionEventPO"
  }

  // 从Saga名称生成事务事件PO Family名称 (OneOf)
  def getSagaTransactionEventFamilyName(sagaName: String): String = {
    s"${getSagaTransactionEventPOName(sagaName)}.Event"
  }

  // 从Saga名称和事件类型生成具体事件PO名称
  def getSagaTransactionEventItemPOName(
      sagaName: String,
      eventType: String
  ): String = {
    s"${getSagaBaseName(sagaName)}${eventType}PO"
  }

  // 从Saga名称生成Proto事务名称(Prefix)
  def getSagaTransactionProtoName(sagaName: String): String = {
    s"${getSagaBaseName(sagaName)}Transaction"
  }

  // 将驼峰命名转换为蛇形命名
  def toSnakeCase(name: String): String = {
    if (name == null || name.isEmpty) return name

    val result = new StringBuilder()
    result.append(name.charAt(0).toLower)

    for (i <- 1 until name.length) {
      val char = name.charAt(i)
      if (Character.isUpperCase(char)) {
        result.append('_')
        result.append(char.toLower)
      } else {
        result.append(char)
      }
    }

    result.toString
  }

  // 从实体名称获取事件名称
  def getEventNameFromEntityName(entityName: String): String = {
    removeSuffix(entityName, "Entity") + "Event"
  }

  // 从事件名称获取实体名称
  def getEntityNameFromEventName(eventName: String): String = {
    removeSuffix(eventName, "Event") + "Entity"
  }

  // 从状态名称获取实体名称
  // 幂等：状态名可能已含 Entity 后缀（如摄入侧 <Entity>State）——先剥 State 再剥 Entity 再补 Entity，
  // 与 TypeResolver.resolveNestedType 的 getBaseName→domainEntityName 同源，避免双重 Entity（2026-08-18）。
  def getEntityNameFromStateName(stateName: String): String =
    domainEntityName(removeSuffix(removeSuffix(stateName, "State"), "Entity"))

  // 从参与者名称获取策略名称
  def getStrategyNameFromParticipantName(participantName: String): String = {
    s"${removeSuffix(participantName, "Participant")}Strategy"
  }

  // 从Saga参与者名称生成Converter Object名称
  def getSagaParticipantConverterObjectName(participantName: String): String = {
    s"${participantName}Conv"
  }

  // 从Saga名称生成State Converter Object名称
  def getSagaStateConverterObjectName(sagaName: String): String = {
    s"${getSagaTransactionStateName(sagaName)}Conv"
  }

  // 从聚合名称生成Proto转换器名称
  def getAggregateProtoConverterName(aggregateName: String): String = {
    s"${getAggregateBaseName(aggregateName)}ProtoConverters"
  }

  // 从一般名称生成Converter Object名称
  def getConverterObjectName(name: String): String = {
    s"${name}Conv"
  }

  // 获取聚合分片Tag
  def getAggregateShardingTag(aggregateName: String, index: Int): String = {
    s"${toSnakeCase(getAggregateBaseName(aggregateName))}$index"
  }

  // 获取Saga分片Tag
  def getSagaShardingTag(index: Int): String = {
    s"SagaTransactionCoordinator-$index"
  }

  // 控制器类名规范
  def controllerName(baseName: String): String = baseName + "Controller"

  // 从Saga名称生成序列化策略对象名称
  def getSerializationStrategyObjectNameFromSagaName(
      sagaName: String
  ): String = {
    s"${getSagaBaseName(sagaName)}TransactionSerializationStrategies"
  }

  // 从Saga名称生成初始化方法名
  def getSagaInitMethodNameFromSagaName(sagaName: String): String = {
    s"init${sagaName}"
  }

  // 从聚合名称生成初始化方法名
  def getAggregateInitMethodNameFromAggregateName(
      aggregateName: String
  ): String = {
    s"init${aggregateName}"
  }

  // 从投影名称生成初始化方法名
  def getProjectionInitMethodNameFromProjectionName(
      projectionName: String
  ): String = {
    s"init${getBaseName(projectionName)}Projection"
  }

  // 从聚合名称获取命令辅助类名称
  def getCommandHelperNameFromAggregateName(aggregateName: String): String = {
    s"${getAggregateBaseName(aggregateName)}CommandHelpers"
  }

  // 从投影名称获取Bootstrap名称
  def getBootstrapNameFromProjectionName(projectionName: String): String = {
    s"${removeSuffix(projectionName, "Projection")}Bootstrap"
  }

  // 从投影名称获取初始化方法名称
  def getProjectionInitMethodName(projectionName: String): String = {
    s"init${removeSuffix(projectionName, "Projection")}Projection"
  }

  // === 导入管理 ===

  // 需要排除的包
  val excludedPackages = Set("scala", "java.lang", "java.util")

  // 需要包含的类型后缀
  val includedTypeSuffixes = Set(
    "Repository",
    "Factory",
    "Service",
    "Query",
    "Aggregate",
    "Entity",
    "Policy",
    "Handler",
    "Adapter",
    "Converter",
    "Strategy",
    "Bootstrap"
  )

  // 判断是否需要包含在导入中
  def shouldIncludeInImport(fqn: String): Boolean = {
    val parts = fqn.split('.')
    if (parts.length < 2) return false

    val packageName = parts.dropRight(1).mkString(".")
    val typeName = parts.last

    // 排除指定包
    if (excludedPackages.exists(packageName.startsWith(_))) return false

    // 包含指定后缀的类型
    if (includedTypeSuffixes.exists(typeName.endsWith(_))) return true

    // 特殊处理ActorSystem
    if (typeName == "ActorSystem") return true

    false
  }
}
