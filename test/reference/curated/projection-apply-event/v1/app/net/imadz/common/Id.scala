package net.imadz.common

import net.imadz.common.CommonTypes.Id

/** 手写名义公共供给（传统合同）：metarch 身份类型 Id＝java.util.UUID 别名，
  * Id.of＝确定性 UUID 解析。裁剪到本样消费面：随机面不在本样内，
  * 结构性质另行钉住身份解析零随机、时钟读取只在 ts。 */
object CommonTypes {
  type Id = java.util.UUID
}

object Id {
  def of(value: String): Id = java.util.UUID.fromString(value)
}
