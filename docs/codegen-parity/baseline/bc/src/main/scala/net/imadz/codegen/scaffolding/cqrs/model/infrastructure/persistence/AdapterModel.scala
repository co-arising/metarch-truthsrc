package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class AdapterModel(
                         override val selfType: TypeRef,
                         scalaRootType: TypeRef,
                         protoRootType: TypeRef,
                         mappings: Seq[AdapterMapping],

                         // [关键修复] 必须包含此字段，用于生成 "with XxxProtoConverters"
                         converterTrait: TypeRef,

                         // 动态转换方法列表 (保留以兼容)
                         converters: Seq[ConverterMethodModel] = Nil,

                         isSnapshot: Boolean = false,
                         override val dependencies: Set[TypeRef],

                         /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
                         override val noteIds: Seq[String] = Nil
                       ) extends ArtifactModel

case class AdapterMapping(
                           scalaCaseName: String,        // e.g. "BalanceChanged"
                           protoOneOfName: Option[String], // e.g. "BalanceChanged" (OneOf name)
                           protoMessageName: String,     // e.g. "BalanceChangedPO"
                           fields: Seq[FieldMapping] = Nil
                         )

case class FieldMapping(
                         scalaName: String,
                         protoName: String,
                         conversion: ConversionStrategy,
                         scalaType: TypeRef
                       )

case class ConverterMethodModel(
                                 methodNameBase: String,
                                 scalaType: TypeRef,
                                 protoType: TypeRef,
                                 toJournalBody: String,
                                 fromJournalBody: String
                               )

sealed trait ConversionStrategy
case object Direct extends ConversionStrategy
case class CustomConversion(methodNameBase: String) extends ConversionStrategy
case object EnumMapping extends ConversionStrategy
case object OptionWrap extends ConversionStrategy
