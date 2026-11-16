package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.persistence

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence.{
  AdapterMapping,
  AdapterModel
}
import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object AggregateAdapterBuilder {

  def buildEventAdapter(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AdapterModel = {
    val selfType = ctx.typeResolver.aggregateEventAdapter(meta)

    // [FIX] 使用 metaRegistry 解析元数据，而不是 TypeResolver
    val eventFamily = ctx.metaRegistry
      .resolve[EventFamilyMetadata](meta.eventFamilyRef)
      .getOrElse(
        throw new RuntimeException(
          s"Critical Error: Cannot resolve EventFamily Metadata for ${meta.eventFamilyRef.targetName}"
        )
      )

    // 1. Root Types
    // Domain Root Interface (e.g. CreditBalanceEvent)
    val scalaRootType = ctx.typeResolver.scalaRootType(
      eventFamily.name,
      s"${ctx.layout.domain.entities.root}.${meta.entityRef.targetName}"
    )

    // Proto Root OneOf Wrapper (e.g. CreditBalanceEventPO.Event)
    val protoRootType = ctx.typeResolver.protoEventFamily(meta.name, ctx)
    val outerProto = ctx.typeResolver.protoEvent(meta.name, ctx)

    // 2. Converter Trait (e.g. CreditBalanceProtoConverters)
    val converterTrait = ctx.typeResolver.aggregateProtoConverter(meta)

    // 3. Mappings
    val mappings = eventFamily.events.map { evt =>
      AdapterMapping(
        scalaCaseName = evt.name,
        // scalapb oneof case objects are PascalCase over the proto field's
        // underscore segments; event names like "result_succeeded" resolve to
        // Event.ResultSucceeded, so the reference must be derived, not verbatim.
        protoOneOfName = Some(pascalCaseOf(evt.name)),
        protoMessageName = s"${evt.name}PO",
        fields = Nil // 委托给 Converter，无需字段映射
      )
    }

    // 收集 Domain Event 类型依赖
    val domainEventTypes = eventFamily.events.map { evt =>
      ctx.typeResolver.domainEvent(
        evt.name,
        s"${ctx.layout.domain.entities.root}.${meta.entityRef.targetName}"
      )
    }

    val frameworkDeps = Set(
      ctx.typeResolver.eventAdapter,
      ctx.typeResolver.eventSeq
    )

    AdapterModel(
      selfType = selfType,
      scalaRootType = scalaRootType,
      protoRootType = protoRootType,
      mappings = mappings,
      converterTrait = converterTrait,
      converters = Nil,
      isSnapshot = false,
      dependencies = frameworkDeps ++ Set(
        scalaRootType,
        protoRootType,
        outerProto,
        converterTrait
      ) ++ domainEventTypes,
      // S7（EP §二 G1）：adapter 知识身份＝**聚合号**（事件适配器是聚合事件族的派生容器）
      noteIds = meta.noteId.toSeq
    )
  }

  def buildSnapshotAdapter(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AdapterModel = {
    val selfType = ctx.typeResolver.aggregateSnapshotAdapter(meta)

    // [FIX] 使用 metaRegistry 解析元数据
    val stateMeta = ctx.metaRegistry
      .resolve[ValueObjectMetadata](meta.stateRef)
      .getOrElse(
        throw new RuntimeException(
          s"Critical Error: Cannot resolve State Metadata for ${meta.stateRef.targetName}"
        )
      )

    // [FIX] 智能判断 State 包路径 (支持嵌套在 Entity 中)
    val entityMeta =
      ctx.metaRegistry.resolve[DomainEntityMetadata](meta.entityRef)
    val statePkg = entityMeta match {
      case Some(e) if e.state.name == stateMeta.name =>
        s"${ctx.layout.domain.entities.root}.${meta.entityRef.targetName}"
      case _ =>
        val relative = getPackageName(stateMeta.fullQualifiedName)
        if (relative.isEmpty) ctx.basePackage
        else s"${ctx.basePackage}.$relative"
    }

    // Domain State
    val scalaRootType =
      ctx.typeResolver.scalaStateType(stateMeta.name, statePkg)

    // Proto Root OneOf Wrapper (e.g. CreditBalanceStatePO)
    val protoRootType = ctx.typeResolver.protoState(meta.name, ctx)

    val converterTrait = ctx.typeResolver.aggregateProtoConverter(meta)

    val mapping = AdapterMapping(
      scalaCaseName = stateMeta.name,
      protoOneOfName = None,
      protoMessageName = s"${stateMeta.name}PO",
      fields = Nil
    )

    val frameworkDeps = Set(ctx.typeResolver.snapshotAdapter)

    AdapterModel(
      selfType = selfType,
      scalaRootType = scalaRootType,
      protoRootType = protoRootType,
      mappings = Seq(mapping),
      converterTrait = converterTrait,
      converters = Nil,
      isSnapshot = true,
      dependencies =
        frameworkDeps ++ Set(scalaRootType, protoRootType, converterTrait),
      // S7（EP §二 G1）：快照适配器知识身份＝**聚合号**（state 快照同样是聚合的派生容器）
      noteIds = meta.noteId.toSeq
    )
  }

  private def getPackageName(fqn: FullQualifiedName): String = {
    val path = fqn.dottedPath
    if (path.contains('.')) path.substring(0, path.lastIndexOf('.'))
    else ""
  }

  /** scalapb case-object naming: PascalCase over the proto field's `_`/`-`
    * segments. Names without separators round-trip unchanged. */
  private def pascalCaseOf(name: String): String =
    name.split("[-_]").filter(_.nonEmpty).map(s => s.charAt(0).toUpper + s.tail).mkString
}
