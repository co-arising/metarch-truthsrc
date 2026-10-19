package generated.readmodel

import scala.math.BigDecimal

/** Read model: CaptureNoteDecisionView — served by  */
final case class ReadModelCaptureNote(noteId: String, externalId: String, boardId: String, sessionId: String, content: String, type: String, timeline: String, pivotal: String, name: String, links: String)

object ReadModelCaptureNoteView {
  def empty: ReadModelCaptureNote = ReadModelCaptureNote("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
