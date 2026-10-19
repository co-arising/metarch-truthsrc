package generated.command

import net.imadz.common.CborSerializable

/** 【新增】移除便签 */
final case class RemoveNote(noteId: String, triggeredBy: String) extends CborSerializable
