package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api._

/** S2-32 R5b：Controller 发射模板——三档骨架（发射规格 23162fd §二）。
  * - gate=None 控制器（dslFlags.aggHasDsl=false）：存量 stub 路径逐字节保持（R5a/R5b 零漂移承诺·§三 Vega 拍板）；
  * - DSL 控制器（aggHasDsl=true）：@Singleton 骨架＋DSL import 面＋形态 1/2/4（api.<tier>.write ask 管线）
  *   ＋形态 3（api.anonymous Flow 委托）＋Req VO 文件尾顶层 companion（Play JSON 宏限制）；
  *   混合控制器内 gate=None 端点维持 stub 方法形态。
  * S2-32 R5c：形态 6（409 查重前置＋conflict 工厂＋payload VO）＋形态 7 guard 嵌套顺序修正
  *   （Id 外→Instant 内·node 实码对齐）＋形态 3 Flow 编排轴（flowMethod/flowArgs 声明化）。
  * S2-40 R6：形态 5 读侧（ServesView→ViewReadModel：pageGuard＋tenantList/globalList/tenantItem/
  *   globalItem/compositeItem helper 族按需裁剪＋单行端点——ingested-app ViewApiController:53-155
  *   逐块对齐·ViewListDto/ViewItem 信封 R5c 支撑件已发射）。
  * 判定全部消费 R5a IR（EndpointModel DSL 轴十字段），本模板不重新判定；skip 端点不发射（形态 8 同族）。 */
object ControllerTemplate {

  def generate(model: ControllerModel): String =
    if (model.dslFlags.aggHasDsl) generateDslController(model)
    else generateLegacyController(model)

  // ==========================================
  // 存量 stub 路径（gate=None 控制器——逐字节保持·R5a/R5b 零漂移承诺）
  // ==========================================

