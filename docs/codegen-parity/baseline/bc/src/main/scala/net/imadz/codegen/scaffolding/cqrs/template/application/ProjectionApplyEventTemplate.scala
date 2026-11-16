package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.model.application.ProjectionModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** codegen-multi-project M3（S4 P8）＋Phase 2 债①（方言 v2·2026-10-04）：
  * `<View>ApplyEvent.scala` kernel 纯函数族——四形发射：
  *   create            on<E>(existing: Option[V], e: E): V ＝ existing.getOrElse(emptyRow).copy(...)
  *   updateOnly        on<E>(row: V, e: E): V            ＝ 行签名（壳 ViewMachine.updateOnly·查无静默跳过）
  *   delete            on<E>(e: E): (String, String)     ＝ 键元组（壳 match 直调 repo.delete）
  *   persistenceIdCreate on<E>(e: E, entityId: String): V ＝ emptyRow(entityId, tenantId) 参数化基座（壳 entityId 寻址）
  * degraded（无 refCode）→ ??? 落桩诚实降级（不静默错写）。
  * 金样＝di-poc CaptureNote/FKD/Park/KS/Invite 族（ep-ml-poc3-8 终形·语义灌回真源）。 */
object ProjectionApplyEventTemplate extends CodeTemplate[ProjectionModel] {

  private val ZeroUuid = "Id.of(\"00000000-0000-0000-0000-000000000000\")"

  /** emptyRow 列默认值推导（Phase 2 债②·金样定形六型全覆盖——47 视图 615 列普查仅此八型）：
    * String→"" · Option→None · List→Nil · Id→零UUID（金样 ContainerViews 惯例）·
    * Boolean→false · Int/Long→0 · 其他（VO 成员列）→降级返回 None 由调用方落桩。 */
  private def defaultOf(colType: String): Option[String] = colType match {
    case "String" | ""                                  => Some("\"\"")
    case t if t.startsWith("Option[")                   => Some("None")
    case t if t.startsWith("List[") || t.startsWith("Seq[") => Some("Nil")
    case "Id"                                           => Some(ZeroUuid)
    case "Boolean"                                      => Some("false")
    case "Int" | "Long"                                 => Some("0")
    case "Instant"                                      => Some("None") // 防御臂：裸 Instant 列（口径分叉残留·与 Option 同语义）
    case _                                              => None
  }

  /** 需要外部类型限定符的默认值（Id 用全限定 net.imadz.common.Id.of——文件内零 import 依赖） */
  private def qualify(lit: String): String =
    if (lit == ZeroUuid) s"net.imadz.common.$lit" else lit

  /** 列名 Scala 关键字反引号补缀（emptyRow named-arg 键名——`type` 列判例·Table 列名带反引号） */
  private def col(name: String): String =
    if (Set("type", "match", "class", "def", "val", "var", "object", "case").contains(name)) s"`$name`" else name

