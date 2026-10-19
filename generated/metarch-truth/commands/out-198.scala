package generated.command

import net.imadz.common.CborSerializable

/** 【新增】重新打开问题 */
final case class ReopenQuestion(questionId: String, triggeredBy: String) extends CborSerializable
