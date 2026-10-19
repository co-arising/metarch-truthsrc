package generated.command

import net.imadz.common.CborSerializable

/** 汇总所有裁决并得出结论 */
final case class ConcludeDoR(dorId: String, triggeredBy: String) extends CborSerializable
