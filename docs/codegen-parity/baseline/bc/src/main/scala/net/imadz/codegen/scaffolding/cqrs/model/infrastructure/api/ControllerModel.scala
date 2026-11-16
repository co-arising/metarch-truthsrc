package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class ControllerModel(
                            override val selfType: TypeRef,
                            basePath: String,
                            injectedServices: Seq[FieldDef],
                            endpoints: Seq[EndpointModel],
                            override val dependencies: Set[TypeRef],
                            // M8：聚合级 DSL flags（gate=None 控制器全默认——既有 stub 分支零变化）
                            dslFlags: DslFlags = DslFlags(),
                            // 模块根（net.imadz.<module>）——模块级 auth 桩（CommandRoleMap/ViewKeys）
                            // 的包位来源。Play 惯例下 controller 包为 `controllers`（无模块段），
                            // 无法从包名反推，须由 Builder 从 ctx.basePackage 传入。
                            modulePkg: Option[String] = None,
                            /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
                            override val noteIds: Seq[String] = Nil
                          ) extends ArtifactModel

case class EndpointModel(
                          method: String, // "GET", "POST"
                          path: String, // "/:id"
                          actionName: String, // "getBalance"
                          parameters: Seq[FieldDef],
                          serviceMethod: String, // "getBalanceQuery.execute"
                          returnType: TypeRef,
                          // ── S2-32 R5a：auth DSL 轴字段（发射规格 §一 M1-M7·纯 IR 零文本；发射归 R5b Template）──
                          // gate=None＝未声明门＝存量 stub 路径（§三 Vega 拍板·渐进采纳）——全 Option/空集默认零判定。
                          gate: Option[String] = None,           // M1：门引用（EndpointMetadata.gate.value——api.<gate> 分派轴·D6 名字即域根名）
                          gateKind: Option[GateKind] = None,     // M1：门档（§三 两维判定 requiresIdentity×requiresTenant 的 Scala 化）
                          serves: Option[ServesTarget] = None,   // M7：serves 分派轴（命令直发 vs Flow 委托·EndpointTarget 映射）
                          reqVo: Option[ReqVo] = None,           // M2：Req VO 发射源（§四双轨——主轨＝serves→命令参数五规则推导；requestBody 显式优先）
                          errorPayloads: Seq[ErrorPayloadVo] = Nil, // M3：409 typed payload VO 规格（§五——查重前置＋conflict 工厂发射源）
                          idGuard: Option[GuardSpec] = None,     // M4：Id 边界防护组成（bad UUID → 400）
                          instantGuard: Option[GuardSpec] = None, // M4/形态 7：Instant 边界防护（非 ISO-8601 → 400）
                          ctorArgs: Seq[CtorArgRef] = Nil,       // M5：ctor 实参来源决策（ctx 身份注入＋Guard 绑定名·逐参数有序）
                          addressing: Option[Addressing] = None, // M6：寻址轴（entityRef 表达式分派）
                          readModel: Option[ViewReadModel] = None, // S2-40 R6：读侧轴（ServesView 判定产物——helper/单行端点发射源）
                          skip: Option[String] = None            // B6/形态 8 同族：skip 注记（VO-List／查询型 Reply——不发射）
                        )

// ==========================================
// S2-32 R5a：DSL 轴 IR 词表（发射规格 23162fd §一/§三/§四/§五——node gen_api_controllers 语义翻译）
// ==========================================

/** M1：门档三档（§三——GATE_NAMES 常量的两维语义化：门名降为应用声明数据，
  * (requiresIdentity, requiresTenant) 两维布尔决定 handler ctx 形态与 DSL 语义）。 */
sealed trait GateKind
object GateKind {
  case object Anonymous extends GateKind // (false,false)：免登录——api.<name>.write[Req]，handler 收 (Request, Req)
  case object Global extends GateKind    // (true,false)：已登录无租户承诺——空 roles＝scope 兜底（D1），(GlobalCtx, Req)
  case object Tenant extends GateKind    // (true,true)：认证＋租户双门卫——(TenantCtx, Req)
}

/** M7：serves 分派轴（EndpointTarget 的 Model 映射——node isRegister/isErrorReply 命令名特判的声明化）。 */
sealed trait ServesTarget
object ServesTarget {
  final case class Command(command: String) extends ServesTarget // DSL 直发（ask 管线）
  // flowMethod/flowArgs：S2-32 R5c（P5）——UseCaseMetadata 声明的 Flow 委托编排轴（node register
  // 硬编码四件的元数据化）；默认值＝D3 约定（method "register"／空参整体 body 递交）——存量 IR 零改动。
  final case class UseCase(
                           useCase: String,
                           flowMethod: Option[String] = None, // Flow 服务方法名（None＝D3 约定 "register"）
                           flowArgs: Seq[String] = Nil        // body 字段有序清单（空＝整体 body 递交）
                         ) extends ServesTarget // Flow 委托（形态 3·五步编排下沉应用服务）
  // S2-40 R6：读侧——服务读视图（ViewApiController 单行端点族的判定入口；viewKey 查 ApplicationLayer.viewKeys）
  final case class View(viewKey: String) extends ServesTarget
}

/** M2：Req VO 规格（§四双轨——主轨＝命令参数五规则推导；requestBody 显式声明优先（Vega 拍板）；
  *  空集退化→形态 2 write[JsObject]＋emptyBodyReads）。 */
