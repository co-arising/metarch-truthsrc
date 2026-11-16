package net.imadz.codegen.scaffolding.cqrs.model.domain


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

// --- Model (纯数据) ---
case class ValueObjectModel(
                             override val selfType: TypeRef,
                             fields: Seq[FieldDef],
                             override val dependencies: Set[TypeRef],
                             logicMethods: Seq[String] = Nil,
                             /** S7 #2（#22）：台账行全量知识号——自有号（②层 template 铸）或元建模族装配派生
                               * VO 的「携带者并集」（事件∪命令·`MergeEngine.derivedValueObjectIds`）。
                               * 语义＝「这个 VO 出自哪些知识元素」·落 `artifacts[]` 行 `noteIds`（多值槽）。 */
                             voNoteIds: Seq[String] = Nil,
                             /** S7 #2（#22）：注解面**自有号**（单号·②层铸）。
                               * 与 `voNoteIds` 分开的理由：携带者号是**别的元素**的便签号，发注解会被
                               * `kn_push_code_anchors` 的孤儿校验判为「代码有真源无」（新造孤儿）——
                               * 故注解面只发自有号；无自有号者（15 个装配派生 VO）**源码零注解**（如实不冒充）。 */
                             voOwnNoteId: Option[String] = None
) extends ArtifactModel {

  /** S7（EP §二 G1）：VO 概念级号——台账 artifacts[] 的**文件级落点**由此可查（此前无号）。 */
  override def noteIds: Seq[String] = voNoteIds
}
