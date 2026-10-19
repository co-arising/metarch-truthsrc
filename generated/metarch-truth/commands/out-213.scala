package generated.command

import net.imadz.common.CborSerializable

/** 发起领域建模专项 */
final case class InitiateProject(projectId: String, tenantId: String, workgroupId: String, name: String, description: String, triggeredBy: String) extends CborSerializable
