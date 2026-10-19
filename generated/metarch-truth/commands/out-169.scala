package generated.command

import net.imadz.common.CborSerializable

/** 【B5b】更新便签 info/links（写环补面） */
final case class UpdateNoteInfo(noteId: String, info: String, links: String, triggeredBy: String) extends CborSerializable
