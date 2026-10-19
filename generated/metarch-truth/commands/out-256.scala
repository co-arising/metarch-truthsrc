package generated.command

import net.imadz.common.CborSerializable

/** 裁决同名碰撞（合并或改名） */
final case class ResolveCollision(noteId: String, resolution: String, newName: String, triggeredBy: String) extends CborSerializable
