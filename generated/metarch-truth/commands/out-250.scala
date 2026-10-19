package generated.command

import net.imadz.common.CborSerializable

/** 目录应用成功后回执补丁合并（Option A 两阶段·catalog 是权威——patch 此刻才真 MERGED） */
final case class ConfirmPatchMerged(patchId: String, triggeredBy: String) extends CborSerializable
