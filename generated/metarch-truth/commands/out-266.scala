package generated.command

import net.imadz.common.CborSerializable

/** 阻塞评审（否决或超时·EP_DoR_BLOCKED 模型 C 承载命令） */
final case class BlockDoR(reason: String, triggeredBy: String) extends CborSerializable
