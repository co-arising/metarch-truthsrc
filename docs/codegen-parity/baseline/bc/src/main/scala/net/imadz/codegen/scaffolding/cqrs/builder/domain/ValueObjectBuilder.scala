package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.ValueObjectModel
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta.{FieldMetadata, ValueObjectMetadata}

object ValueObjectBuilder {
  // 这就是唯一的入口：Meta + Context -> Model
  def build(
      meta: ValueObjectMetadata,
      ctx: GeneratorContext
  ): ValueObjectModel = {
    val pkg = ctx.layout.domain.values.root

    // 解析自类型
    val selfType = resolveSelfType(meta, ctx)

    // 构建字段定义
    val fields = buildFields(meta, ctx)

    // 收集并过滤依赖
    val dependencies = collectDependencies(fields, pkg)

    // BUG-016（批1-C 2026-09-06）：Rich Model 硬约束——字段语义派生业务谓词（杜绝纯数据桩）
    val logicMethods = deriveLogicMethods(fields)

    // S7 #2（#22）：VO 知识号双槽透传——全量（自有 ∪ 携带者）落台账行；**自有号**走注解面
    // （携带者号发注解会新造孤儿：它不是本 VO 的便签，见 ValueObjectModel.voOwnNoteId 注）。
    ValueObjectModel(selfType, fields, dependencies, logicMethods, voNoteIds = meta.noteIds, voOwnNoteId = meta.ownNoteId)
  }

  /** 字段语义派生业务谓词（BUG-016·value_object.md 硬约束 2「严禁只写数据字段」）
    *
    * 派生规则（宁缺勿造——仅从字段名/类型可机械确证的业务语义，不臆造词汇表）：
    *   - 完成态时间戳（resolvedAt/appliedAt/confirmedAt/recordedAt）→ is{Stem}: Boolean = f != null
    *   - 集合字段（List[...]）→ has{X}: Boolean = xs != null && xs.nonEmpty（null 安全：折叠/重放首态可能为 null）
    *   - source+target 同为单值 → isSelfLoop: Boolean = source == target（状态机自环）
    *   - description/details 字段 → hasDetails: Boolean（评审发现类 VO 的内容存在性）
    */
  private def deriveLogicMethods(fields: Seq[FieldDef]): Seq[String] = {
    val completionStems = Map(
      "resolvedAt" -> "Resolved",
      "appliedAt" -> "Applied",
      "confirmedAt" -> "Confirmed",
      "recordedAt" -> "Recorded"
    )
    val byName = fields.map(f => f.name -> f).toMap

    val completion = fields.collect {
      case f if completionStems.contains(f.name) =>
        val stem = completionStems(f.name)
        s"  def is$stem: Boolean = Option(${f.name}).isDefined"
    }
    val collections = fields.collect {
      case f if f.typeRef.name == "List" =>
        val methodSuffix = f.name.capitalize
        s"  def has$methodSuffix: Boolean = Option(${f.name}).exists(_.nonEmpty)"
    }
    val selfLoop = if (byName.contains("source") && byName.contains("target")) {
      Seq("  def isSelfLoop: Boolean = source == target")
    } else Nil
    val details = fields.collect {
      case f if f.name == "description" || f.name == "details" =>
        s"  def has${f.name.capitalize}: Boolean = Option(${f.name}).exists(_.nonEmpty)"
    }
    (completion ++ collections ++ selfLoop ++ details).distinct
  }

  /** 解析值对象的自类型
    */
  private def resolveSelfType(
      meta: ValueObjectMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    // [FIX] If checking for State, use entityState resolver to preserve the name
    if (meta.name.endsWith("State")) {
      ctx.typeResolver.entityState(meta.name)
    } else {
      ctx.typeResolver.valueObject(meta.name)
    }
  }

  /** 构建值对象的字段定义列表
    */
  private def buildFields(
      meta: ValueObjectMetadata,
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    meta.fields.map { fieldMeta =>
      // 批8 P2a（2026-09-30·单号 ep-tgc-7cells-20260930）：defaultValue 透传（FieldDef 既有槽·
      // TypeSystem.scala）——模板按其发射 `= 默认` 与 DefaultValues 容错 reads。
      FieldDef(fieldMeta.name, resolveFieldType(fieldMeta, ctx), defaultValue = fieldMeta.defaultValue, noteId = fieldMeta.noteId, description = fieldMeta.description)
    }
  }

  /** 解析字段类型（可选 VO 成员 → scala.Option[T]，见 TypeResolver.resolveField）
    */
  private def resolveFieldType(
      fieldMeta: FieldMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    TypeResolver.resolveField(fieldMeta.fieldType, fieldMeta.optional, ctx)
  }

  /** 收集并过滤值对象的依赖
    */
  private def collectDependencies(
      fields: Seq[FieldDef],
      pkg: String
  ): Set[TypeRef] = {
    fields
      .flatMap(_.typeRef.collectAllDependencies)
      .toSet
    // [FIX] Do NOT filter by shouldImport here.
    // We need ALL dependencies (even same-package ones) for the Dependency Graph to build correct Topological Order.
    // Filtering for imports should happen in the Template/Generator phase.
    // .filter(_.shouldImport(pkg))
  }
}
