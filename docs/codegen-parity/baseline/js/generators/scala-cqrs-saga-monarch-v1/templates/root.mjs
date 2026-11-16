import { n, fqn, types } from './syntax.mjs';

export function rootTemplate(m, out) {
  const t = types(m), cls = n(m.symbols.root);
  const hasRunArea = m.workflow.areas.some(area => area.action.kind === 'run');
  const recovery = hasRunArea ? `  def recoverRuns(manifest: net.imadz.monarch.persistence.workflow.BatchManifest,
      authorization: String): Future[BatchProtocol.Reply] = recoverRunsStage(manifest, authorization, reactivate = true)
  def resumeRuns(manifest: net.imadz.monarch.persistence.workflow.BatchManifest,
      authorization: String): Future[BatchProtocol.Reply] = recoverRunsStage(manifest, authorization, reactivate = false)
  private def recoverRunsStage(manifest: net.imadz.monarch.persistence.workflow.BatchManifest,
      authorization: String, reactivate: Boolean): Future[BatchProtocol.Reply] = {
    import akka.actor.typed.scaladsl.AskPattern._
    import net.imadz.monarch.persistence.resource.ResourceProtocol
    implicit val scheduler: akka.actor.typed.Scheduler = system.scheduler
    implicit val timeout: akka.util.Timeout = akka.util.Timeout(settings.interactionTimeout)
    // Do not even cold-activate the outer job before durable identity and caller authority agree.
    program.authorizeRunRecovery(manifest, authorization).flatMap { _ =>
      workflow.job(manifest.jobId).ask[BatchProtocol.Reply](BatchProtocol.Get(_, afterSequence = manifest.items.map(_.sequence).min - 1L, limit = 100)).flatMap {
        case BatchProtocol.Current(view) =>
          require(view.jobId == manifest.jobId && view.phase != "Drained" && view.phase != "RecoveryBlocked", "original job is not active")
          val batch = view.batches.find(_.batchId == manifest.batchId).getOrElse(
            throw new IllegalArgumentException("original active batch missing"))
          require(batch.area == manifest.area && batch.itemIds == manifest.items.map(_.itemId) && batch.phase == "Blocked" &&
            batch.reservationId.contains(manifest.reservationId) && batch.deliveryId.contains(manifest.deliveryId),
            "original blocked batch membership/reservation/delivery mismatch")
          require(manifest.items.forall { original =>
            view.items.exists(item => item.sequence == original.sequence && item.itemId == original.itemId &&
              item.area == manifest.area && item.phase == "Running")
          }, "original active item identity cannot be established")
          workflow.resourceDomain.ask[ResourceProtocol.Reply](ResourceProtocol.Query(manifest.reservationId, _)).flatMap {
            case ResourceProtocol.Granted(grant) if grant.reservationId == manifest.reservationId &&
                grant.ownerOperationKey == manifest.operationKey && grant.units == program.definition.byId(manifest.area).resources =>
              val progress = if (reactivate) program.reactivate(manifest, authorization) else program.canResume(manifest, authorization)
              progress.flatMap {
                case Right(true) => workflow.reconcile(manifest.jobId, manifest.batchId)
                case Right(false) => Future.successful(BatchProtocol.Current(view))
                case Left(reason) => Future.successful(BatchProtocol.Rejected(reason))
              }
            case _ => Future.successful(BatchProtocol.Rejected("original resource reservation is not Granted with exact owner/resources"))
          }
        case _ => Future.successful(BatchProtocol.Rejected("original job view unavailable"))
      }
    }.recover { case scala.util.control.NonFatal(e) => BatchProtocol.Rejected(Option(e.getMessage).getOrElse(e.getClass.getName)) }
  }
` : '';
  const extra = m.runs.map(run => `, ${run.leavesIdentifier}: ${n(run.symbol)}.Leaves`).join('');
  const hosts = m.runs.map(run => `  val ${run.hostIdentifier}: ${n(run.symbol)}.Host = new ${n(run.symbol)}.Host(system, namespace, ${run.leavesIdentifier})\n`).join('');
  out.append(`package ${m.packages.root}

import akka.actor.typed.ActorSystem
import net.imadz.monarch.persistence.batch.{BatchProtocol, WorkflowHost}
import ${m.packages.kernel}._
import ${m.packages.glue}._
import scala.concurrent.{ExecutionContext, Future}

/** A single effective writer owns namespace. Storage and ActorSystem creation remain explicit. */
final class ${cls}(system: ActorSystem[_], namespace: String, ports: ${t.applicationPorts},
    settings: ${t.settings}, ownership: ${t.ownership}${extra})(implicit ec: ExecutionContext) {
  require(namespace.nonEmpty)
  val reservations: ${n(m.symbols.saga)} = new ${n(m.symbols.saga)}(system, namespace, ports, settings)
${hosts}  val program: ${n(m.symbols.workflow)} = new ${n(m.symbols.workflow)}(reservations, ports${m.runs.map(run => ', ' + run.hostIdentifier).join('')})
  lazy val workflow: WorkflowHost = new WorkflowHost(system, namespace + "/workflow", program, settings.maxJobs, settings.maxChildren)
  def recover(item: ${t.item}, authorization: String, maxInteractions: Int, originalBatchId: String): Future[BatchProtocol.Reply] =
    reservations.reconcile(item, authorization, maxInteractions).flatMap { _ =>
      workflow.reconcile(item.jobId, originalBatchId)
    }
${recovery}  def close(): Future[Unit] = ownership match {
    case ${t.ownership}.CallerOwned => Future.successful(())
    case ${t.ownership}.ApplicationOwned => system.terminate(); system.whenTerminated.map(_ => ())
  }
}

object ${cls} {
  def fromExternal(system: ActorSystem[_], namespace: String, directory: java.nio.file.Path,
      resourceA: ${n(m.field.resourceA.type)}, resourceB: ${n(m.field.resourceB.type)}, recoveryAuthorization: ${n(m.ports.recoveryAuthorization)},
      settings: ${t.settings} = ${t.settings}(),
      ownership: ${t.ownership} = ${t.ownership}.${m.technical.settings.systemOwnership === 'caller' ? 'CallerOwned' : 'ApplicationOwned'})
      (implicit ec: ExecutionContext): ${cls} = {
`, m.sources);
  const inputs = { directory: 'directory', resourceA: 'resourceA', resourceB: 'resourceB', recoveryAuthorization: 'recoveryAuthorization', executionContext: 'ec' };
  for (const implementation of m.implementations) {
    const construction = implementation.construction === 'object' ? '_root_.' + implementation.symbol : 'new _root_.' + implementation.symbol + implementation.constructor.map(group =>
      '(' + group.parameters.map(parameter => inputs[parameter.input]).join(', ') + ')').join('');
    out.append(`    val ${implementation.local} = ${construction}\n`, [implementation.source]);
  }
  const property = { association: 'associations', result: 'results', evidence: 'evidence', executionEvidence: 'executionEvidence', recoveryAuthorization: 'recoveryAuthorization' };
  const provider = role => m.implementations.find(i => i.id === m.root.bindings[role]).local + '.ports.';
  // Preserve the frozen no-Run fragment boundaries as well as its generated bytes.
  if (!m.runs.length) {
    out.append(`    val ports = ${t.applicationPorts}(
      ${provider('participant')}warehouseA, ${provider('participant')}warehouseB,
${Object.entries(property).map(([role, member]) => '      ' + provider(role) + member).join(',\n')})
    new ${cls}(system, namespace, ports, settings, ownership)
  }
}
`, m.sources);
    return;
  }
  out.append(`    val ports = ${t.applicationPorts}(
      ${provider('participant')}warehouseA, ${provider('participant')}warehouseB,
${Object.entries(property).map(([role, member]) => '      ' + provider(role) + member).join(',\n')})
`, m.sources);
  for (const run of m.runs) {
    for (const leaf of run.leaves) out.append(`    val ${leaf.local}: ${fqn(run.protocol)}.${leaf.port.identifier}.Leaf = ${leaf.implementation.local}\n`, [leaf.source, leaf.implementation.source]);
    out.append(`    val ${run.leavesIdentifier} = ${n(run.symbol)}.Leaves(${run.leaves.map(leaf => `${leaf.identifier} = ${leaf.local}`).join(', ')})\n`, [run.source, ...run.leaves.map(leaf => leaf.source)]);
  }
  out.append(`    new ${cls}(system, namespace, ports, settings, ownership${m.runs.map(run => ', ' + run.leavesIdentifier).join('')})
  }
}
`, m.sources);
}
