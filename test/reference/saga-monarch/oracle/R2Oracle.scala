package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.typed.PersistenceId
import akka.util.{ByteString, Timeout}
import net.imadz.monarch.persistence._
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.operation.{OperationProtocol => Op, OperationSettings, PersistentOperation}
import net.imadz.monarch.persistence.resource.{ResourceProtocol => Resource}
import net.imadz.monarch.persistence.workflow._
import org.scalatest.funsuite.AnyFunSuite
import reference.inventory.glue.{CheckedRunFacade, RunFactories}
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

class R2Oracle extends AnyFunSuite {
  import R2Support._
  test("R2-OFFER-QUEUED: duplicate conflict gap backpressure and immutable sealed manifest") {
    fixture("offer-queued") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      implicit val timeout: Timeout = Timeout(3.seconds)
      val d = BatchDefinition("offer", "1", Vector(area(policy = BatchPolicy.CountOrWait(2, 10000))),
        settings.copy(maxActiveItems = 2, maxActiveBytes = 8192))
      val p = new PolicyProgram(d, dir.resolve("external"), m => released(m, _ => ItemDisposition.Completed(Vector(1))))
      val host = new WorkflowHost(sys, "offers", p); val job = host.job("job")
      val blocker = Resource.Request("blocker", "external-blocker", Map("permit" -> 1))
      val grant = eventually(await(host.resourceDomain.ask[Resource.Reply](Resource.Reserve(blocker, _))))(_.isInstanceOf[Resource.Granted])
        .asInstanceOf[Resource.Granted].grant
      assert(offer(job, 1).isInstanceOf[BatchProtocol.Rejected], "gap accepted")
      assert(offer(job, 0) == BatchProtocol.Accepted(0, "item-0", false))
      assert(offer(job, 0) == BatchProtocol.Accepted(0, "item-0", true))
      assert(offer(job, 0, payload = "changed").isInstanceOf[BatchProtocol.Rejected])
      assert(offer(job, 0, key = "changed").isInstanceOf[BatchProtocol.Rejected])
      assert(ask(job, BatchProtocol.Offer(1, "item-0", ByteString("payload"), "work", "same", _)).isInstanceOf[BatchProtocol.Rejected])
      assert(offer(job, 1).isInstanceOf[BatchProtocol.Accepted])
      eventually(view(job))(_.batches.nonEmpty)
      val frozen = manifests(dir, "offers|job|job"); assert(frozen.size == 1 && frozen.head.items.map(_.itemId) == Vector("item-0", "item-1"))
      eventually(await(host.resourceDomain.ask[Resource.Reply](Resource.Query(frozen.head.reservationId, _))))(_.isInstanceOf[Resource.Queued])
      assert(offer(job, 2).isInstanceOf[BatchProtocol.Backpressured])
      assert(offer(job, 1, payload = "changed").isInstanceOf[BatchProtocol.Rejected])
      Thread.sleep(120)
      assert(manifests(dir, "offers|job|job") == frozen, "MANIFEST-FREEZE")
      assert(paths(dir.resolve("external")).isEmpty, "QUEUED dispatched external effect")
      assert(!paths(dir.resolve("journal")).exists(p => new String(java.util.Base64.getUrlDecoder.decode(p.getFileName.toString.stripSuffix(".journal")), "UTF-8").contains("|run|")))
      assert(await(host.resourceDomain.ask[Resource.Reply](Resource.Release(grant.reservationId, grant.token, Resource.Proof(grant.ownerOperationKey, ByteString("forged")), _))).isInstanceOf[Resource.Rejected])
      assert(await(host.resourceDomain.ask[Resource.Reply](Resource.Query(grant.reservationId, _))).isInstanceOf[Resource.Granted], "RESOURCE-PROOF released without evidence")
      assert(await(host.resourceDomain.ask[Resource.Reply](Resource.Release(grant.reservationId, grant.token, Resource.Proof(grant.ownerOperationKey, proof(grant.ownerOperationKey)), _))).isInstanceOf[Resource.Released])
      eventually(view(job))(_.succeeded == 2)
      assert(offer(job, 2).isInstanceOf[BatchProtocol.Accepted], "backpressure consumed sequence")
      ask(job, BatchProtocol.CloseInput(_)); val end = eventually(view(job))(_.phase == "Drained")
      assert(end.accepted == 3 && end.succeeded == 3 && end.active == 0)
      assert(offer(job, 2) == BatchProtocol.Accepted(2, "item-2", true))
      assert(offer(job, 3).isInstanceOf[BatchProtocol.Rejected])
      assert(manifests(dir, "offers|job|job").flatMap(_.items.map(_.itemId)).sorted == Vector("item-0", "item-1", "item-2"))
    }
  }
  test("R2-WAIT-EOF: real timer seals tail and explicit EOF closes a partial batch") {
    fixture("wait-eof") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val p = new PolicyProgram(BatchDefinition("wait", "1", Vector(area(policy = BatchPolicy.CountOrWait(2, 300))), settings),
        dir.resolve("external"), m => released(m, _ => ItemDisposition.Completed(Vector(1))))
      val host = new WorkflowHost(sys, "wait", p); val job = host.job("job")
      offer(job, 0); Thread.sleep(60); assert(view(job).batches.isEmpty && view(job).active == 1)
      eventually(view(job))(_.succeeded == 1)
      val first = manifests(dir, "wait|job|job").head
      val accepted = events(dir, "wait|job|job").find(eventName(_) == "InputAccepted").get
      assert(first.sealedAt - field(field(accepted, "record"), "acceptedAt").asInstanceOf[Long] >= 300)
      offer(job, 1); ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained")
      assert(end.succeeded == 2 && manifests(dir, "wait|job|job").map(_.items.size) == Vector(1, 1))
    }
  }
  test("R2-COMPATIBILITY-HARD-MIN: distinct keys never mix and EOF cannot bypass physical minimum") {
    fixture("hard-min") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val p = new PolicyProgram(BatchDefinition("hard", "1", Vector(area(policy = BatchPolicy.compatible(2, 2, 1))), settings),
        dir.resolve("external"), m => released(m, _ => ItemDisposition.Completed(Vector(1))))
      val job = new WorkflowHost(sys, "hard", p).job("job")
      offer(job, 0, key = "red"); offer(job, 1, key = "blue"); offer(job, 2, key = "red")
      ask(job, BatchProtocol.CloseInput(_)); eventually(view(job))(_.succeeded == 2); Thread.sleep(100)
      val end = view(job); val sealedBatches = manifests(dir, "hard|job|job")
      assert(end.phase == "ClosingBlocked" && end.active == 1 && end.succeeded == 2)
      assert(sealedBatches.size == 1 && sealedBatches.head.items.map(_.itemId) == Vector("item-0", "item-2"))
      assert(sealedBatches.head.items.map(_.compatibilityKey).distinct == Vector("red"))
      assert(end.items.find(_.itemId == "item-1").get.executions.isEmpty)
    }
  }
  test("R2-SUBSET-RETRY: successful item never reexecutes and attempt history belongs to each item") {
    fixture("subset") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val p = new PolicyProgram(BatchDefinition("subset", "1", Vector(area(policy = BatchPolicy.CountOrWait(2, 10000, 2, true))), settings), dir.resolve("external"),
        m => released(m, i => if (i.itemId == "item-1" && i.execution == 0) ItemDisposition.Retry(100) else ItemDisposition.Completed(i.payload)))
      val job = new WorkflowHost(sys, "subset", p).job("job")
      offer(job, 0); offer(job, 1); ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained"); val ms = manifests(dir, "subset|job|job")
      assert(end.succeeded == 2 && ms.size == 2)
      assert(ms.head.items.map(_.itemId) == Vector("item-0", "item-1") && ms(1).items.map(_.itemId) == Vector("item-1"))
      assert(ms(1).items.head.execution == 1 && ms(1).items.head.lineage.size == 1)
      assert(end.items.map(i => i.itemId -> i.executions("work")).toMap == Map("item-0" -> 1, "item-1" -> 2))
    }
  }
  test("R2-HOLD-VERIFY: held item retains credit and query-only verification never repeats business effects") {
    fixture("hold-verify") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val p = new PolicyProgram(BatchDefinition("hold", "1", Vector(area(), area("verify")), settings), dir.resolve("external"),
        m => released(m, i => if (m.area == "work") ItemDisposition.Hold("needs authoritative verification") else ItemDisposition.Completed(i.payload)),
        (i, a) => if (i.area == "work" && a == "verify") Right(()) else Left("query-only route not registered"))
      val job = new WorkflowHost(sys, "hold", p).job("job")
      offer(job, 0); ask(job, BatchProtocol.CloseInput(_)); val held = eventually(view(job))(_.held == 1)
      assert(held.phase == "ClosingBlocked" && held.active == 1 && held.succeeded == 0)
      assert(ask(job, BatchProtocol.VerifyItem(0, "work", "same", _)).isInstanceOf[BatchProtocol.Rejected])
      val before = snapshots(dir.resolve("external"))
      assert(ask(job, BatchProtocol.VerifyItem(0, "verify", "same", _)).isInstanceOf[BatchProtocol.Current])
      val end = eventually(view(job))(_.phase == "Drained")
      assert(end.succeeded == 1 && end.items.head.executions == Map("work" -> 1, "verify" -> 1))
      assert(snapshots(dir.resolve("external")) == before, "verification wrote business/external receipts")
    }
  }
  test("R2-DRAIN-NOT-SUCCESS: real failed disposition drains EOF without inventing business success") {
    fixture("failed-drain") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val p = new PolicyProgram(BatchDefinition("failure", "1", Vector(area()), settings), dir.resolve("external"),
        m => released(m, _ => ItemDisposition.Failed("known business rejection")))
      val job = new WorkflowHost(sys, "failure", p).job("job"); offer(job, 0); ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained")
      assert(end.failed == 1 && end.succeeded == 0 && end.active == 0 && end.items.head.result.isEmpty)
    }
  }
  test("R2-WHOLE-CARRY: all original holders travel through retained occupancy and release together") {
    fixture("whole-carry") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      implicit val timeout: Timeout = Timeout(3.seconds)
      val batch = BatchPolicy.CountOrWait(2, 50, 2, false)
      val d = BatchDefinition("carry", "1", Vector(area("work", batch, Map("executor" -> 1, "occupancy" -> 1)),
        area("middle", batch, Map("executor" -> 1)), area("finish", batch, Map("executor" -> 1))), settings)
      val p = new PolicyProgram(d, dir.resolve("external"), m => m.area match {
        case "work" => BatchCompletion(m.items.map(i => ItemDecision(i.itemId, ItemDisposition.Route("middle", "all"))),
          ResourceDisposition.Carry("occupancy", "occupancy-owner", Map("occupancy" -> 1), proof(m.operationKey).toVector))
        case "middle" => released(m, _ => ItemDisposition.Route("finish", "all")).copy(retainCarried = true)
        // Incoming-claim release must bind that claim owner too; this fixture uses a proof policy supporting the final handoff below.
        case _ => released(m, i => ItemDisposition.Completed(i.payload))
      }, capacities = Map("executor" -> 1, "occupancy" -> 1))
      val releaseAware = new WorkflowProgram {
        val definition = p.definition; val capacities = p.capacities
        val resourceEvidence = new net.imadz.monarch.persistence.resource.ResourceEvidenceValidator {
          override def validate(g: Resource.Grant, evidence: Resource.Proof): Either[String, Unit] =
            if (evidence.operationKey == g.ownerOperationKey && (evidence.evidence == proof(g.ownerOperationKey) ||
                g.ownerOperationKey == "occupancy-owner" && evidence.evidence == proof("job/batch-2/execute"))) Right(()) else Left("invalid carry release")
        }
        def connector(a: String) = p.connector(a)
        def operation(m: BatchManifest) = p.operation(m)
        def complete(m: BatchManifest, t: Op.Terminal) = p.complete(m, t)
      }
      val host = new WorkflowHost(sys, "carry", releaseAware); val job = host.job("job")
      offer(job, 0); offer(job, 1); ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained"); val ms = manifests(dir, "carry|job|job")
      assert(end.succeeded == 2 && ms.map(_.area) == Vector("work", "middle", "finish"))
      assert(ms.forall(_.items.map(_.itemId) == Vector("item-0", "item-1")))
      assert(ms.tail.forall(m => m.items.map(_.carried).distinct.size == 1 && m.items.head.carried.map(_.reservationId) == Vector("occupancy")))
      assert(ms(1).items.head.carried == ms(2).items.head.carried)
      assert(await(host.resourceDomain.ask[Resource.Reply](Resource.Query("occupancy", _))).isInstanceOf[Resource.Released])
    }
  }
  test("RUN-PURE-ACTUAL: fixed two steps commit ordered checkpoints and attach never reruns") {
    fixture("pure-run") { (_, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val calls = new java.util.concurrent.atomic.AtomicInteger()
      val d = RunDefinition[String]("standalone-pure", "1", "bytes-1", Vector("one", "two"))
      val actor = sys.systemActorOf(RunFactories.pure(PersistenceId.ofUniqueId("standalone-pure"), d,
        (step, bytes) => { calls.incrementAndGet(); Future.successful(bytes ++ ByteString("/" + step)) }), "pure")
      val port = RunSubmissionPort(_ => actor.narrow[RunProtocol.Request]); val facade = new CheckedRunFacade(port, d)
      val submission = RunSubmission("pure", d.id, d.version, d.codecVersion, ByteString("original"))
      await(facade.ensure(submission)); assert(eventually(await(facade.query(submission)))(_.exists(_.nonEmpty)) == Right(Some(ByteString("original/one/two"))))
      await(facade.ensure(submission)); await(facade.query(submission)); assert(calls.get == 2)
      assert(await(facade.ensure(submission.copy(initialState = ByteString("changed")))).isLeft)
    }
  }
  test("RUN-MANAGED-ACTUAL: single operation uses durable public operation terminal and original request") {
    fixture("managed-run") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val p = new PolicyProgram(BatchDefinition("single", "1", Vector(area()), settings), dir.resolve("external"), m => released(m, i => ItemDisposition.Completed(i.payload)))
      val m = BatchManifest("standalone", "batch", "work", "1", Vector(Item(0, "one", Vector(1), "same", "work")), 1L)
      val request = p.operation(m)
      val operation = sys.systemActorOf(PersistentOperation.behavior(PersistenceId.ofUniqueId("single-operation"), request.operationKey,
        p.connector("work"), OperationSettings.fromConfig(sys.settings.config)), "operation")
      val d = RunDefinition[String]("standalone-managed", "1", "bytes-1", Vector("execute"))
      val actor = sys.systemActorOf(RunFactories.managedSingle(PersistenceId.ofUniqueId("single-run"), d, request,
        key => { assert(key == request.operationKey); operation }, ManagedOperationSettings()), "managed")
      val port = RunSubmissionPort(_ => actor.narrow[RunProtocol.Request]); val facade = new CheckedRunFacade(port, d)
      val submission = RunSubmission("managed", d.id, d.version, d.codecVersion, ByteString("original"))
      await(facade.ensure(submission)); assert(eventually(await(facade.query(submission)))(_.exists(_.nonEmpty)) == Right(Some(request.payload)))
      val before = snapshots(dir.resolve("external")); await(facade.ensure(submission)); assert(snapshots(dir.resolve("external")) == before)
      assert(events(dir, "single-operation").count(eventName(_) == "TerminalRecorded") == 1)
      assert(events(dir, "single-run").count(eventName(_) == "RunCompleted") == 1)
    }
  }
}