  private def generateLegacyController(model: ControllerModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq.sorted
      .++(Seq(
        "javax.inject._",
        "play.api.mvc._",
        "play.api.libs.json._",
        "scala.concurrent.ExecutionContext"
      ))

    val importDecl = imports(importList: _*)

    // 3. 构建注入服务
    val injections = model.injectedServices.map(s => s"${s.name}: ${s.typeRef.name}").mkString(",\n    ")

    // 4. 构建端点（stub 渲染——R5b 混合控制器内 gate=None 端点复用同一方法）
    val endpoints = model.endpoints.map(renderStubEndpoint).mkString("\n\n")

    // 5. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: API Controller for ${model.selfType.name.replace("Controller", "")}
 */
class ${model.selfType.name} @Inject() ($injections, val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {

  override def controllerComponents: ControllerComponents = cc

$endpoints

}
"""

    // 6. 生成代码
    sourceCode
  }

  /** 存量 stub 端点渲染（gate=None 端点——混合控制器内同样逐字保持）。 */
  private def renderStubEndpoint(e: EndpointModel): String = {
    val params = e.parameters.map(p => s"${p.name}: ${p.typeRef.name}").mkString(", ")

    s"""  /**
   * ${e.method} ${e.path}
   */
  def ${e.actionName}($params): Action[AnyContent] = Action.async { implicit request =>
    // TODO: Implement business logic calling ${e.serviceMethod}
    // ${e.serviceMethod}(...)
    Future.successful(Ok(Json.obj(\"message\" -> \"Not implemented yet\")))
  }"""
  }

  // ==========================================
  // DSL 路径（R5b——形态 1/2/3/4·发射规格 23162fd §二）
  // ==========================================

  private def generateDslController(model: ControllerModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)
    val importDecl = imports(dslImportList(model): _*)
    val active = model.endpoints.filter(_.skip.isEmpty)
    // P1/形态 6：查重视图仓库注入字段名（Builder 回补的投影仓库——按包位约定识别）
    val parkRepoField = parkRepoFieldName(model)
    val endpointTexts = active.map(renderDslEndpoint(_, parkRepoField)).mkString("\n\n")
    // S2-40 R6：读侧 helper 族（ViewApiController:52-98 逐块对齐——按控制器内读端点形态裁剪；
    // 无读端点＝空块＝字节级零漂移）
    val readHelpers = viewHelperLines(model)
    val injectionParts = (Seq("api: Endpoint") ++
      model.injectedServices.map(s => s"${s.name}: ${s.typeRef.name}")) :+ "val cc: ControllerComponents"
    val injections = injectionParts.mkString(", ")
    val classHeader = Seq(
      "  override def controllerComponents: ControllerComponents = cc",
      "  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)"
    ) ++ emptyBodyReadsLines(model.dslFlags.aggHasEmptyBody)
    val vos = reqVoDecls(model) ++ payloadVoDecls(model)
    val body = Seq(
      pkgDecl.code,
      "",
      importDecl.code,
      "",
      "/**",
      s" * ${model.selfType.name}: API Controller for ${model.selfType.name.replace("Controller", "")}",
      " */",
      "@Singleton",
      s"class ${model.selfType.name} @Inject() (${injections})(implicit ec: ExecutionContext) extends BaseController {",
      "",
      classHeader.mkString("\n"),
      ""
    ) ++ (if (readHelpers.isEmpty) Seq(endpointTexts)
          else Seq(readHelpers.mkString("\n\n"), "", endpointTexts)) ++ Seq("}")
    if (vos.isEmpty) body.mkString("\n") + "\n"
    else body.mkString("\n") + "\n\n" + vos.mkString("\n\n") + "\n"
  }

  /** DSL import 面（B4/B7 补齐·规格 §二各形态 import 清单——按 Model 实际用到的收窄）：
    * javax／protocol._（命令族——Builder 回补依赖）／注入服务 FQN／stub 端点签名依赖（混合控制器）／
    * auth{ApiError,CommandRoleMap,Endpoint,ViewKeys}／api{IdGuard,InstantGuard,OkReceipt,ViewListDto,
    * ViewItem}／play（复合键 item 增 JsObject/OWrites）／scala 并发族。
    * S2-40 R6：读侧面——ViewKeys（readModel 引用）＋ViewListDto/ViewItem（按形态）＋行类型
    * <Repo>Table 嵌套位 import（node 侧 repo 包通配 import 的收窄变体——repo 类 FQN 已由
    * serviceImports 承载）；OkReceipt 收窄为写/流端点存在（纯读控制器不引入未用信封）。 */
  private def dslImportList(model: ControllerModel): Seq[String] = {
    val currentPkg = model.selfType.packageName
    // 通用逻辑（用户拍板 2026-09-21）：框架面＝模块无关的 auth 基座（Endpoint DSL/ApiError/
    // RoleGate/TokenService…）→ net.imadz.common.auth（与 CborSerializable/Id 同类；scaffold/auth-core 供一份）。
    // 模块桩：infrastructure 是 **context 内部**的东西（`<module>.infrastructure.X`）——CommandRoleMap/
    // ViewKeys 的 key 各模块不同（metarch 的 ≠ banking 的），故按模块生成、带模块段。
    val moduleRoot = model.modulePkg.getOrElse("net.imadz")
    val moduleAuthPkg = s"$moduleRoot.infrastructure.auth"
    val frameworkAuthPkg = "net.imadz.common.auth"
    val active = model.endpoints.filter(_.skip.isEmpty)
    val reads = active.flatMap(_.readModel)
    val hasRead = reads.nonEmpty
    val hasReadList = reads.exists(_.form == ViewForm.ListView)
    val hasReadItem = reads.exists(r => r.form == ViewForm.ItemView && r.singleKey)
    val hasReadComposite = reads.exists(r => r.form == ViewForm.ItemView && !r.singleKey)
    val hasFlow = active.exists(e => e.serves.exists(_.isInstanceOf[ServesTarget.UseCase]))
    val hasTenantRoleDecl = active.exists(e =>
      e.gateKind.contains(GateKind.Tenant) && e.serves.exists(_.isInstanceOf[ServesTarget.Command])) ||
      active.exists(e => e.readModel.isDefined && e.gateKind.contains(GateKind.Tenant))
    val hasCommandAsk =
      active.exists(e => e.serves.exists(_.isInstanceOf[ServesTarget.Command]))
    val hasIdGuard = active.exists(_.idGuard.isDefined)
    val hasInstantGuard = active.exists(_.instantGuard.isDefined)
    val protocolImports = model.dependencies
      .filter(_.name.endsWith("Protocol"))
      .map(d => s"${d.fqn}._")
    val serviceImports = model.injectedServices
      .map(_.typeRef)
      .filter(_.shouldImport(currentPkg))
      .map(_.fqn)
    // R6 行类型 import：ViewReadModel.rowType.packageName＝投影 DTO 的 Table 嵌套位 FQN
    val viewRowImports = reads.map(_.rowType.packageName).distinct.filter(_ != currentPkg)
    val stubImports = model.endpoints
      .filter(e => e.gate.isEmpty && e.skip.isEmpty)
      .flatMap(e => e.parameters.map(_.typeRef) :+ e.returnType)
      .flatMap(_.collectAllDependencies)
      .filter(_.shouldImport(currentPkg))
      .map(_.fqn)
    val jsonImport =
      if (hasReadComposite) "play.api.libs.json.{JsObject, JsValue, Json, OWrites}"
      else "play.api.libs.json.{JsValue, Json}"
    (Seq(
      "javax.inject.{Inject, Singleton}"
    ) ++ protocolImports ++ serviceImports ++ viewRowImports ++ stubImports ++ Seq(
      groupImport(
        frameworkAuthPkg,
        Seq(
          "ApiError"        -> (hasCommandAsk || hasRead),
          "CommandRoleMap"  -> false,
          "Endpoint"        -> true,
          "ViewKeys"        -> false
        )
      ),
      groupImport(
        moduleAuthPkg,
        Seq(
          "ApiError"        -> false,
          "CommandRoleMap"  -> hasTenantRoleDecl,
          "Endpoint"        -> false,
          "ViewKeys"        -> hasRead
        )
      ),
      groupImport(
        "net.imadz.infrastructure.api",
        Seq(
          "IdGuard"      -> hasIdGuard,
          "InstantGuard" -> hasInstantGuard,
          "OkReceipt"    -> (hasCommandAsk || hasFlow),
          "ViewListDto"  -> hasReadList,
          "ViewItem"     -> hasReadItem
        )
      ),
      jsonImport,
      "play.api.mvc._",
      "scala.concurrent.ExecutionContext",
      "scala.concurrent.Future",
      "scala.concurrent.duration._"
    )).distinct
  }

  /** import 分组成员收窄：单成员无花括号（Endpoint/OkReceipt 恒真——DSL 控制器必用）。
    * 全 false 且 pkg 在通用域（net.imadz 前缀）→ 不发射（悬空 `pkg.` 是语法错）。
    * 模板仓自测的合成坐标（非 net.imadz）保留历史行为——既有 golden 依赖。 */
  private def groupImport(pkg: String, members: Seq[(String, Boolean)]): String = {
    val ms = members.collect { case (n, true) => n }
    if (ms.isEmpty) {
      if (pkg.startsWith("net.imadz")) "" else s"$pkg."
    } else if (ms.size == 1) s"$pkg.${ms.head}"
    else s"$pkg.{${ms.mkString(", ")}}"
  }

  /** 端点三档分派：形态 1/2/4（命令直发——tenant/global）·形态 3（anonymous UseCase 委托）；
    * S2-40 R6 形态 5（ServesView 读侧——tenant/global）；gate=None 端点维持 stub 形态（混合
    * 控制器）；形态集外组合 fail-fast（R5c 面）。 */
  private def renderDslEndpoint(e: EndpointModel, parkRepoField: Option[String]): String =
    (e.gateKind, e.serves) match {
      case (None, _) =>
        renderStubEndpoint(e)
      case (Some(GateKind.Anonymous), Some(ServesTarget.UseCase(_, _, _))) =>
        renderFlowDelegateEndpoint(e)
      case (Some(kind), Some(ServesTarget.Command(_))) =>
        renderCommandWriteEndpoint(e, kind, parkRepoField)
      case (Some(kind), Some(ServesTarget.View(_))) =>
        renderViewReadEndpoint(e, kind)
      case _ =>
        throw new IllegalArgumentException(
          s"[ControllerTemplate] Endpoint('${e.actionName}') 的形态不在 R5b/R5c/R6 发射集（gateKind=${e.gateKind} serves=${e.serves}）——" +
            s"形态 1/2/4/6/7＝命令直发（tenant/global 档）、形态 3＝anonymous UseCase 委托、形态 5＝ServesView 读侧（tenant/global 档）；tenant/global 档 Flow 委托与 serves/requestBody 缺省端点仍归后续批（发射规格 23162fd §七）"
        )
    }

  // ==========================================
  // S2-40 R6：形态 5 读侧（ViewApiController:52-155 逐块对齐——node tpl_views.mjs 语义翻译）
  // ==========================================

  /** 读侧 helper 族（按需裁剪：仅发射控制器内读端点实际用到的形态——27 视图全量控制器得
    * 全六 helper（node 形态），单视图混载控制器得所需子集；文本抄自 ingested-app
    * ViewApiController.scala:52-98 逐字（含契约注释——分页守卫/租户隔离/复合键 400）。
    * 返回＝块级字符串 Seq（每元素＝一个完整 helper 方法——块内换行、块间由调用位 \n\n 分隔）。 */
  private def viewHelperLines(model: ControllerModel): Seq[String] = {
    val readEndpoints = model.endpoints.filter(e => e.skip.isEmpty && e.readModel.isDefined)
    if (readEndpoints.isEmpty) Nil
    else {
      val rm: EndpointModel => ViewReadModel = e => e.readModel.get
      val needTenantList = readEndpoints.exists(e =>
        rm(e).form == ViewForm.ListView && e.gateKind.contains(GateKind.Tenant))
      val needGlobalList = readEndpoints.exists(e =>
        rm(e).form == ViewForm.ListView && !e.gateKind.contains(GateKind.Tenant))
      val needTenantItem = readEndpoints.exists(e =>
        rm(e).form == ViewForm.ItemView && rm(e).singleKey && e.gateKind.contains(GateKind.Tenant))
      val needGlobalItem = readEndpoints.exists(e =>
        rm(e).form == ViewForm.ItemView && rm(e).singleKey && !e.gateKind.contains(GateKind.Tenant))
      val needComposite = readEndpoints.exists(e =>
        rm(e).form == ViewForm.ItemView && !rm(e).singleKey)
      // pageGuard 仅 list 形态消费（tenantList/globalList）——item 控制器不发射（按需裁剪）
      Seq(
        if (needTenantList || needGlobalList) Some(pageGuardLines) else None,
        if (needTenantList) Some(tenantListLines) else None,
        if (needGlobalList) Some(globalListLines) else None,
        if (needTenantItem) Some(tenantItemLines) else None,
        if (needGlobalItem) Some(globalItemLines) else None,
        if (needComposite) Some(compositeItemLines) else None
      ).flatten.map(_.mkString("\n"))
    }
  }

  private val pageGuardLines: Seq[String] = Seq(
    "  /** 分页参数门卫（契约保留：page>=1, 1<=pageSize<=200） */",
    "  private def pageGuard(page: Int, pageSize: Int): Option[ApiError] =",
    "    if (page < 1 || pageSize < 1 || pageSize > 200) Some(ApiError(400, \"PARAM_INVALID\", \"page>=1, 1<=pageSize<=200 required\")) else None"
  )

  private val tenantListLines: Seq[String] = Seq(
    "  /** 租户作用域 list（R1 隔离：tenantOf(v)==ts.tenantId 过滤——Ctx 化，.get 灭绝） */",
    "  private def tenantList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =",
    "    api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewListDto[V]] { ts =>",
    "      pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](",
    "        all.map { list =>",
    "          val scoped = list.filter(v => tenantOf(v) == ts.tenantId)",
    "          Right(ViewListDto(vk, scoped.size, page, pageSize, scoped.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))",
    "        }",
    "      )(e => Future.successful(Left(e)))",
    "    }"
  )

  private val globalListLines: Seq[String] = Seq(
    "  /** 全局身份视图 list（User 族，Altair 拍板——跨租户可见不过滤；scope=global 已控） */",
    "  private def globalList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =",
    "    api.global.read().apply[ViewListDto[V]] { _ =>",
    "      pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](",
    "        all.map { list =>",
    "          Right(ViewListDto(vk, list.size, page, pageSize, list.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))",
    "        }",
    "      )(e => Future.successful(Left(e)))",
    "    }"
  )

  private val tenantItemLines: Seq[String] = Seq(
    "  /** 租户作用域 item（单键视图） */",
    "  private def tenantItem[V](vk: String, entityId: String, fetch: Future[Option[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =",
    "    api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewItem[V]] { ts =>",
    "      fetch.map(dOpt => dOpt.filter(v => tenantOf(v) == ts.tenantId)",
    "        .map(d => Right(ViewItem(d)))",
    "        .getOrElse(Left(ApiError(404, \"VIEW_ITEM_NOT_FOUND\", s\"view=${vk} id=${entityId}\")))",
    "    }"
  )

  private val globalItemLines: Seq[String] = Seq(
    "  /** 全局身份视图 item（单键，不过滤） */",
    "  private def globalItem[V](vk: String, entityId: String, fetch: Future[Option[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =",
    "    api.global.read().apply[ViewItem[V]] { _ =>",
    "      fetch.map(dOpt => dOpt.map(d => Right(ViewItem(d)))",
    "        .getOrElse(Left(ApiError(404, \"VIEW_ITEM_NOT_FOUND\", s\"view=${vk} id=${entityId}\")))",
    "    }"
  )

  private val compositeItemLines: Seq[String] = Seq(
    "  /** 复合键视图 item（F2 刻意契约）：by-id 语义化 400，不回退随机挂 */",
    "  private def compositeItem(vk: String): play.api.mvc.Action[play.api.mvc.AnyContent] = {",
    "    implicit val jsObjSelf: OWrites[JsObject] = identity",
    "    api.tenant.read(CommandRoleMap.of(vk): _*).apply[JsObject] { _ =>",
    "      Future.successful(Left(ApiError.badRequest(\"PARAM_INVALID\", \"复合键视图需列表查询后取行\")))",
    "    }",
    "  }"
  )

  /** 形态 5：读侧单行端点（node tpl_views.mjs endpoints.push 同构——helper 复用＋ViewKeys 常量
    * 引用＋行类型 [V] 显式化；list＝(page,pageSize) 分页／item＝(entityId) 单行／复合键＝400）。 */
  private def renderViewReadEndpoint(e: EndpointModel, kind: GateKind): String = {
    val rm = e.readModel.getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') ServesView 读端点缺 readModel——Builder 判定缺失（不可发射半吊子读端点）"
      )
    )
    val rowShort = s"${rm.rowType.packageName.split('.').last}.${rm.rowType.name}"
    val viewRef = s"ViewKeys.${rm.constName}"
    val repoField = rm.repository.name
    val helper = (rm.form, kind, rm.singleKey) match {
      case (ViewForm.ListView, GateKind.Tenant, _) =>
        s"tenantList[$rowShort]($viewRef, page, pageSize, $repoField.findAll(), _.tenantId)"
      case (ViewForm.ListView, _, _) =>
        s"globalList[$rowShort]($viewRef, page, pageSize, $repoField.findAll())"
      case (ViewForm.ItemView, GateKind.Tenant, true) =>
        s"tenantItem[$rowShort]($viewRef, entityId, $repoField.findByIdentity(entityId), _.tenantId)"
      case (ViewForm.ItemView, _, true) =>
        s"globalItem[$rowShort]($viewRef, entityId, $repoField.findByIdentity(entityId))"
      case (ViewForm.ItemView, _, false) =>
        s"compositeItem($viewRef)"
    }
    val formNote = rm.form match {
      case ViewForm.ListView => "分页列表（pageGuard＋ViewListDto 信封）"
      case ViewForm.ItemView if rm.singleKey => "单行（ViewItem 信封＋by-entityId）"
      case _ => "复合键 item＝400 PARAM_INVALID 刻意契约"
    }
    val scopeNote = kind match {
      case GateKind.Tenant  => "tenant 档——api.tenant.read + CommandRoleMap.of(vk) 视图角色"
      case GateKind.Global  => "global 档——api.global.read 空 roles＝scope 兜底"
      case GateKind.Anonymous => throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') ServesView anonymous 档——Builder 已 fail-fast（此处不可达）"
      )
    }
    Seq(
      s"  /** ${e.actionName}（读侧端点——ServesView(${rm.viewKey})：$scopeNote；$formNote） */",
      s"  def ${e.actionName}${sigOf(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] = $helper"
    ).mkString("\n")
  }

  /** 形态 1/2/4/6/7：api.<tier>.write[Req] ask 管线（guard 链 × entityRef 寻址 × error fold——
    * node tpl_dsl.mjs renderStandardEndpoint/renderEstablishEndpoint 同构；形态 2＝reqName 为
    * JsObject 的同构变体；形态 6＝errorPayloads 非空时叠加 409 查重前置；形态 7＝guard 嵌套）。 */
  private def renderCommandWriteEndpoint(
      e: EndpointModel,
      kind: GateKind,
      parkRepoField: Option[String]
  ): String = {
    val cmdName = e.serves.collectFirst { case ServesTarget.Command(c) => c }.getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') serves 缺命令名"
      )
    )
    val reqName = e.reqVo.map(_.reqName).getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') Req VO 缺失——无法发射 write[${cmdName}Req]"
      )
    )
    val generatedId = e.addressing.contains(Addressing.Factory)
    val entityExpr = entityExprOf(e)
    // S2-32 R5c（P3·形态 7 修正）：guard 嵌套顺序＝IdGuard 外层→InstantGuard 内层。
    // node tpl_dsl.mjs guardWrapped 实码语义：Instant 先包 body、Id 后包外层＝Id 外 Instant 内
    // （其行 27 注释「Instant 外层→Id 内层」系笔误，与自身代码相反）；ingested-app
    // OrganizationMemberApiController:45-48 实证（IdGuard.parse 先出＝外层）。R5b 曾按规格 §二
    // 形态 7 的文字转抄实现致顺序倒置，本批对齐实码（规格文字勘误随 R5d 文档收口）。
    val handler = guardWrapped(
      e.idGuard,
      "IdGuard",
      guardWrapped(e.instantGuard, "InstantGuard", askBody(e, cmdName, entityExpr, generatedId))
    )
    // S2-32 R5c（P1·形态 6）：409 查重前置——命中短路 conflict 工厂，未命中走标准管线
    val body =
      if (e.errorPayloads.isEmpty) handler
      else dedupWrapped(e, kind, entityExpr, handler, parkRepoField)
    val dedupNote =
      if (e.errorPayloads.isEmpty) "" else "＋409 查重前置 typed payload"
    val (comment, decl, ctxParams) = kind match {
      case GateKind.Tenant =>
        (
          s"$cmdName（tenant 档——api.tenant.write + CommandRoleMap 命令粒度角色$dedupNote）",
          s"    api.tenant.write[$reqName](CommandRoleMap.ofCommand(\"$cmdName\"): _*)",
          "(ts, req)"
        )
      case GateKind.Global =>
        (
          s"$cmdName（global 档——api.global.write 空 roles＝scope 兜底（D1：已登录、无租户承诺）$dedupNote）",
          s"    api.global.write[$reqName]()",
          "(gc, req)"
        )
      case GateKind.Anonymous =>
        throw new IllegalArgumentException(
          s"[ControllerTemplate] Endpoint('${e.actionName}') anonymous 档命令直发不在发射集（triggeredBy 无会话身份源）"
        )
    }
    (Seq(
      s"  /** $comment */",
      s"  def ${e.actionName}${sigOf(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] =",
      decl,
      s"      .apply[OkReceipt] { $ctxParams =>"
    ) ++ body :+ "      }").mkString("\n")
  }

  /** P1/形态 6：409 查重前置块（node tpl_dsl.mjs renderEstablishEndpoint 同构·硬编码声明化升级）。
    * 冲突谓词＝约定推导三段：①唯一键匹配（errorPayloads 声明激活 establish 约定——命令非 Option
    * 严格必填字段＝冲突键：必填即业务身份；node 硬编码 (contextId,name) 的元数据化推导，真源
    * EstablishConcept refining 便签 businessDefinition「(contextId,name) 唯一约束」实证同集）
    * ②自排除（路径寻址：v.<identity>.toString != <路径参数>）③租户隔离（tenant 档恒成立）。
    * 已知边界（如实注记·不硬造）：视图软删除标记（ingested-app v.removedAt == null）无声明源
    * 不发射；冲突文案无 invariant 锚点时回退 errorCode 本身（Builder conflictMessage 关联）。 */
  private def dedupWrapped(
      e: EndpointModel,
      kind: GateKind,
      entityExpr: String,
      handler: Seq[String],
      parkRepoField: Option[String]
  ): Seq[String] = {
    val parkRepo = parkRepoField.getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') 声明 errorPayloads 但控制器注入面缺投影仓库——Builder 回补缺失（不可发射半吊子查重）"
      )
    )
    val payload = e.errorPayloads.head // 多 409 声明：首个生效（多 errorCode 查重组合归后续批）
    val keyFields = e.reqVo.map(_.reqFields.filterNot(isOptionalField)).getOrElse(Nil)
    if (keyFields.isEmpty)
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') 409 端点命令无严格必填字段——冲突键不可推导（errorPayloads 需要必填业务身份字段）"
      )
    val selfExclusion = e.ctorArgs.collectFirst {
      case CtorArgRef.FromPathId(paramName, _) => s"v.$paramName.toString != $entityExpr"
    }
    val tenantScope =
      if (kind == GateKind.Tenant) Some("v.tenantId == ts.tenantId") else None
    val predicate = (keyFields.map(f =>
      s"v.${scalaIdOf(f.name)} == req.${scalaIdOf(f.name)}"
    ) ++ selfExclusion ++ tenantScope).mkString(" && ")
    val message = payload.conflictMessage.getOrElse(payload.errorCode)
    val payloadArgs = payload.payloadFields.map(_._2).mkString(", ")
    Seq(
      s"        $parkRepo.findAll().flatMap { all =>",
      s"          val conflict = all.find(v => $predicate)",
      "          if (conflict.isDefined) {",
      s"            Future.successful(Left(ApiError.conflict(\"${payload.errorCode}\",",
      s"              \"$message\", ${payload.payloadName}($payloadArgs))))",
      "          } else {"
    ) ++ handler.map(l => if (l.trim.isEmpty) l else "  " + l) ++ Seq(
      "          }",
      "        }"
    )
  }

  /** P1：查重视图仓库注入字段识别（Builder 回补位＝application.projection.repository 包——
    * 与聚合仓库（aggregates.repository）/Flow（application 根包）不撞位）。 */
  private def parkRepoFieldName(model: ControllerModel): Option[String] =
    model.injectedServices
      .find(_.typeRef.packageName.endsWith("application.projection.repository"))
      .map(_.name)

  private def isOptionalField(f: FieldDef): Boolean =
    f.typeRef.name == "Option" && f.typeRef.packageName.isEmpty

  /** 形态 3：anonymous one-call——controller 只剩 Flow 委托原语参传递（node
    * tpl_dsl.mjs renderFlowDelegateEndpoint 同构；D3：编排下沉手写 <UseCase>Flow 应用服务）。
    * S2-32 R5c（P5）：flowMethod/flowArgs 消费 UseCaseMetadata 声明（node register 硬编码
    * 四件的元数据化）——优先级＝flowArgs 声明＞Req VO 推导字段＞整体 body 递交（默认）。 */
  private def renderFlowDelegateEndpoint(e: EndpointModel): String = {
    val (useCase, flowMethodDecl, flowArgsDecl) = e.serves.collectFirst {
      case ServesTarget.UseCase(u, m, a) => (u, m, a)
    }.getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('${e.actionName}') serves 缺用例名"
      )
    )
    val reqName = e.reqVo.map(_.reqName).getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerTemplate] Endpoint('$useCase') anonymous UseCase 委托缺 requestBody 声明——无法推导 Req"
      )
    )
    val flowService = s"${useCase.head.toLower}${useCase.tail}Flow"
    val flowMethod = flowMethodDecl.getOrElse("register") // D3 约定默认（UseCaseMetadata.flowMethod 声明化·P5）
    val declaredArgs = flowArgsDecl.map(a => s"body.${scalaIdOf(a)}")
    val flowArgs =
      if (declaredArgs.nonEmpty) declaredArgs.mkString(", ") // P5：声明参数清单（ingested-app register 八字段形态）
      else e.reqVo
        .map(_.reqFields.map(f => s"body.${f.name}").mkString(", "))
        .filter(_.nonEmpty)
        .getOrElse("body") // 未声明且 explicit VO 不携字段清单（R5a IR 已定）——整体 body 递交
    Seq(
      s"  /** $useCase（anonymous 档——api.anonymous 免登录；编排下沉手写 $flowService·D3） */",
      s"  def ${e.actionName}${sigOf(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] =",
      s"    api.anonymous.write[$reqName]",
      "      .apply[OkReceipt] { (req, body) =>",
      s"        $flowService.$flowMethod($flowArgs)",
      "      }"
    ).mkString("\n")
  }

  /** ask 管线（全档共用·node tpl_dsl.mjs askBody 同构）：entityRef.ask →
    * error.fold(OkReceipt | ApiError.badRequest)。dvExpr（decisionView 快照表达式）不在 R5a
    * IR——按 node 无 dv 退化语义发射 JsNull（ConceptApiController establishConcept JsNull 先例；
    * decisionView 声明源接入归 R5c）。 */
  private def askBody(
      e: EndpointModel,
      cmdName: String,
      entityExpr: String,
      generatedId: Boolean
  ): Seq[String] =
    (if (generatedId)
       Seq("        val generatedId = java.util.UUID.randomUUID().toString")
     else Nil) ++ Seq(
      s"        repository.entityRef($entityExpr).ask {",
      s"          (replyTo: akka.actor.typed.ActorRef[${cmdName}Reply]) => $cmdName(${ctorArgsOf(e)}, replyTo)",
      "        }.map { reply =>",
      "          reply.error.fold[Either[ApiError, OkReceipt]](",
      s"            Right(OkReceipt($entityExpr, play.api.libs.json.JsNull))",
      "          )(e => Left(ApiError.badRequest(e.code, e.message)))",
      "        }"
    )

  /** M5 ctor 实参表达式组装（CtorArgRef 八档→文本·node ctorArgsDsl 同构）。 */
  private def ctorArgsOf(e: EndpointModel): String =
    e.ctorArgs.map {
      case CtorArgRef.FromPathId(_, bind)                 => bind
      case CtorArgRef.FromSessionUser(_, GateKind.Tenant) => "ts.userId"
      case CtorArgRef.FromSessionUser(_, GateKind.Global) => "gc.userId"
      case CtorArgRef.FromSessionUser(p, GateKind.Anonymous) =>
        throw new IllegalArgumentException(
          s"[ControllerTemplate] ctor 参数 [$p] 无会话身份源（anonymous 档）——anonymous 命令直发不在 R5b 形态集"
        )
      case CtorArgRef.FromSessionTenant(_)         => "net.imadz.common.Id.of(ts.tenantId)"
      case CtorArgRef.FromGeneratedId(_)           => "net.imadz.common.Id.of(generatedId)"
      case CtorArgRef.FromGuard(_, bind)           => bind
      case CtorArgRef.FromInstantGuard(_, bind)    => bind
      case CtorArgRef.FromBody(name)               => s"req.${scalaIdOf(name)}"
      case CtorArgRef.FromBodyOptional(name)       => s"req.${scalaIdOf(name)}.getOrElse(\"\")"
    }.mkString(", ")

  /** guard 链（node tpl_dsl.mjs guardWrapped 同构——实码语义）：IdGuard 外层→InstantGuard
    * 内层嵌套两段 match；内层 body 逐行 +2 缩进（P3 修正：R5b 曾倒置为 Instant 外层——
    * node 行 27 注释笔误的转抄，实码与其自身注释相反；ingested-app 实证见 renderCommandWriteEndpoint 注）。 */
  private def guardWrapped(
      guard: Option[GuardSpec],
      guardType: String,
      body: Seq[String]
  ): Seq[String] =
    guard match {
      case Some(g) =>
        Seq(
          s"          $guardType.parse(${guardPairsOf(g)}) match {",
          s"            case Right(Seq(${g.binds.mkString(", ")})) =>"
        ) ++ body.map(l => if (l.trim.isEmpty) l else "  " + l) ++ Seq(
          "            case Left(err) => Future.successful(Left(err))",
          "          }"
        )
      case None => body
    }

  private def guardPairsOf(g: GuardSpec): String =
    g.pairs.map { case (name, value) => s"\"$name\" -> $value" }.mkString(", ")

  /** M6 寻址轴 → entityRef 表达式：Path＝路径参数名（端点签名首位）；Factory＝generatedId（服务端发号）。 */
  private def entityExprOf(e: EndpointModel): String =
    e.addressing match {
      case Some(Addressing.Path) => e.parameters.headOption.map(_.name).getOrElse("id")
      case _                     => "generatedId"
    }

  /** B4 端点签名：DSL 形态＝路径参数签名（body 参数进 Req VO；空＝无参方法——onboardTenant 形态）。 */
  private def sigOf(e: EndpointModel): String =
    if (e.parameters.isEmpty) ""
    else e.parameters.map(p => s"${p.name}: ${p.typeRef.signature}").mkString("(", ", ", ")")

  /** 形态 2 类内通道：write[JsObject] 空 body Reads（任意合法 JSON 体即过）。 */
  private def emptyBodyReadsLines(flag: Boolean): Seq[String] =
    if (!flag) Nil
    else Seq(
      "  /** 空 body 命令通道（write[JsObject]）：任意合法 JSON 体即过——与旧 parse.json 行为等价（body 必须是合法 JSON） */",
      "  private implicit val emptyBodyReads: play.api.libs.json.Reads[play.api.libs.json.JsObject] =",
      "    play.api.libs.json.Reads(_ => play.api.libs.json.JsSuccess(play.api.libs.json.Json.obj()))"
    )

  /** Req VO 文件尾（§四·Play JSON 宏限制——顶层 companion；explicit VO 只引用不重复发射；
    * 空 body 形态无 VO；同名 VO 去重）。 */
  private def reqVoDecls(model: ControllerModel): Seq[String] =
    model.endpoints
      .filter(_.skip.isEmpty)
      .flatMap(_.reqVo)
      .filter(vo => !vo.explicit && !vo.hasEmptyBody)
      .distinctBy(_.reqName)
      .map { vo =>
        val fields = vo.reqFields.map(f => s"${f.name}: ${f.typeRef.signature}").mkString(", ")
        s"""/** 命令载荷 VO——typed Reads 派生，缺键/类型错 → 400 PARAM_INVALID（含字段明细）。 */
final case class ${vo.reqName}($fields)
object ${vo.reqName} {
  implicit val reads: play.api.libs.json.Reads[${vo.reqName}] = play.api.libs.json.Json.reads
}"""
      }

  /** P1/形态 6：409 typed payload VO 文件尾（§五——voKind=format·OFormat 写侧对称·与命令 Req
    *  相邻；node builder.mjs「payload VO 归 REQ VO 家族统一发射」同构）。字段类型约定＝String：
    *  ErrorPayloadSpec 只声明（字段名, 来源路径表达式）——409 载荷按字符串序列化约定
    *  （ingested-app existingConceptId: String 同构）；同名 VO 去重。 */
  private def payloadVoDecls(model: ControllerModel): Seq[String] =
    model.endpoints
      .filter(_.skip.isEmpty)
      .flatMap(_.errorPayloads)
      .distinctBy(_.payloadName)
      .map { p =>
        val fields = p.payloadFields.map { case (name, _) => s"$name: String" }.mkString(", ")
        s"""/** 409 typed payload——conflict 工厂载荷（OFormat 写侧对称·与命令 Req 相邻）。 */
final case class ${p.payloadName}($fields)
object ${p.payloadName} {
  implicit val format: play.api.libs.json.OFormat[${p.payloadName}] = play.api.libs.json.Json.format
}"""
      }

  // 发射位标识符守卫（与 ControllerBuilder.SCALA_KEYWORDS／node core.mjs SCALA_KEYWORDS
  // 同源三引擎词表；Builder 侧私有不可复用，发射文本组装位自持）
  private val SCALA_KEYWORDS = Set(
    "type", "class", "def", "val", "var", "object", "trait", "package",
    "import", "case", "match", "else", "then", "yield", "while", "return",
    "throw", "new", "extends", "with", "final", "sealed", "abstract", "lazy",
    "override", "implicit", "private", "protected", "this", "super", "try",
    "catch", "finally", "for", "do"
  )

  private def scalaIdOf(name: String): String =
    if (SCALA_KEYWORDS.contains(name)) s"`$name`" else name
}
