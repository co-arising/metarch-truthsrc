package net.imadz.codegen.scaffolding.cqrs.builder

import net.imadz.codegen.scaffolding.cqrs.builder.application.CommandHelpersBuilder
import net.imadz.codegen.scaffolding.cqrs.template.application.CommandHelpersTemplate
import net.imadz.codegen.scaffolding.cqrs.GeneratorContext
import net.imadz.meta.Examples
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

/** 空白手写区人机验收（EP_Improvement_Engine §九 欠账⑦）。
  *
  * 缺口：`CommandHelpersBuilder` 把算好的 createSuccessReply/createFailureReply 逻辑**丢弃**，
  *   硬编码 `"???"` 到 `CommandHelperModel`（`CommandHelpersBuilder.scala:83,91`——`val successLogic =
  *   "???"`）——生成的 helper 三方法全 `???`（实测：GateKbLintCommandHelpers 15 个 `???`）。
  *   87 个行为域的胶水因此不可填。
  *
  * 本 spec 锁住修复后形态：生成的 helper 是**可编译的机械外壳**——
  *   · 三方法体不再是裸 `???`；
  *   · 外壳（机械骨架）在 MANUAL 块**之外**——重生成自动更新；
  *   · MANUAL 块作为自定义语义的挂点保留。
  *
  * 红测判据：修复前 helper 体含裸 `???` → 失败。 */
class CommandHelpersScaffoldSpec extends AnyFlatSpec with Matchers {

  private lazy val ctx: GeneratorContext =
    GeneratorContext.fromSystemMetadata(Examples.bankingSystem)

  private def renderHelpers(aggName: String): String = {
    val meta = ctx.metaRegistry.resolveByName[net.imadz.meta.AggregateRootMetadata](aggName)
      .getOrElse(throw new AssertionError(s"no aggregate $aggName"))
    CommandHelpersTemplate.generate(CommandHelpersBuilder.build(meta, ctx))
  }

  private lazy val code: String = renderHelpers("CreditBalanceAggregate")

  // ── 红（修复前失败）：裸 ??? 体 ──
  "CommandHelpersBuilder" should "emit a compilable mechanical scaffold with no bare ??? body" in {
    withClue(s"still contains a bare ??? body:\n$code") {
      code.linesIterator.exists(_.trim == "???") shouldBe false
    }
  }

  // ── 红（修复前失败）：外壳里真构造 reply（非 ??? 逻辑） ──
  it should "emit real reply construction (createSuccessReply/createFailureReply bodies)" in {
    // Deposit 有 reply CreditBalanceConfirmation → helper 应真构造它
    code should include("CreditBalanceConfirmation")
    // 不再是被丢弃的 "???"
    code should not include "val successLogic"
  }

  // ── 绿（保持）：MANUAL 块仍在（自定义语义挂点） ──
  it should "retain the MANUAL block as the custom-semantics hook" in {
    code should include("==== BEGIN MANUAL ====")
    code should include("==== END MANUAL ====")
  }

  // ── 红（修复前失败）：Unit reply 不得生成 `Unit(param, …)` ──
  it should "emit `()` for Unit replies, never `Unit(param, …)` (273-error regression)" in {
    // GetBalance 等只读命令 reply 类型是 Unit（无 Confirmation 类）→ 构造表达式须为 ()
    withClue("`Unit(` 出现在 helper 体＝编译红（Unit.type does not take parameters）：\n" + code) {
      code should not include "Unit(param"
      code should not include "Unit()"
    }
  }
}
