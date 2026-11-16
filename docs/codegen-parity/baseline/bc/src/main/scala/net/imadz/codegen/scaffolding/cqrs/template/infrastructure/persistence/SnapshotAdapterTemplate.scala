package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.persistence

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence.AdapterModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object SnapshotAdapterTemplate extends CodeTemplate[AdapterModel] {

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

    val additionalImports = Seq(
      "akka.persistence.typed.SnapshotAdapter"
    )

    val importDecl = imports((baseImports ++ additionalImports): _*)

    // 3. 获取映射和转换器
    val mapping = model.mappings.head
    val convObj = s"${mapping.scalaCaseName}Conv" // e.g. CreditBalanceStateConv

    // 4. 构建类方法
    val toJournalMethod = s"""
  override def toJournal(state: ${model.scalaRootType.name}): Any = {
    $convObj.toProto(state)
  }
"""

    val fromJournalMethod = s"""
  override def fromJournal(from: Any): ${model.scalaRootType.name} = {
    val proto = from.asInstanceOf[${model.protoRootType.name}]
    $convObj.fromProto(proto)
  }
"""

    // 5. 构建类体
    val classBody = s"""
$toJournalMethod

$fromJournalMethod
"""

    // 6. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${selfType.name}: 快照适配器，负责在领域快照和protobuf快照之间进行转换
 */
class ${selfType.name} extends SnapshotAdapter[${model.scalaRootType.name}] with ${model.converterTrait.name} {

$classBody

}
"""

    // 7. 生成代码
    sourceCode
  }
}
