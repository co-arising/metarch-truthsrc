package generated.command

import net.imadz.common.CborSerializable

/** 整体替换字段写血缘（expect CAS 守卫） */
final case class ReplaceWrittenBy(definitionId: String, fieldName: String, writtenBy: String, expect: String, tenantId: String, triggeredBy: String) extends CborSerializable
