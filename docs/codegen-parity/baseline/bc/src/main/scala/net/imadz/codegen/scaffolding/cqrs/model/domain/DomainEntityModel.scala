package net.imadz.codegen.scaffolding.cqrs.model.domain

import net.imadz.codegen.scaffolding.cqrs.{
  ArtifactModel,
  ArtifactRegistry,
  FieldDef,
  TypeRef
}
import net.imadz.meta.MappingMorphism

case class DomainEntityModel(
    override val selfType: TypeRef,
    state: StateModel,
    eventFamily: EventFamilyModel,
    override val dependencies: Set[TypeRef],
    /** EP_GenerationTime_Code_Anchors S3：状态字段的派生态射（`writtenBy`·状态字段 ← 事件载荷路径）。
      * 由 `DomainEntityBuilder.morphismsOf` 显式构造；漏斗处按 `(path, member)` 与代码落点 join。 */
    override val morphisms: Seq[MappingMorphism] = Nil,
    /** EP_GenerationTime_Code_Anchors S7：实体容器的知识 id（**继承所属聚合**·用户裁定「类级不能没有 knowledge」）。
      * 模板据此在 `object <X>Entity` 前发裸行 `@knowledge` ⇒ 容器在代码侧有落点，
      * `status`/`tenantId` 这类折叠/随命令而来的状态字段的**容器级**派生边才有处可挂。 */
    noteId: Option[String] = None
) extends ArtifactModel {

  /** S7：实体容器的号就是本制品承载的知识元素（继承所属聚合）——文件级落点由此可查。 */
  override def noteIds: Seq[String] = noteId.toSeq

  /** 重写自注册：注册自身及嵌套的 EventFamily 和 Event */
  override def registerTo(registry: ArtifactRegistry): ArtifactRegistry = {
    // 1. 注册自己
    val r1 = registry.register(this)
    // 2. 注册 EventFamily
    val r2 = r1.registerNested(eventFamily.selfType, this.selfType)
    // 3. 注册每个 Event
    val r3 = eventFamily.events.foldLeft(r2) { (r, event) =>
      r.registerNested(event.selfType, eventFamily.selfType)
    }

    r3.registerNested(state.selfType, this.selfType)

  }
}

case class StateModel(name: String, fields: Seq[FieldDef], selfType: TypeRef)

// [UPDATED] 增加 selfType 以支持作为 NestedArtifact 注册
case class EventFamilyModel(
    name: String,
    selfType: TypeRef,
    events: Seq[EventModel],
    superTypes: Seq[TypeRef] = Nil
)

// [UPDATED] 增加 selfType 以支持作为 NestedArtifact 注册
case class EventModel(
    name: String,
    selfType: TypeRef,
    fields: Seq[FieldDef],
    superTypes: Seq[TypeRef] = Nil
)
