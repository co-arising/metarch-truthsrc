package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.ProjectionHandlerModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ProjectionHandlerTemplate extends CodeTemplate[ProjectionHandlerModel] {

  /** 多项目模式（codegen-multi-project M3·S4 P8 终形）：handler 壳＝ViewMachine.run 五段接线。
    * kernel 纯函数 `<View>ApplyEvent.on<Event>`（同批 ProjectionApplyEventBuilder 产出）；
    * Await 收编 ViewMachine 运行时一处（判例册 J-9）。单项目模式＝??? 桩（现行·零漂移）。 */
  @volatile var multiProject: Boolean = sys.props.get("codegen.multiProject").contains("true")

  def generate(model: ProjectionHandlerModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(t =>
        t == "javax.inject.Inject" || t.startsWith("scala") || t.startsWith(
          "java.lang"
        )
      )
      .distinct

    val additionalImports = Seq(
      "akka.projection.eventsourced.EventEnvelope",
      "akka.projection.jdbc.scaladsl.JdbcHandler",
      "net.imadz.common.application.projection.ScalikeJdbcSession",
      "scala.concurrent.Future",
      "scala.concurrent.ExecutionContext",
      "javax.inject.Inject"
    )

    val importDecl = imports((baseImports ++ additionalImports): _*)

    // 3. 设置会话类型和处理器接口
    val sessionType = "ScalikeJdbcSession"
    val handlerInterface =
      s"JdbcHandler[EventEnvelope[${model.event.name}], $sessionType]"

    // 4. 强制handler类名以"Handler"结尾，避免与projection object重名
    val actualHandlerName =
      if (model.selfType.name.endsWith("Handler")) model.selfType.name
      else model.selfType.name + "Handler"

    // 5. 构建构造函数参数
    val repoParamName =
      model.repository.name.head.toLower + model.repository.name.tail
    val constructorArgs = s"$repoParamName: ${model.repository.name}"

    // 6. 构建事件处理代码
    // 2026-08-23 生成补丁管线：MANUAL 区块占位——行为侧实现填在 BEGIN/END 之间，
    // 重生成时 apply_manifest 按 MERGE 字节级保留（区块外 ??? 是生成桩，可覆盖）。
    // 多项目模式（M3）：直发 ViewMachine.run 终形——PO 解包 decode＋identity 键＋read/
    // applyEvent（kernel 纯函数指针）/write。Node 直出步（gen_projection_handlers）在本
    // 模式跳过（MANUAL 直出单项目机制保留）。事件族名从依赖 import 推导（*EventPO）。
    // 图视图（*GraphView）投影走 GraphMutationExecutor 通道（S2-65 判例）——ViewMachine 表路径
    // 专用；multi 下图 handler 保持 ??? 桩（手写批补·与 Node 版 GRAPH_RULES 退役同语义）。
    val isGraphView = model.selfType.name.contains("GraphView")
    val handleEventCode = if (multiProject && !isGraphView) {
      val viewName = model.viewName
      val ev = model.concreteEventName
      // PO object 名＝事件族 union 名剥 .Event 后缀（TypeRef name 形如 NoteEventPO.Event）
      val poObj = model.event.name.split('.').head
      // converter 外壳：具体事件 FQN 含 <Agg>Entity. → <Agg>ProtoConverters（converter 命名约定）
      val aggName = model.dependencies
        .find(t => t.name == ev || t.fqn.contains(s".$ev"))
        .flatMap(_.fqn.split('.').find(_.endsWith("Entity")))
        .map(_.stripSuffix("Entity")).getOrElse("")
      // Phase 2 债①三形接线（applyForm 由 ProjectionHandlerBuilder 从真源方言判定·IR 槽直读）：
      //   updateOnly  → ViewMachine.updateOnly（查无静默跳过·宁可空跳不可错写）
      //   delete      → match 直调 repo.delete（kernel 出键·KS 族）
      //   persistenceIdCreate → identity=e=>Seq(entityId,entityId)＋applyEvent 闭包传 entityId（Park 族）
      val tableRef = s"net.imadz.metarch.application.projection.repository.${viewName}Table.${viewName}"
      // kernel 函数缺席探针（degraded 事件）——壳侧无 registry 通路（MVC 分层判例）·
      // 判据＝refCode 非方言头（与 builder headForm 分派同口径）
      val refc = model.logicCode.trim
      val upsertHead = """^upsert by [^:]+:\s*""".r
      val applyEventMissing =
        refc.isEmpty || refc == "???" ||
          !(refc.startsWith("updateOnly(") || refc.startsWith("view.delete(") ||
            refc.startsWith("emptyRow(") || upsertHead.findFirstIn(refc).isDefined ||
            refc.startsWith("view.copy("))
      val decodeArm =
        s"""decode = {
        case $poObj.Event.$ev(po) => Some(net.imadz.metarch.infrastructure.persistence.converters.${aggName}ProtoConverters.${ev}Conv.fromProto(po))
        case _ => None
      }"""
      if (applyEventMissing) {
        // degraded（真源无方言 refCode·kernel 无函数）——诚实降级：??? 桩（MANUAL 块·
        // 行为侧手补·apply 判例④ orphan-MANUAL 保手写）。禁 run/updateOnly 接线（空对象
        // 编译红·UserLookup 族判例）。
        s"""
  override def process(session: $sessionType, envelope: EventEnvelope[$poObj.Event]): Unit = {
    envelope.event match {
      case event: $poObj.Event =>
        // Logic for protobuf event: $poObj.Event
        // 投影意图（元数据 referenceCode）：$refc
        // [债①降级/MANUAL 特例] 投影意图非方言声明（真源 refCode 缺/非方言头·view.manual
        // 特殊逻辑件同族）——诚实降级·MANUAL 块字节保真（apply MERGE·金样 Park Established 判例）
        // ==== BEGIN MANUAL ====
        ??? // 投影意图未建模（UserLookup 双键/re-key 族·行为侧手补）
        // ==== END MANUAL ====
      case _ => () // 非本投影关注事件
    }
  }
"""
      } else model.applyForm match {
        case "delete" =>
          s"""
  override def process(session: $sessionType, envelope: EventEnvelope[$poObj.Event]): Unit = {
    envelope.event match {
      case $poObj.Event.$ev(po) =>
        val e = net.imadz.metarch.infrastructure.persistence.converters.${aggName}ProtoConverters.${ev}Conv.fromProto(po)
        val (t0, t1) = ${viewName}ApplyEvent.on$ev(e)
        $repoParamName.delete(t0, t1) // (sourceType, sourceId) 删行——kernel 出键·壳执行（金样 KS 族）
      case _ => () // 非本投影关注事件
    }
  }
"""
        case "updateOnly" =>
          s"""
  override def process(session: $sessionType, envelope: EventEnvelope[$poObj.Event]): Unit =
    ViewMachine.updateOnly[$ev, $tableRef](
      envelope,
      $decodeArm,
      identity = e => Seq(${if (model.identityKeys.nonEmpty)
        model.identityKeys.map { case (k, present) => if (present) s"e.$k.toString" else "\"\"" }.mkString(", ")
        else "e.tenantId.toString"}),
      read = ids => $repoParamName.findByIdentity(${if (model.identityKeys.isEmpty) "ids(0)"
        else (0 until model.identityKeys.size).map(i => s"ids($i)").mkString(", ")}),
      applyEvent = ${viewName}ApplyEvent.on$ev,
      write = $repoParamName.upsert,
    )
"""
        case "persistenceIdCreate" =>
          s"""
  override def process(session: $sessionType, envelope: EventEnvelope[$poObj.Event]): Unit = {
    val entityId = envelope.persistenceId.toString.split("\\\\|").last
    ViewMachine.run[$ev, $tableRef](
      envelope,
      $decodeArm,
      identity = e => Seq(entityId, entityId),
      read = ids => $repoParamName.findByIdentity(ids(0), ids(1)),
      applyEvent = (existing, e) => ${viewName}ApplyEvent.on$ev(e, entityId),
      write = $repoParamName.upsert,
    )
  }
"""
        case _ =>
          s"""
  override def process(session: $sessionType, envelope: EventEnvelope[$poObj.Event]): Unit =
    ViewMachine.run[$ev, $tableRef](
      envelope,
      $decodeArm,
      identity = e => Seq(${if (model.identityKeys.nonEmpty)
        model.identityKeys.map { case (k, present) => if (present) s"e.$k.toString" else "\"\"" }.mkString(", ")
        else "e.tenantId.toString"}),
      read = ids => $repoParamName.findByIdentity(${if (model.identityKeys.isEmpty) "ids(0)"
        else (0 until model.identityKeys.size).map(i => s"ids($i)").mkString(", ")}),
      applyEvent = ${viewName}ApplyEvent.on$ev,
      write = $repoParamName.upsert,
    )
"""
      }
    } else s"""
  override def process(session: $sessionType, envelope: EventEnvelope[${model.event.name}]): Unit = {
    envelope.event match {
      case event: ${model.event.name} =>
        // Logic for protobuf event: ${model.event.name}
        // 投影意图（元数据 referenceCode）：${model.logicCode}
        // ==== BEGIN MANUAL ====
        ??? // 行为侧实现：repository.upsert(view.copy(...))（手写实现留在本区块，重生成自动保留）
        // ==== END MANUAL ====

      case _ =>
        () // 非本投影事件流：显式跳过。原 ??? 会使未预期事件（跨聚合 tag 串流实证）打爆投影流——Squad-C/BUG-012 家族教训，2026-08-26 模板根治
    }

  }
"""

    // 6. 构建完整源代码
    val classDef = s"""/**
 * $actualHandlerName: 投影处理器，负责处理${model.selfType.name
        .replace("Handler", "")}相关事件
 */// @Singleton
class $actualHandlerName @Inject() ($constructorArgs) extends $handlerInterface {


  $handleEventCode


}
"""

    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$classDef
"""

    // 7. 生成代码
    sourceCode
  }
}
