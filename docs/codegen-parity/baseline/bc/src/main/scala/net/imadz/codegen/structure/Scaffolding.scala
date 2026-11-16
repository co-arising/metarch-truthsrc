package net.imadz.codegen.structure

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}

object Scaffolding {
  def apply(ctx: GeneratorContext) = new Scaffolding(ctx)
}

class Scaffolding(ctx: GeneratorContext) {
  private val base = "net.imadz"

  // Common
  val iMadzError = TypeRef("iMadzError", s"$base.common.CommonTypes")
  val Id = TypeRef("Id", s"$base.common")
  val CborSerializable = TypeRef("CborSerializable", s"$base.common")
  val SerializationExtension = TypeRef("SerializationExtension", s"$base.common.serialization")

  // Saga Engine
  object saga {
    private val sagaBase = s"$base.infra.saga"
    val Coordinator = TypeRef("SagaTransactionCoordinator", sagaBase)
    val Participant = TypeRef("SagaParticipant", sagaBase)
    val ForSaga = TypeRef("ForSaga", sagaBase)
  }

  // Frameworks
  object akka {
    val ActorSystem = TypeRef("ActorSystem", "akka.actor")
    val TypedActorSystem = TypeRef("ActorSystem", "akka.actor.typed", Seq(TypeRef.Nothing))
    val ClusterSharding = TypeRef("ClusterSharding", "akka.cluster.sharding.typed.scaladsl")
  }

  object play {
    val Inject = TypeRef("Inject", "javax.inject")
    val Singleton = TypeRef("Singleton", "javax.inject")
    val ExecutionContext = TypeRef("ExecutionContext", "scala.concurrent")
  }
}
