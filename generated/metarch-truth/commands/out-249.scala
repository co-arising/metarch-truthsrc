package generated.command

import net.imadz.common.CborSerializable

/** 用户首次登录建立全局身份（登录即注册） */
final case class RegisterUser(userId: String, email: String, password: String, displayName: String, authMethod: String, triggeredBy: String) extends CborSerializable