  def generate(model: ProjectionModel): String = {
    val viewName = model.selfType.name
    val pkg = s"${model.selfType.packageName}.handlers"
    val pkgDecl = s"package $pkg"
    val persistenceIdMode = model.identityScheme.contains("persistenceId")

    // emptyRow 默认行可用性：全列集在案＋有 create 形函数消费＋每列默认值可推导
    // （不可推导 VO 成员列→整视图降级 ??? 留痕；全复杂折叠→助手不发＝零死代码）
    val createForms = model.applyEvents.filter(ae => ae.applyForm == "create" || ae.applyForm == "persistenceIdCreate")
    val needsEmptyRow = createForms.exists(_.bodyExpr.contains(".copy(")) || createForms.exists(_.bodyExpr.startsWith("emptyRow("))
    val defaultRowLit: Option[String] =
      if (needsEmptyRow && createForms.exists(_.viewColumns.nonEmpty)) {
        val cols = createForms.flatMap(_.viewColumns).distinct
        val lits = cols.map { case (n, t) => n -> defaultOf(t) }
        if (lits.forall(_._2.isDefined))
          Some(lits.map { case (n, d) => s"${col(n)} = ${qualify(d.get)}" }.mkString(", "))
        else None
      } else None

    val functions = model.applyEvents.filterNot(_.applyForm == "degraded").map { ae =>
      // degraded（无 refCode·真源未声明投影意图）不发射函数——诚实缺席（金样 Park
      // 无 onConceptEstablished 判例：壳侧 MANUAL 特例承载·kernel 出 ??? 死函数＝假覆盖面）
      val ev = ae.eventName
      val doc = s"  /** $ev → $viewName（referenceCode 直译·方言 ${ae.applyForm}） */"
      ae.applyForm match {
        case "delete" =>
          val k0 = ae.deletePairs.lift(0).map(_._2).getOrElse("\"\"")
          val k1 = ae.deletePairs.lift(1).map(_._2).getOrElse("\"\"")
          s"""$doc
  def on$ev(e: ${simpleName(ae.eventFqn)}): (String, String) =
    ($k0, $k1)"""
        case "persistenceIdCreate" =>
          val body = ae.bodyExpr
          if (body.contains("emptyRow(") && defaultRowLit.isEmpty)
            s"""$doc
  def on$ev(e: ${simpleName(ae.eventFqn)}, entityId: String): $viewName =
    // [债②降级] 列集含不可推导默认值的列（VO 成员列）——emptyRow 不可发射·诚实降级不静默错写
    existing.getOrElse(???)
"""
          else
            s"""$doc
  def on$ev(e: ${simpleName(ae.eventFqn)}, entityId: String): $viewName =
    $body"""
        case "updateOnly" =>
          s"""$doc
  def on$ev(row: $viewName, e: ${simpleName(ae.eventFqn)}): $viewName =
    ${if (ae.bodyExpr.isEmpty) "row" else ae.bodyExpr}"""
        case "create" =>
          val body = ae.bodyExpr
          if (body.contains("emptyRow") && defaultRowLit.isEmpty)
            s"""$doc
  def on$ev(existing: Option[$viewName], e: ${simpleName(ae.eventFqn)}): $viewName =
    // [债②降级] 列集含不可推导默认值的列（VO 成员列）——emptyRow 不可发射·诚实降级不静默错写
    existing.getOrElse(???)
"""
          else
            s"""$doc
  def on$ev(existing: Option[$viewName], e: ${simpleName(ae.eventFqn)}): $viewName =
    $body"""
        case _ =>
          s"""$doc
  def on$ev(existing: Option[$viewName], e: ${simpleName(ae.eventFqn)}): $viewName =
    // [债①降级] 投影意图无 referenceCode（真源未声明·诚实降级不静默错写）
    existing.getOrElse(???)"""
      }
    }.mkString("\n\n")

    val eventImports = model.applyEvents.map(_.eventFqn).filter(_.nonEmpty).distinct
      .map(fqn => s"import $fqn").mkString("\n")

    // 助手按需发射（金样习语·null-free ts 让步判例：生成版 Option(i).filterNot≡金样 i==null ∪ epoch0 两判）
    val needsTs = model.applyEvents.exists(ae => ae.bodyExpr.contains("ts(e."))
    val tsHelper = if (needsTs)
      "\n  /** epoch0（PO 0L 缺省经 fromProto）→ now（「无时间戳」语义·金样 ts 习语 null-free 终形） */" +
      "\n  private def ts(i: java.time.Instant): Option[java.time.Instant] =" +
      "\n    Some(Option(i).filterNot(_.toEpochMilli == 0L).getOrElse(java.time.Instant.now()))"
    else ""
    val needsStrOr = model.applyEvents.exists(ae => ae.bodyExpr.contains("strOr("))
    val strOrHelper = if (needsStrOr)
      "\n  /** PO String 缺省 null 守卫（金样 KS 习语） */" +
      "\n  private def strOr(s: String): String = Option(s).getOrElse(\"\")"
    else ""
    val needsUpsertBy = model.applyEvents.exists(ae => ae.bodyExpr.contains("upsertBy("))
    val upsertByHelper = if (needsUpsertBy)
      "\n  /** E4 序稳定共享原语（金样 FKD 习语）：keyed upsert——命中原位替换（slot 保留）·否则追加 */" +
      "\n  private def upsertBy[A](list: List[A], item: A)(key: A => Any): List[A] = {" +
      "\n    val k = key(item)" +
      "\n    val idx = list.indexWhere(a => key(a) == k)" +
      "\n    if (idx >= 0) list.updated(idx, item) else list :+ item" +
      "\n  }"
    else ""

    // emptyRow 助手：零参（全字面默认·金样 InviteTenantMember 形）∨ persistenceId 参数化
    // （全部 Id 列取 Id.of(entityId)——金样 Park conceptId/edgeId 双列同 entityId 判例·
    //   tenantId 参数·其余字面默认）
    val emptyRowHelper: String = persistenceIdMode match {
      case true if needsEmptyRow && defaultRowLit.isDefined =>
        val cols = createForms.flatMap(_.viewColumns).distinct
        val paramRow = cols.map { case (n, t) =>
          if (t == "Id") s"${col(n)} = net.imadz.common.Id.of(entityId)"
          else if (n == "tenantId") "tenantId = tenantId"
          else s"${col(n)} = ${qualify(defaultOf(t).get)}"
        }.mkString(", ")
        "\n  /** 族共享空行（债① persistenceId 族·金样 Park/FKD 终形）：identity 列＝entityId 约定" +
        "\n    * （复合键列全取 entityId·R10 租户隔离补列 tenantId 参数）＋copy 覆写即时补真实键。 */" +
        s"\n  private def emptyRow(entityId: String, tenantId: String): $viewName = $viewName($paramRow)"
      case false if needsEmptyRow && defaultRowLit.isDefined =>
        "\n  /** 族共享空行（Phase 2 债②建模·金样终形）：全列字面默认——" +
        "\n    * Id 列＝零 UUID 惯例（金样 ContainerViews 同律）·copy 覆写即时补真实键。 */" +
        s"\n  private def emptyRow: $viewName = $viewName(${defaultRowLit.get})"
      case _ => ""
    }

    s"""$pkgDecl

import net.imadz.metarch.application.projection.repository.${viewName}Table.$viewName
$eventImports

/** $viewName 投影纯函数族（codegen-multi-project M3·S4 P8·referenceCode 直译·债①方言 v2）。
  * kernel 侧零机制依赖（PO 解包/Await 全在 glue 壳 ViewMachine.run）。 */
object ${viewName}ApplyEvent {
$emptyRowHelper$tsHelper$strOrHelper$upsertByHelper

$functions
}
"""
  }

  /** 事件简单名（FQN 尾段·kernel import 面同款） */
  private def simpleName(fqn: String): String = fqn.split('.').last
}
