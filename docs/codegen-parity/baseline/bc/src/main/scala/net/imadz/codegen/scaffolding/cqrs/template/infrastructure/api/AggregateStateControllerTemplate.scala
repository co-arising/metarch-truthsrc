package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.AggregateStateControllerModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** S1 聚合面（2026-09-27 用户拍板）：AggregateStateApiController 渲染。
  *
  * 每聚合一个方法：api.global.read()（auth 简化档）→ IdGuard 解析 :id →
  * repository.entityRef(id).ask(Get<X>State) → reply 直接返回。
  *
  * 序列化**收在本控制器**（用户裁决：Json 不进 domain/application 包）：
  * 每聚合私有 `writes<X>State: OWrites[<X>State]` 逐字段 Json.obj 手写——
  * 不依赖宏（>22 字段 case class 无合成 unapply，Json.format 宏走不通·实测 23 字段即炸）、
  * 无字段数上限；Instant/Id 等非基本类型的私有 Writes 定义在各 state writes **之前**（作用域可见性）。
  */
object AggregateStateControllerTemplate extends CodeTemplate[AggregateStateControllerModel] {

  def generate(model: AggregateStateControllerModel): String = {
    val importLines = (model.dependencies.toList.sortBy(_.fqn).map(_.fqn) ++ Seq(
      "java.time.Instant",
      "javax.inject.Inject",
      "javax.inject.Singleton",
      "net.imadz.common.CommonTypes.Id",
      "net.imadz.common.auth.Endpoint",
      "net.imadz.common.auth.ApiError",
      "net.imadz.metarch.infrastructure.api.IdGuard",
      "play.api.libs.json.{JsValue, Json, OWrites, Writes}",
      "play.api.mvc._",
      "scala.concurrent.ExecutionContext",
      "scala.concurrent.duration._"
    )).distinct
      .map(i => s"import $i")
      .mkString("\n")

    // 非基本类型 Writes：控制器级单份（26 聚合共享——Instant/Id 的私有隐式，定义在全部 state writes 之前）
    val anyInstant = model.entries.exists(_.stateFields.exists(_.typeRef.signature.contains("Instant")))
    val anyId = model.entries.exists(_.stateFields.exists(f => f.typeRef.signature.contains("Id") && f.typeRef.name != "String"))
    val sharedWriters =
      (if (anyInstant)
        """  // Instant → ISO-8601 串（用户裁决：序列化收 controller 层——不进 domain）
  //  null-safe：empty 状态的 Instant 中性值是 null（生成器 empty 工厂），写 JsNull 不炸（J-11：Option 组合子形）
  private implicit val s1InstantWrites: Writes[java.time.Instant] =
    (i: java.time.Instant) => play.api.libs.json.Json.toJson(Option(i).map(_.toString))
"""
       else "") +
        (if (anyId)
          """  // Id(UUID) → 串（同上·controller 层私有·null-safe）
  private implicit val s1IdWrites: Writes[net.imadz.common.CommonTypes.Id] =
    (i: net.imadz.common.CommonTypes.Id) => play.api.libs.json.Json.toJson(Option(i).map(_.toString))
"""
         else "")

    // 逐聚合：OWrites[XState]（Json.obj 逐字段手写——不走 Json.format 宏：>22 字段 case class 无合成 unapply）
    val writers = model.entries.map { e =>
      val st = e.stateType.getOrElse(e.replyType)
      val pairs = e.stateFields.map { f =>
        val t = f.typeRef.signature
        val id = net.imadz.codegen.structure.NamingConventions.scalaIdentifier(f.name)
        s""""${f.name}" -> play.api.libs.json.Json.toJson[$t](st.$id)"""
      }.mkString(",\n    ")
      s"""  /** S1 聚合面：${st.name} → JSON（逐字段手写·无字段数上限） */
  private val writes${st.name}: OWrites[${st.fqn}] = (st: ${st.fqn}) => play.api.libs.json.Json.obj(
    $pairs)
"""
    }.mkString("\n")

    val replyWriters = model.entries.map { e =>
      val st = e.stateType.getOrElse(e.replyType)
      s"""  /** S1 聚合面：${e.replyType.name} 信封（state 字段平铺）——implicit 供 DSL apply[T] 隐参取用 */
  private implicit val writes${e.replyType.name}: OWrites[${e.replyType.fqn}] =
    (r: ${e.replyType.fqn}) => (writes${st.name}: OWrites[${st.fqn}]).writes(r.state)"""
    }.mkString("\n")

    val methods = model.entries.map { e =>
      s"""  /** S1 聚合面：${e.routeSegment} 写侧状态强一致查询（Get<X>State → Reply·不产事件） */
  def ${e.methodName}(id: String): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.global.read().apply[${e.replyType.fqn}] {
      _ => {
        IdGuard.parse("${e.idParam}" -> id) match {
          case Right(Seq(${e.idParam}Cid)) =>
            ${e.repository.name}.entityRef(id).ask {
              (replyTo: akka.actor.typed.ActorRef[${e.replyType.fqn}]) => ${e.getIdCommand.fqn}(${e.idParam}Cid, replyTo)
            }.map(reply => Right(reply): Either[ApiError, ${e.replyType.fqn}])
          case Left(err) => scala.concurrent.Future.successful(Left(err): Either[ApiError, ${e.replyType.fqn}])
        }
      }
    }"""
    }.mkString("\n\n")

    s"""package ${model.selfType.packageName}

$importLines

/** AggregateStateApiController: S1 聚合面写侧强一致状态查询（每聚合 Get<X>State 直读·2026-09-27 生成范式）
  * 序列化收在 controller 层（用户裁决：domain/application 不引入 play-json）。 */
@Singleton
class ${model.selfType.name} @Inject() (api: Endpoint, ${model.entries.map(e => s"${e.repository.name}: ${e.repository.typeRef.fqn}").mkString(", ")}, val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {

  override def controllerComponents: ControllerComponents = cc
  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)

$sharedWriters
$writers
$replyWriters

$methods

}"""
  }
}
