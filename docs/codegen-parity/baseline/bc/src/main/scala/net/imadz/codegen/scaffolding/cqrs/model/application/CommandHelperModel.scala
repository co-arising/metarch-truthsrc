package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

// Command Helper Trait 自身
case class CommandHelpersModel(
                                override val selfType: TypeRef,       // e.g. CreditBalanceCommandHelpers
                                helpers: Seq[CommandHelperModel],     // 内部的 implicit objects
                                override val dependencies: Set[TypeRef],
                                /** S7（EP §二 G1）：聚合号——台账 artifacts[] 文件级落点由此可查。 */
                                override val noteIds: Seq[String] = Nil
                              ) extends ArtifactModel

// 单个 Command Helper Object
case class CommandHelperModel(
                               name: String,                         // e.g. AddInitialHelper
                               commandType: TypeRef,                 // Command 类型 (T)
                               stateType: TypeRef,                   // State 类型 (S)
                               paramType: TypeRef,                   // Policy 参数类型 (P)
                               replyType: TypeRef,                   // Reply 类型 (R)
                               errorType: TypeRef,
                               toParamLogic: String,                 // toParam 实现代码
                               failureReplyLogic: String,            // createFailureReply 实现代码
                               successReplyLogic: String             // createSuccessReply 实现代码
                             )

