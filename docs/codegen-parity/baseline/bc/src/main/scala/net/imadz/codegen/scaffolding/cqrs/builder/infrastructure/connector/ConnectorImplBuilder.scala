package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.connector

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.connector.{ConnectorImplMethodModel, ConnectorImplModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.ConnectorImplMetadata

/** Connector 实现 Builder（infrastructure 层）——镜像 ProjectionRepositoryImplBuilder.buildVector：
  * 注入手写基建（helperNames → infrastructure.process 包的 TypeRef）作为构造参数。
  * 方法体 = 机械委托（生成物缺省）；真实调用在 MANUAL 块（重生成字节保留）。 */
object ConnectorImplBuilder {

  def build(meta: ConnectorImplMetadata, ctx: GeneratorContext): ConnectorImplModel = {
    val pkg = ctx.layout.infrastructure.connectors.root
    val selfType = TypeRef(meta.name, pkg)
    val ifaceType = TypeRef(meta.connectorName, ctx.layout.application.connectors.root)

    // 手写基建注入参数（如 NodeSubprocessRunner）——坐落在 infrastructure.process 手写外域
    val helpers = meta.helperNames.map { h =>
      FieldDef(NamingConventions.firstLower(h), TypeRef(h, ctx.layout.infrastructure.process.root))
    }

    // 方法：与接口面同名同签名；返回类型经 ctx 回查接口元数据（单一真源·不猜）
    val iface = ctx.metaRegistry.resolveByName[net.imadz.meta.ConnectorMetadata](meta.connectorName)
    val (methName, retName) = iface.flatMap(_.methods.headOption)
      .map(m => (m.name, m.returnTypeName))
      .getOrElse((NamingConventions.firstLower(meta.connectorName), "ProcessResult"))
    val runnerName = helpers.headOption.map(_.name)

    val methods = Seq(ConnectorImplMethodModel(
      name = methName,
      parameters = Nil,
      returnType = TypeRef(retName, ctx.layout.application.connectors.root),
      // 生成物缺省体：委托注入的 runner，脚本＝机制真源（不写死）。缺 runner 则 ??? 待手写。
      defaultBody = runnerName.map { r =>
        iface.flatMap(_.methods.headOption).flatMap(_.script)
          .map(s => s"""$r.run("$s")""").getOrElse(s"$r.run()")
      }.getOrElse("???"),
      anchorNoteId = meta.noteId
    ))

    val deps = (helpers.map(_.typeRef).toSet
      ++ methods.flatMap(m => m.returnType.collectAllDependencies)
      ++ Set(ifaceType, ctx.knownFrameworkTypes("Inject"), ctx.knownFrameworkTypes("Singleton")))
      .filter(_.shouldImport(pkg))

    ConnectorImplModel(selfType, ifaceType, methods, helpers, deps, meta.noteId)
  }
}
