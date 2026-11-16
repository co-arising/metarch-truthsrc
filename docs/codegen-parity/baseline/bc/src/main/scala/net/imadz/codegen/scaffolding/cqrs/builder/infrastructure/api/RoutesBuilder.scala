package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.{
  ControllerModel,
  EndpointModel,
  RoutesFragmentModel
}

/** S2-41 R7：routes 片段 Builder——已建 ControllerModel 批产路由行（「生成的端点连不上 HTTP」
  * 的收口：控制器发射了方法但没人写路由行＝死代码）。
  * 行集口径＝控制器实际发射面：gate 声明（gate.isDefined）且非 skip 的端点——skip 端点控制器
  * 无方法即无路由；gate=None 端点＝存量 stub 面，不产行（渐进采纳红线：无 DSL 端点系统零路由
  * 行→None→不产 routes 文件·不碰既有 routes）。 */
object RoutesBuilder {

  def build(
      controllerModels: Seq[ControllerModel]
  ): Option[RoutesFragmentModel] = {
    val routeLines = controllerModels.flatMap(routesOf)
    if (routeLines.isEmpty) None else Some(RoutesFragmentModel(routeLines))
  }

  /** 单控制器的路由行（gate 声明且非 skip 的端点——与 ControllerTemplate active 端点同口径）。 */
  private def routesOf(model: ControllerModel): Seq[String] =
    model.endpoints
      .filter(e => e.gate.isDefined && e.skip.isEmpty)
      .map(routeLineOf(model, _))

  /** 路由行组装（node 先例实样对齐——ingested-app conf/routes 生成段）：
    * method 补齐 9 列（`POST     `／`GET      `）＋端点声明路径＋双空格＋
    * `controllers.<Controller>.<action>`。参数三形态：
    * 空＝无参方法无括号（node mergeConcepts 形态）；路径参数＝`(name: Type)`
    * （reference_project HomeController.deposit(userId: String, amount: Double) 形态）；
    * GET query 分页参数＝`(page: Int ?= 1, pageSize: Int ?= 20)`（node tpl_views.mjs:63
    * 固定默认值——pageGuard 契约 page>=1, 1<=pageSize<=200）。 */
  private def routeLineOf(model: ControllerModel, e: EndpointModel): String =
    s"${e.method.padTo(9, ' ')}${e.path}  controllers.${model.selfType.name}.${e.actionName}${routeParamsOf(e)}"

  private def routeParamsOf(e: EndpointModel): String =
    if (e.parameters.isEmpty) ""
    else
      e.parameters
        .map(p => s"${p.name}: ${p.typeRef.signature}${queryDefaultOf(e, p)}")
        .mkString("(", ", ", ")")

  /** GET 分页 query 参数默认值（page/pageSize Int→1/20——node 固定形态）；路径绑定参数
    * （path 含 `:name`）恒必填无默认（Play 路由语法：路径参数从路径段取值）。 */
  private def queryDefaultOf(e: EndpointModel, p: FieldDef): String = {
    val pathBound = e.path.contains(s":${p.name}")
    if (pathBound) ""
    else
      (p.name, p.typeRef.name) match {
        case ("page", "Int")     => " ?= 1"
        case ("pageSize", "Int") => " ?= 20"
        case _                   => ""
      }
  }
}