final case class ReqVo(
                        reqName: String,          // "<Cmd>Req"（主轨）／requestBody 类型名（辅轨）／"play.api.libs.json.JsObject"（形态 2）
                        reqFields: Seq[FieldDef], // case class 字段清单（Id/Instant→String 降档·optional→Option[String]·名字已含关键字反引号）
                        hasEmptyBody: Boolean,
                        explicit: Boolean = false // 辅轨：requestBody 显式声明（R5b 直接引用既有 VO·不重复发射 companion）
                      )

/** M3：409 typed payload VO（§五——voKind=format·OFormat 写侧对称；查重条件由既有 invariant 体系承载，此处只声明形状）。 */
final case class ErrorPayloadVo(
                                 errorCode: String,                    // conflict 工厂第一参（如 CONCEPT_NAME_TAKEN）
                                 payloadName: String,                  // VO 名（errorCode→PascalCase 声明式推导，如 ConceptNameTaken）
                                 payloadFields: Seq[(String, String)], // (载荷字段名, 来源路径表达式)
                                 // S2-32 R5c（P1）：errorCode→invariant 条件关联解析的冲突文案（Builder 解析·§五「errorCode 关联
                                 // 既有 invariant 语义」的消费载体）；None＝无 invariant 锚点——发射回退 errorCode 本身（不硬造文案）。
                                 conflictMessage: Option[String] = None
                               )

/** M4：Guard 组成（pairs＝(命令参数名, 取值表达式)——路径键 "id"／body 键 "req.<name>"；binds＝Guard 绑定名）。 */
final case class GuardSpec(pairs: Seq[(String, String)], binds: Seq[String])

/** M5：ctor 实参来源决策（node ctorArgsDsl 的结构化——表达式文本组装归 R5b；逐命令参数有序）。 */
sealed trait CtorArgRef { def paramName: String }
object CtorArgRef {
  final case class FromPathId(paramName: String, bindName: String) extends CtorArgRef         // 路径寻址键→Guard 绑定（conceptCid）
  final case class FromSessionUser(paramName: String, gateKind: GateKind) extends CtorArgRef  // triggeredBy→ts.userId（Tenant）／gc.userId（Global）
  final case class FromSessionTenant(paramName: String) extends CtorArgRef                    // tenant 档 tenantId→Id.of(ts.tenantId)（c898bd0 Id 战役边界）
  final case class FromGeneratedId(paramName: String) extends CtorArgRef                      // 工厂发号→Id.of(generatedId)（聚合同名 Id·N1）
  final case class FromGuard(paramName: String, bindName: String) extends CtorArgRef          // Id 型 body 参数→Guard 绑定（userCid）
  final case class FromInstantGuard(paramName: String, bindName: String) extends CtorArgRef   // Instant 型→InstantGuard 绑定（expiresAtInstant）
  final case class FromBody(paramName: String) extends CtorArgRef                             // 普通 body 字段→req.<name>
  final case class FromBodyOptional(paramName: String) extends CtorArgRef                     // Option 字段→req.<name>（getOrElse 缺省归 R5b）
}

/** M6：寻址轴（§八——R5a 覆盖 path／工厂发号两型；Lane A 业务键（r2/r3/httpKey）留二批）。 */
sealed trait Addressing
object Addressing {
  case object Path extends Addressing    // 路径寻址：entityRef(id)——聚合同名 Id 经端点路径参数
  case object Factory extends Addressing // 工厂发号：entityRef(generatedId)——服务端 UUID（回执＝发号键）
}

// ==========================================
// S2-40 R6：读侧 IR（ViewApiController 发射规格——node model.mjs ViewModel / tpl_views.mjs 语义翻译）
// ==========================================

/** 读端点形态（node 一视图两端点映射——形态由端点签名承载：(page,pageSize)＝分页列表／(entityId)＝单行）。 */
sealed trait ViewForm
object ViewForm {
  case object ListView extends ViewForm  // 分页列表（pageGuard 契约——node 列表端点恒分页，无不分页形态）
  case object ItemView extends ViewForm  // 单行 by-entityId（singleKey）/ 复合键 400（!singleKey）
}

/** R6：读侧端点 IR（ServesView 判定产物——ViewApiController 单行端点＋泛型 helper 族的发射源）。 */
final case class ViewReadModel(
                                viewKey: String,     // viewKey 语义串（helper vk 参——CommandRoleMap.of(vk) 索引）
                                constName: String,   // ViewKeys 常量名（发射引用 ViewKeys.<constName>——banking 支撑件桩已注册）
                                rowType: TypeRef,    // 视图行类型 V（投影 DTO——<Repo>Table 嵌套位·node ROW_TYPE 同构）
                                repository: FieldDef,// 查询注入（投影仓库——findAll/findByIdentity 契约·node repoParam 同位）
                                form: ViewForm,      // list（分页）/ item（by-entityId）
                                singleKey: Boolean   // item 形态（true＝tenantItem/globalItem；false＝compositeItem 400）
                              )

/** M8：聚合级 flags（node buildAggregateController 同构·判定声明驱动升级）。 */
final case class DslFlags(
                           aggHasDsl: Boolean = false,        // 存在非 skip 的门声明端点
                           aggHasEmptyBody: Boolean = false,  // 存在空 body DSL 端点（形态 2→emptyBodyReads）
                           needsParkRepo: Boolean = false,    // errorPayloads 非空（409 查重前置块→投影仓库注入；node EstablishConcept 名字特判的声明化）
                           needsRegisterFlow: Boolean = false // serves=ServesUseCase 存在（Flow 委托注入面；node RegisterUser 名字特判的声明化）
                         )
