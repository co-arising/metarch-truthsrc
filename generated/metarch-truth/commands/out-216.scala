package generated.command

import net.imadz.common.CborSerializable

/** 回答问题 */
final case class AnswerQuestion(questionId: String, answer: String, triggeredBy: String) extends CborSerializable
