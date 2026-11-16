package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta._

object AggregateRootBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateRootModel = {
    // 1. 确定包名
    val pkg = ctx.layout.application.aggregates.root
    val selfType = ctx.typeResolver.aggregateRoot(meta.name)

    // 2. 解析 Wiring (State, Event, Behavior)
    // [Refactor] 移除所有 .replace 逻辑，直接解析显式引用！

    // 使用DSL风格的typeResolver提高可读性和类型安全性
    val stateType = ctx.typeResolver.entityState(meta.stateRef)
    val eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef)
    val behaviorObject = ctx.typeResolver.entityBehavior(meta.behaviorRef)

    // 3. Command Family (Ref from Protocol)
    val commandFamilyType =
      ctx.typeResolver.commandFamily(meta.commandFamily.name)

    // 4. Sharding Metadata (Requires Command Name)
    val (name, count) = meta.persistenceConfig.tagging match {
      case s: ShardedTags => (s.baseName, s.numberOfShards)
      // 如果未来有其他策略没有 baseName，需要在这里处理，例如提供默认值或抛出异常
      case _ =>
        throw new IllegalArgumentException(
          "Unsupported tagging strategy or missing baseName"
        )
    }

    // 5. Sharding 配置
    val sharding = ShardingModel(
      typeKeyName = meta.persistenceConfig.entityTypeKey,
      taggingBaseName = name,
      shardCount = count
    )

    // 6. 依赖收集
    val deps =
      stateType.collectAllDependencies ++
        eventType.collectAllDependencies ++
        behaviorObject.collectAllDependencies ++
        behaviorObject.collectAllDependencies ++
        Set(commandFamilyType) ++ // Add Command Protocol Dependency
        Set(
          ctx.knownFrameworkTypes("Effect"),
          ctx.knownFrameworkTypes("EntityTypeKey")
        ) // Akka 基础设施

    // 过滤同包依赖
    val dependencies = deps.filter(_.shouldImport(pkg))

    AggregateRootModel(
      selfType = selfType,
      commandFamilyType = commandFamilyType,
      stateType = stateType,
      eventType = eventType,
      behaviorObject = behaviorObject,
      sharding = sharding,
      inlineEvents = Nil,
      inlineState = None,
      stepsFactory = None,
      dependencies = dependencies,
      noteIds = meta.noteId.toSeq
    )
  }
}
