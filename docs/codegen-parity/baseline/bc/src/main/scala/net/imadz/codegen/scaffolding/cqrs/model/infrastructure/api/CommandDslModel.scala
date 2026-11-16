package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

/** S2-32 R5c（P2）：CommandDsl 信封支撑件 Model——DSL 控制器 import 面
  * （net.imadz.infrastructure.api.{IdGuard, InstantGuard, OkReceipt}——R5b 已锁定的固定 FQN）
  * 所引用的信封族（OkReceipt/ViewListDto/ViewItem/IdGuard/InstantGuard）的发射载体。
  * 包位与 ControllerTemplate DSL import 面同源耦合（reference_project 手放版同位——
  * 生成到已有该文件的工程＝同源覆盖等价）；gate 声明存在才发射（gate=None 系统零新文件）。 */
case class CommandDslModel(
                            override val selfType: TypeRef,
                            override val dependencies: Set[TypeRef]
                          ) extends ArtifactModel
