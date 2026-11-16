package net.imadz.codegen.scaffolding.cqrs

import net.imadz.meta._

/** 端点解析器（EP_GenerationTime_Code_Anchors S1）——把「元数据里的一个指向」解成**带 FQN 与 id 的端点**。
  *
  * 为什么需要它：元数据层的关系端点**只揣名字**（`MetaRef.targetName`），而图上的边需要两个节点。
  * 那一跳靠既有的 `MetadataRegistry.resolve`（builder 里已有十几处同款调用，如
  * `AggregateConverterBuilder` 的 `resolve[DomainEntityMetadata](meta.entityRef)`）。
  *
  * **两种形态**（实测分野·`flattenAllComponents` 的 `scan` 只匹配 `case m: DomainDrivenMetadata`）：
  *   · 概念级（命令/事件/聚合/读模型/VO…）——**在 registry 里** ⇒ `byRef` 解出。
  *   · 字段级（载荷/读模型/状态字段/命令参数/VO 成员）——`FieldMetadata` **不是** `DomainDrivenMetadata`
  *     （`ArchitectMetadata.scala:147` 是 `MetaType` 直挂 noteId）⇒ **不在 registry 里**，须沿宿主遍历 ⇒ `fieldOf`。
  *
  * **纪律**：解不到就返回 `None`（该条 morphism 不发），**绝不回退成「裸名 + 空类别」的端点**——
  * 漏一条是可知的，错一条是静默的（判例见 `KnowledgeMorphism` 类注释）。
  */
object MorphismEndpoints {

  /** Scala AST `metaCategory` → **真源便签类型**（＝图上 `conceptId` 的前缀）。
    *
    * ⚠ 两套词表**不是同一个**——实测 12 个类别词里 **9 个不同、2 个重合**（`timer`/`externalSystem`）：
    * {{{
    *   图 conceptId 前缀    Scala metaCategory
    *   aggregate            application.aggregates
    *   event                domain.events
    *   command              application.commands
    *   readModel            application.projection
    *   policy               domain.policies
    *   role                 userRole
    *   story                userStory
    *   timer                timer            （重合）
    *   externalSystem       externalSystem   （重合）
    * }}}
    * 故端点必须携带**图侧词**，不能让推送侧藏这张表：那是在**类别层**重犯「裸名」的错
    * （名字会撞 ⇒ 类别也会撞；FQN 才是定位键）。
    */
  private val noteTypeByMetaCategory: Map[String, String] = Map(
    "application.aggregates" -> "aggregate",
    "domain.events" -> "event",
    "application.commands" -> "command",
    "application.projection" -> "readModel",
    "domain.policies" -> "policy",
    "userRole" -> "role",
    "userStory" -> "story",
    "timer" -> "timer",
    "externalSystem" -> "externalSystem",
    // 值对象：真源便签类型仍是 `field`（图上无 valueObject 类别词·VO 以 KnValueObject 承载）
    "domain.values" -> "field",
    "application.valueObjects" -> "field",
  )

  /** Scala AST `metaCategory` → 图侧 `KnField.kind`（`fieldId = "fld:<kind>:<容器>:<名>"` 的 `<kind>`）。
    *
    * **宿主类型 → kind**——与推送侧既有 `ROLE_TO_KIND`（字段角色 → kind）是**同一个 kind 词表**的另一条入口。
    * 端点直接携带 kind，消费侧零翻译：此前只有 domain 词（`event`/`aggregate`…），推送侧还得再查一张
    * `HOST_KIND` 表；而该表与概念词**不是同一套**——实测 `DomainEntityMetadata.metaCategory = domain.entities`
    * 在概念表里**无条目**（实体在图上没有独立概念节点），VO 的概念词又是 `field`（≠ 宿主 kind `vo`）。
    * 两套词表并存正是「裸名」错在类别层重演的温床，故在此一刀切开：概念端点带**概念词**，字段端点带 **kind**。
    *
    * 缺映射 ⇒ 空串（消费侧 fail-closed 拒发，不猜）。
    */
  private val hostKindByMetaCategory: Map[String, String] = Map(
    "domain.events" -> "pl",
    "application.commands" -> "pm",
    "application.projection" -> "rm",
    "domain.entities" -> "st",
    "domain.values" -> "vo",
    "application.valueObjects" -> "vo",
  )

  /** 未映射的 metaCategory 计数（**响亮上报**·不静默给错类别）。 */
  private val unmapped = scala.collection.mutable.LinkedHashSet[String]()
  def unmappedCategories: Seq[String] = unmapped.toSeq

  private def conceptEndpoint(m: DomainDrivenMetadata): ConceptEndpoint =
    ConceptEndpoint(
      fqn = m.fullQualifiedName.dottedPath,           // 既有定义·与 flattenAllComponents 去重键同源
      name = m.name,
      category = noteTypeByMetaCategory.getOrElse(m.metaCategory, {
        unmapped += m.metaCategory; ""                 // 空串＝未映射（消费侧须能看见）
      }),
      noteId = m.noteId
    )

  /** **概念级**：`MetaRef` → 端点（解不到＝`None`）。 */
  def byRef(ctx: GeneratorContext, ref: MetaRef): Option[ConceptEndpoint] =
    ctx.metaRegistry.resolve[DomainDrivenMetadata](ref).map(conceptEndpoint)

  /** **概念级**：按名解（与 `byRef` 同纪律）。 */
  def byName(ctx: GeneratorContext, name: String): Option[ConceptEndpoint] =
    ctx.metaRegistry.resolveByName[DomainDrivenMetadata](name).map(conceptEndpoint)

  /** **字段级**：宿主名 + 字段名 → 端点。
    *
    * 宿主先经 registry 解出，再按宿主类别取**它那一个**字段集合——**5 种形状**集中在这里，不外散：
    * {{{
    *   SubordinateDomainEventMetadata.fields          （事件载荷）
    *   ProjectionMetadata.readModelSchema.fields      （读模型字段·Option）
    *   DomainEntityMetadata.state.fields              （实体状态字段）
    *   ValueObjectMetadata.fields                     （VO 成员）
    *   SubordinateCommandMetadata.parameters          （命令参数）
    * }}}
    */
  def fieldOf(ctx: GeneratorContext, ownerName: String, fieldName: String): Option[FieldEndpoint] = {
    val host = ctx.metaRegistry.resolveByName[DomainDrivenMetadata](ownerName)
    val found: Option[Option[String]] = host.flatMap {
      case e: SubordinateDomainEventMetadata => e.fields.find(_.name == fieldName).map(_.noteId)
      case p: ProjectionMetadata =>
        p.readModelSchema.flatMap(_.fields.find(_.name == fieldName)).map(_.noteId)
      case d: DomainEntityMetadata => d.state.fields.find(_.name == fieldName).map(_.noteId)
      case v: ValueObjectMetadata => v.fields.find(_.name == fieldName).map(_.noteId)
      case c: SubordinateCommandMetadata => c.parameters.find(_.name == fieldName).map(_.noteId)
      case _ => None
    }
    for {
      h <- host
      noteId <- found
    } yield FieldEndpoint(
      ownerFqn = h.fullQualifiedName.dottedPath,
      owner = h.name,
      ownerKind = hostKindByMetaCategory.getOrElse(h.metaCategory, {
        unmapped += h.metaCategory; ""                 // 空串＝未映射 ⇒ 推送侧拒发（不猜 kind）
      }),
      field = fieldName,
      noteId = noteId
    )
  }
}
