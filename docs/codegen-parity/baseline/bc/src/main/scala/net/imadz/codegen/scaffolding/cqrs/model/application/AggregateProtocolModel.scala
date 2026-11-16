package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.model.domain.StateModel
import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class AggregateProtocolModel(
    override val selfType: TypeRef,
    commandFamily: CommandFamilyModel,
    replies: Seq[CommandReplyModel],
    state: Option[StateModel] = None,
    stateType: Option[TypeRef] = None, // For CommandHandler type alias
    eventType: Option[TypeRef] = None, // For CommandHandler type alias
    override val dependencies: Set[TypeRef],
    /** S7（EP §二 G1）：聚合号——台账 artifacts[] 的文件级落点由此可查。 */
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel
