package example.stockreservation.controllers

import org.scalacheck.Gen

/** 行为性质的输入形状（support 层）：生成器全部走零分支形态（Gen.zip/组合子＋map），
  * 不在生成器体内写分支。 */
object ControllerCases {

  /** 合法 Id：随机 UUID 的字符串形状（IdGuard.parse 必过；happy path 随机寻址）。 */
  val validIds: Gen[String] = Gen.uuid.map(_.toString)

  /** 非法 Id：无连字符字母数字串——UUID.fromString 必拒（36 位纯十六进制无连字符
    * 也不是合法 UUID 形状，随机串不可能侥幸通过）。 */
  val invalidIds: Gen[String] =
    Gen.nonEmptyListOf(Gen.alphaNumChar).map(chars => chars.take(30).mkString)
}
