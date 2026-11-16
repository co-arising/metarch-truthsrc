package net.imadz.codegen.scaffolding.cqrs

import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object TypeResolver {

  /** EP_Field_Nature_And_Concern_Anchors（2026-09-18·用户拍板乙路）：可选字段类型解析。
    *
    * 真源 `optional: true` 的成员 → `scala.Option[T]`——使「该成员可缺席」成为一等公民
    * （`None` ≠ 空串），并换取旧投影行零重放兼容（play-json 宏对缺失键：裸类型 JsError，
    * Option 解出 None）。命令参数的可选性另由 ControllerBuilder 处理（不经此）。
    */
  def resolveField(dt: MetaType, optional: Boolean, ctx: GeneratorContext): TypeRef = {
    val base = resolve(dt, ctx)
    if (optional) TypeRef("Option", "scala", Seq(base)) else base
  }

  def resolve(dt: MetaType, ctx: GeneratorContext): TypeRef = dt match {
    case StringType     => TypeRef.String
    case IntType        => TypeRef.Int
    case LongType       => TypeRef.Long
    case BooleanType    => TypeRef.Boolean
    case UnitType       => TypeRef.Unit
    case DoubleType     => TypeRef.Double
    case BigDecimalType => TypeRef("BigDecimal", "scala.math")

    // References
    // [FIX] EntityState is generated as a separate ValueObject artifact.
    // So we must resolve it as a ValueObject, not a nested type of the Entity.
    // Use entityState resolver to preserve the "State" suffix in the type name.
    case EntityStateRef(targetName) => ctx.typeResolver.entityState(targetName)
    case EventFamilyRef(targetName) => resolveNestedType(targetName, ctx)
    case EventRef(targetName)       => resolveNestedType(targetName, ctx)
    case CommandFamilyRef(targetName) =>
      ctx.typeResolver.commandFamily(targetName)
    case CommandReplyRef(targetName) =>
      ctx.typeResolver.commandReply(targetName)
    case CommandRef(targetName)        => ctx.typeResolver.command(targetName)
    case EntityBehaviorRef(targetName) => TypeRef(targetName, ctx.layout.domain.entities.behaviors)

    case AggregateRef(name)         => ctx.typeResolver.aggregateRoot(name)
    case EntityRef(name)            => ctx.typeResolver.entity(name)
    case InvariantRuleRef(name)     => ctx.typeResolver.invariantRule(name)
    case AggregateBehaviorRef(name) => ctx.typeResolver.aggregateBehavior(name)
    case AggregateRepositoryRef(name) =>
      ctx.typeResolver.aggregateRepository(name)
    case ProjectionRepositoryRef(name) =>
      ctx.typeResolver.projectionRepository(name)
    case ApplicationServiceRef(name) =>
      ctx.typeResolver.applicationService(name)
    case QueryServiceRef(name)  => ctx.typeResolver.queryService(name)
    case DomainServiceRef(name) => ctx.typeResolver.domainService(name)
    case ValueObjectRef(name)   => ctx.typeResolver.valueObject(name)
    case ControllerRef(name)    => ctx.typeResolver.controller(name)

    // Structs / VOs
    case StructRef(name) =>
      ctx.symbolTable.resolve(NestedTypeName(name)) match {
        case Some(owner) =>
          resolveNestedType(name, ctx)
        case None =>
          TypeRef(name, ctx.layout.domain.values.root)
      }

    case CustomType(name, pkg, typeArgs) =>
      // 先检查是否是已知框架类型 (如 Future, List)
      ctx.knownFrameworkTypes.get(name) match {
        case Some(knownType) =>
          // 递归 resolve 泛型参数
          val resolvedArgs = typeArgs.map(arg => resolve(arg, ctx))
          knownType.copy(typeParams = resolvedArgs)
        case None =>
          // 2026-08-21 摄入侧适配：DataTypeMapper 硬编码默认包 'net.imadz.domain.values'（无 module 段），
          // 重写为当前模块的领域值包（net.imadz.<module>.domain.values），否则 import 悬空
          val effectivePkg =
            if (pkg == "net.imadz.domain.values") ctx.layout.domain.values.root else pkg
          // 未知类型，按原样递归
          TypeRef(name, effectivePkg, typeArgs.map(resolve(_, ctx)))
      }
    case r: MetaRef =>
      resolveMetaRef(r, ctx)

    // [FIX] Support resolving Metadata objects directly
    case m: DomainEntityMetadata  => resolve(EntityRef(m.name), ctx)
    case m: AggregateRootMetadata => resolve(AggregateRef(m.name), ctx)
    case m: ValueObjectMetadata   => resolve(ValueObjectRef(m.name), ctx)
    // Add other metadata types if needed, but these are the ones used in InvariantRuleBuilder

    case _ => TypeRef("Any", "")
  }

  private def resolveMetaRef(r: MetaRef, ctx: GeneratorContext): TypeRef = ???

  private def resolveNestedType(
      name: String,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.symbolTable.resolve(NestedTypeName(name)) match {
      case Some(OwnerEntityName(ownerName)) =>
        val ownerMeta =
          ctx.metaRegistry.resolveByName[DomainDrivenMetadata](ownerName)
        // 根据元数据类型决定包路径和Owner名称
        val (pkg, finalOwnerName) = ownerMeta match {
          case Some(_: AggregateRootMetadata) =>
            (
              ctx.layout.application.aggregates.root,
              NamingConventions.aggregateRootName(
                NamingConventions.getBaseName(ownerName)
              )
            )
          case Some(_: SagaTransactorMetadata) =>
            (ctx.layout.application.services.transactor.root, NamingConventions.getBaseName(ownerName))
          case Some(_: DomainEntityMetadata) =>
            (
              ctx.layout.domain.entities.root,
              NamingConventions.domainEntityName(
                NamingConventions.getBaseName(ownerName)
              )
            )
          // 支持 QueryService，确保添加 Query 后缀
          case Some(_: QueryServiceMetadata) =>
            (
              ctx.layout.application.queries.root,
              NamingConventions.queryServiceName(
                NamingConventions.getBaseName(ownerName)
              )
            )

          case _ =>
            // 兜底逻辑
            val p =
              if (ownerName.endsWith("Aggregate"))
                ctx.layout.application.aggregates.root
              else if (
                ownerName.endsWith("Transactor") || ownerName.endsWith("Saga")
              ) ctx.layout.application.services.transactor.root
              else if (
                ownerName.endsWith("Service") || ownerName.endsWith("Query")
              ) ctx.layout.application.queries.root
              else ctx.layout.domain.entities.root
            (p, NamingConventions.getBaseName(ownerName))
        }
        TypeRef(name, s"$pkg.$finalOwnerName")
      case None =>
        // Fallback to ValueObject
        TypeRef(name, ctx.layout.domain.values.root)
    }
  }
}
