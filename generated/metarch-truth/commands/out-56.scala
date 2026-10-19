package generated.command

import net.imadz.common.CborSerializable

/** 发布一个元数据版本（接住「多 schema 版本如何对齐」热点；ExportMetadata 已带 manifest） */
final case class ReleaseMetadataVersion() extends CborSerializable
