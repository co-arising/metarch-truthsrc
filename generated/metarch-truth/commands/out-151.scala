package generated.command

import net.imadz.common.CborSerializable

/** 修补单个视图字段（dataType/source/isKey/origin/writtenBy） */
final case class PatchReadModelField(definitionId: String, fieldName: String, dataType: String, source: String, isKey: String, origin: String, writtenBy: String, tenantId: String, triggeredBy: String) extends CborSerializable
