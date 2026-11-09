package reference.inventory.root

import akka.actor.typed.ActorSystem
import net.imadz.monarch.persistence.batch.{BatchProtocol, WorkflowHost}
import reference.inventory.kernel._
import reference.inventory.glue._
import scala.concurrent.{ExecutionContext, Future}

/** Exactly one effective writer owns namespace. Never closes a caller-owned ActorSystem. */
final class InventoryApplication(system: ActorSystem[_], namespace: String, ports: ApplicationPorts,
    settings: ApplicationSettings, ownership: SystemOwnership)(implicit ec: ExecutionContext) {
  require(namespace.nonEmpty)
  val reservations: InventorySaga = new InventorySaga(system, namespace, ports, settings)
  val program: InventoryWorkflow = new InventoryWorkflow(reservations, ports)
  lazy val workflow: WorkflowHost = new WorkflowHost(system, namespace + "/workflow", program,
    settings.maxJobs, settings.maxChildren)
  /** Explicit two-step recovery; ordinary queries never invoke either recovery API. */
  def recover(item: ItemIdentity, authorization: String, maxInteractions: Int,
      originalBatchId: String): Future[BatchProtocol.Reply] =
    reservations.reconcile(item, authorization, maxInteractions).flatMap { _ =>
      workflow.reconcile(item.jobId, originalBatchId)
    }
  def close(): Future[Unit] = ownership match {
    case SystemOwnership.CallerOwned => Future.successful(())
    case SystemOwnership.ApplicationOwned => system.terminate(); system.whenTerminated.map(_ => ())
  }
}
