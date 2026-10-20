package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.UserEntity.UserState
import net.imadz.metarch.domain.entities.UserEntity._
import net.imadz.metarch.infrastructure.proto._

trait UserProtoConverters extends PrimitiveConverter {

  object UserStateConv extends ProtoConverter[UserState, UserStatePO] {
    override def toProto(d: UserState): UserStatePO = UserStatePO(
      status = d.status,
      email = d.email,
      passwordSalt = d.passwordSalt,
      passwordHash = d.passwordHash,
      authMethod = d.authMethod,
      displayName = d.displayName,
      registeredAt = d.registeredAt,
      phoneNumber = d.phoneNumber
    )

    override def fromProto(p: UserStatePO): UserState = UserState(
      status = p.status,
      email = p.email,
      passwordSalt = p.passwordSalt,
      passwordHash = p.passwordHash,
      authMethod = p.authMethod,
      displayName = p.displayName,
      registeredAt = p.registeredAt,
      phoneNumber = p.phoneNumber
    )
  }


  object UserRegisteredConv extends ProtoConverter[UserRegistered, UserRegisteredPO] {
    override def toProto(d: UserRegistered): UserRegisteredPO = UserRegisteredPO(
      userId = d.userId,
      email = d.email,
      displayName = d.displayName,
      authMethod = d.authMethod,
      phoneNumber = d.phoneNumber,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: UserRegisteredPO): UserRegistered = UserRegistered(
      userId = p.userId,
      email = p.email,
      displayName = p.displayName,
      authMethod = p.authMethod,
      phoneNumber = p.phoneNumber,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object UserDeactivatedConv extends ProtoConverter[UserDeactivated, UserDeactivatedPO] {
    override def toProto(d: UserDeactivated): UserDeactivatedPO = UserDeactivatedPO(
      userId = d.userId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: UserDeactivatedPO): UserDeactivated = UserDeactivated(
      userId = p.userId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object UserProfileUpdatedConv extends ProtoConverter[UserProfileUpdated, UserProfileUpdatedPO] {
    override def toProto(d: UserProfileUpdated): UserProfileUpdatedPO = UserProfileUpdatedPO(
      userId = d.userId,
      displayName = d.displayName,
      email = d.email,
      phoneNumber = d.phoneNumber,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: UserProfileUpdatedPO): UserProfileUpdated = UserProfileUpdated(
      userId = p.userId,
      displayName = p.displayName,
      email = p.email,
      phoneNumber = p.phoneNumber,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object UserReactivatedConv extends ProtoConverter[UserReactivated, UserReactivatedPO] {
    override def toProto(d: UserReactivated): UserReactivatedPO = UserReactivatedPO(
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: UserReactivatedPO): UserReactivated = UserReactivated(
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }

}
