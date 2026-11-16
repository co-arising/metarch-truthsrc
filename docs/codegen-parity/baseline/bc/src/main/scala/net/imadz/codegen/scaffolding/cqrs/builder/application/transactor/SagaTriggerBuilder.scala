package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef, TypeResolver}
import net.imadz.meta._

/** saga_v3 触发聚合家族构建器（**B·EP_Improvement_Engine §13**）。
  *
  * 从 `SagaTransactorMetadata` 派生四件产物的模型：
  *   - Protocol：触发命令（排除 `<Update...Status>`）+ 状态回灌命令 + 确认回复
  *   - Entity：状态 + 事件（Initiated / Completed / Failed）
  *   - Root：entityTypeKey + tags + apply
  *   - Behaviors：触发命令 → persist 意图 → StartSaga(txId,Name,Version,codec.encode(args))
  *
  * 命名：`<Base>SagaTransactor` → Protocol/Entity/Root/Behaviors 各 `<Base>SagaTransactor*`；
  * baseName 去 `SagaTransactor` 后缀（如 `MoneyTransferSagaTransactor` → `MoneyTransfer`）。 */
object SagaTriggerBuilder {

  private val coordinatorPkg = "net.imadz.infra.saga"

  def buildProtocol(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerProtocolModel = {
    val pkg = ctx.layout.application.services.transactor.root
    val baseName = meta.name.replace("SagaTransactor", "")
    val triggerNames = meta.commandFamily.commands.map(_.name).filterNot(_.startsWith("Update")).toSet
    val triggers = meta.commandFamily.commands
      .filter(c => triggerNames.contains(c.name))
      .map(c => SagaTriggerCommandModel(c.name, c.parameters.map(p => FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType))), c.parameters.map(_.name) :+ "replyTo"))
    val confirmation = TypeRef(s"${baseName}SagaConfirmation", pkg)
    val statusCmd = TypeRef(
      meta.commandFamily.commands.map(_.name).find(_.startsWith("Update")).getOrElse(s"Update${baseName}SagaStatus"),
      pkg
    )
    val deps = (triggers.flatMap(_.params.map(_.typeRef)).toSet ++ Set(
      ctx.typeResolver.resolve(CustomType("TransactionResult", coordinatorPkg)),
      ctx.typeResolver.resolve(CustomType("TracingStep", coordinatorPkg)),
      ctx.knownFrameworkTypes("ActorRef"),
      ctx.knownFrameworkTypes("CborSerializable")
    )).filter(_.shouldImport(pkg))

