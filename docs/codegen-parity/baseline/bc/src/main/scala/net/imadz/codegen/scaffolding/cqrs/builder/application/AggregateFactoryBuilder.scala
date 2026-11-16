package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{
  AggregateFactoryModel,
  FactoryMethodModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{
  AggregateRootMetadata,
  CommandReplyRef,
  CommandRef,
  SubordinateCommandMetadata
}

object AggregateFactoryBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateFactoryModel = {
    val pkg = ctx.layout.application.aggregates.factories
    val selfType = ctx.typeResolver.aggregateFactory(meta)
    val aggregateType = ctx.typeResolver.aggregateRoot(meta.name)
    val commandFamily = ctx.typeResolver.commandFamily(meta.commandFamily.name)
    val entityTypeKey = "entityTypeKey"

    // 解析基础类型和字段
    val idField = resolveIdField(meta, ctx)
    val repliesType = resolveReplyTypes(meta, ctx)
    val commandsType = resolveCommandTypes(meta, commandFamily, ctx)

    // 构建工厂方法
    val refMethod =
      buildCreateRefMethod(meta, idField, commandFamily, entityTypeKey, ctx)
    val initMethodOpt = buildInitializationMethodOption(
      meta,
      idField,
      commandFamily,
      entityTypeKey,
      ctx
    )
    val factoryMethods = Seq(refMethod) ++ initMethodOpt

    // 收集依赖
    val dependencies = collectDependencies(
      commandsType,
      repliesType,
      initMethodOpt,
      refMethod,
      ctx,
      pkg
    )

    AggregateFactoryModel(
      selfType,
      aggregateType,
      entityTypeKey,
      commandFamily,
      factoryMethods,
      dependencies,
      noteIds = meta.noteId.toSeq
    )
  }

  /** 解析 ID 字段
    * 2026-08-21 摄入侧适配：id 名用聚合 identifier（原硬编码 'userId'，Session/Workgroup 等聚合不适用）
    */
  private def resolveIdField(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): FieldDef = {
    val idType = ctx.typeResolver.parameterType(meta.identifier.fieldType)
    // 2026-09-23 EP_GenerationTime_Code_Anchors B4（断链修复）：标识符字段**本身也是知识元素**
    // （真源 `fieldModel.identifier` 26/26 全带 noteId），此前只搬 name/type ⇒ 该 id 到不了模板。
    // 带上后模板可在 `def` 前发**形态③** 方法参数锚（`pkg.Factory.createX.<参数>  @knowledge <id>`）。
    FieldDef(meta.identifier.name, idType, noteId = meta.identifier.noteId, description = meta.identifier.description)
  }

  /** 解析回复类型
    */
  private def resolveReplyTypes(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Seq[TypeRef] = {
    meta.replyFamily.replies.map(x =>
      ctx.typeResolver.resolve(CommandReplyRef(x.name))
    )
  }

  /** 解析命令类型
    */
  private def resolveCommandTypes(
      meta: AggregateRootMetadata,
      commandFamily: TypeRef,
      ctx: GeneratorContext
  ): Seq[TypeRef] = {
    commandFamily +: meta.commandFamily.commands.map(x =>
      ctx.typeResolver.command(CommandRef(x.name))
    )
  }

  /** 构建创建引用方法 (裸引用)
    */
  private def buildCreateRefMethod(
      meta: AggregateRootMetadata,
      idField: FieldDef,
      commandFamily: TypeRef,
      entityTypeKey: String,
      ctx: GeneratorContext
  ): FactoryMethodModel = {
    val entityRefType =
      ctx.knownFrameworkTypes("EntityRef").copy(typeParams = Seq(commandFamily))
    val aggNameBase = NamingConventions.getBaseName(meta.name)

    FactoryMethodModel(
      name = s"create${aggNameBase}WithoutBalance",
      parameters = Seq(idField),
      returnType = entityRefType,
      bodyLogic =
        s"""clusterSharding.entityRefFor($entityTypeKey, ${idField.name}.toString)"""
    )
  }

  /** 构建初始化方法选项 查找第一个非只读且带参数的命令作为初始化命令
    */
  private def buildInitializationMethodOption(
      meta: AggregateRootMetadata,
      idField: FieldDef,
      commandFamily: TypeRef,
      entityTypeKey: String,
      ctx: GeneratorContext
  ): Option[FactoryMethodModel] = {
    val initCommandOpt = meta.commandFamily.commands.find(c =>
      !c.isReadOnly && c.parameters.nonEmpty
    )

    initCommandOpt.map { initialCommandMeta =>
      val methodName = determineInitializationMethodName(meta)
      buildCreateWithInitialMethod(
        meta,
        initialCommandMeta,
        idField,
        commandFamily,
        entityTypeKey,
        ctx,
        methodName
      )
    }
  }

  /** 确定初始化方法名称
    */
  private def determineInitializationMethodName(
      meta: AggregateRootMetadata
  ): String = {
    val aggNameBase = NamingConventions.getAggregateBaseName(meta.name)

    // 查找 Factory Metadata 中第一个带参数的方法名作为初始化方法名
    meta.factoryMethods
      .find(m => m.parameters.nonEmpty)
      .map(_.name)
      .getOrElse(s"create${aggNameBase}WithInitialValue") // 默认回退方法名
  }

  /** 构建带初始值的创建方法 (Ask 初始化)
    * 2026-08-21 摄入侧适配：初始化命令多参数（OnboardTenant/CreateConcept 等），
    * 工厂方法参数 = id + 全部业务参数，ask 时全量传递（原假设单业务参数）
    */
  private def buildCreateWithInitialMethod(
      meta: AggregateRootMetadata,
      cmdMeta: SubordinateCommandMetadata,
      idField: FieldDef,
      commandFamily: TypeRef,
      entityTypeKey: String,
      ctx: GeneratorContext,
      methodName: String
  ): FactoryMethodModel = {
    // 解析业务参数（排除 replyTo）
    // 2026-08-21 摄入侧适配：创建命令常携带同名 id 参数（String，如 CreateConcept.conceptId），
    // 与聚合标识（Id 类型）重名——命令参数含同名 id 时以其为准（工厂参数不再叠加 Id 参数），
    // 聚合定位 key 用同名参数值；无同名 id 时（bankingSystem 形态）idField 承担定位
    val businessParams = cmdMeta.parameters.filterNot(_.name == "replyTo")
    val hasIdParam = businessParams.exists(_.name == idField.name)
    val paramDefs = businessParams.map { p =>
      // Controller 三可选参根治批 2026-10-05：optional 参数方法签名翻 Option[T]=None（ask 直通命令 Option 字段）
      if (p.optional)
        FieldDef(p.name, TypeRef.Option(ctx.typeResolver.parameterType(p.parameterType)),
          defaultValue = Some("None"), noteId = p.noteId, description = p.description)
      else
        FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType), noteId = p.noteId, description = p.description)
    }
    val methodParams = if (hasIdParam) paramDefs else idField +: paramDefs

    // 解析回复类型
    val replyRef = cmdMeta.replyToType.getOrElse(
      throw new IllegalStateException(
        s"Command ${cmdMeta.name} must specify a reply type for factory initialization."
      )
    )
    val replyType =
      ctx.typeResolver.resolve(CommandReplyRef(replyRef.targetName))

    // 构建返回类型
    val entityRefType =
      ctx.knownFrameworkTypes("EntityRef").copy(typeParams = Seq(commandFamily))
    val eitherType = ctx.typeResolver.either(
      ctx.knownFrameworkTypes("iMadzError"),
      entityRefType
    )
    val returnType =
      ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(eitherType))

    // 生成方法体
    val cmdName = cmdMeta.name
    // ask 只传命令参数（含同名 id 时用参数值；无同名 id 时定位 key 由 entityRefFor 承担，不进 ask）
    val askParams = if (hasIdParam) methodParams else paramDefs
    val body = generateInitializationMethodBody(
      commandFamily,
      entityTypeKey,
      idField.name,
      cmdName,
      askParams,
      replyType
    )

    FactoryMethodModel(
      name = methodName,
      parameters = methodParams,
      returnType = returnType,
      bodyLogic = body,
      isInitialization = true
    )
  }

  /** 生成初始化方法体
    */
  private def generateInitializationMethodBody(
      commandFamily: TypeRef,
      entityTypeKey: String,
      idArgName: String,
      cmdName: String,
      paramDefs: Seq[FieldDef],
      replyType: TypeRef
  ): String = {
    val askArgs = (paramDefs.map(p => NamingConventions.scalaIdentifier(p.name)) :+ "_").mkString(", ")
    s"""|val entityRef: EntityRef[${commandFamily.name}] = clusterSharding
         |      .entityRefFor[${commandFamily.name}]($entityTypeKey, $idArgName.toString)
         |    for {
         |      confirmation <- entityRef.ask[${replyType.name}]($cmdName($askArgs))
         |    } yield {
         |      confirmation.error
         |        .map(Left.apply[iMadzError, EntityRef[${commandFamily.name}]])
         |        .getOrElse(Right(entityRef))
         |    }""".stripMargin
  }

  /** 收集所有依赖关系
    */
  private def collectDependencies(
      commandsType: Seq[TypeRef],
      repliesType: Seq[TypeRef],
      initMethodOpt: Option[FactoryMethodModel],
      refMethod: FactoryMethodModel,
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    // 基础依赖（当前为空）
    val commonDeps = Set.empty[TypeRef]

    // 初始化方法相关依赖
    val initDeps = initMethodOpt.toSet.flatMap { (method: FactoryMethodModel) =>
      method.parameters.flatMap(_.typeRef.collectAllDependencies) ++
        method.returnType.collectAllDependencies ++
        Set(
          ctx.knownFrameworkTypes("Future"),
          ctx.knownFrameworkTypes("Either"),
          ctx.knownFrameworkTypes("iMadzError")
        )
    }

    // 裸引用方法（createXxxWithoutBalance）：参数（identifier 类型 Id）+ 返回 EntityRef[CommandFamily] 都要进 import
    val refDeps = refMethod.parameters.flatMap(_.typeRef.collectAllDependencies) ++
      refMethod.returnType.collectAllDependencies

    // 过滤需要导入的依赖
    (commandsType.toSet ++ repliesType.toSet ++ commonDeps ++ initDeps ++ refDeps)
      .filter(_.shouldImport(pkg))
  }
}
