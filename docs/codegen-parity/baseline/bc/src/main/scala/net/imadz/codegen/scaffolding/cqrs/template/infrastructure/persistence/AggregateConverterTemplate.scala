package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.persistence

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.TypeRef
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence.{
  AggregateConverterModel,
  ConverterDef
}
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateConverterTemplate
    extends CodeTemplate[AggregateConverterModel] {

  def generate(model: AggregateConverterModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies
      .filterNot(d =>
        d.packageName.isEmpty || d.packageName == "java.lang" || d.packageName == "scala"
      )
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq
      .sorted
      .distinct

    val importDecl = imports(importList: _*)

    def renderConverterObject(c: ConverterDef): String = {
      /** S4（EP_GenerationTime_Code_Anchors）：converter 字段锚——形态＝**注释行紧邻具名实参行**。
        * converter 无 case class（形态① 认不出）、实参块也不是方法参数表（形态③ 是 `def m(` 的括号），
        * 故用「`// @knowledge <id>` 行 ＋ 下一有效行是 `field = …`」的配对——推送侧新增形态④。
        * 无号字段（合成）**不发**（不编造）。 */
      def argOf(f: net.imadz.codegen.scaffolding.cqrs.FieldDef, isToProto: Boolean): String = {
        val convertLogic = resolveConversion(f.typeRef, f.name, isToProto)
        val argLine = s"${NamingConventions.scalaIdentifier(f.name)} = $convertLogic"
        f.noteId match {
          case Some(raw) =>
            val annotated = net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator
              .annotateKnowledge(Some(raw)).getOrElse(raw)
            s"// @knowledge $annotated\n      $argLine"
          case None => argLine
        }
      }

      val toArgs = c.fields.map(argOf(_, isToProto = true)).mkString(",\n      ")

      val fromArgs = c.fields.map(argOf(_, isToProto = false)).mkString(",\n      ")

      s"""
  object ${c.objectName} extends ProtoConverter[${c.participantType.name}, ${c.poType.name}] {
    override def toProto(d: ${c.participantType.name}): ${c.poType.name} = ${c.poType.name}(
      $toArgs
    )

    override def fromProto(p: ${c.poType.name}): ${c.participantType.name} = ${c.participantType.name}(
      $fromArgs
    )
  }
"""
    }

    // 3. 构建所有转换器对象代码
    val entityConvertersCode =
      (model.valueObjects ++ model.events ++ model.state.toSeq)
        .map(renderConverterObject)
        .mkString("\n")

    val helperConverters = """
  object ListConv {
    def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)
    def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList
  }

  object InstantConv {
    def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)
    def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)
  }
"""

    val convertersCode = entityConvertersCode + "\n" + helperConverters

    // 4. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

trait ${model.selfType.name} extends ${model.parentType.name} {
$convertersCode
}

/** S2-82-B3（2026-09-11）：self-companion——trait 嵌套 Conv object 的静态寻址口。
  * Scala trait 无 term（TraitName.NestedObject 编译红「no companion object」）——
  * 投影 handler/读端经 ${model.selfType.name}.XxxConv.fromProto 静态调用需要本伴生；
  * EventAdapter/SnapshotAdapter 等 mixin 消费方不受影响（trait 本体原样）。 */
object ${model.selfType.name} extends ${model.selfType.name}
"""

    // 5. 生成代码
    sourceCode
  }

  // 类型转换推断逻辑
  // 2026-08-21：字段访问用 scalaIdentifier 转义（`d.type` 等关键字字段）
  private def resolveConversion(
      t: TypeRef,
      fieldName: String,
      isToProto: Boolean
  ): String = {
    val safe = NamingConventions.scalaIdentifier(fieldName)
    val varName = if (isToProto) s"d.$safe" else s"p.$safe"

    t.name match {
      // --- 基础类型 (Proto生成为直接类型，无需 Option 处理) ---
      case "String" | "Long" | "Int" | "Double" | "Boolean" => varName

      case "BigDecimal" =>
        if (isToProto) s"$varName.doubleValue" else s"BigDecimal($varName)"

      // Id 和 Currency 通常映射为 String，也是直接类型
      case "Id" =>
        if (isToProto) s"IdConv.toProto($varName)"
        else s"IdConv.fromProto($varName)"
      case "Currency" =>
        if (isToProto) s"CurrencyConv.toProto($varName)"
        else s"CurrencyConv.fromProto($varName)"

      case "Instant" =>
        if (isToProto) s"InstantConv.toProto($varName)"
        else s"InstantConv.fromProto($varName)"

      // --- 容器类型 ---
      case "Option" =>
        // 这里的 Option 是 Domain 层的 Option。
        val inner = t.typeParams.head
        // ★ 2026-09-25（甲2 编译门抓）：`Option[Boolean]` 此前会生成 `d.isKey.map(BooleanConv.toProto)`，
        //   而 **BooleanConv 并不存在**（PrimitiveConverter 只有 Id/String/Currency 三件）——该组合
        //   从未被试过（全仓首个 `optional bool` proto 字段即本次 PatchReadModelFieldSpec.isKey）。
        //   修法取**最小**：proto 侧 `optional bool` 对应 `Option[Boolean]`，identity 可也 ⇒ 不新造
        //   转换器对象（避免为一个新组合扩公共面），直接传值。
        if (inner.name == "Boolean") varName
        else if (inner.name == "List" || inner.name == "Seq") {
          // 三可选参批 2026-10-05：Option[List[X]] ↔ PO repeated X（proto3 禁 optional repeated·
          //   PO 侧折叠为 repeated）——domain None≡空表：toProto getOrElse(Nil) 后逐元素；fromProto
          //   恒 Some 包裹（repeated 无缺席语义）。
          val elemConv = resolveConverterObj(inner.typeParams.head)
          if (isToProto) s"$varName.getOrElse(Nil).map($elemConv.toProto)"
          else s"Some($varName.map($elemConv.fromProto).toList)"
        }
        else {
          val innerConv = resolveConverterObj(inner)
          if (isToProto) s"$varName.map($innerConv.toProto)"
          else s"$varName.map($innerConv.fromProto)"
        }

      case "List" | "Seq" | "Set" =>
        val inner = t.typeParams.head
        val innerConv = resolveConverterObj(inner)
        // Domain List -> Proto Seq (Repeated)
        if (isToProto) s"$varName.map($innerConv.toProto)"
        else s"$varName.map($innerConv.fromProto).toList"

      case "Vector" =>
        val innerConv = resolveConverterObj(t.typeParams.head)
        if (isToProto) s"$varName.map($innerConv.toProto)"
        else s"$varName.map($innerConv.fromProto).toVector"

      case "Map" =>
        val k = t.typeParams(0)
        val v = t.typeParams(1)
        val kConv = resolveConverterObj(k)
        val vConv = resolveConverterObj(v)
        // Map 在 Proto 中通常处理为 Map[K, V]
        if (isToProto) s"toProtoMap($varName, $kConv, $vConv)"
        else s"fromProtoMap($varName, $kConv, $vConv)"

      // --- 复杂对象 (Nested Messages) ---
      case _ =>
        // [关键修复] Money, Address 等自定义 VO
        val defaultConv = resolveConverterObj(t)

        if (isToProto) {
          // Domain -> Proto: 包装成 Some
          s"Some($defaultConv.toProto($varName))"
        } else {
          // Proto -> Domain: 强制解包
          s"$defaultConv.fromProto($varName.getOrElse(throw new IllegalArgumentException(s\"Missing required field: $fieldName\")))"
        }
    }
  }

  private def resolveConverterObj(t: TypeRef): String = t.name match {
    case "String"   => "StringConv"
    case "Id"       => "IdConv"
    case "Currency" => "CurrencyConv"
    case _          => s"${t.name}Conv"
  }
}
