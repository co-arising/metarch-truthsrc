package generated.command

import net.imadz.common.CborSerializable

/** 声明一条命令-事件映射边（CEM 入库主口） */
final case class DeclareEdge(edgeId: String, commandName: String, eventName: String, aggregateName: String, sources: String, confidence: String, tenantId: String, triggeredBy: String) extends CborSerializable
