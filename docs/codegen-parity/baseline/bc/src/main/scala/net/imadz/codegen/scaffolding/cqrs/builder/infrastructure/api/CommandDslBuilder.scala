package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.TypeRef
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.CommandDslModel
import net.imadz.meta.InterfaceLayer

/** S2-32 R5c（P2）：CommandDsl 信封支撑件 Builder——DSL 控制器发射时其 import 面引用
  * net.imadz.infrastructure.api.{IdGuard, InstantGuard, OkReceipt}，本 Builder 补齐这些
  * 信封文件的发射（R5b 偏差「支撑件时序＝R5c 前提」的收口）。
  * gate 驱动：任一控制器端点声明 gate 才发射——gate=None 系统零新文件（零漂移红线）。
  * 包位＝固定 FQN（与 ControllerTemplate dslImportList 的固定 import 面同源耦合，非
  * PackageLayout 派生位——R5b 已按 reference_project 形态锁定 import 文本；派生化归后续批）。 */
object CommandDslBuilder {

  /** DSL 控制器 import 面的固定包位（reference_project 手放版同位·覆盖等价）。 */
  val CommandDslPackage: String = "net.imadz.infrastructure.api"

  def build(interfaces: InterfaceLayer): Option[CommandDslModel] =
    if (hasGateDeclaration(interfaces))
      Some(
        CommandDslModel(
          selfType = TypeRef("CommandDsl", CommandDslPackage),
          dependencies = Set(TypeRef("ApiError", "net.imadz.common.auth"))
        )
      )
    else None

  /** gate 声明存在性：任一控制器的任一端点声明门引用（gate=None＝未声明＝不发射——
    * 与 H053 触发面／gate=None 存量 stub 语义一致的渐进采纳口径）。 */
  private def hasGateDeclaration(interfaces: InterfaceLayer): Boolean =
    interfaces.controllers.exists(_.endpoints.exists(_.gate.isDefined))
}
