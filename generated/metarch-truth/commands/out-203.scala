package generated.command

import net.imadz.common.CborSerializable

/** 修复/解决未决 Verdict（领域专家/元数据工程师/教练均可）→ 达成 0 未决阻碍（原 ResolveFinding 改名） */
final case class FixDoRVerdict(dorId: String, verdictId: String, resolution: String) extends CborSerializable
