package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.proto

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto._
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ProtoTemplate extends CodeTemplate[ProtoFileModel] {

  /** 元素级内容哈希后缀包装（`<id>@<hash8>`；EP_Knowledge_Release_Version_Pin）——与 Javadoc 面同源。 */
  private def annotated(raw: String): String =
    net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator
      .annotateKnowledge(Some(raw))
      .getOrElse(raw)

  def generate(model: ProtoFileModel): String = {
    // 1. 构建import声明
    val importsDecl = model.imports.map(i => s"import \"$i\";").mkString("\n")

    // 2. 构建java_package选项
    val javaPkgDecl =
      model.javaPackage.map(p => s"option java_package = \"$p\";").getOrElse("")

    // 3. 构建enum定义
    val enumsDecl = model.enums.map(renderEnum).mkString("\n\n")

    // 4. 构建message定义
    val messagesDecl = model.messages.map(renderMessage).mkString("\n\n")

    // 5. 构建完整的proto文件内容
    s"""syntax = "proto3";

package ${model.packageName};

$importsDecl

option java_multiple_files = true;
$javaPkgDecl

$enumsDecl

$messagesDecl
"""
  }

  private def renderEnum(e: ProtoEnumModel): String = {
    val values = e.values.map { case (n, i) => s"  $n = $i;" }.mkString("\n")
    s"""enum ${e.name} {
$values
}"""
  }

  private def renderMessage(m: ProtoMessageModel): String = {
    val fields = m.fields
      .map {
        case NormalField(n, t, i, repeated, isOptional, comment, noteId) =>
          val prefix = if (repeated) "repeated " else if (isOptional) "optional " else ""
          // B2（EP_GenerationTime_Code_Anchors）：尾注释合并 comment（版本标记）＋知识锚，
          // 单行 `//` 语法——proto 无 Javadoc。锚形如 `@knowledge <id>@<hash8>`（推送侧按 .proto 分支解析）。
          // 逐字节兼容：仅 comment 时输出与旧实现完全一致（`" // " + comment`）。
          val parts = comment.toSeq ++ noteId.map(id => s"@knowledge ${annotated(id)}").toSeq
          val suffix = if (parts.isEmpty) "" else " // " + parts.mkString(" ")
          s"  $prefix$t $n = $i;$suffix"
        case MapField(n, k, v, i, noteId) =>
          val suffix = noteId.map(id => s" // @knowledge ${annotated(id)}").getOrElse("")
          s"  map<$k, $v> $n = $i;$suffix"
      }
      .mkString("\n")

    val oneOfs = m.oneOfs
      .map { o =>
        val ofields = o.fields
          .map(f => s"    ${f.fieldType} ${f.name} = ${f.index};")
          .mkString("\n")
        s"""
  oneof ${o.name} {
$ofields
  }"""
      }
      .mkString("\n")

    // 简单起见，嵌套定义暂不递归渲染，假设铺平了
    s"""message ${m.name} {
$fields
$oneOfs
}"""
  }
}
