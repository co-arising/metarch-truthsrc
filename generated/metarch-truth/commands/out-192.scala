package generated.command

import net.imadz.common.CborSerializable

/** 【新增】更新名称 */
final case class UpdateWorkgroupName(workgroupId: String, name: String, triggeredBy: String) extends CborSerializable
