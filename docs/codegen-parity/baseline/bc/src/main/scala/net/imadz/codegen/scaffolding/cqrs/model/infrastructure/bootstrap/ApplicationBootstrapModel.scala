package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class ApplicationBootstrapModel(
                                      override val selfType: TypeRef,
                                      traits: Seq[TypeRef],
                                      initCalls: Seq[String],
                                      injectedFields: Seq[FieldDef],
                                      /** P5: strict fixture entrypoints the bootstrap spawns as cluster
                                        * singletons (independent namespace; the reconcile token comes from
                                        * deployment configuration — no lenient default). Empty = no wiring. */
                                      strictEntries: Seq[String] = Nil,
                                      override val dependencies: Set[TypeRef],
                                      /** S7 #1c（EP §二 G1）：全局装配件·无单一母元素——收录**全部**聚合号
                                        * （装配件声明「此文件涉及哪些知识」；口径见 .codegen-ledger.json 行）。 */
                                      override val noteIds: Seq[String] = Nil
                                    ) extends ArtifactModel
