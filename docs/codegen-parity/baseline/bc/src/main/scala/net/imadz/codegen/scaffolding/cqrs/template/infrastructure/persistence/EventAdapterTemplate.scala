package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.persistence

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence.AdapterModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object EventAdapterTemplate extends CodeTemplate[AdapterModel] {

  def generate(model: AdapterModel): String = {
    import model._

    // 1. 构建包声明
    val pkgDecl = packageDecl(selfType.packageName)

    // 2. 构建导入声明
    val baseImports = dependencies
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq
      .sorted
      .distinct

    val importDecl = imports(baseImports: _*)

    // 3. 构建toJournal的case匹配
    val toJournalCases = model.mappings
      .map { m =>
        val convObj = s"${m.scalaCaseName}Conv"
        // e.g. case evt: BalanceChanged => CreditBalanceEventPO.Event.BalanceChanged(BalanceChangedConv.toProto(evt))
        s"""
      case evt: ${m.scalaCaseName} =>
        ${model.protoRootType.name}.${m.protoOneOfName.get}($convObj.toProto(evt))
"""
      }
      .mkString("\n")

    // 4. 构建fromJournal的case匹配
    val fromJournalCases = model.mappings
      .map { m =>
        val convObj = s"${m.scalaCaseName}Conv"
        // e.g. case CreditBalanceEventPO.Event.BalanceChanged(po) => EventSeq.single(BalanceChangedConv.fromProto(po))
        s"""
      case ${model.protoRootType.name}.${m.protoOneOfName.get}(po) =>
        EventSeq.single($convObj.fromProto(po))
"""
      }
      .mkString("\n")

    // 5. 获取 OneOf 的父类名称
    val oneOfParent = model.protoRootType.name

    // 6. 构建类方法
    val manifestMethod =
      s"  override def manifest(event: ${model.scalaRootType.name}): String = event.getClass.getName"

    val toJournalMethod = s"""
  override def toJournal(e: ${model.scalaRootType.name}): ${model.protoRootType.name} = {
    val eventUnion = e match {
$toJournalCases
    }
    eventUnion
  }
"""

    val fromJournalMethod = s"""
  override def fromJournal(p: ${model.protoRootType.name}, manifest: String): EventSeq[${model.scalaRootType.name}] = {
    p match {
$fromJournalCases

      case $oneOfParent.Empty =>
        EventSeq.empty
    }
  }
"""

    // 7. 构建类体
    val classBody = s"""
$manifestMethod

$toJournalMethod

$fromJournalMethod
"""

    // 8. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${selfType.name}: 事件适配器，负责在领域事件和protobuf事件之间进行转换
 */
class ${selfType.name} extends EventAdapter[${model.scalaRootType.name}, ${model.protoRootType.name}] with ${model.converterTrait.name} {

$classBody

}
"""

    // 9. 生成代码
    sourceCode
  }
}
