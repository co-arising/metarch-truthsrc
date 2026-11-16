package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

// --- Model 定义 ---

case class ApplicationServiceModel(
                                    override val selfType: TypeRef, // e.g. CreateCreditBalanceService
                                    methods: Seq[ApplicationServiceMethodModel], // Service 方法
                                    override val dependencies: Set[TypeRef]
                                  ) extends ArtifactModel

case class ApplicationServiceMethodModel(
                               name: String,
                               parameters: Seq[FieldDef],
                               returnType: TypeRef,
                               bodyLogic: String = "???",                            // 核心业务逻辑代码
                               invokesCommands: Seq[TypeRef]                 // 调用的 Command 类型
                             )