    SagaTriggerProtocolModel(
      selfType = TypeRef(s"${baseName}SagaTransactorProtocol", pkg),
      triggerCommands = triggers,
      confirmationType = confirmation,
      statusCommandType = statusCmd,
      transactionResultType = ctx.typeResolver.resolve(CustomType("TransactionResult", coordinatorPkg)),
      tracingStepType = ctx.typeResolver.resolve(CustomType("TracingStep", coordinatorPkg)),
      dependencies = deps
    )
  }

  def buildEntity(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerEntityModel = {
    val pkg = ctx.layout.domain.entities.root
    val baseName = meta.name.replace("SagaTransactor", "")
    val argsMeta = meta.args.getOrElse(throw new RuntimeException(s"Saga '${meta.name}' lacks args (v3)"))
    val argsFields = argsMeta.fields.map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType)))
    val stateType = TypeRef(s"${baseName}TransactionState", pkg)
    val statusType = TypeRef(s"${baseName}Status", pkg)
    val deps = (argsFields.map(_.typeRef).toSet ++ Set(
      ctx.knownFrameworkTypes("CborSerializable"),
      ctx.typeResolver.resolve(CustomType("Id", "net.imadz.common"))
    )).filter(_.shouldImport(pkg))

    SagaTriggerEntityModel(
      selfType = TypeRef(s"${baseName}TransactionEntity", pkg),
      stateType = stateType,
      argsFields = argsFields,
      statusType = statusType,
      dependencies = deps
    )
  }

  def buildRoot(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerRootModel = {
    val pkg = ctx.layout.application.services.transactor.root
    val baseName = meta.name.replace("SagaTransactor", "")
    val protocolType = TypeRef(s"${baseName}SagaTransactorProtocol", pkg)
    val behaviorsType = TypeRef(s"${baseName}SagaTransactorBehaviors", ctx.layout.application.services.transactor.behaviors)
    val contextType = meta.context
      .map(c => ctx.typeResolver.sagaContext(c.name))
      .getOrElse(ctx.typeResolver.sagaContext(meta.name))
    val deps = Set(protocolType, behaviorsType, contextType).filter(_.shouldImport(pkg))

    SagaTriggerRootModel(
      selfType = TypeRef(meta.name, pkg),
      entityName = s"${baseName}Transaction",
      tagPrefix = baseName.toLowerCase,
      commandType = TypeRef(s"${baseName}SagaCommand", pkg),
      coordinatorType = ctx.typeResolver.resolve(CustomType("SagaTransactionCoordinator", coordinatorPkg)),
      contextType = contextType,
      behaviorsType = behaviorsType,
      dependencies = deps
    )
  }

  /** 从首个触发命令的参数 → args 字段的构造表达式。
    * 名字对得上 → 直接用；命令参数是 Money 而 args 是 amount+currency → 拆分。 */
  private def argsCtorExpr(meta: SagaTransactorMetadata, argsFields: Seq[FieldDef], triggers: Seq[SagaTriggerCommandModel]): String = {
    val trigger = triggers.headOption
    val paramByName = trigger.map(_.params.map(p => p.name -> p.typeRef).toMap).getOrElse(Map.empty)
    val moneyParam = trigger.flatMap(_.params.find(_.typeRef.name == "Money")).map(_.name)
    argsFields.map { af =>
      paramByName.get(af.name) match {
        // 命令参数是 Money（同名 amount）但 args 字段是 BigDecimal/String → 拆取
        case Some(pt) if pt.name == "Money" && af.name == "amount"   => s"${af.name}.amount"
        case Some(pt) if pt.name == "Money" && af.name == "currency" => s"${af.name}.currency.getCurrencyCode"
        case Some(pt) if af.typeRef.name == "String" && pt.name == "Id" => s"${af.name}.toString"
        case Some(_)                                                    => af.name
        case None if af.name == "amount" && moneyParam.isDefined         => s"${moneyParam.get}.amount"
        case None if af.name == "currency" && moneyParam.isDefined       => s"${moneyParam.get}.currency.getCurrencyCode"
        case None                                                        => af.name
      }
    }.mkString(", ")
  }

  def buildBehaviors(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerBehaviorsModel = {
    val pkg = ctx.layout.application.services.transactor.behaviors
    val baseName = meta.name.replace("SagaTransactor", "")
    val rootPkg = ctx.layout.application.services.transactor.root
    val argsMeta = meta.args.getOrElse(throw new RuntimeException(s"Saga '${meta.name}' lacks args (v3)"))
    val argsFields = argsMeta.fields.map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType)))
    val protocol = buildProtocol(meta, ctx)
    val entity = buildEntity(meta, ctx)
    val contextType = meta.context
      .map(c => ctx.typeResolver.sagaContext(c.name))
      .getOrElse(ctx.typeResolver.sagaContext(meta.name))
    val definitionType = TypeRef(s"${baseName}SagaDefinition", rootPkg)
    val deps = (Set(
      TypeRef(s"${baseName}SagaTransactorProtocol", rootPkg),
      entity.selfType,
      entity.stateType,
      definitionType,
      protocol.confirmationType,
      contextType,
      protocol.transactionResultType,
      ctx.knownFrameworkTypes("EntityRef"),
      ctx.knownFrameworkTypes("ActorRef")
    ) ++ protocol.triggerCommands.flatMap(_.params.map(_.typeRef))  // 触发命令参数类型（Id/Money…）
    ).filter(_.shouldImport(pkg))

    SagaTriggerBehaviorsModel(
      selfType = TypeRef(s"${baseName}SagaTransactorBehaviors", pkg),
      entityName = s"${baseName}Transaction",
      stateType = entity.stateType,
      eventType = TypeRef(s"${baseName}TransactionEvent", ctx.layout.domain.entities.root),
      commandType = TypeRef(s"${baseName}SagaCommand", rootPkg),
      definitionType = definitionType,
      argsType = TypeRef(argsMeta.name, rootPkg),
      argsFields = argsFields,
      triggerCommands = protocol.triggerCommands,
      argsCtorExpr = argsCtorExpr(meta, argsFields, protocol.triggerCommands),
      confirmationType = protocol.confirmationType,
      statusCommandType = protocol.statusCommandType,
      coordinatorType = ctx.typeResolver.resolve(CustomType("SagaTransactionCoordinator", coordinatorPkg)),
      contextType = contextType,
      transactionResultType = protocol.transactionResultType,
      dependencies = deps
    )
  }
}
