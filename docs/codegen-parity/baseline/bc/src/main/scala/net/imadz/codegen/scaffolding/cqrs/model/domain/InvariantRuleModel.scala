package net.imadz.codegen.scaffolding.cqrs.model.domain


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class InvariantRuleModel(
                              override val selfType: TypeRef,
                              outputType: TypeRef,
                              subjectType: TypeRef,
                              triggerType: TypeRef,
                              superInterface: TypeRef,
                              conditions: Seq[InvariantConditionModel],
                              override val dependencies: Set[TypeRef]
                            ) extends ArtifactModel

case class InvariantConditionModel(
                            name: String,
                            errorCode: String,
                            errorMsg: String,
                            logicDescription: String
                          )
