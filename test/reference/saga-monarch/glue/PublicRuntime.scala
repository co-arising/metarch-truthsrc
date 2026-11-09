package reference.inventory.glue

import akka.actor.typed.{ActorRef, ActorSystem, Behavior}
import akka.persistence.typed.PersistenceId
import akka.util.ByteString
import net.imadz.monarch.persistence._
import net.imadz.monarch.persistence.operation.OperationProtocol
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

final case class ApplicationSettings(interactionTimeout: FiniteDuration = 2.seconds,
    maxReconcileInteractions: Int = 16, maxTransactions: Int = 32,
    maxJobs: Int = 4, maxChildren: Int = 128) {
  require(interactionTimeout > Duration.Zero && maxReconcileInteractions > 0 && maxTransactions > 0 && maxJobs > 0 && maxChildren > 0)
}
sealed trait SystemOwnership
object SystemOwnership {
  case object CallerOwned extends SystemOwnership
  case object ApplicationOwned extends SystemOwnership
}
/** Finite pure Run and managed single-operation public factories, no copied runtime engine. */
object RunFactories {
  private val codec = StateCodec[ByteString](_.toArray, b => ByteString.fromArray(b))
  def pure(id: PersistenceId, definition: RunDefinition[String],
      interpret: (String, ByteString) => Future[ByteString])
      (implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[ByteString]] =
    PersistentMonarch.versionedBehavior(id, definition, interpret, codec)
  def managedSingle(id: PersistenceId, definition: RunDefinition[String], request: OperationProtocol.Request,
      resolve: String => ActorRef[OperationProtocol.Command], settings: ManagedOperationSettings)
      (implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[ByteString]] = {
    require(definition.stepIds == Vector(request.stepId), "managed factory requires the exact single step")
    val operations = new ManagedOperations(resolve, settings)
    PersistentMonarch.managedBehavior(id, definition,
      (_: String, _: ByteString, scope: ManagedStageScope) => scope.awaitTerminal(request).map(_.result), codec, operations)
  }
}
final class CheckedRunFacade(port: RunSubmissionPort, definition: RunDefinition[String])
    (implicit ec: ExecutionContext) {
  def expected(submission: RunSubmission): RunProtocol.Identity = {
    require(submission.definitionId == definition.id && submission.definitionVersion == definition.version &&
      submission.codecVersion == definition.codecVersion, "submission definition mismatch")
    RunProtocol.Identity(submission.runId, definition.id, definition.version, definition.codecVersion,
      reference.inventory.kernel.BinaryCodecs.digest(submission.initialState.toArray.toVector), definition.planDigest)
  }
  def validate(submission: RunSubmission, reply: RunProtocol.Reply): Either[String, Option[ByteString]] = reply match {
    case RunProtocol.Current(v) if v.identity.contains(expected(submission)) && v.runId.contains(submission.runId) =>
      if (v.status == RunProtocol.Status.Completed) v.lastState.toRight("completed run missing committed result").map(Some(_))
      else if (v.status == RunProtocol.Status.Failed || v.status == RunProtocol.Status.RecoveryBlocked) Left("run not successful")
      else Right(None)
    case _ => Left("run identity/unavailable mismatch")
  }
  def ensure(submission: RunSubmission): Future[Either[String, Option[ByteString]]] = {
    expected(submission); port.ensure(submission).map(validate(submission, _))
  }
  def query(submission: RunSubmission): Future[Either[String, Option[ByteString]]] = {
    expected(submission); port.query(submission).map(validate(submission, _))
  }
}
