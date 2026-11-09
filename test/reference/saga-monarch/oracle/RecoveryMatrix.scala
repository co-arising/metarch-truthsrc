package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.{AskPattern, Behaviors}
import akka.util.{ByteString, Timeout}
import java.nio.file.{Files, Path, Paths}
import java.util.concurrent.atomic.AtomicBoolean
import net.imadz.infra.saga.strict.{StrictSagaCoordinator, StrictStatus}
import net.imadz.monarch.persistence.SerializedValidationJournal
import net.imadz.monarch.persistence.batch.BatchProtocol
import net.imadz.monarch.persistence.resource.{ResourceProtocol => Resource}
import reference.inventory.kernel._
import reference.inventory.glue._
import reference.inventory.ext.FileInventoryPorts
import reference.inventory.root.InventoryApplication
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.Try

/** Each invocation is a fresh JVM. Fixed journal gates fail a write or halt inside force-before-ACK.
  * No journal truncation, deletion, replacement or snapshot fallback is used.
  */
object RecoveryMatrix {
  import R2Support._
  val request = ReservationRequest(RequestId("matrix-request"), Warehouse("warehouseA"), Warehouse("warehouseB"), Sku("sku"), Quantity(2))
  val item = ItemIdentity("job", 0, "item-0")
  val expected = InventorySaga.expected(item, request)
  val authorization = new RecoveryAuthorization {
    def authorize(id: SagaIdentity, token: String): Either[String, String] = if (id == expected.saga && token == "operator") Right("explicit-operator") else Left("denied")
  }
  val namespace = "matrix"
  val workflow = namespace + "/workflow"
  val sagaPid = namespace + "/saga/" + expected.saga.transactionId.value
  val jobPid = workflow + "|job|job"
  val resourcePid = workflow + "|resource|domain"
  val pids = Vector(jobPid, resourcePid, sagaPid) ++ (0 to 1).flatMap(n => Vector(
    workflow + "|delivery|job/batch-" + n + "/delivery", workflow + "|run|job/batch-" + n + "/run",
    workflow + "|operation|job/batch-" + n + "/execute"))
  def target(caseId: String, pid: String, event: Any): Boolean = {
    val name = eventName(event)
    caseId match {
      case "input" => pid == jobPid && name == "InputAccepted"
      case "eof" => pid == jobPid && name == "InputClosed"
      case "manifest" => pid == jobPid && name == "Sealed"
      case "grant" => pid == resourcePid && name == "GrantRecorded"
      case "inbox" => pid.endsWith("|delivery|job/batch-0/delivery") && name == "Accepted"
      case "child-intent" => pid.endsWith("|delivery|job/batch-0/delivery") && name == "ChildStartIntent"
      case "commit-decision" => pid == sagaPid && name == "CommitDecision"
      case "saga-terminal" => pid == sagaPid && name == "Succeeded"
      case "operation-terminal" => pid.endsWith("|operation|job/batch-0/execute") && name == "TerminalRecorded"
      case "checkpoint" => pid.endsWith("|run|job/batch-0/run") && name == "StageDone"
      case "run-terminal" => pid.endsWith("|run|job/batch-0/run") && name == "RunCompleted"
      case "release" => pid == resourcePid && name == "ReleaseRecorded" && field(event, "reservationId") == "job/batch-1/resources"
      case "settlement" => pid == jobPid && name == "Settled" && field(event, "batchId") == "job/batch-1"
      case _ => false
    }
  }
  def halt(caseId: String, boundary: String, dir: Path, facts: String, code: Int): Nothing = {
    forced(dir.resolve("fault.record"), (caseId + "\n" + boundary + "\n" + facts + "\n").getBytes("UTF-8"))
    Console.out.println("EXPECTED_BOUNDARY " + caseId + " " + boundary + " code=" + code); Console.out.flush()
    Runtime.getRuntime.halt(code); throw new IllegalStateException("halt returned")
  }
  def main(args: Array[String]): Unit = {
    require(args.length == 4); val Array(caseId, mode, boundary, root) = args; val dir = Paths.get(root)
    val system = R2Support.system(dir, "matrix-" + mode)
    implicit val sys: ActorSystem[_] = system; implicit val ec: ExecutionContext = system.executionContext
    implicit val timeout: Timeout = Timeout(3.seconds)
    import AskPattern._
    try {
      if (mode == "fault" && !Set("participant-commit", "result")(caseId)) pids.foreach { pid =>
        val selected = new AtomicBoolean(false)
        SerializedValidationJournal.forceMarkers.put(pid, label => {
          if (selected.get && label.startsWith("FORCED ")) {
            val stored = SerializedValidationJournal.readFile(SerializedValidationJournal.journalPath(dir.resolve("journal"), pid))
            require(stored.nonEmpty, "force marker without original journal")
            halt(caseId, boundary, dir, pid + "\n" + label + "\nrecords=" + stored.size, 75)
          }
        })
        val gate = system.systemActorOf(Behaviors.receiveMessage[SerializedValidationJournal.Pending] { pending =>
          if (pending.events.exists(e => target(caseId, pid, e.payload))) {
            if (boundary == "before-write") {
              val old = SerializedValidationJournal.readFile(SerializedValidationJournal.journalPath(dir.resolve("journal"), pid))
              require(!old.exists(r => pending.events.exists(_.sequenceNr == r.sequenceNr)), "target already persisted")
              pending.fail(new IllegalStateException("EXPECTED_FIXED_JOURNAL_WRITE_FAILURE"))
              halt(caseId, boundary, dir, pid + "\nrejected-sequence=" + pending.events.map(_.sequenceNr).mkString(","), 74)
            } else { require(boundary == "force-before-ack"); selected.set(true); pending.release() }
          } else pending.release()
          Behaviors.same
        }, "gate-" + BinaryCodecs.digest(pid.getBytes("UTF-8").toVector).take(20))
        SerializedValidationJournal.gates.put(pid, gate)
      }
      val external = new FileInventoryPorts(dir.resolve("external"), request.warehouseA, request.warehouseB, authorization)
      val ports = if (mode == "fault" && caseId == "participant-commit") {
        val a = new ParticipantDelegate(external.ports.warehouseA) {
          override def commit(c: CommitCommand): Future[ParticipantObservation[CommitReceipt]] = super.commit(c).map { r =>
            require(r.isInstanceOf[ParticipantObservation.Confirmed[_]])
            halt(caseId, boundary, dir, c.identity.toString, 76)
          }
        }; external.ports.copy(warehouseA = a)
      } else if (mode == "fault" && caseId == "result") {
        val result = new ReservationResultPort {
          def deliver(e: ResultEnvelope): Future[ResultObservation] = external.ports.results.deliver(e).map { r =>
            require(r.isInstanceOf[ResultObservation.Confirmed]); halt(caseId, boundary, dir, e.key, 76)
          }
          def query(e: ResultEnvelope): Future[ResultObservation] = external.ports.results.query(e)
        }; external.ports.copy(results = result)
      } else external.ports
      val app = new InventoryApplication(system, namespace, ports, ApplicationSettings(500.millis), SystemOwnership.CallerOwned)
      val job = app.workflow.job("job")
      if (mode == "fault") {
        job ! BatchProtocol.Offer(0, "item-0", ByteString(BinaryCodecs.request.encode(request).toArray), "reserve", "same",
          system.systemActorOf(Behaviors.ignore[BatchProtocol.Reply], "offer-reply"))
        // Same sender order is not assumed: close only after the authoritative acceptance, unless this is the input fault itself.
        if (caseId != "input") { eventually(view(job))(_.accepted == 1); job ! BatchProtocol.CloseInput(system.systemActorOf(Behaviors.ignore[BatchProtocol.Reply], "close-reply")) }
        Thread.sleep(20000); throw new AssertionError("FAULT_POINT_NOT_REACHED " + caseId)
      } else {
        require(Files.exists(dir.resolve("fault.record")), "missing independent prior fault marker")
        if (mode == "recover") {
          val before = view(job)
          if (before.accepted == 0) assert(ask(job, BatchProtocol.Offer(0, "item-0", ByteString(BinaryCodecs.request.encode(request).toArray), "reserve", "same", _)).isInstanceOf[BatchProtocol.Accepted])
          if (!before.inputClosed) ask(job, BatchProtocol.CloseInput(_))
          // Recovery is an explicit bounded operator invocation, not a polling side effect.
          val association = await(external.ports.associations.query(item))
          if (association.nonEmpty) {
            val actor = app.reservations.actor(expected.saga)
            val state = await(actor.ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_))).asInstanceOf[StrictSagaCoordinator.Status].state
            if (state.identity.nonEmpty && state.status != StrictStatus.Succeeded && state.status != StrictStatus.Aborted) {
              await(app.reservations.reconcile(item, "operator", 16))
              eventually(await(app.reservations.query(item)))(_.terminal)
            }
          }
          // Exactly one finite workflow wake per currently committed blocked child. Ordinary reads remain inert.
          val current = eventually(view(job))(v => v.phase == "Drained" || v.batches.exists(_.phase == "Blocked"))
          current.batches.filter(_.phase == "Blocked").foreach(b => await(app.workflow.reconcile("job", b.batchId)))
        } else require(mode == "read")
        val end = eventually(view(job))(_.phase == "Drained")
        assert(end.accepted == 1 && end.inputClosed && end.succeeded == 1 && end.failed == 0 && end.active == 0, "RECOVERY_CONSERVATION")
        val result = await(app.reservations.query(item)); assert(result.isInstanceOf[SagaResult.Succeeded])
        assert(await(app.reservations.queryPublished(item)).isInstanceOf[ResultObservation.Confirmed], "SETTLE-BEFORE-RESULT")
        val state = await(app.reservations.actor(expected.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_))).asInstanceOf[StrictSagaCoordinator.Status].state
        assert(state.commitDecision && state.participants.size == 2 && !state.evidence.keys.exists(_.phase == net.imadz.infra.saga.strict.Phase.Compensate))
        assert(state.identity.contains(InventorySaga.runtime(expected.saga)), "original identity changed")
        val ms = manifests(dir, jobPid); assert(ms.size == 2 && ms.forall(_.items.map(_.itemId) == Vector("item-0")))
        (0 to 1).foreach { n =>
          val id = "job/batch-" + n
          assert(await(app.workflow.resourceDomain.ask[Resource.Reply](Resource.Query(id + "/resources", _))).isInstanceOf[Resource.Released])
          assert(events(dir, workflow + "|operation|" + id + "/execute").count(eventName(_) == "TerminalRecorded") == 1)
          assert(events(dir, workflow + "|run|" + id + "/run").count(eventName(_) == "RunCompleted") == 1)
        }
        assert(paths(dir.resolve("external")).size == 6, "extra external effects/results")
        Console.out.println("RECOVERY_MATRIX_PASS " + caseId + " " + boundary + " " + mode + " authoritative-terminal original-identities"); Console.out.flush()
      }
    } finally { system.terminate(); await(system.whenTerminated) }
  }
}
