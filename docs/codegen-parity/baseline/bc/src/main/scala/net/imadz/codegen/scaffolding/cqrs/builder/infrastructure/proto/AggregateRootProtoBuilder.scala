package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto._
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto.ProtoTypeMapper
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object AggregateRootProtoBuilder {
  // [NEW] 公开此命名逻辑，供 ProjectionBuilder 等其他组件使用
  def getProtoEventName(aggregateName: String): String = {
    NamingConventions.getProtoEventPOName(aggregateName)
  }

  def getProtoEventUnionType(
      aggregateName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.protoEvent(aggregateName, ctx)
  }

  // TypeRef("CreditBalanceEventPO.Event", "net.imadz.banking.infrastructure.proto")
  def getProtoEventFamilyType(
      aggregateName: String,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.protoEventFamily(aggregateName, ctx)
  }

  // [NEW] 如果需要，也可以公开 State 的命名逻辑
  def getProtoStateName(aggregateName: String): String = {
    NamingConventions.getProtoStatePOName(aggregateName)
  }

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): ProtoFileModel = {
    val protoPackage = ctx.layout.infrastructure.proto.root
    val fileName = NamingConventions.getProtoFileName(meta.name)

    // 1. 解析 State 和 Events 的结构
    val stateStruct = resolveStruct(meta.stateRef, ctx)
    val eventStructs = resolveEvents(meta.eventFamilyRef, ctx)

    // 2. 收集所有字段中引用的类型
    val allFields = stateStruct.fields ++ eventStructs.flatMap(_.fields)
    val referencedTypes =
      collectReferencedValueObjects(allFields.map(_.typeRef), ctx)

    // 2a. 跨聚合共享 VO 宿主判定（2026-09-10 实证：KnowledgePatch 事件借 ModelCatalog 的
    // CatalogConflictSet——keon 诉求件史上首例跨聚合 VO 复用；旧逻辑把引用的 VO 整包复刻进
    // 每个引用方 proto，与宿主 proto 撞名 → protoc「seems to be defined in」拒编译）：
    // 粒度＝「VO 组成连通分量」（CatalogConflictSetPO 字段引用 CatalogConflictPO——分属两
    // 宿主时互相 import 成环 protoc 拒编译）。VO 消息在**定义处唯一**，三分：
    //   · 共享面（shared_value_objects.proto）＝跨聚合分量（≥2 聚合引用）⊖ 各聚合 state 本体；
    //   · 本地面＝被本聚合引用（state 或事件）的分量成员 ⊖ 共享面 ⊖ 归别家本地的分量。
    // `collectReferencedValueObjects` 已递归收 VO 字段引用的 VO，localVos 天然含分量传递成员。
    val sharedMessages: Seq[ProtoMessageModel] =
      buildShared(ctx).map(_.messages).getOrElse(Nil)
    val sharedVoNames: Set[String] =
      sharedMessages.map(_.name.stripSuffix("PO")).toSet
    val voOwners = voOwnerMap(ctx)
    val voMetaByName = ctx.metaRegistry
      .resolveAll[ValueObjectMetadata]
      .map(vo => vo.name -> vo)
      .toMap
    // 本聚合本地发射集：引用的 VO 里，属主＝本聚合（含 state 本体与单聚合引用分量）且非共享者。
    // **顺序＝referencedTypes 的自然迭代序**（原 HEAD 行为·Set 序）——不重排，保 golden 逐字节。
    val localVoNames: Seq[String] = referencedTypes.toSeq
      .map(_.name)
      .filter(n => voOwners.get(n).contains(meta.name) && !sharedVoNames.contains(n))
    val localMessages: Seq[ProtoMessageModel] = localVoNames.flatMap { voName =>
      voMetaByName.get(voName).map { voMeta =>
        val fields = voMeta.fields.zipWithIndex.map { case (f, i) =>
          val fType = TypeResolver.resolveField(f.fieldType, f.optional, ctx)
          toProtoField(f.name, fType, i + 1, ctx, fieldComment(f.introducedIn), f.noteId)
        }
        ProtoMessageModel(NamingConventions.getProtoValueObjectPOName(voName), fields)
      }
    }

    // 3a. 外部 VO（引用但本文件不发射）→ import 其定义处文件：共享面 →
    // shared_value_objects.proto；归别家本地的 → 宿主聚合 proto 文件（引用方不复制定义）
    val localVoNameSet = localVoNames.toSet
    val voImports = referencedTypes.toSeq
      .map(_.name)
      .filterNot(localVoNameSet.contains)
      .flatMap { voName =>
        voOwners.get(voName) match {
          case Some(host) if host.isEmpty => Some("shared_value_objects.proto")
          case Some(host)                 => Some(NamingConventions.getProtoFileName(host))
          case None                       => None
        }
      }
      .distinct
      .sorted

    // 4. State Message
    // 同名去重（保留首现）：上游多层装配在个别路径会把事件族字段并入 state 结构
    // （2026-08-26 实证：ConceptStatePO 曾被注入 25 条事件碎片致 protoc 拒编译），
    // 在发射点防御，保证 proto 恒合法；根因治理在装配层另案跟踪。
    val seenStateFieldNames = scala.collection.mutable.Set.empty[String]
    val dedupedStateFields = stateStruct.fields.filter(f => seenStateFieldNames.add(f.name))
    val stateMsg = ProtoMessageModel(
      getProtoStateName(meta.name),
      dedupedStateFields.zipWithIndex.map { case (f, i) =>
        toProtoField(f.name, f.typeRef, i + 1, ctx, f.comment, f.noteId)
      }
    )

    // 5. Event Messages
    // B2b 租户戳（用户拍板 2026-08-26）：除 User 族外，所有事件消息补 tenantId；
    // 已声明 tenantId 的事件幂等跳过；camelCase 对齐既有约定与原生声明族（scalapb 访问器恒为 po.tenantId）
    val tenantStampInScope = meta.name != "User"
    val eventMsgs = eventStructs.map { evt =>
      val base = evt.fields.zipWithIndex.map { case (f, i) =>
        toProtoField(f.name, f.typeRef, i + 1, ctx, f.comment, f.noteId)
      }
      val fields =
        if (!tenantStampInScope || evt.fields.exists(_.name == "tenantId")) base
        else base :+ NormalField("tenantId", "string", base.size + 1)
      ProtoMessageModel(
        NamingConventions.getProtoEventItemPOName(evt.name),
        fields
      )
    }

    // 6. Event Union
    val eventUnionName = getProtoEventName(
      meta.name
    ) // 使用 meta.name (e.g. CreditBalanceAggregate)
    val eventUnion = ProtoMessageModel(
      name = eventUnionName,
      fields = Nil,
      oneOfs = Seq(
        ProtoOneOfModel(
          name = "event",
          fields = eventMsgs.zipWithIndex.map { case (msg, i) =>
            val fieldName =
              ProtoTypeMapper.toLowerCamel(msg.name.stripSuffix("PO"))
            NormalField(fieldName, msg.name, i + 1)
          }
        )
      )
    )

    ProtoFileModel(
      fileName = fileName,
      packageName = protoPackage,
      javaPackage = None,
      imports = voImports,
      enums = Nil,
      messages = localMessages ++ eventMsgs :+ eventUnion :+ stateMsg,
      // S7（EP §二 G1）：proto 文件的知识身份＝**聚合号**（台账 proto 行 schemaNode 即聚合名·
      // 同一约定；本次 27 行全 0 号根因之一＝writeProto 漏斗未合流，已同修）
      noteIds = meta.noteId.toSeq
    )
  }

  /** 共享 VO proto 的 message 名集合（引用方按名判定「我的字段类型在共享文件里吗」）——
    * converter 等下游按此决定 PO 类型的 import 包。从 buildShared 同源派生，避免二处漂移。 */
  def sharedMessageNames(ctx: GeneratorContext): Set[String] =
    buildShared(ctx)
      .map(_.messages.map(_.name).toSet)
      .getOrElse(Set.empty)


  /** VO 属主解析（2026-09-22 根修·分量级判定）——proto VO 消息**定义处**判定，粒度＝
    * 「VO 组成连通分量」（VO 字段引用另一 VO 即同分量）：
    *   `Some(聚合名)`（本地）＝分量恰被一个聚合引用；`Some("")`（共享）＝分量被 ≥2 聚合引用，
    *   收口 `shared_value_objects.proto`。**state 是引用面的一部分**——`CatalogConflict` 是
    *   ModelCatalog 的 state、`CatalogPatchSet` 被 KnowledgePatch state 引用，故二者分量属
    *   其聚合本地；`CatalogConflictSet`/`ConceptIndexEntry` 无 state 引用者且被 ≥2 聚合引用
    *   （ModelCatalog ↔ KnowledgePatch 互相引用）⇒ 共享。分量整体迁移是防互相 import 成环的
    *   关键：CatalogConflictSetPO 字段引用 CatalogConflictPO，分属两宿主时 protoc
    *   「File recursively imports itself」拒编译。聚合按名字母序遍历保证确定性。
    *
    * public（S2-82-B2）：AggregateConverterBuilder 复用同一宿主判定解析 VO PO 的
    * import 包——proto 定义在宿主聚合文件，converter 引用若仍按本聚合包解析则 import 落空
    *（wave2 F5 实证：KnowledgePatchProtoConverters 从 knowledge_packet 包找 CatalogConflictSetPO）。
    */
  def voOwnerMap(ctx: GeneratorContext): Map[String, String] = {
    val aggregates =
      ctx.metaRegistry.resolveAll[AggregateRootMetadata].sortBy(_.name)
    val voMetas = ctx.metaRegistry.resolveAll[ValueObjectMetadata]

    // 并查集：VO 组成分量
    val parent = scala.collection.mutable.Map.empty[String, String]
    def find(x: String): String = {
      var r = x
      while (parent(r) != r) r = parent(r)
      r
    }
    def union(a: String, b: String): Unit = {
      val (ra, rb) = (find(a), find(b))
      if (ra != rb) parent(ra) = rb
    }
    voMetas.foreach(vo => parent.getOrElseUpdate(vo.name, vo.name))
    voMetas.foreach { vo =>
      collectReferencedValueObjects(
        vo.fields.map(f => ctx.typeResolver.resolve(f.fieldType)),
        ctx
      ).foreach(ref => if (parent.contains(ref.name)) union(vo.name, ref.name))
    }

    // 分量引用面：哪些聚合在 **state/事件字段** 里引用过该分量任一成员（state 计入）
    val refAggsOfComp =
      scala.collection.mutable.Map.empty[String, scala.collection.mutable.Set[String]]
    aggregates.foreach { agg =>
      val fieldTypes =
        resolveStruct(agg.stateRef, ctx).fields.map(_.typeRef) ++
          resolveEvents(agg.eventFamilyRef, ctx).flatMap(_.fields.map(_.typeRef))
      collectReferencedValueObjects(fieldTypes, ctx).map(_.name).foreach { n =>
        if (parent.contains(n))
          refAggsOfComp
            .getOrElseUpdate(find(n), scala.collection.mutable.Set.empty[String]) += agg.name
      }
    }

    // 分量级判定：恰一聚合引用 ⇒ 该聚合本地；≥2 聚合引用 ⇒ 共享（空串）；
    // 零引用（冷 VO）⇒ 空串（buildShared 收不产消息·旧行为同）。
    def ownerOf(voName: String): String =
      refAggsOfComp.get(find(voName)) match {
        case Some(aggs) if aggs.size == 1 => aggs.head
        case _                            => ""
      }

    voMetas.map(vo => vo.name -> ownerOf(vo.name)).toMap
  }

  /** 跨聚合共享 VO proto（2026-09-22 根修）：单文件收口，消灭旧机制两个缺陷——
    * ① 单向复用：两聚合互相引用对方 VO 时各 proto 互相 import，protoc「File recursively
    * imports itself」拒编译；② 静默丢失：分量属主被迁到「不引用该 VO」的聚合时该 VO 一处
    * 都不发射。共享面 = `voOwnerMap` 属主**空串**的 VO（≥2 聚合引用的跨聚合分量）**剔除
    * 各聚合 state 本体**——state 消息恒在聚合本地文件发射（即使 state 本体作为事件字段
    * 被别处引用，如 ModelCatalogState 出现在 ModelCatalog 事件载荷），且 state 本体也不
    * 计入它自己文件的共享面。无共享分量 ⇒ None（不产文件）。 */
  def buildShared(ctx: GeneratorContext): Option[ProtoFileModel] = {
    val owners = voOwnerMap(ctx)
    val aggregates = ctx.metaRegistry.resolveAll[AggregateRootMetadata]
    val stateVoNames: Set[String] = aggregates.map(_.stateRef.targetName).toSet
    val voByName = ctx.metaRegistry
      .resolveAll[ValueObjectMetadata]
      .map(vo => vo.name -> vo)
      .toMap

    // 共享面 = 属主空串 ∧ 非 state 本体
    val sharedVos = owners.toSeq
      .filter { case (name, owner) => owner.isEmpty && !stateVoNames.contains(name) }
      .map(_._1)
      .sorted
    if (sharedVos.isEmpty) return None

    val messages = sharedVos.flatMap { voName =>
      voByName.get(voName).map { voMeta =>
        val fields = voMeta.fields.zipWithIndex.map { case (f, i) =>
          val fType = TypeResolver.resolveField(f.fieldType, f.optional, ctx)
          toProtoField(f.name, fType, i + 1, ctx, fieldComment(f.introducedIn), f.noteId)
        }
        ProtoMessageModel(
          NamingConventions.getProtoValueObjectPOName(voName),
          fields
        )
      }
    }

    if (messages.isEmpty) None
    else
      Some(
        ProtoFileModel(
          fileName = "shared_value_objects.proto",
          packageName = ctx.layout.infrastructure.proto.root,
          javaPackage = None,
          imports = Nil,
          enums = Nil,
          messages = messages
        )
      )
  }


  // --- Helpers ---

  case class SimpleStruct(fields: Seq[FieldDef], name: String)

  private def resolveStruct(
      ref: MetaRef,
      ctx: GeneratorContext
  ): SimpleStruct = {
    ctx.metaRegistry
      .resolveByName[ValueObjectMetadata](ref.targetName)
      .map(m =>
        SimpleStruct(
          // EP Phase 3(a)：锚定排除的 nature 字段不进 proto（state 与 VO 两分支同判据·按性质不按容器）
          m.fields.filterNot(ctx.isStateFieldExcluded).map(f =>
            FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType), comment = fieldComment(f.introducedIn), noteId = f.noteId)
          ),
          m.name
        )
      )
      .orElse {
        ctx.metaRegistry
          .resolveByName[DomainEntityMetadata](ref.targetName)
          .map { m =>
            SimpleStruct(
              m.state.fields.filterNot(ctx.isStateFieldExcluded).map(f =>
                FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType), comment = fieldComment(f.introducedIn), noteId = f.noteId)
              ),
              m.state.name
            )
          }
      }
      .getOrElse(SimpleStruct(Nil, ref.targetName))
  }

  private def resolveEvents(
      ref: MetaRef,
      ctx: GeneratorContext
  ): Seq[SimpleStruct] = {
    ctx.metaRegistry
      .resolveByName[EventFamilyMetadata](ref.targetName)
      .map { family =>
        family.events.map { evt =>
          SimpleStruct(
            evt.fields.map(f =>
              // 三可选参批 2026-10-05：resolveField(optional)——事件载荷 optional → Option TypeRef
              //（toProtoField Option 分支发 proto3 optional·此前裸 resolve 丢 optional·WorkgroupMemberInvited 实证）
              FieldDef(f.name, TypeResolver.resolveField(f.fieldType, f.optional, ctx), comment = fieldComment(f.introducedIn), noteId = f.noteId)
            ),
            evt.name
          )
        }
      }
      .getOrElse(Nil)
  }

  /** introducedIn（字段级版本标记）→ proto 尾注释；空白视为未标记 */
  private def fieldComment(introducedIn: String): Option[String] =
    if (introducedIn == null || introducedIn.trim.isEmpty) None
    else Some(introducedIn.trim)

  private def collectReferencedValueObjects(
      types: Seq[TypeRef],
      ctx: GeneratorContext
  ): Set[TypeRef] = {
    val vos = scala.collection.mutable.Set[TypeRef]()

    def scan(t: TypeRef): Unit = {
      if (t.name == "List" || t.name == "Option" || t.name == "Seq" || t.name == "Vector") {
        t.typeParams.foreach(scan)
      } else if (t.name == "Map") {
        t.typeParams.foreach(scan)
      } else if (isValueObject(t, ctx)) {
        if (vos.add(t)) {
          ctx.metaRegistry.resolveByName[ValueObjectMetadata](t.name).foreach {
            meta =>
              meta.fields
                .map(f => ctx.typeResolver.resolve(f.fieldType))
                .foreach(scan)
          }
        }
      }
    }

    types.foreach(scan)
    vos.toSet
  }

  private def isValueObject(t: TypeRef, ctx: GeneratorContext): Boolean = {
    // [FIX] Currency 也被视为基础类型，不需要递归收集 VO 定义
    val primitives = Set(
      "String",
      "Int",
      "Long",
      "Double",
      "Boolean",
      "BigDecimal",
      "Date",
      "DateTime",
      "UUID",
      "Id",
      "Currency"
    )
    !primitives.contains(t.name) && !t.packageName.startsWith(
      "java."
    ) && !t.packageName.startsWith("scala.")
  }

  private def toProtoField(
      name: String,
      t: TypeRef,
      index: Int,
      ctx: GeneratorContext,
      comment: Option[String] = None,
      noteId: Option[String] = None
  ): ProtoField = {
    if (t.name == "Map" && t.typeParams.size == 2) {
      val keyType = ProtoTypeMapper.toProtoTypeString(t.typeParams(0), ctx)
      val valueType = ProtoTypeMapper.toProtoTypeString(t.typeParams(1), ctx)
      MapField(name, keyType, valueType, index, noteId = noteId)
    } else if (t.name == "Option" && t.typeParams.size == 1) {
      // 三可选参批 2026-10-05：proto3 optional（scalapb 映射 domain Option[T]·converter .map 直通）。
      //   内型 List/Seq 退 repeated——proto3 禁 optional repeated，Option[List[X]] 语义折叠为
      //   repeated（None≡空表·converter 侧 Option 分支 .map 兼容 repeated 序列化）。
      val inner = t.typeParams.head
      if (inner.name == "List" || inner.name == "Seq" || inner.name == "Vector") {
        val valueType = ProtoTypeMapper.toProtoTypeString(inner.typeParams.head, ctx)
        NormalField(name, valueType, index, isRepeated = true, comment = comment, noteId = noteId)
      } else {
        val typeName = ProtoTypeMapper.toProtoTypeString(inner, ctx)
        NormalField(name, typeName, index, isOptional = true, comment = comment, noteId = noteId)
      }
    } else if (t.name == "List" || t.name == "Seq" || t.name == "Vector") {
      val valueType = ProtoTypeMapper.toProtoTypeString(t.typeParams.head, ctx)
      NormalField(name, valueType, index, isRepeated = true, comment = comment, noteId = noteId)
    } else {
      val typeName = ProtoTypeMapper.toProtoTypeString(t, ctx)
      NormalField(name, typeName, index, comment = comment, noteId = noteId)
    }
  }
}
