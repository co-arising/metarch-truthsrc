package generated.event

import net.imadz.common.CborSerializable

/** 捕获便签时检测到同 scope 已存在同名便签（名称碰撞）——除 NoteCaptured 外追加产生本事件，conflictingNoteIds 携带冲突便签清单 */
final case class CollisionDetected() extends CborSerializable
