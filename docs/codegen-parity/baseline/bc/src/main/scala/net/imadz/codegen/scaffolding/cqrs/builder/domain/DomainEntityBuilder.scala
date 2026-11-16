package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.{
  DomainEntityModel,
  EventFamilyModel,
  EventModel,
  StateModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta.{
  ConceptEndpoint,
  DomainDrivenMetadata,
  DomainEntityMetadata,
  DomainEventMetadata,
  EventFamilyMetadata,
  FieldMetadata,
  LandingKind,
  MappingMorphism,
  MorphismDimension,
  PathEndpoint,
  RelationWord,
  SubordinateDomainEventMetadata,
  ValueObjectMetadata
}

object DomainEntityBuilder {
  def build(
      meta: DomainEntityMetadata,
      ctx: GeneratorContext
  ): DomainEntityModel = {
    val pkg = ctx.layout.domain.entities.root

    // 解析自类型
    val selfType = resolveSelfType(meta, ctx)

    // 构建状态模型
    val stateFields = emittedStateFields(meta, ctx)
    val stateModel = buildStateModel(meta, stateFields, ctx)

    // 构建事件族模型
    val familyModel = buildEventFamilyModel(meta, ctx)

    // 收集并过滤依赖
    val dependencies = collectDependencies(stateModel, familyModel, pkg)

    DomainEntityModel(
      selfType = selfType,
      state = stateModel,
      eventFamily = familyModel,
      dependencies = dependencies,
      morphisms = morphismsOf(stateFields, meta.state.name)
        ++ containerStatusMorphisms(stateFields, meta, selfType),      // S7：容器级知识 id（继承所属聚合）——模板据此在 object 前发裸行 @knowledge
      noteId = meta.noteId
    )
  }

  /** ★ 容器级 `status` 态射（EP_GenerationTime_Code_Anchors S7 #4·R1 收口）。
    *
    * 判据：`status` 是 `(state, event) => state` **折叠**的产物——用户裁定逐字
    * 「理论上 event 当中不应该包含 status」（故不设字段级端点，也不从载荷找），
    * 「实在找不到就把**所有的事件类型以及 state 类型**放上去，这个肯定说得通，
    * **代表他们下边所有字段**」。
    *
    * 落点：本文件内的**容器锚**（`object <X>Entity`·S7 已发射），边上标 `precision=容器级`。
    * 触发条件（**精确**，不误伤已解析的 96 条）：`
    *   - 状态字段名为 `status`；
    *   - 该字段**自身无知识 id**（有 id 说明它是正常字段锚·字段级解析会成功·不该降级容器）；
    *   - 事件族非空。
    *
    * 源＝**事件族全集**（不是 `writtenBy` 声明的子集）：折叠语义就是「这条状态机的
    * 全部转移共同决定 status」，声明子集只是「值被显式赋值」的那部分——两者语义不同。
    * 实测差：声明并集 58 条 < 全集 83 条，多出的 25 条正是「不显式写 status 但参与状态转移」的事件
    * （如 `ProjectDescriptionUpdated` 改描述不碰 status）。
    *
    * `status` 在真源**本无号**（R1 根因）——源端不编造号，端点概念锚自带的号如实带上（`noteId`）。
    */
  private def containerStatusMorphisms(
      stateFields: Seq[FieldMetadata],
      meta: DomainEntityMetadata,
      selfType: TypeRef
  ): Seq[MappingMorphism] = {
    val statusField = stateFields.find(f => f.name == "status" && f.noteId.isEmpty)
    statusField match {
      case None => Nil
      case Some(_) if meta.eventFamily.events.isEmpty => Nil
      case Some(_) =>
        meta.eventFamily.events.map { ev =>
          MappingMorphism(
            RelationWord.WrittenBy,
            MorphismDimension.Derived,
            // 源端点＝事件概念（概念级）。fqn 用图侧 category 词（`event`）——与 ConceptEndpoint 注释口径一致；
            // 号取事件元数据自带的（真源 358/358 全有号·实测），不编造。
            ConceptEndpoint(s"event.${ev.name}", ev.name, "event", ev.noteId),
            member = "status",
            memberOwner = Some(meta.state.name),
            memberNoteId = None,
            landing = LandingKind.Container,
            containerFqn = Some(s"${selfType.packageName}.${selfType.name}")
          )
        }
    }
  }

  /** ★ `st` 面态射（EP_GenerationTime_Code_Anchors S3）——**builder 显式构造**「这个状态字段的值从哪来」。
    *
    * 真源＝`FieldSpec.writtenBy`（②层状态字段 475 条引用·5 种语法形态：整事件／载荷字段／VO 成员／
    * 列表成员／VO 内列表）。此前该键**从未离开 `FieldModel`**（只随草稿 JSON 往返），
    * ⇒ 这条派生关系在图上只有**知识侧**（`KN_DERIVES_FROM` 398 条）而**代码侧零锚**。
    *
    * 关系词＝`writtenBy`（词表 canonical·`stateField -> eventPath`·obligation=REGEN）——
    * 与 rm 面 S2 用的是**同一个词**，因为词表语义逐字相同（「状态字段的值来自事件载荷路径」），
    * 差别只在落点面（此处落在实体状态字段，S2 落在视图 DTO 字段）。
    *
    * 端点为 **`PathEndpoint`（路径原文）**：路径语法的唯一实现在 Node 侧 `tools/writtenby_lib.mjs`
    * （语法校验 ＋ fail-closed resolve），Scala 侧**只搬运不解释**——判例见 `PathEndpoint` 类注释。
    * 附带收益：推送侧对 `KN_DERIVES_FROM` 与代码侧锚用的是**同一次解析**，两侧不会各解各的。
    *
    * `writtenBy` 为空的字段**不发**（无源即无派生关系·不编造）。
    *
    * ★ S7 #4（R1 收口）**抑制条件**：`status` **无号**时其字段级行不发（Container 形态接管·见下）。
    * 判据（用户裁定逐字「理论上 event 当中不应该包含 status」）：这类行的 `writtenBy` 声明是
    * **错模型**——事件载荷 `X.status` 在真源里不存在（写作 `X` 整事件），字段级必解不出；
    * 而 `status` 有号的容器（如 `KnowledgePatchState.status`·载荷确有同名字段）**照发不误**。
    * 不发＝不产生「注定落空的边」，也不与容器级行重复表述同一关系（一条关系只落一处）。
    */
  private def morphismsOf(stateFields: Seq[FieldMetadata], stateName: String): Seq[MappingMorphism] =
    stateFields
      .filterNot(f => f.name == "status" && f.noteId.isEmpty)
      .flatMap { f =>
        f.writtenBy.map(w =>
          MappingMorphism(RelationWord.WrittenBy, MorphismDimension.Derived, PathEndpoint(w), f.name,
            // 落点消歧**双键**（S3 判例）：同一实体文件里状态字段与事件载荷字段同名，且真源里两者
            // **共享同一个 id**（实测 `Project.catalogId` 与 `ProjectInitiated.catalogId` 同为 `d4e7c8a1-…`）
            // ⇒ id 不足以消歧，须由「成员直接所属类型」（＝状态模型名）收敛。
            memberOwner = Some(stateName),
            memberNoteId = f.noteId))
      }

  /** 解析领域实体的自类型
    */
  private def resolveSelfType(
      meta: DomainEntityMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.entity(meta.name)
  }

  /** 实际发射的状态字段（nature 排除后）——**模型与态射取同一个列表**：
    * 两者若各过滤一次，排除的字段会在态射里留一条无落点的边（漏一条是可知的，错一条是静默的）。
    */
  private def emittedStateFields(meta: DomainEntityMetadata, ctx: GeneratorContext): Seq[FieldMetadata] =
    meta.state.fields.filterNot(ctx.isStateFieldExcluded)

  /** 构建状态模型
    */
  private def buildStateModel(
      meta: DomainEntityMetadata,
      stateFields: Seq[FieldMetadata],
      ctx: GeneratorContext
  ): StateModel = {
    StateModel(
      name = meta.state.name,
      selfType = ctx.typeResolver.entityState(meta.state.name),
      fields = buildStateFields(stateFields, ctx)
    )
  }

  /** 构建状态字段定义（EP Phase 3(a)：锚定排除的 nature 字段不发射——如 credential 不进聚合状态列） */
  private def buildStateFields(
      fields: Seq[FieldMetadata],
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    fields.map { f =>
      val resolved = ctx.typeResolver.resolve(f.fieldType)
      FieldDef(f.name, resolved, emptyDefaultFor(resolved), noteId = f.noteId, description = f.description)
    }
  }

  /** 空实体状态下集合/Option 字段的默认值；标量返回 None（模板落成 ???，作为 TDD Red 标记） */
  private def emptyDefaultFor(t: TypeRef): Option[String] = t.name match {
    case "Map"    => Some("Map.empty")
    case "List"   => Some("List.empty")
    case "Seq"    => Some("Seq.empty")
    case "Set"    => Some("Set.empty")
    case "Vector" => Some("Vector.empty")
    case "Option" => Some("None")
    case _        => None
  }

  /** empty() 工厂参数的中性默认值（S2-8：标量不再落 ???，防止运行时实体创建 NotImplementedError）。
    * 与行为侧 rules_domain_gen.mjs defaultLiteral 同源约定；仅用于 empty() 参数，不改 case class 字段签名。 */
  def neutralValueFor(t: TypeRef): Option[String] = t.name match {
    case "Id"                                   => Some("""net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")""")
    case "String"                               => Some("\"\"")
    case "Int" | "Integer"                      => Some("1")
    case "Long"                                 => Some("1L")
    case "Boolean"                              => Some("false")
    case "Double" | "Float"                     => Some("1.0")
    case "BigDecimal"                           => Some("BigDecimal(1)")
    case "Instant"                              => Some("null")
    case "Map"                                  => Some("Map.empty")
    case "List" | "Seq" | "Set" | "Vector"      => Some("Nil")
    case "Option"                               => Some("None")
    case _                                      => Some("null")
  }

  /** 构建事件族模型
    */
  private def buildEventFamilyModel(
      meta: DomainEntityMetadata,
      ctx: GeneratorContext
  ): EventFamilyModel = {
    val familyTypeName = meta.eventFamily.name
    val familyTypeRef = ctx.typeResolver.eventFamily(familyTypeName)
    val serializationInterface = ctx.knownFrameworkTypes("CborSerializable")

    val distinctEvents = meta.events.filterNot(_.name == familyTypeName)
    val eventModels = buildEventModels(distinctEvents, familyTypeRef, ctx)

    EventFamilyModel(
      name = familyTypeName,
      selfType = familyTypeRef, // [NEW] 填入 selfType 用于嵌套注册
      events = eventModels,
      superTypes =
        Seq(serializationInterface) // [New] Family 继承 CborSerializable
    )
  }

  /** 构建事件模型列表
    */
  private def buildEventModels(
      events: Seq[DomainEventMetadata],
      familyTypeRef: TypeRef,
      ctx: GeneratorContext
  ): Seq[EventModel] = {
    events.map { evt =>
      // 计算每个 Event 的 selfType
      val eventTypeRef = TypeRef(evt.name, familyTypeRef.fqn)
      EventModel(
        name = evt.name,
        selfType = eventTypeRef, // [NEW] 填入 selfType 用于嵌套注册
        fields = buildEventFields(evt.fields, ctx),
        superTypes = Seq(familyTypeRef) // 继承 Family
      )
    }
  }

  /** 构建事件字段定义
    */
  private def buildEventFields(
      fields: Seq[FieldMetadata],
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    fields.map(f =>
      if (f.optional)
        // Controller 三可选参根治批 2026-10-05：optional 事件载荷 → Option[T] = None 直译
        //（真源 6 事件 payload 同标 optional·converter 侧 Option 直通先例 ReadModelDefinitionProtoConverters）
        FieldDef(f.name, TypeRef.Option(ctx.typeResolver.resolve(f.fieldType)),
          defaultValue = Some("None"), noteId = f.noteId, description = f.description)
      else
        FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType), noteId = f.noteId, description = f.description)
    )
  }

  /** 收集并过滤依赖
    */
  private def collectDependencies(
      stateModel: StateModel,
      familyModel: EventFamilyModel,
      pkg: String
  ): Set[TypeRef] = {
    // 收集所有的依赖类型
    val rootRefs = collectRootReferences(stateModel, familyModel)
    val allDeps = rootRefs.flatMap(_.collectAllDependencies).toSet

    // 过滤掉不需要 import 的包
    // [FIX] Do NOT filter by shouldImport for ArtifactModel dependencies.
    // The Graph needs ALL dependencies. Import filtering must happen in templates.
    allDeps
      .filter(_.shouldImport(pkg))
  }

  /** 收集根引用
    */
  private def collectRootReferences(
      stateModel: StateModel,
      familyModel: EventFamilyModel
  ): Seq[TypeRef] = {
    stateModel.fields.map(_.typeRef) ++
      familyModel.events.flatMap(_.fields.map(_.typeRef)) ++
      familyModel.events.flatMap(_.superTypes) ++ // Event 的继承 (Family)
      familyModel.superTypes // Family 的继承 (CborSerializable)
  }
}
