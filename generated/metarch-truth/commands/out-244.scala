package generated.command

import net.imadz.common.CborSerializable

/** 标记冲突已修复，清除 hasConflictWarning */
final case class ResolveConflict(conceptId: String, resolution: String, triggeredBy: String) extends CborSerializable
