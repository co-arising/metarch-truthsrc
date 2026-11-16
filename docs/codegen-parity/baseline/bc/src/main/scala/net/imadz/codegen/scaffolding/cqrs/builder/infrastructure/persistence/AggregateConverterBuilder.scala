package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.persistence

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence.{
  AggregateConverterModel,
  ConverterDef
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object AggregateConverterBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateConverterModel = {
    val selfType = resolveSelfType(meta, ctx)
    val primitiveConverter = ctx.typeResolver.primitiveConverter
    val protoPackage = resolveProtoPackage(meta, ctx)

    // 解析元数据
    val stateMeta = resolveStateMetadata(meta, ctx)
    val eventFamily = resolveEventFamilyMetadata(meta, ctx)
    val entityMeta = resolveDomainEntityMetadata(meta, ctx)

    // 收集依赖的值对象
    val dependentVOs = collectDependentValueObjects(stateMeta, eventFamily, ctx)

    // 构建各种转换器
    val voConverters =
      buildValueObjectConverters(dependentVOs, protoPackage, ctx)
    val eventPackage = resolveEventPackage(entityMeta, ctx)
    val eventConverters =
      buildEventConverters(eventFamily, eventPackage, protoPackage, ctx)
    val stateDomainPkg = resolveStateDomainPackage(entityMeta, stateMeta, ctx)
    val stateConverter =
      buildStateConverter(stateMeta, stateDomainPkg, protoPackage, ctx)

    // 收集并过滤依赖
    val allConverters = voConverters ++ eventConverters ++ Seq(stateConverter)
    val dependencies = collectDependencies(allConverters, primitiveConverter)

    AggregateConverterModel(
      selfType,
      primitiveConverter,
      voConverters,
      eventConverters,
      Some(stateConverter),
      dependencies,
      // S7（EP §二 G1）：converter 知识身份＝**聚合号**（事件/状态转换器是聚合的派生容器）
      noteIds = meta.noteId.toSeq
    )
  }

  /** 解析转换器的自类型
    */
  private def resolveSelfType(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): TypeRef = ctx.typeResolver.aggregateProtoConverter(meta)

  /** 解析Protocol Buffers包名
    */
  private def resolveProtoPackage(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): String = ctx.layout.infrastructure.proto.eventPackage(meta.name)

  /** 解析状态元数据
    */
  private def resolveStateMetadata(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): ValueObjectMetadata = {
    ctx.metaRegistry
      .resolve[ValueObjectMetadata](meta.stateRef)
      .getOrElse(
        throw new RuntimeException(
          s"Critical Error: Cannot resolve State Metadata for ${meta.stateRef.targetName}"
        )
      )
  }

  /** 解析事件族元数据
    */
  private def resolveEventFamilyMetadata(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): EventFamilyMetadata = {
    ctx.metaRegistry
      .resolve[EventFamilyMetadata](meta.eventFamilyRef)
      .getOrElse(
        throw new RuntimeException(
          s"Critical Error: Cannot resolve EventFamily Metadata for ${meta.eventFamilyRef.targetName}"
        )
      )
  }

  /** 解析领域实体元数据
    */
  private def resolveDomainEntityMetadata(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Option[DomainEntityMetadata] = {
    ctx.metaRegistry.resolve[DomainEntityMetadata](meta.entityRef)
  }

  /** 收集依赖的值对象
    */
  private def collectDependentValueObjects(
      stateMeta: ValueObjectMetadata,
      eventFamily: EventFamilyMetadata,
      ctx: GeneratorContext
  ): Set[ValueObjectMetadata] = {
    // 递归依赖扫描
    val roots = stateMeta.fields.map(_.fieldType) ++ eventFamily.events.flatMap(
      _.fields.map(_.fieldType)
    )

    ctx
      .collectDeepDependencies[ValueObjectMetadata](roots)
      .filterNot(_.name == stateMeta.name)
      .filterNot(vo => Set("Id", "Currency").contains(vo.name))
  }

  /** 获取绝对领域包名
    */
  private def getAbsoluteDomainPackage(
      fqn: FullQualifiedName,
      ctx: GeneratorContext
  ): String = {
    val relativePkg = getPackageName(fqn)
    if (relativePkg.isEmpty) ctx.basePackage
    else s"${ctx.basePackage}.$relativePkg"
  }

  /** 获取包名
    */
  private def getPackageName(fqn: FullQualifiedName): String = {
    val path = fqn.dottedPath
    if (path.contains('.')) path.substring(0, path.lastIndexOf('.'))
    else ""
  }

  /** 解析 VO 包名 (如果是 Entity State，则指向 Entity Object)
    */
  private def resolveVOPackage(vo: ValueObjectMetadata, ctx: GeneratorContext): String = {
    val owningEntity = ctx.metaRegistry
      .resolveAll[DomainEntityMetadata](scala.reflect.classTag[DomainEntityMetadata])
      .find(_.state.name == vo.name)

    owningEntity match {
      case Some(e) => ctx.typeResolver.entityObjectPath(e.name, ctx)
      case None    => getAbsoluteDomainPackage(vo.fullQualifiedName, ctx)
    }
  }

  /** 构建值对象转换器
    *
    * S2-82-B2 修正：VO PO 的定义在**宿主聚合**的 proto 文件（voOwnerMap 判定·跨聚合共享 VO
    * 只定义一次），poType 须按宿主聚合包解析——旧逻辑恒用本聚合包，宿主迁移后 import 落空
    * （wave2 F5：KnowledgePatchProtoConverters 找不到 CatalogConflictSetPO/CatalogConflictPO）。
    * 共享 VO（属主空串）→ `proto.root.shared_value_objects` 段（与 shared_value_objects.proto
    * 的 scala 出包一致·2026-09-22 staging 逐字节对账）；无宿主记录的 VO 回退本聚合包。
    */
  private def buildValueObjectConverters(
      dependentVOs: Set[ValueObjectMetadata],
      protoPackage: String,
      ctx: GeneratorContext
  ): Seq[ConverterDef] = {
    val protoBuilder =
      net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto.AggregateRootProtoBuilder
    val voOwners = protoBuilder.voOwnerMap(ctx)
    val sharedVoNames = protoBuilder
      .buildShared(ctx)
      .map(_.messages.map(_.name.stripSuffix("PO")).toSet)
      .getOrElse(Set.empty)
    dependentVOs.toSeq.sortBy(_.name).map { vo =>
      val domainPkg = resolveVOPackage(vo, ctx)
      val hostPkg =
        if (sharedVoNames.contains(vo.name))
          s"${ctx.layout.infrastructure.proto.root}.shared_value_objects"
        else
          voOwners.get(vo.name) match {
            case Some(host) if host.nonEmpty =>
              ctx.layout.infrastructure.proto.eventPackage(host)
            case _ => protoPackage
          }
      buildConverter(vo.name, vo.fields, domainPkg, hostPkg, ctx)
    }
  }

  /** 解析事件包名
    */
  private def resolveEventPackage(
      entityMeta: Option[DomainEntityMetadata],
      ctx: GeneratorContext
  ): String = {
    entityMeta match {
      case Some(e) => ctx.typeResolver.entityObjectPath(e.name, ctx)
      case None    => ctx.layout.domain.events.root
    }
  }

  /** 构建事件转换器
    */
  private def buildEventConverters(
      eventFamily: EventFamilyMetadata,
      eventPackage: String,
      protoPackage: String,
      ctx: GeneratorContext
  ): Seq[ConverterDef] = {
    eventFamily.events.map { evt =>
      buildConverter(evt.name, evt.fields, eventPackage, protoPackage, ctx)
    }
  }

  /** 解析状态领域包名
    */
  private def resolveStateDomainPackage(
      entityMeta: Option[DomainEntityMetadata],
      stateMeta: ValueObjectMetadata,
      ctx: GeneratorContext
  ): String = {
    entityMeta match {
      case Some(e) if e.state.name == stateMeta.name =>
        // [FIXED] 将 Entity Object Name 拼接到包名中，生成正确的嵌套导入
        ctx.typeResolver.entityObjectPath(e.name, ctx)
      case _ =>
        getAbsoluteDomainPackage(stateMeta.fullQualifiedName, ctx)
    }
  }

  /** 构建状态转换器
    */
  private def buildStateConverter(
      stateMeta: ValueObjectMetadata,
      stateDomainPkg: String,
      protoPackage: String,
      ctx: GeneratorContext
  ): ConverterDef = {
    buildConverter(
      stateMeta.name,
      // EP Phase 3(a)：锚定排除的 nature 字段不进状态转换器（与 proto/实体列同步，否则读写端字段数不一致）
      stateMeta.fields.filterNot(ctx.isStateFieldExcluded),
      stateDomainPkg,
      protoPackage,
      ctx
    )
  }

  /** 构建转换器定义
    */
  private def buildConverter(
      name: String,
      fields: Seq[FieldMetadata],
      domainPkg: String,
      protoPkg: String,
      ctx: GeneratorContext
  ): ConverterDef = {
    val domainType = ctx.typeResolver.domainType(name, domainPkg)
    val poType = ctx.typeResolver.poType(
      NamingConventions.getProtoValueObjectPOName(name),
      protoPkg
    )

    val fieldDefs = fields.map { f =>
      // S4（EP_GenerationTime_Code_Anchors·D3 判例根修）：此前 `FieldDef` 不传 noteId ⇒
      // converter 面**结构性零锚**（用户点名面）。converter 产出是**方法体具名实参块**
      // （`XxxPO(field = …)`·无 case class），故锚走「注释行＋实参行」形态——
      // 模板在实参前发 `// @knowledge <id>`，推送侧按 `pkg.<对象>.<方法>` 收 FQN。
      FieldDef(f.name, net.imadz.codegen.scaffolding.cqrs.TypeResolver.resolveField(f.fieldType, f.optional, ctx),
        noteId = f.noteId)
    }

    ConverterDef(
      objectName = NamingConventions.getConverterObjectName(name),
      participantType = domainType,
      poType = poType,
      fields = fieldDefs,
      repository = None
    )
  }

  /** 收集并过滤依赖
    */
  private def collectDependencies(
      allConverters: Seq[ConverterDef],
      primitiveConverter: TypeRef
  ): Set[TypeRef] = {
    val fieldDeps =
      allConverters.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies))
    val domainDeps = allConverters.map(_.participantType)
    val protoDeps = allConverters.map(_.poType)

    val rawDeps =
      fieldDeps ++ domainDeps ++ protoDeps ++ Set(primitiveConverter)
    filterDependencies(rawDeps)
  }

  /** 过滤无效的依赖
    */
  private def filterDependencies(rawDeps: Seq[TypeRef]): Set[TypeRef] = {
    rawDeps.filterNot { d =>
      d.packageName == "java.lang" ||
      d.packageName == "scala" ||
      d.packageName.isEmpty ||
      Set("String", "Long", "Int", "Double", "Boolean", "Unit", "Any").contains(
        d.name
      )
    }.toSet
  }
}
