package generated.command

import net.imadz.common.CborSerializable

/** 回锚：把生成期发现的代码落点批量记到既有概念上（走 update 腿·非创建） */
final case class RecordConceptLandings(conceptId: String, anchors: String, triggeredBy: String) extends CborSerializable
