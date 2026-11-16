package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class AggregateConverterModel(
                                     override val selfType: TypeRef,
                                     parentType: TypeRef, // e.g. PrimitiveConverter
                                     valueObjects: Seq[ConverterDef], // Money, etc.
                                     events: Seq[ConverterDef],
                                     state: Option[ConverterDef],
                                     override val dependencies: Set[TypeRef],

                                     /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
                                     override val noteIds: Seq[String] = Nil
                                   ) extends ArtifactModel

case class ConverterDef(
                         objectName: String,
                         participantType: TypeRef,
                         poType: TypeRef,
                         fields: Seq[FieldDef],
                         repository: Option[FieldDef]
                       )


