package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.RoleCommandBindingEntity.RoleCommandBindingState
import net.imadz.metarch.domain.entities.RoleCommandBindingEntity._
import net.imadz.metarch.infrastructure.proto._

trait RoleCommandBindingProtoConverters extends PrimitiveConverter {

  object RoleCommandBindingStateConv extends ProtoConverter[RoleCommandBindingState, RoleCommandBindingStatePO] {
    override def toProto(d: RoleCommandBindingState): RoleCommandBindingStatePO = RoleCommandBindingStatePO(
      tenantId = d.tenantId,
      roleName = d.roleName,
      commandName = d.commandName,
      ruling = d.ruling,
      systemCommand = d.systemCommand,
      status = d.status,
      boundAt = d.boundAt,
      boundBy = d.boundBy,
      unboundAt = d.unboundAt,
      unboundReason = d.unboundReason
    )

    override def fromProto(p: RoleCommandBindingStatePO): RoleCommandBindingState = RoleCommandBindingState(
      tenantId = p.tenantId,
      roleName = p.roleName,
      commandName = p.commandName,
      ruling = p.ruling,
      systemCommand = p.systemCommand,
      status = p.status,
      boundAt = p.boundAt,
      boundBy = p.boundBy,
      unboundAt = p.unboundAt,
      unboundReason = p.unboundReason
    )
  }


  object CommandBoundConv extends ProtoConverter[CommandBound, CommandBoundPO] {
    override def toProto(d: CommandBound): CommandBoundPO = CommandBoundPO(
      bindingId = d.bindingId,
      roleName = d.roleName,
      commandName = d.commandName,
      ruling = d.ruling,
      systemCommand = d.systemCommand,
      boundBy = d.boundBy,
      tenantId = d.tenantId,
      boundAt = d.boundAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: CommandBoundPO): CommandBound = CommandBound(
      bindingId = p.bindingId,
      roleName = p.roleName,
      commandName = p.commandName,
      ruling = p.ruling,
      systemCommand = p.systemCommand,
      boundBy = p.boundBy,
      tenantId = p.tenantId,
      boundAt = p.boundAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object CommandUnboundConv extends ProtoConverter[CommandUnbound, CommandUnboundPO] {
    override def toProto(d: CommandUnbound): CommandUnboundPO = CommandUnboundPO(
      bindingId = d.bindingId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      unboundAt = d.unboundAt,
      timestamp = d.timestamp
    )

    override def fromProto(p: CommandUnboundPO): CommandUnbound = CommandUnbound(
      bindingId = p.bindingId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      unboundAt = p.unboundAt,
      timestamp = p.timestamp
    )
  }

}
