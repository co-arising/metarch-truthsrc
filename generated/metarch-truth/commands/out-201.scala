package generated.command

import net.imadz.common.CborSerializable

/** 人提交单条标准裁决（自由文本路径·AI 元数据留空） */
final case class SubmitDoRVerdict(dorId: String, criterion: String, result: String, reason: String, triggeredBy: String) extends CborSerializable
