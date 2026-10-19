package generated.command

import net.imadz.common.CborSerializable

/** AI Agent 批量评估 N1-N4（verdicts 列表·每条含 sessionId 定位与 proposal 提案） */
final case class EvaluateDoR(dorId: String, verdicts: String, triggeredBy: String) extends CborSerializable
