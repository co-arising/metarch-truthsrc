package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

// 通用的 Protobuf 文件模型
case class ProtoFileModel(
                           fileName: String,       // e.g. "transactions.proto"
                           packageName: String,    // e.g. "net.imadz.infrastructure.proto"
                           javaPackage: Option[String],    // [FIX] 改为 Option，允许为空
                           imports: Seq[String],   // e.g. Seq("credits.proto")
                           enums: Seq[ProtoEnumModel],
                           messages: Seq[ProtoMessageModel],
                           /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查（聚合族 proto＝
                             * 聚合号；共享面 shared_value_objects 刻意留空——不冒充某一聚合身份）。
                             * 注意形态：`dependencies`/`selfType` 是类体成员，本参数是构造参数——
                             * 与「读模型的号」两回事，勿照抄 ProjectionModel 的 override 形态。 */
                           override val noteIds: Seq[String] = Nil
                         ) extends ArtifactModel {
  override val dependencies: Set[TypeRef] = Set.empty
  override val selfType: TypeRef = TypeRef(fileName, packageName)
}

case class ProtoEnumModel(
                           name: String,
                           values: Seq[(String, Int)]
                         )

case class ProtoMessageModel(
                              name: String,
                              fields: Seq[ProtoField],
                              nestedEnums: Seq[ProtoEnumModel] = Nil,
                              nestedMessages: Seq[ProtoMessageModel] = Nil,
                              oneOfs: Seq[ProtoOneOfModel] = Nil
                            )

sealed trait ProtoField {
  def name: String
  def index: Int
}

case class NormalField(name: String, fieldType: String, index: Int, isRepeated: Boolean = false,
                       /** 三可选参批 2026-10-05：proto3 optional（事件载荷/VO 成员 optional 直译——
                         * scalapb 映射 domain Option[T]·ReadModelDefinitionProtoConverters 先例同形） */
                       isOptional: Boolean = false,
                       /** 字段级版本标记（④层 introducedIn 真源透传）——proto 尾注释发射，重生成不丢 */
                       comment: Option[String] = None,
                       /** EP_GenerationTime_Code_Anchors B2：字段级知识 id（真源透传·缺省 None）。
                         * proto 是**新文件类型**——注释语法不同（无 `@param`·单行 `// @knowledge <id>`），
                         * 推送侧解析器按 `.proto` 后缀走独立分支（见 `kn_push_code_anchors` B2 段）。 */
                       noteId: Option[String] = None) extends ProtoField
case class MapField(name: String, keyType: String, valueType: String, index: Int,
                    /** B2：同 NormalField——Map 字段亦有知识身份（真源 pm/pl/vo 皆可 map 类型）。 */
                    noteId: Option[String] = None) extends ProtoField

case class ProtoOneOfModel(
                            name: String,
                            fields: Seq[NormalField]
                          )
