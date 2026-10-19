package generated.command

import net.imadz.common.CborSerializable

/** 邀请观察者（跨组临时受邀，ViewOnly） */
final case class InviteObserver(sessionId: String, userId: String, triggeredBy: String, displayName: String, email: String, phoneNumber: String) extends CborSerializable
