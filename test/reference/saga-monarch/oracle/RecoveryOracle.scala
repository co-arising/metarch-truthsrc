package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import com.typesafe.config.ConfigFactory
import java.nio.file.{Files, Paths}
import net.imadz.monarch.persistence.SerializedValidationJournal
import reference.inventory.kernel._
import reference.inventory.ext.FileInventoryPorts
import reference.inventory.glue._
import reference.inventory.root.InventoryApplication
import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._

/** Three independent JVM invocations share the original file journal and external ledger. */
object RecoveryOracle {
  def main(args: Array[String]): Unit = {
    require(args.length == 2 && Set("crash", "recover", "read")(args(0)))
    val mode = args(0); val directory = Paths.get(args(1)); Files.createDirectories(directory)
    val config = ConfigFactory.parseString(s"""
      serialized-validation-journal.directory = "${directory.resolve("journal") }"
      akka.persistence.snapshot-store.plugin = "akka.persistence.no-snapshot-store"
      akka.loglevel = WARNING
    """).withFallback(SerializedValidationJournal.config).withFallback(ConfigFactory.load())
    val system = ActorSystem[Nothing](Behaviors.empty, "inventory-recovery", config)
    implicit val ec: ExecutionContext = system.executionContext
    def await[A](f: Future[A]): A = Await.result(f, 5.seconds)
    val request = ReservationRequest(RequestId("cross-jvm-request"), Warehouse("warehouseA"), Warehouse("warehouseB"), Sku("sku-1"), Quantity(2))
    val item = ItemIdentity("cross-jvm-job", 0, "original-item")
    val authorization = new RecoveryAuthorization {
      def authorize(id: SagaIdentity, token: String): Either[String, String] =
        if (token == "explicit-recovery-fixture") Right("fixture-operator") else Left("denied")
    }
    val external = new FileInventoryPorts(directory.resolve("external"), request.warehouseA, request.warehouseB, authorization)
    val ports = if (mode != "crash") external.ports else external.ports.copy(warehouseA = new ParticipantDelegate(external.ports.warehouseA) {
      override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = super.prepare(c).map { receipt =>
        require(receipt.isInstanceOf[ParticipantObservation.Confirmed[_]], "external prepare did not force")
        println("EXPECTED_CRASH PARTICIPANT-ACK durable-before-ack"); System.out.flush()
        Runtime.getRuntime.halt(73)
        receipt
      }
    })
    val app = new InventoryApplication(system, "cross-jvm-original", ports, ApplicationSettings(1.second), SystemOwnership.CallerOwned)
    try {
      if (mode == "crash") {
        await(app.reservations.start(item, request))
        Await.result(Promise[Unit]().future, 30.seconds)
        throw new AssertionError("expected participant crash did not occur")
      }
      val association = await(app.reservations.association(item))
      require(association == InventorySaga.expected(item, request), "original association drift")
      val first = await(app.reservations.query(item))
      if (mode == "recover") {
        require(!first.terminal, "unacknowledged intent replay must not fabricate success")
        Thread.sleep(100)
        require(await(app.reservations.query(item)) == first, "replay/query reconciled automatically")
        val b = PhaseIdentity(association.saga, "warehouse-b", request.warehouseB, "reserve-b", ReservationPhase.Prepare)
        require(await(external.ports.warehouseB.queryPrepare(PrepareCommand(b, request, None))).isInstanceOf[ParticipantObservation.NotFound],
          "replay executed participant B")
        val denied = scala.util.Try(await(app.reservations.reconcile(item, "denied", 8)))
        require(denied.isFailure, "unauthorized recovery")
        await(app.reservations.reconcile(item, "explicit-recovery-fixture", 8))
        val until = System.nanoTime() + 30.seconds.toNanos
        var result = await(app.reservations.query(item))
        while (!result.terminal && System.nanoTime() < until) { Thread.sleep(25); result = await(app.reservations.query(item)) }
        require(result.isInstanceOf[SagaResult.Succeeded], "authorized bounded recovery did not succeed")
        require(await(app.reservations.publish(item)).isInstanceOf[ResultObservation.Confirmed], "result not durably delivered")
        println("RECOVERY_PASS PARTICIPANT-ACK original-identities authorized-forward")
      } else {
        require(first.isInstanceOf[SagaResult.Succeeded], "third JVM did not recover terminal")
        require(await(app.reservations.queryPublished(item)).isInstanceOf[ResultObservation.Confirmed], "third JVM lost result receipt")
        println("RECOVERY_PASS THIRD-READ inert-terminal")
      }
    } finally { system.terminate(); await(system.whenTerminated) }
  }
}
