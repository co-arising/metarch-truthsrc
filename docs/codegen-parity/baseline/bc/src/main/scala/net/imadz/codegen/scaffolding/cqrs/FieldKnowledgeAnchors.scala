package net.imadz.codegen.scaffolding.cqrs

import net.imadz.meta.{
  AggregateIdentity,
  ComputedField,
  ConstantField,
  DirectField,
  FieldDerivation,
  FieldMetadata,
  ParameterMetadata,
  SystemMetadata,
  UnresolvedField
}

/** 字段知识锚点的一行——「这个生成侧字段出自哪个知识元素」。
  *
  * @param owner   容器（解空间容器＝模型元素名：聚合/命令/事件/VO/服务）
  * @param field   字段名
  * @param role    字段角色（state/identifier/parameter/payload/voMember/serviceParam）
  * @param noteId 便签时态稳定知识 id（容器便签 noteId 或 VO noteId）
  */
final case class FieldKnowledgeAnchor(
    owner: String,
    field: String,
    role: String,
    noteId: String
)

/** 字段知识锚点求解（EP_Note_Tense_Knowledge_Id 末段）。
  *
  * 生成侧已把 `noteId` 接通到 `FieldDef`（builder 透传），但**尚未落盘**——
  * 本件把「哪条知识 id 落在哪个容器的哪个字段上」解成可落盘的行集，
  * 供 `GenerationLedger` 写成 `.codegen-ledger.json` 的**顶层 `fieldAnchors` 键**
  * （顶层而非 `artifacts[]` 行内：`ledger_append.mjs` upsert 只动 `doc.artifacts`，
  * 顶层键天然存活，不被覆盖丢数据）。
  *
  * **只列有知识身份的字段**——合成/技术字段（replyTo、注入审计字段等）`noteId=None`，
  * 本就无知识来源，不列（不是假接）。空集是合法负断言。
  */
object FieldKnowledgeAnchors {

  def solve(system: SystemMetadata): Seq[FieldKnowledgeAnchor] = {
    val out = scala.collection.mutable.ListBuffer[FieldKnowledgeAnchor]()

    // 聚合状态字段：aggregate.stateRef 指向**实体状态 VO 名**（如 LoanApplicationState），
    // 不是实体名（LoanApplicationEntity）——故按 state.name 建索引。
    val stateByRef: Map[String, Seq[FieldMetadata]] =
      system.domain.entities.map(e => e.state.name -> e.state.fields).toMap
    for (agg <- system.application.aggregates) {
      stateByRef.get(agg.stateRef.targetName).foreach { fields =>
        // identifier 已并入 state.fields 首字段；role 区分 identifier 与 state
        fields.zipWithIndex.foreach { case (f, i) =>
          f.noteId.foreach { kid =>
            val role = if (f.name == agg.identifier.name) "identifier" else "state"
            out += FieldKnowledgeAnchor(agg.name, f.name, role, kid)
          }
        }
      }
    }

    // 命令参数：SubordinateCommandMetadata.parameters（replyTo 等技术参数无 id → 自动不列）
    for (agg <- system.application.aggregates; cmd <- agg.commandFamily.commands; p <- cmd.parameters)
      p.noteId.foreach(kid => out += FieldKnowledgeAnchor(cmd.name, p.name, "parameter", kid))

    // 事件载荷
    for (e <- system.domain.entities.flatMap(_.eventFamily.events); f <- e.fields)
      f.noteId.foreach(kid => out += FieldKnowledgeAnchor(e.name, f.name, "payload", kid))

    // VO **概念级**锚点（2026-09-20）：owner＝VO 名·field＝"(concept)"——与成员行区分。
    // voMember 面已由 FieldMetadata 承载；本行是 VO 自身作为知识元素的落点。
    for (vo <- system.domain.valueObjects ++ system.application.valueObjects)
      vo.noteId.foreach(kid => out += FieldKnowledgeAnchor(vo.name, "(concept)", "voConcept", kid))

    // VO **成员级**锚（EP_GenerationTime_Code_Anchors P2 补）：VO 的每个字段各有知识身份，
    // 与上面那行（VO 自身）不同层。**必须补齐**——P2 把 Node 侧从「回读真源 fieldModel 枚举」
    // 改为「只搬台账」，而旧枚举本来就含 `fieldModel.valueObjects[].fields`；
    // 台账不补这一支，vo 面 noteId 覆盖会从 40 直接掉到 0（静默回退）。
    for {
      vo <- system.domain.valueObjects ++ system.application.valueObjects
      f  <- vo.fields
      kid <- f.noteId
    } out += FieldKnowledgeAnchor(vo.name, f.name, "voMember", kid)

    // 读模型字段（EP_GenerationTime_Code_Anchors P1·用户拍板决策 1「A 本体口径」）：
    // 视图字段**有自己的知识身份**——storyMapping 的 `readModelField` 便签（真源 562/562 全带 id），
    // 与同名事件载荷字段是不同便签、不同 id。此前 `solve` 完全不走 `infrastructure.projections`，
    // 这是「生成期只产出了一半」的机制（rm 面在图上恒 0 的直接原因之一）。
    for {
      p      <- system.infrastructure.projections
      schema <- p.readModelSchema.toSeq
      f      <- schema.fields
      kid    <- f.noteId
    } out += FieldKnowledgeAnchor(p.name, f.name, "readModelField", kid)

    out.toList
  }
}

// ── 2026-09-23 S2b：旧「全局后置派生锚求解器」（`DerivedKnowledgeAnchor` ＋ `DerivedKnowledgeAnchors.solve`）已删除。
// 删除条件（本批已满足·见 S2 提交 c9914fa9 的逐条对账）：其全部产出（rm 面 385 行）已由
// `ProjectionRepositoryBuilder.morphismsOf` **在 builder 内显式构造**取代，且差异**逐条可解释**
//   · 24 条＝端点语义修正（AggregateIdentity：identifier 字段 → 聚合本体·对齐 `rmOf` 登记端点）
//   · +9 条＝源为合成字段（tenantId/removedAt·无便签）但 fqn 在 ⇒ 按设计发射
// 保留两套＝「看着像生效、实为零作用」的温床（旧键当时全仓零消费者），故delete 而非并存。
