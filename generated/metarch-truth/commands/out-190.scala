package generated.command

import net.imadz.common.CborSerializable

/** 【新增】更新便签内容 */
final case class UpdateNoteContent(noteId: String, content: String, triggeredBy: String) extends CborSerializable
