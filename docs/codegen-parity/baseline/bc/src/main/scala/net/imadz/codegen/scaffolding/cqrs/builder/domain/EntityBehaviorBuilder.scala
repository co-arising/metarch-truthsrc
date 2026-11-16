package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.{
  EntityBehaviorModel,
  MethodModel,
  StateMutationModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta.{
  BusinessLogic,
  DomainEntityMetadata,
  EntityBehaviorMetadata,
  EntityBehaviorRef,
  EventFamilyRef,
  EventStateMutation,
  MethodMetadata,
  StructRef
}
import net.imadz.meta._

object EntityBehaviorBuilder {

  def build(
      meta: EntityBehaviorMetadata,
      ctx: GeneratorContext
  ): EntityBehaviorModel = {
    val behaviorPkg = ctx.layout.domain.entities.behaviors

    // [NEW] Resolve Owning Entity first
    val entityMeta = resolveOwningEntity(meta, ctx)

    // 解析自类型
    val selfType = resolveSelfType(meta, ctx, behaviorPkg)

    // 解析处理程序别名引用 (Point to Entity.EventHandlerAlias)
    val handlerAliasRef = resolveHandlerAliasRef(meta, entityMeta, ctx)

    // [NEW] 解析 State 类型 (通过反向查找所属 Entity)
    val (stateType, eventFamilyType) = resolveStateAndEventFamilyType(entityMeta, ctx)

    // 构建状态变更模型（P4：真源 foldAssignments 在场时发射真实折叠代码）
    val (mutations, foldDeps) = buildStateMutations(meta, entityMeta, ctx)

    // 构建辅助方法模型
    val helpers = buildHelperMethods(meta, ctx)

    // 收集并过滤依赖
    val dependencies =
      collectDependencies(
        handlerAliasRef,
        stateType,
        eventFamilyType,
        mutations,
        helpers,
        ctx,
        behaviorPkg
      ) ++ foldDeps.filter(_.shouldImport(behaviorPkg))

    EntityBehaviorModel(
      selfType,
      handlerAliasRef,
      stateType,
      eventFamilyType,
      mutations,
      helpers,
      dependencies
    )
  }

  private def resolveOwningEntity(
      meta: EntityBehaviorMetadata,
      ctx: GeneratorContext
  ): DomainEntityMetadata = {
    ctx.metaRegistry
      .resolveAll[DomainEntityMetadata]
      .find(_.eventFamily.name == meta.eventFamilyRef.targetName)
      .getOrElse(
        throw new RuntimeException(
          s"Cannot find owning DomainEntity for behavior: ${meta.name} (EventFamily: ${meta.eventFamilyRef.targetName})"
        )
      )
  }

  /** 解析 State 类型 和 EventFamily 类型
    */
  private def resolveStateAndEventFamilyType(
      entityMeta: DomainEntityMetadata,
      ctx: GeneratorContext
  ): (TypeRef, TypeRef) = {
    (
      ctx.typeResolver.entityState(EntityStateRef(entityMeta.state.name)),
      ctx.typeResolver.eventFamily(EventFamilyRef(entityMeta.eventFamily.name))
    )
  }

  /** 解析实体行为的自类型
    */
  private def resolveSelfType(
      meta: EntityBehaviorMetadata,
      ctx: GeneratorContext,
      behaviorPkg: String
  ): TypeRef = {
    ctx.typeResolver.entityBehaviorSelf(meta.name, behaviorPkg)
  }

  /** 解析处理程序别名引用 (指向 Entity 定义的类型别名)
    */
  private def resolveHandlerAliasRef(
      meta: EntityBehaviorMetadata,
      entityMeta: DomainEntityMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    // 1. 根据 EventFamily 推导 Alias 名称 (需与 EntityTemplate 逻辑一致)
    val efName = meta.eventFamilyRef.targetName
    val baseName = if (efName.endsWith("Event")) efName.dropRight(5) else efName
    val aliasName = baseName + "EventHandler"

    // 2. 获取 Entity Object 的完整包路径 (pkg + objectName)
    val entityObjectPath = ctx.typeResolver.entityObjectPath(entityMeta.name, ctx)

    // 3. 构建引用
    TypeRef(aliasName, entityObjectPath)
  }

  /** 构建状态变更模型列表。P4 状态深化：真源 foldAssignments（FormalFold 结构化 op 行）
    * 全行可机械解析时发射真实折叠代码（state.copy(...)）；任一行不可解析（param.* 等
    * 命令侧表达式在回放面无源）＝该事件回退恒等折叠并注记——不猜。 */
  private def buildStateMutations(
      meta: EntityBehaviorMetadata,
      entityMeta: DomainEntityMetadata,
      ctx: GeneratorContext
  ): (Seq[StateMutationModel], Set[TypeRef]) = {
    val stateFieldTypes = entityMeta.state.fields.map(f => f.name -> f.fieldType).toMap
    val aggSemantics = ctx.formalSemantics.toVector
      .flatMap(_.aggregates.find(a => a.aggregate == entityMeta.name.stripSuffix("Entity"))).headOption
    val foldsByBase: Map[String, net.imadz.meta.filesystem.FormalFold] = aggSemantics
      .map(_.folds.map(f => (f.event.replace('-', '_'), f)).toMap)
      .getOrElse(Map.empty)
    val deps = scala.collection.mutable.Set.empty[TypeRef]
    val mutations = meta.handlers.map { handler =>
      val eventType = resolveEventType(handler.eventRef.targetName, ctx)
      val fold = foldsByBase.get(handler.eventRef.targetName)
      val collectionFold = fold.filter(_.assignments.exists(r => Set("put-all", "remove-all").contains(r.op)))
      collectionFold.foreach { f =>
        val event = entityMeta.eventFamily.events.find(_.name == eventType.name).get
        val eventNames = event.fields.map(_.name).toSet
        f.assignments.foreach { row =>
          require(stateFieldTypes.contains(row.slot), "collection fold state slot missing")
          require(Set("put", "remove", "put-all", "remove-all").contains(row.op), "unsupported collection fold op")
          (row.key.toVector ++ row.value.toVector).foreach { expr =>
            require(expr.startsWith("literal:") || (expr.startsWith("event.") && eventNames.contains(expr.drop(6))), "collection fold expression missing")
          }
        }
      }
      val rendered = if (collectionFold.isDefined) None else fold.flatMap(f => renderFold(f, eventType, stateFieldTypes, entityMeta, ctx, deps))
      val logicCode = rendered.getOrElse(generateMutationLogicCode(handler.logic))
      StateMutationModel(eventType, logicCode, collectionFold.map(_.assignments).getOrElse(Vector.empty))
    }
    (mutations, deps.toSet)
  }

  /** 结构化折叠行 → 可编译折叠代码（回放安全的 (state, event) 纯函数体）。
    * money-apply 语义＝金主 updateAccountBalance：key=delta.currency，existing-or-zero + delta。 */
  private def renderFold(
      fold: net.imadz.meta.filesystem.FormalFold,
      eventType: TypeRef,
      stateFieldTypes: Map[String, net.imadz.meta.MetaType],
      entityMeta: DomainEntityMetadata,
      ctx: GeneratorContext,
      deps: scala.collection.mutable.Set[TypeRef]
  ): Option[String] = {
    val eventFields = entityMeta.eventFamily.events
      .find(_.name == eventType.name).map(_.fields.map(f => f.name -> f.fieldType).toMap)
      .getOrElse(Map.empty[String, net.imadz.meta.MetaType])
    def moneyShape(t: net.imadz.meta.MetaType): Option[TypeRef] = t match {
      case StructRef(name) =>
        ctx.metaRegistry.resolveByName[ValueObjectMetadata](name)
          .filter(vo => vo.fields.map(_.name).toSet == Set("minorUnits", "currency"))
          .map(_ => ctx.typeResolver.resolve(t))
      case _ => None
    }
    def exprCode(expr: String): Option[String] =
      if (expr.startsWith("event.")) {
        val f = expr.stripPrefix("event.")
        if (eventFields.contains(f)) Some(s"event.$f") else None
      } else if (expr.startsWith("literal:")) {
        Some("\"" + expr.stripPrefix("literal:").replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
      } else if (expr.startsWith("state.") && expr.endsWith("]") && expr.contains("[")) {
        // state.f[<inner>] 索引读：守卫 map-contains 保证存在 → 直接 apply
        val m = "^state\\.([A-Za-z0-9_-]+)\\[(param|event)\\.([A-Za-z0-9_-]+)\\]$".r
        m.findFirstMatchIn(expr).flatMap { mm =>
          val (f, src, k) = (mm.group(1), mm.group(2), mm.group(3))
          if (!stateFieldTypes.contains(f)) None
          else {
            val key = if (src == "event") eventFields.get(k).map(_ => s"event.$k") else None // param.* 在回放面无源
            key.map(kc => s"state.$f($kc)")
          }
        }
      } else None
    def exprType(expr: String): Option[net.imadz.meta.MetaType] =
      if (expr.startsWith("event.")) eventFields.get(expr.stripPrefix("event."))
      else if (expr.startsWith("state.") && expr.endsWith("]") && expr.contains("[")) {
        val f = expr.drop(6).takeWhile(_ != '[')
        stateFieldTypes.get(f).flatMap {
          case CustomType(_, _, args) if args.size == 2 => Some(args(1))
          case _ => None
        }
      } else None
    val rows = fold.assignments.map { r =>
      (r.op, r.expr, r.key, r.value, r.delta, r.sign) match {
        case ("set", Some(expr), _, _, _, _) =>
          for { slot <- fieldSlot(r.slot, stateFieldTypes); code <- exprCode(expr) }
            yield s"$slot = $code"
        case ("put", _, Some(key), Some(value), _, _) =>
          for { slot <- fieldSlot(r.slot, stateFieldTypes); kc <- exprCode(key); vc <- exprCode(value) }
            yield s"$slot = state.$slot + ($kc -> $vc)"
        case ("remove", _, Some(key), _, _, _) =>
          for { slot <- fieldSlot(r.slot, stateFieldTypes); kc <- exprCode(key) }
            yield s"$slot = state.$slot - $kc"
        case ("money-apply", _, _, _, Some(delta), Some(sign)) =>
          exprType(delta).flatMap(dt => moneyShape(dt).flatMap { money =>
            for {
              slot <- fieldSlot(r.slot, stateFieldTypes)
              dc <- exprCode(delta)
            } yield {
              deps += money
              deps += TypeRef("MoneyOps", "net.imadz.common")
              s"""$slot = {
                 |            val key = $dc.currency
                 |            val current = state.$slot.getOrElse(key, ${money.name}("0", key))
                 |            state.$slot.updated(key, current.copy(minorUnits = MoneyOps.shift(current.minorUnits, $dc.minorUnits, $sign)))
                 |          }""".stripMargin
            }
          })
        case _ => None
      }
    }
    if (rows.exists(_.isEmpty) || rows.isEmpty) None
    else Some(s"state.copy(\n        ${rows.flatten.mkString(",\n        ")}\n      )")
  }

  /** 折叠槽位必须是声明的状态字段（fail-closed）。 */
  private def fieldSlot(slot: String, stateFieldTypes: Map[String, net.imadz.meta.MetaType]): Option[String] =
    if (stateFieldTypes.contains(slot)) Some(slot) else None

  /** 解析事件类型
    */
  private def resolveEventType(
      eventName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.resolve(StructRef(eventName))
  }

  /** 生成变更逻辑代码
    */
  private def generateMutationLogicCode(logic: BusinessLogic): String = {
    logic.referenceCode.getOrElse(s"""// TODO: ${logic.intent}
       |      state
       |""".stripMargin)
  }

  /** 构建辅助方法模型列表
    */
  private def buildHelperMethods(
      meta: EntityBehaviorMetadata,
      ctx: GeneratorContext
  ): Seq[MethodModel] = {
    meta.helperMethods.map { methodMeta =>
      val params = buildMethodParameters(methodMeta, ctx)
      val returnType = resolveReturnType(methodMeta, ctx)
      val logicCode = generateHelperMethodLogic(methodMeta.logic)
      MethodModel(methodMeta.name, params, returnType, logicCode)
    }
  }

  /** 构建方法参数定义
    */
  private def buildMethodParameters(
      methodMeta: MethodMetadata,
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    methodMeta.parameters.map(p =>
      FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description)
    )
  }

  /** 解析返回类型
    */
  private def resolveReturnType(
      methodMeta: MethodMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.resolve(methodMeta.returnType)
  }

  /** 生成辅助方法逻辑代码
    */
  private def generateHelperMethodLogic(
      logic: Either[String, BusinessLogic]
  ): String = {
    logic.fold(
      err => s"// Error: $err",
      l => l.referenceCode.getOrElse(s"// TODO: ${l.intent}")
    )
  }

  /** 收集并过滤依赖
    */
  private def collectDependencies(
      handlerAliasRef: TypeRef,
      stateType: TypeRef,
      eventFamilyType: TypeRef,
      mutations: Seq[StateMutationModel],
      helpers: Seq[MethodModel],
      ctx: GeneratorContext,
      behaviorPkg: String
  ): Set[TypeRef] = {
    val handlerDeps = handlerAliasRef.collectAllDependencies
    val stateDeps = stateType.collectAllDependencies
    val eventFamilyDeps = eventFamilyType.collectAllDependencies
    val mutationDeps = collectMutationDependencies(mutations)
    val helperDeps = collectHelperDependencies(helpers)

    val allDeps =
      handlerDeps ++ stateDeps ++ eventFamilyDeps ++ mutationDeps ++ helperDeps
    allDeps.filter(_.shouldImport(behaviorPkg))
  }

  /** 收集状态变更的依赖
    */
  private def collectMutationDependencies(
      mutations: Seq[StateMutationModel]
  ): Set[TypeRef] = {
    mutations.flatMap(_.eventType.collectAllDependencies).toSet
  }

  /** 收集辅助方法的依赖
    */
  private def collectHelperDependencies(
      helpers: Seq[MethodModel]
  ): Set[TypeRef] = {
    helpers.flatMap { helper =>
      helper.returnType.collectAllDependencies ++ helper.params.flatMap(
        _.typeRef.collectAllDependencies
      )
    }.toSet
  }
}
