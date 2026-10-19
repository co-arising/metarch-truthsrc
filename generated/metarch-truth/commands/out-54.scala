package generated.command

import net.imadz.common.CborSerializable

/** 元数据工程师手动确立概念（P6：常规路径由 KnowledgePatch 合并按 (contextId, conceptName) 唯一键 insert/update 承担） */
final case class EstablishConcept(tenantId: String) extends CborSerializable
