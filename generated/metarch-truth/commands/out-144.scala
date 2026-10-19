package generated.command

import net.imadz.common.CborSerializable

/** DoR 通过后创建合并请求（MR 门·知识管理员审阅段入口·policy 触发） */
final case class RequestKnowledgeMerge(patchId: String, triggeredBy: String) extends CborSerializable
