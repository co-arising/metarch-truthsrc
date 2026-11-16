package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.model.domain.ValueObjectModel
import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

// --- Model 定义 ---

/**
 * 查询服务模型 (Read Side / Aggregate Ask)
 * @param selfType e.g. GetBalanceQuery
 * @param methods Query 方法
 * @param structs DTOs 定义在伴生对象中 (仅 Projection Query 需要)
 * @param dependencies 依赖集合
 */
case class QueryServiceModel(
                              override val selfType: TypeRef,
                              methods: Seq[QueryServiceMethodModel],
                              structs: Seq[ValueObjectModel],
                              override val dependencies: Set[TypeRef]
                            ) extends ArtifactModel

/**
 * 查询服务方法模型
 * 与 ApplicationServiceMethodModel 结构相似，但更侧重于查询逻辑和返回 DTO
 */
case class QueryServiceMethodModel(
                                    name: String,
                                    parameters: Seq[FieldDef],
                                    returnType: TypeRef,
                                    bodyLogic: String, // 核心业务逻辑代码
                                    invokesCommands: Seq[TypeRef] // 调用的 Command 类型 (用于 Ask Pattern)
                                  )

// --- Builder 实现 ---

