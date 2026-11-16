package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{ConnectorMethodModel, ConnectorModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta.ConnectorMetadata

/** Connector 能力面 Builder（application 层）——镜像 AggregateRepositoryBuilder（去掉聚合特化）。
  * 方法返回类型用**名字**承载（元数据不做类型解析）——Builder 经 layout 解析成 application.connectors 包内的 TypeRef。 */
object ConnectorBuilder {

  def build(meta: ConnectorMetadata, ctx: GeneratorContext): ConnectorModel = {
    val pkg = ctx.layout.application.connectors.root
    val selfType = TypeRef(meta.name, pkg)

    val implName = net.imadz.codegen.structure.NamingConventions.connectorImplName(meta.name)
    val implType = TypeRef(implName, ctx.layout.infrastructure.connectors.root)

    // 方法返回类型：手写 case class，与 trait 同包（application.connectors）
    val methods = meta.methods.map { m =>
      val params = m.scriptParam.toSeq.map(p => FieldDef(p, TypeRef.String))
      ConnectorMethodModel(
        name = m.name,
        parameters = params,
        returnType = TypeRef(m.returnTypeName, pkg),
        intent = m.intent,
        noteId = meta.noteId
      )
    }

    val deps = (methods.flatMap(mm => mm.returnType.collectAllDependencies ++ mm.parameters.flatMap(_.typeRef.collectAllDependencies)).toSet
      ++ Set(implType, ctx.knownFrameworkTypes("ImplementedBy")))
      .filter(_.shouldImport(pkg))

    ConnectorModel(selfType, implType, methods, deps, meta.noteId)
  }
}
