import { n, types } from './syntax.mjs';
import { runRuntimeTemplate } from './run-runtime.mjs';

export function runtimeTemplate(m, out) {
  const t = types(m), settings = m.technical.settings, coordinator = m.saga.coordinatorSettings;
  out.append(`package ${m.packages.glue}

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.PersistenceId
import akka.util.ByteString
import net.imadz.monarch.persistence._
import net.imadz.monarch.persistence.operation.OperationProtocol
import ${m.packages.kernel}.${n(m.symbols.codecs)}
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

final case class ${t.settings}(interactionTimeout: FiniteDuration = ${coordinator.interactionTimeoutMs}.millis,
    maxReconcileInteractions: Int = ${coordinator.maxReconcileInteractions}, maxTransactions: Int = ${settings.maxTransactions},
    maxJobs: Int = ${settings.maxJobs}, maxChildren: Int = ${settings.maxChildren}) {
  require(interactionTimeout > Duration.Zero && maxReconcileInteractions > 0 && maxTransactions > 0 && maxJobs > 0 && maxChildren > 0)
  require(interactionTimeout <= ${coordinator.interactionTimeoutMs}.millis && maxReconcileInteractions <= ${coordinator.maxReconcileInteractions}, "settings exceed compiled Saga recovery bounds")
  require(maxTransactions <= ${settings.maxTransactions} && maxJobs <= ${settings.maxJobs} && maxChildren <= ${settings.maxChildren}, "host capacity exceeds compiled bounds")
}
sealed trait ${t.ownership}
object ${t.ownership} {
  case object CallerOwned extends ${t.ownership}
  case object ApplicationOwned extends ${t.ownership}
}
object ${t.runFactories} {
  private val codec = StateCodec[ByteString](_.toArray, bytes => ByteString.fromArray(bytes))
  def pure(id: PersistenceId, definition: RunDefinition[String], interpret: (String, ByteString) => Future[ByteString])
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
final class ${t.checkedRun}(port: RunSubmissionPort, definition: RunDefinition[String])(implicit ec: ExecutionContext) {
  def expected(submission: RunSubmission): RunProtocol.Identity = {
    require(submission.definitionId == definition.id && submission.definitionVersion == definition.version &&
      submission.codecVersion == definition.codecVersion, "submission definition mismatch")
    RunProtocol.Identity(submission.runId, definition.id, definition.version, definition.codecVersion,
      ${n(m.symbols.codecs)}.digest(submission.initialState.toArray.toVector), definition.planDigest)
  }
  def validate(submission: RunSubmission, reply: RunProtocol.Reply): Either[String, Option[ByteString]] = reply match {
    case RunProtocol.Current(view) if view.identity.contains(expected(submission)) && view.runId.contains(submission.runId) =>
      if (view.status == RunProtocol.Status.Completed) view.lastState.toRight("completed run missing committed result").map(Some(_))
      else if (view.status == RunProtocol.Status.Failed || view.status == RunProtocol.Status.RecoveryBlocked) Left("run not successful")
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
`, m.sources);
  for (const run of m.runs) runRuntimeTemplate(m, run, out);
}
