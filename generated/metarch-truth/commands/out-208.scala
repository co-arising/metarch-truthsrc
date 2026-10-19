package generated.command

import net.imadz.common.CborSerializable

/** 关闭问题 */
final case class DismissQuestion(questionId: String, triggeredBy: String) extends CborSerializable
