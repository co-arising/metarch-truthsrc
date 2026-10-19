package generated.command

import net.imadz.common.CborSerializable

/** 归类子域（core/supporting/generic） */
final case class ClassifySubdomain(tenantId: String, subdomainId: String, name: String, description: String, kind: String, buyOrBuild: String, aggregateIds: String, triggeredBy: String) extends CborSerializable
